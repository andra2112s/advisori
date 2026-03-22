# Authentication Issues Debug Guide

## 🔍 **Current Issues**

### 1. **401 Unauthorized on API Calls**
- Token exists (1390 chars) but backend rejects it
- Affects: `/channels/connections`, `/chat/usage`, `/chat/history`
- Backend JWT verification failing

### 2. **Token Disappears on Button Click**
- When clicking "Connect Telegram", token becomes `undefined`
- localStorage token cleared somehow

### 3. **Logout Not Working**
- Logout button doesn't sign out from Supabase
- Session remains active

---

## 🔧 **Root Cause Analysis**

### **The Problem:**
You're using **Supabase OAuth token** but backend expects **Advisori JWT token**.

**What's happening:**
1. You login via Google OAuth
2. Supabase gives you an OAuth token
3. Frontend saves this as `advisori_token`
4. Backend tries to verify it as JWT
5. **FAILS** - OAuth token ≠ JWT token

---

## 📋 **Two Authentication Systems**

### **Legacy System (Email/Password):**
```javascript
// Login endpoint returns:
{
  token: "eyJhbGciOiJIUzI1NiIs...", // JWT token
  user: { id, name, email }
}
```

### **Supabase OAuth System:**
```javascript
// OAuth returns:
{
  access_token: "eyJhbGciOiJIUzI1NiIs...", // OAuth token
  user: { id, email, user_metadata }
}
```

**Both look like JWT but have different signatures!**

---

## ✅ **Solutions**

### **Solution 1: Use Supabase Token for Backend (Recommended)**

**Step 1: Update Backend to Accept Supabase Token**

```javascript
// backend/server.js - Update auth decorator
app.decorate('authenticate', async (req, reply) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return reply.status(401).send({ error: 'No token provided' });
    }
    
    // Verify with Supabase instead of JWT
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    
    // Use Supabase user directly
    req.user = user;
    
  } catch (err) {
    return reply.status(401).send({ error: 'Authentication failed' });
  }
});
```

**Step 2: Remove JWT Dependency**
```javascript
// Remove or comment out JWT registration
// app.register(jwt, { secret: process.env.JWT_SECRET });
```

### **Solution 2: Create Advisori JWT from Supabase User**

**Step 1: Create Token Exchange Endpoint**

```javascript
// backend/routes/auth.js - Add new endpoint
app.post('/exchange-token', async (req, reply) => {
  const { supabase_token } = req.body;
  
  // Verify Supabase token
  const { data: { user }, error } = await supabase.auth.getUser(supabase_token);
  
  if (error || !user) {
    return reply.status(401).send({ error: 'Invalid Supabase token' });
  }
  
  // Create Advisori JWT
  const token = app.jwt.sign({ 
    sub: user.id,
    email: user.email 
  });
  
  reply.send({ token });
});
```

**Step 2: Update Frontend Auth**

```javascript
// src/lib/auth.jsx - After OAuth login
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  // Exchange Supabase token for Advisori JWT
  const response = await fetch('/api/auth/exchange-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supabase_token: session.access_token })
  });
  
  const { token } = await response.json();
  localStorage.setItem('advisori_token', token);
}
```

---

## 🚀 **Quick Fix (Test Now)**

### **Option A: Disable Auth Temporarily**

```javascript
// backend/routes/channels.js - Comment out auth
app.get('/connections', {
  // preHandler: [app.authenticate], // Temporarily disable
}, async (req, reply) => {
  // Use hardcoded user ID for testing
  const userId = 'your-user-id-here';
  
  const { data, error } = await supabase
    .from('channel_connections')
    .select('*')
    .eq('user_id', userId);
    
  reply.send({ connections: data || [] });
});
```

### **Option B: Use Email/Password Login**

1. Clear localStorage
2. Login with email/password (not Google)
3. Test channels

---

## 🔍 **Debug Steps**

### **1. Check Token Type**

```javascript
// In browser console
const token = localStorage.getItem('advisori_token');
const decoded = JSON.parse(atob(token.split('.')[1]));
console.log('Token payload:', decoded);

// If it has 'aud': 'authenticated' → Supabase OAuth
// If it has 'sub' only → Advisori JWT
```

### **2. Verify Backend Logs**

Check backend console for:
```
JWT Verification failed: ...
Token alg: HS256 (JWT) vs RS256 (Supabase)
```

### **3. Test API Directly**

```bash
# Test with curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:4000/api/channels/connections
```

---

## 📝 **Recommended Implementation**

### **Phase 1: Quick Fix (5 minutes)**
1. Temporarily disable auth on channels routes
2. Test channel connections work
3. Apply database migration

### **Phase 2: Proper Fix (30 minutes)**
1. Update backend to use Supabase auth
2. Remove JWT dependency
3. Test all endpoints

### **Phase 3: Cleanup (10 minutes)**
1. Remove unused JWT code
2. Update all auth decorators
3. Test logout functionality

---

## 🎯 **Current Status**

- ✅ Frontend saves Supabase OAuth token
- ✅ Backend expects JWT token
- ❌ **Mismatch causing 401 errors**
- ✅ Logout fixed (now calls Supabase signOut)
- ❌ Token disappears on button actions (needs investigation)

---

## 📊 **Next Actions**

1. **Apply database migration** (QUICK_SQL_MIGRATION.sql)
2. **Choose a solution** above
3. **Test channels work**
4. **Fix token disappearing issue**

**The core issue is token type mismatch between Supabase OAuth and backend JWT verification.**
