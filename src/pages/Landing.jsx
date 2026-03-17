import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ThemeToggle } from '../components/ui'
import { useEffect } from 'react'

export default function Landing() {
  const { user, soul } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate(soul?.is_setup ? '/chat' : '/soul-setup')
  }, [user, soul])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 40px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
          Advisori<span style={{ color: 'var(--gold)' }}>.</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ThemeToggle />
          <button onClick={() => navigate('/login')} style={{
            fontSize: 13, padding: '8px 18px', border: '1px solid var(--border-md)',
            borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--ink-2)',
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            Masuk
          </button>
          <button onClick={() => navigate('/login')} style={{
            fontSize: 13, padding: '8px 18px', background: 'var(--ink)',
            color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)',
            cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500,
          }}>
            Mulai Gratis
          </button>
        </div>
      </nav>

      <div style={{
        maxWidth: 700, margin: '0 auto', padding: '100px 40px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 500, letterSpacing: '.12em',
          textTransform: 'uppercase', color: 'var(--gold-text)',
          marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <span style={{ width: 20, height: 1, background: 'var(--gold)', display: 'inline-block' }} />
          Super AI Assistant like Jarvis
          <span style={{ width: 20, height: 1, background: 'var(--gold)', display: 'inline-block' }} />
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(44px,7vw,72px)',
          fontWeight: 400, lineHeight: 1.08, letterSpacing: -1,
          marginBottom: 20, color: 'var(--ink)',
        }} className="fade-up">
          Konsultan pribadi<br />
          <em style={{ color: 'var(--ink-3)' }}>untuk setiap keputusan</em>
        </h1>

        <p style={{
          fontSize: 17, color: 'var(--ink-3)', fontWeight: 300,
          lineHeight: 1.7, maxWidth: 480, margin: '0 auto 40px',
        }} className="fade-up-2">
          AI Personal dengan kepribadian unik milikmu. Pajak, saham IDX, hukum bisnis.
          Web, Telegram, dan WhatsApp. Zero setup.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }} className="fade-up-3">
          <button onClick={() => navigate('/login')} style={{
            fontSize: 15, fontWeight: 500, padding: '14px 32px',
            background: 'var(--ink)', color: 'var(--bg)', border: 'none',
            borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            Buat AI Personal Gratis
          </button>
          <button onClick={() => navigate('/login')} style={{
            fontSize: 15, padding: '14px 24px', background: 'transparent',
            color: 'var(--ink-2)', border: '1px solid var(--border-str)',
            borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            Sudah punya akun
          </button>
        </div>

        <div style={{
          marginTop: 80, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          gap: 1, background: 'var(--border)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }} className="fade-up-3">
          {[
            ['◈', 'Kepribadian unik', 'Definisikan dari nol — nama, karakter, gaya bicara, nilai hidup'],
            ['🧾', 'Advisor Shop', 'Pajak IDX, saham, hukum bisnis. Skill modular, freemium'],
            ['💬', 'Semua channel', 'Web, Telegram, WhatsApp. Satu AI Personal, semua platform'],
          ].map(([icon, name, desc]) => (
            <div key={name} style={{ background: 'var(--surface)', padding: '28px 24px' }}>
              <div style={{ fontSize: 22, marginBottom: 12 }}>{icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, marginBottom: 8 }}>{name}</div>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 300, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
