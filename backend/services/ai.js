import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../server.js';
import { SkillRouter } from '../skills/router.js';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODELS = {
  simple:  'claude-haiku-4-5-20251001',
  complex: 'claude-sonnet-4-20250514',
};

function pickModel(message) {
  const m = message.toLowerCase();
  const simplePatterns = ['halo','hai','hi','apa kabar','terima kasih','ok','oke','makasih','thanks','siap','bisa'];
  return (simplePatterns.some(p => m.includes(p)) && m.length < 60) ? MODELS.simple : MODELS.complex;
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

// Web search tool — built-in Anthropic, tidak perlu API tambahan
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
};

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
  const model = pickModel(message);
  const useSearch = needsBrowsing(message);

  await saveMessage(userId, activeSkill.id, 'user', message);

  const finalSystem = useSearch
    ? systemPrompt + '\n\nKamu bisa browsing internet real-time via web_search tool. Gunakan untuk data terkini: harga saham, kurs, berita, regulasi terbaru. Sebutkan sumber setelah mendapat hasil.'
    : systemPrompt;

  const requestBody = {
    model,
    max_tokens: 2048,
    system: finalSystem,
    messages: [...history, { role: 'user', content: message }],
    ...(useSearch && { tools: [WEB_SEARCH_TOOL] }),
  };

  if (stream) {
    const streamResp = await claude.messages.stream(requestBody);
    return { stream: streamResp, activeSkill, usedSearch: useSearch };
  }

  const response = await claude.messages.create(requestBody);
  const content = response.content.filter(b => b.type === 'text').map(b => b.text).join('');

  await saveMessage(userId, activeSkill.id, 'assistant', content);
  return { content, activeSkill, model, usedSearch: useSearch, usage: response.usage };
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