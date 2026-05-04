require('dotenv').config();
const db = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Seeding database...');
  try {
    // Cidades
    await db.query(`
      INSERT INTO cities (id, name, state) VALUES
        ('11111111-1111-1111-1111-111111111111', 'Penha', 'SC'),
        ('22222222-2222-2222-2222-222222222222', 'Barra Velha', 'SC')
      ON CONFLICT DO NOTHING;
    `);

    // Casas
    await db.query(`
      INSERT INTO houses (id, city_id, name, address, neighborhood, description, active) VALUES
        ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
         'Penha Centro', 'Rua Porto Alegre, 987', 'Centro',
         'Casa aconchegante no centro de Penha, próxima ao mar.', true),
        ('aaaa0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
         'Penha Armação', 'Rua João Luiz Julierini, 154', 'Armação',
         'Unidade tranquila próxima à Armação.', true),
        ('aaaa0003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
         'Barra Velha Praia do Tabuleiro', 'Rua Calipto F. Gonzalez, 53', 'Praia do Tabuleiro',
         'Frente ao mar na Praia do Tabuleiro, Barra Velha.', true)
      ON CONFLICT DO NOTHING;
    `);

    // Quartos - Penha Centro
    await db.query(`
      INSERT INTO rooms (house_id, name, description, price_1h, price_2h, price_4h, price_8h, price_daily, amenities) VALUES
        ('aaaa0001-0000-0000-0000-000000000001', 'Quarto com TV', 'Quarto confortável com TV 32"', 80, 140, 220, 320, 450,
         '["TV 32\"","Ar condicionado","Banheiro privativo","Wi-Fi"]'),
        ('aaaa0001-0000-0000-0000-000000000001', 'Suíte com TV e banheiro', 'Suíte espaçosa com banheiro completo', 100, 180, 280, 400, 550,
         '["TV 40\"","Ar condicionado","Banheiro privativo","Wi-Fi","Frigobar"]')
      ON CONFLICT DO NOTHING;
    `);

    // Quartos - Penha Armação
    await db.query(`
      INSERT INTO rooms (house_id, name, description, price_1h, price_2h, price_4h, price_8h, price_daily, amenities) VALUES
        ('aaaa0002-0000-0000-0000-000000000002', 'Quarto com TV', 'Quarto com TV e banheiro', 80, 140, 220, 320, 450,
         '["TV 32\"","Banheiro privativo","Wi-Fi"]'),
        ('aaaa0002-0000-0000-0000-000000000002', 'Suíte com TV e banheiro', 'Suíte completa', 100, 180, 280, 400, 550,
         '["TV 40\"","Ar condicionado","Banheiro privativo","Wi-Fi"]')
      ON CONFLICT DO NOTHING;
    `);

    // Quartos - Barra Velha
    await db.query(`
      INSERT INTO rooms (house_id, name, description, price_1h, price_2h, price_4h, price_8h, price_daily, amenities) VALUES
        ('aaaa0003-0000-0000-0000-000000000003', 'Quarto com TV', 'Quarto padrão frente ao mar', 80, 140, 220, 320, 450,
         '["TV 32\"","Banheiro privativo","Wi-Fi","Vista para o mar"]'),
        ('aaaa0003-0000-0000-0000-000000000003', 'Quarto com sacada', 'Quarto com sacada e vista para o mar', 120, 200, 320, 450, 600,
         '["TV 40\"","Sacada","Ar condicionado","Banheiro privativo","Wi-Fi","Vista para o mar"]'),
        ('aaaa0003-0000-0000-0000-000000000003', 'Suíte com espelho', 'Suíte especial com espelho no teto', 150, 250, 400, 550, 700,
         '["TV 50\"","Espelho","Ar condicionado","Banheiro privativo","Wi-Fi","Frigobar"]')
      ON CONFLICT DO NOTHING;
    `);

    // Admin super usuário
    const passwordHash = await bcrypt.hash('Admin@2024!', 12);
    await db.query(`
      INSERT INTO admin_users (name, email, password_hash, role) VALUES
        ('Super Admin', 'admin@casadageyse.com.br', $1, 'super_admin')
      ON CONFLICT (email) DO NOTHING;
    `, [passwordHash]);

    // Configurações do sistema
    await db.query(`
      INSERT INTO system_settings (key, value, description) VALUES
        ('split_platform_percent', '20', 'Percentual da plataforma no split de pagamento'),
        ('split_house_percent', '60', 'Percentual da casa no split de pagamento'),
        ('split_companion_percent', '20', 'Percentual do acompanhante no split de pagamento'),
        ('pix_expiry_minutes', '10', 'Minutos para expiração do QR Code Pix'),
        ('renewal_alert_minutes', '15', 'Minutos antes do término para enviar alerta de renovação'),
        ('nps_delay_minutes', '60', 'Minutos após checkout para enviar NPS'),
        ('reactivation_days', '15', 'Dias de inatividade para enviar mensagem de reativação'),
        ('vip_min_reservations', '10', 'Número mínimo de reservas para status VIP'),
        ('loyalty_points_per_100', '10', 'Pontos por R$100 gastos'),
        ('loyalty_points_for_reward', '500', 'Pontos necessários para resgatar recompensa'),
        ('bot_welcome_message', 'Olá! Bem-vindo(a) à Casa da Geyse 🌹\n\nSomos um espaço exclusivo para adultos (+18) que oferece quartos mobiliados com privacidade e conforto em Santa Catarina.\n\nAntes de continuar, confirme: você tem 18 anos ou mais?\n\n✅ *SIM* - Confirmar maioridade\n❌ *NÃO* - Encerrar', 'Mensagem de boas-vindas do bot'),
        ('bot_underage_message', 'Desculpe, nosso serviço é exclusivo para maiores de 18 anos. Esta conversa será encerrada.\n\nAté logo! 👋', 'Mensagem para menores de idade'),
        ('business_hours_start', '08:00', 'Horário de início do atendimento'),
        ('business_hours_end', '02:00', 'Horário de fim do atendimento')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log('Seed completed successfully.');
    console.log('Admin login: admin@casadageyse.com.br / Admin@2024!');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await db.pool.end();
  }
}

seed();
