require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

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

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount all routes
app.use('/api', routes);

// === Custom Views (Parent Views) — mounted BEFORE 404 ===
app.use('/api/custom-views', require('./routes/customViews'));

// Other gap / extension routes — also BEFORE 404
app.use('/api/parent-coach', require('./routes/parentCoachAgent'));
app.use('/api/evidence-lit-rag', require('./routes/evidenceLitRag'));
app.use('/api/daily-log-anomaly', require('./routes/dailyLogAnomaly'));
app.use('/api/pediatric-network', require('./routes/pediatricNetworkSaas'));
app.use('/api/screen-time-balance', require('./routes/screenTimeBalance'));

app.use('/api/gap-only-4-ai-endpoints-narrow-coverage', require('./routes/gap_only_4_ai_endpoints_narrow_coverage'));
app.use('/api/gap-no-ai-age-stage-specific-developmental-milestone-t', require('./routes/gap_no_ai_age_stage_specific_developmental_milestone_t'));
app.use('/api/gap-no-ai-sleep-feeding-log-analyzer-for-patterns', require('./routes/gap_no_ai_sleep_feeding_log_analyzer_for_patterns'));
app.use('/api/gap-no-ai-behavior-incident-coach-with-safe-conversati', require('./routes/gap_no_ai_behavior_incident_coach_with_safe_conversati'));
app.use('/api/gap-no-ai-photo-based-growth-chart-analyzer', require('./routes/gap_no_ai_photo_based_growth_chart_analyzer'));
app.use('/api/gap-reminders-routes-exist-but-no-sms-push-delivery-ch', require('./routes/gap_reminders_routes_exist_but_no_sms_push_delivery_ch'));
app.use('/api/gap-no-webhook-outbound-api', require('./routes/gap_no_webhook_outbound_api'));
app.use('/api/gap-no-multi-caregiver-shared-account-co-parent-sync', require('./routes/gap_no_multi_caregiver_shared_account_co_parent_sync'));
app.use('/api/gap-no-pediatrician-handoff-pdf-generator', require('./routes/gap_no_pediatrician_handoff_pdf_generator'));
app.use('/api/gap-no-content-library-articles-videos-with-curation', require('./routes/gap_no_content_library_articles_videos_with_curation'));
app.use('/api/gap-no-subscription-billing-for-premium-tier', require('./routes/gap_no_subscription_billing_for_premium_tier'));

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
