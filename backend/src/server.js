require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const citiesRoutes = require('./routes/cities');
const housesRoutes = require('./routes/houses');
const roomsRoutes = require('./routes/rooms');
const companionsRoutes = require('./routes/companions');
const reservationsRoutes = require('./routes/reservations');
const paymentsRoutes = require('./routes/payments');
const customersRoutes = require('./routes/customers');
const adminRoutes = require('./routes/admin');
const botRoutes = require('./routes/bot');
const webhookRoutes = require('./routes/webhooks');
const reportsRoutes = require('./routes/reports');
const campaignsRoutes = require('./routes/campaigns');
const settingsRoutes = require('./routes/settings');

const { startScheduledJobs } = require('./services/scheduler');

const app = express();

// Segurança
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting geral
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Rate limiting para bot (mais permissivo pois é interno)
const botLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});
app.use('/api/bot/', botLimiter);

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/cities', citiesRoutes);
app.use('/api/houses', housesRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/companions', companionsRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startScheduledJobs();
});

module.exports = app;
