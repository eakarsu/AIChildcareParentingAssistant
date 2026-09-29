/**
 * Activity reminders: schedule feeding/sleep/activity reminders,
 * list upcoming (next 24h), optionally send email via nodemailer.
 */
const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { recordAudit } = require('../lib/audit');

const router = express.Router();

// SMTP settings for email reminders. SMTP_PASSWORD is preferred, SMTP_PASS kept
// for backwards compatibility. REMINDER_FROM_EMAIL falls back to SMTP_FROM.
function smtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
    from: process.env.REMINDER_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER,
  };
}

// Twilio SMS settings (no SDK; called through fetch).
function twilioConfig() {
  return {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM_NUMBER,
  };
}

function twilioConfigured() {
  const config = twilioConfig();
  return Boolean(config.sid && config.token && config.from);
}

// Attempt to load nodemailer gracefully
let transporter = null;
try {
  const nodemailer = require('nodemailer');
  const smtp = smtpConfig();
  if (smtp.host && smtp.user && smtp.password) {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtp.user, pass: smtp.password },
    });
    console.log('Nodemailer configured for reminders.');
  } else {
    console.log('Nodemailer: SMTP not configured, email reminders disabled.');
  }
} catch (_) {
  console.log('Nodemailer not installed, email reminders disabled.');
}

// Ensure reminders table exists
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      child_id INTEGER,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      reminder_type VARCHAR(50) NOT NULL DEFAULT 'general',
      scheduled_at TIMESTAMP NOT NULL,
      is_sent BOOLEAN DEFAULT FALSE,
      email_recipient VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Delivery outcome columns (added for real reminder delivery).
  await pool.query(`
    ALTER TABLE reminders ADD COLUMN IF NOT EXISTS delivery_channel VARCHAR(20);
    ALTER TABLE reminders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(40);
    ALTER TABLE reminders ADD COLUMN IF NOT EXISTS provider_ref VARCHAR(255);
    ALTER TABLE reminders ADD COLUMN IF NOT EXISTS delivery_error TEXT;
    ALTER TABLE reminders ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMP;
    ALTER TABLE reminders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
  `);
}

// ─── Delivery providers ──────────────────────────────────────────────────────

// Send a reminder email. Honest about configuration: never reports delivered
// unless the SMTP provider returns a message id.
async function deliverEmail(recipient, reminder) {
  if (!transporter) {
    return { delivered: false, channel: 'email', reason: 'SMTP is not configured' };
  }
  const info = await transporter.sendMail({
    from: smtpConfig().from,
    to: recipient,
    subject: `Reminder: ${reminder.title}`,
    html: `
      <h2>Reminder</h2>
      <p><strong>Title:</strong> ${reminder.title}</p>
      <p><strong>Type:</strong> ${reminder.reminder_type}</p>
      ${reminder.description ? `<p><strong>Notes:</strong> ${reminder.description}</p>` : ''}
      <p><em>Sent by AI Childcare Assistant.</em></p>
    `,
  });
  if (!info || !info.messageId) {
    return { delivered: false, channel: 'email', reason: 'SMTP provider returned no message id' };
  }
  return { delivered: true, channel: 'email', provider_ref: info.messageId };
}

