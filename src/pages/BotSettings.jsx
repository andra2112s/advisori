import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

const PLATFORMS = [
  { id: 'telegram', label: 'Telegram', icon: '✈', color: '#229ED9' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '✆', color: '#25D366' },
]

export default function BotSettings() {
  const { soul } = useAuth()
  const [connections, setConnections] = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState('telegram')

  // Telegram state
  const [tgToken, setTgToken]         = useState('')
  const [tgName, setTgName]           = useState('')
  const [tgWelcome, setTgWelcome]     = useState('')
  const [tgLoading, setTgLoading]     = useState(false)
  const [tgError, setTgError]         = useState('')
  const [tgSuccess, setTgSuccess]     = useState('')

  // WhatsApp state
  const [waQR, setWaQR]               = useState(null)
  const [waStatus, setWaStatus]       = useState('idle') // idle | connecting | qr | connected | error
  const [waPhone, setWaPhone]         = useState('')
  const [waName, setWaName]           = useState('')
  const [waWelcome, setWaWelcome]     = useState('')
  const [waLoading, setWaLoading]     = useState(false)
  const qrPollRef                     = useRef(null)

  useEffect(() => {
    loadConnections()
    return () => clearInterval(qrPollRef.current)
  }, [])

  const loadConnections = async () => {
    try {
      const data = await api.get('/bots')
      setConnections(data.connections || [])

      const tg = data.connections?.find(c => c.platform === 'telegram')
      const wa = data.connections?.find(c => c.platform === 'whatsapp')

      if (tg) {
        setTgName(tg.display_name || '')
        setTgWelcome(tg.welcome_message || '')
      }
      if (wa) {
        setWaName(wa.display_name || '')
        setWaWelcome(wa.welcome_message || '')
        setWaPhone(wa.wa_phone || '')
        if (wa.status === 'active') setWaStatus('connected')
      }
    } catch (err) {
      console.error('Failed to load connections:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Telegram connect ────────────────────────────────────
  const connectTelegram = async () => {
    if (!tgToken.trim()) return
    setTgLoading(true)
    setTgError('')
    setTgSuccess('')
    try {
      const data = await api.post('/bots/telegram/connect', {
        token: tgToken.trim(),
        displayName: tgName || soul?.name,
        welcomeMsg: tgWelcome,
      })
      setTgSuccess(`✓ ${data.message}`)
      setTgToken('')
      await loadConnections()
    } catch (err) {
      setTgError(err.message)
    } finally {
      setTgLoading(false)
    }
  }

  const disconnectTelegram = async () => {
    if (!confirm('Disconnect bot Telegram?')) return
    await api.post('/bots/telegram/disconnect')
    await loadConnections()
  }

  // ── WhatsApp connect ────────────────────────────────────
  const connectWhatsApp = async () => {
    setWaLoading(true)
    setWaStatus('connecting')
    setWaQR(null)
    try {
      await api.post('/bots/whatsapp/connect', {
        displayName: waName || soul?.name,
        welcomeMsg:  waWelcome,
      })
      // Poll QR
      qrPollRef.current = setInterval(async () => {
        try {
          const data = await api.get('/bots/whatsapp/qr')
          if (data.status === 'connected') {
            setWaStatus('connected')
            clearInterval(qrPollRef.current)
            await loadConnections()
          } else if (data.status === 'qr_ready' && data.qr) {
            setWaQR(data.qr)
            setWaStatus('qr')
          }
        } catch {}
      }, 2000)
    } catch (err) {
      setWaStatus('error')
      console.error(err)
    } finally {
      setWaLoading(false)
    }
  }

  const disconnectWhatsApp = async () => {
    if (!confirm('Disconnect WhatsApp?')) return
    clearInterval(qrPollRef.current)
    await api.post('/bots/whatsapp/disconnect')
    setWaStatus('idle')
    setWaQR(null)
    await loadConnections()
  }

  const tgConn = connections.find(c => c.platform === 'telegram')
  const waConn = connections.find(c => c.platform === 'whatsapp')

  if (loading) return (
    <div style={styles.wrap}>
      <div style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 40 }}>Memuat...</div>
    </div>
  )

  return (
    <div style={styles.wrap}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={styles.title}>Koneksi Bot</h1>
        <p style={styles.subtitle}>
          Hubungkan bot Telegram atau WhatsApp kamu sendiri ke {soul?.name || 'AI Personal'}.
          User kamu akan chat langsung ke bot milikmu.
        </p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => setActiveTab(p.id)} style={{
            ...styles.tab,
            borderBottomColor: activeTab === p.id ? 'var(--ink)' : 'transparent',
            color: activeTab === p.id ? 'var(--ink)' : 'var(--ink-3)',
          }}>
            <span style={{ fontSize: 16 }}>{p.icon}</span>
            {p.label}
            {connections.find(c => c.platform === p.id && c.status === 'active') && (
              <span style={styles.activeDot} />
            )}
          </button>
        ))}
      </div>

      {/* ── TELEGRAM TAB ── */}
      {activeTab === 'telegram' && (
        <div style={styles.panel}>
          {tgConn?.status === 'active' ? (
            /* Connected state */
            <div>
              <div style={styles.connectedCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ ...styles.platformIcon, background: '#229ED920', color: '#229ED9' }}>✈</div>
                  <div>
                    <div style={styles.connectedName}>@{tgConn.bot_username}</div>
                    <div style={styles.connectedSub}>{tgConn.bot_name} · {tgConn.status}</div>
                  </div>
                  <div style={styles.liveBadge}>● Live</div>
                </div>
                <div style={styles.infoGrid}>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Display name</div>
                    <div style={styles.infoValue}>{tgConn.display_name || '—'}</div>
                  </div>
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Last active</div>
                    <div style={styles.infoValue}>
                      {tgConn.last_active
                        ? new Date(tgConn.last_active).toLocaleString('id-ID')
                        : 'Belum ada chat'}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={disconnectTelegram} style={styles.dangerBtn}>
                Disconnect Bot
              </button>
            </div>
          ) : (
            /* Connect form */
            <div>
              <div style={styles.howto}>
                <div style={styles.howtoTitle}>Cara mendapatkan Bot Token:</div>
                <ol style={styles.howtoList}>
                  <li>Buka Telegram → cari <strong>@BotFather</strong></li>
                  <li>Ketik <code>/newbot</code> → ikuti instruksi</li>
                  <li>Pilih nama bot (contoh: "Zara AI") dan username (@ZaraBot)</li>
                  <li>Copy token yang diberikan (format: 123456789:AAH...)</li>
                  <li>Paste di sini 👇</li>
                </ol>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Bot Token dari @BotFather</label>
                <input
                  value={tgToken}
                  onChange={e => setTgToken(e.target.value)}
                  placeholder="123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxx"
                  style={styles.input}
                  type="password"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Nama display (opsional)</label>
                <input
                  value={tgName}
                  onChange={e => setTgName(e.target.value)}
                  placeholder={soul?.name || 'Nama AI Personal kamu'}
                  style={styles.input}
                />
                <p style={styles.hint}>Nama yang muncul saat bot menyapa user</p>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Pesan sambutan (opsional)</label>
                <textarea
                  value={tgWelcome}
                  onChange={e => setTgWelcome(e.target.value)}
                  placeholder={`Halo! Saya ${soul?.name || 'Aria'}, AI Personal kamu...`}
                  style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
                />
              </div>

              {tgError && <div style={styles.error}>{tgError}</div>}
              {tgSuccess && <div style={styles.success}>{tgSuccess}</div>}

              <button
                onClick={connectTelegram}
                disabled={!tgToken.trim() || tgLoading}
                style={{ ...styles.primaryBtn, opacity: (!tgToken.trim() || tgLoading) ? 0.5 : 1 }}
              >
                {tgLoading ? 'Menghubungkan...' : 'Hubungkan Bot Telegram'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── WHATSAPP TAB ── */}
      {activeTab === 'whatsapp' && (
        <div style={styles.panel}>
          {waConn?.status === 'active' || waStatus === 'connected' ? (
            /* Connected */
            <div>
              <div style={styles.connectedCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ ...styles.platformIcon, background: '#25D36620', color: '#25D366' }}>✆</div>
                  <div>
                    <div style={styles.connectedName}>+{waConn?.wa_phone || waPhone}</div>
                    <div style={styles.connectedSub}>WhatsApp · connected</div>
                  </div>
                  <div style={styles.liveBadge}>● Live</div>
                </div>
              </div>
              <button onClick={disconnectWhatsApp} style={styles.dangerBtn}>
                Disconnect WhatsApp
              </button>
            </div>
          ) : waStatus === 'qr' && waQR ? (
            /* QR Code display */
            <div style={{ textAlign: 'center' }}>
              <p style={{ ...styles.subtitle, marginBottom: 20 }}>
                Scan QR code ini dengan WhatsApp kamu:
              </p>
              <div style={styles.qrContainer}>
                {/* Render QR sebagai text art atau pakai library */}
                <div style={styles.qrPlaceholder}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>QR Code Ready</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                    Buka WhatsApp → Linked Devices → Link a Device
                  </div>
                  <code style={styles.qrCode}>{waQR.slice(0, 60)}...</code>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 12 }}>
                QR expire dalam 60 detik. Halaman ini auto-refresh saat berhasil.
              </p>
            </div>
          ) : waStatus === 'connecting' ? (
            /* Loading */
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
              <div style={{ color: 'var(--ink-3)' }}>Membuat koneksi WhatsApp...</div>
            </div>
          ) : (
            /* Connect form */
            <div>
              <div style={styles.howto}>
                <div style={styles.howtoTitle}>Cara connect WhatsApp:</div>
                <ol style={styles.howtoList}>
                  <li>Klik "Hubungkan WhatsApp" di bawah</li>
                  <li>QR code akan muncul</li>
                  <li>Buka WhatsApp di HP → <strong>Linked Devices → Link a Device</strong></li>
                  <li>Scan QR code</li>
                  <li>Selesai — nomor WA kamu sekarang bisa terima dan kirim pesan via AI Personal</li>
                </ol>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Nama display (opsional)</label>
                <input
                  value={waName}
                  onChange={e => setWaName(e.target.value)}
                  placeholder={soul?.name || 'Nama AI Personal kamu'}
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Pesan sambutan (opsional)</label>
                <textarea
                  value={waWelcome}
                  onChange={e => setWaWelcome(e.target.value)}
                  placeholder={`Halo! Saya ${soul?.name || 'Aria'}...`}
                  style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
                />
              </div>

              <button
                onClick={connectWhatsApp}
                disabled={waLoading}
                style={{ ...styles.primaryBtn, opacity: waLoading ? 0.5 : 1 }}
              >
                {waLoading ? 'Memulai...' : 'Hubungkan WhatsApp'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: { maxWidth: 640, margin: '0 auto', padding: '32px 24px' },
  title: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'var(--ink-3)', fontWeight: 300, lineHeight: 1.7 },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 28 },
  tab: {
    display: 'flex', alignItems: 'center', gap: 8,
    flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 500,
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font-body)',
    justifyContent: 'center',
  },
  activeDot: { width: 7, height: 7, borderRadius: '50%', background: '#2D7A4F' },
  panel: { },
  connectedCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 20,
  },
  platformIcon: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  connectedName: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400 },
  connectedSub: { fontSize: 12, color: 'var(--ink-3)' },
  liveBadge: { marginLeft: 'auto', fontSize: 12, color: '#2D7A4F', fontWeight: 500 },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  infoItem: { },
  infoLabel: { fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 },
  infoValue: { fontSize: 13, color: 'var(--ink-2)' },
  howto: { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 24 },
  howtoTitle: { fontSize: 13, fontWeight: 500, marginBottom: 10 },
  howtoList: { paddingLeft: 20, fontSize: 13, color: 'var(--ink-2)', lineHeight: 2 },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 11, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 7 },
  input: { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius)', padding: '11px 14px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', outline: 'none' },
  hint: { fontSize: 12, color: 'var(--ink-4)', marginTop: 5 },
  error: { fontSize: 13, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: 14 },
  success: { fontSize: 13, color: 'var(--success)', background: 'var(--success-bg)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: 14 },
  primaryBtn: { padding: '13px 28px', fontSize: 14, fontWeight: 500, background: 'var(--ink)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'var(--font-body)' },
  dangerBtn: { padding: '10px 20px', fontSize: 13, background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'var(--font-body)' },
  qrContainer: { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  qrPlaceholder: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '32px 40px', textAlign: 'center' },
  qrCode: { display: 'block', marginTop: 16, fontSize: 10, color: 'var(--ink-4)', wordBreak: 'break-all', maxWidth: 300 },
}
