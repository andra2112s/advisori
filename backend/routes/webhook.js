import { supabase } from '../server.js';

// Route ini dipanggil oleh bot saat user pertama kali chat
// Auto-register tanpa perlu email/password
export default async function webhookRoutes(app) {

  app.post('/platform-login', async (req, reply) => {
    const { platform, platformId, name } = req.body;

    if (!platform || !platformId) {
      return reply.status(400).send({ error: 'Platform dan platformId wajib' });
    }

    // Cari user existing
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('platform', platform)
      .eq('platform_id', String(platformId))
      .single();

    // Auto-register jika belum ada
    if (!user) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          email: `${platform}_${platformId}@advisori.internal`,
          name: name || `User ${platformId}`,
          platform,
          platform_id: String(platformId),
          tier: 'free',
        })
        .select()
        .single();

      user = newUser;

      // Buat soul default
      if (user) {
        await supabase.from('souls').insert({
          user_id: user.id,
          name: 'Aria',
          personality: 'warm, direct, intelligent',
          speaking_style: 'conversational bahasa Indonesia',
          values: ['kejujuran', 'kejelasan', 'kepraktisan'],
          is_setup: false,
        });
      }
    }

    if (!user) return reply.status(500).send({ error: 'Gagal membuat user' });

    const token = app.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: '90d' }
    );

    reply.send({ token, user, isNew: !user.updated_at });
  });

  // Midtrans payment webhook
  app.post('/midtrans', async (req, reply) => {
    const { order_id, transaction_status, gross_amount } = req.body;

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      // Update payment status
      await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('midtrans_order', order_id);

      // Aktifkan subscription
      const { data: payment } = await supabase
        .from('payments')
        .select('user_id, skill_id')
        .eq('midtrans_order', order_id)
        .single();

      if (payment) {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await supabase
          .from('subscriptions')
          .upsert({
            user_id: payment.user_id,
            skill_id: payment.skill_id,
            status: 'active',
            expires_at: expiresAt.toISOString(),
          });

        // Upgrade tier jika subscribe Pro skill
        await supabase
          .from('users')
          .update({ tier: 'pro' })
          .eq('id', payment.user_id);
      }
    }

    reply.send({ ok: true });
  });
}
