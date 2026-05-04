const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');

// GET /api/reports/dashboard
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const { house_id, date_from = new Date(new Date().setDate(1)).toISOString(), date_to = new Date().toISOString() } = req.query;

    const targetHouseId = req.user.role === 'super_admin' || req.user.role === 'financial'
      ? house_id : req.user.house_id;

    const houseFilter = targetHouseId ? 'AND r.house_id = $3' : '';
    const params = [date_from, date_to, ...(targetHouseId ? [targetHouseId] : [])];

    const [revenue, reservations, occupancy, topCustomers, npsAvg] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'confirmed'), 0) as total_revenue,
          COALESCE(SUM(p.split_platform), 0) as platform_revenue,
          COALESCE(SUM(p.split_house), 0) as house_revenue,
          COALESCE(SUM(p.split_companions), 0) as companions_revenue,
          COUNT(p.id) FILTER (WHERE p.status = 'confirmed') as total_payments
        FROM payments p
        JOIN reservations r ON r.id = p.reservation_id
        WHERE p.created_at BETWEEN $1 AND $2 ${houseFilter}
      `, params),

      db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          COALESCE(AVG(total_price), 0) as avg_ticket,
          COALESCE(AVG(duration_hours), 0) as avg_duration
        FROM reservations r
        WHERE created_at BETWEEN $1 AND $2 ${houseFilter}
      `, params),

      db.query(`
        SELECT
          h.name as house_name,
          COUNT(r.id) FILTER (WHERE r.status IN ('confirmed','completed')) as reservations,
          COUNT(DISTINCT ro.id) as total_rooms,
          ROUND(
            COUNT(r.id) FILTER (WHERE r.status IN ('confirmed','completed'))::numeric /
            NULLIF(COUNT(DISTINCT ro.id) * EXTRACT(DAY FROM ($2::date - $1::date + 1)), 0) * 100, 2
          ) as occupancy_rate
        FROM houses h
        JOIN rooms ro ON ro.house_id = h.id AND ro.active = true
        LEFT JOIN reservations r ON r.room_id = ro.id AND r.created_at BETWEEN $1 AND $2
        ${targetHouseId ? 'WHERE h.id = $3' : ''}
        GROUP BY h.id, h.name
        ORDER BY reservations DESC
      `, params),

      db.query(`
        SELECT c.whatsapp, c.name, c.status,
          COUNT(r.id) as reservation_count,
          COALESCE(SUM(r.total_price), 0) as total_spent
        FROM customers c
        JOIN reservations r ON r.customer_id = c.id
        WHERE r.created_at BETWEEN $1 AND $2 ${houseFilter}
        GROUP BY c.id, c.whatsapp, c.name, c.status
        ORDER BY total_spent DESC LIMIT 10
      `, params),

      db.query(`
        SELECT ROUND(AVG(score), 2) as avg_nps,
          COUNT(*) FILTER (WHERE score >= 9) as promoters,
          COUNT(*) FILTER (WHERE score BETWEEN 7 AND 8) as neutrals,
          COUNT(*) FILTER (WHERE score <= 6) as detractors,
          COUNT(*) as total
        FROM nps_ratings n
        JOIN reservations r ON r.id = n.reservation_id
        WHERE n.responded_at BETWEEN $1 AND $2 ${houseFilter}
      `, params),
    ]);

    res.json({
      revenue: revenue.rows[0],
      reservations: reservations.rows[0],
      occupancy: occupancy.rows,
      topCustomers: topCustomers.rows,
      nps: npsAvg.rows[0],
    });
  } catch (err) { next(err); }
});

// GET /api/reports/room-map
router.get('/room-map', authenticate, async (req, res, next) => {
  try {
    const { house_id } = req.query;
    const targetHouseId = req.user.role === 'super_admin' || req.user.role === 'financial'
      ? house_id : req.user.house_id;

    const params = [];
    let houseFilter = '';
    if (targetHouseId) { params.push(targetHouseId); houseFilter = `AND h.id = $${params.length}`; }

    const { rows } = await db.query(`
      SELECT
        h.id as house_id, h.name as house_name, c.name as city_name,
        json_agg(json_build_object(
          'id', ro.id,
          'name', ro.name,
          'status', ro.status,
          'current_reservation', (
            SELECT json_build_object(
              'id', r.id,
              'customer', cu.whatsapp,
              'check_in', r.check_in,
              'check_out', r.check_out,
              'total', r.total_price
            )
            FROM reservations r
            JOIN customers cu ON cu.id = r.customer_id
            WHERE r.room_id = ro.id AND r.status IN ('confirmed','active')
            ORDER BY r.check_in DESC LIMIT 1
          )
        ) ORDER BY ro.name) as rooms
      FROM houses h
      JOIN cities c ON c.id = h.city_id
      JOIN rooms ro ON ro.house_id = h.id AND ro.active = true
      WHERE h.active = true ${houseFilter}
      GROUP BY h.id, h.name, c.name
      ORDER BY c.name, h.name
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
