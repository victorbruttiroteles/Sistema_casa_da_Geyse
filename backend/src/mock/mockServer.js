require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// ─── DADOS EM MEMÓRIA ────────────────────────────────────────────────────────

const ADMIN_PASSWORD_HASH = bcrypt.hashSync('Admin@2024!', 10);

const admins = [
  { id: 'admin-001', name: 'Super Admin', email: 'admin@casadageyse.com.br', password_hash: ADMIN_PASSWORD_HASH, role: 'super_admin', house_id: null, active: true, last_login: new Date().toISOString() }
];

const cities = [
  { id: 'city-001', name: 'Penha', state: 'SC', active: true },
  { id: 'city-002', name: 'Barra Velha', state: 'SC', active: true },
];

const houses = [
  { id: 'house-001', city_id: 'city-001', name: 'Penha Centro', address: 'Rua Porto Alegre, 987', neighborhood: 'Centro', description: 'Casa no centro de Penha.', active: true, rating: 4.8, total_reviews: 120, whatsapp: '5547999999991', city_name: 'Penha', room_count: 2 },
  { id: 'house-002', city_id: 'city-001', name: 'Penha Armação', address: 'Rua João Luiz Julierini, 154', neighborhood: 'Armação', description: 'Unidade tranquila.', active: true, rating: 4.6, total_reviews: 80, whatsapp: '5547999999992', city_name: 'Penha', room_count: 2 },
  { id: 'house-003', city_id: 'city-002', name: 'Barra Velha Praia do Tabuleiro', address: 'Rua Calipto F. Gonzalez, 53', neighborhood: 'Praia do Tabuleiro', description: 'Frente ao mar.', active: true, rating: 4.9, total_reviews: 200, whatsapp: '5547999999993', city_name: 'Barra Velha', room_count: 3 },
];

const rooms = [
  { id: 'room-001', house_id: 'house-001', name: 'Quarto com TV', description: 'Quarto confortável com TV 32"', price_1h: 80, price_2h: 140, price_4h: 220, price_8h: 320, price_daily: 450, amenities: ['TV 32"','Ar condicionado','Wi-Fi'], status: 'available', active: true },
  { id: 'room-002', house_id: 'house-001', name: 'Suíte com TV e banheiro', description: 'Suíte espaçosa', price_1h: 100, price_2h: 180, price_4h: 280, price_8h: 400, price_daily: 550, amenities: ['TV 40"','Ar condicionado','Frigobar','Wi-Fi'], status: 'occupied', active: true },
  { id: 'room-003', house_id: 'house-002', name: 'Quarto com TV', description: 'Quarto com TV e banheiro', price_1h: 80, price_2h: 140, price_4h: 220, price_8h: 320, price_daily: 450, amenities: ['TV 32"','Wi-Fi'], status: 'available', active: true },
  { id: 'room-004', house_id: 'house-002', name: 'Suíte com TV e banheiro', description: 'Suíte completa', price_1h: 100, price_2h: 180, price_4h: 280, price_8h: 400, price_daily: 550, amenities: ['TV 40"','Ar condicionado','Wi-Fi'], status: 'reserved', active: true },
  { id: 'room-005', house_id: 'house-003', name: 'Quarto com TV', description: 'Quarto padrão frente ao mar', price_1h: 80, price_2h: 140, price_4h: 220, price_8h: 320, price_daily: 450, amenities: ['TV 32"','Vista para o mar','Wi-Fi'], status: 'available', active: true },
  { id: 'room-006', house_id: 'house-003', name: 'Quarto com sacada', description: 'Quarto com sacada e vista para o mar', price_1h: 120, price_2h: 200, price_4h: 320, price_8h: 450, price_daily: 600, amenities: ['TV 40"','Sacada','Vista para o mar','Wi-Fi'], status: 'maintenance', active: true },
  { id: 'room-007', house_id: 'house-003', name: 'Suíte com espelho', description: 'Suíte especial', price_1h: 150, price_2h: 250, price_4h: 400, price_8h: 550, price_daily: 700, amenities: ['TV 50"','Espelho','Ar condicionado','Frigobar'], status: 'available', active: true },
];

