/**
 * Advisori × MiroFish-lite
 * Swarm intelligence for investment decisions
 */

import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { supabase } from '../config.js'

const claude   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── MiroFish Tier Config ─────────────────────────────────
export const MIROFISH_TIERS = {
  free: { analysts: 0, enabled: false },
  pro: { analysts: 3, enabled: true },
  expert: { analysts: 5, enabled: true },
  custom: { analysts: 7, enabled: true, webSearch: true },
};

// ─── Trigger patterns ────────────────────────────────────
const TRIGGER_PATTERNS = [
  'should i', 'should we', 'haruskah', 'sebaiknya',
  'buy or not', 'beli atau tidak', 'jual atau tidak',
  'rekomendasi', 'recomend', 'suggest',
  'worth it', 'gak sih', ' worth it',
  'bagus gak', 'apakah', 'aye recommended',
  'analisis lengkap', 'deep dive',
  'sekarang', 'harga', 'vs ',
];

export function shouldTriggerMiroFish(message, tier) {
  const config = MIROFISH_TIERS[tier] || MIROFISH_TIERS.free;
  if (!config.enabled) return false;
  
  const lower = message.toLowerCase();
  return TRIGGER_PATTERNS.some(pattern => lower.includes(pattern));
}

export function getMiroFishAnalysts(tier) {
  const config = MIROFISH_TIERS[tier] || MIROFISH_TIERS.free;
  return config.analysts;
}

// ─── Persona definitions ──────────────────────────────────
const PERSONA_TEMPLATES = [
  {
    id: 'value',
    name: 'Viktor (Value)',
    system: `Kamu adalah Viktor, analis value investing bergaya Buffett/Munger.
Fokus: margin of safety, moat, ROE konsisten, cash flow, manajemen kualitas.
Skeptis terhadap hype dan valuasi stretched.
Jawab 3-4 kalimat. Akhiri: VERDICT: [BUY/HOLD/AVOID] - [confidence]%`,
  },
  {
    id: 'technical',
    name: 'Tara (Teknikal)',
    system: `Kamu adalah Tara, analis teknikal berpengalaman.
Fokus: trend, support/resistance, MA, RSI, MACD, volume, pola candlestick.
Jawab 3-4 kalimat. Akhiri: VERDICT: [BUY/HOLD/AVOID] - [confidence]%`,
  },
  {
    id: 'macro',
    name: 'Marco (Makro)',
    system: `Kamu adalah Marco, ekonom makro fokus Indonesia.
Fokus: BI Rate, kurs USD/IDR, inflasi, komoditas, kebijakan fiskal.
Jawab 3-4 kalimat. Akhiri: VERDICT: [BUY/HOLD/AVOID] - [confidence]%`,
  },
  {
    id: 'bear',
    name: 'Bruno (Bear)',
    system: `Kamu adalah Bruno, selalu mencari risiko dan worst-case.
Fokus: hutang tersembunyi, regulasi, kompetitor, red flags.
Selalu skeptis. Jawab 3-4 kalimat. Akhiri: VERDICT: [BUY/HOLD/AVOID] - [confidence]%`,
  },
  {
    id: 'sentiment',
    name: 'Sari (Sentimen)',
    system: `Kamu adalah Sari, tracker sentimen retail & institusional.
Fokus: foreign flow, media coverage, social sentiment, insider.
Jawab 3-4 kalimat. Akhiri: VERDICT: [BUY/HOLD/AVOID] - [confidence]%`,
  },
  {
    id: 'growth',
    name: 'Gita (Growth)',
    system: `Kamu adalah Gita, specialist growth investing.
Fokus: revenue growth, TAM, competitive advantage, skalabilitas.
Jawab 3-4 kalimat. Akhiri: VERDICT: [BUY/HOLD/AVOID] - [confidence]%`,
  },
  {
    id: 'dividend',
    name: 'Dini (Dividend)',
    system: `Kamu adalah Dini, specialist dividend investing.
Fokus: dividend yield, payout ratio, dividend growth history, cash flow.
Jawab 3-4 kalimat. Akhiri: VERDICT: [BUY/HOLD/AVOID] - [confidence]%`,
  },
]

function getPersonas(count) {
  return PERSONA_TEMPLATES.slice(0, Math.min(count, PERSONA_TEMPLATES.length));
}

// ─── Parse verdict dari response ─────────────────────────
function parseVerdict(text) {
  const match = text.match(/VERDICT:\s*(BUY|HOLD|AVOID)\s*-?\s*(\d+)%/i)
  if (!match) return { signal: 'HOLD', confidence: 50 }
  return {
    signal:     match[1].toUpperCase(),
    confidence: parseInt(match[2]),
  }
}

