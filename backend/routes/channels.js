import { supabase } from '../config.js';

export default async function channelsRoutes(app) {
  // Get user's channel connections
  app.get('/connections', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { data, error } = await supabase
      .from('channel_connections')
      .select('*')
      .eq('user_id', req.user.id);

    if (error) {
      return reply.code(500).send({ error: error.message });
    }

    reply.send({ connections: data || [] });
  });

  // Generate WhatsApp QR code
  app.post('/whatsapp/qr', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const whatsappChannel = app.channels.get('whatsapp');
      const qr = await whatsappChannel.generateQR(req.user.id);
      reply.send({ qr });
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Connect WhatsApp
  app.post('/whatsapp/connect', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const whatsappChannel = app.channels.get('whatsapp');
      const result = await whatsappChannel.connectUser(req.user.id);
      reply.send(result);
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Disconnect WhatsApp
  app.post('/whatsapp/disconnect', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const whatsappChannel = app.channels.get('whatsapp');
      await whatsappChannel.disconnect(req.user.id);
      reply.send({ success: true });
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Connect Telegram
  app.post('/telegram/connect', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { botToken } = req.body;
      if (!botToken) {
        return reply.code(400).send({ error: 'Bot token required' });
      }

      const telegramChannel = app.channels.get('telegram');
      const result = await telegramChannel.connectUser(req.user.id, botToken);
      reply.send(result);
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Disconnect Telegram
  app.post('/telegram/disconnect', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const telegramChannel = app.channels.get('telegram');
      await telegramChannel.disconnect(req.user.id);
      reply.send({ success: true });
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Connect Discord
  app.post('/discord/connect', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { botToken } = req.body;
      if (!botToken) {
        return reply.code(400).send({ error: 'Bot token required' });
      }

      const discordChannel = app.channels.get('discord');
      const result = await discordChannel.connectUser(req.user.id, botToken);
      reply.send(result);
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Disconnect Discord
  app.post('/discord/disconnect', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const discordChannel = app.channels.get('discord');
      await discordChannel.disconnect(req.user.id);
      reply.send({ success: true });
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get channel sessions
  app.get('/sessions', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { channel } = req.query;
    
    let query = supabase
      .from('channel_sessions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('last_message_at', { ascending: false });

    if (channel) {
      query = query.eq('channel', channel);
    }

    const { data, error } = await query;

    if (error) {
      return reply.code(500).send({ error: error.message });
    }

    reply.send({ sessions: data || [] });
  });

  // Get session messages
  app.get('/sessions/:sessionId/messages', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { sessionId } = req.params;
    const { limit = 50 } = req.query;

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('channel_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', req.user.id)
      .single();

    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const { data: messages, error } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(parseInt(limit));

    if (error) {
      return reply.code(500).send({ error: error.message });
    }

    reply.send({ messages: messages || [] });
  });
}
