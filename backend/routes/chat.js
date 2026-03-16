import { chat } from '../services/ai.js';
import { supabase } from '../server.js';

export default async function chatRoutes(app) {

  // ── Streaming chat (web) ─────────────────────────────
  app.post('/stream', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { message, advisorId } = req.body;
    if (!message?.trim()) {
      return reply.status(400).send({ error: 'Message kosong' });
    }

    // SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    try {
      const { stream, activeSkill } = await chat({
        userId: req.user.id,
        message,
        advisorId,
        stream: true,
      });

      // Kirim info skill dulu
      reply.raw.write(`data: ${JSON.stringify({
        type: 'skill',
        skill: { id: activeSkill.id, name: activeSkill.name, emoji: activeSkill.emoji }
      })}\n\n`);

      // Stream token satu per satu
      let fullContent = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text;
          fullContent += text;
          reply.raw.write(`data: ${JSON.stringify({ type: 'token', text })}\n\n`);
        }
      }

      // Simpan pesan lengkap ke DB
      await supabase.from('messages').insert({
        user_id: req.user.id,
        advisor_id: activeSkill.id,
        role: 'assistant',
        content: fullContent,
        created_at: new Date().toISOString(),
      });

      reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      reply.raw.end();

    } catch (err) {
      if (err.message?.startsWith('RATE_LIMIT:')) {
        const [, limit, tier] = err.message.split(':');
        reply.raw.write(`data: ${JSON.stringify({
          type: 'error',
          code: 'RATE_LIMIT',
          message: `Batas harian ${limit} pesan tercapai. Upgrade ke Pro untuk lebih banyak.`,
          tier,
        })}\n\n`);
      } else {
        reply.raw.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'Terjadi kesalahan. Coba lagi.',
        })}\n\n`);
      }
      reply.raw.end();
    }
  });

  // ── Non-streaming chat (untuk bot Telegram/WhatsApp) ──
  app.post('/message', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { message, advisorId } = req.body;
    if (!message?.trim()) {
      return reply.status(400).send({ error: 'Message kosong' });
    }

    try {
      const result = await chat({
        userId: req.user.id,
        message,
        advisorId,
        stream: false,
      });

      reply.send({
        content: result.content,
        skill: {
          id: result.activeSkill.id,
          name: result.activeSkill.name,
          emoji: result.activeSkill.emoji,
        },
        usage: result.usage,
      });

    } catch (err) {
      if (err.message?.startsWith('RATE_LIMIT:')) {
        const [, limit] = err.message.split(':');
        return reply.status(429).send({
          error: `Batas harian ${limit} pesan tercapai. Upgrade ke Pro untuk lebih banyak.`,
          code: 'RATE_LIMIT',
        });
      }
      reply.status(500).send({ error: 'Terjadi kesalahan. Coba lagi.' });
    }
  });

  // ── Get history per advisor ──────────────────────────
  app.get('/history/:advisorId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { advisorId } = req.params;
    const { limit = 50, before } = req.query;

    let query = supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('user_id', req.user.id)
      .eq('advisor_id', advisorId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (before) query = query.lt('created_at', before);

    const { data } = await query;
    reply.send({ messages: (data || []).reverse() });
  });

  // ── Clear history ────────────────────────────────────
  app.delete('/history/:advisorId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    await supabase
      .from('messages')
      .delete()
      .eq('user_id', req.user.id)
      .eq('advisor_id', req.params.advisorId);

    reply.send({ ok: true });
  });

  // ── Usage stats ──────────────────────────────────────
  app.get('/usage', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const today = new Date().toISOString().split('T')[0];

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('role', 'user')
      .gte('created_at', `${today}T00:00:00`);

    const limits = { free: 20, pro: 200, premium: 9999 };
    const tier = req.user.tier || 'free';

    reply.send({
      used: count || 0,
      limit: limits[tier],
      tier,
      remaining: Math.max(0, limits[tier] - (count || 0)),
    });
  });
}