// ─── Aggregate verdicts → consensus ──────────────────────
function aggregateVerdicts(analyses) {
  const scores = { BUY: 0, HOLD: 0, AVOID: 0 }
  let totalConfidence = 0
  let count = 0

  for (const a of analyses) {
    const { signal, confidence } = a.verdict
    scores[signal] += confidence
    totalConfidence += confidence
    count++
  }

  // Weighted voting
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]
  const avgConf = Math.round(totalConfidence / count)

  // Hitung consensus strength (seberapa setuju para persona)
  const buyPct  = analyses.filter(a => a.verdict.signal === 'BUY').length / count
  const avoidPct = analyses.filter(a => a.verdict.signal === 'AVOID').length / count
  const agreement = Math.max(buyPct, avoidPct, 1 - buyPct - avoidPct)

  return {
    signal:    winner,
    confidence: avgConf,
    agreement: Math.round(agreement * 100),
    breakdown: scores,
  }
}

// ─── Main swarm prediction function ──────────────────────
export async function swarmPredict({ query, userId, personaCount = 5, tier = 'pro' }) {
  const analysts = getMiroFishAnalysts(tier);
  const actualCount = Math.min(personaCount, analysts);
  
  if (actualCount === 0) {
    throw new Error('MiroFish not available for your tier');
  }

  // Check cache
  const queryHash = createHash('md5').update(query + userId).digest('hex')
  const { data: cached } = await supabase
    .from('swarm_predictions')
    .select('*')
    .eq('query_hash', queryHash)
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (cached) {
    return {
      ...cached,
      fromCache: true,
    }
  }

  // Pilih personas based on tier
  const selectedPersonas = getPersonas(actualCount)

  // Run semua personas secara paralel
  console.log(`[MiroFish] Running ${selectedPersonas.length} personas for: "${query}"`)

  const analyses = await Promise.allSettled(
    selectedPersonas.map(async persona => {
      const res = await claude.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system:     persona.system,
        messages:   [{ role: 'user', content: query }],
      })
      const text = res.content[0]?.text || ''
      return {
        persona:  persona.name,
        personaId: persona.id,
        analysis: text,
        verdict:  parseVerdict(text),
      }
    })
  )

  // Filter yang sukses
  const successful = analyses
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)

  if (successful.length === 0) {
    throw new Error('Semua persona gagal. Coba lagi.')
  }

  // Aggregate
  const consensus = aggregateVerdicts(successful)

  // Generate synthesis dari consensus
  const synthesisPrompt = `
Berikut analisis ${successful.length} persona ahli untuk: "${query}"

${successful.map(a => `**${a.persona}:** ${a.analysis}`).join('\n\n')}

Buat synthesis singkat (4-5 kalimat) yang:
1. Merangkum poin terpenting dari semua perspektif
2. Highlight risiko utama yang perlu diperhatikan
3. Berikan kesimpulan actionable berdasarkan consensus: ${consensus.signal} (${consensus.confidence}% confidence)

Bahasa Indonesia. Jelas dan praktis.
  `.trim()

  const synthesisRes = await claude.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages:   [{ role: 'user', content: synthesisPrompt }],
  })

  const synthesis = synthesisRes.content[0]?.text || ''

  // Format output lengkap
  const result = {
    query,
    personas:   successful,
    consensus,
    synthesis,
    persona_count: successful.length,
    created_at: new Date().toISOString(),
  }

  // Cache ke Supabase
  await supabase.from('swarm_predictions').insert({
    user_id:      userId,
    query,
    query_hash:   queryHash,
    persona_count: successful.length,
    predictions:  successful,
    consensus:    JSON.stringify(consensus),
    confidence:   consensus.confidence / 100,
    expires_at:   new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  })

  return { ...result, fromCache: false }
}

// ─── Format output untuk display ─────────────────────────
export function formatSwarmResult(result) {
  const { query, personas, consensus, synthesis, fromCache } = result
  const emoji = { BUY: '🟢', HOLD: '🟡', AVOID: '🔴' }

  const personaLines = personas.map(p =>
    `• *${p.persona}*: ${p.verdict.signal} (${p.verdict.confidence}%)` 
  ).join('\n')

  return `🐠 *Swarm Analysis* ${fromCache ? '_(cached)_' : ''}
━━━━━━━━━━━━━━━━━━━━
Query: _${query}_

*Perspektif ${personas.length} Analis:*
${personaLines}

*Consensus: ${emoji[consensus.signal]} ${consensus.signal}*
Confidence: ${consensus.confidence}% | Agreement: ${consensus.agreement}%

*Synthesis:*
${synthesis}

⚠️ _Bukan rekomendasi investasi. Keputusan ada di tangan investor._`
}
