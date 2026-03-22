/**
 * Advisori Bot Manager
 * ─────────────────────────────────────────────────────────
 * Mengelola bot Telegram dan WhatsApp per user.
 * Setiap user punya instance bot mereka sendiri.
 *
 * Flow Telegram:
 * 1. User input token dari @BotFather di Advisori dashboard
 * 2. Kita encrypt dan simpan di Supabase
 * 3. BotManager spawn TelegramBot instance untuk user tersebut
 * 4. Instance disimpan di Map (in-memory) dan reconnect on restart
 *
 * Flow WhatsApp:
 * 1. User klik "Connect WhatsApp" di dashboard
 * 2. Kita generate session ID unik untuk user
 * 3. Baileys generate QR code, kita kirim ke frontend via SSE
 * 4. User scan QR, session tersimpan encrypted di Supabase
 * 5. Reconnect otomatis dari saved session
 */

import TelegramBot from 'node-telegram-bot-api'
import makeWASocket, {
  DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { chat } from './ai.js'
import { supabase } from '../config.js'
import dotenv from 'dotenv'
dotenv.config()

// ─── Encryption untuk bot tokens ─────────────────────────
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

function decrypt(encryptedText) {
  const [ivHex, encHex] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', ENCRYPT_KEY, iv)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString()
}

// ─── In-memory registry of active bot instances ──────────
const telegramInstances = new Map()  // userId → TelegramBot
const whatsappInstances = new Map()  // userId → WASocket
const qrStreams         = new Map()  // userId → SSE response object

// ── Helper: format response untuk bot ────────────────────
function fmtBot(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    .replace(/#{1,3}\s/g, '')
    .replace(/━+/g, '—')
    .trim()
}

// ── Helper: kirim pesan ke user via bot mereka ────────────
export async function sendToUserBot(userId, message) {
  // Coba Telegram dulu
  const tgBot = telegramInstances.get(userId)
  if (tgBot) {
    const { data: conn } = await supabase
      .from('bot_connections')
      .select('wa_phone')
      .eq('user_id', userId)
      .eq('platform', 'telegram')
      .single()
    // Kita perlu chat_id — simpan saat user pertama kali message
    // Ambil dari messages table sebagai platform_id fallback
    const { data: user } = await supabase
      .from('users').select('platform_id').eq('id', userId).single()
    if (user?.platform_id) {
      try {
        await tgBot.sendMessage(user.platform_id, message, { parse_mode: 'Markdown' })
        return true
      } catch (e) {
        console.error(`[BotManager] TG send failed for ${userId}:`, e.message)
      }
    }
  }

  // Coba WhatsApp
  const waSocket = whatsappInstances.get(userId)
  if (waSocket) {
    const { data: conn } = await supabase
      .from('bot_connections')
      .select('wa_phone')
      .eq('user_id', userId)
      .eq('platform', 'whatsapp')
      .single()
    if (conn?.wa_phone) {
      try {
        await waSocket.sendMessage(conn.wa_phone + '@s.whatsapp.net', { text: message })
        return true
      } catch (e) {
        console.error(`[BotManager] WA send failed for ${userId}:`, e.message)
      }
    }
  }

  // Fallback: in-app notification
  await supabase.from('notifications').insert({
    user_id: userId, message, read: false,
    created_at: new Date().toISOString(),
  })
  return false
}

// ════════════════════════════════════════════════════════
// TELEGRAM
// ════════════════════════════════════════════════════════

export async function connectTelegram(userId, encryptedToken) {
  // Decrypt token
  let token
  try { token = decrypt(encryptedToken) }
  catch { throw new Error('Token tidak valid') }

  // Stop existing instance jika ada
  await disconnectTelegram(userId)

  const bot = new TelegramBot(token, { polling: true })

  // Load soul user untuk personalisasi
  const { data: soulRow } = await supabase
    .from('souls').select('*').eq('user_id', userId).single()
  const soul = soulRow

  // Load bot connection config
  const { data: conn } = await supabase
    .from('bot_connections')
    .select('display_name, welcome_message')
    .eq('user_id', userId)
    .eq('platform', 'telegram')
    .single()

  const botName    = conn?.display_name || soul?.name || 'Advisori'
  const welcomeMsg = conn?.welcome_message ||
    `Halo! Saya ${botName}, AI Personal kamu dari Advisori. Tanyakan apapun — pajak, saham IDX, atau obrolan umum.` 

  // ── Command handlers ──────────────────────────────────
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id
    const name   = msg.from.first_name || 'kamu'

    // Simpan chat_id sebagai platform_id
    await supabase.from('users')
      .update({ platform_id: String(chatId), platform: 'telegram' })
      .eq('id', userId)

    // Update last_active
    await supabase.from('bot_connections')
      .update({ last_active: new Date().toISOString(), status: 'active' })
      .eq('user_id', userId).eq('platform', 'telegram')

    bot.sendMessage(chatId,
      `*Halo ${name}!* 👋\n\n${welcomeMsg}\n\n` +
      `Gunakan /skills untuk lihat advisor tersedia.\n` +
      `Gunakan /usage untuk cek kuota hari ini.`,
      { parse_mode: 'Markdown' }
    )
  })

  bot.onText(/\/skills/, async (msg) => {
    const { data: skills } = await supabase
      .from('skills').select('*').eq('status', 'active')
    const list = (skills || [])
      .map(s => `${s.emoji} *${s.name}* — ${s.tier === 'free' ? 'Gratis' : `Rp ${s.price.toLocaleString('id-ID')}/bln`}`)
      .join('\n')
    bot.sendMessage(msg.chat.id,
      `✦ *Advisor Tersedia:*\n\n${list}\n\nKunjungi advisori.id untuk aktifkan skill Pro.`,
      { parse_mode: 'Markdown' }
    )
  })

  bot.onText(/\/usage/, async (msg) => {
    const today = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('messages').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).eq('role', 'user')
      .gte('created_at', `${today}T00:00:00`)
    const { data: user } = await supabase.from('users').select('tier').eq('id', userId).single()
    const limits = { free: 20, pro: 200, premium: 9999 }
    const limit  = limits[user?.tier || 'free']
    bot.sendMessage(msg.chat.id,
      `📊 *Penggunaan Hari Ini*\n\n${count}/${limit} pesan (${user?.tier || 'free'})\nSisa: ${Math.max(0, limit - count)} pesan`,
      { parse_mode: 'Markdown' }
    )
  })

  // ── Main message handler ──────────────────────────────
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id
    const text   = msg.text
    if (!text || text.startsWith('/')) return

    // Typing indicator
    const typingInterval = setInterval(() => {
      bot.sendChatAction(chatId, 'typing').catch(() => {})
    }, 4000)
    bot.sendChatAction(chatId, 'typing').catch(() => {})

    try {
      const result = await chat({ userId, message: text, stream: false })

      clearInterval(typingInterval)

      if (!result.content) return

      const reply = `${result.activeSkill.emoji} _${result.activeSkill.name}_\n\n${fmtBot(result.content)}` 

      // Telegram max 4096 chars
      if (reply.length > 4096) {
        const chunks = reply.match(/.{1,4096}/gs) || []
        for (const chunk of chunks) {
          await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' })
        }
      } else {
        await bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' })
      }

      // Update last_active
      await supabase.from('bot_connections')
        .update({ last_active: new Date().toISOString() })
        .eq('user_id', userId).eq('platform', 'telegram')

    } catch (err) {
      clearInterval(typingInterval)
      if (err.message?.startsWith('RATE_LIMIT')) {
        bot.sendMessage(chatId, '⚠️ Batas pesan harian tercapai. Upgrade ke Pro di advisori.id')
      } else {
        bot.sendMessage(chatId, '⚠️ Terjadi kesalahan. Coba lagi dalam beberapa detik.')
      }
    }
  })

  bot.on('error', (err) => {
    console.error(`[TG Bot ${userId}] Error:`, err.message)
    supabase.from('bot_connections')
      .update({ status: 'error', error_message: err.message })
      .eq('user_id', userId).eq('platform', 'telegram')
      .then(() => {})
  })

  telegramInstances.set(userId, bot)
  console.log(`[BotManager] TG bot started for user ${userId}`)
  return bot
}

