function uid() { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }

const ADMINS = [
  { id: '1', name: 'Administrador', email: 'admin@casadageyse.com.br', password: 'Admin@2024!', role: 'super_admin' },
  { id: '2', name: 'Recepcionista', email: 'recepcao@casadageyse.com.br', password: 'Recepcao@2024!', role: 'receptionist' },
];

const HOUSES = [
  { id: '1', name: 'Casa Principal', city_name: 'Penha', address: 'Rua das Flores, 123', active: true, rooms_count: 4 },
  { id: '2', name: 'Casa Barra', city_name: 'Barra Velha', address: 'Av. Beira Mar, 456', active: true, rooms_count: 3 },
];

const ROOMS = [
  { id: '1', house_id: '1', house_name: 'Casa Principal', name: 'Quarto 1', number: '01', price_per_hour: 80, status: 'available', active: true },
  { id: '2', house_id: '1', house_name: 'Casa Principal', name: 'Quarto 2', number: '02', price_per_hour: 100, status: 'occupied', active: true },
  { id: '3', house_id: '1', house_name: 'Casa Principal', name: 'Suíte VIP', number: '03', price_per_hour: 150, status: 'available', active: true },
  { id: '4', house_id: '1', house_name: 'Casa Principal', name: 'Quarto 4', number: '04', price_per_hour: 80, status: 'cleaning', active: true },
  { id: '5', house_id: '2', house_name: 'Casa Barra', name: 'Quarto A', number: 'A', price_per_hour: 90, status: 'available', active: true },
  { id: '6', house_id: '2', house_name: 'Casa Barra', name: 'Quarto B', number: 'B', price_per_hour: 90, status: 'available', active: true },
  { id: '7', house_id: '2', house_name: 'Casa Barra', name: 'Suíte Premium', number: 'C', price_per_hour: 160, status: 'maintenance', active: true },
];

const COMPANIONS = [
  { id: '1', name: 'Ana Silva', phone: '47991110001', age: 24, active: true, rating: 4.8, total_reservations: 42, house_name: 'Casa Principal', city_name: 'Penha', commission_percent: 20 },
  { id: '2', name: 'Beatriz Santos', phone: '47991110002', age: 26, active: true, rating: 4.9, total_reservations: 67, house_name: 'Casa Principal', city_name: 'Penha', commission_percent: 20 },
  { id: '3', name: 'Carla Oliveira', phone: '47991110003', age: 23, active: true, rating: 4.7, total_reservations: 28, house_name: 'Casa Barra', city_name: 'Barra Velha', commission_percent: 20 },
  { id: '4', name: 'Diana Costa', phone: '47991110004', age: 25, active: false, rating: 4.6, total_reservations: 15, house_name: 'Casa Barra', city_name: 'Barra Velha', commission_percent: 20 },
];

const CUSTOMERS = [
  { id: '1', name: 'João Pereira', phone: '47999990001', status: 'vip', loyalty_points: 850, total_reservations: 12, total_spent: 2400, last_visit: '2024-12-20' },
  { id: '2', name: 'Carlos Mendes', phone: '47999990002', status: 'regular', loyalty_points: 120, total_reservations: 3, total_spent: 480, last_visit: '2024-12-15' },
  { id: '3', name: 'Roberto Lima', phone: '47999990003', status: 'regular', loyalty_points: 200, total_reservations: 5, total_spent: 750, last_visit: '2024-12-01' },
];

const RESERVATIONS = [
  { id: '1', room_id: '2', room_name: 'Quarto 2', house_name: 'Casa Principal', customer_id: '1', customer_name: 'João Pereira', companion_name: 'Ana Silva', check_in: new Date(Date.now() - 2*3600000).toISOString(), check_out: null, status: 'active', payment_status: 'paid', total_amount: 160 },
  { id: '2', room_id: '1', room_name: 'Quarto 1', house_name: 'Casa Principal', customer_id: '2', customer_name: 'Carlos Mendes', companion_name: 'Beatriz Santos', check_in: new Date(Date.now() - 5*3600000).toISOString(), check_out: new Date(Date.now() - 3*3600000).toISOString(), status: 'completed', payment_status: 'paid', total_amount: 160, duration_hours: 2 },
];

const CAMPAIGNS = [
  { id: '1', name: 'Promoção Fim de Semana', message: 'Aproveite nossos quartos com desconto!', status: 'sent', sent_count: 45, created_at: '2024-12-01' },
  { id: '2', name: 'Clientes VIP', message: 'Oferta exclusiva para você!', status: 'draft', sent_count: 0, created_at: '2024-12-10' },
];

const SETTINGS = {
  split_platform_percent: 20, split_house_percent: 60, split_companion_percent: 20,
  pix_expiry_minutes: 10, renewal_alert_minutes: 15, nps_delay_minutes: 60,
  reactivation_days: 15, vip_min_reservations: 10, loyalty_points_per_100: 10,
  loyalty_points_for_reward: 500, admin_whatsapp: '5548999999999',
};

