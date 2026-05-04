const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');

// GET /api/cities
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM cities WHERE active = true ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/cities
router.post('/', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const { name, state } = req.body;
    const { rows } = await db.query(
      'INSERT INTO cities (name, state) VALUES ($1, $2) RETURNING *',
      [name, state || 'SC']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/cities/:id
router.patch('/:id', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const { name, state, active } = req.body;
    const { rows } = await db.query(
      'UPDATE cities SET name = COALESCE($1, name), state = COALESCE($2, state), active = COALESCE($3, active) WHERE id = $4 RETURNING *',
      [name, state, active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cidade não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
