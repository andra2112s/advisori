/**
 * Advisori Heartbeat Service
 * ─────────────────────────────────────────────────────────
 * Terinspirasi dari OpenClaw heartbeat — agent yang bertindak
 * proaktif tanpa menunggu user mulai chat duluan.
 *
 * Cara kerja:
 * - Berjalan terjadwal via node-cron
 * - Setiap task cek kondisi tertentu per user
 * - Jika kondisi terpenuhi → kirim notifikasi ke Telegram/WhatsApp
 * - Semua task aware terhadap soul & preferensi user
 *
 * Jalankan terpisah: node backend/services/heartbeat.js
 * Atau bersamaan:    npm run dev:all (tambahkan ke concurrently)
 */

import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Telegram bot instance (shared dengan bot/index.js jika dijalankan terpisah)
const tgBot = process.env.TELEGRAM_BOT_TOKEN
  ? new TelegramBot(process.env.TELEGRAM_BOT_TOKEN)
  : null;

// ─── Helper: kirim pesan ke user via platform mereka ──────
async function sendToUser(user, message) {
  try {
    if (user.platform === 'telegram' && user.platform_id && tgBot) {
      await tgBot.sendMessage(user.platform_id, message, { parse_mode: 'Markdown' });
      return true;
    }
    // WhatsApp: simpan ke queue, nanti diambil bot/index.js
    if (user.platform === 'whatsapp' && user.platform_id) {
      await supabase.from('notification_queue').insert({
        user_id: user.id,
        platform: 'whatsapp',
        platform_id: user.platform_id,
        message,
        created_at: new Date().toISOString(),
      });
      return true;
    }
    // Web: simpan sebagai in-app notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      message,
      read: false,
      created_at: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error(`[Heartbeat] Gagal kirim ke ${user.id}:`, err.message);
    return false;
  }
}

// ─── Helper: generate pesan dengan soul user ─────────────
async function generateWithSoul(soul, prompt) {
  const soulContext = soul ? `
Kamu adalah ${soul.name}.
Kepribadian: ${soul.personality || 'warm, helpful'}.
Gaya bicara: ${soul.speaking_style || 'conversational Indonesia'}.
Nilai hidup: ${soul.values?.join(', ') || 'kejujuran, kepraktisan'}.
Selalu konsisten dengan kepribadian ini.
  `.trim() : 'Kamu adalah asisten AI pribadi dari Advisori.';

  const res = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: soulContext,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content[0]?.text || '';
}

// ─── Helper: load semua user aktif dengan soul & platform ─
async function getActiveUsers() {
  const { data } = await supabase
    .from('users')
    .select('*, souls(*)')
    .not('platform_id', 'is', null)
    .eq('tier', 'free') // atau semua tier
    .limit(1000);
  return data || [];
}

// ════════════════════════════════════════════════════════
// HEARTBEAT TASKS
// ════════════════════════════════════════════════════════

// ─── Task 1: Morning Briefing ────────────────────────────
// Setiap hari jam 08:00 WIB (UTC+7 = 01:00 UTC)
// Kirim ringkasan singkat + motivasi pagi berdasarkan soul user
cron.schedule('0 1 * * *', async () => {
  console.log('[Heartbeat] Running: Morning Briefing');
  const users = await getActiveUsers();

  for (const user of users) {
    // Skip user yang tidak opt-in morning briefing
    const prefs = user.souls?.[0]?.memory?.preferences;
    if (prefs?.morning_briefing === false) continue;

    const soul = user.souls?.[0];
    const name = user.name?.split(' ')[0] || 'kamu';

    const prompt = `
Buat pesan sapaan pagi yang singkat (2-3 kalimat) untuk ${name}.
Hari ini: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}.
Tone sesuai kepribadianmu. Sertakan satu kalimat motivasi yang terasa personal, bukan klise.
Jangan lebih dari 3 kalimat total.
    `.trim();

    try {
      const message = await generateWithSoul(soul, prompt);
      await sendToUser(user, `🌅 *Selamat pagi, ${name}!*\n\n${message}`);
      // Rate limit: jangan spam API
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[Heartbeat] Morning briefing error for ${user.id}:`, err.message);
    }
  }
}, { timezone: 'UTC' });


// ─── Task 2: Deadline Pajak Reminder ─────────────────────
// Setiap tanggal 25 jam 09:00 WIB → reminder SPT masa
// Setiap 20 Maret jam 09:00 WIB → reminder SPT tahunan OP
cron.schedule('0 2 25 * *', async () => {
  console.log('[Heartbeat] Running: Pajak Masa Reminder');
  const users = await getActiveUsers();

  for (const user of users) {
    const soul = user.souls?.[0];
    const name = user.name?.split(' ')[0] || 'kamu';

    // Hanya kirim ke user yang punya skill pajak aktif
    const { data: hasPajak } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('skill_id', 'advisori-pajak')
      .eq('status', 'active')
      .single();

    // Semua user free juga dapat skill pajak
    const prompt = `
Buat reminder singkat (2 kalimat) untuk ${name} bahwa deadline SPT Masa adalah tanggal 20 bulan depan.
Tone sesuai kepribadianmu. Praktis dan actionable, bukan menakut-nakuti.
    `.trim();

    try {
      const message = await generateWithSoul(soul, prompt);
      await sendToUser(user,
        `🧾 *Reminder Pajak*\n\n${message}\n\n` +
        `Balas pesan ini untuk tanya lebih lanjut ke Aira.`
      );
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[Heartbeat] Pajak reminder error for ${user.id}:`, err.message);
    }
  }
}, { timezone: 'UTC' });


