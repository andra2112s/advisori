# Advisori + OpenClaw Architecture - User Flow & Integration

## 🎯 **Core Philosophy: OpenClaw as Primary Architecture**

Advisori is built on **OpenClaw's multi-channel gateway architecture** as the foundation. Users interact with their AI assistant primarily through messaging platforms (WhatsApp, Telegram, Discord), with web chat as an optional interface.

---

## 📱 **User Journey Flow**

### **1. Registration & Authentication**
```
User visits → Sign up/Login → Soul Setup → Channels Page (Primary Entry)
```

**Flow:**
1. User lands on `/` (Landing page)
2. Clicks "Get Started" → `/login`
3. Registers/logs in via email or Google OAuth
4. Redirected to `/soul-setup` (personality configuration)
5. After setup → **Redirected to `/channels`** ✨ (PRIMARY ENTRY POINT)

### **2. Channel Connection (Primary Interface)**
```
Channels Page → Connect WhatsApp/Telegram/Discord → Chat via Messaging Apps
```

**User sees:**
- 🦞 **Connected Channels** page
- Three channel cards: WhatsApp, Telegram, Discord
- Connection status for each
- Instructions on how to connect

**Connection Options:**
- **WhatsApp**: Generate QR → Scan with phone → Connected
- **Telegram**: Get bot token from @BotFather → Paste → Connected
- **Discord**: Create bot → Get token → Paste → Connected

### **3. Primary Usage: Messaging Apps**
```
User sends message on WhatsApp/Telegram/Discord → AI processes → Response sent back
```

**This is the main way users interact with Advisori!**

**Example Flow (WhatsApp):**
1. User scans QR code on `/channels`
2. WhatsApp connected to Advisori backend
3. User opens WhatsApp on phone
4. Sends message: "Hitung PPh 21 gaji 15 juta"
5. Advisori AI processes message
6. Response sent back to WhatsApp instantly
7. Conversation continues naturally in WhatsApp

**Same for Telegram & Discord!**

### **4. Optional: Web Chat Interface**
```
Channels Page → Click "Go to Web Chat" → /chat → Chat in browser
```

**Web chat is secondary/optional:**
- For users who prefer browser interface
- For testing/demo purposes
- For users without messaging apps
- Accessible via button on Channels page

---

