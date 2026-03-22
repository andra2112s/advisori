import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../config.js';
import { SkillRouter } from '../skills/router.js';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODELS = {
  claude: {
    simple: 'claude-haiku-4-5-20251001',
    complex: 'claude-sonnet-4-20250514',
  },
  zai: {
    simple: 'glm-4.7',
    complex: 'glm-4.7',
  }
};

const PROVIDERS = {
  claude: 'anthropic',
  zai: 'z-ai'
};

function pickModel(message, provider = 'claude') {
  const m = message.toLowerCase();
  const simplePatterns = ['halo','hai','hi','apa kabar','terima kasih','ok','oke','makasih','thanks','siap','bisa'];
  const isSimple = simplePatterns.some(p => m.includes(p)) && m.length < 60;
  return isSimple ? MODELS[provider].simple : MODELS[provider].complex;
}

// Deteksi apakah pesan butuh real-time browsing
function needsBrowsing(message) {
  const m = message.toLowerCase();
  const browseKeywords = [
    'harga','sekarang','hari ini','terbaru','terkini','update','berita','news',
    'trending','live','real-time','ihsg','saham','bursa','idx','.jk','closing',
    'opening','peraturan terbaru','pmk','aturan baru','tarif terbaru',
    'cek','cari','search','browsing','buka','lihat website',
    'berapa harga','kurs','dolar','bitcoin','crypto',
  ];
  return browseKeywords.some(k => m.includes(k));
}

// Z.ai API integration
async function chatWithZAI(message, context, systemPrompt, history, useSearch = false) {
  const zaiApiKey = process.env.ZAI_API_KEY;
  if (!zaiApiKey) {
    throw new Error('ZAI_API_KEY not configured');
  }

  // Prepare messages for Z.ai format
  const messages = [];

  // Add system prompt
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt
    });
  }

  // Add conversation history
  if (history && history.length > 0) {
    history.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });
  }

  // Add current message
  messages.push({
    role: 'user',
    content: message
  });

  // Prepare request body
  const requestBody = {
    model: pickModel(message, 'zai'),
    messages,
    max_tokens: 2048,
    temperature: 0.7,
  };

  // Add search capability if needed (Z.ai might have different API for this)
  if (useSearch) {
    // Note: Z.ai might have different search implementation
    requestBody.tools = [{
      type: 'web_search',
      name: 'web_search'
    }];
  }

  const response = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${zaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Z.ai API error: ${error.error || response.statusText}`);
  }

  const data = await response.json();

  return {
    content: data.choices[0]?.message?.content || 'No response from Z.ai',
    usage: {
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0
    }
  };
}

async function loadUserContext(userId) {
  const { data: user } = await supabase
    .from('users').select('*, souls(*)').eq('id', userId).single();
  const { data: activeSubs } = await supabase
    .from('subscriptions').select('skill_id')
    .eq('user_id', userId).eq('status', 'active');
  return {
    user,
    soul: user?.souls?.[0] || null,
    activeSkills: ['advisori-pajak','advisori-saham', ...(activeSubs?.map(s => s.skill_id) || [])],
    tier: user?.tier || 'free',
  };
}

async function loadHistory(userId, advisorId, limit = 10) {
  const { data } = await supabase
    .from('messages').select('role, content')
    .eq('user_id', userId).eq('advisor_id', advisorId)
    .order('created_at', { ascending: false }).limit(limit);
  return (data || []).reverse();
}

async function saveMessage(userId, advisorId, role, content) {
  await supabase.from('messages').insert({
    user_id: userId, advisor_id: advisorId,
    role, content, created_at: new Date().toISOString(),
  });
}

const DAILY_LIMITS = { free: 20, pro: 200, premium: 9999 };

async function checkRateLimit(userId, tier) {
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('messages').select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('role', 'user')
    .gte('created_at', `${today}T00:00:00`);
  const limit = DAILY_LIMITS[tier] || 20;
  if (count >= limit) throw new Error(`RATE_LIMIT:${limit}:${tier}`);
  return { used: count, limit };
}

export async function chat({ userId, message, advisorId = 'auto', stream = false }) {
  const ctx = await loadUserContext(userId);
  await checkRateLimit(userId, ctx.tier);

  const { systemPrompt, activeSkill } = SkillRouter.build(
    message, ctx.soul, ctx.activeSkills,
    advisorId === 'auto' ? null : advisorId
  );

  const history = await loadHistory(userId, activeSkill.id);
  const useSearch = needsBrowsing(message);

  // Determine AI provider (default to Claude, can be overridden by user preference)
  const aiProvider = ctx.soul?.ai_provider || 'zai';

  await saveMessage(userId, activeSkill.id, 'user', message);

  let result;
  if (aiProvider === 'zai') {
    try {
      // Try Z.ai first
      result = await chatWithZAI(message, ctx, systemPrompt, history, useSearch);
    } catch (zaiError) {
      console.log('Z.ai failed, falling back to Claude:', zaiError.message);
      // Fallback to Claude
      result = await chatWithClaude(message, ctx, systemPrompt, history, useSearch);
    }
  } else {
    // Use Claude
    result = await chatWithClaude(message, ctx, systemPrompt, history, useSearch);
  }

  return {
    content: result.content,
    activeSkill,
    usage: result.usage
  };
}

// Web search tool — built-in Anthropic, tidak perlu API tambahan
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
};

async function chatWithClaude(message, context, systemPrompt, history, useSearch, stream = false) {
  const model = pickModel(message, 'claude');
  const finalSystem = useSearch
    ? systemPrompt + '\n\nKamu bisa browsing internet real-time via web_search tool. Gunakan untuk data terkini: harga saham, kurs, berita, regulasi terbaru. Sebutkan sumber setelah mendapat hasil.'
    : systemPrompt;

  if (stream) {
    const streamResult = await claude.messages.create({
      model,
      max_tokens: 2048,
      system: finalSystem,
      messages: history.map(h => ({ role: h.role, content: h.content })).concat([
        { role: 'user', content: message }
      ]),
      tools: useSearch ? [WEB_SEARCH_TOOL] : undefined,
      stream: true,
    });

    return { stream: streamResult };
  } else {
    const response = await claude.messages.create({
      model,
      max_tokens: 2048,
      system: finalSystem,
      messages: history.map(h => ({ role: h.role, content: h.content })).concat([
        { role: 'user', content: message }
      ]),
      tools: useSearch ? [WEB_SEARCH_TOOL] : undefined,
    });

    return {
      content: response.content[0]?.text || 'No response from Claude',
      usage: {
        input_tokens: response.usage?.input_tokens || 0,
        output_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }
}

export async function updateMemory(userId, newFacts) {
  const { data: soul } = await supabase
    .from('souls').select('memory').eq('user_id', userId).single();
  const memory = soul?.memory || { episodic: [], semantic: {}, preferences: {} };
  if (newFacts.episodic) memory.episodic = [...memory.episodic, ...newFacts.episodic].slice(-100);
  if (newFacts.semantic) Object.assign(memory.semantic, newFacts.semantic);
  if (newFacts.preferences) Object.assign(memory.preferences, newFacts.preferences);
  await supabase.from('souls')
    .update({ memory, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}
