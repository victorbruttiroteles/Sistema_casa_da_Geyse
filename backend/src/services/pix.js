const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

let efiToken = null;
let efiTokenExpiry = null;

async function getEfiToken() {
  if (efiToken && efiTokenExpiry > Date.now()) return efiToken;

  const isSandbox = process.env.EFI_SANDBOX === 'true';
  const baseUrl = isSandbox
    ? 'https://pix-h.api.efipay.com.br'
    : 'https://pix.api.efipay.com.br';

  const credentials = Buffer.from(
    `${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`
  ).toString('base64');

  const { data } = await axios.post(
    `${baseUrl}/oauth/token`,
    { grant_type: 'client_credentials' },
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    }
  );

  efiToken = data.access_token;
  efiTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return efiToken;
}

async function createPixCharge({ reservationId, customerId, amount, description }) {
  const isSandbox = process.env.EFI_SANDBOX === 'true';
  const baseUrl = isSandbox
    ? 'https://pix-h.api.efipay.com.br'
    : 'https://pix.api.efipay.com.br';

  const txid = uuidv4().replace(/-/g, '').substring(0, 35);
  const expirySeconds = parseInt(process.env.PIX_EXPIRY_MINUTES || 10) * 60;

  // Modo mock para desenvolvimento (sem credenciais Efí configuradas)
  if (!process.env.EFI_CLIENT_ID || process.env.EFI_CLIENT_ID === 'seu_client_id_efi') {
    return {
      txid,
      qrCode: `00020126580014br.gov.bcb.pix0136${txid}5204000053039865802BR5925Casa da Geyse Reservas6009SAO PAULO62070503***6304MOCK`,
      qrCodeImage: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`,
      amount,
    };
  }

  try {
    const token = await getEfiToken();

    const { data: charge } = await axios.put(
      `${baseUrl}/v2/cob/${txid}`,
      {
        calendario: { expiracao: expirySeconds },
        valor: { original: amount.toFixed(2) },
        chave: process.env.EFI_PIX_KEY,
        infoAdicionais: [
          { nome: 'Reserva', valor: reservationId },
          { nome: 'Descricao', valor: description },
        ],
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    const { data: qrData } = await axios.get(
      `${baseUrl}/v2/loc/${charge.loc.id}/qrcode`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return {
      txid,
      qrCode: qrData.qrcode,
      qrCodeImage: qrData.imagemQrcode,
      amount,
      locId: charge.loc.id,
    };
  } catch (err) {
    console.error('Efí Pix error:', err.response?.data || err.message);
    throw new Error('Falha ao gerar QR Code Pix. Tente novamente.');
  }
}

async function refundPix(e2eId, amount) {
  if (!process.env.EFI_CLIENT_ID || process.env.EFI_CLIENT_ID === 'seu_client_id_efi') {
    return { status: 'mock_refunded' };
  }

  const isSandbox = process.env.EFI_SANDBOX === 'true';
  const baseUrl = isSandbox ? 'https://pix-h.api.efipay.com.br' : 'https://pix.api.efipay.com.br';
  const refundId = uuidv4().replace(/-/g, '').substring(0, 35);
  const token = await getEfiToken();

  const { data } = await axios.put(
    `${baseUrl}/v2/pix/${e2eId}/devolucao/${refundId}`,
    { valor: amount.toFixed(2) },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return data;
}

module.exports = { createPixCharge, refundPix };