export async function disconnectTelegram(userId) {
  const existing = telegramInstances.get(userId)
  if (existing) {
    try { await existing.stopPolling() } catch {}
    telegramInstances.delete(userId)
  }
}

// ════════════════════════════════════════════════════════
// WHATSAPP
// ════════════════════════════════════════════════════════

export async function connectWhatsApp(userId, onQR, onConnected, onDisconnected) {
  await disconnectWhatsApp(userId)

  const sessionDir = `./wa-sessions/${userId}` 

  // Load Baileys auth state
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: { level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({ level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, fatal: () => {} }) },
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      // Kirim QR ke frontend via callback
      onQR && onQR(qr)
    }

    if (connection === 'open') {
      const phone = sock.user?.id?.split(':')[0]
      console.log(`[BotManager] WA connected for user ${userId}, phone: ${phone}`)

      await supabase.from('bot_connections')
        .upsert({
          user_id: userId, platform: 'whatsapp',
          wa_phone: phone, wa_session_id: userId,
          status: 'active', connected_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        }, { onConflict: 'user_id,platform' })

      onConnected && onConnected(phone)
    }

    if (connection === 'close') {
      const code = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode
        : null

      const shouldReconnect = code !== DisconnectReason.loggedOut

      await supabase.from('bot_connections')
        .update({
          status: shouldReconnect ? 'pending' : 'disconnected',
          error_message: lastDisconnect?.error?.message || null,
        })
        .eq('user_id', userId).eq('platform', 'whatsapp')

      whatsappInstances.delete(userId)

      if (shouldReconnect) {
        console.log(`[BotManager] WA reconnecting for user ${userId}`)
        setTimeout(() => connectWhatsApp(userId, onQR, onConnected, onDisconnected), 3000)
      } else {
        console.log(`[BotManager] WA logged out for user ${userId}`)
        onDisconnected && onDisconnected()
      }
    }
  })

  // ── Message handler ───────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (msg.key.fromMe) continue

      const from = msg.key.remoteJid
      const text = msg.message?.conversation ||
                   msg.message?.extendedTextMessage?.text
      if (!text) continue

      // Commands
      if (text === '/start' || text === 'halo') {
        const { data: soul } = await supabase.from('souls').select('name').eq('user_id', userId).single()
        const { data: conn } = await supabase.from('bot_connections')
          .select('welcome_message, display_name').eq('user_id', userId).eq('platform', 'whatsapp').single()
        const botName = conn?.display_name || soul?.name || 'Advisori'
        await sock.sendMessage(from, {
          text: `Halo! Saya ${botName}, AI Personal kamu. Tanyakan apapun — pajak, saham IDX, atau obrolan umum.` 
        })
        continue
      }

      // Typing
      await sock.sendPresenceUpdate('composing', from)

      try {
        const result = await chat({ userId, message: text, stream: false })
        await sock.sendPresenceUpdate('paused', from)

        if (result.content) {
          const reply = `${result.activeSkill.emoji} _${result.activeSkill.name}_\n\n${fmtBot(result.content)}` 
          await sock.sendMessage(from, { text: reply })
        }

        await supabase.from('bot_connections')
          .update({ last_active: new Date().toISOString() })
          .eq('user_id', userId).eq('platform', 'whatsapp')

      } catch (err) {
        await sock.sendPresenceUpdate('paused', from)
        if (err.message?.startsWith('RATE_LIMIT')) {
          await sock.sendMessage(from, { text: '⚠️ Batas pesan harian tercapai. Upgrade ke Pro di advisori.id' })
        } else {
          await sock.sendMessage(from, { text: '⚠️ Terjadi kesalahan. Coba lagi.' })
        }
      }
    }
  })

  whatsappInstances.set(userId, sock)
  return sock
}

