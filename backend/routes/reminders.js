/**
 * Activity reminders: schedule feeding/sleep/activity reminders,
 * list upcoming (next 24h), optionally send email via nodemailer.
 */
const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Attempt to load nodemailer gracefully
let transporter = null;
try {
  const nodemailer = require('nodemailer');
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
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
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
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

module.exports = router;
