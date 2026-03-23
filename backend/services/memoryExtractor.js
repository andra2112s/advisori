import { supabase } from '../config.js';

const IMPORTANCE_PATTERNS = {
  skip: [
    /^(halo|hai|hi|oke|ok|ya|tidak|makasih|thanks|mantap|siap|noted|good|great|yes|no)$/i,
    /^[\s\S]{1,15}$/, // Very short messages
    /^(wkwk|haha|lol|😂|👍|🙏|😄|😀)$/i, // Just emojis
    /^(terima|kasih|thanks|thx)$/i,
  ],
  episodic: [
    'tanya harga', 'rekomendasi', 'lagi think', 'mikirin', 'lagi rencana',
    'mau beli', 'mau jual', 'lagi cari', 'bingung', ' But first, I',
  ],
  semantic: [
    'saya kerja', 'saya adalah', 'saya punya', 'saya sedang', 'profesi',
    'investor', 'pengusaha', 'mahasiswa', 'kuliah', 'bisnis', 'rumah',
    'nikah', 'pensiun', 'target', 'goals', 'risk appetite', 'pengalaman',
  ],
};

function shouldSaveMemory(message) {
  const lower = message.toLowerCase().trim();
  
  for (const pattern of IMPORTANCE_PATTERNS.skip) {
    if (pattern.test(lower)) {
      return null;
    }
  }
  
  let semanticScore = 0;
  let episodicScore = 0;
  
  for (const keyword of IMPORTANCE_PATTERNS.semantic) {
    if (lower.includes(keyword)) semanticScore += 2;
  }
  for (const keyword of IMPORTANCE_PATTERNS.episodic) {
    if (lower.includes(keyword)) episodicScore += 1;
  }
  
  if (semanticScore >= 3) return 'semantic';
  if (episodicScore >= 2) return 'episodic';
  return null;
}

async function generateEmbedding(text) {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) return null;
  
  try {
    const response = await fetch('https://api.z.ai/api/coding/paas/v4/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'embedding-3',
        input: text
      })
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (err) {
    console.error('[Memory] Embedding error:', err.message);
    return null;
  }
}

async function extractFacts(message, response) {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) return [];
  
  const prompt = `Extract 1-3 key facts from this conversation. Return as JSON array of strings.
If no important facts, return empty array [].

Conversation:
User: ${message}
AI: ${response}

Facts should be about: user preferences, goals, personal info, financial situation, career, business.
Example: ["user adalah investor saham IDX", "user sedang merencanakan beli rumah"]`;

  try {
    const response = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4.7',
        messages: [
          { role: 'system', content: 'You extract key facts from conversations. Return only JSON array.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 512,
        temperature: 0.3,
      })
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Parse JSON array from response
    try {
      const facts = JSON.parse(content);
      return Array.isArray(facts) ? facts : [];
    } catch {
      // Fallback: extract facts from text
      const matches = content.match(/"([^"]+)"/g);
      return matches ? matches.map(m => m.replace(/"/g, '')) : [];
    }
  } catch (err) {
    console.error('[Memory] Extract error:', err.message);
    return [];
  }
}

export async function saveMemory(userId, message, response) {
  const memoryType = shouldSaveMemory(message);
  if (!memoryType) return null;
  
  const facts = await extractFacts(message, response);
  if (facts.length === 0) return null;
  
  const embeddings = await Promise.all(
    facts.map(fact => generateEmbedding(fact))
  );
  
  const now = new Date();
  const expiresAt = memoryType === 'episodic' 
    ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
    : null;
  
  const memories = [];
  
  for (let i = 0; i < facts.length; i++) {
    const fact = facts[i];
    const embedding = embeddings[i];
    const importance = memoryType === 'semantic' ? 8 : 5;
    
    // Save to pgvector table (for semantic search)
    const { data, error } = await supabase
      .from('memory_vectors')
      .insert({
        user_id: userId,
        content: fact,
        embedding: embedding,
        memory_type: memoryType,
        importance: importance,
        context: { original_message: message.slice(0, 200) },
        expires_at: expiresAt,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Memory] Save error (memory_vectors):', error);
    } else {
      memories.push(data);
    }
    
    // Also save to existing memories table (for structured storage)
    const typeMap = {
      semantic: 'insight',
      episodic: 'event',
    };
    
    await supabase.from('memories').insert({
      user_id: userId,
      type: typeMap[memoryType] || 'insight',
      title: fact.slice(0, 100),
      content: fact,
      importance: importance,
      tags: [memoryType],
      metadata: { source: 'ai_extraction', original_message: message.slice(0, 200) },
    }).catch(err => {
      // Table might not exist, ignore
    });
  }
  
  return memories;
}

export async function loadMemories(userId, currentMessage, limit = 5) {
  const embedding = await generateEmbedding(currentMessage);
  let vectorMemories = [];
  
  if (embedding) {
    // Try vector similarity search first
    const { data } = await supabase
      .rpc('match_memories', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: limit,
        user_id: userId,
      }).catch(() => ({ data: null }));
    
    vectorMemories = data || [];
  }
  
  // If no vector memories, fallback to recent important memories
  if (vectorMemories.length === 0) {
    const { data } = await supabase
      .from('memory_vectors')
      .select('content, memory_type, importance, created_at')
      .eq('user_id', userId)
      .neq('memory_type', 'working')
      .order('importance', { ascending: false })
      .limit(limit);
    
    vectorMemories = data || [];
  }
  
  // Also load from existing memories table
  const { data: structuredMemories } = await supabase
    .from('memories')
    .select('content, type, importance, created_at')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .limit(limit)
    .catch(() => ({ data: [] }));
  
  // Merge and deduplicate
  const allMemories = [...vectorMemories];
  const existingContents = new Set(vectorMemories.map(m => m.content));
  
  if (structuredMemories && structuredMemories.length > 0) {
    for (const m of structuredMemories) {
      if (!existingContents.has(m.content)) {
        allMemories.push({
          content: m.content,
          memory_type: m.type,
          importance: m.importance,
          created_at: m.created_at,
        });
      }
    }
  }
  
  return allMemories.slice(0, limit);
}

export async function clearUserMemories(userId) {
  await supabase
    .from('memory_vectors')
    .delete()
    .eq('user_id', userId);
}

export async function cleanupExpiredMemories() {
  const { error } = await supabase
    .from('memory_vectors')
    .delete()
    .lt('expires_at', new Date().toISOString());
  
  if (error) {
    console.error('[Memory] Cleanup error:', error);
  }
}