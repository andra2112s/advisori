import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ThemeToggle } from '../components/ui'
import { useEffect } from 'react'

const FEATURES = [
  {
    icon: '/icons/notes.svg',
    title: 'Smart Notes',
    desc: 'Capture, organize, and study faster. Voice notes, AI summaries, and chat with your notes.',
    color: '#4CAF50',
  },
  {
    icon: '/icons/flashcards.svg',
    title: 'Flashcards & Quizzes',
    desc: 'AI generates flashcards and quizzes from your notes for effective learning.',
    color: '#2196F3',
  },
  {
    icon: '/icons/chat.svg',
    title: 'AI Chat',
    desc: 'Your personal AI consultant for taxes, stocks, law, and more — in Indonesian.',
    color: '#9C27B0',
  },
  {
    icon: '/icons/stocks.svg',
    title: 'Real-time Stocks',
    desc: 'Live stock prices, analysis, and MiroFish swarm intelligence for investment decisions.',
    color: '#FF9800',
  },
  {
    icon: '/icons/mirofish.svg',
    title: 'MiroFish Analysis',
    desc: '7 analysts with different perspectives analyze your investment questions together.',
    color: '#E91E63',
  },
  {
    icon: '/icons/memory.svg',
    title: 'Persistent Memory',
    desc: 'AI remembers your context, preferences, and important facts across conversations.',
    color: '#00BCD4',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Create Your Soul',
    desc: 'Define your AI personal with unique personality, name, and communication style.',
  },
  {
    step: '2',
    title: 'Add Skills',
    desc: 'Install advisors for taxes, stocks, law, education, or create custom skills.',
  },
  {
    step: '3',
    title: 'Start Chatting',
    desc: 'Ask anything. Get instant answers with real-time data and AI analysis.',
  },
]

