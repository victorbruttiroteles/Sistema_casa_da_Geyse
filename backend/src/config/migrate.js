require('dotenv').config();
const db = require('./database');

const schema = `
-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Cidades
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL DEFAULT 'SC',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Casas / Unidades
CREATE TABLE IF NOT EXISTS houses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id UUID NOT NULL REFERENCES cities(id),
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL,
  address_number VARCHAR(20),
  neighborhood VARCHAR(100),
  zip_code VARCHAR(10),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  description TEXT,
  rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INT DEFAULT 0,
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  access_instructions TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fotos das Casas
CREATE TABLE IF NOT EXISTS house_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  is_cover BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quartos
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  capacity INT DEFAULT 2,
  price_1h DECIMAL(10,2),
  price_2h DECIMAL(10,2),
  price_4h DECIMAL(10,2),
  price_8h DECIMAL(10,2),
  price_daily DECIMAL(10,2),
  amenities JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','maintenance')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fotos dos Quartos
CREATE TABLE IF NOT EXISTS room_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  is_cover BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acompanhantes
CREATE TABLE IF NOT EXISTS companions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artistic_name VARCHAR(100) NOT NULL,
  bio VARCHAR(200),
  gender VARCHAR(20) CHECK (gender IN ('feminino','masculino','nao_binario','trans_feminina','trans_masculino')),
  age_range VARCHAR(20) CHECK (age_range IN ('18-25','26-35','36-45','46+')),
  languages VARCHAR(100)[] DEFAULT '{}',
  categories VARCHAR(100)[] DEFAULT '{}',
  price_per_hour DECIMAL(10,2) NOT NULL,
  rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available','busy','paused','inactive')),
  approved BOOLEAN DEFAULT false,
  bank_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cidades de atuação dos acompanhantes
CREATE TABLE IF NOT EXISTS companion_cities (
  companion_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  price_per_hour DECIMAL(10,2),
  PRIMARY KEY (companion_id, city_id)
);

-- Fotos dos Acompanhantes
CREATE TABLE IF NOT EXISTS companion_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  companion_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  approved BOOLEAN DEFAULT false,
  is_cover BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes (CRM)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  whatsapp VARCHAR(30) UNIQUE NOT NULL,
  whatsapp_hash VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(150),
  opted_in_at TIMESTAMPTZ,
  age_confirmed BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','blocked','vip')),
  loyalty_points INT DEFAULT 0,
  referral_code VARCHAR(20) UNIQUE,
  referred_by UUID REFERENCES customers(id),
  nps_average DECIMAL(4,2),
  total_spent DECIMAL(12,2) DEFAULT 0,
  total_reservations INT DEFAULT 0,
  last_reservation_at TIMESTAMPTZ,
  preferred_house_id UUID REFERENCES houses(id),
  tags VARCHAR(50)[] DEFAULT '{}',
  notes TEXT,
  blocked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservas
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  house_id UUID NOT NULL REFERENCES houses(id),
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ NOT NULL,
  duration_hours DECIMAL(4,1) NOT NULL,
  duration_type VARCHAR(20) CHECK (duration_type IN ('1h','2h','4h','8h','daily')),
  room_price DECIMAL(10,2) NOT NULL,
  companions_price DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','active','completed','cancelled','expired')),
  access_code VARCHAR(20),
  renewal_count INT DEFAULT 0,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  refund_amount DECIMAL(10,2),
  refund_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acompanhantes por Reserva
CREATE TABLE IF NOT EXISTS reservation_companions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES companions(id),
  price_per_hour DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pagamentos
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES reservations(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(30) DEFAULT 'reservation' CHECK (type IN ('reservation','renewal','refund')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','expired','failed','refunded')),
  pix_txid VARCHAR(100) UNIQUE,
  pix_e2e_id VARCHAR(100),
  pix_qr_code TEXT,
  pix_qr_code_image TEXT,
  pix_expiry TIMESTAMPTZ,
  split_platform DECIMAL(10,2),
  split_house DECIMAL(10,2),
  split_companions DECIMAL(10,2),
  confirmed_at TIMESTAMPTZ,
  gateway_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NPS
CREATE TABLE IF NOT EXISTS nps_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES reservations(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  score INT NOT NULL CHECK (score >= 0 AND score <= 10),
  comment TEXT,
  companion_id UUID REFERENCES companions(id),
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  support_ticket_created BOOLEAN DEFAULT false
);

-- Usuários Admin
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) DEFAULT 'receptionist' CHECK (role IN ('super_admin','house_manager','receptionist','financial')),
  house_id UUID REFERENCES houses(id),
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessões de Conversa WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  whatsapp VARCHAR(30) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  step VARCHAR(50) NOT NULL DEFAULT 'welcome',
  context JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 hours',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campanhas de Marketing
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  target_status VARCHAR(20)[],
  target_tags VARCHAR(50)[],
  target_cities UUID[],
  min_reservations INT,
  max_reservations INT,
  last_reservation_days INT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','cancelled')),
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Programa de Fidelidade - Transações de Pontos
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  points INT NOT NULL,
  type VARCHAR(30) CHECK (type IN ('earned','redeemed','bonus','expired')),
  description VARCHAR(255),
  reservation_id UUID REFERENCES reservations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indicações
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES customers(id),
  referred_id UUID NOT NULL REFERENCES customers(id),
  discount_amount DECIMAL(10,2),
  discount_applied BOOLEAN DEFAULT false,
  discount_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações do Sistema
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_reservations_customer ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room ON reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_check_in ON reservations(check_in);
CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_pix_txid ON payments(pix_txid);
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp ON customers(whatsapp);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_rooms_house ON rooms(house_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_whatsapp ON whatsapp_sessions(whatsapp);
CREATE INDEX IF NOT EXISTS idx_nps_ratings_reservation ON nps_ratings(reservation_id);
`;

async function migrate() {
  console.log('Running database migrations...');
  try {
    await db.query(schema);
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

migrate();
