import { chat } from './ai.js';
import { supabase } from '../config.js';

class ChannelManager {
  constructor() {
    this.channels = new Map(); // channel name -> channel instance
  }

  registerChannel(name, channelInstance) {
    this.channels.set(name, channelInstance);
    console.log(`📡 Channel registered: ${name}`);
  }

  async processMessage({ userId, sessionId, message, channel }) {
    try {
      // Get user context
      const { data: user } = await supabase
        .from('users')
        .select('*, souls(*)')
        .eq('id', userId)
        .single();

      if (!user) {
        throw new Error('User not found');
      }

      // Get session history
      const history = await this.getSessionHistory(sessionId);

      // Get soul data
      const soul = user.souls?.[0];

      // Process with AI
      const response = await chat({
        userId,
        message,
        advisorId: 'auto',
        stream: false
      });

      return {
        content: response.content,
        usage: response.usage,
        activeSkill: response.activeSkill
      };
    } catch (error) {
      console.error('Channel message processing error:', error);
      return {
        content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
        error: error.message
      };
    }
  }

  async getSessionHistory(sessionId, limit = 10) {
    const { data } = await supabase
      .from('channel_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).reverse();
  }

  getChannel(name) {
    return this.channels.get(name);
  }

  async getUserChannels(userId) {
    const { data } = await supabase
      .from('channel_connections')
      .select('*')
      .eq('user_id', userId);

    return data || [];
  }

  async getChannelStatus(userId, channel) {
    const { data } = await supabase
      .from('channel_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('channel', channel)
      .single();

    return data;
  }
}

export default new ChannelManager();
