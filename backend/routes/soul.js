import { supabase } from '../config.js';

export default async function soulRoutes(app) {

  // ── Get soul user ────────────────────────────────────
  app.get('/', {
    // preHandler: [app.authenticate], // Temporarily disabled for testing
  }, async (req, reply) => {
    // Use test user ID if no authenticated user
    const testUserId = req.user?.id || '5d3b8c9e-7756-498b-a14c-26c87d4ad7e0'; // test4@example.com's ID
    
    const { data: soul } = await supabase
      .from('souls')
      .select('*')
      .eq('user_id', testUserId)
      .single();

    app.log.info(`Getting soul for user ${testUserId}:`, soul ? 'found' : 'not found');
    if (soul) app.log.info(`Soul setup status: ${soul.is_setup}, name: ${soul.name}`);

    reply.send({ soul: soul || null });
  });

  // ── Setup / update soul ──────────────────────────────
  // Ini dipanggil saat user onboarding pertama kali
  // atau saat edit kepribadian AI Personal
  app.post('/setup', {
    // preHandler: [app.authenticate], // Temporarily disabled for testing
    schema: {
      body: {
        type: 'object',
        required: ['name', 'personality', 'speakingStyle'],
        properties: {
          name:         { type: 'string', minLength: 1, maxLength: 50 },
          personality:  { type: 'string', minLength: 1, maxLength: 500 },
          speakingStyle:{ type: 'string', minLength: 1, maxLength: 200 },
          backstory:    { type: 'string', maxLength: 1000 },
          values:       { type: 'array', items: { type: 'string' }, maxItems: 10 },
          quirks:       { type: 'array', items: { type: 'string' }, maxItems: 10 },
          avatar:       { type: 'string', maxLength: 200 },
          language:     { type: 'string', enum: ['id', 'en', 'mix'] },
          // aiProvider:   { type: 'string', enum: ['claude', 'zai'], default: 'claude' }, // Column doesn't exist
        }
      }
    }
  }, async (req, reply) => {
    const {
      name, personality, speakingStyle,
      backstory, values, quirks, avatar, language, aiProvider
    } = req.body;

    // Use test user ID if no authenticated user
    const testUserId = req.user?.id || '5d3b8c9e-7756-498b-a14c-26c87d4ad7e0'; // test4@example.com's ID
    
    const { data: existing } = await supabase
      .from('souls')
      .select('id')
      .eq('user_id', testUserId)
      .single();

    const soulData = {
      user_id: testUserId,
      name,
      personality,
      speaking_style: speakingStyle,
      backstory: backstory || null,
      values: values || [],
      quirks: quirks || [],
      avatar: avatar || '✦',
      language: language || 'id',
      // ai_provider: aiProvider || 'claude', // Column doesn't exist
      is_setup: true,
      updated_at: new Date().toISOString(),
    };

    let soul;
    let error;
    
    if (existing) {
      const { data, error: updateError } = await supabase
        .from('souls')
        .update(soulData)
        .eq('user_id', testUserId)
        .select()
        .single();
      soul = data;
      error = updateError;
    } else {
      const { data, error: insertError } = await supabase
        .from('souls')
        .insert({ ...soulData, created_at: new Date().toISOString() })
        .select()
        .single();
      soul = data;
      error = insertError;
    }

    if (error) {
      app.log.error('Soul setup error:', error);
      return reply.code(500).send({ error: error.message });
    }
    
    if (!soul) {
      app.log.error('Soul is null after operation');
      return reply.code(500).send({ error: 'Failed to save soul data' });
    }

    reply.send({ 
      soul: {
        ...soul,
        is_setup: soul.is_setup || true
      }, 
      ok: true 
    });
  });

  // ── Update memory (dipanggil otomatis oleh AI) ────────
  app.patch('/memory', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { episodic, semantic, preferences } = req.body;

    const { data: soul } = await supabase
      .from('souls')
      .select('memory')
      .eq('user_id', req.user.id)
      .single();

    const memory = soul?.memory || { episodic: [], semantic: {}, preferences: {} };

    if (episodic?.length) {
      memory.episodic = [...(memory.episodic || []), ...episodic].slice(-100);
    }
    if (semantic) Object.assign(memory.semantic, semantic);
    if (preferences) Object.assign(memory.preferences, preferences);

    await supabase
      .from('souls')
      .update({ memory, updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id);

    reply.send({ ok: true });
  });

  // ── Reset soul ke default ────────────────────────────
  app.post('/reset', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    await supabase
      .from('souls')
      .update({
        name: 'Aria',
        personality: 'warm, direct, intelligent',
        speaking_style: 'conversational bahasa Indonesia',
        backstory: null,
        values: ['kejujuran', 'kejelasan', 'kepraktisan'],
        quirks: [],
        avatar: '✦',
        memory: { episodic: [], semantic: {}, preferences: {} },
        is_setup: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', req.user.id);

    reply.send({ ok: true });
  });
}
