import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { supabase } from '../config.js';
import path from 'path';
import fs from 'fs';

class WhatsAppChannel {
  constructor(channelManager) {
    this.channelManager = channelManager;
    this.connections = new Map();
    this.qrCallbacks = new Map();
    this.logger = pino({ level: 'info' });
  }

  async connectUser(userId) {
    if (this.connections.has(userId)) {
      return { success: true, message: 'Already connected' };
    }

    const authDir = path.join(process.cwd(), 'wa-sessions', userId);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, this.logger)
      },
      printQRInTerminal: false,
      logger: this.logger,
      browser: ['Advisori', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const callback = this.qrCallbacks.get(userId);
        if (callback) callback(qr);
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
          : true;

        if (shouldReconnect) {
          console.log('WhatsApp reconnecting for user:', userId);
          setTimeout(() => this.connectUser(userId), 3000);
        } else {
          this.connections.delete(userId);
          await this.updateConnectionStatus(userId, false);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connected for user:', userId);
        this.connections.set(userId, sock);
        await this.updateConnectionStatus(userId, true);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text;

        if (text) {
          await this.handleIncomingMessage(userId, {
            chatId: msg.key.remoteJid,
            text,
            timestamp: msg.messageTimestamp,
            messageId: msg.key.id
          });
        }
      }
    });

    return { success: true, message: 'Connecting...' };
  }

  async generateQR(userId) {
    return new Promise((resolve, reject) => {
      this.qrCallbacks.set(userId, (qr) => {
        resolve(qr);
        this.qrCallbacks.delete(userId);
      });

      this.connectUser(userId).catch(reject);

      setTimeout(() => {
        if (this.qrCallbacks.has(userId)) {
          this.qrCallbacks.delete(userId);
          reject(new Error('QR generation timeout'));
        }
      }, 60000);
    });
  }

  async handleIncomingMessage(userId, { chatId, text, timestamp, messageId }) {
    const sessionId = `${userId}_whatsapp_${chatId}`;
    
    let session = await this.getSession(sessionId);
    if (!session) {
      session = await this.createSession(userId, 'whatsapp', chatId);
    }

    await this.saveMessage(sessionId, 'user', text);

    const response = await this.channelManager.processMessage({
      userId,
      sessionId,
      message: text,
      channel: 'whatsapp'
    });

    await this.sendMessage(userId, chatId, response.content);
    await this.saveMessage(sessionId, 'assistant', response.content);
  }

  async sendMessage(userId, chatId, text) {
    const sock = this.connections.get(userId);
    if (!sock) throw new Error('WhatsApp not connected');

    await sock.sendMessage(chatId, { text });
  }

  async disconnect(userId) {
    const sock = this.connections.get(userId);
    if (sock) {
      await sock.logout();
      this.connections.delete(userId);
      await this.updateConnectionStatus(userId, false);
    }
  }

  async getSession(sessionId) {
    const { data } = await supabase
      .from('channel_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    return data;
  }

  async createSession(userId, channel, chatId) {
    const sessionId = `${userId}_${channel}_${chatId}`;
    const { data } = await supabase
      .from('channel_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        channel,
        channel_chat_id: chatId
      })
      .select()
      .single();
    return data;
  }

  async saveMessage(sessionId, role, content) {
    await supabase
      .from('channel_messages')
      .insert({
        session_id: sessionId,
        role,
        content
      });
  }

  async updateConnectionStatus(userId, connected) {
    await supabase
      .from('channel_connections')
      .upsert({
        user_id: userId,
        channel: 'whatsapp',
        connected,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,channel'
      });
  }
}

export default WhatsAppChannel;
