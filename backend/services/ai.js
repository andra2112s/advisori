import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../config.js';
import { SkillRouter } from '../skills/router.js';
import { saveMemory, loadMemories } from './memoryExtractor.js';
import { getStockPrice, formatStockData } from '../skills/advisori-saham/tools.js';

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

// Detect stock tickers in message
function extractStockTickers(message) {
  // Common Indonesian stock tickers (4 letter uppercase)
  const commonTickers = ['BBCA', 'BBRI', 'TLKM', 'BMRI', 'BBNI', 'UNVR', 'HMSN', 'BREN', 'GOTO', 'AMMN', 'TPIA', 'ICBP', 'INDF', 'KLBF', 'MENT', 'ASII', 'UNTR', 'PTBA', 'ANTM', 'ITMG', 'PGAS', 'PTUN', 'MEDC', 'ADRO', 'INDY', 'HRUM', 'MITI', 'TOWR', 'EXCL', 'FREN', 'ISAT', 'MATA'];
  
  const upperMsg = message.toUpperCase();
  const found = [];
  
  // Check for common tickers
  for (const ticker of commonTickers) {
    if (upperMsg.includes(ticker)) {
      found.push(ticker);
    }
  }
  
  // Also detect .JK pattern
  const jkMatches = message.match(/([A-Z]{4})\.JK/gi);
  if (jkMatches) {
    for (const match of jkMatches) {
      const ticker = match.replace('.JK', '').toUpperCase();
      if (!found.includes(ticker)) {
        found.push(ticker);
      }
    }
  }
  
  return found;
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
    content: data.choices[0]?.message?.content || 'Maaf, saya butuh waktu lebih lama. Coba lagi.',
    usage: {
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0
    }
  };
}

async function loadUserContext(userId) {
  const { data: user, error: userError } = await supabase
    .from('users').select('*, souls(*)').eq('id', userId).single();
  
  if (userError) {
    app.log.error('Error loading user:', userError);
  }
  
  const soul = user?.souls ? (Array.isArray(user.souls) ? user.souls[0] : user.souls) : null;
  
  const { data: activeSubs } = await supabase
    .from('subscriptions').select('skill_id')
    .eq('user_id', userId).eq('status', 'active');
  return {
    user,
    soul: soul,
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

  // Load memories for Pro+ tiers only
  let memories = [];
  if (['pro', 'expert', 'custom', 'premium'].includes(ctx.tier)) {
    try {
      memories = await loadMemories(userId, message, 5);
    } catch (err) {
      console.log('[Memory] Load failed:', err.message);
    }
  }

  const { systemPrompt, activeSkill } = SkillRouter.build(
    message, ctx.soul, ctx.activeSkills,
    advisorId === 'auto' ? null : advisorId
  );

  // Inject memories into system prompt
  const memoryContext = memories.length > 0
    ? '\n\n--- MEMORY (from previous conversations) ---\n' +
      memories.map(m => `• ${m.content}`).join('\n') +
      '\n--- END MEMORY ---'
    : '';

  const history = await loadHistory(userId, activeSkill.id);
  const useSearch = needsBrowsing(message);
  
  // Check for stock tickers and fetch real-time data
  let stockDataContext = '';
  const tickers = extractStockTickers(message);
  if (tickers.length > 0 && activeSkill.id === 'advisori-saham') {
    try {
      const stockResults = await Promise.all(
        tickers.slice(0, 3).map(ticker => getStockPrice(ticker))
      );
      stockDataContext = '\n\n--- REAL-TIME STOCK DATA ---\n' +
        stockResults.map((data, i) => formatStockData(data)).join('\n\n') +
        '\n--- END STOCK DATA ---';
    } catch (err) {
      console.log('[Stock] Failed to fetch:', err.message);
    }
  }

  // Determine AI provider (default to Claude, can be overridden by user preference)
  const aiProvider = ctx.soul?.ai_provider || 'zai';

  await saveMessage(userId, activeSkill.id, 'user', message);

  let result;
  let responseContent = '';

  if (aiProvider === 'zai') {
    try {
      result = await chatWithZAI(message, ctx, systemPrompt + memoryContext + stockDataContext, history, useSearch);
      responseContent = result.content;
    } catch (zaiError) {
      console.log('Z.ai failed, falling back to Claude:', zaiError.message);
      result = await chatWithClaude(message, ctx, systemPrompt + memoryContext + stockDataContext, history, useSearch);
      responseContent = result.content;
    }
  } else {
    result = await chatWithClaude(message, ctx, systemPrompt + memoryContext + stockDataContext, history, useSearch);
    responseContent = result.content;
  }

  // Save memories asynchronously (Pro+ only)
  if (['pro', 'expert', 'custom', 'premium'].includes(ctx.tier) && responseContent) {
    setImmediate(() => {
      saveMemory(userId, message, responseContent).catch(err => {
        console.log('[Memory] Save failed:', err.message);
      });
    });
  }

  return {
    content: responseContent,
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
      content: response.content[0]?.text || 'Maaf, saya butuh waktu lebih lama. Coba lagi.',
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
