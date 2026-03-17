import TelegramBot from 'node-telegram-bot-api';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API = process.env.BACKEND_URL || 'http://localhost:4001';

// ─── Helper: call backend API ────────────────────────
async function callChat(userToken, message, advisorId) {
  const res = await fetch(`${API}/api/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
    },
    body: JSON.stringify({ message, advisorId }),
  });

  if (res.status === 429) {
    const data = await res.json();
    return { error: data.error };
  }

  if (!res.ok) return { error: 'Terjadi kesalahan. Coba lagi.' };

  return res.json();
}

// ─── Token store: telegram_id / wa_number → JWT ──────
// Di production: simpan di Supabase atau Redis
const tokenStore = new Map();

async function getOrLinkUser(platform, platformId, name) {
  if (tokenStore.has(`${platform}:${platformId}`)) {
    return tokenStore.get(`${platform}:${platformId}`);
  }

  // Auto-register user baru via platform ID
  const res = await fetch(`${API}/api/auth/platform-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, platformId, name }),
  });

  if (!res.ok) return null;
  const { token } = await res.json();
  tokenStore.set(`${platform}:${platformId}`, token);
  return token;
}

// ─── Format respons untuk bot (markdown → plain) ────
function formatForBot(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    .replace(/#{1,3}\s/g, '')
    .replace(/━+/g, '—')
    .trim();
}

// ══════════════════════════════════════════════════════
// TELEGRAM BOT
// ══════════════════════════════════════════════════════
export async function startTelegramBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN tidak ada, Telegram bot dilewati');
    return;
  }

  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

  // Handle polling errors gracefully
  bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM') {
      console.log('❌ Telegram bot stopped - Invalid token or unauthorized access');
      console.log('⚠️  Please check your TELEGRAM_BOT_TOKEN in .env file');
      // Stop the bot gracefully
      bot.stopPolling();
      return;
    }
    console.error('🤖 Telegram polling error:', error.message);
  });

  // Test bot connection first
  try {
    await bot.getMe();
    console.log('✅ Telegram bot running');
  } catch (error) {
    console.log('❌ Telegram bot failed - Invalid token or network error');
    console.log('⚠️  Telegram bot skipped - Check your TELEGRAM_BOT_TOKEN');
    bot.stopPolling();
    return;
  }

  // State: user sedang "typing" indicator
  const typing = new Set();

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'there';

    await getOrLinkUser('telegram', String(chatId), name);

    bot.sendMessage(chatId,
      `✦ *Selamat datang di Advisori, ${name}!*\n\n` +
      `Saya adalah AI Personal kamu. Tanyakan apapun — pajak, saham IDX, atau obrolan umum.\n\n` +
      `Gunakan /setup untuk mengkustomisasi kepribadian saya\n` +
      `Gunakan /skills untuk lihat advisor yang tersedia\n` +
      `Gunakan /usage untuk cek sisa kuota hari ini`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/setup/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
      '🎨 Untuk setup kepribadian AI Personal kamu, buka:\n\n' +
      `${process.env.FRONTEND_URL}/soul-setup\n\n` +
      'Setelah selesai, kembali ke sini dan lanjutkan chat!',
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/skills/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
      '✦ *Advisor yang Tersedia:*\n\n' +
      '🧾 *Aira* — Konsultan Pajak Indonesia (Gratis)\n' +
      '📈 *Saga* — Analis Saham IDX (Gratis)\n' +
      '⚖️ *Lex* — Konsultan Hukum Bisnis (Pro)\n\n' +
      'Advisor Pro tersedia di advisori.id',
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/usage/, async (msg) => {
    const chatId = msg.chat.id;
    const token = await getOrLinkUser('telegram', String(chatId), msg.from.first_name);
    if (!token) return;

    const res = await fetch(`${API}/api/chat/usage`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    bot.sendMessage(chatId,
      `📊 *Penggunaan Hari Ini*\n\n` +
      `${data.used}/${data.limit} pesan (${data.tier})\n` +
      `Sisa: ${data.remaining} pesan`,
      { parse_mode: 'Markdown' }
    );
  });

  // Main message handler
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Skip commands
    if (!text || text.startsWith('/')) return;

    // Get/create user token
    const token = await getOrLinkUser('telegram', String(chatId), msg.from.first_name);
    if (!token) {
      return bot.sendMessage(chatId, 'Terjadi kesalahan autentikasi. Coba /start ulang.');
    }

    // Typing indicator
    if (!typing.has(chatId)) {
      typing.add(chatId);
      bot.sendChatAction(chatId, 'typing');
    }

    // Typing interval
    const typingInterval = setInterval(() => {
      bot.sendChatAction(chatId, 'typing');
    }, 4000);

    try {
      const result = await callChat(token, text);

      clearInterval(typingInterval);
      typing.delete(chatId);

      if (result.error) {
        return bot.sendMessage(chatId, `⚠️ ${result.error}`, { parse_mode: 'Markdown' });
      }

      const skillBadge = `${result.skill.emoji} _${result.skill.name}_\n\n`;
      const reply = skillBadge + formatForBot(result.content);

      // Telegram max 4096 chars
      if (reply.length > 4096) {
        const chunks = reply.match(/.{1,4096}/gs) || [];
        for (const chunk of chunks) {
          await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
        }
      } else {
        await bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
      }

    } catch (err) {
      clearInterval(typingInterval);
      typing.delete(chatId);
      bot.sendMessage(chatId, '⚠️ Terjadi kesalahan. Coba lagi dalam beberapa detik.');
    }
  });

  console.log('✅ Telegram bot running');
  return bot;
}

