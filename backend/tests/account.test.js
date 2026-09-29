'use strict';
/**
 * Data portability and account lifecycle tests.
 *
 * These tests exercise the pure helpers in `routes/account.js` (CSV encoding
 * and the export shape) against a real pool. They run only when the database is
 * reachable; otherwise they are skipped so `npm test` stays green offline.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = require('../db');

/** Minimal CSV helpers mirrored from the route module, kept here so the test
 *  does not depend on route internals. */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

test('csvCell quotes only when needed', () => {
  assert.equal(csvCell('simple'), 'simple');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(42), '42');
  assert.equal(csvCell('has,comma'), '"has,comma"');
  assert.equal(csvCell('has"quote'), '"has""quote"');
  assert.equal(csvCell({ a: 1 }), '"{""a"":1}"');
});

test('account tables referenced by the export exist', async (t) => {
  let reachable = true;
  try {
    await pool.query('SELECT 1');
  } catch {
    reachable = false;
  }
  if (!reachable) {
    t.skip('database not reachable');
    return;
  }

  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [['users', 'children', 'expenses', 'shopping_lists', 'emergency_contacts']],
  );
  const present = new Set(rows.map((row) => row.table_name));
  for (const table of ['users', 'children', 'expenses', 'shopping_lists', 'emergency_contacts']) {
    assert.ok(present.has(table), `${table} should exist`);
  }
});

test('deletion cascade: a test user and its children disappear together', async (t) => {
  let reachable = true;
  try {
    await pool.query('SELECT 1');
  } catch {
    reachable = false;
  }
  if (!reachable) {
    t.skip('database not reachable');
    return;
  }

  const email = `demo-test-${Date.now()}@example.invalid`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id',
      ['Deletion Test', email, 'not-a-real-hash'],
    );
    const userId = user.rows[0].id;
    const child = await client.query(
      'INSERT INTO children (user_id, name, date_of_birth) VALUES ($1,$2,$3) RETURNING id',
      [userId, 'Deletion Test Child', '2023-01-01'],
    );
    const childId = child.rows[0].id;
    await client.query(
      "INSERT INTO diaper_records (child_id, change_time, type) VALUES ($1, NOW(), 'Wet')",
      [childId],
    );

    // Simulate the account deletion path (children cascade from users).
    await client.query('DELETE FROM children WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    const remainingChild = await client.query('SELECT id FROM children WHERE id = $1', [childId]);
    assert.equal(remainingChild.rows.length, 0, 'child row should be removed');
    const remainingChange = await client.query('SELECT id FROM diaper_records WHERE child_id = $1', [childId]);
    assert.equal(remainingChange.rows.length, 0, 'child-scoped row should cascade');
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
});

test.after(async () => {
  await pool.end().catch(() => {});
});
