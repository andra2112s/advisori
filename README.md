# 🦞 Advisori — AI Personal Platform

> Setiap user punya AI Personal dengan kepribadian unik sendiri.
> Web + Telegram + WhatsApp. Zero install untuk user.
> Built with OpenClaw concepts × Paperclip orchestration × MiroFish-lite swarm intelligence.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org)

---

## Cara Kerja

```
User daftar → Setup AI Personal (nama, kepribadian, bebas) → Chat
     ↓
Web app / Telegram bot milik user / WhatsApp milik user
     ↓
Advisori Backend (Node.js + Fastify)
     ↓
Soul injection + Skill routing + Paperclip orchestration
     ↓
Claude API → response personal ke user
```

Setiap user **terisolasi penuh** — soul, memory, history, dan bot tidak pernah bercampur.

---

## Fitur Utama

- **AI Personal dengan Soul** — user definisikan nama, kepribadian, gaya bicara, nilai hidup bebas dari nol
- **Advisor Shop** — skill modular: Pajak IDX, Saham, Hukum Bisnis, dan lebih banyak
- **Bot per User** — setiap user connect bot Telegram/WA mereka sendiri (bukan pakai bot bersama)
- **Paperclip Orchestration** — heartbeat terjadwal, atomic task queue, budget enforcement
- **MiroFish-lite** — swarm prediction: 5 persona analis IDX jalan paralel → consensus
- **Browsing real-time** — Claude web search built-in untuk data aktual
- **Dark + Light mode** — toggle per user

---

## Struktur Project

```
advisori/
├── backend/                     ← Node.js + Fastify server
│   ├── server.js                ← Entry point
│   ├── routes/
│   │   ├── auth.js              ← Register, login, /me
│   │   ├── chat.js              ← SSE streaming + history
│   │   ├── soul.js              ← AI Personal setup
│   │   ├── shop.js              ← Advisor Shop
│   │   ├── bots.js              ← Bot connections per user
│   │   └── webhook.js           ← Platform login + Midtrans
│   ├── services/
│   │   ├── ai.js                ← Claude API + web search
│   │   ├── botManager.js        ← Per-user TG + WA instances
│   │   ├── paperclip.js         ← Orchestration + task queue
│   │   └── mirofish.js          ← Swarm prediction engine
│   ├── skills/
│   │   └── router.js            ← Skill routing + soul injection
│   └── supabase-schema.sql      ← Full database schema
│
├── src/                         ← React + Vite frontend
│   ├── main.jsx
│   ├── App.jsx                  ← Routes
│   ├── styles/global.css        ← Design system + dark/light
│   ├── lib/
│   │   ├── api.js               ← API helper
│   │   ├── auth.jsx             ← Auth context
│   │   └── theme.jsx            ← Dark/light mode
│   ├── components/ui/           ← Reusable components
│   └── pages/
│       ├── Landing.jsx
│       ├── Login.jsx
│       ├── SoulSetup.jsx        ← 5-step onboarding
│       ├── Chat.jsx             ← Main chat interface
│       └── BotSettings.jsx      ← Connect TG/WA per user
│
├── bot/
│   └── index.js                 ← Legacy single bot (deprecated)
│
├── index.html                   ← Vite entry
├── vite.config.js
├── package.json
└── .env.example
```

---

## Setup

### Prerequisites
- Node.js >= 22
- Supabase account: [supabase.com](https://supabase.com)
- Anthropic API key: [console.anthropic.com](https://console.anthropic.com)

### 1. Clone & Install

```bash
git clone https://github.com/andra2112s/advisori
cd advisori
npm install
```

### 2. Environment

```bash
cp .env.example .env
# Edit .env — minimal isi:
# SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY, JWT_SECRET, BOT_ENCRYPT_SECRET
```

### 3. Database

Buka [Supabase SQL Editor](https://supabase.com) → jalankan:
1. `backend/supabase-schema.sql` (schema utama)
2. `backend/supabase-v2.sql` (bot connections + paperclip + mirofish tables)

### 4. Jalankan

```bash
# Development — backend + frontend sekaligus
npm run dev        # backend port 4000
npm run dev:web    # frontend port 3000

# Production
npm start
```

---

## Cara User Connect Bot Mereka Sendiri

### Telegram
1. User buka `/bot-settings` di Advisori
2. Buka @BotFather → `/newbot` → dapat token
3. Paste token di Advisori → bot langsung aktif
4. Bot jalan dengan nama dan kepribadian AI Personal user

### WhatsApp
1. User buka `/bot-settings` → klik "Hubungkan WhatsApp"
2. QR code muncul
3. Scan dengan WhatsApp → selesai

---

## Tambah Skill Baru

Edit `backend/skills/router.js`:

```javascript
'nama-skill': {
  id: 'nama-skill',
  name: 'Nama Advisor',
  emoji: '🎯',
  tier: 'free', // 'free' | 'pro' | 'premium'
  keywords: ['kata', 'kunci', 'trigger'],
  prompt: () => `
## Skill Aktif: Nama Advisor
[Instruksi untuk AI di sini]
  `.trim(),
},
```

---

## API Endpoints

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/auth/register` | Daftar |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Profil + soul |
| POST | `/api/chat/stream` | SSE streaming (web) |
| POST | `/api/chat/message` | Non-streaming (bot) |
| GET | `/api/chat/history/:id` | Riwayat chat |
| GET | `/api/chat/usage` | Kuota hari ini |
| GET | `/api/soul` | Get soul |
| POST | `/api/soul/setup` | Setup AI Personal |
| GET | `/api/bots` | Status bot connections |
| POST | `/api/bots/telegram/connect` | Connect TG bot |
| POST | `/api/bots/whatsapp/connect` | Start WA connection |
| GET | `/api/bots/whatsapp/qr` | Poll QR code |
| GET | `/api/shop/skills` | List semua skill |

---

## Tier & Limits

| Tier | Pesan/hari | Skills | Harga |
|------|-----------|--------|-------|
| Free | 20 | Pajak + Saham | Gratis |
| Pro | 200 | Semua skill | Rp 49.000/bulan |
| Premium | Unlimited | Semua + prioritas | Rp 149.000/bulan |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Fastify v4 |
| Database | Supabase (Postgres) |
| AI | Anthropic Claude API |
| Bot TG | node-telegram-bot-api |
| Bot WA | @whiskeysockets/baileys |
| Scheduler | node-cron |
| Auth | JWT (custom) |

---

## Deploy

### Backend → Railway
```bash
npm install -g @railway/cli
railway login && railway init && railway up
```

### Frontend → Cloudflare Pages
- Connect repo → set build command: `npm run build` → output dir: `dist` 
- Set env var: `VITE_API_URL=https://your-backend.railway.app` 

---

## Inspirasi & Credits

- **OpenClaw** — konsep soul system dan skill architecture
- **Paperclip** — orchestration dan atomic task queue pattern  
- **MiroFish** — swarm intelligence prediction concept

---

## Lisensi

MIT — bebas digunakan secara komersial.