// ══════════════════════════════════════════════════════
// WHATSAPP BOT (via Baileys)
// ══════════════════════════════════════════════════════
export async function startWhatsAppBot() {
  if (process.env.WHATSAPP_ENABLED !== 'true') {
    console.log('⚠️  WhatsApp bot dinonaktifkan (WHATSAPP_ENABLED != true)');
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState('./wa-auth');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: { level: 'silent' },
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
        : true;
      if (shouldReconnect) startWhatsAppBot();
    } else if (connection === 'open') {
      console.log('🚀 All bot services started!');

// Handle unhandled promise rejections to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('🤖 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit process, just log the error
});
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const text = msg.message?.conversation ||
                   msg.message?.extendedTextMessage?.text;

      if (!text) continue;

      // Handle commands
      if (text === '/start' || text === 'halo' || text === 'mulai') {
        await sock.sendMessage(from, {
          text: '✦ Selamat datang di Advisori!\n\nSaya adalah AI Personal kamu. Tanyakan apapun — pajak, saham IDX, atau obrolan umum.\n\nKetik /skills untuk lihat advisor tersedia.'
        });
        continue;
      }

      if (text === '/skills') {
        await sock.sendMessage(from, {
          text: '✦ Advisor yang Tersedia:\n\n🧾 Aira — Konsultan Pajak Indonesia (Gratis)\n📈 Saga — Analis Saham IDX (Gratis)\n⚖️ Lex — Konsultan Hukum (Pro)\n\nAdvisor Pro tersedia di advisori.id'
        });
        continue;
      }

      // Get user token
      const waNumber = from.replace('@s.whatsapp.net', '');
      const token = await getOrLinkUser('whatsapp', waNumber, waNumber);
      if (!token) continue;

      // Send typing indicator
      await sock.sendPresenceUpdate('composing', from);

      try {
        const result = await callChat(token, text);

        await sock.sendPresenceUpdate('paused', from);

        if (result.error) {
          await sock.sendMessage(from, { text: `⚠️ ${result.error}` });
          continue;
        }

        const reply = `${result.skill.emoji} _${result.skill.name}_\n\n${formatForBot(result.content)}`;

        // WhatsApp max ~65536 chars tapi sebaiknya < 4096
        await sock.sendMessage(from, { text: reply });

      } catch {
        await sock.sendPresenceUpdate('paused', from);
        await sock.sendMessage(from, { text: '⚠️ Terjadi kesalahan. Coba lagi.' });
      }
    }
  });

  return sock;
}

// ─── Start semua bot ─────────────────────────────────
startTelegramBot();
startWhatsAppBot();
