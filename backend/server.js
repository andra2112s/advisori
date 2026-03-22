import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
// Auto-restart trigger

import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import soulRoutes from './routes/soul.js';
import shopRoutes from './routes/shop.js';
import webhookRoutes from './routes/webhook.js';
import botRoutes from './routes/bots.js';
import channelsRoutes from './routes/channels.js';
import { restoreAllConnections } from './services/botManager.js';
import { startPaperclip } from './services/paperclip.js';
import jwksRsa from 'jwks-rsa';
import channelManager from './services/channelManager.js';
import WhatsAppChannel from './channels/whatsapp.js';
import TelegramChannel from './channels/telegram.js';
import DiscordChannel from './channels/discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// ─── Supabase client (shared) ───────────────────────
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── Fastify instance ────────────────────────────────
const app = Fastify({ logger: true });

// ─── Plugins ─────────────────────────────────────────
await app.register(cors, {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5500',
  ],
  credentials: true,
});

// ─── JWT Registration ───────────────────────────────
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) return 'super-secret-key';
  return secret;
};

const jwksClient = jwksRsa({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: `${process.env.SUPABASE_URL}/.well-known/jwks.json`,
});

await app.register(jwt, {
  secret: getJwtSecret(),
  decode: {
    complete: true,
  },
  sign: {
    algorithm: 'HS256',
  },
});

// Custom decorator - extracts user from JWT payload and looks up in DB
app.decorate('authenticate', async (req, reply) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return reply.status(401).send({ error: 'No token provided' });
    }
    
    // Decode token without verification
    const decoded = app.jwt.decode(token, { complete: true });
    
    if (!decoded || !decoded.payload) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    
    const { payload } = decoded;
    
    // Try to extract user ID from various token formats
    const userId = payload.sub || payload.id || payload.user_id;
    
    if (!userId) {
      return reply.status(401).send({ error: 'No user ID in token' });
    }
    
    // Look up user in database
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error || !user) {
      return reply.status(401).send({ error: 'User not found' });
    }
    
    req.user = user;
    
  } catch (err) {
    app.log.error('Auth error:', err);
    return reply.status(401).send({ error: 'Authentication failed' });
  }
});

await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  // per-user lebih longgar untuk chat
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Static files are served by Vite dev server in development
// In production, serve from dist folder
if (process.env.NODE_ENV === 'production') {
  await app.register(staticPlugin, {
    root: path.join(__dirname, '../dist'),
    prefix: '/',
  });
}


// ─── Routes ──────────────────────────────────────────
// Root route (API info - move to /api for clarity)
app.get('/api', async () => ({
  name: 'Advisori API',
  version: '1.0.0',
  status: 'running',
  endpoints: {
    auth: '/api/auth',
    chat: '/api/chat',
    soul: '/api/soul',
    shop: '/api/shop',
    webhook: '/api/webhook',
    health: '/health'
  }
}));

// Favicon handler (to avoid 404)
app.get('/favicon.ico', (req, reply) => reply.code(204).send());

// Initialize channels
const whatsappChannel = new WhatsAppChannel(channelManager);
const telegramChannel = new TelegramChannel(channelManager);
const discordChannel = new DiscordChannel(channelManager);

channelManager.registerChannel('whatsapp', whatsappChannel);
channelManager.registerChannel('telegram', telegramChannel);
channelManager.registerChannel('discord', discordChannel);

// Make channels accessible to routes
app.decorate('channels', channelManager.channels);

app.register(authRoutes,     { prefix: '/api/auth' });
app.register(chatRoutes,     { prefix: '/api/chat' });
app.register(soulRoutes,     { prefix: '/api/soul' });
app.register(shopRoutes,     { prefix: '/api/shop' });
app.register(webhookRoutes,  { prefix: '/api/webhook' });
app.register(botRoutes,      { prefix: '/api/bots' });
app.register(channelsRoutes, { prefix: '/api/channels' });

// Health check
app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

// ─── Start ───────────────────────────────────────────
const PORT = process.env.PORT || 4000;
try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n🦞 Advisori backend running on port ${PORT}\n`);
  
  // Restore bot connections and start Paperclip
  await restoreAllConnections();
  startPaperclip();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
