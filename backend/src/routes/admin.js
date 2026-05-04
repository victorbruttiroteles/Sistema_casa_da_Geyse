const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middlewares/auth');

// GET /api/admin/users
router.get('/users', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, role, house_id, active, last_login, created_at FROM admin_users ORDER BY name'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/admin/users
router.post('/users', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const { name, email, password, role, house_id } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      'INSERT INTO admin_users (name, email, password_hash, role, house_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, house_id, active',
      [name, email.toLowerCase(), hash, role, house_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email já cadastrado' });
    next(err);
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const { name, role, house_id, active, password } = req.body;
    const updates = [];
    const values = [];

    if (name) { values.push(name); updates.push(`name = $${values.length}`); }
    if (role) { values.push(role); updates.push(`role = $${values.length}`); }
    if (house_id !== undefined) { values.push(house_id); updates.push(`house_id = $${values.length}`); }
    if (active !== undefined) { values.push(active); updates.push(`active = $${values.length}`); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      values.push(hash);
      updates.push(`password_hash = $${values.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    values.push(req.params.id);

    const { rows } = await db.query(
      `UPDATE admin_users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING id, name, email, role, house_id, active`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
