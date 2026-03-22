import { Client, GatewayIntentBits } from 'discord.js';
import { supabase } from '../config.js';

class DiscordChannel {
  constructor(channelManager) {
    this.channelManager = channelManager;
    this.clients = new Map();
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
        console.log(`✅ Discord bot connected for user ${userId}:`, client.user.tag);
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
