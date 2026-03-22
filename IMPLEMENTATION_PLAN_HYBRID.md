# Advisori + OpenClaw Hybrid Integration - Implementation Plan

## 🎯 **Confirmed Approach**

**Strategy:** Hybrid Integration (Custom Build)  
**Channels:** Telegram + WhatsApp + Discord  
**Infrastructure:** Minimal cost (target: $0 - single VPS shared hosting)  
**Timeline:** Phased implementation, starting immediately  

---

## 💰 **Zero-Cost Architecture Design**

### **Shared Gateway Model**
```
Single VPS ($0 if using existing server)
├── Advisori Backend (Fastify) - Port 4000
│   ├── WebSocket Gateway (inspired by OpenClaw)
│   ├── WhatsApp Handler (Baileys) - shared instance
│   ├── Telegram Handler (grammY) - shared instance
│   ├── Discord Handler (discord.js) - shared instance
│   └── Session Manager (per-user isolation in memory/DB)
├── Advisori Frontend (Vite) - Port 3000
└── Supabase (Free tier - 500MB DB, 2GB bandwidth)
```

### **Cost Breakdown:**
- **VPS:** $0 (use existing server or free tier)
- **Supabase:** $0 (free tier: 500MB DB, 2GB bandwidth, 50K monthly active users)
- **Domain:** $0 (use subdomain or existing domain)
- **AI APIs:** Pay-per-use (user brings own API keys)
- **Total:** **$0/month** 🎉

### **Scaling Strategy (when needed):**
- Free tier → 100 users: $0
- 100-500 users: $5-10/month (upgrade Supabase)
- 500-1000 users: $20-50/month (dedicated VPS)

---

## 📦 **Dependencies to Install**

### **WhatsApp (Baileys)**
```bash
npm install @whiskeysockets/baileys @hapi/boom pino qrcode-terminal
```

### **Telegram (grammY)**
```bash
npm install grammy
```

### **Discord (discord.js)**
```bash
npm install discord.js
```

### **WebSocket**
```bash
npm install ws
```

### **QR Code Generation**
```bash
npm install qrcode qrcode.react
```

---

## 🏗️ **Phase 1: Foundation (Week 1)**

### **Step 1.1: Install Dependencies**
```bash
cd d:\advisori
npm install @whiskeysockets/baileys @hapi/boom pino qrcode-terminal grammy discord.js ws qrcode
```

### **Step 1.2: Create Directory Structure**
```
d:\advisori\backend\
├── gateway\
│   ├── websocket.js          # WebSocket server
│   └── protocol.js           # Protocol definitions
├── channels\
│   ├── whatsapp.js           # WhatsApp handler
│   ├── telegram.js           # Telegram handler
│   └── discord.js            # Discord handler
├── services\
│   ├── sessionManager.js     # Session management
│   └── channelManager.js     # Channel orchestration
└── routes\
    └── channels.js           # Channel API routes
```

### **Step 1.3: Database Schema Updates**
```sql
-- Add to Supabase migration

-- Channel connections (per user)
CREATE TABLE channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'discord')),
  connected BOOLEAN DEFAULT FALSE,
  credentials JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, channel)
);

-- Channel sessions (per conversation)
CREATE TABLE channel_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  channel_chat_id TEXT NOT NULL, -- WhatsApp JID, Telegram chat_id, Discord channel_id
  context JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, channel, channel_chat_id)
);

-- Channel messages (history)
CREATE TABLE channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES channel_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_channel_connections_user_id ON channel_connections(user_id);
CREATE INDEX idx_channel_sessions_user_id ON channel_sessions(user_id);
CREATE INDEX idx_channel_sessions_last_message ON channel_sessions(last_message_at);
CREATE INDEX idx_channel_messages_session_id ON channel_messages(session_id);

-- RLS Policies
ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own channel connections"
  ON channel_connections FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own channel sessions"
  ON channel_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own channel messages"
  ON channel_messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM channel_sessions WHERE user_id = auth.uid()
    )
  );
```

---

## 🔧 **Phase 2: WhatsApp Integration (Week 2)**

### **Implementation: `backend/channels/whatsapp.js`**

```javascript
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
    this.connections = new Map(); // userId -> socket
    this.qrCallbacks = new Map(); // userId -> callback
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
        // Send QR to user via callback
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
        console.log('WhatsApp connected for user:', userId);
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

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.qrCallbacks.has(userId)) {
          this.qrCallbacks.delete(userId);
          reject(new Error('QR generation timeout'));
        }
      }, 60000);
    });
  }

  async handleIncomingMessage(userId, { chatId, text, timestamp, messageId }) {
    // Get or create session
    const sessionId = `${userId}_whatsapp_${chatId}`;
    
    let session = await this.getSession(sessionId);
    if (!session) {
      session = await this.createSession(userId, 'whatsapp', chatId);
    }

    // Save user message
    await this.saveMessage(sessionId, 'user', text);

    // Get AI response
    const response = await this.channelManager.processMessage({
      userId,
      sessionId,
      message: text,
      channel: 'whatsapp'
    });

    // Send response back to WhatsApp
    await this.sendMessage(userId, chatId, response.content);

    // Save assistant message
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
```