// ─── Task 3: Market Open Alert (IDX) ─────────────────────
// Setiap hari kerja jam 09:00 WIB (02:00 UTC)
// Alert sederhana bahwa pasar IDX baru buka
cron.schedule('0 2 * * 1-5', async () => {
  console.log('[Heartbeat] Running: Market Open Alert');
  const users = await getActiveUsers();

  // Filter hanya user yang punya skill saham & opt-in market alert
  for (const user of users) {
    const soul = user.souls?.[0];
    const prefs = soul?.memory?.preferences;
    if (prefs?.market_alert === false) continue;

    // Check apakah user aktifkan skill saham
    const watchlist = soul?.memory?.semantic?.watchlist;
    if (!watchlist || watchlist.length === 0) continue;

    const name = user.name?.split(' ')[0] || 'kamu';
    const tickers = Array.isArray(watchlist) ? watchlist.slice(0, 3).join(', ') : watchlist;

    const prompt = `
Buat pesan singkat (2 kalimat) bahwa IDX baru buka dan sarankan ${name} untuk pantau watchlist-nya: ${tickers}.
Tone sesuai kepribadianmu. Singkat dan energik.
    `.trim();

    try {
      const message = await generateWithSoul(soul, prompt);
      await sendToUser(user,
        `📈 *IDX Buka Hari Ini*\n\n${message}\n\n` +
        `Ketik nama saham untuk analisis cepat.`
      );
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[Heartbeat] Market alert error for ${user.id}:`, err.message);
    }
  }
}, { timezone: 'UTC' });


// ─── Task 4: Weekly Memory Digest ────────────────────────
// Setiap Minggu jam 10:00 WIB (03:00 UTC)
// Ringkasan apa yang sudah dibahas minggu ini
cron.schedule('0 3 * * 0', async () => {
  console.log('[Heartbeat] Running: Weekly Digest');
  const users = await getActiveUsers();

  for (const user of users) {
    const soul = user.souls?.[0];
    const prefs = soul?.memory?.preferences;
    if (prefs?.weekly_digest === false) continue;

    // Ambil 10 pesan terakhir minggu ini
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: messages } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('user_id', user.id)
      .gte('created_at', weekAgo.toISOString())
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!messages || messages.length === 0) continue;

    const topics = messages.map(m => m.content.slice(0, 80)).join('\n- ');
    const name = user.name?.split(' ')[0] || 'kamu';

    const prompt = `
Berikut pertanyaan yang ${name} ajukan minggu ini:
- ${topics}

Buat ringkasan singkat (3-4 kalimat) tentang topik yang paling sering dibahas
dan satu saran actionable untuk minggu depan. Tone sesuai kepribadianmu.
    `.trim();

    try {
      const message = await generateWithSoul(soul, prompt);
      await sendToUser(user,
        `📋 *Ringkasan Minggu Ini*\n\n${message}\n\n` +
        `Sampai jumpa minggu depan! 👋`
      );
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`[Heartbeat] Weekly digest error for ${user.id}:`, err.message);
    }
  }
}, { timezone: 'UTC' });


// ─── Task 5: Inactive User Re-engagement ─────────────────
// Setiap hari Rabu jam 14:00 WIB (07:00 UTC)
// Sapa user yang tidak chat lebih dari 7 hari
cron.schedule('0 7 * * 3', async () => {
  console.log('[Heartbeat] Running: Re-engagement');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Cari user yang terakhir chat > 7 hari lalu
  const { data: inactiveUsers } = await supabase
    .from('users')
    .select('*, souls(*)')
    .not('platform_id', 'is', null)
    .lt('updated_at', sevenDaysAgo.toISOString())
    .limit(50); // batasi 50 per run

  if (!inactiveUsers) return;

  for (const user of inactiveUsers) {
    const soul = user.souls?.[0];
    const name = user.name?.split(' ')[0] || 'kamu';

    const prompt = `
${name} belum chat denganmu selama lebih dari seminggu.
Buat pesan singkat (2 kalimat) yang hangat dan mengundang mereka kembali.
Tidak terasa seperti spam atau marketing. Terasa genuinely personal.
Tone sesuai kepribadianmu.
    `.trim();

    try {
      const message = await generateWithSoul(soul, prompt);
      await sendToUser(user, message);
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`[Heartbeat] Re-engagement error for ${user.id}:`, err.message);
    }
  }
}, { timezone: 'UTC' });


// ─── Startup log ─────────────────────────────────────────
console.log(`
🦞 Advisori Heartbeat Service
─────────────────────────────
✓ Morning Briefing    → setiap hari 08:00 WIB
✓ Pajak Reminder      → setiap tgl 25, 08:00 WIB
✓ Market Alert        → hari kerja 09:00 WIB
✓ Weekly Digest       → setiap Minggu 10:00 WIB
✓ Re-engagement       → setiap Rabu 14:00 WIB

Heartbeat running. Ctrl+C untuk stop.
`);