function delay(ms = 300) { return new Promise(r => setTimeout(r, ms)); }
function ok(data) { return Promise.resolve({ data }); }
function err(msg, status = 400) { const e = new Error(msg); e.response = { data: { error: msg }, status }; return Promise.reject(e); }

// Simple JWT-like token (base64 encoded JSON)
function makeToken(user) { return btoa(JSON.stringify({ ...user, exp: Date.now() + 7*86400000 })); }
function parseToken(token) { try { return JSON.parse(atob(token)); } catch { return null; } }

const mockHandlers = {
  'POST /api/auth/login': async ({ email, password }) => {
    await delay();
    const admin = ADMINS.find(a => a.email === email && a.password === password);
    if (!admin) return err('Email ou senha incorretos', 401);
    const user = { id: admin.id, name: admin.name, email: admin.email, role: admin.role };
    return ok({ user, token: makeToken(user) });
  },
  'GET /api/auth/me': async (_, token) => {
    await delay(100);
    const user = parseToken(token);
    if (!user) return err('Token inválido', 401);
    return ok(user);
  },
  'GET /api/houses': async () => { await delay(200); return ok(HOUSES); },
  'GET /api/rooms': async ({ house_id, status } = {}) => {
    await delay(200);
    let r = ROOMS.filter(r => r.active);
    if (house_id) r = r.filter(x => x.house_id === house_id);
    if (status) r = r.filter(x => x.status === status);
    return ok(r);
  },
  'PUT /api/rooms/:id/status': async ({ id, status }) => {
    await delay(200);
    const room = ROOMS.find(r => r.id === id);
    if (!room) return err('Quarto não encontrado', 404);
    room.status = status;
    return ok(room);
  },
  'GET /api/companions': async ({ active } = {}) => {
    await delay(200);
    let c = [...COMPANIONS];
    if (active !== undefined) c = c.filter(x => x.active === (active === 'true' || active === true));
    return ok(c);
  },
  'GET /api/customers': async ({ search, status } = {}) => {
    await delay(200);
    let c = [...CUSTOMERS];
    if (search) c = c.filter(x => x.name.toLowerCase().includes(search.toLowerCase()) || x.phone.includes(search));
    if (status) c = c.filter(x => x.status === status);
    return ok(c);
  },
  'GET /api/customers/:id': async ({ id }) => {
    await delay(200);
    const c = CUSTOMERS.find(x => x.id === id);
    if (!c) return err('Cliente não encontrado', 404);
    return ok({ ...c, reservations: RESERVATIONS.filter(r => r.customer_id === id) });
  },
  'GET /api/reservations': async ({ status } = {}) => {
    await delay(200);
    let r = [...RESERVATIONS];
    if (status) r = r.filter(x => x.status === status);
    return ok(r);
  },
  'POST /api/reservations': async (body) => {
    await delay(300);
    const room = ROOMS.find(r => r.id === body.room_id);
    const customer = CUSTOMERS.find(c => c.id === body.customer_id);
    const companion = COMPANIONS.find(c => c.id === body.companion_id);
    const res = { id: uid(), ...body, room_name: room?.name, house_name: room?.house_name, customer_name: customer?.name, companion_name: companion?.name || null, check_in: new Date().toISOString(), check_out: null, status: 'active', payment_status: 'pending', total_amount: null };
    RESERVATIONS.push(res);
    if (room) room.status = 'occupied';
    return ok(res);
  },
  'PUT /api/reservations/:id/checkout': async ({ id }) => {
    await delay(300);
    const i = RESERVATIONS.findIndex(r => r.id === id);
    if (i === -1) return err('Reserva não encontrada', 404);
    const r = RESERVATIONS[i];
    const checkOut = new Date();
    const durationHours = Math.ceil((checkOut - new Date(r.check_in)) / 3600000);
    const room = ROOMS.find(rm => rm.id === r.room_id);
    const total = durationHours * (room?.price_per_hour || 100);
    RESERVATIONS[i] = { ...r, check_out: checkOut.toISOString(), duration_hours: durationHours, status: 'completed', total_amount: total };
    if (room) room.status = 'available';
    return ok(RESERVATIONS[i]);
  },
  'PUT /api/reservations/:id/cancel': async ({ id }) => {
    await delay(200);
    const i = RESERVATIONS.findIndex(r => r.id === id);
    if (i === -1) return err('Reserva não encontrada', 404);
    RESERVATIONS[i].status = 'cancelled';
    const room = ROOMS.find(rm => rm.id === RESERVATIONS[i].room_id);
    if (room) room.status = 'available';
    return ok(RESERVATIONS[i]);
  },
  'GET /api/reports/dashboard': async () => {
    await delay(300);
    return ok({
      active_reservations: RESERVATIONS.filter(r => r.status === 'active').length,
      completed_today: RESERVATIONS.filter(r => r.status === 'completed').length,
      revenue_today: 1240,
      revenue_month: 28450,
      occupied_rooms: ROOMS.filter(r => r.status === 'occupied').length,
      total_rooms: ROOMS.filter(r => r.active).length,
      occupancy_rate: 43,
      new_customers_month: 8,
      top_companions: COMPANIONS.slice(0,3).map(c => ({ name: c.name, reservations: c.total_reservations, revenue: c.total_reservations * 120 })),
      revenue_by_day: Array.from({length:7}, (_,i) => ({ date: new Date(Date.now()-(6-i)*86400000).toLocaleDateString('pt-BR'), revenue: Math.floor(Math.random()*1500)+500, reservations: Math.floor(Math.random()*15)+5 })),
      revenue_by_house: HOUSES.map(h => ({ name: h.name, revenue: Math.floor(Math.random()*5000)+2000 })),
    });
  },
  'GET /api/reports/financial': async () => {
    await delay(200);
    return ok({ total_revenue: 45000, platform_revenue: 9000, house_revenue: 27000, companion_revenue: 9000, total_reservations: 280, avg_ticket: 160, by_payment_method: [{ method: 'pix', count: 210, total: 33600 },{ method: 'cash', count: 70, total: 11200 }] });
  },
  'GET /api/reports/occupancy': async () => { await delay(200); return ok(ROOMS.map(r => ({ ...r, occupancy_rate: Math.floor(Math.random()*40)+60 }))); },
  'GET /api/campaigns': async () => { await delay(200); return ok(CAMPAIGNS); },
  'POST /api/campaigns': async (body) => {
    await delay(200);
    const c = { id: uid(), ...body, status: 'draft', sent_count: 0, created_at: new Date().toISOString() };
    CAMPAIGNS.push(c);
    return ok(c);
  },
  'POST /api/campaigns/:id/send': async ({ id }) => {
    await delay(500);
    const i = CAMPAIGNS.findIndex(c => c.id === id);
    if (i === -1) return err('Campanha não encontrada', 404);
    CAMPAIGNS[i].status = 'sent'; CAMPAIGNS[i].sent_count = CUSTOMERS.length;
    return ok({ message: 'Campanha enviada', sent: CUSTOMERS.length });
  },
  'DELETE /api/campaigns/:id': async ({ id }) => {
    await delay(200);
    const i = CAMPAIGNS.findIndex(c => c.id === id);
    if (i !== -1) CAMPAIGNS.splice(i, 1);
    return ok({ message: 'Removida' });
  },
  'GET /api/settings': async () => { await delay(200); return ok(SETTINGS); },
  'PUT /api/settings': async (body) => { await delay(200); Object.assign(SETTINGS, body); return ok(SETTINGS); },
  'GET /api/admin/users': async () => {
    await delay(200);
    return ok(ADMINS.map(a => ({ id: a.id, name: a.name, email: a.email, role: a.role, active: true })));
  },
  'POST /api/payments/pix/generate': async (body) => {
    await delay(300);
    return ok({ txid: uid(), qr_code: 'MOCK_PIX_' + Date.now(), amount: body.amount || 100, expires_at: new Date(Date.now()+600000).toISOString(), status: 'pending' });
  },
};

