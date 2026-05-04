const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');

// GET /api/companions?city_id=&gender=&age_range=&available=true
router.get('/', async (req, res, next) => {
  try {
    const { city_id, gender, age_range, available } = req.query;
    const params = [];
    const conditions = ['c.approved = true', "c.status != 'inactive'"];

    if (available === 'true') { conditions.push("c.status = 'available'"); }
    if (gender) { params.push(gender); conditions.push(`c.gender = $${params.length}`); }
    if (age_range) { params.push(age_range); conditions.push(`c.age_range = $${params.length}`); }
    if (city_id) { params.push(city_id); conditions.push(`cc.city_id = $${params.length}`); }

    const joinClause = city_id ? 'JOIN companion_cities cc ON cc.companion_id = c.id' : 'LEFT JOIN companion_cities cc ON cc.companion_id = c.id';

    const { rows } = await db.query(`
      SELECT DISTINCT c.*,
        (SELECT url FROM companion_photos WHERE companion_id = c.id AND is_cover = true AND approved = true LIMIT 1) as cover_photo,
        COALESCE(cc.price_per_hour, c.price_per_hour) as effective_price
      FROM companions c
      ${joinClause}
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.rating DESC, c.artistic_name
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/companions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM companions WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Acompanhante não encontrado' });

    const photos = await db.query(
      'SELECT * FROM companion_photos WHERE companion_id = $1 AND approved = true ORDER BY sort_order',
      [req.params.id]
    );
    const cities = await db.query(`
      SELECT ci.*, cc.price_per_hour FROM companion_cities cc
      JOIN cities ci ON ci.id = cc.city_id
      WHERE cc.companion_id = $1
    `, [req.params.id]);

    rows[0].photos = photos.rows;
    rows[0].cities = cities.rows;
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/companions (admin)
router.post('/', authenticate, authorize('super_admin', 'house_manager'), async (req, res, next) => {
  try {
    const { artistic_name, bio, gender, age_range, languages, categories, price_per_hour, bank_info } = req.body;
    const { rows } = await db.query(`
      INSERT INTO companions (artistic_name, bio, gender, age_range, languages, categories, price_per_hour, bank_info)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [artistic_name, bio, gender, age_range, languages || [], categories || [], price_per_hour, JSON.stringify(bank_info || {})]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/companions/:id
router.patch('/:id', authenticate, authorize('super_admin', 'house_manager'), async (req, res, next) => {
  try {
    const fields = ['artistic_name', 'bio', 'gender', 'age_range', 'languages', 'categories', 'price_per_hour', 'status', 'approved', 'bank_info'];
    const updates = [];
    const values = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        values.push(['bank_info'].includes(f) ? JSON.stringify(req.body[f]) : req.body[f]);
        updates.push(`${f} = $${values.length}`);
      }
    });
    if (!updates.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    values.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE companions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Acompanhante não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/companions/:id/photos - aprovação de foto
router.post('/:id/photos', authenticate, authorize('super_admin', 'house_manager'), async (req, res, next) => {
  try {
    const { url, is_cover, sort_order } = req.body;
    const { rows } = await db.query(
      'INSERT INTO companion_photos (companion_id, url, is_cover, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, url, is_cover || false, sort_order || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/companions/photos/:photoId/approve
router.patch('/photos/:photoId/approve', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const { approved } = req.body;
    const { rows } = await db.query(
      'UPDATE companion_photos SET approved = $1 WHERE id = $2 RETURNING *',
      [approved, req.params.photoId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Foto não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
