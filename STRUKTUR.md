# Advisori — Struktur File Lengkap & Di Mana Taruh Setiap File

## Gambaran Besar

```
advisori/                          ← ROOT PROJECT
│
├── backend/                       ← Server Node.js (jalan di Railway/VPS)
│   ├── server.js
│   ├── services/
│   │   └── ai.js
│   ├── skills/
│   │   └── router.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── chat.js
│   │   ├── soul.js
│   │   ├── shop.js
│   │   └── webhook.js
│   └── supabase-schema.sql
│
├── frontend/                      ← File HTML (deploy ke Cloudflare Pages)
│   ├── index.html                 ← Landing page + login/register
│   ├── soul-setup.html            ← Onboarding AI Personal
│   ├── chat.html                  ← Halaman chat utama
│   └── shop.html                  ← Advisor Shop (opsional, bisa di chat.html)
│
├── bot/
│   └── index.js                   ← Telegram + WhatsApp (jalan bersamaan backend)
│
├── .env                           ← Environment variables (JANGAN di-commit)
├── .env.example                   ← Template .env
└── package.json
```

---

## Jawaban Langsung: Soul Setup Taruh di Mana?

```
advisori/
└── frontend/
    └── soul-setup.html   ← Di sini
```

Setelah user register → redirect ke `/soul-setup.html`
Setelah soul setup → redirect ke `/chat.html`

---

## Flow Lengkap User Journey

```
User buka advisori.id
        ↓
  index.html             ← Landing + login/register modal
        ↓ (register berhasil)
  soul-setup.html        ← Setup AI Personal (5 step)
        ↓ (selesai)
  chat.html              ← Chat dengan AI Personal
        ↓ (klik Advisor Shop)
  sidebar di chat.html   ← Browse & aktifkan skill
```

---

## Deploy: 2 Service Terpisah

### Service 1 — Frontend (GRATIS via Cloudflare Pages)

File yang di-upload:
```
frontend/
├── index.html
├── soul-setup.html
└── chat.html
```

Cara deploy:
1. Buka pages.cloudflare.com
2. Connect GitHub repo → pilih folder frontend/
3. Build command: (kosong)
4. Output directory: (kosong)
5. Add environment variable:
   ADVISORI_API = https://advisori-backend.railway.app

Di setiap HTML file, tambahkan di <head>:
```html
<script>window.ADVISORI_API = 'https://advisori-backend.railway.app'</script>
```

URL hasil: https://advisori.pages.dev (atau custom domain advisori.id)

### Service 2 — Backend + Bot ($5/bulan via Railway)

File yang di-deploy:
```
backend/
bot/
package.json
.env
```

Cara deploy:
1. Buka railway.app → New Project → Deploy from GitHub
2. Select repo → Railway auto-detect Node.js
3. Add environment variables (dari .env.example)
4. Railway auto-assign URL: https://advisori-xxx.railway.app

Start command di Railway:
```
node backend/server.js & node bot/index.js
```

---

## Checklist Setup Lengkap (urutan yang benar)

### Step 1 — Supabase (5 menit)
- [ ] Buat project di supabase.com
- [ ] SQL Editor → paste & run supabase-schema.sql
- [ ] Copy SUPABASE_URL dan SUPABASE_SERVICE_KEY

### Step 2 — Anthropic API (2 menit)
- [ ] console.anthropic.com → API Keys → Create Key
- [ ] Copy ANTHROPIC_API_KEY

### Step 3 — Telegram Bot (3 menit, opsional)
- [ ] Buka Telegram → cari @BotFather
- [ ] Ketik /newbot → ikuti instruksi
- [ ] Copy TELEGRAM_BOT_TOKEN

### Step 4 — Environment Variables
```bash
cp .env.example .env
# Edit .env dengan semua value di atas
```

### Step 5 — Test Lokal
```bash
npm install
npm run dev:all

# Buka browser: http://localhost:3000/frontend/index.html
# Backend jalan di: http://localhost:4000
```

### Step 6 — Deploy Backend ke Railway
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Step 7 — Deploy Frontend ke Cloudflare Pages
- Upload folder frontend/ ke Cloudflare Pages
- Set environment variable ADVISORI_API ke URL Railway

### Step 8 — Custom Domain (opsional)
- Cloudflare DNS → tambah domain advisori.id
- Point ke Cloudflare Pages

---

## Untuk Development Lokal

Struktur folder lokal yang disarankan:

```
~/projects/advisori/
├── backend/
│   └── ... (semua file backend)
├── frontend/
│   ├── index.html
│   ├── soul-setup.html
│   └── chat.html
├── bot/
│   └── index.js
├── package.json
└── .env
```

Test dengan Live Server di VS Code:
- Install extension "Live Server"
- Klik kanan index.html → "Open with Live Server"
- Frontend jalan di http://localhost:5500
- Backend jalan di http://localhost:4000 (npm run dev)

---

## Ringkasan Biaya

| Service | Free Tier | Setelah Free |
|---------|-----------|--------------|
| Cloudflare Pages | Unlimited | Gratis selamanya |
| Supabase | 500MB, 50k req/bulan | $25/bulan |
| Railway | $5 credit/bulan | ~$5-10/bulan |
| Anthropic API | $5 free credit | Pay per use |
| Telegram Bot | Gratis | Gratis selamanya |
| WhatsApp (Baileys) | Gratis | Gratis (self-hosted) |

Total biaya awal: ~$0-10/bulan untuk MVP
Target break even: 3-5 paying subscribers (@ Rp 49.000/bulan)