function matchRoute(method, url, handlers) {
  const path = url.split('?')[0];
  const params = {};
  for (const key of Object.keys(handlers)) {
    const [hMethod, hPath] = key.split(' ');
    if (hMethod !== method) continue;
    const hParts = hPath.split('/');
    const pParts = path.split('/');
    if (hParts.length !== pParts.length) continue;
    let match = true;
    for (let i = 0; i < hParts.length; i++) {
      if (hParts[i].startsWith(':')) { params[hParts[i].slice(1)] = pParts[i]; }
      else if (hParts[i] !== pParts[i]) { match = false; break; }
    }
    if (match) return { handler: handlers[key], params };
  }
  return null;
}

export function createMockAdapter(axiosInstance) {
  axiosInstance.interceptors.request.use(async (config) => {
    const method = config.method.toUpperCase();
    const url = config.url || '';
    const queryParams = config.params || {};
    const body = config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : {};
    const token = config.headers?.Authorization?.replace('Bearer ', '');

    const match = matchRoute(method, url, mockHandlers);
    if (match) {
      const payload = { ...queryParams, ...body, ...match.params };
      try {
        const result = await match.handler(payload, token);
        return Promise.reject({ isMockResponse: true, response: result });
      } catch (e) {
        if (e.isMockResponse) throw e;
        return Promise.reject({ isMockResponse: true, response: e });
      }
    }
    return config;
  });

  axiosInstance.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.isMockResponse) {
        if (err.response && err.response.data && !err.response.data.error) {
          return Promise.resolve(err.response);
        }
        return Promise.reject(err.response);
      }
      return Promise.reject(err);
    }
  );
}
