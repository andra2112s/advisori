import { supabase } from '../config.js';

export default async function notesRoutes(app) {

  // ── List user's notes ───────────────────────────────
  app.get('/notes', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { tag, starred, limit = 50 } = req.query;
    
    let query = supabase
      .from('notes')
      .select('id, title, content, source_type, tags, is_starred, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false })
      .limit(parseInt(limit));

    if (tag) {
      query = query.contains('tags', [tag]);
    }
    if (starred === 'true') {
      query = query.eq('is_starred', true);
    }

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ notes: data || [] });
  });

  // ── Get single note ───────────────────────────────
  app.get('/notes/:id', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Note not found' });
    reply.send({ note: data });
  });

  // ── Create note ──────────────────────────────────
  app.post('/notes', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { title, content, source_type = 'manual', source_url, tags } = req.body;

    if (!title?.trim()) {
      return reply.status(400).send({ error: 'Title is required' });
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: req.user.id,
        title: title.trim(),
        content: content || '',
        source_type,
        source_url,
        tags: tags || [],
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ note: data });
  });

  // ── Update note ──────────────────────────────────
  app.put('/notes/:id', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { title, content, tags, is_starred } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (tags !== undefined) updates.tags = tags;
    if (is_starred !== undefined) updates.is_starred = is_starred;

    const { data, error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ note: data });
  });

  // ── Delete note ──────────────────────────────────
  app.delete('/notes/:id', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    await supabase
      .from('notes')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    reply.send({ ok: true });
  });

  // ── Generate flashcards from note ───────────────
  app.post('/notes/:id/generate-flashcards', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { count = 5 } = req.body;

    const { data: note, error } = await supabase
      .from('notes')
      .select('content')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !note) return reply.status(404).send({ error: 'Note not found' });

    if (!note.content || note.content.length < 50) {
      return reply.status(400).send({ error: 'Note content too short for flashcard generation' });
    }

    reply.send({ 
      message: 'Flashcard generation would call AI here with note content',
      flashcard_count: count,
    });
  });

  // ── Generate quiz from note ─────────────────────
  app.post('/notes/:id/generate-quiz', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { type = 'multiple_choice', count = 5 } = req.body;

    const { data: note, error } = await supabase
      .from('notes')
      .select('content')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !note) return reply.status(404).send({ error: 'Note not found' });

    reply.send({ 
      message: 'Quiz generation would call AI here',
      quiz_type: type,
      question_count: count,
    });
  });

  // ── Flashcards CRUD ─────────────────────────────
  app.get('/flashcards', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { note_id, limit = 100 } = req.query;
    
    let query = supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (note_id) query = query.eq('note_id', note_id);

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ flashcards: data || [] });
  });

  // ── Quizzes CRUD ────────────────────────────────
  app.get('/quizzes', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { note_id, limit = 50 } = req.query;
    
    let query = supabase
      .from('quizzes')
      .select('id, note_id, title, score, completed_at, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (note_id) query = query.eq('note_id', note_id);

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ quizzes: data || [] });
  });
}
