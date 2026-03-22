import { supabase } from '../config.js';

export default async function shopRoutes(app) {

  // ── List semua skill yang tersedia ──────────────────
  app.get('/skills', async (req, reply) => {
    const { data: skills } = await supabase
      .from('skills')
      .select('*')
      .eq('status', 'active')
      .order('tier', { ascending: true });

    reply.send({ skills: skills || [] });
  });

  // ── List skill yang aktif milik user ────────────────
  app.get('/my-skills', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('*, skills(*)')
      .eq('user_id', req.user.id)
      .eq('status', 'active');

    // Skill gratis selalu aktif
    const { data: freeSkills } = await supabase
      .from('skills')
      .select('*')
      .eq('tier', 'free')
      .eq('status', 'active');

    const paidSkills = (subs || []).map(s => s.skills);
    const allActive = [...(freeSkills || []), ...paidSkills];

    reply.send({ skills: allActive });
  });

  // ── Aktifkan skill (buat subscription) ─────────────
  app.post('/activate/:skillId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { skillId } = req.params;

    const { data: skill } = await supabase
      .from('skills')
      .select('*')
      .eq('id', skillId)
      .single();

    if (!skill) return reply.status(404).send({ error: 'Skill tidak ditemukan' });

    // Skill gratis langsung aktif tanpa payment
    if (skill.tier === 'free' || skill.price === 0) {
      await supabase.from('subscriptions').upsert({
        user_id: req.user.id,
        skill_id: skillId,
        status: 'active',
        started_at: new Date().toISOString(),
      });
      return reply.send({ ok: true, message: 'Skill berhasil diaktifkan' });
    }

    // Skill berbayar → buat payment request
    // (integrasi Midtrans bisa ditambahkan di sini)
    reply.send({
      ok: false,
      requiresPayment: true,
      price: skill.price,
      message: 'Skill ini membutuhkan subscription Pro',
    });
  });

  // ── Nonaktifkan skill ───────────────────────────────
  app.delete('/deactivate/:skillId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', req.user.id)
      .eq('skill_id', req.params.skillId);

    reply.send({ ok: true });
  });
}