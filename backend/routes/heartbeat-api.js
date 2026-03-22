import { HeartbeatService } from '../services/heartbeatService.js';
import { supabase } from '../config.js';

export default async function heartbeatRoutes(app) {
  // Get heartbeat stats
  app.get('/stats', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const userId = req.user.id;
    const stats = await HeartbeatService.getUserHeartbeatStats(userId);
    reply.send(stats);
  });

  // Update heartbeat preferences
  app.patch('/preferences', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          custom_interval_minutes: { type: 'integer', minimum: 30 },
          quiet_hours_start: { type: 'string', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' },
          quiet_hours_end: { type: 'string', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' },
          timezone: { type: 'string' },
          preferred_channels: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (req, reply) => {
    const userId = req.user.id;
    const preferences = await HeartbeatService.updateUserPreferences(userId, req.body);
    reply.send({ preferences, ok: true });
  });

  // Get heartbeat configurations (for admin)
  app.get('/configs', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const { data: configs } = await supabase
      .from('heartbeat_configs')
      .select('*')
      .order('tier');

    reply.send({ configs });
  });

  // Update heartbeat configuration (for admin)
  app.patch('/configs/:tier', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          interval_minutes: { type: 'integer', minimum: 30 },
          max_daily_proactive: { type: 'integer', minimum: -1 },
          message_templates: { type: 'array' },
          enabled: { type: 'boolean' }
        }
      }
    }
  }, async (req, reply) => {
    const { tier } = req.params;
    const { data: config } = await supabase
      .from('heartbeat_configs')
      .update({
        ...req.body,
        updated_at: new Date().toISOString()
      })
      .eq('tier', tier)
      .select()
      .single();

    reply.send({ config, ok: true });
  });

  // Trigger manual heartbeat (for testing)
  app.post('/trigger/:userId', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const { userId } = req.params;
    
    // Get user with preferences
    const { data: user } = await supabase
      .from('users')
      .select(`
        *,
        souls!inner(name),
        user_heartbeat_preferences(*)
      `)
      .eq('id', userId)
      .single();

    if (!user) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }

    // Get config
    const { data: config } = await supabase
      .from('heartbeat_configs')
      .select('*')
      .eq('tier', user.tier)
      .single();

    await HeartbeatService.sendHeartbeat(user, config);
    reply.send({ ok: true, message: 'Heartbeat triggered' });
  });

  // Get heartbeat logs
  app.get('/logs', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const userId = req.user.id;
    const { limit = 50 } = req.query;

    const { data: logs } = await supabase
      .from('heartbeat_logs')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(parseInt(limit));

    reply.send({ logs });
  });
}