const companions = [
  { id: 'comp-001', artistic_name: 'Sofia', bio: 'Simpática e carinhosa, falo inglês e espanhol.', gender: 'feminino', age_range: '18-25', price_per_hour: 200, rating: 4.9, status: 'available', approved: true, cover_photo: null },
  { id: 'comp-002', artistic_name: 'Valentina', bio: 'Apaixonada por música e dança.', gender: 'feminino', age_range: '26-35', price_per_hour: 180, rating: 4.7, status: 'available', approved: true, cover_photo: null },
  { id: 'comp-003', artistic_name: 'Luna', bio: 'Elegante e discreta.', gender: 'trans_feminina', age_range: '18-25', price_per_hour: 220, rating: 4.8, status: 'busy', approved: true, cover_photo: null },
  { id: 'comp-004', artistic_name: 'Isis', bio: 'Adoro conversar e me divertir.', gender: 'feminino', age_range: '26-35', price_per_hour: 190, rating: 4.6, status: 'paused', approved: true, cover_photo: null },
];

const customers = [
  { id: 'cust-001', whatsapp: '5547991111111', name: 'João Silva', status: 'vip', loyalty_points: 520, total_spent: 4800, total_reservations: 12, last_reservation_at: new Date(Date.now() - 2*24*60*60*1000).toISOString(), nps_average: 9.2, tags: ['vip','frequente'], created_at: new Date(Date.now() - 90*24*60*60*1000).toISOString() },
  { id: 'cust-002', whatsapp: '5547992222222', name: 'Carlos Mendes', status: 'active', loyalty_points: 210, total_spent: 2100, total_reservations: 5, last_reservation_at: new Date(Date.now() - 7*24*60*60*1000).toISOString(), nps_average: 8.5, tags: ['frequente'], created_at: new Date(Date.now() - 60*24*60*60*1000).toISOString() },
  { id: 'cust-003', whatsapp: '5547993333333', name: null, status: 'active', loyalty_points: 50, total_spent: 450, total_reservations: 1, last_reservation_at: new Date(Date.now() - 20*24*60*60*1000).toISOString(), nps_average: null, tags: ['novo'], created_at: new Date(Date.now() - 25*24*60*60*1000).toISOString() },
  { id: 'cust-004', whatsapp: '5547994444444', name: 'Pedro Costa', status: 'inactive', loyalty_points: 90, total_spent: 890, total_reservations: 2, last_reservation_at: new Date(Date.now() - 30*24*60*60*1000).toISOString(), nps_average: 7.0, tags: ['risco_churn'], created_at: new Date(Date.now() - 50*24*60*60*1000).toISOString() },
];

const reservations = [
  { id: 'res-001', customer_id: 'cust-001', room_id: 'room-001', house_id: 'house-001', check_in: new Date(Date.now() - 2*60*60*1000).toISOString(), check_out: new Date(Date.now() + 2*60*60*1000).toISOString(), duration_type: '4h', duration_hours: 4, room_price: 220, companions_price: 0, total_price: 220, status: 'confirmed', access_code: 'ABC123', renewal_count: 0, customer_whatsapp: '5547991111111', customer_name: 'João Silva', room_name: 'Quarto com TV', house_name: 'Penha Centro', city_name: 'Penha', companions: [], created_at: new Date(Date.now() - 3*60*60*1000).toISOString() },
  { id: 'res-002', customer_id: 'cust-002', room_id: 'room-002', house_id: 'house-001', check_in: new Date(Date.now() - 1*60*60*1000).toISOString(), check_out: new Date(Date.now() + 1*60*60*1000).toISOString(), duration_type: '2h', duration_hours: 2, room_price: 180, companions_price: 360, total_price: 540, status: 'confirmed', access_code: 'DEF456', renewal_count: 0, customer_whatsapp: '5547992222222', customer_name: 'Carlos Mendes', room_name: 'Suíte com TV e banheiro', house_name: 'Penha Centro', city_name: 'Penha', companions: [{ id: 'comp-001', name: 'Sofia', price: 360 }], created_at: new Date(Date.now() - 2*60*60*1000).toISOString() },
  { id: 'res-003', customer_id: 'cust-001', room_id: 'room-005', house_id: 'house-003', check_in: new Date(Date.now() - 3*24*60*60*1000).toISOString(), check_out: new Date(Date.now() - 2*24*60*60*1000).toISOString(), duration_type: 'daily', duration_hours: 24, room_price: 450, companions_price: 0, total_price: 450, status: 'completed', access_code: 'GHI789', renewal_count: 1, customer_whatsapp: '5547991111111', customer_name: 'João Silva', room_name: 'Quarto com TV', house_name: 'Barra Velha Praia do Tabuleiro', city_name: 'Barra Velha', companions: [], created_at: new Date(Date.now() - 3*24*60*60*1000).toISOString() },
];

