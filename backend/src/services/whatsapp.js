const axios = require('axios');

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'casa_geyse';

async function sendWhatsAppMessage(to, text) {
  if (!EVOLUTION_KEY || EVOLUTION_KEY === 'sua_api_key_evolution') {
    console.log(`[WhatsApp Mock] To: ${to}\n${text}\n`);
    return { mock: true };
  }

  try {
    const { data } = await axios.post(
      `${EVOLUTION_URL}/message/sendText/${INSTANCE}`,
      { number: to, options: { delay: 500 }, textMessage: { text } },
      { headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' } }
    );
    return data;
  } catch (err) {
    console.error('WhatsApp send error:', err.response?.data || err.message);
    throw err;
  }
}

async function sendWhatsAppImage(to, imageUrl, caption) {
  if (!EVOLUTION_KEY || EVOLUTION_KEY === 'sua_api_key_evolution') {
    console.log(`[WhatsApp Mock Image] To: ${to}, URL: ${imageUrl}`);
    return { mock: true };
  }

  try {
    const { data } = await axios.post(
      `${EVOLUTION_URL}/message/sendMedia/${INSTANCE}`,
      {
        number: to,
        options: { delay: 500 },
        mediaMessage: { mediatype: 'image', media: imageUrl, caption },
      },
      { headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' } }
    );
    return data;
  } catch (err) {
    console.error('WhatsApp image error:', err.response?.data || err.message);
    throw err;
  }
}

async function sendWhatsAppButtons(to, text, buttons) {
  if (!EVOLUTION_KEY || EVOLUTION_KEY === 'sua_api_key_evolution') {
    console.log(`[WhatsApp Mock Buttons] To: ${to}\n${text}`);
    return { mock: true };
  }

  try {
    const { data } = await axios.post(
      `${EVOLUTION_URL}/message/sendButtons/${INSTANCE}`,
      {
        number: to,
        buttonMessage: {
          text,
          buttons: buttons.map((b, i) => ({ buttonId: `btn_${i}`, buttonText: { displayText: b.text }, type: 1 })),
          footerText: 'Casa da Geyse',
        },
      },
      { headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' } }
    );
    return data;
  } catch (err) {
    // Fallback para texto simples se botões não suportados
    return sendWhatsAppMessage(to, text);
  }
}

module.exports = { sendWhatsAppMessage, sendWhatsAppImage, sendWhatsAppButtons };
