const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');
const { refundPix } = require('../services/pix');

// GET /api/payments
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { reservation_id, status, date_from, date_to } = req.query;
    const params = [];
    const conditions = [];

    if (reservation_id) { params.push(reservation_id); conditions.push(`p.reservation_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
    if (date_from) { params.push(date_from); conditions.push(`p.created_at >= $${params.length}`); }
    if (date_to) { params.push(date_to); conditions.push(`p.created_at <= $${params.length}`); }

    if (req.user.role === 'house_manager' || req.user.role === 'receptionist') {
      params.push(req.user.house_id);
      conditions.push(`r.house_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(`
      SELECT p.*, cu.whatsapp as customer_whatsapp, r.house_id
      FROM payments p
      JOIN reservations r ON r.id = p.reservation_id
      JOIN customers cu ON cu.id = p.customer_id
      ${where}
      ORDER BY p.created_at DESC LIMIT 200
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/payments/:id/refund
router.post('/:id/refund', authenticate, authorize('super_admin', 'financial'), async (req, res, next) => {
  try {
    const { rows: [payment] } = await db.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado' });
    if (payment.status !== 'confirmed') return res.status(400).json({ error: 'Apenas pagamentos confirmados podem ser estornados' });
    if (!payment.pix_e2e_id) return res.status(400).json({ error: 'ID E2E do Pix não encontrado' });

    const refundAmount = req.body.amount || payment.amount;
    await refundPix(payment.pix_e2e_id, refundAmount);

    await db.query(
      "UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1",
      [payment.id]
    );
    await db.query(
      'UPDATE reservations SET status = $1, refund_amount = $2, refund_at = NOW(), updated_at = NOW() WHERE id = $3',
      ['cancelled', refundAmount, payment.reservation_id]
    );

    res.json({ message: 'Estorno realizado com sucesso', refundAmount });
  } catch (err) { next(err); }
});

module.exports = router;
