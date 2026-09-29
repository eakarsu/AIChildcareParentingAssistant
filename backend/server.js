require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('./config/runtime').validateRuntime();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS - configured from environment
const allowedOrigins = (process.env.CORS_ORIGINS || `http://localhost:${process.env.FRONTEND_PORT || 3000}`)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Body parser. The verify hook captures the raw body so the Stripe webhook can
// validate its signature.
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dedicated childcare AI routes. Mounted BEFORE the core /api router so the
// existing /api/ai/* routers cannot intercept these paths (which would run the
// shared aiLimiter multiple times per request). Route paths are distinct from
// the existing /api/ai/* endpoints, so nothing else is shadowed.
app.use('/api/ai', require('./routes/aiChildcare'));

// Mount all routes
app.use('/api', routes);

// Data portability and account lifecycle (export / delete)
app.use('/api/account', require('./routes/account'));

// === Custom Views (Parent Views) — mounted BEFORE 404 ===
app.use('/api/custom-views', require('./routes/customViews'));
app.use('/api/governed-care', require('./routes/governedCare'));

// Other gap / extension routes — also BEFORE 404
app.use('/api/parent-coach', require('./routes/parentCoachAgent'));
app.use('/api/evidence-lit-rag', require('./routes/evidenceLitRag'));
app.use('/api/daily-log-anomaly', require('./routes/dailyLogAnomaly'));
app.use('/api/pediatric-network', require('./routes/pediatricNetworkSaas'));
app.use('/api/screen-time-balance', require('./routes/screenTimeBalance'));

// Deterministic reports + global search — BEFORE 404
app.use('/api/reports', require('./routes/reports'));
app.use('/api/search', require('./routes/search'));

// Caregiver sharing (with audit trail) and billing — mounted BEFORE 404
app.use('/api/sharing', require('./routes/sharing'));
app.use('/api/billing', require('./routes/billing'));

// 404 handler — MUST come after all routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Childcare Assistant API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
});

module.exports = app;
