import { supabase } from '../config.js';

export default async function channelsRoutes(app) {
  // Get user's channel connections
  app.get('/connections', {
    // preHandler: [app.authenticate], // Temporarily disabled for testing
  }, async (req, reply) => {
    // Use hardcoded user ID for testing (replace with actual user ID from your database)
    const testUserId = req.user?.id || '5d3b8c9e-7756-498b-a14c-26c87d4ad7e0'; // test4@example.com's ID
    
    const { data, error } = await supabase
      .from('channel_connections')
      .select('*')
      .eq('user_id', testUserId);

    if (error) {
      return reply.code(500).send({ error: error.message });
    }

    reply.send({ connections: data || [] });
  });

  // Generate WhatsApp QR code
  app.post('/whatsapp/qr', {
    // preHandler: [app.authenticate], // Temporarily disabled for testing
  }, async (req, reply) => {
    try {
      const testUserId = req.user?.id || '5d3b8c9e-7756-498b-a14c-26c87d4ad7e0';
      const whatsappChannel = app.channels.get('whatsapp');
      const qr = await whatsappChannel.generateQR(testUserId);
      reply.send({ qr });
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Connect WhatsApp
  app.post('/whatsapp/connect', {
    // preHandler: [app.authenticate], // Temporarily disabled for testing
  }, async (req, reply) => {
    try {
      const testUserId = req.user?.id || '5d3b8c9e-7756-498b-a14c-26c87d4ad7e0';
      const whatsappChannel = app.channels.get('whatsapp');
      const result = await whatsappChannel.connectUser(testUserId);
      reply.send(result);
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Disconnect WhatsApp
  app.post('/whatsapp/disconnect', {
    // preHandler: [app.authenticate], // Temporarily disabled for testing
  }, async (req, reply) => {
    try {
      const testUserId = req.user?.id || '5d3b8c9e-7756-498b-a14c-26c87d4ad7e0';
      const whatsappChannel = app.channels.get('whatsapp');
      await whatsappChannel.disconnect(testUserId);
      reply.send({ success: true });
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Connect Telegram
  app.post('/telegram/connect', {
    // preHandler: [app.authenticate], // Temporarily disabled for testing
  }, async (req, reply) => {
    try {
      const testUserId = req.user?.id || '5d3b8c9e-7756-498b-a14c-26c87d4ad7e0';
      const { botToken } = req.body;
      if (!botToken) {
        return reply.code(400).send({ error: 'Bot token required' });
      }

      const telegramChannel = app.channels.get('telegram');
      const result = await telegramChannel.connectUser(testUserId, botToken);
      reply.send(result);
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Disconnect Telegram
  app.post('/telegram/disconnect', {
    // preHandler: [app.authenticate], // Temporarily disabled for testing
  }, async (req, reply) => {
    try {
      const testUserId = req.user?.id || '5d3b8c9e-7756-498b-a14c-26c87d4ad7e0';
      const telegramChannel = app.channels.get('telegram');
      await telegramChannel.disconnect(testUserId);
      reply.send({ success: true });
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Connect Discord
  app.post('/discord/connect', {
    // preHandler: [app.authenticate], // Temporarily disabled for testing
  }, async (req, reply) => {
    try {
      const testUserId = req.user?.id || '5d3b8c9e-7756-498b-a14c-26c87d4ad7e0';
      const { botToken } = req.body;
      if (!botToken) {
        return reply.code(400).send({ error: 'Bot token required' });
      }

      const discordChannel = app.channels.get('discord');
      const result = await discordChannel.connectUser(testUserId, botToken);
      reply.send(result);
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Disconnect Discord
  app.post('/discord/disconnect', {
    // preHandler: [app.authenticate], // Temporarily disabled for testing
  }, async (req, reply) => {
    try {
      const testUserId = req.user?.id || '5d3b8c9e-7756-498b-a14c-26c87d4ad7e0';
      const discordChannel = app.channels.get('discord');
      await discordChannel.disconnect(testUserId);
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
