import { supabase } from '../config.js';
import bcrypt from 'bcryptjs';

export default async function authRoutes(app) {

  // ── Register ────────────────────────────────────────
  app.post('/register', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name:     { type: 'string', minLength: 1 },
        }
      }
    }
  }, async (req, reply) => {
    const { email, password, name } = req.body;

    // Cek email sudah ada
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return reply.status(409).send({ error: 'Email sudah terdaftar' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Buat user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        name,
        tier: 'free',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: 'Gagal membuat akun' });

    // Buat soul default
    await supabase.from('souls').insert({
      user_id: user.id,
      name: 'Aria',
      personality: 'warm, direct, intelligent',
      speaking_style: 'conversational bahasa Indonesia',
      backstory: null,
      values: ['kejujuran', 'kejelasan', 'kepraktisan'],
      quirks: [],
      avatar: '✦',
      memory: { episodic: [], semantic: {}, preferences: {} },
      is_setup: false,  // flag: soul belum dikustomisasi user
    });

    // Generate JWT
    const token = app.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: '30d', algorithm: 'HS256' }
    );

    reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email, tier: user.tier },
      soulReady: false,  // frontend akan redirect ke soul setup
    });
  });

  // ── Login ───────────────────────────────────────────
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const { email, password } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('*, souls(*)')
      .eq('email', email)
      .single();

    if (!user) {
      return reply.status(401).send({ error: 'Email atau password salah' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Email atau password salah' });
    }

    const token = app.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: '30d' }
    );

    const soul = user.souls?.[0];

    reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email, tier: user.tier },
      soulReady: soul?.is_setup || false,
    });
  });

  // ── Me ──────────────────────────────────────────────
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    reply.send({
      user: req.user,
      soul: null,
    });
  });

  // ── Logout ──────────────────────────────────────────
  app.post('/logout', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    // JWT stateless — client hapus token
    reply.send({ ok: true });
  });
}
