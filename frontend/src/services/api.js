import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// ── MOCK DATA ──────────────────────────────────────────────────────────────────
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
  { id: '1', room_id: '2', room_name: 'Quarto 2', house_name: 'Casa Principal', customer_id: '1', customer_name: 'João Pereira', companion_name: 'Ana Silva', check_in: new Date(Date.now() - 2*3600000).toISOString(), check_out: null, status: 'active', payment_status: 'paid', total_amount: 160, duration_hours: null },
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

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function wait(ms = 250) { return new Promise(r => setTimeout(r, ms)); }
function ok(data) { return { data }; }
function fail(msg, status = 400) { const e = new Error(msg); e.response = { data: { error: msg }, status }; throw e; }
function token(user) { return btoa(JSON.stringify({ ...user, exp: Date.now() + 7 * 86400000 })); }
function parseToken(t) { try { return JSON.parse(atob(t)); } catch { return null; } }

// ── MOCK ROUTER ────────────────────────────────────────────────────────────────
async function mockRequest(method, url, data, params) {
  await wait();
  const M = method.toUpperCase();
  const p = url.split('?')[0];

  // Auth
  if (M === 'POST' && p === '/api/auth/login') {
    const admin = ADMINS.find(a => a.email === data?.email && a.password === data?.password);
    if (!admin) fail('Email ou senha incorretos', 401);
    const user = { id: admin.id, name: admin.name, email: admin.email, role: admin.role };
    return ok({ user, token: token(user) });
  }
  if (M === 'GET' && p === '/api/auth/me') {
    const t = useAuthStore.getState().token;
    const user = parseToken(t);
    if (!user) fail('Token inválido', 401);
    return ok(user);
  }
  if (M === 'PUT' && p === '/api/auth/change-password') return ok({ message: 'Senha alterada' });

  // Houses
  if (M === 'GET' && p === '/api/houses') return ok(HOUSES);
  if (M === 'POST' && p === '/api/houses') { const h = { id: uid(), ...data, active: true, rooms_count: 0 }; HOUSES.push(h); return ok(h); }
  if (M === 'PUT' && p.match(/^\/api\/houses\/[^/]+$/)) { const i = HOUSES.findIndex(h => h.id === p.split('/')[3]); if (i > -1) HOUSES[i] = { ...HOUSES[i], ...data }; return ok(HOUSES[i]); }

  // Rooms
  if (M === 'GET' && p === '/api/rooms') {
    let r = ROOMS.filter(x => x.active);
    if (params?.house_id) r = r.filter(x => x.house_id === params.house_id);
    if (params?.status) r = r.filter(x => x.status === params.status);
    return ok(r);
  }
  if (M === 'POST' && p === '/api/rooms') { const r = { id: uid(), ...data, status: 'available', active: true }; ROOMS.push(r); return ok(r); }
  if (M === 'PUT' && p.match(/^\/api\/rooms\/[^/]+\/status$/)) {
    const id = p.split('/')[3];
    const room = ROOMS.find(r => r.id === id);
    if (!room) fail('Quarto não encontrado', 404);
    room.status = data?.status;
    return ok(room);
  }
  if (M === 'PUT' && p.match(/^\/api\/rooms\/[^/]+$/)) {
    const i = ROOMS.findIndex(r => r.id === p.split('/')[3]);
    if (i > -1) ROOMS[i] = { ...ROOMS[i], ...data };
    return ok(ROOMS[i]);
  }

  // Companions
  if (M === 'GET' && p === '/api/companions') {
    let c = [...COMPANIONS];
    if (params?.active !== undefined) c = c.filter(x => x.active === (params.active === 'true'));
    return ok(c);
  }
  if (M === 'GET' && p.match(/^\/api\/companions\/[^/]+$/)) {
    const c = COMPANIONS.find(x => x.id === p.split('/')[3]);
    if (!c) fail('Não encontrada', 404);
    return ok(c);
  }
  if (M === 'POST' && p === '/api/companions') { const c = { id: uid(), ...data, active: true, rating: 0, total_reservations: 0 }; COMPANIONS.push(c); return ok(c); }
  if (M === 'PUT' && p.match(/^\/api\/companions\/[^/]+$/)) { const i = COMPANIONS.findIndex(c => c.id === p.split('/')[3]); if (i > -1) COMPANIONS[i] = { ...COMPANIONS[i], ...data }; return ok(COMPANIONS[i]); }
  if (M === 'DELETE' && p.match(/^\/api\/companions\/[^/]+$/)) { const c = COMPANIONS.find(x => x.id === p.split('/')[3]); if (c) c.active = false; return ok({ message: 'Desativada' }); }

  // Customers
  if (M === 'GET' && p === '/api/customers') {
    let c = [...CUSTOMERS];
    if (params?.search) c = c.filter(x => x.name.toLowerCase().includes(params.search.toLowerCase()) || x.phone.includes(params.search));
    if (params?.status) c = c.filter(x => x.status === params.status);
    return ok(c);
  }
  if (M === 'GET' && p.match(/^\/api\/customers\/[^/]+$/)) {
    const c = CUSTOMERS.find(x => x.id === p.split('/')[3]);
    if (!c) fail('Não encontrado', 404);
    return ok({ ...c, reservations: RESERVATIONS.filter(r => r.customer_id === c.id) });
  }
  if (M === 'POST' && p === '/api/customers') { const c = { id: uid(), ...data, status: 'regular', loyalty_points: 0, total_reservations: 0, total_spent: 0, last_visit: null }; CUSTOMERS.push(c); return ok(c); }
  if (M === 'PUT' && p.match(/^\/api\/customers\/[^/]+$/)) { const i = CUSTOMERS.findIndex(c => c.id === p.split('/')[3]); if (i > -1) CUSTOMERS[i] = { ...CUSTOMERS[i], ...data }; return ok(CUSTOMERS[i]); }

  // Reservations
  if (M === 'GET' && p === '/api/reservations') {
    let r = [...RESERVATIONS];
    if (params?.status) r = r.filter(x => x.status === params.status);
    return ok(r);
  }
  if (M === 'POST' && p === '/api/reservations') {
    const room = ROOMS.find(r => r.id === data?.room_id);
    const customer = CUSTOMERS.find(c => c.id === data?.customer_id);
    const companion = COMPANIONS.find(c => c.id === data?.companion_id);
    const res = { id: uid(), ...data, room_name: room?.name, house_name: room?.house_name, customer_name: customer?.name, companion_name: companion?.name || null, check_in: new Date().toISOString(), check_out: null, status: 'active', payment_status: 'pending', total_amount: null, duration_hours: null };
    RESERVATIONS.push(res);
    if (room) room.status = 'occupied';
    return ok(res);
  }
  if (M === 'PUT' && p.match(/^\/api\/reservations\/[^/]+\/checkout$/)) {
    const id = p.split('/')[3];
    const i = RESERVATIONS.findIndex(r => r.id === id);
    if (i === -1) fail('Não encontrada', 404);
    const r = RESERVATIONS[i];
    const checkOut = new Date();
    const durationHours = Math.max(1, Math.ceil((checkOut - new Date(r.check_in)) / 3600000));
    const room = ROOMS.find(rm => rm.id === r.room_id);
    const total = durationHours * (room?.price_per_hour || 100);
    RESERVATIONS[i] = { ...r, check_out: checkOut.toISOString(), duration_hours: durationHours, status: 'completed', total_amount: total };
    if (room) room.status = 'available';
    return ok(RESERVATIONS[i]);
  }
  if (M === 'PUT' && p.match(/^\/api\/reservations\/[^/]+\/cancel$/)) {
    const id = p.split('/')[3];
    const i = RESERVATIONS.findIndex(r => r.id === id);
    if (i > -1) { RESERVATIONS[i].status = 'cancelled'; const room = ROOMS.find(rm => rm.id === RESERVATIONS[i].room_id); if (room) room.status = 'available'; }
    return ok(RESERVATIONS[i]);
  }

  // Reports
  if (M === 'GET' && p === '/api/reports/dashboard') {
    return ok({
      active_reservations: RESERVATIONS.filter(r => r.status === 'active').length,
      completed_today: RESERVATIONS.filter(r => r.status === 'completed').length,
      revenue_today: 1240, revenue_month: 28450,
      occupied_rooms: ROOMS.filter(r => r.status === 'occupied').length,
      total_rooms: ROOMS.filter(r => r.active).length,
      occupancy_rate: 43, new_customers_month: 8,
      top_companions: COMPANIONS.slice(0,3).map(c => ({ name: c.name, reservations: c.total_reservations, revenue: c.total_reservations * 120 })),
      revenue_by_day: Array.from({length:7}, (_,i) => ({ date: new Date(Date.now()-(6-i)*86400000).toLocaleDateString('pt-BR'), revenue: Math.floor(Math.random()*1500)+500, reservations: Math.floor(Math.random()*15)+5 })),
      revenue_by_house: HOUSES.map(h => ({ name: h.name, revenue: Math.floor(Math.random()*5000)+2000 })),
    });
  }
  if (M === 'GET' && p === '/api/reports/financial') return ok({ total_revenue: 45000, platform_revenue: 9000, house_revenue: 27000, companion_revenue: 9000, total_reservations: 280, avg_ticket: 160, by_payment_method: [{ method: 'pix', count: 210, total: 33600 },{ method: 'cash', count: 70, total: 11200 }] });
  if (M === 'GET' && p === '/api/reports/occupancy') return ok(ROOMS.map(r => ({ ...r, occupancy_rate: Math.floor(Math.random()*40)+60 })));

  // Campaigns
  if (M === 'GET' && p === '/api/campaigns') return ok(CAMPAIGNS);
  if (M === 'POST' && p === '/api/campaigns') { const c = { id: uid(), ...data, status: 'draft', sent_count: 0, created_at: new Date().toISOString() }; CAMPAIGNS.push(c); return ok(c); }
  if (M === 'POST' && p.match(/^\/api\/campaigns\/[^/]+\/send$/)) {
    const i = CAMPAIGNS.findIndex(c => c.id === p.split('/')[3]);
    if (i > -1) { CAMPAIGNS[i].status = 'sent'; CAMPAIGNS[i].sent_count = CUSTOMERS.length; }
    return ok({ message: 'Campanha enviada', sent: CUSTOMERS.length });
  }
  if (M === 'DELETE' && p.match(/^\/api\/campaigns\/[^/]+$/)) { const i = CAMPAIGNS.findIndex(c => c.id === p.split('/')[3]); if (i > -1) CAMPAIGNS.splice(i, 1); return ok({ message: 'Removida' }); }

  // Settings
  if (M === 'GET' && p === '/api/settings') return ok(SETTINGS);
  if (M === 'PUT' && p === '/api/settings') { Object.assign(SETTINGS, data); return ok(SETTINGS); }

  // Admin users
  if (M === 'GET' && p === '/api/admin/users') return ok(ADMINS.map(a => ({ id: a.id, name: a.name, email: a.email, role: a.role, active: true })));
  if (M === 'POST' && p === '/api/admin/users') { const a = { id: uid(), ...data, active: true }; ADMINS.push(a); return ok({ id: a.id, name: a.name, email: a.email, role: a.role, active: true }); }

  // Pix
  if (M === 'POST' && p === '/api/payments/pix/generate') return ok({ txid: uid(), qr_code: 'MOCK_PIX_' + Date.now(), amount: data?.amount || 100, expires_at: new Date(Date.now()+600000).toISOString(), status: 'pending' });

  // Cities
  if (M === 'GET' && p === '/api/cities') return ok([{ id: '1', name: 'Penha', state: 'SC' }, { id: '2', name: 'Barra Velha', state: 'SC' }]);

  fail(`Rota não encontrada: ${M} ${p}`, 404);
}

// ── API OBJECT ─────────────────────────────────────────────────────────────────
const USE_MOCK = !import.meta.env.VITE_API_URL;

let api;

if (USE_MOCK) {
  // Mock implementation - no real HTTP calls
  api = {
    get: (url, config) => mockRequest('GET', url, null, config?.params),
    post: (url, data) => mockRequest('POST', url, data, null),
    put: (url, data) => mockRequest('PUT', url, data, null),
    delete: (url) => mockRequest('DELETE', url, null, null),
  };
} else {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    timeout: 15000,
  });
  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }
  );
  api = instance;
}

export default api;
