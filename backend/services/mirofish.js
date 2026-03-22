/**
 * Advisori × MiroFish-lite
 * ─────────────────────────────────────────────────────────
 * Implementasi ringan konsep MiroFish (swarm intelligence)
 * tanpa butuh Python backend atau Zep Cloud.
 *
 * Cara kerja:
 * 1. Spawn N "personas" analis dengan sudut pandang berbeda
 * 2. Setiap persona analisis query yang sama secara paralel
 * 3. Aggregator synthesize semua hasil → consensus
 * 4. Cache hasil di Supabase (expire 6 jam)
 *
 * Personas untuk saham IDX:
 * - Value Investor (Buffett style)
 * - Technical Analyst (chart-based)
 * - Macro Economist (top-down)
 * - Bearish Devil's Advocate (selalu skeptis)
 * - Retail Sentiment Tracker (FOMO/fear)
 */

import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { supabase } from '../config.js'
import dotenv from 'dotenv'
dotenv.config()

const claude   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Persona definitions ──────────────────────────────────
const PERSONAS = [
  {
    id: 'value',
    name: 'Viktor (Value Investor)',
    system: `Kamu adalah Viktor, analis value investing bergaya Buffett/Munger.
Fokus: margin of safety, moat, ROE konsisten, cash flow, manajemen kualitas.
Skeptis terhadap hype dan valuasi stretched. Horizon: 3-5 tahun.
Jawab singkat dan konkrit dalam 3-4 kalimat. Akhiri dengan: VERDICT: [BUY/HOLD/AVOID] - [confidence 0-100]%`,
  },
  {
    id: 'technical',
    name: 'Tara (Technical Analyst)',
    system: `Kamu adalah Tara, analis teknikal berpengalaman.
Fokus: trend, support/resistance, MA, RSI, MACD, volume, pola candlestick.
Ignore fundamental, fokus price action dan momentum.
Jawab singkat dalam 3-4 kalimat. Akhiri dengan: VERDICT: [BUY/HOLD/AVOID] - [confidence 0-100]%`,
  },
  {
    id: 'macro',
    name: 'Marco (Macro Economist)',
    system: `Kamu adalah Marco, ekonom makro dengan fokus Indonesia.
Fokus: BI Rate, kurs USD/IDR, inflasi, komoditas, kebijakan fiskal, arus modal asing.
Analisis top-down: global → Indonesia → sektor → emiten.
Jawab singkat dalam 3-4 kalimat. Akhiri dengan: VERDICT: [BUY/HOLD/AVOID] - [confidence 0-100]%`,
  },
  {
    id: 'bear',
    name: 'Bruno (Devil\'s Advocate)',
    system: `Kamu adalah Bruno, selalu mencari risiko dan worst-case scenario.
Fokus: hutang tersembunyi, risiko regulasi, kompetitor, management red flags, valuation risk.
Selalu skeptis dan pesimis — tugasmu mencari lubang dalam thesis bullish.
Jawab singkat dalam 3-4 kalimat. Akhiri dengan: VERDICT: [BUY/HOLD/AVOID] - [confidence 0-100]%`,
  },
  {
    id: 'sentiment',
    name: 'Sari (Sentiment Tracker)',
    system: `Kamu adalah Sari, tracker sentimen retail dan institusional.
Fokus: foreign flow, RRDI (retail), media coverage, social sentiment, insider transactions.
Analisis apakah "smart money" sedang akumulasi atau distribusi.
Jawab singkat dalam 3-4 kalimat. Akhiri dengan: VERDICT: [BUY/HOLD/AVOID] - [confidence 0-100]%`,
  },
]

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
export async function swarmPredict({ query, userId, personaCount = 5 }) {

  // Check cache
  const queryHash = createHash('md5').update(query + userId).toISOString()
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

  // Pilih personas (batasi jumlah)
  const selectedPersonas = PERSONAS.slice(0, Math.min(personaCount, PERSONAS.length))

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
