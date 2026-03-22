import { supabase } from '../config.js';

export class MemoryService {
  // Short-term Memory (Session)
  static async addSessionMessage(userId, sessionId, message) {
    const { data, error } = await supabase
      .from('session_memories')
      .upsert({
        user_id: userId,
        session_id: sessionId,
        messages: await this.getSessionMessages(userId, sessionId).then(msgs => [...msgs, message]),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getSessionMessages(userId, sessionId) {
    const { data, error } = await supabase
      .from('session_memories')
      .select('messages')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single();

    return data?.messages || [];
  }

  static async updateSessionContext(userId, sessionId, context) {
    const { data, error } = await supabase
      .from('session_memories')
      .update({
        context,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Long-term Memory
  static async addLongTermMemory(userId, memoryData) {
    const { data, error } = await supabase
      .from('memories')
      .insert({
        user_id: userId,
        ...memoryData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getImportantMemories(userId, limit = 50) {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .gte('importance', 5)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  static async getMemoriesByType(userId, type, limit = 20) {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Memory Consolidation
  static async consolidateSessionMemories(userId, sessionId) {
    const sessionData = await supabase
      .from('session_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single();

    if (!sessionData.data) return null;

    const messages = sessionData.data.messages;
    const summary = await this.generateMemorySummary(messages);
    
    // Create long-term memory from important session data
    const importantMemories = await this.extractImportantMemories(messages);
    
    for (const memory of importantMemories) {
      await this.addLongTermMemory(userId, {
        type: 'learning',
        title: memory.title,
        content: memory.content,
        importance: memory.importance,
        tags: memory.tags
      });
    }

    // Log consolidation
    await supabase
      .from('memory_consolidation_logs')
      .insert({
        user_id: userId,
        session_memories_consolidated: messages.length,
        long_term_memories_created: importantMemories.length,
        summary: summary
      });

    // Clear session memory
    await supabase
      .from('session_memories')
      .delete()
      .eq('user_id', userId)
      .eq('session_id', sessionId);

    return {
      consolidated: messages.length,
      created: importantMemories.length,
      summary
    };
  }

  static async generateMemorySummary(messages) {
    // This would integrate with AI to generate summary
    // For now, return simple summary
    return `Session with ${messages.length} messages`;
  }

  static async extractImportantMemories(messages) {
    // This would use AI to extract important information
    // For now, simple heuristic based on message content
    const important = [];
    
    messages.forEach(msg => {
      if (msg.content.length > 100 && Math.random() > 0.7) {
        important.push({
          title: `Important: ${msg.content.substring(0, 50)}...`,
          content: msg.content,
          importance: Math.floor(Math.random() * 5) + 5,
          tags: ['conversation', 'important']
        });
      }
    });

    return important;
  }

  // Get combined memory context for AI
  static async getMemoryContext(userId, sessionId) {
    const [sessionMessages, longTermMemories, soul] = await Promise.all([
      this.getSessionMessages(userId, sessionId),
      this.getImportantMemories(userId, 10),
      supabase.from('souls').select('*').eq('user_id', userId).single()
    ]);

    return {
      short_term: {
        messages: sessionMessages.slice(-20), // Last 20 messages
        context: sessionMessages[0]?.context || {}
      },
      long_term: {
        memories: longTermMemories,
        personality: soul.data?.personality || '',
        speaking_style: soul.data?.speaking_style || ''
      }
    };
  }
}
