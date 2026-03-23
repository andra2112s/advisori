import { supabase } from '../config.js';
import { SkillRouter } from '../skills/router.js';

export default async function shopRoutes(app) {

  // ── List semua skill yang tersedia ──────────────────
  app.get('/skills', async (req, reply) => {
    // Get skills from modular folders
    const modularSkills = SkillRouter.getAllSkills();
    
    // Also get from database (for custom skills)
    const { data: dbSkills } = await supabase
      .from('skills')
      .select('*')
      .eq('status', 'active')
      .order('tier', { ascending: true });

    // Merge, preferring modular skills
    const skillsById = {};
    
    // Add modular skills first
    for (const skill of modularSkills) {
      skillsById[skill.id] = skill;
    }
    
    // Add DB skills (custom/community skills)
    for (const skill of (dbSkills || [])) {
      if (!skillsById[skill.id]) {
        skillsById[skill.id] = skill;
      }
    }

    reply.send({ skills: Object.values(skillsById) });
  });

  // ── List skill yang aktif milik user ────────────────
  app.get('/my-skills', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const userId = req.user.id;
    const userTier = req.user.tier || 'free';
    
    // Get installed skills from user_skills table
    const { data: installedSkills } = await supabase
      .from('user_skills')
      .select('*, skills(*)')
      .eq('user_id', userId);

    // Get all available skills
    const allSkills = SkillRouter.getAllSkills();
    
    // Filter by user tier (free = only free skills)
    const accessibleSkills = allSkills.filter(s => {
      if (s.tier === 'free') return true;
      if (s.tier === 'pro' && ['pro', 'expert', 'custom', 'premium'].includes(userTier)) return true;
      return false;
    });

    const installedIds = new Set((installedSkills || []).map(s => s.skill_id));
    
    // Combine: installed + default free skills
    const activeSkills = accessibleSkills.filter(s => 
      installedIds.has(s.id) || s.tier === 'free'
    );

    reply.send({ skills: activeSkills });
  });

  // ── Install skill ───────────────────────────────────
  app.post('/install/:skillId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { skillId } = req.params;
    const userTier = req.user.tier || 'free';

    const skill = SkillRouter.getSkill(skillId);
    if (!skill) return reply.status(404).send({ error: 'Skill tidak ditemukan' });

    // Check tier access
    if (skill.tier === 'pro' && !['pro', 'expert', 'custom', 'premium'].includes(userTier)) {
      return reply.status(403).send({ 
        error: 'Skill ini membutuhkan subscription Pro',
        requiredTier: 'pro',
      });
    }

    // Install skill
    const { error } = await supabase
      .from('user_skills')
      .upsert({
        user_id: req.user.id,
        skill_id: skillId,
        installed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[Shop] Install error:', error);
      return reply.status(500).send({ error: 'Gagal install skill' });
    }

    reply.send({ ok: true, message: 'Skill berhasil diinstall' });
  });

  // ── Uninstall skill ──────────────────────────────────
  app.delete('/uninstall/:skillId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { skillId } = req.params;
    const skill = SkillRouter.getSkill(skillId);

    // Can't uninstall free skills
    if (skill?.tier === 'free') {
      return reply.status(400).send({ error: 'Skill gratis tidak bisa di-uninstall' });
    }

    await supabase
      .from('user_skills')
      .delete()
      .eq('user_id', req.user.id)
      .eq('skill_id', skillId);

    reply.send({ ok: true });
  });

  // ── Legacy: Aktifkan skill (buat subscription) ─────
  app.post('/activate/:skillId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { skillId } = req.params;

    const skill = SkillRouter.getSkill(skillId);
    if (!skill) return reply.status(404).send({ error: 'Skill tidak ditemukan' });

    // Skill gratis langsung aktif
    if (skill.tier === 'free') {
      await supabase.from('user_skills').upsert({
        user_id: req.user.id,
        skill_id: skillId,
        installed_at: new Date().toISOString(),
      });
      return reply.send({ ok: true, message: 'Skill berhasil diaktifkan' });
    }

    // Skill berbayar → butuh upgrade
    reply.send({
      ok: false,
      requiresUpgrade: true,
      tier: skill.tier,
      message: `Skill ini membutuhkan subscription ${skill.tier}`,
    });
  });

  // ── Nonaktifkan skill (legacy) ─────────────────────
  app.delete('/deactivate/:skillId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { skillId } = req.params;

    await supabase
      .from('user_skills')
      .delete()
      .eq('user_id', req.user.id)
      .eq('skill_id', skillId);

    reply.send({ ok: true });
  });
}