const settings = [
  { key: 'split_platform_percent', value: '20', description: 'Percentual da plataforma' },
  { key: 'split_house_percent', value: '60', description: 'Percentual da casa' },
  { key: 'split_companion_percent', value: '20', description: 'Percentual do acompanhante' },
  { key: 'pix_expiry_minutes', value: '10', description: 'Minutos para expiração do Pix' },
  { key: 'renewal_alert_minutes', value: '15', description: 'Alerta de renovação (min antes)' },
  { key: 'nps_delay_minutes', value: '60', description: 'Enviar NPS após (min)' },
  { key: 'reactivation_days', value: '15', description: 'Dias de inatividade para reativação' },
  { key: 'vip_min_reservations', value: '10', description: 'Mínimo de reservas para VIP' },
  { key: 'loyalty_points_per_100', value: '10', description: 'Pontos por R$100 gastos' },
  { key: 'loyalty_points_for_reward', value: '500', description: 'Pontos para resgatar recompensa' },
  { key: 'bot_welcome_message', value: 'Olá! Bem-vindo(a) à Casa da Geyse 🌹\n\nVocê tem 18 anos ou mais?\n\n*SIM* - Confirmar\n*NÃO* - Encerrar', description: 'Mensagem de boas-vindas do bot' },
  { key: 'bot_underage_message', value: 'Desculpe, serviço exclusivo para maiores de 18 anos.', description: 'Mensagem para menores de idade' },
  { key: 'business_hours_start', value: '08:00', description: 'Abertura' },
  { key: 'business_hours_end', value: '02:00', description: 'Fechamento' },
];

const campaigns = [];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// ─── ROTAS ───────────────────────────────────────────────────────────────────

// Health
app.get('/health', (_, res) => res.json({ status: 'ok (mock)', timestamp: new Date() }));

// AUTH
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const admin = admins.find(a => a.email === email?.toLowerCase() && a.active);
  if (!admin) return res.status(401).json({ error: 'Credenciais inválidas' });
  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });
  admin.last_login = new Date().toISOString();
  const token = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  const { password_hash, ...user } = admin;
  res.json({ token, user });
});

app.get('/api/auth/me', auth, (req, res) => {
  const admin = admins.find(a => a.id === req.user.id);
  const { password_hash, ...user } = admin;
  res.json({ user });
});

// CITIES
app.get('/api/cities', (_, res) => res.json(cities.filter(c => c.active)));
app.post('/api/cities', auth, (req, res) => {
  const city = { id: `city-${Date.now()}`, ...req.body, active: true };
  cities.push(city);
  res.status(201).json(city);
});

// HOUSES
app.get('/api/houses', (req, res) => {
  let list = houses.filter(h => h.active);
  if (req.query.city_id) list = list.filter(h => h.city_id === req.query.city_id);
  res.json(list);
});
app.get('/api/houses/:id', (req, res) => {
  const h = houses.find(h => h.id === req.params.id);
  if (!h) return res.status(404).json({ error: 'Casa não encontrada' });
  res.json({ ...h, photos: [] });
});
app.post('/api/houses', auth, (req, res) => {
  const city = cities.find(c => c.id === req.body.city_id);
  const house = { id: `house-${Date.now()}`, ...req.body, active: true, rating: 0, total_reviews: 0, city_name: city?.name || '', room_count: 0 };
  houses.push(house);
  res.status(201).json(house);
});
app.patch('/api/houses/:id', auth, (req, res) => {
  const idx = houses.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Casa não encontrada' });
  houses[idx] = { ...houses[idx], ...req.body };
  res.json(houses[idx]);
});

