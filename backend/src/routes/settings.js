const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');

// GET /api/settings
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT key, value, description FROM system_settings ORDER BY key');
    res.json(rows);
  } catch (err) { next(err); }
});

// PATCH /api/settings/:key
router.patch('/:key', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const { value } = req.body;
    const { rows } = await db.query(
      'UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
      [value, req.params.key]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Configuração não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
