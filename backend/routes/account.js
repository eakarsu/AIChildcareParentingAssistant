/**
 * Data portability and account lifecycle.
 *
 * Users must be able to take their data with them and to delete their account.
 * Both operations act only on the authenticated user's own rows.
 *
 *   GET    /api/account/export          full JSON export of everything owned
 *   GET    /api/account/export?format=csv  the same as a zip-free CSV bundle
 *   DELETE /api/account                 delete the account and all owned data
 *   GET    /api/account/summary         what an export or deletion would touch
 *
 * Nothing here calls an AI provider and nothing is inferred: counts and rows
 * come straight from the database.
 */
const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

/** Tables that carry a user_id column (owned directly by the account). */
const USER_SCOPED_TABLES = [
  'expenses',
  'caregiver_logs',
  'shopping_lists',
  'emergency_contacts',
  'ai_results',
];

/** Tables that hang off children (owned transitively through children.user_id). */
const CHILD_SCOPED_TABLES = [
  'milestones', 'activities', 'health_records', 'sleep_records', 'feeding_records',
  'growth_records', 'vaccinations', 'behavioral_notes', 'journal_entries', 'medications',
  'appointments', 'learning_resources', 'diaper_records', 'daily_routines', 'tooth_records',
  'photo_memories', 'chores', 'allergy_logs', 'playdates',
  // Added by 002_new_features.sql; the guard below skips them if absent.
  'potty_log', 'school_records', 'insurance_policies', 'feeding_plans', 'immunization_schedule',
];

/** Conversation tables are created lazily by the AI routes. */
const OPTIONAL_TABLES = ['ai_conversations', 'ai_messages'];

async function existingTables(client, names) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names],
  );
  const present = new Set(rows.map((row) => row.table_name));
  return names.filter((name) => present.has(name));
}

/** Collect every row the user owns. Read-only and repeatable. */
async function collectAccountData(userId) {
  const client = await pool.connect();
  try {
    const users = await existingTables(client, ['users']);
    const children = await existingTables(client, ['children']);
    const userTables = await existingTables(client, USER_SCOPED_TABLES);
    const childTables = await existingTables(client, CHILD_SCOPED_TABLES);
    const optional = await existingTables(client, OPTIONAL_TABLES);

    const data = {
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      account: users.length
        ? (await client.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [userId])).rows[0] ?? null
        : null,
      children: children.length
        ? (await client.query('SELECT * FROM children WHERE user_id = $1 ORDER BY id', [userId])).rows
        : [],
      userScoped: {},
      childScoped: {},
      ai: {},
    };

    const childIds = data.children.map((child) => child.id);

    for (const table of userTables) {
      data.userScoped[table] = (await client.query(`SELECT * FROM ${table} WHERE user_id = $1 ORDER BY id`, [userId])).rows;
    }
    for (const table of childTables) {
      data.childScoped[table] = childIds.length
        ? (await client.query(`SELECT * FROM ${table} WHERE child_id = ANY($1) ORDER BY id`, [childIds])).rows
        : [];
    }
    for (const table of optional) {
      // ai_conversations carries user_id; ai_messages belongs to a conversation.
      if (table === 'ai_conversations') {
        data.ai[table] = (await client.query(`SELECT * FROM ${table} WHERE user_id = $1 ORDER BY id`, [userId])).rows;
      } else {
        data.ai[table] = (await client.query(
          `SELECT m.* FROM ${table} m JOIN ai_conversations c ON c.id = m.conversation_id WHERE c.user_id = $1 ORDER BY m.id`,
          [userId],
        )).rows;
      }
    }

    data.counts = {
      children: data.children.length,
      ...Object.fromEntries(Object.entries(data.userScoped).map(([table, rows]) => [table, rows.length])),
      ...Object.fromEntries(Object.entries(data.childScoped).map(([table, rows]) => [table, rows.length])),
    };
    return data;
  } finally {
    client.release();
  }
}

/** Escape one CSV cell. */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(','));
  }
  return lines.join('\n');
}

/** CSV bundle: one section per table, separated by a header comment. */
function toCsvBundle(data) {
  const sections = [];
  if (data.children.length) sections.push(`# children\n${toCsv(data.children)}`);
  for (const [table, rows] of Object.entries(data.userScoped)) {
    if (rows.length) sections.push(`# ${table}\n${toCsv(rows)}`);
  }
  for (const [table, rows] of Object.entries(data.childScoped)) {
    if (rows.length) sections.push(`# ${table}\n${toCsv(rows)}`);
  }
  return [
    `# AI Childcare Assistant data export`,
    `# account: ${data.account?.email ?? 'unknown'}`,
    `# exportedAt: ${data.exportedAt}`,
    `# Every section below lists the authenticated account's own rows only.`,
    '',
    ...sections,
  ].join('\n\n');
}

// ─── GET /summary ────────────────────────────────────────────────────────────
router.get('/summary', auth, async (req, res) => {
  try {
    const data = await collectAccountData(req.user.id);
    res.json({
      account: data.account,
      counts: data.counts,
      note: 'Counts describe what an export would include and what deletion would remove.',
    });
  } catch (error) {
    console.error('Account summary failed:', error.message);
    res.status(500).json({ error: 'Failed to summarise the account.' });
  }
});

// ─── GET /export ─────────────────────────────────────────────────────────────
router.get('/export', auth, async (req, res) => {
  try {
    const data = await collectAccountData(req.user.id);
    const stamp = new Date().toISOString().slice(0, 10);
    if (String(req.query.format || 'json').toLowerCase() === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="childcare-export-${stamp}.csv"`);
      return res.send(toCsvBundle(data));
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="childcare-export-${stamp}.json"`);
    return res.json(data);
  } catch (error) {
    console.error('Account export failed:', error.message);
    res.status(500).json({ error: 'Failed to export the account.' });
  }
});

// ─── DELETE / ────────────────────────────────────────────────────────────────
// Deleting a user cascades to children (ON DELETE CASCADE on children.user_id)
// and, through the child_id foreign keys, to the child-scoped rows. Rows in
// tables that reference the user directly are removed explicitly first.
router.delete('/', auth, async (req, res) => {
  const confirmation = String(req.body?.confirm ?? req.query.confirm ?? '');
  if (confirmation !== req.user.email) {
    return res.status(400).json({
      error: 'Confirmation required.',
      detail: `POST or DELETE with {"confirm":"<your email>"} to delete the account and all owned data.`,
    });
  }

  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const summary = await collectAccountData(userId);

    await client.query('BEGIN');
    const userTables = await existingTables(client, USER_SCOPED_TABLES);
    for (const table of userTables) {
      await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
    }
    const optional = await existingTables(client, ['ai_messages', 'ai_conversations']);
    for (const table of optional) {
      if (table === 'ai_conversations') {
        await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
      } else {
        await client.query(
          `DELETE FROM ${table} WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = $1)`,
          [userId],
        );
      }
    }
    // Children cascade to the child-scoped tables, then the account itself.
    await client.query('DELETE FROM children WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');

    return res.json({
      deleted: true,
      removed: summary.counts,
      message: 'The account and its owned records were deleted. This cannot be undone.',
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Account deletion failed:', error.message);
    return res.status(500).json({ error: 'Failed to delete the account.', detail: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
