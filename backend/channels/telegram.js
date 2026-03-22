import { Bot } from 'grammy';
import { supabase } from '../config.js';

class TelegramChannel {
  constructor(channelManager) {
    this.channelManager = channelManager;
    this.bots = new Map();
  }

  async connectUser(userId, botToken) {
    if (this.bots.has(userId)) {
      return { success: true, message: 'Already connected' };
    }

    try {
      const bot = new Bot(botToken);

      const me = await bot.api.getMe();
      console.log(`✅ Telegram bot connected for user ${userId}:`, me.username);

      bot.on('message:text', async (ctx) => {
        await this.handleIncomingMessage(userId, {
          chatId: ctx.chat.id.toString(),
          text: ctx.message.text,
          timestamp: ctx.message.date,
          messageId: ctx.message.message_id
        });
      });

      bot.start();

      this.bots.set(userId, bot);
      await this.updateConnectionStatus(userId, true, { botToken });

      return { success: true, message: 'Connected', botUsername: me.username };
    } catch (error) {
      console.error('Telegram connection error:', error);
      throw new Error('Invalid bot token or connection failed');
    }
  }

  async handleIncomingMessage(userId, { chatId, text, timestamp, messageId }) {
    const sessionId = `${userId}_telegram_${chatId}`;
    
    let session = await this.getSession(sessionId);
    if (!session) {
      session = await this.createSession(userId, 'telegram', chatId);
    }

    await this.saveMessage(sessionId, 'user', text);

    const response = await this.channelManager.processMessage({
      userId,
      sessionId,
      message: text,
      channel: 'telegram'
    });

    await this.sendMessage(userId, chatId, response.content);
    await this.saveMessage(sessionId, 'assistant', response.content);
  }

  async sendMessage(userId, chatId, text) {
    const bot = this.bots.get(userId);
    if (!bot) throw new Error('Telegram not connected');

    await bot.api.sendMessage(chatId, text);
  }

  async disconnect(userId) {
    const bot = this.bots.get(userId);
    if (bot) {
      await bot.stop();
      this.bots.delete(userId);
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

  async updateConnectionStatus(userId, connected, credentials = {}) {
    await supabase
      .from('channel_connections')
      .upsert({
        user_id: userId,
        channel: 'telegram',
        connected,
        credentials,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,channel'
      });
  }
}

export default TelegramChannel;
