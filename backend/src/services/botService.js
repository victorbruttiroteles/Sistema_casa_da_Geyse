const db = require('../config/database');
const { getRedisClient } = require('../config/redis');
const { sendWhatsAppMessage } = require('./whatsapp');
const { createPixCharge } = require('./pix');
const { generateAccessCode } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const DURATION_MAP = { '1h': 1, '2h': 2, '4h': 4, '8h': 8, 'daily': 24 };
const DURATION_LABELS = { '1h': '1 hora', '2h': '2 horas', '4h': '4 horas', '8h': '8 horas', 'daily': 'Diária' };

async function getSession(whatsapp) {
  const redis = await getRedisClient();
  const data = await redis.get(`bot:session:${whatsapp}`);
  return data ? JSON.parse(data) : { step: 'welcome', context: {} };
}

async function saveSession(whatsapp, session) {
  const redis = await getRedisClient();
  await redis.setEx(`bot:session:${whatsapp}`, 7200, JSON.stringify(session));
}

async function clearSession(whatsapp) {
  const redis = await getRedisClient();
  await redis.del(`bot:session:${whatsapp}`);
}

async function getSetting(key) {
  const { rows } = await db.query('SELECT value FROM system_settings WHERE key = $1', [key]);
  return rows[0]?.value;
}

async function getOrCreateCustomer(whatsapp) {
  const whatsappHash = crypto.createHash('sha256').update(whatsapp).digest('hex');
  let { rows } = await db.query('SELECT * FROM customers WHERE whatsapp = $1', [whatsapp]);

  if (!rows[0]) {
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const result = await db.query(
      'INSERT INTO customers (whatsapp, whatsapp_hash, referral_code) VALUES ($1,$2,$3) RETURNING *',
      [whatsapp, whatsappHash, referralCode]
    );
    return result.rows[0];
  }
  return rows[0];
}

async function botService(payload) {
  // Suporte a Evolution API v1 e v2
  const message = payload?.data?.message || payload?.message;
  const from = payload?.data?.key?.remoteJid || payload?.key?.remoteJid || '';
  const whatsapp = from.replace('@s.whatsapp.net', '').replace('@c.us', '');

  if (!whatsapp || !message) return;

  // Ignorar mensagens de grupos
  if (from.includes('@g.us')) return;

  const text = (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.title ||
    ''
  ).trim();

  if (!text) return;

  const session = await getSession(whatsapp);
  const upperText = text.toUpperCase();

  // Comando de reset
  if (upperText === 'REINICIAR' || upperText === 'MENU' || upperText === 'OI' || upperText === 'OLÁ' || upperText === 'OLA') {
    await clearSession(whatsapp);
    return handleStep('welcome', whatsapp, '', {});
  }

  return handleStep(session.step, whatsapp, text, session.context);
}