// ROOMS
app.get('/api/rooms', (req, res) => {
  let list = rooms.filter(r => r.active);
  if (req.query.house_id) list = list.filter(r => r.house_id === req.query.house_id);
  list = list.map(r => ({ ...r, is_available: r.status === 'available', photos: [] }));
  res.json(list);
});
app.get('/api/rooms/:id', (req, res) => {
  const r = rooms.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Quarto não encontrado' });
  const h = houses.find(h => h.id === r.house_id);
  res.json({ ...r, house_name: h?.name, city_name: h?.city_name, photos: [] });
});
app.post('/api/rooms', auth, (req, res) => {
  const room = { id: `room-${Date.now()}`, ...req.body, status: 'available', active: true };
  rooms.push(room);
  const h = houses.find(h => h.id === room.house_id);
  if (h) h.room_count = (h.room_count || 0) + 1;
  res.status(201).json(room);
});
app.patch('/api/rooms/:id', auth, (req, res) => {
  const idx = rooms.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Quarto não encontrado' });
  rooms[idx] = { ...rooms[idx], ...req.body };
  res.json(rooms[idx]);
});
app.patch('/api/rooms/:id/status', auth, (req, res) => {
  const idx = rooms.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Quarto não encontrado' });
  rooms[idx].status = req.body.status;
  res.json(rooms[idx]);
});

