const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middlewares/auth');
const { createPixCharge } = require('../services/pix');
const { generateAccessCode } = require('../utils/helpers');

const DURATION_MAP = { '1h': 1, '2h': 2, '4h': 4, '8h': 8, 'daily': 24 };

// GET /api/reservations?house_id=&date=&status=
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { house_id, date, status, customer_id } = req.query;
    const params = [];
    const conditions = [];

    if (req.user.role === 'house_manager' || req.user.role === 'receptionist') {
      params.push(req.user.house_id);
      conditions.push(`r.house_id = $${params.length}`);
    } else if (house_id) {
      params.push(house_id);
      conditions.push(`r.house_id = $${params.length}`);
    }

    if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }
    if (customer_id) { params.push(customer_id); conditions.push(`r.customer_id = $${params.length}`); }
    if (date) {
      params.push(date);
      conditions.push(`r.check_in::date = $${params.length}::date`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(`
      SELECT r.*,
        cu.whatsapp as customer_whatsapp, cu.name as customer_name,
        ro.name as room_name, h.name as house_name, ci.name as city_name,
        (SELECT json_agg(json_build_object('id', co.id, 'name', co.artistic_name, 'price', rc.total_price))
         FROM reservation_companions rc JOIN companions co ON co.id = rc.companion_id
         WHERE rc.reservation_id = r.id) as companions
      FROM reservations r
      JOIN customers cu ON cu.id = r.customer_id
      JOIN rooms ro ON ro.id = r.room_id
      JOIN houses h ON h.id = r.house_id
      JOIN cities ci ON ci.id = h.city_id
      ${where}
      ORDER BY r.check_in DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/reservations/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*,
        cu.whatsapp as customer_whatsapp, cu.name as customer_name, cu.status as customer_status,
        ro.name as room_name, ro.amenities,
        h.name as house_name, h.address, h.access_instructions,
        ci.name as city_name
      FROM reservations r
      JOIN customers cu ON cu.id = r.customer_id
      JOIN rooms ro ON ro.id = r.room_id
      JOIN houses h ON h.id = r.house_id
      JOIN cities ci ON ci.id = h.city_id
      WHERE r.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reserva não encontrada' });

    const companions = await db.query(`
      SELECT rc.*, co.artistic_name, co.gender
      FROM reservation_companions rc
      JOIN companions co ON co.id = rc.companion_id
      WHERE rc.reservation_id = $1
    `, [req.params.id]);
    rows[0].companions = companions.rows;

    const payments = await db.query('SELECT * FROM payments WHERE reservation_id = $1 ORDER BY created_at', [req.params.id]);
    rows[0].payments = payments.rows;

    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/reservations
router.post('/', async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { customer_id, room_id, check_in, duration_type, companion_ids = [] } = req.body;

    const durationHours = DURATION_MAP[duration_type];
    if (!durationHours) return res.status(400).json({ error: 'Duração inválida' });

    const checkIn = new Date(check_in);
    const checkOut = new Date(checkIn.getTime() + durationHours * 60 * 60 * 1000);

    // Verificar disponibilidade do quarto
    const conflict = await client.query(`
      SELECT id FROM reservations
      WHERE room_id = $1 AND status IN ('confirmed','active')
        AND check_in < $2 AND check_out > $3
    `, [room_id, checkOut.toISOString(), check_in]);
    if (conflict.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Quarto indisponível neste horário' });
    }

    // Buscar preço do quarto
    const roomRes = await client.query('SELECT * FROM rooms WHERE id = $1 AND active = true', [room_id]);
    if (!roomRes.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Quarto não encontrado' }); }
    const room = roomRes.rows[0];
    const priceField = `price_${duration_type}`;
    const roomPrice = room[priceField];
    if (!roomPrice) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Preço não configurado para essa duração' }); }

    // Calcular preço dos acompanhantes
    let companionsPrice = 0;
    const companionDetails = [];
    for (const cId of companion_ids) {
      const compRes = await client.query(
        "SELECT * FROM companions WHERE id = $1 AND status = 'available' AND approved = true",
        [cId]
      );
      if (!compRes.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: `Acompanhante ${cId} indisponível` }); }

      // Verificar conflito de horário do acompanhante
      const compConflict = await client.query(`
        SELECT rc.id FROM reservation_companions rc
        JOIN reservations r ON r.id = rc.reservation_id
        WHERE rc.companion_id = $1 AND r.status IN ('confirmed','active')
          AND r.check_in < $2 AND r.check_out > $3
      `, [cId, checkOut.toISOString(), check_in]);
      if (compConflict.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Acompanhante ${compRes.rows[0].artistic_name} indisponível neste horário` });
      }

      const price = parseFloat(compRes.rows[0].price_per_hour) * durationHours;
      companionsPrice += price;
      companionDetails.push({ id: cId, pricePerHour: compRes.rows[0].price_per_hour, totalPrice: price });
    }

    const totalPrice = parseFloat(roomPrice) + companionsPrice;
    const accessCode = generateAccessCode();

    // Criar reserva
    const resRes = await client.query(`
      INSERT INTO reservations (customer_id, room_id, house_id, check_in, check_out, duration_hours, duration_type, room_price, companions_price, total_price, access_code)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [customer_id, room_id, room.house_id, check_in, checkOut.toISOString(), durationHours, duration_type, roomPrice, companionsPrice, totalPrice, accessCode]);

    const reservation = resRes.rows[0];

    // Inserir acompanhantes
    for (const cd of companionDetails) {
      await client.query(
        'INSERT INTO reservation_companions (reservation_id, companion_id, price_per_hour, total_price) VALUES ($1,$2,$3,$4)',
        [reservation.id, cd.id, cd.pricePerHour, cd.totalPrice]
      );
    }

    // Criar cobrança Pix
    const pixCharge = await createPixCharge({
      reservationId: reservation.id,
      customerId: customer_id,
      amount: totalPrice,
      description: `Reserva ${room.name} - ${duration_type}`,
    });

    // Salvar pagamento
    await client.query(`
      INSERT INTO payments (reservation_id, customer_id, amount, pix_txid, pix_qr_code, pix_qr_code_image, pix_expiry)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [reservation.id, customer_id, totalPrice, pixCharge.txid, pixCharge.qrCode, pixCharge.qrCodeImage,
        new Date(Date.now() + parseInt(process.env.PIX_EXPIRY_MINUTES || 10) * 60 * 1000).toISOString()]);

    await client.query('COMMIT');

    res.status(201).json({
      reservation,
      payment: {
        qrCode: pixCharge.qrCode,
        qrCodeImage: pixCharge.qrCodeImage,
        txid: pixCharge.txid,
        amount: totalPrice,
        expiresIn: parseInt(process.env.PIX_EXPIRY_MINUTES || 10) * 60,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/reservations/:id/renew
router.post('/:id/renew', async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { duration_type } = req.body;
    const durationHours = DURATION_MAP[duration_type];
    if (!durationHours) return res.status(400).json({ error: 'Duração inválida' });

    const resRes = await client.query(
      "SELECT * FROM reservations WHERE id = $1 AND status IN ('active','confirmed')",
      [req.params.id]
    );
    if (!resRes.rows[0]) return res.status(404).json({ error: 'Reserva não encontrada ou inativa' });
    const reservation = resRes.rows[0];

    const room = await client.query('SELECT * FROM rooms WHERE id = $1', [reservation.room_id]);
    const priceField = `price_${duration_type}`;
    const renewPrice = room.rows[0][priceField];
    if (!renewPrice) return res.status(400).json({ error: 'Preço não configurado para essa duração' });

    const newCheckOut = new Date(reservation.check_out);
    newCheckOut.setHours(newCheckOut.getHours() + durationHours);

    await client.query(
      'UPDATE reservations SET check_out = $1, renewal_count = renewal_count + 1, updated_at = NOW() WHERE id = $2',
      [newCheckOut.toISOString(), reservation.id]
    );

    const pixCharge = await createPixCharge({
      reservationId: reservation.id,
      customerId: reservation.customer_id,
      amount: renewPrice,
      description: `Renovação ${duration_type} - Reserva ${reservation.id.slice(0, 8)}`,
    });

    await client.query(`
      INSERT INTO payments (reservation_id, customer_id, amount, type, pix_txid, pix_qr_code, pix_qr_code_image, pix_expiry)
      VALUES ($1,$2,$3,'renewal',$4,$5,$6,$7)
    `, [reservation.id, reservation.customer_id, renewPrice, pixCharge.txid, pixCharge.qrCode, pixCharge.qrCodeImage,
        new Date(Date.now() + 10 * 60 * 1000).toISOString()]);

    await client.query('COMMIT');
    res.json({
      message: 'Renovação criada, aguardando pagamento',
      payment: { qrCode: pixCharge.qrCode, qrCodeImage: pixCharge.qrCodeImage, amount: renewPrice },
      newCheckOut: newCheckOut.toISOString(),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/reservations/:id/cancel
router.patch('/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const { cancel_reason } = req.body;
    const { rows } = await db.query(`
      UPDATE reservations SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $1, updated_at = NOW()
      WHERE id = $2 AND status IN ('pending','confirmed') RETURNING *
    `, [cancel_reason, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reserva não encontrada ou não pode ser cancelada' });

    // Liberar quarto
    await db.query("UPDATE rooms SET status = 'available' WHERE id = $1", [rows[0].room_id]);

    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
