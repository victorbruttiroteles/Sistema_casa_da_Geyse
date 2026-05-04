const jwt = require('jsonwebtoken');
const db = require('../config/database');

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query(
      'SELECT id, name, email, role, house_id, active FROM admin_users WHERE id = $1',
      [decoded.id]
    );
    if (!rows[0] || !rows[0].active) {
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    }
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
}

// Super admin ou gestor da própria casa
function authorizeHouseAccess(req, res, next) {
  const { role, house_id } = req.user;
  if (role === 'super_admin' || role === 'financial') return next();
  const targetHouseId = req.params.houseId || req.query.houseId || req.body.house_id;
  if (house_id && house_id === targetHouseId) return next();
  return res.status(403).json({ error: 'Acesso negado a esta unidade' });
}

module.exports = { authenticate, authorize, authorizeHouseAccess };