---

## 🔧 **Phase 3: Telegram Integration (Week 3)**

### **Implementation: `backend/channels/telegram.js`**

```javascript
import { Bot } from 'grammy';
import { supabase } from '../config.js';

class TelegramChannel {
  constructor(channelManager) {
    this.channelManager = channelManager;
    this.bots = new Map(); // userId -> Bot instance
  }

  async connectUser(userId, botToken) {
    if (this.bots.has(userId)) {
      return { success: true, message: 'Already connected' };
    }

    try {
      const bot = new Bot(botToken);

      // Verify token
      const me = await bot.api.getMe();
      console.log(`Telegram bot connected for user ${userId}:`, me.username);

      // Handle messages
      bot.on('message:text', async (ctx) => {
        await this.handleIncomingMessage(userId, {
          chatId: ctx.chat.id.toString(),
          text: ctx.message.text,
          timestamp: ctx.message.date,
          messageId: ctx.message.message_id
        });
      });

      // Start bot
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
```

---

## 🔧 **Phase 4: Discord Integration (Week 4)**

### **Implementation: `backend/channels/discord.js`**

```javascript
import { Client, GatewayIntentBits } from 'discord.js';
import { supabase } from '../config.js';

class DiscordChannel {
  constructor(channelManager) {
    this.channelManager = channelManager;
    this.clients = new Map(); // userId -> Discord Client
  }

  async connectUser(userId, botToken) {
    if (this.clients.has(userId)) {
      return { success: true, message: 'Already connected' };
    }

    try {
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages
        ]
      });

      client.on('ready', async () => {
        console.log(`Discord bot connected for user ${userId}:`, client.user.tag);
        await this.updateConnectionStatus(userId, true, { botToken });
      });

      client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        await this.handleIncomingMessage(userId, {
          chatId: message.channel.id,
          text: message.content,
          timestamp: message.createdTimestamp,
          messageId: message.id
        });
      });

      await client.login(botToken);
      this.clients.set(userId, client);

      return { success: true, message: 'Connected' };
    } catch (error) {
      console.error('Discord connection error:', error);
      throw new Error('Invalid bot token or connection failed');
    }
  }

  async handleIncomingMessage(userId, { chatId, text, timestamp, messageId }) {
    const sessionId = `${userId}_discord_${chatId}`;
    
    let session = await this.getSession(sessionId);
    if (!session) {
      session = await this.createSession(userId, 'discord', chatId);
    }

    await this.saveMessage(sessionId, 'user', text);

    const response = await this.channelManager.processMessage({
      userId,
      sessionId,
      message: text,
      channel: 'discord'
    });

    await this.sendMessage(userId, chatId, response.content);
    await this.saveMessage(sessionId, 'assistant', response.content);
  }

  async sendMessage(userId, channelId, text) {
    const client = this.clients.get(userId);
    if (!client) throw new Error('Discord not connected');

    const channel = await client.channels.fetch(channelId);
    await channel.send(text);
  }

  async disconnect(userId) {
    const client = this.clients.get(userId);
    if (client) {
      await client.destroy();
      this.clients.delete(userId);
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
        channel: 'discord',
        connected,
        credentials,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,channel'
      });
  }
}

export default DiscordChannel;
```

---

## 📅 **Implementation Timeline**

### **Week 1: Foundation**
- ✅ Install dependencies
- ✅ Create directory structure
- ✅ Update database schema
- ✅ Create channel manager service

### **Week 2: WhatsApp**
- Implement WhatsApp channel handler
- Test QR code generation
- Test message sending/receiving
- Test session management

### **Week 3: Telegram**
- Implement Telegram channel handler
- Test bot token validation
- Test message handling
- Integrate with existing chat service

### **Week 4: Discord**
- Implement Discord channel handler
- Test bot connection
- Test message routing
- End-to-end testing

### **Week 5: Frontend UI**
- Build channel management page
- QR code display for WhatsApp
- Bot token input for Telegram/Discord
- Connection status indicators

### **Week 6: Testing & Polish**
- Load testing
- Security audit
- Bug fixes
- Documentation

---

## ✅ **Success Criteria**

- [ ] Users can connect WhatsApp via QR code
- [ ] Users can connect Telegram via bot token
- [ ] Users can connect Discord via bot token
- [ ] Messages from all channels route to AI correctly
- [ ] Responses sent back to correct channel
- [ ] Session isolation per user per channel
- [ ] All running on single VPS ($0 cost)
- [ ] No data leakage between users
- [ ] 99% uptime
- [ ] < 2 second response time

---

**Ready to start implementation!** 🚀🦞
