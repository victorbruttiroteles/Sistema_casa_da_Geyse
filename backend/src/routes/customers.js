const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');

// GET /api/customers
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, search, tag, limit = 50, offset = 0 } = req.query;
    const params = [];
    const conditions = [];

    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (tag) { params.push(tag); conditions.push(`$${params.length} = ANY(tags)`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(whatsapp ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const { rows } = await db.query(`
      SELECT id, whatsapp, name, status, loyalty_points, total_spent, total_reservations,
        last_reservation_at, tags, nps_average, created_at
      FROM customers ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const count = await db.query(`SELECT COUNT(*) FROM customers ${where}`, params.slice(0, -2));
    res.json({ data: rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
});

// GET /api/customers/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente não encontrado' });

    const reservations = await db.query(`
      SELECT r.*, ro.name as room_name, h.name as house_name
      FROM reservations r
      JOIN rooms ro ON ro.id = r.room_id
      JOIN houses h ON h.id = r.house_id
      WHERE r.customer_id = $1
      ORDER BY r.created_at DESC LIMIT 20
    `, [req.params.id]);

    const nps = await db.query('SELECT * FROM nps_ratings WHERE customer_id = $1 ORDER BY responded_at DESC', [req.params.id]);
    const loyalty = await db.query('SELECT * FROM loyalty_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20', [req.params.id]);

    rows[0].reservations = reservations.rows;
    rows[0].nps_ratings = nps.rows;
    rows[0].loyalty_history = loyalty.rows;
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/customers/:id
router.patch('/:id', authenticate, authorize('super_admin', 'house_manager'), async (req, res, next) => {
  try {
    const { name, status, tags, notes, blocked_reason } = req.body;
    const { rows } = await db.query(`
      UPDATE customers SET
        name = COALESCE($1, name),
        status = COALESCE($2, status),
        tags = COALESCE($3, tags),
        notes = COALESCE($4, notes),
        blocked_reason = COALESCE($5, blocked_reason),
        updated_at = NOW()
      WHERE id = $6 RETURNING *
    `, [name, status, tags, notes, blocked_reason, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/customers/:id/message - Enviar mensagem manual
router.post('/:id/message', authenticate, authorize('super_admin', 'house_manager'), async (req, res, next) => {
  try {
    const { message } = req.body;
    const { rows } = await db.query('SELECT whatsapp FROM customers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente não encontrado' });

    const { sendWhatsAppMessage } = require('../services/whatsapp');
    await sendWhatsAppMessage(rows[0].whatsapp, message);
    res.json({ message: 'Mensagem enviada com sucesso' });
  } catch (err) { next(err); }
});

module.exports = router;