// Send a reminder SMS through Twilio's REST API. Only reports delivered when
// Twilio returns a message SID.
async function deliverSms(phone, reminder) {
  if (!twilioConfigured()) {
    return { delivered: false, channel: 'sms', reason: 'SMS is not configured' };
  }
  const config = twilioConfig();
  const body = new URLSearchParams({
    From: config.from,
    To: phone,
    Body: `Reminder: ${reminder.title}${reminder.description ? ` — ${reminder.description}` : ''}`,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.sid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.sid}:${config.token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.sid) {
    return {
      delivered: false,
      channel: 'sms',
      reason: data.message || `Twilio request failed (${response.status})`,
    };
  }
  return { delivered: true, channel: 'sms', provider_ref: data.sid };
}

// ─── POST /reminders - Schedule a reminder ────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    await ensureTable();
    const { child_id, title, description, reminder_type, scheduled_at, email_recipient } = req.body;

    if (!title) return res.status(400).json({ error: 'title is required.' });
    if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at is required.' });

    const validTypes = ['feeding', 'sleep', 'activity', 'medication', 'appointment', 'general'];
    const rType = reminder_type || 'general';
    if (!validTypes.includes(rType)) {
      return res.status(400).json({ error: `reminder_type must be one of: ${validTypes.join(', ')}` });
    }

    const result = await pool.query(
      `INSERT INTO reminders
        (user_id, child_id, title, description, reminder_type, scheduled_at, email_recipient, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *`,
      [req.user.id, child_id || null, title, description || null, rType, scheduled_at, email_recipient || null]
    );

    const reminder = result.rows[0];

    // Attempt to send confirmation email if configured and recipient provided
    if (transporter && email_recipient) {
      try {
        await transporter.sendMail({
          from: smtpConfig().from,
          to: email_recipient,
          subject: `Reminder Scheduled: ${title}`,
          html: `
            <h2>Reminder Scheduled</h2>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Type:</strong> ${rType}</p>
            <p><strong>Scheduled at:</strong> ${new Date(scheduled_at).toLocaleString()}</p>
            ${description ? `<p><strong>Notes:</strong> ${description}</p>` : ''}
            <p><em>You will receive another email when this reminder is due.</em></p>
          `,
        });
        reminder.email_sent = true;
      } catch (emailErr) {
        console.error('Email send error:', emailErr.message);
        reminder.email_sent = false;
        reminder.email_error = emailErr.message;
      }
    }

    res.status(201).json(reminder);
  } catch (err) {
    console.error('create reminder error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /reminders - List all user's reminders ───────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    await ensureTable();
    const { child_id, reminder_type } = req.query;

    let query = `SELECT r.*, ch.name as child_name FROM reminders r
                 LEFT JOIN children ch ON r.child_id = ch.id
                 WHERE r.user_id = $1`;
    const params = [req.user.id];
    let idx = 2;

    if (child_id) {
      query += ` AND r.child_id = $${idx++}`;
      params.push(child_id);
    }
    if (reminder_type) {
      query += ` AND r.reminder_type = $${idx++}`;
      params.push(reminder_type);
    }

    query += ' ORDER BY r.scheduled_at ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('list reminders error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /reminders/upcoming - Next 24 hours ─────────────────────────────────
router.get('/upcoming', auth, async (req, res) => {
  try {
    await ensureTable();
    const result = await pool.query(
      `SELECT r.*, ch.name as child_name FROM reminders r
       LEFT JOIN children ch ON r.child_id = ch.id
       WHERE r.user_id = $1
         AND r.scheduled_at >= NOW()
         AND r.scheduled_at <= NOW() + INTERVAL '24 hours'
       ORDER BY r.scheduled_at ASC`,
      [req.user.id]
    );

    res.json({
      upcoming_reminders: result.rows,
      count: result.rows.length,
      window: 'next 24 hours',
    });
  } catch (err) {
    console.error('upcoming reminders error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /reminders/:id - Get single reminder ─────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    await ensureTable();
    const result = await pool.query(
      'SELECT * FROM reminders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found.' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /reminders/:id - Update reminder ────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    await ensureTable();
    const { title, description, reminder_type, scheduled_at, is_sent } = req.body;
    const result = await pool.query(
      `UPDATE reminders SET title=$1, description=$2, reminder_type=$3, scheduled_at=$4, is_sent=$5, updated_at=NOW()
       WHERE id=$6 AND user_id=$7 RETURNING *`,
      [title, description, reminder_type, scheduled_at, is_sent, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found.' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /reminders/:id ────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureTable();
    const result = await pool.query(
      'DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found.' });
    res.json({ message: 'Reminder deleted.', reminder: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /reminders/:id/send - Deliver a reminder now ───────────────────────
router.post('/:id/send', auth, async (req, res) => {
  try {
    await ensureTable();
    const found = await pool.query(
      'SELECT * FROM reminders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (found.rows.length === 0) return res.status(404).json({ error: 'Reminder not found.' });

    const reminder = found.rows[0];
    const requested = String((req.body && req.body.channel) || 'auto').toLowerCase();
    if (!['auto', 'email', 'sms'].includes(requested)) {
      return res.status(400).json({ error: 'channel must be one of: auto, email, sms' });
    }

    const emailRecipient = reminder.email_recipient || req.user.email;
    const phone = req.body && req.body.phone ? req.body.phone : null;

    let result;
    if (requested === 'sms') {
      if (!phone) return res.status(400).json({ error: 'A phone number is required for SMS delivery.' });
      result = await deliverSms(phone, reminder);
    } else if (requested === 'email') {
      if (!emailRecipient) return res.status(400).json({ error: 'An email recipient is required for email delivery.' });
      result = await deliverEmail(emailRecipient, reminder);
    } else if (emailRecipient) {
      result = await deliverEmail(emailRecipient, reminder);
    } else if (phone) {
      result = await deliverSms(phone, reminder);
    } else {
      return res.status(400).json({ error: 'No email recipient or phone number available for delivery.' });
    }

    const attemptedAt = new Date();
    const notConfigured = !result.delivered && /not configured/i.test(result.reason || '');
    const deliveryStatus = result.delivered ? 'delivered' : notConfigured ? 'not_configured' : 'failed';

    // Only ever mark is_sent when the provider actually accepted the message.
    const updated = await pool.query(
      `UPDATE reminders
          SET delivery_channel = $1,
              delivery_status = $2,
              provider_ref = $3,
              delivery_error = $4,
              attempted_at = $5,
              delivered_at = $6,
              is_sent = $7,
              updated_at = NOW()
        WHERE id = $8
        RETURNING *`,
      [
        result.channel,
        deliveryStatus,
        result.provider_ref || null,
        result.delivered ? null : result.reason || null,
        attemptedAt,
        result.delivered ? attemptedAt : null,
        result.delivered,
        reminder.id,
      ]
    );

    await recordAudit({
      userId: req.user.id,
      action: result.delivered ? 'reminder.delivered' : 'reminder.delivery_failed',
      entity: 'reminder',
      entityId: reminder.id,
      details: {
        channel: result.channel,
        status: deliveryStatus,
        provider_ref: result.provider_ref || null,
        reason: result.reason || null,
      },
    });

    const response = {
      delivered: result.delivered,
      channel: result.channel,
      reminder: updated.rows[0],
    };
    if (result.delivered) {
      response.provider_ref = result.provider_ref;
    } else {
      response.reason = result.reason;
    }
    res.json(response);
  } catch (err) {
    console.error('send reminder error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
