import { chat } from '../services/ai.js';
import { supabase } from '../config.js';
import { HeartbeatService } from '../services/heartbeatService.js';

export default async function chatRoutes(app) {

  // ── Streaming chat (web) ─────────────────────────────
  app.options('/stream', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:3000');
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control');
    reply.code(200).send();
  });

  app.post('/stream', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { message, advisorId } = req.body;
    if (!message?.trim()) {
      return reply.status(400).send({ error: 'Message kosong' });
    }

    // Manual CORS headers for streaming
    reply.raw.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:3000');
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control');

    // SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    try {
      const { stream, activeSkill, content } = await chat({
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

      let fullContent = '';
      
      // Check if we have a stream (Claude) or content (Z.ai)
      if (stream) {
        // Claude streaming - iterate through chunks
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text;
            fullContent += text;
            reply.raw.write(`data: ${JSON.stringify({ type: 'token', text })}\n\n`);
          }
        }
      } else if (content) {
        // Z.ai non-streaming - send content in chunks
        const chars = content.split('');
        for (const char of chars) {
          fullContent += char;
          reply.raw.write(`data: ${JSON.stringify({ type: 'token', text: char })}\n\n`);
          // Small delay for effect
          await new Promise(r => setTimeout(r, 5));
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

      // Check if user should receive heartbeat (after chat)
      setTimeout(async () => {
        try {
          await HeartbeatService.sendHeartbeat(req.user.id, 'web');
        } catch (err) {
          console.log('Heartbeat check failed:', err.message);
        }
      }, 5000);

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
