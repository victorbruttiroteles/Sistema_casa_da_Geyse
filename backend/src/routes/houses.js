const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');

// GET /api/houses
router.get('/', async (req, res, next) => {
  try {
    const { city_id } = req.query;
    const params = [];
    let where = 'WHERE h.active = true';
    if (city_id) { params.push(city_id); where += ` AND h.city_id = $${params.length}`; }

    const { rows } = await db.query(`
      SELECT h.*, c.name as city_name, c.state,
        (SELECT url FROM house_photos WHERE house_id = h.id AND is_cover = true LIMIT 1) as cover_photo,
        (SELECT COUNT(*) FROM rooms WHERE house_id = h.id AND active = true) as room_count
      FROM houses h
      JOIN cities c ON c.id = h.city_id
      ${where}
      ORDER BY c.name, h.name
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/houses/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT h.*, c.name as city_name, c.state
      FROM houses h JOIN cities c ON c.id = h.city_id
      WHERE h.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Casa não encontrada' });

    const photos = await db.query('SELECT * FROM house_photos WHERE house_id = $1 ORDER BY sort_order', [req.params.id]);
    rows[0].photos = photos.rows;
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/houses
router.post('/', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const { city_id, name, address, address_number, neighborhood, zip_code, description, phone, whatsapp, access_instructions } = req.body;
    const { rows } = await db.query(`
      INSERT INTO houses (city_id, name, address, address_number, neighborhood, zip_code, description, phone, whatsapp, access_instructions)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [city_id, name, address, address_number, neighborhood, zip_code, description, phone, whatsapp, access_instructions]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/houses/:id
router.patch('/:id', authenticate, authorize('super_admin', 'house_manager'), async (req, res, next) => {
  try {
    const fields = ['name', 'address', 'address_number', 'neighborhood', 'zip_code', 'description', 'phone', 'whatsapp', 'access_instructions', 'active'];
    const updates = [];
    const values = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { values.push(req.body[f]); updates.push(`${f} = $${values.length}`); }
    });
    if (!updates.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    values.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE houses SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Casa não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