export default function Landing() {
  const { user, soul } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate(soul?.is_setup ? '/chat' : '/soul-setup')
  }, [user, soul])

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px', borderBottom: '1px solid #eee', position: 'fixed', width: '100%', top: 0, background: '#fff', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #FF6B35 0%, #FF8F5C 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(255,107,53,0.3)',
          }}>
            <span style={{ fontSize: 20 }}>🦞</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#1a1a1a' }}>
            Advisori<span style={{ color: '#FF6B35' }}>.</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ThemeToggle />
          <button onClick={() => navigate('/login')} style={{
            fontSize: 14, padding: '8px 20px', border: '1px solid #ddd',
            borderRadius: 8, background: 'transparent', color: '#333',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Sign in
          </button>
          <button onClick={() => navigate('/login')} style={{
            fontSize: 14, padding: '8px 20px', background: '#FF6B35',
            color: 'white', border: 'none', borderRadius: 8,
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
          }}>
            Get Started Free
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        padding: '160px 40px 100px', textAlign: 'center', maxWidth: 900, margin: '0 auto',
      }}>
        <div style={{
          width: 120, height: 120, margin: '0 auto 30px',
          borderRadius: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
          <img src="/icons/mascot.svg" alt="Advisori Mascot" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        <div style={{
          fontSize: 14, fontWeight: 600, letterSpacing: '.1em',
          textTransform: 'uppercase', color: '#FF6B35', marginBottom: 20,
        }}>
          AI Personal Platform for Indonesia
        </div>

        <h1 style={{
          fontSize: 'clamp(48px,8vw,72px)',
          fontWeight: 600, lineHeight: 1.1,
          marginBottom: 24, color: '#1a1a1a',
        }}>
          Your AI consultant for<br />
          <span style={{ color: '#FF6B35' }}>every decision</span>
        </h1>

        <p style={{
          fontSize: 20, color: '#666', fontWeight: 300,
          lineHeight: 1.7, maxWidth: 600, margin: '0 auto 40px',
        }}>
          Advisori combines AI consultation, smart notes, and investment analysis 
          in one powerful platform. Taxes, stocks, law, education — all with real Indonesian context.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/login')} style={{
            fontSize: 16, fontWeight: 500, padding: '16px 36px',
            background: '#FF6B35', color: 'white', border: 'none',
            borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(255,107,53,0.3)',
          }}>
            Try for Free
          </button>
          <button onClick={() => navigate('/login')} style={{
            fontSize: 16, padding: '16px 28px', background: 'white',
            color: '#333', border: '1px solid #ddd', borderRadius: 12,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Watch Demo
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '80px 40px', background: '#f8f9fa' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: 40, fontWeight: 600, marginBottom: 16, color: '#1a1a1a' }}>
              Everything you need, nothing you don't
            </h2>
            <p style={{ fontSize: 18, color: '#666', maxWidth: 500, margin: '0 auto' }}>
              Powerful AI tools designed for Indonesian professionals and students
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                background: 'white', borderRadius: 16, padding: 32,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                border: '1px solid #eee',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14, background: `${f.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20, overflow: 'hidden',
                }}>
                  <img src={f.icon} alt={f.title} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12, color: '#1a1a1a' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 15, color: '#666', lineHeight: 1.7 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ padding: '80px 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 40, fontWeight: 600, marginBottom: 60, color: '#1a1a1a' }}>
            Getting started is easy
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 40 }}>
            {HOW_IT_WORKS.map((h, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #FF6B35 0%, #FF8F5C 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: 36, boxShadow: '0 8px 24px rgba(255,107,53,0.3)',
                }}>
                  {i + 1}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#1a1a1a' }}>
                  {h.title}
                </h3>
                <p style={{ fontSize: 15, color: '#666', lineHeight: 1.7 }}>
                  {h.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '80px 40px', background: '#1a1a2e' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 40, fontWeight: 600, marginBottom: 16, color: 'white' }}>
            Simple, transparent pricing
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', marginBottom: 50 }}>
            Start free, upgrade when you need more power
          </p>

          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { name: 'Free', price: 'Rp 0', features: ['20 messages/day', 'Basic AI Chat', '3 Advisors', 'Basic Notes'], popular: false },
              { name: 'Pro', price: 'Rp 99K', features: ['200 messages/day', 'All AI features', 'All Advisors', 'Smart Notes + Voice', 'MiroFish (3 analysts)', 'Persistent Memory'], popular: true },
              { name: 'Expert', price: 'Rp 199K', features: ['Unlimited messages', 'All Pro features', 'MiroFish (5 analysts)', 'Real-time Stocks', 'Flashcards + Quizzes'], popular: false },
            ].map((plan, i) => (
              <div key={i} style={{
                background: plan.popular ? 'white' : 'rgba(255,255,255,0.1)',
                borderRadius: 20, padding: 32, minWidth: 260,
                border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.2)',
                transform: plan.popular ? 'scale(1.05)' : 'none',
              }}>
                {plan.popular && (
                  <div style={{
                    background: '#FF6B35', color: 'white', fontSize: 12, fontWeight: 600,
                    padding: '4px 12px', borderRadius: 20, display: 'inline-block', marginBottom: 16,
                  }}>
                    MOST POPULAR
                  </div>
                )}
                <h3 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: plan.popular ? '#1a1a1a' : 'white' }}>
                  {plan.name}
                </h3>
                <div style={{ fontSize: 36, fontWeight: 600, color: plan.popular ? '#FF6B35' : 'white', marginBottom: 24 }}>
                  {plan.price}<span style={{ fontSize: 16, fontWeight: 400, color: plan.popular ? '#666' : 'rgba(255,255,255,0.6)' }}>/month</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', textAlign: 'left' }}>
                  {plan.features.map((f, j) => (
                    <li key={j} style={{
                      fontSize: 14, color: plan.popular ? '#333' : 'rgba(255,255,255,0.8)',
                      marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ color: '#4CAF50' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button style={{
                  width: '100%', padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 500,
                  background: plan.popular ? '#FF6B35' : 'transparent',
                  color: 'white', border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '40px', textAlign: 'center', borderTop: '1px solid #eee', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #FF6B35 0%, #FF8F5C 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 18 }}>🦞</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a' }}>
            Advisori<span style={{ color: '#FF6B35' }}>.</span>
          </div>
        </div>
        <p style={{ fontSize: 14, color: '#666' }}>
          AI Personal Platform for Indonesia
        </p>
        <p style={{ fontSize: 12, color: '#999', marginTop: 20 }}>
          © 2026 Advisori. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
