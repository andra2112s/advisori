import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import soulRoutes from './routes/soul.js';
import shopRoutes from './routes/shop.js';
import webhookRoutes from './routes/webhook.js';

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
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500',
  ],
  credentials: true,
});

// ─── JWT Registration ───────────────────────────────
// Supabase JWT secret is base64 encoded.
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) return 'super-secret-key';
  
  // Supabase secrets are 64-byte base64 strings.
  // We must decode them to Buffer for HS256 to work correctly.
  try {
    return Buffer.from(secret, 'base64');
  } catch (e) {
    return secret;
  }
};

await app.register(jwt, {
  secret: getJwtSecret(),
  formatUser: (user) => user,
  verify: {
    algorithms: ['HS256']
  }
});

await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  // per-user lebih longgar untuk chat
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Serve static files from frontend directory
await app.register(staticPlugin, {
  root: path.join(__dirname, '../frontend'),
  prefix: '/',
});

// ─── Auth decorator ──────────────────────────────────
app.decorate('authenticate', async (req, reply) => {
  try {
    // 1. Verify JWT
    try {
      // Log token header for debugging (Safe, as it's not the secret)
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = app.jwt.decode(token, { complete: true });
        if (decoded) {
          app.log.info(`Token alg: ${decoded.header.alg}, sub: ${decoded.payload.sub}`);
        }
      }

      await req.jwtVerify();
    } catch (err) {
      app.log.warn(`JWT Verification failed: ${err.message}`);
      // Add more detail for debugging
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
            app.log.info(`Token header info: alg=${header.alg}, typ=${header.typ}`);
          } catch (e) {}
        }
      }
      return reply.status(401).send({ error: `Unauthorized: ${err.message}` });
    }

    if (!req.user) {
      return reply.status(401).send({ error: 'Unauthorized: No user info in token' });
    }

    const userId = req.user.id || req.user.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized: No user ID in token' });
    }

    // 2. Load user dari tabel 'users' kita
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    // Jika user tidak ditemukan di tabel kita, mungkin dia baru login via OAuth (Supabase Auth)
    if (!user) {
      // Ambil detail user dari Supabase Auth Admin API
      const { data: { user: sbUser }, error: sbError } = await supabase.auth.admin.getUserById(userId);
      
      if (sbUser) {
        app.log.info(`Syncing new OAuth user: ${sbUser.email}`);
        // Auto-create user record
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: sbUser.id,
            email: sbUser.email,
            name: sbUser.user_metadata?.full_name || sbUser.email.split('@')[0],
            tier: 'free'
          })
          .select()
          .single();
        
        if (createError) {
          app.log.error(`Failed to create synced user: ${createError.message}`);
          return reply.status(500).send({ error: 'Database error during user sync' });
        }
        
        user = newUser;

        // Buat soul default
        await supabase.from('souls').insert({
          user_id: user.id,
          name: 'Aria',
          personality: 'warm, direct, intelligent',
          speaking_style: 'conversational bahasa Indonesia',
          is_setup: false
        });
      } else {
        app.log.warn(`User ID ${req.user.id} not found in Supabase Auth or local table`);
      }
    }

    if (!user) return reply.status(401).send({ error: 'User not found' });
    
    // Attach full user object to request
    req.user = user;
  } catch (err) {
    app.log.error(`Auth decorator error: ${err.message}`);
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

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

app.register(authRoutes,    { prefix: '/api/auth' });
app.register(chatRoutes,    { prefix: '/api/chat' });
app.register(soulRoutes,    { prefix: '/api/soul' });
app.register(shopRoutes,    { prefix: '/api/shop' });
app.register(webhookRoutes, { prefix: '/api/webhook' });

// Health check
app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

// ─── Start ───────────────────────────────────────────
const PORT = process.env.PORT || 4000;
try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n🦞 Advisori backend running on port ${PORT}\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