// COMPANIONS
app.get('/api/companions', (req, res) => {
  let list = companions.filter(c => c.approved);
  if (req.query.available === 'true') list = list.filter(c => c.status === 'available');
  if (req.query.gender) list = list.filter(c => c.gender === req.query.gender);
  if (req.query.age_range) list = list.filter(c => c.age_range === req.query.age_range);
  res.json(list.map(c => ({ ...c, effective_price: c.price_per_hour })));
});
app.get('/api/companions/:id', (req, res) => {
  const c = companions.find(c => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Não encontrado' });
  res.json({ ...c, photos: [], cities: [] });
});
app.post('/api/companions', auth, (req, res) => {
  const c = { id: `comp-${Date.now()}`, ...req.body, rating: 0, status: 'available', approved: false, cover_photo: null };
  companions.push(c);
  res.status(201).json(c);
});
app.patch('/api/companions/:id', auth, (req, res) => {
  const idx = companions.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  companions[idx] = { ...companions[idx], ...req.body };
  res.json(companions[idx]);
});
app.post('/api/companions/:id/photos', auth, (req, res) => {
  const photo = { id: `photo-${Date.now()}`, companion_id: req.params.id, ...req.body, approved: false };
  res.status(201).json(photo);
});
app.patch('/api/companions/photos/:photoId/approve', auth, (req, res) => {
  res.json({ id: req.params.photoId, approved: req.body.approved });
});

// RESERVATIONS
app.get('/api/reservations', auth, (req, res) => {
  let list = [...reservations];
  if (req.query.status) list = list.filter(r => r.status === req.query.status);
  if (req.query.date) list = list.filter(r => r.check_in?.startsWith(req.query.date));
  res.json(list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});
app.get('/api/reservations/:id', auth, (req, res) => {
  const r = reservations.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Não encontrada' });
  const h = houses.find(h => h.id === r.house_id);
  res.json({ ...r, address: h?.address, access_instructions: 'Solicite o código ao atendente na chegada.', payments: [] });
});
app.post('/api/reservations', (req, res) => {
  const { room_id, customer_id, check_in, duration_type } = req.body;
  const dMap = { '1h':1,'2h':2,'4h':4,'8h':8,'daily':24 };
  const hours = dMap[duration_type] || 1;
  const room = rooms.find(r => r.id === room_id);
  if (!room) return res.status(404).json({ error: 'Quarto não encontrado' });
  const price = room[`price_${duration_type}`] || 0;
  const checkOut = new Date(new Date(check_in).getTime() + hours*3600000).toISOString();
  const res_ = {
    id: `res-${Date.now()}`, customer_id, room_id, house_id: room.house_id,
    check_in, check_out: checkOut, duration_type, duration_hours: hours,
    room_price: price, companions_price: 0, total_price: price,
    status: 'pending', access_code: Math.random().toString(36).substring(2,8).toUpperCase(),
    renewal_count: 0, companions: [], created_at: new Date().toISOString(),
  };
  reservations.push(res_);
  res.status(201).json({
    reservation: res_,
    payment: {
      qrCode: '00020126580014br.gov.bcb.pix0136MOCK-QR-CODE-DEMO5204000053039865802BR5925Casa da Geyse6009SAO PAULO62070503***6304DEMO',
      qrCodeImage: null,
      txid: `mock-${Date.now()}`,
      amount: price,
      expiresIn: 600,
    },
  });
});
app.post('/api/reservations/:id/renew', (req, res) => {
  const r = reservations.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Não encontrada' });
  const dMap = { '1h':1,'2h':2,'4h':4,'8h':8,'daily':24 };
  const hours = dMap[req.body.duration_type] || 1;
  r.check_out = new Date(new Date(r.check_out).getTime() + hours*3600000).toISOString();
  r.renewal_count++;
  res.json({ message: 'Renovação criada', payment: { qrCode: 'MOCK', amount: 80 }, newCheckOut: r.check_out });
});
app.patch('/api/reservations/:id/cancel', auth, (req, res) => {
  const r = reservations.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Não encontrada' });
  r.status = 'cancelled';
  r.cancelled_at = new Date().toISOString();
  r.cancel_reason = req.body.cancel_reason;
  res.json(r);
});

// PAYMENTS
app.get('/api/payments', auth, (req, res) => res.json([]));
app.post('/api/payments/:id/refund', auth, (req, res) => res.json({ message: 'Estorno realizado (mock)' }));

// CUSTOMERS
app.get('/api/customers', auth, (req, res) => {
  let list = [...customers];
  if (req.query.status) list = list.filter(c => c.status === req.query.status);
  if (req.query.search) {
    const s = req.query.search.toLowerCase();
    list = list.filter(c => c.whatsapp.includes(s) || (c.name||'').toLowerCase().includes(s));
  }
  res.json({ data: list, total: list.length });
});
app.get('/api/customers/:id', auth, (req, res) => {
  const c = customers.find(c => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Não encontrado' });
  const custRes = reservations.filter(r => r.customer_id === c.id).map(r => ({
    ...r, house_name: houses.find(h=>h.id===r.house_id)?.name, room_name: rooms.find(rm=>rm.id===r.room_id)?.name
  }));
  res.json({ ...c, reservations: custRes, nps_ratings: [], loyalty_history: [], opted_in_at: c.created_at, referral_code: 'REF' + c.id.slice(-4).toUpperCase() });
});
app.patch('/api/customers/:id', auth, (req, res) => {
  const idx = customers.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  customers[idx] = { ...customers[idx], ...req.body };
  res.json(customers[idx]);
});
app.post('/api/customers/:id/message', auth, (req, res) => {
  console.log(`[WhatsApp Mock] → ${customers.find(c=>c.id===req.params.id)?.whatsapp}: ${req.body.message}`);
  res.json({ message: 'Mensagem enviada (mock)' });
});

// REPORTS
app.get('/api/reports/dashboard', auth, (req, res) => {
  const totalRevenue = reservations.filter(r=>r.status!=='cancelled').reduce((s,r)=>s+parseFloat(r.total_price||0),0);
  res.json({
    revenue: { total_revenue: totalRevenue, platform_revenue: totalRevenue*0.20, house_revenue: totalRevenue*0.60, companions_revenue: totalRevenue*0.20, total_payments: reservations.filter(r=>r.status==='confirmed'||r.status==='completed').length },
    reservations: { total: reservations.length, confirmed: reservations.filter(r=>r.status==='confirmed').length, completed: reservations.filter(r=>r.status==='completed').length, cancelled: reservations.filter(r=>r.status==='cancelled').length, avg_ticket: totalRevenue/(reservations.length||1), avg_duration: 3.5 },
    occupancy: houses.map(h => ({ house_name: h.name, reservations: reservations.filter(r=>r.house_id===h.id).length, total_rooms: rooms.filter(r=>r.house_id===h.id).length, occupancy_rate: Math.round(Math.random()*40+40) })),
    topCustomers: customers.map(c=>({ ...c, reservation_count: c.total_reservations, total_spent: c.total_spent })).sort((a,b)=>b.total_spent-a.total_spent).slice(0,5),
    nps: { avg_nps: 8.7, promoters: 18, neutrals: 5, detractors: 2, total: 25 },
  });
});

app.get('/api/reports/room-map', auth, (req, res) => {
  const map = houses.map(h => ({
    house_id: h.id, house_name: h.name, city_name: h.city_name,
    rooms: rooms.filter(r => r.house_id === h.id && r.active).map(r => {
      const activeRes = reservations.find(rv => rv.room_id === r.id && rv.status === 'confirmed');
      return {
        id: r.id, name: r.name, status: r.status,
        current_reservation: activeRes ? { id: activeRes.id, customer: activeRes.customer_whatsapp, check_in: activeRes.check_in, check_out: activeRes.check_out, total: activeRes.total_price } : null,
      };
    }),
  }));
  res.json(map);
});

// ADMIN USERS
app.get('/api/admin/users', auth, (req, res) => {
  res.json(admins.map(({ password_hash, ...u }) => u));
});
app.post('/api/admin/users', auth, async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  const user = { id: `admin-${Date.now()}`, ...req.body, password_hash: hash, active: true, last_login: null };
  admins.push(user);
  const { password_hash, ...u } = user;
  res.status(201).json(u);
});
app.patch('/api/admin/users/:id', auth, async (req, res) => {
  const idx = admins.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  if (req.body.password) { admins[idx].password_hash = await bcrypt.hash(req.body.password, 10); }
  admins[idx] = { ...admins[idx], ...req.body };
  const { password_hash, ...u } = admins[idx];
  res.json(u);
});

// CAMPAIGNS
app.get('/api/campaigns', auth, (req, res) => res.json(campaigns));
app.post('/api/campaigns', auth, (req, res) => {
  const c = { id: `camp-${Date.now()}`, ...req.body, status: 'draft', sent_count: 0, created_at: new Date().toISOString() };
  campaigns.push(c);
  res.status(201).json(c);
});
app.post('/api/campaigns/:id/send', auth, (req, res) => {
  const c = campaigns.find(c => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Não encontrada' });
  c.status = 'sent';
  c.sent_at = new Date().toISOString();
  c.sent_count = customers.length;
  res.json({ message: `Campanha enviada para ${c.sent_count} clientes (mock)` });
});

// SETTINGS
app.get('/api/settings', auth, (req, res) => res.json(settings));
app.patch('/api/settings/:key', auth, (req, res) => {
  const s = settings.find(s => s.key === req.params.key);
  if (!s) return res.status(404).json({ error: 'Não encontrada' });
  s.value = req.body.value;
  s.updated_at = new Date().toISOString();
  res.json(s);
});

// BOT test
app.post('/api/bot/test', (req, res) => res.json({ ok: true }));

// Webhooks
app.post('/api/webhooks/pix', (req, res) => res.json({ ok: true }));
app.post('/api/webhooks/whatsapp', (req, res) => res.json({ ok: true }));

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Mock Server rodando em http://localhost:${PORT}`);
  console.log(`   Modo: DEMONSTRAÇÃO (sem banco de dados)`);
  console.log(`   Login: admin@casadageyse.com.br / Admin@2024!\n`);
});
