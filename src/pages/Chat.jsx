import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { api } from '../lib/api'
import { Avatar, StatusDot, ThemeToggle, Spinner, Chip } from '../components/ui'

const ADVISORS = [
  { id: 'advisori-pajak', name: 'Aira', role: 'Konsultan Pajak', emoji: '🧾', tier: 'free',
    prompts: ['Hitung PPh 21 gaji 15 juta K/1','Deadline SPT tahunan?','Apa itu PTKP?','Cara lapor SPT online'] },
  { id: 'advisori-saham', name: 'Saga', role: 'Analis Saham IDX', emoji: '📈', tier: 'free',
    prompts: ['Analisis BBCA sekarang','Sektor apa yang menarik?','IHSG outlook hari ini','Cara screening saham'] },
  { id: 'advisori-hukum', name: 'Lex', role: 'Konsultan Hukum', emoji: '⚖️', tier: 'pro',
    prompts: ['Cara mendirikan PT','Apa itu NIB?','Kontrak freelance','Perbedaan PT dan CV'] },
]

function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:var(--bg-2);padding:1px 5px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/\n/g, '<br>')
}

export default function Chat() {
  const { soul, logout } = useAuth()
  const { toggle, isDark } = useTheme()
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [activeAdvisor, setAdvisor] = useState(null)
  const [skillBadge, setSkillBadge] = useState(null)
  const [sidebarOpen, setSidebar]   = useState(false)
  const [usage, setUsage]           = useState({ used: 0, limit: 20 })
  const [histLoaded, setHistLoaded] = useState(false)
  const messagesEnd = useRef(null)
  const inputRef    = useRef(null)

  const soulName   = soul?.name   || 'Aria'
  const soulAvatar = soul?.avatar || '✦'

  useEffect(() => {
    api.getUsage().then(setUsage).catch(() => {})
  }, [])

  useEffect(() => {
    if (!histLoaded) {
      api.getHistory('advisori-pajak').then(data => {
        if (data.messages?.length) setMessages(data.messages)
        setHistLoaded(true)
      }).catch(() => setHistLoaded(true))
    }
  }, [])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMsg = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setLoading(true)

    const userMsg = { role: 'user', content: text, id: Date.now() }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await api.streamChat(text, activeAdvisor)
      if (!res.ok) {
        const err = await res.json()
        setMessages(prev => [...prev, { role: 'error', content: err.error, id: Date.now() }])
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let botId     = Date.now() + 1
      let fullText  = ''
      let botAdded  = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          try {
            const data = JSON.parse(line.slice(5).trim())

            if (data.type === 'skill') {
              setSkillBadge(`${data.skill.emoji} ${data.skill.name}`)
              setAdvisor(data.skill.id)
              if (!botAdded) {
                setMessages(prev => [...prev, { role: 'assistant', content: '', id: botId }])
                botAdded = true
              }
            }

            if (data.type === 'token') {
              fullText += data.text
              setMessages(prev => prev.map(m =>
                m.id === botId ? { ...m, content: fullText } : m
              ))
            }

            if (data.type === 'done') {
              api.getUsage().then(setUsage).catch(() => {})
            }

            if (data.type === 'error') {
              setMessages(prev => [...prev, { role: 'error', content: data.message, id: Date.now() }])
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'error', content: 'Koneksi terputus. Coba lagi.', id: Date.now() }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const usagePct = Math.min(100, Math.round((usage.used / usage.limit) * 100))
  const activeAdvisorObj = ADVISORS.find(a => a.id === activeAdvisor) || ADVISORS[0]

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* Header */}
      <header style={{
        height: 60, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, flexShrink: 0,
        position: 'relative', zIndex: 10,
      }}>
        <Avatar avatar={soulAvatar} size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 400 }}>
            {soulName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <StatusDot online /> Online
            {skillBadge && (
              <span style={{
                marginLeft: 8, background: 'var(--gold-dim)', color: 'var(--gold-text)',
                border: '1px solid var(--gold)', borderRadius: 99, padding: '1px 8px',
                fontSize: 11, fontWeight: 500,
              }}>
                {skillBadge}
              </span>
            )}
          </div>
        </div>

        {/* Usage bar */}
        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginRight: 8 }}>
          {usage.used}/{usage.limit}
        </div>

        <button onClick={() => window.location.href = '/channels'} style={{
          fontSize: 12, fontWeight: 500, padding: '7px 14px',
          border: '1px solid var(--border-md)', borderRadius: 'var(--radius)',
          background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer',
          transition: 'var(--trans)',
        }}>
          🦞 Channels
        </button>
        <button onClick={() => setSidebar(!sidebarOpen)} style={{
          fontSize: 12, fontWeight: 500, padding: '7px 14px',
          border: '1px solid var(--border-md)', borderRadius: 'var(--radius)',
          background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer',
          transition: 'var(--trans)',
        }}>
          Advisors
        </button>
        <ThemeToggle />
        <button onClick={logout} style={{
          fontSize: 12, padding: '7px 12px', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', background: 'transparent',
          color: 'var(--ink-3)', cursor: 'pointer',
        }}>Keluar</button>
      </header>

      {/* Usage progress */}
      <div style={{ height: 2, background: 'var(--bg-3)', flexShrink: 0 }}>
        <div style={{
          height: '100%', background: usagePct > 80 ? 'var(--danger)' : 'var(--gold)',
          width: usagePct + '%', transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Welcome */}
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }} className="fade-up">
              <Avatar avatar={soulAvatar} size={64} style={{ margin: '0 auto 16px' }} />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 8 }}>
                Halo, saya {soulName}
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 24, fontWeight: 300 }}>
                {soul?.personality?.split(',')[0] || 'Siap menemanimu'} — tanyakan apapun.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {activeAdvisorObj.prompts.map(p => (
                  <Chip key={p} onClick={() => { setInput(p); inputRef.current?.focus() }}>
                    {p}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <div key={msg.id}
              style={{
                display: 'flex', gap: 10,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              {msg.role !== 'error' && (
                <Avatar
                  avatar={msg.role === 'user' ? (soul?.name?.[0] || 'A') : soulAvatar}
                  size={32}
                  style={msg.role === 'user'
                    ? { background: 'var(--ink)', color: 'var(--bg)', fontSize: 11, fontWeight: 500 }
                    : {}}
                />
              )}

              <div style={{ maxWidth: '74%' }}>
                <div style={{
                  fontSize: 11, color: 'var(--ink-4)', marginBottom: 4,
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                  fontWeight: 500, letterSpacing: '.03em',
                }}>
                  {msg.role === 'user' ? 'Kamu' : soulName}
                </div>

                {msg.role === 'error' ? (
                  <div style={{
                    fontSize: 13, color: 'var(--danger)', padding: '8px 12px',
                    background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--danger)',
                  }}>
                    {msg.content}
                  </div>
                ) : (
                  <div
                    style={{
                      background: msg.role === 'user' ? 'var(--ink)' : 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '12px 16px',
                      fontSize: 14, lineHeight: 1.65, fontWeight: 300,
                      color: msg.role === 'user' ? 'var(--bg)' : 'var(--ink-2)',
                      borderBottomRightRadius: msg.role === 'user' ? 'var(--radius)' : 'var(--radius-lg)',
                      borderBottomLeftRadius:  msg.role === 'user' ? 'var(--radius-lg)' : 'var(--radius)',
                    }}
                    dangerouslySetInnerHTML={{ __html: formatText(msg.content) + (loading && msg.id === messages[messages.length-1]?.id && msg.role === 'assistant' ? '<span style="animation:blink 1s step-end infinite">▊</span>' : '') }}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && messages[messages.length-1]?.role !== 'assistant' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <Avatar avatar={soulAvatar} size={32} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4, fontWeight: 500 }}>{soulName}</div>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', borderBottomLeftRadius: 'var(--radius)',
                  padding: '14px 16px', display: 'flex', gap: 5,
                }}>
                  {[0, 0.2, 0.4].map((d, i) => (
                    <span key={i} style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: 'var(--ink-4)',
                      animation: `pulse 1.2s ${d}s infinite`,
                      display: 'inline-block',
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEnd} />
        </div>
      </div>

      {/* Input */}
      <div style={{
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        padding: '14px 20px', flexShrink: 0,
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
            placeholder={`Tanya ${soulName}...`}
            rows={1}
            style={{
              flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius-md)', padding: '11px 16px',
              fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)',
              resize: 'none', outline: 'none', fontWeight: 300, lineHeight: 1.5,
              minHeight: 46, maxHeight: 120, overflowY: 'auto',
              transition: 'border-color .2s',
            }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={sendMsg}
            disabled={!input.trim() || loading}
            style={{
              width: 46, height: 46, background: 'var(--ink)', border: 'none',
              borderRadius: 'var(--radius-md)', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: (!input.trim() || loading) ? 0.4 : 1,
              transition: 'var(--trans)',
            }}
          >
            {loading
              ? <Spinner size={16} color="var(--bg)" />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            }
          </button>
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebar(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            zIndex: 40, animation: 'fadeIn .15s ease',
          }}
        />
      )}
      <div style={{
        position: 'fixed', right: 0, top: 60, bottom: 0, width: 280,
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .25s ease', zIndex: 50, overflowY: 'auto',
        padding: 20,
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 4 }}>Advisor Shop</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 18 }}>Aktifkan skill untuk AI Personal kamu</div>
        {ADVISORS.map(a => (
          <div key={a.id} style={{
            border: `1px solid ${activeAdvisor === a.id ? 'var(--gold)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)', padding: 14, marginBottom: 10,
            background: activeAdvisor === a.id ? 'var(--gold-dim)' : 'var(--bg-2)',
            cursor: 'pointer', transition: 'var(--trans)',
          }}
            onClick={() => { setAdvisor(a.id); setSidebar(false) }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{a.emoji}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{a.name} — {a.role}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: a.tier === 'free' ? 'var(--success)' : 'var(--ink-3)', fontWeight: 500 }}>
                {a.tier === 'free' ? 'Gratis' : 'Pro'}
              </span>
              {activeAdvisor === a.id && (
                <span style={{ fontSize: 11, color: 'var(--gold-text)', fontWeight: 500 }}>✓ Aktif</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
