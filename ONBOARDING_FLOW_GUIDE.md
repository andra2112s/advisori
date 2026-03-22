# Advisori Onboarding Flow - Complete Guide

## 🎯 **Current Onboarding Flow (OpenClaw-First)**

```
Step 1: Landing Page (/)
   ↓
Step 2: Login/Register (/login)
   ↓
Step 3: Soul Setup (/soul-setup)
   ↓
Step 4: Channels Page (/channels) ← PRIMARY DESTINATION
   ↓
Step 5: Connect WhatsApp/Telegram/Discord
   ↓
Step 6: Chat via Messaging Apps (MAIN USAGE)
   ↓
Step 7: (Optional) Web Chat (/chat)
```

---

## 📱 **Why Channels First?**

### **OpenClaw as Main Architecture**
- Users interact primarily via **messaging apps** (WhatsApp, Telegram, Discord)
- Web chat is **secondary/optional** interface
- No app installation needed
- Better UX (familiar interfaces)
- Always accessible from phone

### **User Benefits**
✅ Chat from **any device** (phone, tablet, desktop)  
✅ Use **familiar apps** (WhatsApp, Telegram, Discord)  
✅ **Native notifications** from messaging apps  
✅ **No browser required** for daily use  
✅ Conversation history synced across devices  

---

## 🔧 **Implementation Details**

### **1. Landing Page (`/`)**
- Shows product benefits
- "Get Started" button → `/login`

### **2. Login Page (`/login`)**
**After successful login:**
```javascript
// Redirects to:
navigate(soul?.is_setup ? '/channels' : '/soul-setup')
```

**Options:**
- Email/Password login
- Google OAuth
- Register new account

### **3. Soul Setup (`/soul-setup`)**
**After completing setup:**
```javascript
// Redirects to:
navigate('/channels')  // ← PRIMARY ENTRY POINT
```

**Setup includes:**
- Name
- Personality traits
- Speaking style
- Values
- Avatar

### **4. Channels Page (`/channels`)**
**This is where users land after onboarding!**

**What users see:**
```
🦞 Connected Channels                    [💬 Go to Web Chat]

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   📱 WhatsApp   │  │  ✈️ Telegram    │  │   🎮 Discord    │
│                 │  │                 │  │                 │
│ [Generate QR]   │  │ [Enter Token]   │  │ [Enter Token]   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Actions:**
- Connect WhatsApp (QR code)
- Connect Telegram (bot token)
- Connect Discord (bot token)
- (Optional) Go to Web Chat

### **5. Connect Channels**

#### **WhatsApp:**
1. Click "Generate QR Code"
2. Scan with WhatsApp mobile app
3. Connected! Send message to test

#### **Telegram:**
1. Open Telegram → @BotFather
2. Create bot → Get token
3. Paste token → Connect
4. Send message to bot

#### **Discord:**
1. Create bot on Discord Developer Portal
2. Get bot token
3. Paste token → Connect
4. Invite bot to server
5. Send message

### **6. Chat via Messaging Apps**
**This is the primary usage!**

Users chat naturally via:
- WhatsApp on phone 📱
- Telegram on any device ✈️
- Discord in servers 🎮

**AI responds instantly in the same app!**

### **7. Web Chat (Optional)**
Accessible via button on Channels page:
```
[💬 Go to Web Chat] → /chat
```

**Use cases:**
- Testing/demo
- Users without messaging apps
- Browser-based preference
- Screen sharing/presentations

---

## 🎨 **Navigation Structure**

### **Header in Chat Page:**
```
[Avatar] [Soul] [Usage] [🦞 Channels] [Advisors] [Theme] [Logout]
                          ↑
                   Quick access back to channels
```

### **Header in Channels Page:**
```
🦞 Connected Channels                    [💬 Go to Web Chat]
                                          ↑
                                   Access web chat if needed
```

---

## 🔐 **Authentication Flow**

### **Token Storage:**
```javascript
// After login/register
localStorage.setItem('advisori_token', session.access_token)

// Used for API calls
Authorization: `Bearer ${token}`
```

### **Session Management:**
```javascript
// Check Supabase session
supabase.auth.getSession()

// Sync user data
supabase.auth.getUser()

// Get soul data
supabase.from('souls').select('*').eq('user_id', user.id)
```

---

## 📊 **Database Requirements**

### **Before Testing Channels:**
Run this SQL in Supabase SQL Editor:

```sql
-- Copy from: QUICK_SQL_MIGRATION.sql
-- Creates: channel_connections, channel_sessions, channel_messages
```

**Tables created:**
- `channel_connections` - User's connected channels
- `channel_sessions` - Per-conversation sessions
- `channel_messages` - Message history

---

## 🐛 **Common Issues & Solutions**

### **Issue 1: 401 Unauthorized on Chat Page**
**Cause:** Token not properly stored after login

**Solution:**
1. Check localStorage for `advisori_token`
2. Verify token is valid Supabase access token
3. Re-login if token is missing/invalid

**Debug:**
```javascript
// In browser console
localStorage.getItem('advisori_token')
```

### **Issue 2: Channels button not visible**
**Cause:** Chat.jsx not updated with button

**Solution:** Already fixed! Button added to header:
```javascript
<button onClick={() => window.location.href = '/channels'}>
  🦞 Channels
