# 🦞 Advisori — AI Assistant like Jarvis  

> Setiap user punya AI Personal dengan kepribadian sendiri.
> Web + Telegram + WhatsApp. Zero install untuk user.
> Built on OpenClaw skills architecture.

---

## Cara Kerja

```
User daftar di advisori.id
    ↓
Setup AI Personal (nama, kepribadian, gaya bicara — bebas)
    ↓
Chat via Web / Telegram / WhatsApp
    ↓
Advisori backend (Node.js + Supabase)
    ↓
Soul injection + Skill routing
    ↓
Claude API → response ke user
```

Setiap user **terisolasi penuh** — soul, memory, dan chat history
tidak pernah bercampur antar user.

---

## Setup (15 menit)

### 1. Prerequisites
- Node.js >= 22
- Akun Supabase (gratis): supabase.com
- Anthropic API key: console.anthropic.com
- Telegram Bot Token: @BotFather (opsional)

### 2. Clone & Install
```bash
git clone https://github.com/kamu/advisori
cd advisori
npm install
```

### 3. Environment
```bash
cp .env.example .env
# Edit .env dan isi semua value yang diperlukan
```

### 4. Database
```
1. Buka supabase.com → project kamu → SQL Editor
2. Copy isi file: backend/supabase-schema.sql
3. Paste dan Run
```

### 5. Jalankan

**Development (backend + bot sekaligus):**
```bash
npm run dev:all
```

**Production:**
```bash
npm start &
npm run start:bot &
```

---

## Struktur Project

```
advisori/
├── backend/
│   ├── server.js              ← Fastify server entry
│   ├── services/
│   │   └── ai.js              ← Claude API + rate limiting
│   ├── skills/
│   │   └── router.js          ← Soul + skill injection
│   ├── routes/
│   │   ├── auth.js            ← Register, login, /me
│   │   ├── chat.js            ← Stream + message + history
│   │   ├── soul.js            ← Setup + update AI Personal
│   │   ├── shop.js            ← Advisor Shop
│   │   └── webhook.js         ← Platform login + Midtrans
│   └── supabase-schema.sql    ← Database schema
├── bot/
│   └── index.js               ← Telegram + WhatsApp bot
├── frontend/                  ← advisori.html (sudah ada)
├── .env.example
└── package.json
```

---

## API Endpoints

### Auth
```
POST /api/auth/register        → daftar dengan email
POST /api/auth/login           → login
GET  /api/auth/me              → profil user + soul
POST /api/webhook/platform-login → auto-register via bot
```

### Chat
```
POST /api/chat/stream          → SSE streaming (web)
POST /api/chat/message         → non-streaming (bot)
GET  /api/chat/history/:id     → riwayat chat
DELETE /api/chat/history/:id   → hapus riwayat
GET  /api/chat/usage           → kuota hari ini
```

### Soul
```
GET  /api/soul                 → get soul profile
POST /api/soul/setup           → setup/update AI Personal
PATCH /api/soul/memory         → update memory
POST /api/soul/reset           → reset ke default
```

---

## Tier & Limits

| Tier | Pesan/hari | Skill | Harga |
|------|-----------|-------|-------|
| Free | 20 | Pajak + Saham | Gratis |
| Pro | 200 | Semua skill | Rp 49.000/bulan |
| Premium | Unlimited | Semua + prioritas | Rp 149.000/bulan |

---

## Tambah Skill Baru

Edit `backend/skills/router.js`, tambahkan ke objek `SKILLS`:

```javascript
'nama-skill': {
  id: 'nama-skill',
  name: 'Nama Advisor',
  emoji: '🎯',
  tier: 'free',        // 'free' | 'pro' | 'premium'
  keywords: ['kata', 'kunci', 'trigger'],
  prompt: () => `
## Skill Aktif: Nama Advisor

[Instruksi untuk AI di sini]
  `.trim(),
},
```

Langsung aktif tanpa restart — router membaca ulang saat request masuk.

---

## Deploy ke Production

### Backend (Railway)
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

### Frontend (Cloudflare Pages)
```bash
# Upload advisori.html ke Cloudflare Pages
# Set VITE_API_URL ke Railway backend URL
```

### Environment Variables di Railway
Set semua variable dari `.env.example` di Railway dashboard.

---

## Lisensi

MIT — bebas digunakan secara komersial.
OpenClaw: MIT License (attribution required).
