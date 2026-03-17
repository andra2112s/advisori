import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { Chip, ThemeToggle } from '../components/ui'

const PERSONALITIES = ['Hangat','Direct','Analitis','Humoris','Tenang','Energik','Filosofis','Pragmatis','Empatis','Kritis']
const STYLES = [
  { label: 'Santai & akrab', value: 'Santai dan natural, seperti teman lama' },
  { label: 'Profesional hangat', value: 'Profesional tapi hangat, tidak kaku' },
  { label: 'Formal terstruktur', value: 'Formal dan terstruktur, seperti konsultan senior' },
  { label: 'Indo-English mix', value: 'Campuran Bahasa Indonesia dan Inggris, fluid' },
  { label: 'Singkat & padat', value: 'Singkat dan to the point, tidak bertele-tele' },
]
const VALUES    = ['Kejujuran','Keberanian','Kepraktisan','Empati','Pertumbuhan','Kejelasan','Kreativitas','Disiplin','Kebebasan','Keseimbangan']
const AVATARS   = ['✦','◈','⬡','◉','▲','◇','🌙','⚡','🔥','🌊','🌿','💎']
const TOTAL     = 5

export default function SoulSetup() {
  const { refreshSoul } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]     = useState(1)
  const [saving, setSaving] = useState(false)
  const [soul, setSoul]     = useState({
    name: '', personality: [], personalityCustom: '',
    speakingStyle: '', backstory: '', values: [], avatar: '✦',
  })

  const update = k => v => setSoul(s => ({ ...s, [k]: v }))

  const toggleArr = (arr, val) =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

  const personalityStr = [
    ...soul.personality,
    ...(soul.personalityCustom ? [soul.personalityCustom] : [])
  ].join(', ')

  const canNext = {
    1: soul.name.trim().length > 0,
    2: personalityStr.length > 0,
    3: soul.speakingStyle.length > 0,
    4: soul.values.length > 0,
    5: true,
  }

  const save = async () => {
    setSaving(true)
    try {
      console.log('Saving soul data:', soul)
      const response = await api.setupSoul({
        name: soul.name,
        personality: personalityStr,
        speakingStyle: soul.speakingStyle,
        backstory: soul.backstory || null,
        values: soul.values,
        avatar: soul.avatar,
        language: 'id',
      })
      console.log('Save response:', response)
      
      // Wait a bit for the database to update
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Refresh soul data
      const refreshedSoul = await refreshSoul()
      console.log('Refreshed soul:', refreshedSoul)
      
      // Check if soul is properly set up
      if (refreshedSoul?.is_setup) {
        navigate('/chat')
      } else {
        console.error('Soul not marked as setup:', refreshedSoul)
        alert('Terjadi kesalahan. Silakan coba lagi.')
      }
    } catch (err) {
      console.error('Save error:', err)
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const pct = Math.round((step / TOTAL) * 100)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>

      {/* Progress */}
      <div style={{ height: 2, background: 'var(--bg-3)' }}>
        <div style={{ height: '100%', background: 'var(--gold)', width: pct + '%', transition: 'width .5s ease' }} />
      </div>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Advisori</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Langkah {step} dari {TOTAL}</span>
          <ThemeToggle />
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Step 1 — Nama */}
        {step === 1 && (
          <div className="fade-up">
            <div style={eyebrow}>Mulai dari sini</div>
            <h1 style={title}>Siapa nama<br /><em>AI Personal kamu?</em></h1>
            <p style={desc}>Bebas — nama orang, karakter, konsep, apapun yang terasa tepat.</p>
            <input
              autoFocus value={soul.name}
              onChange={e => update('name')(e.target.value)}
              placeholder="Aria, Zara, Rex, Nova..."
              style={{ ...inputFull, marginBottom: 8 }}
              maxLength={50}
            />
            <p style={{ fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic' }}>Tidak ada aturan. Ini sepenuhnya milikmu.</p>
          </div>
        )}

        {/* Step 2 — Kepribadian */}
        {step === 2 && (
          <div className="fade-up">
            <div style={eyebrow}>Membentuk karakter</div>
            <h1 style={title}><em>Bagaimana</em><br />kepribadiannya?</h1>
            <p style={desc}>Pilih beberapa sifat, atau tulis sendiri.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {PERSONALITIES.map(p => (
                <Chip key={p} selected={soul.personality.includes(p)}
                  onClick={() => update('personality')(toggleArr(soul.personality, p))}>
                  {p}
                </Chip>
              ))}
            </div>
            <input value={soul.personalityCustom}
              onChange={e => update('personalityCustom')(e.target.value)}
              placeholder="Atau tulis sendiri: sarkastis tapi penuh perhatian..."
              style={inputFull} maxLength={300} />
          </div>
        )}

        {/* Step 3 — Gaya bicara */}
        {step === 3 && (
          <div className="fade-up">
            <div style={eyebrow}>Menemukan suara</div>
            <h1 style={title}>Bagaimana <em>cara<br />dia bicara</em> denganmu?</h1>
            <p style={desc}>Pilih yang terasa paling nyaman.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {STYLES.map(s => (
                <Chip key={s.value} selected={soul.speakingStyle === s.value}
                  onClick={() => update('speakingStyle')(s.value)}>
                  {s.label}
                </Chip>
              ))}
            </div>
            <input value={soul.speakingStyle}
              onChange={e => update('speakingStyle')(e.target.value)}
              placeholder="Atau deskripsikan sendiri..."
              style={inputFull} maxLength={200} />
          </div>
        )}

        {/* Step 4 — Nilai & Avatar */}
        {step === 4 && (
          <div className="fade-up">
            <div style={eyebrow}>Inti dari segalanya</div>
            <h1 style={title}>Nilai apa yang <em>dia<br />pegang teguh?</em></h1>
            <p style={desc}>Pilih 3–5 nilai yang paling penting.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {VALUES.map(v => (
                <Chip key={v} selected={soul.values.includes(v)}
                  onClick={() => soul.values.length < 5 || soul.values.includes(v)
                    ? update('values')(toggleArr(soul.values, v)) : null}>
                  {v}
                </Chip>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 16, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 500 }}>Avatar</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              {AVATARS.map(a => (
                <button key={a} onClick={() => update('avatar')(a)} style={{
                  aspectRatio: '1', fontSize: 22,
                  background: soul.avatar === a ? 'var(--gold-dim)' : 'var(--bg-2)',
                  border: `1px solid ${soul.avatar === a ? 'var(--gold)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'var(--trans)',
                }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5 — Backstory */}
        {step === 5 && (
          <div className="fade-up">
            <div style={eyebrow}>Sentuhan terakhir</div>
            <h1 style={title}>Dari mana <em>dia<br />berasal?</em></h1>
            <p style={desc}>Opsional — tapi yang melakukannya selalu tidak menyesal.</p>

            {/* Preview */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>
                  {soul.avatar}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{soul.name || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{soul.values.slice(0,3).join(' · ') || 'AI Personal kamu'}</div>
                </div>
              </div>
              <div style={{
                background: 'var(--bg)', borderRadius: 'var(--radius)',
                padding: '10px 14px', fontSize: 13, color: 'var(--ink-2)',
                fontStyle: 'italic', borderLeft: '2px solid var(--gold-dim)', fontWeight: 300,
              }}>
                {soul.backstory?.slice(0, 120) || `Halo! Saya ${soul.name}. Saya siap menemanimu.`}
              </div>
            </div>

            <textarea value={soul.backstory} onChange={e => update('backstory')(e.target.value)}
              rows={4} placeholder="Lahir dari keingintahuan yang tidak pernah puas..."
              style={{ ...inputFull, resize: 'vertical', minHeight: 100 }}
              maxLength={800} />
            <p style={{ fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic', marginBottom: 8 }}>
              Bebas sepenuhnya. Tidak ada template.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 32 }}>
          <button
            disabled={!canNext[step] || saving}
            onClick={() => step < TOTAL ? setStep(s => s + 1) : save()}
            style={{
              padding: '13px 28px', fontSize: 14, fontWeight: 500,
              background: 'var(--ink)', color: 'var(--bg)', border: 'none',
              borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'var(--font-body)',
              opacity: (!canNext[step] || saving) ? 0.4 : 1, transition: 'var(--trans)',
            }}
          >
            {saving ? 'Menciptakan...' : step < TOTAL ? 'Lanjutkan →' : 'Ciptakan AI Personal →'}
          </button>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              background: 'none', border: 'none', color: 'var(--ink-3)',
              cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)',
            }}>
              ← Kembali
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const eyebrow = {
  fontSize: 11, fontWeight: 500, letterSpacing: '.12em',
  textTransform: 'uppercase', color: 'var(--gold-text)',
  marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
}
const title = {
  fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,5vw,46px)',
  fontWeight: 400, lineHeight: 1.1, letterSpacing: -.4,
  marginBottom: 12, color: 'var(--ink)',
}
const desc = {
  fontSize: 15, color: 'var(--ink-3)', fontWeight: 300,
  lineHeight: 1.7, marginBottom: 28,
}
const inputFull = {
  width: '100%', background: 'var(--bg-2)',
  border: '1px solid var(--border-md)', borderRadius: 'var(--radius)',
  padding: '12px 14px', fontFamily: 'var(--font-body)',
  fontSize: 14, fontWeight: 300, color: 'var(--ink)', outline: 'none',
}