async function handleStep(step, whatsapp, text, context) {
  const upperText = text.toUpperCase().trim();

  switch (step) {
    case 'welcome': {
      const welcomeMsg = await getSetting('bot_welcome_message');
      await sendWhatsAppMessage(whatsapp, welcomeMsg);
      await saveSession(whatsapp, { step: 'age_confirm', context });
      break;
    }

    case 'age_confirm': {
      if (upperText === 'SIM' || upperText === 'S' || upperText === '1') {
        const customer = await getOrCreateCustomer(whatsapp);
        await db.query(
          'UPDATE customers SET age_confirmed = true, opted_in_at = NOW(), status = COALESCE(NULLIF(status,\'inactive\'),\'active\'), updated_at = NOW() WHERE id = $1',
          [customer.id]
        );
        const cities = await db.query('SELECT * FROM cities WHERE active = true ORDER BY name');
        let msg = `✅ Ótimo! Bem-vindo(a) à Casa da Geyse!\n\n🏙️ *Escolha a cidade:*\n\n`;
        cities.rows.forEach((c, i) => { msg += `*${i + 1}* - ${c.name} (${c.state})\n`; });
        await sendWhatsAppMessage(whatsapp, msg);
        await saveSession(whatsapp, { step: 'select_city', context: { customerId: customer.id, cities: cities.rows } });
      } else if (upperText === 'NÃO' || upperText === 'NAO' || upperText === 'N' || upperText === '2') {
        const underageMsg = await getSetting('bot_underage_message');
        await sendWhatsAppMessage(whatsapp, underageMsg);
        await clearSession(whatsapp);
      } else {
        await sendWhatsAppMessage(whatsapp, 'Por favor, responda *SIM* ou *NÃO*.');
      }
      break;
    }

    case 'select_city': {
      const idx = parseInt(text) - 1;
      if (isNaN(idx) || idx < 0 || idx >= context.cities.length) {
        await sendWhatsAppMessage(whatsapp, `Por favor, escolha uma opção de 1 a ${context.cities.length}.`);
        return;
      }
      const city = context.cities[idx];
      const houses = await db.query(
        'SELECT * FROM houses WHERE city_id = $1 AND active = true ORDER BY name',
        [city.id]
      );
      let msg = `🏠 *Unidades em ${city.name}:*\n\n`;
      houses.rows.forEach((h, i) => { msg += `*${i + 1}* - ${h.name}\n   📍 ${h.address}\n\n`; });
      await sendWhatsAppMessage(whatsapp, msg);
      await saveSession(whatsapp, { step: 'select_house', context: { ...context, cityId: city.id, cityName: city.name, houses: houses.rows } });
      break;
    }

    case 'select_house': {
      const idx = parseInt(text) - 1;
      if (isNaN(idx) || idx < 0 || idx >= context.houses.length) {
        await sendWhatsAppMessage(whatsapp, `Por favor, escolha uma opção de 1 a ${context.houses.length}.`);
        return;
      }
      const house = context.houses[idx];
      const rooms = await db.query(
        "SELECT * FROM rooms WHERE house_id = $1 AND active = true AND status != 'maintenance' ORDER BY name",
        [house.id]
      );
      let msg = `🛏️ *Quartos disponíveis em ${house.name}:*\n\n`;
      rooms.rows.forEach((r, i) => {
        msg += `*${i + 1}* - ${r.name}\n`;
        if (r.price_1h) msg += `   1h: R$${parseFloat(r.price_1h).toFixed(2)}\n`;
        if (r.price_2h) msg += `   2h: R$${parseFloat(r.price_2h).toFixed(2)}\n`;
        if (r.price_4h) msg += `   4h: R$${parseFloat(r.price_4h).toFixed(2)}\n`;
        if (r.price_8h) msg += `   8h: R$${parseFloat(r.price_8h).toFixed(2)}\n`;
        if (r.price_daily) msg += `   Diária: R$${parseFloat(r.price_daily).toFixed(2)}\n`;
        msg += '\n';
      });
      await sendWhatsAppMessage(whatsapp, msg);
      await saveSession(whatsapp, { step: 'select_room', context: { ...context, houseId: house.id, houseName: house.name, rooms: rooms.rows } });
      break;
    }

    case 'select_room': {
      const idx = parseInt(text) - 1;
      if (isNaN(idx) || idx < 0 || idx >= context.rooms.length) {
        await sendWhatsAppMessage(whatsapp, `Por favor, escolha uma opção de 1 a ${context.rooms.length}.`);
        return;
      }
      const room = context.rooms[idx];
      const msg = `⏱️ *Qual será a duração?*\n\n` +
        `${room.price_1h ? '*1* - 1 hora (R$' + parseFloat(room.price_1h).toFixed(2) + ')\n' : ''}` +
        `${room.price_2h ? '*2* - 2 horas (R$' + parseFloat(room.price_2h).toFixed(2) + ')\n' : ''}` +
        `${room.price_4h ? '*3* - 4 horas (R$' + parseFloat(room.price_4h).toFixed(2) + ')\n' : ''}` +
        `${room.price_8h ? '*4* - 8 horas (R$' + parseFloat(room.price_8h).toFixed(2) + ')\n' : ''}` +
        `${room.price_daily ? '*5* - Diária (R$' + parseFloat(room.price_daily).toFixed(2) + ')\n' : ''}`;
      await sendWhatsAppMessage(whatsapp, msg);
      await saveSession(whatsapp, { step: 'select_duration', context: { ...context, roomId: room.id, roomName: room.name, room } });
      break;
    }

    case 'select_duration': {
      const durationMap = ['1h', '2h', '4h', '8h', 'daily'];
      const idx = parseInt(text) - 1;
      const durationKey = durationMap[idx];
      const priceField = `price_${durationKey}`;

      if (!durationKey || !context.room[priceField]) {
        await sendWhatsAppMessage(whatsapp, 'Opção inválida. Por favor, escolha um número da lista.');
        return;
      }

      await sendWhatsAppMessage(whatsapp, '🤝 *Deseja adicionar um acompanhante à sua reserva?*\n\n*1* - Sim, quero ver os perfis\n*2* - Não, ir direto para o pagamento');
      await saveSession(whatsapp, { step: 'ask_companion', context: { ...context, durationKey, price: parseFloat(context.room[priceField]) } });
      break;
    }

    case 'ask_companion': {
      if (upperText === '1' || upperText === 'SIM' || upperText === 'S') {
        const companions = await db.query(`
          SELECT c.*, cc.price_per_hour as city_price FROM companions c
          LEFT JOIN companion_cities cc ON cc.companion_id = c.id AND cc.city_id = $1
          WHERE c.approved = true AND c.status = 'available'
          ORDER BY c.rating DESC LIMIT 10
        `, [context.cityId]);

        if (companions.rows.length === 0) {
          await sendWhatsAppMessage(whatsapp, '😔 Nenhum acompanhante disponível no momento. Vamos seguir com o pagamento!\n\nDigite *OK* para continuar.');
          await saveSession(whatsapp, { step: 'confirm_checkout', context: { ...context, companionIds: [] } });
          return;
        }

        let msg = '👥 *Acompanhantes disponíveis:*\n\n';
        companions.rows.forEach((c, i) => {
          const price = parseFloat(c.city_price || c.price_per_hour);
          const hours = DURATION_MAP[context.durationKey];
          msg += `*${i + 1}* - ${c.artistic_name}\n   ${c.bio || ''}\n   💰 R$${(price * hours).toFixed(2)}\n\n`;
        });
        msg += '\nDigite o número do acompanhante desejado ou *0* para pular.';
        await sendWhatsAppMessage(whatsapp, msg);
        await saveSession(whatsapp, { step: 'select_companion', context: { ...context, companions: companions.rows, companionIds: [] } });
      } else {
        await saveSession(whatsapp, { step: 'confirm_checkout', context: { ...context, companionIds: [] } });
        return handleStep('confirm_checkout', whatsapp, '', { ...context, companionIds: [] });
      }
      break;
    }

    case 'select_companion': {
      if (text === '0' || upperText === 'NAO' || upperText === 'NÃO') {
        return handleStep('confirm_checkout', whatsapp, '', context);
      }
      const idx = parseInt(text) - 1;
      if (isNaN(idx) || idx < 0 || idx >= context.companions.length) {
        await sendWhatsAppMessage(whatsapp, 'Opção inválida. Digite o número ou *0* para pular.');
        return;
      }
      const companion = context.companions[idx];
      const hours = DURATION_MAP[context.durationKey];
      const compPrice = parseFloat(companion.city_price || companion.price_per_hour) * hours;
      const updatedIds = [...(context.companionIds || []), { id: companion.id, name: companion.artistic_name, price: compPrice }];
      await saveSession(whatsapp, { step: 'confirm_checkout', context: { ...context, companionIds: updatedIds } });
      return handleStep('confirm_checkout', whatsapp, '', { ...context, companionIds: updatedIds });
    }

    case 'confirm_checkout': {
      const hours = DURATION_MAP[context.durationKey];
      const companionsTotal = (context.companionIds || []).reduce((sum, c) => sum + c.price, 0);
      const total = context.price + companionsTotal;

      const checkIn = new Date();
      const checkOut = new Date(checkIn.getTime() + hours * 60 * 60 * 1000);

      let msg = `📋 *Resumo da Reserva:*\n\n` +
        `🏠 ${context.houseName}\n` +
        `🛏️ ${context.roomName}\n` +
        `⏱️ ${DURATION_LABELS[context.durationKey]}\n` +
        `📅 Entrada: ${checkIn.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n` +
        `📅 Saída: ${checkOut.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\n`;

      if (context.companionIds?.length > 0) {
        msg += `👥 *Acompanhantes:*\n`;
        context.companionIds.forEach(c => { msg += `   • ${c.name}: R$${c.price.toFixed(2)}\n`; });
        msg += '\n';
      }

      msg += `💰 *Quarto:* R$${context.price.toFixed(2)}\n`;
      if (companionsTotal > 0) msg += `💰 *Acompanhantes:* R$${companionsTotal.toFixed(2)}\n`;
      msg += `💳 *Total:* R$${total.toFixed(2)}\n\n`;
      msg += `*1* - ✅ Confirmar e gerar Pix\n*2* - ❌ Cancelar`;

      await sendWhatsAppMessage(whatsapp, msg);
      await saveSession(whatsapp, {
        step: 'process_payment',
        context: { ...context, companionsTotal, total, checkIn: checkIn.toISOString(), checkOut: checkOut.toISOString() }
      });
      break;
    }

    case 'process_payment': {
      if (text === '1' || upperText === 'SIM' || upperText === 'CONFIRMAR') {
        await sendWhatsAppMessage(whatsapp, '⏳ Gerando seu QR Code Pix...');
        try {
          const companionIds = (context.companionIds || []).map(c => c.id);

          // Criar reserva via API interna
          const { rows: [reservation] } = await db.query(`
            INSERT INTO reservations (customer_id, room_id, house_id, check_in, check_out, duration_hours, duration_type, room_price, companions_price, total_price, access_code)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
          `, [context.customerId, context.roomId, context.houseId, context.checkIn, context.checkOut,
              DURATION_MAP[context.durationKey], context.durationKey, context.price, context.companionsTotal, context.total, generateAccessCode()]);

          for (const c of (context.companionIds || [])) {
            const hours = DURATION_MAP[context.durationKey];
            const pricePerHour = c.price / hours;
            await db.query(
              'INSERT INTO reservation_companions (reservation_id, companion_id, price_per_hour, total_price) VALUES ($1,$2,$3,$4)',
              [reservation.id, c.id, pricePerHour, c.price]
            );
          }

          const pixCharge = await createPixCharge({
            reservationId: reservation.id,
            customerId: context.customerId,
            amount: context.total,
            description: `Reserva ${context.roomName}`,
          });

          await db.query(`
            INSERT INTO payments (reservation_id, customer_id, amount, pix_txid, pix_qr_code, pix_qr_code_image, pix_expiry)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `, [reservation.id, context.customerId, context.total, pixCharge.txid, pixCharge.qrCode, pixCharge.qrCodeImage,
              new Date(Date.now() + 10 * 60 * 1000).toISOString()]);

          const msg = `💳 *Pague via Pix:*\n\n` +
            `*Valor:* R$${context.total.toFixed(2)}\n` +
            `*Expira em:* 10 minutos\n\n` +
            `📋 *Código Pix Copia e Cola:*\n${pixCharge.qrCode}\n\n` +
            `_Após o pagamento, você receberá a confirmação automaticamente!_`;

          await sendWhatsAppMessage(whatsapp, msg);
          await clearSession(whatsapp);
        } catch (err) {
          console.error('Payment generation error:', err);
          await sendWhatsAppMessage(whatsapp, '❌ Erro ao gerar pagamento. Por favor, tente novamente ou entre em contato conosco.');
        }
      } else {
        await sendWhatsAppMessage(whatsapp, '❌ Reserva cancelada. Digite *OI* para começar novamente.');
        await clearSession(whatsapp);
      }
      break;
    }

    default: {
      await clearSession(whatsapp);
      return handleStep('welcome', whatsapp, '', {});
    }
  }
}

module.exports = { botService };
