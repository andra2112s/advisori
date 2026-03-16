import { supabase } from '../server.js'
import {
  connectTelegram, disconnectTelegram,
  connectWhatsApp, disconnectWhatsApp,
  telegramInstances, whatsappInstances,
} from '../services/botManager.js'
import { scryptSync, createCipheriv, randomBytes } from 'crypto'

const ENCRYPT_KEY = scryptSync(
  process.env.BOT_ENCRYPT_SECRET || 'advisori-default-secret-change-this',
  'advisori-salt', 32
)

function encrypt(text) {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', ENCRYPT_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export default async function botRoutes(app) {

  // ── GET /api/bots — status semua bot user ─────────────
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { data: connections } = await supabase
      .from('bot_connections')
      .select('platform, bot_username, bot_name, display_name, wa_phone, status, last_active, connected_at, error_message')
      .eq('user_id', req.user.id)

    // Cek apakah instance masih hidup di memory
    const tgAlive = telegramInstances.has(req.user.id)
    const waAlive = whatsappInstances.has(req.user.id)

    const result = (connections || []).map(c => ({
      ...c,
      bot_token: undefined, // jangan return token ke client
      wa_session_data: undefined,
      alive: c.platform === 'telegram' ? tgAlive : waAlive,
    }))

    reply.send({ connections: result })
  })

  // ── POST /api/bots/telegram/connect ───────────────────
  // User input bot token dari @BotFather
  app.post('/telegram/connect', {
    preHandler: [app.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token:        { type: 'string', minLength: 20 },
          displayName:  { type: 'string', maxLength: 100 },
          welcomeMsg:   { type: 'string', maxLength: 500 },
        }
      }
    }
  }, async (req, reply) => {
    const { token, displayName, welcomeMsg } = req.body
    const userId = req.user.id

    // Validasi format token Telegram (123456789:AAH...)
    if (!token.match(/^\d+:[\w-]{35}$/)) {
      return reply.status(400).send({ error: 'Format token tidak valid. Dapatkan dari @BotFather di Telegram.' })
    }

    // Cek token tidak dipakai user lain
    const { data: existing } = await supabase
      .from('bot_connections')
      .select('user_id')
      .eq('platform', 'telegram')
      .neq('user_id', userId)
      .limit(1)

    // Encrypt token sebelum simpan
    const encryptedToken = encrypt(token)

    // Validasi token dengan call ke Telegram API dulu
    try {
      const testRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
      const testData = await testRes.json()
      if (!testData.ok) {
        return reply.status(400).send({ error: 'Token tidak valid atau bot sudah dihapus.' })
      }

      const botInfo = testData.result

      // Simpan ke database
      await supabase.from('bot_connections').upsert({
        user_id:         userId,
        platform:        'telegram',
        bot_token:       encryptedToken,
        bot_username:    botInfo.username,
        bot_name:        botInfo.first_name,
        display_name:    displayName || botInfo.first_name,
        welcome_message: welcomeMsg || null,
        status:          'pending',
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'user_id,platform' })

      // Start bot instance
      await connectTelegram(userId, encryptedToken)

      // Update status to active
      await supabase.from('bot_connections')
        .update({ status: 'active', connected_at: new Date().toISOString() })
        .eq('user_id', userId).eq('platform', 'telegram')

      reply.send({
        ok: true,
        bot: {
          username:    botInfo.username,
          name:        botInfo.first_name,
          displayName: displayName || botInfo.first_name,
        },
        message: `Bot @${botInfo.username} berhasil terhubung! User bisa mulai chat di Telegram.`,
      })

    } catch (err) {
      return reply.status(400).send({ error: 'Gagal validasi token: ' + err.message })
    }
  })

  // ── POST /api/bots/telegram/disconnect ────────────────
  app.post('/telegram/disconnect', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    await disconnectTelegram(req.user.id)
    await supabase.from('bot_connections')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id).eq('platform', 'telegram')
    reply.send({ ok: true })
  })

  // ── POST /api/bots/whatsapp/connect ───────────────────
  // Mulai WhatsApp connection, kirim QR via SSE
  app.post('/whatsapp/connect', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { displayName, welcomeMsg } = req.body || {}
    const userId = req.user.id

    // Upsert bot_connection record
    await supabase.from('bot_connections').upsert({
      user_id:         userId,
      platform:        'whatsapp',
      wa_session_id:   userId,
      display_name:    displayName || null,
      welcome_message: welcomeMsg  || null,
      status:          'pending',
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id,platform' })

    // Mulai koneksi — QR akan dikirim via SSE endpoint terpisah
    connectWhatsApp(
      userId,
      async (qr) => {
        // QR tersedia — simpan ke temporary storage
        await supabase.from('bot_connections')
          .update({ wa_session_data: { qr, qr_generated_at: Date.now() } })
          .eq('user_id', userId).eq('platform', 'whatsapp')
      },
      async (phone) => {
        await supabase.from('bot_connections')
          .update({ status: 'active', wa_phone: phone })
          .eq('user_id', userId).eq('platform', 'whatsapp')
      },
      async () => {
        await supabase.from('bot_connections')
          .update({ status: 'disconnected' })
          .eq('user_id', userId).eq('platform', 'whatsapp')
      }
    ).catch(err => {
      console.error('[BotRoutes] WA connect error:', err.message)
    })

    reply.send({ ok: true, message: 'Memulai koneksi WhatsApp. Polling /api/bots/whatsapp/qr untuk QR code.' })
  })

  // ── GET /api/bots/whatsapp/qr ─────────────────────────
  // Poll endpoint untuk QR code (frontend poll setiap 2 detik)
  app.get('/whatsapp/qr', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { data: conn } = await supabase
      .from('bot_connections')
      .select('wa_session_data, status')
      .eq('user_id', req.user.id)
      .eq('platform', 'whatsapp')
      .single()

    if (!conn) return reply.status(404).send({ error: 'Tidak ada koneksi WA yang pending' })

    if (conn.status === 'active') {
      return reply.send({ status: 'connected' })
    }

    const qrData = conn.wa_session_data?.qr
    const qrAge  = conn.wa_session_data?.qr_generated_at
    const isStale = qrAge && (Date.now() - qrAge) > 60000 // QR expire 60 detik

    if (!qrData || isStale) {
      return reply.send({ status: 'waiting', qr: null })
    }

    reply.send({ status: 'qr_ready', qr: qrData })
  })

  // ── POST /api/bots/whatsapp/disconnect ────────────────
  app.post('/whatsapp/disconnect', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    await disconnectWhatsApp(req.user.id)
    await supabase.from('bot_connections')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id).eq('platform', 'whatsapp')
    reply.send({ ok: true })
  })

  // ── PATCH /api/bots/:platform/branding ────────────────
  // Update display name dan welcome message
  app.patch('/:platform/branding', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { platform } = req.params
    if (!['telegram', 'whatsapp'].includes(platform)) {
      return reply.status(400).send({ error: 'Platform tidak valid' })
    }

    const { displayName, welcomeMessage } = req.body

    await supabase.from('bot_connections')
      .update({
        display_name:    displayName,
        welcome_message: welcomeMessage,
        updated_at:      new Date().toISOString(),
      })
      .eq('user_id', req.user.id)
      .eq('platform', platform)

    reply.send({ ok: true })
  })
}
