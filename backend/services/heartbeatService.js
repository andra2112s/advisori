import { supabase } from '../config.js';

export class HeartbeatService {
  // Initialize heartbeat for a specific user
  static async initializeForUser(userId) {
    // Check if user has heartbeat enabled
    const { data: prefs } = await supabase
      .from('user_heartbeat_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!prefs?.enabled) return;

    // Get user's heartbeat config based on tier
    const { data: user } = await supabase
      .from('users')
      .select('tier')
      .eq('id', userId)
      .single();

    const { data: config } = await supabase
      .from('heartbeat_configs')
      .select('*')
      .eq('tier', user.tier)
      .single();

    if (!config?.enabled) return;

    // Return user's heartbeat configuration
    return { prefs, config };
  }

  // Check if user should receive heartbeat now
  static async shouldSendHeartbeat(userId) {
    const { data: prefs } = await supabase
      .from('user_heartbeat_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!prefs?.enabled) return false;

    // Check quiet hours
    if (this.isQuietHours(prefs)) return false;

    // Check daily limit
    if (prefs.daily_count >= 0 && prefs.max_daily_proactive > 0) {
      const { data: config } = await supabase
        .from('heartbeat_configs')
        .select('max_daily_proactive')
        .eq('tier', prefs.tier)
        .single();

      if (config?.max_daily_proactive > 0 && prefs.daily_count >= config.max_daily_proactive) {
        return false;
      }
    }

    // Check if enough time has passed
    const interval = prefs.custom_interval_minutes || 1440; // Default 24 hours
    if (prefs.last_heartbeat_at) {
      const timeSince = new Date() - new Date(prefs.last_heartbeat_at);
      const minutesSince = timeSince / (1000 * 60);
      if (minutesSince < interval) return false;
    }

    return true;
  }

  // Send heartbeat to user
  static async sendHeartbeat(userId, platform = 'web') {
    if (!(await this.shouldSendHeartbeat(userId))) return false;

    // Get user and soul data
    const { data: user } = await supabase
      .from('users')
      .select(`
        *,
        souls!inner(name, personality, speaking_style),
        user_heartbeat_preferences(*)
      `)
      .eq('id', userId)
      .single();

    if (!user || !user.souls?.is_setup) return false;

    // Get heartbeat config
    const { data: config } = await supabase
      .from('heartbeat_configs')
      .select('*')
      .eq('tier', user.tier)
      .single();

    if (!config?.enabled) return false;

    // Select and personalize message
    const templates = config.message_templates || [];
    const template = templates[Math.floor(Math.random() * templates.length)];
    const message = this.personalizeMessage(template, user);

    // Log the heartbeat
    await supabase
      .from('heartbeat_logs')
      .insert({
        user_id: userId,
        message,
        channel: platform,
        sent_at: new Date().toISOString()
      });

    // Update user preferences
    await supabase
      .from('user_heartbeat_preferences')
      .update({
        last_heartbeat_at: new Date().toISOString(),
        daily_count: user.user_heartbeat_preferences?.daily_count + 1 || 1
      })
      .eq('user_id', userId);

    // Store as notification for web
    if (platform === 'web') {
      await this.storeWebNotification(userId, message);
    }

    console.log(`💓 Heartbeat sent to ${user.souls.name} (${user.email}): ${message}`);
    return true;
  }

  // Personalize message with user data
  static personalizeMessage(template, user) {
    const soulName = user.souls?.name || 'User';
    const timeOfDay = this.getTimeOfDay();
    
    return template
      .replace(/{{soul_name}}/g, soulName)
      .replace(/{{time_of_day}}/g, timeOfDay)
      .replace(/{{user_preference}}/g, 'preferensi kamu')
      .replace(/{{last_topic}}/g, 'topik terakhir')
      .replace(/{{recent_memory}}/g, 'kenangan terakhir')
      .replace(/{{weather}}/g, 'cerah')
      .replace(/{{weather_advice}}/g, 'pakai sunscreen ya')
      .replace(/{{compliment}}/g, 'orang yang luar biasa');
  }

  static getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 10) return 'pagi';
    if (hour < 15) return 'siang';
    if (hour < 18) return 'sore';
    return 'malam';
  }

  static isQuietHours(prefs) {
    if (!prefs.quiet_hours_start || !prefs.quiet_hours_end) return false;
    
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    
    return currentTime >= prefs.quiet_hours_start || currentTime <= prefs.quiet_hours_end;
  }

  static async storeWebNotification(userId, message) {
    // Store in notifications table
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        message,
        type: 'heartbeat',
        read: false,
        created_at: new Date().toISOString()
      });
  }

  // Update user preferences
  static async updateUserPreferences(userId, preferences) {
    const { data, error } = await supabase
      .from('user_heartbeat_preferences')
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get user heartbeat stats
  static async getUserHeartbeatStats(userId) {
    const { data: logs } = await supabase
      .from('heartbeat_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('sent_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .order('sent_at', { ascending: false });

    const { data: prefs } = await supabase
      .from('user_heartbeat_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    return {
      last_heartbeat: prefs?.last_heartbeat_at,
      daily_count: prefs?.daily_count || 0,
      monthly_total: logs?.length || 0,
      response_rate: logs?.filter(l => l.responded).length / (logs?.length || 1)
    };
  }

  // Reset daily counts (called by cron job once per day)
  static async resetDailyCounts() {
    await supabase
      .from('user_heartbeat_preferences')
      .update({
        daily_count: 0,
        reset_date: new Date().toISOString().split('T')[0]
      })
      .neq('daily_count', 0);
  }
}
