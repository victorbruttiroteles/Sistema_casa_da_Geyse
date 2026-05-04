const cron = require('node-cron');
const db = require('../config/database');
const { sendWhatsAppMessage } = require('./whatsapp');

function startScheduledJobs() {
  // Verificar reservas próximas do término (a cada minuto)
  cron.schedule('* * * * *', async () => {
    try {
      const alertMinutes = parseInt(process.env.RENEWAL_ALERT_MINUTES || 15);
      const targetTime = new Date(Date.now() + alertMinutes * 60 * 1000);

      const { rows } = await db.query(`
        SELECT r.*, c.whatsapp, ro.name as room_name, h.name as house_name
        FROM reservations r
        JOIN customers c ON c.id = r.customer_id
        JOIN rooms ro ON ro.id = r.room_id
        JOIN houses h ON h.id = r.house_id
        WHERE r.status = 'confirmed'
          AND r.check_out BETWEEN NOW() AND $1
          AND NOT EXISTS (
            SELECT 1 FROM payments p
            WHERE p.reservation_id = r.id AND p.type = 'renewal' AND p.status IN ('pending','confirmed')
          )
      `, [targetTime.toISOString()]);

      for (const res of rows) {
        const checkOut = new Date(res.check_out).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const msg = `⏰ *Sua reserva termina em ${alertMinutes} minutos!*\n\n` +
          `🛏️ ${res.room_name} - ${res.house_name}\n` +
          `⏰ Saída: ${checkOut}\n\n` +
          `Deseja renovar?\n` +
          `*1* - 1 hora\n*2* - 2 horas\n*3* - 4 horas\n*4* - 8 horas\n*5* - Diária\n*0* - Não, obrigado`;

        await sendWhatsAppMessage(res.whatsapp, msg);

        // Salvar estado no Redis para continuar o fluxo
        const { getRedisClient } = require('../config/redis');
        const redis = await getRedisClient();
        await redis.setEx(
          `bot:renewal:${res.whatsapp}`,
          3600,
          JSON.stringify({ reservationId: res.id, step: 'renewal_duration' })
        );
      }
    } catch (err) {
      console.error('Renewal scheduler error:', err);
    }
  });

  // Completar reservas expiradas (a cada 5 minutos)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { rows } = await db.query(`
        UPDATE reservations SET status = 'completed', updated_at = NOW()
        WHERE status = 'confirmed' AND check_out < NOW()
        RETURNING id, room_id
      `);
      for (const res of rows) {
        await db.query("UPDATE rooms SET status = 'available' WHERE id = $1", [res.room_id]);
      }

      // Expirar pagamentos Pix
      await db.query(`
        UPDATE payments SET status = 'expired', updated_at = NOW()
        WHERE status = 'pending' AND pix_expiry < NOW()
      `);
    } catch (err) {
      console.error('Expiry scheduler error:', err);
    }
  });

  // NPS pós-reserva (a cada 15 minutos)
  cron.schedule('*/15 * * * *', async () => {
    try {
      const npsDelay = parseInt(process.env.NPS_DELAY_MINUTES || 60);
      const cutoff = new Date(Date.now() - npsDelay * 60 * 1000);

      const { rows } = await db.query(`
        SELECT r.*, c.whatsapp, c.name as customer_name
        FROM reservations r
        JOIN customers c ON c.id = r.customer_id
        WHERE r.status = 'completed'
          AND r.updated_at < $1
          AND NOT EXISTS (SELECT 1 FROM nps_ratings n WHERE n.reservation_id = r.id)
      `, [cutoff.toISOString()]);

      for (const res of rows) {
        const msg = `⭐ *Como foi sua experiência na Casa da Geyse?*\n\n` +
          `De 0 a 10, qual nota você daria?\n\n` +
          `_Digite apenas o número (0-10)_`;
        await sendWhatsAppMessage(res.whatsapp, msg);

        const { getRedisClient } = require('../config/redis');
        const redis = await getRedisClient();
        await redis.setEx(`bot:nps:${res.whatsapp}`, 86400, JSON.stringify({ reservationId: res.id, step: 'nps_score' }));
      }
    } catch (err) {
      console.error('NPS scheduler error:', err);
    }
  });

  // Relatório diário às 08h00
  cron.schedule('0 8 * * *', async () => {
    try {
      const adminWhatsApp = process.env.ADMIN_WHATSAPP;
      if (!adminWhatsApp) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { rows: [stats] } = await db.query(`
        SELECT
          COUNT(r.id) FILTER (WHERE r.created_at >= $1) as reservations_today,
          COALESCE(SUM(p.amount) FILTER (WHERE p.confirmed_at >= $1), 0) as revenue_today,
          COUNT(DISTINCT r.customer_id) FILTER (WHERE r.created_at >= $1) as unique_customers_today,
          COUNT(r.id) FILTER (WHERE r.status = 'confirmed') as active_now
        FROM reservations r
        LEFT JOIN payments p ON p.reservation_id = r.id AND p.status = 'confirmed'
      `, [today.toISOString()]);

      const msg = `📊 *Relatório Diário - Casa da Geyse*\n` +
        `📅 ${today.toLocaleDateString('pt-BR')}\n\n` +
        `🏨 Reservas hoje: ${stats.reservations_today}\n` +
        `💰 Receita hoje: R$${parseFloat(stats.revenue_today).toFixed(2)}\n` +
        `👥 Clientes únicos: ${stats.unique_customers_today}\n` +
        `🟢 Ativas agora: ${stats.active_now}\n\n` +
        `_Acesse o painel admin para mais detalhes._`;

      await sendWhatsAppMessage(adminWhatsApp, msg);
    } catch (err) {
      console.error('Daily report error:', err);
    }
  });

  // Reativação de clientes inativos (diário à meia-noite)
  cron.schedule('0 0 * * *', async () => {
    try {
      const reactivationDays = parseInt(process.env.REACTIVATION_DAYS || 15);
      const cutoff = new Date(Date.now() - reactivationDays * 24 * 60 * 60 * 1000);

      const { rows } = await db.query(`
        SELECT * FROM customers
        WHERE status = 'active'
          AND last_reservation_at < $1
          AND age_confirmed = true
        LIMIT 50
      `, [cutoff.toISOString()]);

      for (const customer of rows) {
        const msg = `Olá! 🌹 Sentimos sua falta na Casa da Geyse!\n\n` +
          `Faz alguns dias que você não nos visita. Que tal reservar um momento especial?\n\n` +
          `💫 Reserve agora e aproveite nossos quartos com conforto e privacidade.\n\n` +
          `Digite *OI* para começar sua reserva!`;
        await sendWhatsAppMessage(customer.whatsapp, msg);
      }
    } catch (err) {
      console.error('Reactivation scheduler error:', err);
    }
  });

  console.log('Scheduled jobs started.');
}

module.exports = { startScheduledJobs };
