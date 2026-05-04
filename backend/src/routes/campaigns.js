const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');
const { sendWhatsAppMessage } = require('../services/whatsapp');

// GET /api/campaigns
router.get('/', authenticate, authorize('super_admin', 'house_manager'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM campaigns ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/campaigns
router.post('/', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const { name, message, target_status, target_tags, target_cities, min_reservations, max_reservations, last_reservation_days, scheduled_at } = req.body;
    const { rows } = await db.query(`
      INSERT INTO campaigns (name, message, target_status, target_tags, target_cities, min_reservations, max_reservations, last_reservation_days, scheduled_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [name, message, target_status, target_tags, target_cities, min_reservations, max_reservations, last_reservation_days, scheduled_at, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/campaigns/:id/send
router.post('/:id/send', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const { rows: [campaign] } = await db.query("SELECT * FROM campaigns WHERE id = $1 AND status = 'draft'", [req.params.id]);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada ou já enviada' });

    // Construir filtros de clientes
    const conditions = ['c.age_confirmed = true', "c.status != 'blocked'"];
    const params = [];

    if (campaign.target_status?.length) {
      params.push(campaign.target_status);
      conditions.push(`c.status = ANY($${params.length})`);
    }
    if (campaign.target_tags?.length) {
      params.push(campaign.target_tags);
      conditions.push(`c.tags && $${params.length}`);
    }
    if (campaign.min_reservations) {
      params.push(campaign.min_reservations);
      conditions.push(`c.total_reservations >= $${params.length}`);
    }
    if (campaign.max_reservations) {
      params.push(campaign.max_reservations);
      conditions.push(`c.total_reservations <= $${params.length}`);
    }
    if (campaign.last_reservation_days) {
      params.push(new Date(Date.now() - campaign.last_reservation_days * 24 * 60 * 60 * 1000).toISOString());
      conditions.push(`c.last_reservation_at < $${params.length}`);
    }

    const { rows: customers } = await db.query(
      `SELECT whatsapp FROM customers c WHERE ${conditions.join(' AND ')}`,
      params
    );

    await db.query("UPDATE campaigns SET status = 'sending', updated_at = NOW() WHERE id = $1", [campaign.id]);

    let sent = 0;
    for (const customer of customers) {
      try {
        await sendWhatsAppMessage(customer.whatsapp, campaign.message);
        sent++;
        await new Promise(r => setTimeout(r, 500)); // Rate limit
      } catch {}
    }

    await db.query(
      "UPDATE campaigns SET status = 'sent', sent_at = NOW(), sent_count = $1 WHERE id = $2",
      [sent, campaign.id]
    );

    res.json({ message: `Campanha enviada para ${sent} clientes` });
  } catch (err) { next(err); }
});

module.exports = router;