export async function disconnectWhatsApp(userId) {
  const existing = whatsappInstances.get(userId)
  if (existing) {
    try { await existing.end() } catch {}
    whatsappInstances.delete(userId)
  }
}

// ─── Restore all active connections on server start ───────
export async function restoreAllConnections() {
  console.log('[BotManager] Restoring bot connections...')

  const { data: connections } = await supabase
    .from('bot_connections')
    .select('*, users(id)')
    .eq('status', 'active')

  if (!connections?.length) {
    console.log('[BotManager] No active connections to restore')
    return
  }

  for (const conn of connections) {
    const userId = conn.user_id
    try {
      if (conn.platform === 'telegram' && conn.bot_token) {
        await connectTelegram(userId, conn.bot_token)
        console.log(`[BotManager] ✓ TG restored for ${userId}`)
      } else if (conn.platform === 'whatsapp') {
        await connectWhatsApp(userId,
          () => {},
          (phone) => console.log(`[BotManager] ✓ WA restored for ${userId} (${phone})`),
          () => {}
        )
      }
    } catch (err) {
      console.error(`[BotManager] Failed to restore ${conn.platform} for ${userId}:`, err.message)
      await supabase.from('bot_connections')
        .update({ status: 'error', error_message: err.message })
        .eq('id', conn.id)
    }

    // Stagger reconnections - jangan semua sekaligus
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`[BotManager] Restored ${connections.length} connections`)
}

// Export instances map untuk status check
export { telegramInstances, whatsappInstances }
