/**
 * Billing stub.
 *
 * Talks to Stripe's REST API through fetch (no SDK dependency) and is honest:
 * when credentials are absent we report "not configured" rather than faking a
 * subscription. Plan metadata lives here so the frontend can render pricing.
 *
 * Webhook signature verification needs the raw request body; server.js captures
 * it as req.rawBody via the express.json({ verify }) hook. When
 * STRIPE_WEBHOOK_SECRET is unset we cannot verify and say so in the response.
 */
const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    monthly_price_cents: 0,
    features: ['1 child profile', 'Core tracking records', 'Reminders', 'AI advisor preview'],
  },
  {
    id: 'family',
    name: 'Family',
    monthly_price_cents: 999,
    features: ['Unlimited child profiles', 'Caregiver sharing', 'Email + SMS reminders', 'Full AI advisor & tools'],
  },
  {
    id: 'family_plus',
    name: 'Family Plus',
    monthly_price_cents: 1999,
    features: ['Everything in Family', 'Priority AI insights', 'Advanced reports & exports', 'Pediatrician handoff PDFs'],
  },
];

const PLAN_BY_ID = Object.fromEntries(PLANS.map((plan) => [plan.id, plan]));

const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

// ─── Plans metadata (public) ─────────────────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json({ plans: PLANS, currency: 'usd', configured: stripeConfigured() });
});

// ─── GET /billing/status - The caller's plan ─────────────────────────────────
router.get('/status', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT plan, status, current_period_end, stripe_customer_id, stripe_subscription_id
         FROM subscriptions
        WHERE user_id = $1`,
      [req.user.id]
    );
    const subscription = result.rows[0] || {
      plan: 'free',
      status: 'inactive',
      current_period_end: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
    };
    res.json({ ...subscription, configured: stripeConfigured(), currency: 'usd', plans: PLANS });
  } catch (err) {
    console.error('billing status error:', err);
    res.status(500).json({ error: 'Failed to load billing status.' });
  }
});

// ─── POST /billing/checkout - Create a Stripe Checkout Session ───────────────
router.post('/checkout', auth, async (req, res) => {
  try {
    const plan = PLAN_BY_ID[req.body && req.body.plan];
    if (!plan) {
      return res.status(400).json({ error: `Unknown plan. Valid plans: ${PLANS.map((p) => p.id).join(', ')}` });
    }
    if (plan.monthly_price_cents === 0) {
      return res.status(400).json({ error: 'The free plan does not require checkout.' });
    }
    if (!stripeConfigured()) {
      return res.json({ configured: false, reason: 'Stripe is not configured' });
    }

    const origin = process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || 'http://localhost:3000';
    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set('success_url', process.env.STRIPE_SUCCESS_URL || `${origin}/billing?checkout=success`);
    params.set('cancel_url', process.env.STRIPE_CANCEL_URL || `${origin}/billing?checkout=cancelled`);
    params.set('client_reference_id', String(req.user.id));
    params.set('metadata[user_id]', String(req.user.id));
    params.set('metadata[plan]', plan.id);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set('line_items[0][price_data][unit_amount]', String(plan.monthly_price_cents));
    params.set('line_items[0][price_data][recurring][interval]', 'month');
    params.set('line_items[0][price_data][product_data][name]', `AI Childcare Assistant - ${plan.name}`);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const session = await response.json().catch(() => ({}));

    if (!response.ok) {
      const reason = session.error && session.error.message
        ? session.error.message
        : `Stripe rejected the checkout request (${response.status})`;
      console.error('Stripe checkout error:', reason);
      return res.status(502).json({ configured: true, error: reason });
    }

    res.json({ configured: true, url: session.url, id: session.id, plan: plan.id });
  } catch (err) {
    console.error('checkout error:', err);
    res.status(500).json({ error: 'Failed to start checkout.' });
  }
});

// ─── Stripe webhook ──────────────────────────────────────────────────────────
function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const parts = {};
  for (const part of String(signatureHeader).split(',')) {
    const [key, value] = part.split('=');
    if (key && value !== undefined) parts[key.trim()] = value.trim();
  }
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const providedBuffer = Buffer.from(expected);
  const expectedBuffer = Buffer.from(digest);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

async function resolveUserId({ explicitUserId, customerId, subscriptionId }) {
  if (explicitUserId) return Number(explicitUserId);
  const result = await pool.query(
    `SELECT user_id
       FROM subscriptions
      WHERE ($1::text IS NOT NULL AND stripe_subscription_id = $1)
         OR ($2::text IS NOT NULL AND stripe_customer_id = $2)
      ORDER BY updated_at DESC
      LIMIT 1`,
    [subscriptionId || null, customerId || null]
  );
  return result.rows[0] ? result.rows[0].user_id : null;
}

async function upsertSubscription({ userId, plan, status, customerId, subscriptionId, periodEnd }) {
  if (!userId) return false;
  await pool.query(
    `INSERT INTO subscriptions
       (user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, updated_at)
     VALUES ($1, COALESCE($2, 'free'), COALESCE($3, 'inactive'), $4, $5, $6, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       plan = COALESCE($2, subscriptions.plan),
       status = COALESCE($3, subscriptions.status),
       stripe_customer_id = COALESCE($4, subscriptions.stripe_customer_id),
       stripe_subscription_id = COALESCE($5, subscriptions.stripe_subscription_id),
       current_period_end = COALESCE($6, subscriptions.current_period_end),
       updated_at = NOW()`,
    [userId, plan || null, status || null, customerId || null, subscriptionId || null, periodEnd || null]
  );
  return true;
}

async function applyStripeEvent(event) {
  const type = event && event.type;
  const object = (event && event.data && event.data.object) || {};

  switch (type) {
    case 'checkout.session.completed': {
      const userId = object.client_reference_id || (object.metadata && object.metadata.user_id);
      const plan = (object.metadata && object.metadata.plan) || 'family';
      await upsertSubscription({
        userId,
        plan,
        status: 'active',
        customerId: object.customer,
        subscriptionId: object.subscription,
      });
      return true;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const deleted = type === 'customer.subscription.deleted';
      const userId = await resolveUserId({
        explicitUserId: object.metadata && object.metadata.user_id,
        customerId: object.customer,
        subscriptionId: object.id,
      });
      await upsertSubscription({
        userId,
        plan: object.metadata && object.metadata.plan,
        status: deleted ? 'canceled' : object.status || 'active',
        customerId: object.customer,
        subscriptionId: object.id,
        periodEnd: object.current_period_end ? new Date(object.current_period_end * 1000) : null,
      });
      return true;
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const userId = await resolveUserId({ customerId: object.customer, subscriptionId: object.subscription });
      await upsertSubscription({
        userId,
        status: type === 'invoice.paid' ? 'active' : 'past_due',
        customerId: object.customer,
        subscriptionId: object.subscription,
      });
      return true;
    }
    default:
      return false;
  }
}

router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});

    if (secret) {
      const valid = verifyStripeSignature(rawBody, req.headers['stripe-signature'], secret);
      if (!valid) {
        return res.status(400).json({ error: 'Invalid Stripe signature.' });
      }
    }

    let event = req.body;
    if (!event || Object.keys(event).length === 0) {
      try {
        event = JSON.parse(rawBody || '{}');
      } catch (_) {
        return res.status(400).json({ error: 'Invalid JSON payload.' });
      }
    }

    const handled = await applyStripeEvent(event);
    res.json({ received: true, verified: Boolean(secret), type: event.type || null, handled });
  } catch (err) {
    console.error('stripe webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

module.exports = router;
module.exports.PLANS = PLANS;