</button>
```

### **Issue 3: Can't see Channels page**
**Cause:** Database migration not applied

**Solution:**
1. Open Supabase SQL Editor
2. Run `QUICK_SQL_MIGRATION.sql`
3. Verify tables created

### **Issue 4: WhatsApp QR not generating**
**Cause:** Backend channel handlers not initialized

**Solution:**
1. Restart backend: `npm run dev`
2. Check console for: `📡 Channel registered: whatsapp`
3. Verify no errors in backend logs

---

## ✅ **Testing Checklist**

### **Step 1: Authentication**
- [ ] Register new account
- [ ] Login with email/password
- [ ] Login with Google OAuth
- [ ] Verify token saved to localStorage

### **Step 2: Soul Setup**
- [ ] Complete all 5 steps
- [ ] Verify redirect to `/channels`
- [ ] Check soul data saved to database

### **Step 3: Channels Page**
- [ ] Page loads without errors
- [ ] See 3 channel cards (WhatsApp, Telegram, Discord)
- [ ] "Go to Web Chat" button visible
- [ ] Connection status shows "Not Connected"

### **Step 4: WhatsApp Connection**
- [ ] Click "Generate QR Code"
- [ ] QR code displays
- [ ] Scan with phone
- [ ] Status changes to "Connected"
- [ ] Send test message
- [ ] Receive AI response

### **Step 5: Telegram Connection**
- [ ] Create bot via @BotFather
- [ ] Paste token
- [ ] Click "Connect Telegram"
- [ ] Status changes to "Connected"
- [ ] Send test message
- [ ] Receive AI response

### **Step 6: Discord Connection**
- [ ] Create bot on Discord
- [ ] Paste token
- [ ] Click "Connect Discord"
- [ ] Status changes to "Connected"
- [ ] Send test message in Discord
- [ ] Receive AI response

### **Step 7: Navigation**
- [ ] Click "Go to Web Chat" from Channels
- [ ] Redirects to `/chat`
- [ ] Click "🦞 Channels" from Chat
- [ ] Redirects to `/channels`

---

## 🚀 **Quick Start for Testing**

### **1. Apply Database Migration**
```sql
-- Run in Supabase SQL Editor
-- Copy from: QUICK_SQL_MIGRATION.sql
```

### **2. Start Backend**
```bash
npm run dev
```

**Verify in console:**
```
📡 Channel registered: whatsapp
📡 Channel registered: telegram
📡 Channel registered: discord
🦞 Advisori backend running on port 4000
```

### **3. Start Frontend**
```bash
npm run dev:frontend
```

### **4. Test Flow**
1. Visit `http://localhost:3000`
2. Register/Login
3. Complete Soul Setup
4. **Land on `/channels`** ✨
5. Connect a channel
6. Send test message
7. Verify AI response

---

## 📝 **User Instructions (For Documentation)**

### **Getting Started**

**1. Create Your Account**
- Visit Advisori
- Click "Get Started"
- Register with email or Google

**2. Set Up Your AI Personality**
- Choose a name for your AI
- Select personality traits
- Pick speaking style
- Define core values
- Choose an avatar

**3. Connect Your Messaging Apps** ⭐
After setup, you'll land on the Channels page where you can:

**WhatsApp:**
- Click "Generate QR Code"
- Scan with your WhatsApp app
- Start chatting!

**Telegram:**
- Get a bot token from @BotFather
- Paste it in Advisori
- Chat with your bot

**Discord:**
- Create a bot on Discord
- Get the token
- Connect and invite to your server

**4. Start Chatting!**
- Send messages via WhatsApp/Telegram/Discord
- Get instant AI responses
- (Optional) Use web chat at `/chat`

---

## 🎯 **Success Metrics**

**Onboarding Completion:**
- ✅ User registers
- ✅ User completes soul setup
- ✅ User lands on channels page
- ✅ User connects at least 1 channel
- ✅ User sends first message
- ✅ User receives AI response

**Engagement:**
- Primary: Messages via channels (WhatsApp/Telegram/Discord)
- Secondary: Messages via web chat
- Goal: 80%+ usage via channels

---

**Last Updated:** March 20, 2026 9:25 PM  
**Status:** ✅ Onboarding Flow Complete - Channels First!
