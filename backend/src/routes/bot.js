const express = require('express');
const router = express.Router();
const { botService } = require('../services/botService');

// POST /api/bot/test - Testar bot manualmente (apenas dev)
router.post('/test', async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Forbidden' });
  try {
    const { whatsapp, message } = req.body;
    await botService({
      data: {
        key: { remoteJid: `${whatsapp}@s.whatsapp.net` },
        message: { conversation: message },
      },
    });
    res.json({ ok: true, message: 'Processado' });
  } catch (err) { next(err); }
});

module.exports = router;
