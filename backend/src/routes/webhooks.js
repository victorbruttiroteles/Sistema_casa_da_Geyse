const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { sendWhatsAppMessage } = require('../services/whatsapp');

// POST /api/webhooks/pix - Webhook Efí Bank
router.post('/pix', async (req, res, next) => {
  try {
    // Validar webhook secret
    const webhookSecret = req.headers['x-webhook-secret'] || req.query.secret;
    if (webhookSecret !== process.env.EFI_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Webhook inválido' });
    }

    const { pix } = req.body;
    if (!pix || !Array.isArray(pix)) return res.status(200).json({ ok: true });

    for (const pixEvent of pix) {
      const { txid, e2eId, valor, horario } = pixEvent;
      if (!txid) continue;

      const paymentRes = await db.query(
        "SELECT * FROM payments WHERE pix_txid = $1 AND status = 'pending'",
        [txid]
      );
      if (!paymentRes.rows[0]) continue;

      const payment = paymentRes.rows[0];

      // Confirmar pagamento
      await db.query(`
        UPDATE payments SET status = 'confirmed', pix_e2e_id = $1, confirmed_at = NOW(),
          split_platform = $2, split_house = $3, split_companions = $4, updated_at = NOW()
        WHERE id = $5
      `, [
        e2eId,
        (payment.amount * parseFloat(process.env.SPLIT_PLATFORM_PERCENT || 20) / 100).toFixed(2),
        (payment.amount * parseFloat(process.env.SPLIT_HOUSE_PERCENT || 60) / 100).toFixed(2),
        (payment.amount * parseFloat(process.env.SPLIT_COMPANION_PERCENT || 20) / 100).toFixed(2),
        payment.id,
      ]);

      // Ativar reserva
      const reservation = await db.query(`
        UPDATE reservations SET status = 'confirmed', updated_at = NOW()
        WHERE id = $1 AND status = 'pending' RETURNING *
      `, [payment.reservation_id]);

      if (!reservation.rows[0]) continue;
      const res_ = reservation.rows[0];

      // Atualizar status do quarto
      await db.query("UPDATE rooms SET status = 'occupied' WHERE id = $1", [res_.room_id]);

      // Buscar dados do cliente e casa
      const customer = await db.query('SELECT * FROM customers WHERE id = $1', [res_.customer_id]);
      const house = await db.query('SELECT * FROM houses WHERE id = $1', [res_.house_id]);

      // Atualizar CRM do cliente
      await db.query(`
        UPDATE customers SET
          total_spent = total_spent + $1,
          total_reservations = total_reservations + 1,
          last_reservation_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [payment.amount, res_.customer_id]);

      // Adicionar pontos de fidelidade (10 pontos por R$100)
      const pointsEarned = Math.floor(payment.amount / 100) * 10;
      if (pointsEarned > 0) {
        await db.query(
          'UPDATE customers SET loyalty_points = loyalty_points + $1, updated_at = NOW() WHERE id = $2',
          [pointsEarned, res_.customer_id]
        );
        await db.query(
          "INSERT INTO loyalty_transactions (customer_id, points, type, description, reservation_id) VALUES ($1,$2,'earned',$3,$4)",
          [res_.customer_id, pointsEarned, `Reserva confirmada - R$${payment.amount}`, res_.id]
        );
      }

      // Verificar status VIP
      const custData = customer.rows[0];
      const vipThreshold = parseInt(process.env.VIP_MIN_RESERVATIONS || 10);
      if (custData.total_reservations + 1 >= vipThreshold && custData.status === 'active') {
        await db.query("UPDATE customers SET status = 'vip', updated_at = NOW() WHERE id = $1", [res_.customer_id]);
      }

      // Enviar confirmação via WhatsApp
      if (customer.rows[0]?.whatsapp) {
        const checkIn = new Date(res_.check_in).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const checkOut = new Date(res_.check_out).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const msg = `✅ *Reserva Confirmada!*\n\n` +
          `🏠 *Local:* ${house.rows[0]?.name}\n` +
          `📍 *Endereço:* ${house.rows[0]?.address}\n` +
          `⏰ *Entrada:* ${checkIn}\n` +
          `⏰ *Saída:* ${checkOut}\n` +
          `🔑 *Código de acesso:* ${res_.access_code}\n\n` +
          `${house.rows[0]?.access_instructions || ''}\n\n` +
          `${pointsEarned > 0 ? `🎯 Você ganhou *${pointsEarned} pontos* de fidelidade!\n\n` : ''}` +
          `Aproveite! 🌹`;

        await sendWhatsAppMessage(customer.rows[0].whatsapp, msg);
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook Pix error:', err);
    res.status(200).json({ ok: true }); // Sempre retornar 200 para o gateway
  }
});

// POST /api/webhooks/whatsapp - Webhook Evolution API
router.post('/whatsapp', async (req, res, next) => {
  try {
    const { botService } = require('../services/botService');
    await botService(req.body);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook WhatsApp error:', err);
    res.status(200).json({ ok: true });
  }
});

module.exports = router;