## 🏗️ **Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACES                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📱 WhatsApp        ✈️ Telegram        🎮 Discord          │
│  (Primary)          (Primary)          (Primary)           │
│                                                             │
│              💬 Web Chat (Optional)                        │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              ADVISORI BACKEND (Fastify)                     │
│                   Port 4000                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │         CHANNEL GATEWAY (OpenClaw Pattern)       │     │
│  ├──────────────────────────────────────────────────┤     │
│  │                                                  │     │
│  │  📡 WhatsApp Handler (Baileys)                  │     │
│  │     - QR authentication                         │     │
│  │     - Message events                            │     │
│  │     - Session management                        │     │
│  │                                                  │     │
│  │  📡 Telegram Handler (grammY)                   │     │
│  │     - Bot token auth                            │     │
│  │     - Message events                            │     │
│  │     - Session management                        │     │
│  │                                                  │     │
│  │  📡 Discord Handler (discord.js)                │     │
│  │     - Bot token auth                            │     │
│  │     - Message events                            │     │
│  │     - Session management                        │     │
│  │                                                  │     │
│  └──────────────────┬───────────────────────────────┘     │
│                     │                                      │
│                     ▼                                      │
│  ┌──────────────────────────────────────────────────┐     │
│  │         CHANNEL MANAGER SERVICE                  │     │
│  │  - Route messages to AI                          │     │
│  │  - Session isolation per user                    │     │
│  │  - Message history management                    │     │
│  └──────────────────┬───────────────────────────────┘     │
│                     │                                      │
│                     ▼                                      │
│  ┌──────────────────────────────────────────────────┐     │
│  │            AI SERVICE (ai.js)                    │     │
│  │  - Claude / Z.ai integration                     │     │
│  │  - Context loading                               │     │
│  │  - Memory management                             │     │
│  │  - Skill routing                                 │     │
│  └──────────────────┬───────────────────────────────┘     │
│                     │                                      │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                SUPABASE DATABASE                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  - users (authentication)                                  │
│  - souls (AI personalities)                                │
│  - channel_connections (user's connected channels)         │
│  - channel_sessions (per-conversation sessions)            │
│  - channel_messages (message history)                      │
│  - messages (web chat history)                             │
│  - skills (available AI skills)                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 **Message Flow Example**

### **Scenario: User sends WhatsApp message**

```
1. User (WhatsApp) → "Analisis saham BBCA"
                ↓
2. WhatsApp Handler receives message
                ↓
3. Create/get session: user123_whatsapp_6281234567890
                ↓
4. Save message to channel_messages table
                ↓
5. Channel Manager processes message
                ↓
6. Load user context (soul, history, skills)
                ↓
7. AI Service (Claude) generates response
                ↓
8. Response: "BBCA (Bank Central Asia) saat ini..."
                ↓
9. WhatsApp Handler sends response back
                ↓
10. User receives response in WhatsApp
                ↓
11. Save assistant message to channel_messages
```

**Same flow for Telegram and Discord!**

---

## 🎨 **UI/UX Flow**

### **Primary Path (Recommended)**
```
1. Sign up → Soul Setup → Channels Page
2. Connect WhatsApp/Telegram/Discord
3. Chat via messaging app (PRIMARY USAGE)
4. (Optional) Visit web chat for browser interface
```

### **Navigation Structure**
```
Landing (/)
  ↓
Login (/login)
  ↓
Soul Setup (/soul-setup)
  ↓
Channels (/channels) ← PRIMARY ENTRY POINT
  ├─ Connect WhatsApp
  ├─ Connect Telegram
  ├─ Connect Discord
  └─ [Button] Go to Web Chat → /chat
```

### **Header Navigation (in Chat page)**
```
[Avatar] [Soul Name] [Usage] [🦞 Channels] [Advisors] [Theme] [Logout]
                               ↑
                    Quick access to channels
```

---

## 💡 **Why OpenClaw Architecture?**

### **1. Multi-Platform Access**
Users can chat from **any messaging app** they already use daily:
- WhatsApp (most popular in Indonesia)
- Telegram (tech-savvy users)
- Discord (communities/servers)

### **2. No App Installation Required**
- No need to download Advisori app
- No need to open browser
- Just use existing messaging apps

### **3. Always Accessible**
- Messages sync across devices
- Notifications work natively
- Conversation history in familiar interface

### **4. Better UX**
- Users already know how to use WhatsApp/Telegram/Discord
- No learning curve
- Natural conversation flow

### **5. Scalability**
- Shared gateway = low cost
- Session isolation = security
- Easy to add more channels later

---

## 🔐 **Session Isolation Strategy**

Each conversation is isolated by:
```
Session ID = {user_id}_{channel}_{chat_id}

Examples:
- user123_whatsapp_6281234567890
- user123_telegram_987654321
- user456_discord_1234567890123456
```

**Benefits:**
- No data leakage between users
- Separate conversation contexts
- Independent message histories
- Secure multi-tenancy

---

## 📊 **Data Flow**

### **Channel Connection Data**
```sql
channel_connections
├─ user_id: UUID
├─ channel: 'whatsapp' | 'telegram' | 'discord'
├─ connected: boolean
├─ credentials: JSONB (encrypted bot tokens)
└─ metadata: JSONB (bot username, etc.)
```

### **Session Data**
```sql
channel_sessions
├─ id: 'user123_whatsapp_6281234567890'
├─ user_id: UUID
├─ channel: 'whatsapp'
├─ channel_chat_id: '6281234567890'
├─ context: JSONB (conversation context)
└─ last_message_at: timestamp
```

### **Message History**
```sql
channel_messages
├─ session_id: 'user123_whatsapp_6281234567890'
├─ role: 'user' | 'assistant'
├─ content: text
└─ created_at: timestamp
```

---

## 🚀 **Deployment Strategy**

### **Current: Zero-Cost Shared Gateway**
```
Single VPS (existing server)
├─ Advisori Backend (Fastify)
│  ├─ WhatsApp Handler (shared)
│  ├─ Telegram Handler (shared)
│  └─ Discord Handler (shared)
├─ Frontend (Vite)
└─ Supabase (free tier)

Cost: $0/month
Capacity: 100+ users
```

### **Future: Scaling Options**
```
Option A: Upgrade Supabase ($25/month)
  → 500-1000 users

Option B: Dedicated VPS ($50/month)
  → 1000-5000 users

Option C: Per-user containers (Fly.io)
  → Unlimited users
  → $2-5 per user/month
```

---

## ✅ **Implementation Checklist**

### **Completed ✅**
- [x] WhatsApp channel handler
- [x] Telegram channel handler
- [x] Discord channel handler
- [x] Channel manager service
- [x] API routes for channels
- [x] Database migration
- [x] Channels UI page
- [x] Navigation integration
- [x] QR code display
- [x] Bot token inputs
- [x] Connection status tracking
- [x] Soul setup → Channels redirect
- [x] Chat → Channels navigation button

### **Pending ⏳**
- [ ] Apply database migration to Supabase
- [ ] Test WhatsApp QR generation
- [ ] Test Telegram bot connection
- [ ] Test Discord bot connection
- [ ] Test end-to-end message flow
- [ ] Add media support (images, voice)
- [ ] Add group chat support
- [ ] Add analytics dashboard

---

## 📝 **User Instructions**

### **How to Connect WhatsApp**
1. Go to `/channels`
2. Click "Generate QR Code" on WhatsApp card
3. Open WhatsApp on your phone
4. Go to Settings → Linked Devices → Link a Device
5. Scan the QR code
6. Done! Send a message to test

### **How to Connect Telegram**
1. Open Telegram, search for @BotFather
2. Send `/newbot` and follow instructions
3. Copy the bot token
4. Go to `/channels` on Advisori
5. Paste token in Telegram card
6. Click "Connect Telegram"
7. Done! Send a message to your bot

### **How to Connect Discord**
1. Go to https://discord.com/developers/applications
2. Create New Application
3. Go to Bot → Add Bot
4. Enable "Message Content Intent"
5. Copy bot token
6. Go to `/channels` on Advisori
7. Paste token in Discord card
8. Click "Connect Discord"
9. Invite bot to your server
10. Done! Send a message in a channel

---

## 🎯 **Summary**

**Advisori is built on OpenClaw's multi-channel architecture:**

✅ **Primary Interface**: WhatsApp, Telegram, Discord  
✅ **Secondary Interface**: Web chat (optional)  
✅ **Entry Point**: `/channels` page after soul setup  
✅ **Architecture**: Shared gateway with session isolation  
✅ **Cost**: $0/month for 100+ users  
✅ **UX**: Users chat via familiar messaging apps  

**This makes Advisori accessible, scalable, and user-friendly!** 🦞🚀

---

**Last Updated**: March 20, 2026 9:20 PM  
**Status**: ✅ Architecture Complete - Ready for Testing
