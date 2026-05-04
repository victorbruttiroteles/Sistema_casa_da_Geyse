const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');

// GET /api/rooms?house_id=&date=&duration=
router.get('/', async (req, res, next) => {
  try {
    const { house_id, check_in, duration_hours } = req.query;
    const params = [];
    let where = 'WHERE r.active = true';
    if (house_id) { params.push(house_id); where += ` AND r.house_id = $${params.length}`; }

    const { rows } = await db.query(`
      SELECT r.*,
        (SELECT url FROM room_photos WHERE room_id = r.id AND is_cover = true LIMIT 1) as cover_photo,
        (SELECT json_agg(url ORDER BY sort_order) FROM room_photos WHERE room_id = r.id) as photos
      FROM rooms r
      ${where}
      ORDER BY r.name
    `, params);

    // Verificar disponibilidade em tempo real
    if (check_in && duration_hours) {
      const checkOut = new Date(check_in);
      checkOut.setHours(checkOut.getHours() + parseFloat(duration_hours));

      for (const room of rows) {
        const conflict = await db.query(`
          SELECT id FROM reservations
          WHERE room_id = $1
            AND status IN ('confirmed','active')
            AND check_in < $2
            AND check_out > $3
        `, [room.id, checkOut.toISOString(), check_in]);
        room.is_available = conflict.rows.length === 0;
      }
    }

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/rooms/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*, h.name as house_name, c.name as city_name,
        (SELECT json_agg(rp.* ORDER BY rp.sort_order) FROM room_photos rp WHERE rp.room_id = r.id) as photos
      FROM rooms r
      JOIN houses h ON h.id = r.house_id
      JOIN cities c ON c.id = h.city_id
      WHERE r.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quarto não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/rooms
router.post('/', authenticate, authorize('super_admin', 'house_manager'), async (req, res, next) => {
  try {
    const { house_id, name, description, capacity, price_1h, price_2h, price_4h, price_8h, price_daily, amenities } = req.body;
    const { rows } = await db.query(`
      INSERT INTO rooms (house_id, name, description, capacity, price_1h, price_2h, price_4h, price_8h, price_daily, amenities)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [house_id, name, description, capacity || 2, price_1h, price_2h, price_4h, price_8h, price_daily, JSON.stringify(amenities || [])]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/rooms/:id
router.patch('/:id', authenticate, authorize('super_admin', 'house_manager'), async (req, res, next) => {
  try {
    const fields = ['name', 'description', 'capacity', 'price_1h', 'price_2h', 'price_4h', 'price_8h', 'price_daily', 'amenities', 'status', 'active'];
    const updates = [];
    const values = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        values.push(f === 'amenities' ? JSON.stringify(req.body[f]) : req.body[f]);
        updates.push(`${f} = $${values.length}`);
      }
    });
    if (!updates.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    values.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE rooms SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Quarto não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/rooms/:id/status - atualização rápida de status
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['available', 'occupied', 'reserved', 'maintenance'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Status inválido' });

    const { rows } = await db.query(
      'UPDATE rooms SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Quarto não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
