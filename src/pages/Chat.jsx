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
  const fileInputRef = useRef(null)
  const [pendingImage, setPendingImage] = useState(null)
  const [imageContext, setImageContext] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedSubCategory, setSelectedSubCategory] = useState(null)
  const [mirofishResult, setMirofishResult] = useState(null)
  const [mirofishLoading, setMirofishLoading] = useState(false)

  const CATEGORIES = [
    { 
      id: 'investing', 
      emoji: '📊', 
      label: 'Investing & Saham',
      subCategories: [
        { id: 'stock-analysis', label: 'Analisis Saham', prompts: ['Analisis BBCA sekarang', 'Sektor apa yang menarik?', 'Rekomendasi saham untuk pemula'] },
        { id: 'portfolio', label: 'Portofolio', prompts: ['Review portofolio saya', 'Diversifikasi yang tepat', 'Risk assessment'] },
        { id: 'trading', label: 'Trading', prompts: ['Strategi trading harian', 'Swing trading vs hold', 'Cut loss strategy'] },
      ]
    },
    { 
      id: 'tax', 
      emoji: '🧾', 
      label: 'Pajak & Administrasi',
      subCategories: [
        { id: 'pph21', label: 'PPh 21', prompts: ['Hitung PPh 21', 'Potongan pajak kantor', 'PTKP terbaru'] },
        { id: 'spt', label: 'SPT Tahunan', prompts: ['Cara lapor SPT online', 'Deadline SPT', 'Denda keterlambatan'] },
        { id: 'npwp', label: 'NPWP & NIK', prompts: ['Nabung pakai NIK', 'NPWP wajib pajak', 'Linking NPWP'] },
      ]
    },
    { 
      id: 'business', 
      emoji: '💼', 
      label: 'Bisnis & UMKM',
      subCategories: [
        { id: 'legal', label: 'Bentuk Usaha', prompts: ['Beda PT dan CV', 'Cara daftar PT', 'Modal最小 untuk PT'] },
        { id: 'financing', label: 'Pendanaan', prompts: ['Pinjam ke bank', 'Crowdfunding', 'VC untuk startup'] },
        { id: 'nib', label: 'NIB & Izin', prompts: ['Cara dapat NIB', 'NIB untuk ekspor', 'Izin khusus usaha'] },
      ]
    },
    { 
      id: 'legal', 
      emoji: '⚖️', 
      label: 'Hukum & Kontrak',
      subCategories: [
        { id: 'contract', label: 'Kontrak', prompts: ['Draft kontrak kerja freelance', 'Klausul penting dalam MOU', 'Kontrak bisnis yang aman'] },
        { id: 'dispute', label: 'Sengketa', prompts: ['Cara mediasi', 'Gugatan ke pengadilan', 'Arbitrase vs litigasi'] },
        { id: 'ip', label: 'Hak Kekayaan Intelektual', prompts: ['Cara daftar merek', 'Copyright vs trademark', 'Royalti'] },
      ]
    },
    { 
      id: 'financial', 
      emoji: '💰', 
      label: 'Perencanaan Keuangan',
      subCategories: [
        { id: 'budgeting', label: 'Budgeting', prompts: ['Susun anggaran bulanan', '50/30/20 rule', 'Emergency fund'] },
        { id: 'debt', label: 'Hutang & Cicilan', prompts: ['Konsolidasi utang', 'Strategi lunasi KPR', 'Credit card debt'] },
        { id: 'insurance', label: 'Asuransi', prompts: ['Asuransi jiwa vs kesehatan', 'Unit link', 'Klaim asuransi'] },
      ]
    },
    { 
      id: 'career', 
      emoji: '🎓', 
      label: 'Karir & Pendidikan',
      subCategories: [
        { id: 'job', label: 'Karir', prompts: ['Negosiasi gaji', 'Resign dengan baik', 'Quiet quitting'] },
        { id: 'edu', label: 'Pendidikan', prompts: ['S2 atau kerja dulu?', 'Beasiswa dalam negeri', 'Kursus online bermanfaat'] },
        { id: 'entrepreneurship', label: 'Wirausaha', prompts: ['Mulai bisnis dari nol', 'Validasi ide bisnis', 'Pivot strategi'] },
      ]
    },
    { 
      id: 'life', 
      emoji: '🧭', 
      label: 'Keputusan Hidup',
      subCategories: [
        { id: 'major', label: 'Keputusan Besar', prompts: ['Beli rumah atau investasi?', 'Nikah atau fokus karir?', 'Pindah ke luar negeri'] },
        { id: 'relationships', label: 'Relasi & Networking', prompts: ['Networking efektif', 'Maintain hubungan', 'Personal branding'] },
      ]
    },
    { 
      id: 'chat', 
      emoji: '💬', 
      label: 'Ngobrol Aja',
      subCategories: [
        { id: 'random', label: 'Bebas', prompts: ['Cerita hari ini', 'Opini tentang...', 'Hiburan'] },
      ]
    },
    { 
      id: 'notes', 
      emoji: '📝', 
      label: 'Catatan Saya',
      subCategories: [
        { id: 'view-notes', label: 'Lihat Catatan', prompts: ['Buka halaman notes'] },
        { id: 'new-note', label: 'Buat Catatan Baru', prompts: ['Tolong buatkan catatan tentang...'] },
      ]
    },
  ]

  const handleCategorySelect = (category) => {
    setSelectedCategory(category)
    setSelectedSubCategory(null)
  }

  const handleSubCategorySelect = (subCategory) => {
    setSelectedSubCategory(subCategory)
    
    // Special handling for Notes category
    if (selectedCategory?.id === 'notes') {
      if (subCategory.id === 'view-notes') {
        window.location.href = '/notes'
        return
      }
    }
    
    // Auto-send first prompt
    if (subCategory.prompts?.[0]) {
      setTimeout(() => {
        setInput(subCategory.prompts[0])
        inputRef.current?.focus()
      }, 100)
    }
  }

  const handlePromptClick = (prompt) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const resetCategory = () => {
    setSelectedCategory(null)
    setSelectedSubCategory(null)
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const previewUrl = URL.createObjectURL(file)
    setPendingImage({ file, previewUrl, fileName: file.name })
    setImageContext('')
    e.target.value = ''
  }

  const sendImageWithContext = async () => {
    if (!pendingImage || loading) return
    
    const { file, previewUrl, fileName } = pendingImage
    const msgId = Date.now()
    const userMsg = { role: 'user', content: imageContext || `[Gambar: ${fileName}]`, image: previewUrl, id: msgId, uploading: true }
    setMessages(prev => [...prev, userMsg])
    setPendingImage(null)
    setImageContext('')
    setLoading(true)
    
    try {
      // Convert to base64
      const reader = new FileReader()
      const base64 = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.readAsDataURL(pendingImage.file)
      })
      
      // Upload to server
      const result = await api.uploadImage(base64)
      
      // Update message with uploaded URL
      const updatedMsg = { ...userMsg, uploading: false, image: result.url }
      setMessages(prev => prev.map(m => m.id === msgId ? updatedMsg : m))
      
      // Build prompt with image and user context
      const prompt = imageContext 
        ? `[Image: ${result.url}]\n\n${imageContext}` 
        : `[Image: ${result.url}] ${fileName}`
      
      // Send to AI
      const res = await api.streamChat(prompt, activeAdvisor)
      
      if (!res.ok) throw new Error('Failed to get response')
      
      const streamReader = res.body.getReader()
      const decoder = new TextDecoder()
      let aiMsg = ''
      const aiMsgId = Date.now()
      
      setMessages(prev => [...prev, { role: 'assistant', content: '', id: aiMsgId }])
      
      while (true) {
        const { done, value } = await streamReader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'token') {
                aiMsg += data.text
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: aiMsg } : m))
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.error('Image upload error:', err)
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: 'Gagal upload gambar', role: 'error', uploading: false } : m))
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

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

      const streamReader  = res.body.getReader()
      const decoder = new TextDecoder()
      let botId     = Date.now() + 1
      let fullText  = ''
      let botAdded  = false

      while (true) {
        const { done, value } = await streamReader.read()
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header - Matching Landing Page */}
      <header style={{
        height: 64, background: '#fff', borderBottom: '1px solid #eee',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0,
        position: 'relative', zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #FF6B35 0%, #FF8F5C 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 20 }}>🦞</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>
            Advisori<span style={{ color: '#FF6B35' }}>.</span>
          </span>
        </div>

        {/* Nav Links */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 24 }}>
          {[
            { label: 'Chat', href: '/chat', icon: '💬' },
            { label: 'Notes', href: '/notes', icon: '📝' },
            { label: 'Channels', href: '/channels', icon: '📱' },
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              fontSize: 14, fontWeight: 500,
              color: window.location.pathname === link.href ? '#FF6B35' : '#666',
              background: window.location.pathname === link.href ? '#FFF3F0' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}>
              <span>{link.icon}</span>
              {link.label}
            </a>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* User Info */}
        <Avatar avatar={soulAvatar} size={36} style={{ marginRight: 4 }} />
        <div style={{ marginRight: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{soulName}</div>
          <div style={{ fontSize: 11, color: '#4CAF50', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, background: '#4CAF50', borderRadius: '50%', display: 'inline-block' }} />
            Online
            {skillBadge && (
              <span style={{ marginLeft: 8, color: '#FF6B35' }}>{skillBadge}</span>
            )}
          </div>
        </div>

        {/* Usage */}
        <div style={{ 
          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
          background: '#f5f5f5', color: '#666', marginRight: 12,
        }}>
          {usage.used}/{usage.limit} msg
        </div>

        <button onClick={logout} style={{
          padding: '8px 14px', border: '1px solid #ddd', borderRadius: 8,
          background: 'transparent', color: '#666', cursor: 'pointer', fontSize: 13,
        }}>
          Logout
        </button>
      </header>

      {/* Usage progress */}
      <div style={{ height: 2, background: '#f0f0f0', flexShrink: 0 }}>
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
                {soul?.personality?.split(',')[0] || 'Siap menemanimu'} — pilih topik atau tanya langsung.
              </p>

              {!selectedCategory ? (
                <>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                    gap: 10, 
                    marginBottom: 20,
                    textAlign: 'left',
                  }}>
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat)}
                        style={{
                          padding: '14px 12px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'var(--trans)',
                        }}
                        onMouseOver={(e) => e.target.style.borderColor = 'var(--gold)'}
                        onMouseOut={(e) => e.target.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ fontSize: 20, marginBottom: 6 }}>{cat.emoji}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{cat.label}</div>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {activeAdvisorObj.prompts.map(p => (
                      <Chip key={p} onClick={() => handlePromptClick(p)}>
                        {p}
                      </Chip>
                    ))}
                  </div>
                </>
              ) : !selectedSubCategory ? (
                <>
                  <button
                    onClick={resetCategory}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', background: 'transparent',
                      border: '1px solid var(--border)', borderRadius: 99,
                      fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', marginBottom: 20,
                    }}
                  >
                    ← Kembali
                  </button>
                  <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>
                    {selectedCategory.emoji} {selectedCategory.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400, margin: '0 auto' }}>
                    {selectedCategory.subCategories.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => handleSubCategorySelect(sub)}
                        style={{
                          padding: '12px 16px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 14,
                          color: 'var(--ink)',
                          transition: 'var(--trans)',
                        }}
                        onMouseOver={(e) => { e.target.style.borderColor = 'var(--gold)'; e.target.style.background = 'var(--bg-2)'; }}
                        onMouseOut={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--surface)'; }}
                      >
                        {sub.label} →
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedSubCategory(null)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', background: 'transparent',
                      border: '1px solid var(--border)', borderRadius: 99,
                      fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', marginBottom: 20,
                    }}
                  >
                    ← {selectedCategory.label}
                  </button>
                  <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
                    {selectedSubCategory.label}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {selectedSubCategory.prompts.map(p => (
                      <Chip key={p} onClick={() => handlePromptClick(p)}>
                        {p}
                      </Chip>
                    ))}
                  </div>
                </>
              )}
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
                  <>
                    {msg.image && (
                      <div style={{ marginBottom: 8 }}>
                        <img src={msg.image} alt={msg.content} style={{ maxWidth: 200, borderRadius: 8, border: '1px solid var(--border)' }} />
                      </div>
                    )}
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
                  </>
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

          {/* MiroFish Panel */}
          {mirofishResult && (
            <div style={{
              marginTop: 20,
              padding: 20,
              background: 'var(--surface)',
              border: '2px solid var(--gold)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>🐠</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>MiroFish Analysis</span>
                  {mirofishResult.fromCache && (
                    <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>(cached)</span>
                  )}
                </div>
                <button
                  onClick={() => setMirofishResult(null)}
                  style={{
                    padding: '4px 10px', background: 'transparent',
                    border: '1px solid var(--border)', borderRadius: 99,
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {mirofishResult.personas?.map((p, i) => (
                  <div key={i} style={{
                    padding: '6px 12px',
                    background: 'var(--bg-2)',
                    borderRadius: 99,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: p.verdict?.signal === 'BUY' ? '#4CAF50' : p.verdict?.signal === 'AVOID' ? '#f44336' : '#FFC107'
                    }} />
                    {p.persona?.split('(')[0]?.trim()}: {p.verdict?.signal} ({p.verdict?.confidence}%)
                  </div>
                ))}
              </div>

              <div style={{
                padding: 12,
                background: 'var(--bg-2)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 12,
              }}>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4 }}>
                  Consensus: 
                  <span style={{
                    marginLeft: 8,
                    fontWeight: 600,
                    color: mirofishResult.consensus?.signal === 'BUY' ? '#4CAF50' : mirofishResult.consensus?.signal === 'AVOID' ? '#f44336' : '#FFC107'
                  }}>
                    {mirofishResult.consensus?.signal}
                  </span>
                  <span style={{ marginLeft: 8 }}>
                    {mirofishResult.consensus?.confidence}% confidence
                  </span>
                </div>
                <div dangerouslySetInnerHTML={{ __html: formatText(mirofishResult.synthesis || '') }} />
              </div>

              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontStyle: 'italic' }}>
                ⚠️ Bukan rekomendasi investasi. Keputusan ada di tangan investor.
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
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          {pendingImage ? (
            <div style={{ flex: 1, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img 
                  src={pendingImage.previewUrl} 
                  alt="Preview" 
                  style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} 
                />
                <button
                  onClick={() => setPendingImage(null)}
                  style={{
                    position: 'absolute', top: -8, right: -8, width: 20, height: 20,
                    borderRadius: '50%', border: 'none', background: 'var(--danger)',
                    color: 'white', fontSize: 12, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              </div>
              <textarea
                value={imageContext}
                onChange={e => setImageContext(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendImageWithContext() } }}
                placeholder={`Apa yang ingin ditanyakan tentang gambar ini?`}
                rows={1}
                style={{
                  flex: 1, background: 'var(--bg-2)', border: '1px solid var(--gold)',
                  borderRadius: 'var(--radius-md)', padding: '11px 16px',
                  fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)',
                  resize: 'none', outline: 'none', fontWeight: 300, lineHeight: 1.5,
                  minHeight: 46, maxHeight: 120, overflowY: 'auto',
                }}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
              />
              <button
                onClick={sendImageWithContext}
                disabled={loading}
                style={{
                  width: 46, height: 46, background: 'var(--gold)', border: 'none',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: loading ? 0.4 : 1,
                }}
                title="Kirim"
              >
                {loading
                  ? <Spinner size={16} color="var(--bg)" />
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                }
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 46, height: 46, background: 'var(--bg-2)', border: '1px solid var(--border-md)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'var(--trans)',
                }}
                title="Kirim gambar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </button>
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
            </>
          )}
        </div>
      </div>
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
