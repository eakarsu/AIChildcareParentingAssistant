/**
 * Ensure every CRUD table has at least 15 rows.
 *
 * The original seed created fewer than 15 rows for several features, so those
 * list views looked sparse. This script tops up each table to MIN_ROWS using
 * deterministic, clearly-fictional demo values. It is idempotent: it only adds
 * the missing rows, never deletes or changes existing ones, and stops once the
 * target is met.
 *
 * Usage: node backend/ensure-demo-rows.js
 */
const pool = require('./db');

const MIN_ROWS = 15;
const DEMO_TAG = 'DEMO — sample row to reach the 15-row list minimum.';

/** Table definitions: the columns the top-up fills, in order. */
const TABLES = [
  {
    name: 'children',
    columns: ['user_id', 'name', 'date_of_birth', 'gender', 'blood_type', 'allergies', 'notes'],
    value: (i, ctx) => [ctx.userId, `Demo Child ${i + 1}`, `20${18 + (i % 5)}-0${(i % 9) + 1}-1${i % 10}`, ['Male', 'Female', 'Other'][i % 3], ['A+', 'O+', 'B+', 'AB+'][i % 4], i % 3 === 0 ? 'Peanuts' : null, DEMO_TAG],
  },
  {
    name: 'diaper_records',
    columns: ['child_id', 'change_time', 'type', 'notes'],
    value: (i, ctx) => [ctx.childId(i), new Date(Date.now() - i * 3 * 3600 * 1000), ['Wet', 'Dirty', 'Both'][i % 3], DEMO_TAG],
  },
  {
    name: 'expenses',
    columns: ['user_id', 'child_id', 'title', 'amount', 'category', 'expense_date', 'payment_method', 'notes'],
    value: (i, ctx) => [ctx.userId, ctx.childId(i), `Demo Expense ${i + 1}`, 12.5 + i * 3, ['Diapers', 'Formula', 'Clothing', 'Toys', 'Healthcare'][i % 5], new Date(Date.now() - i * 86400000), ['Card', 'Cash'][i % 2], DEMO_TAG],
  },
  {
    name: 'caregiver_logs',
    columns: ['user_id', 'child_id', 'caregiver_name', 'relationship', 'start_time', 'end_time', 'activities', 'notes', 'rating'],
    value: (i, ctx) => {
      const start = new Date(Date.now() - i * 86400000);
      const end = new Date(start.getTime() + 4 * 3600 * 1000);
      return [ctx.userId, ctx.childId(i), `Demo Caregiver ${i + 1}`, ['Grandparent', 'Nanny', 'Babysitter', 'Aunt'][i % 4], start, end, 'Play, meals, nap', DEMO_TAG, 4 + (i % 2)];
    },
  },
  {
    name: 'daily_routines',
    columns: ['child_id', 'title', 'time_of_day', 'scheduled_time', 'duration_minutes', 'category', 'days_of_week', 'is_active', 'notes'],
    value: (i, ctx) => [ctx.childId(i), `Demo Routine ${i + 1}`, ['Morning', 'Afternoon', 'Evening', 'Night'][i % 4], `0${(6 + i) % 24}:${i % 2 ? '30' : '00'}`, 20 + i, ['Sleep', 'Meal', 'Play', 'Learning'][i % 4], 'Mon,Tue,Wed,Thu,Fri', true, DEMO_TAG],
  },
  {
    name: 'tooth_records',
    columns: ['child_id', 'tooth_name', 'tooth_position', 'event_type', 'event_date', 'notes'],
    value: (i, ctx) => [ctx.childId(i), `Demo Tooth ${i + 1}`, ['upper-left', 'upper-right', 'lower-left', 'lower-right'][i % 4], ['Erupted', 'Lost'][i % 2], new Date(Date.now() - i * 86400000), DEMO_TAG],
  },
  {
    name: 'photo_memories',
    columns: ['child_id', 'title', 'description', 'memory_date', 'category', 'location'],
    value: (i, ctx) => [ctx.childId(i), `Demo Memory ${i + 1}`, DEMO_TAG, new Date(Date.now() - i * 86400000), ['First', 'Family', 'Holiday', 'Everyday'][i % 4], ['Home', 'Park', 'Grandma\'s'][i % 3]],
  },
  {
    name: 'chores',
    columns: ['child_id', 'title', 'description', 'frequency', 'assigned_date', 'due_date', 'status', 'reward', 'notes'],
    value: (i, ctx) => [ctx.childId(i), `Demo Chore ${i + 1}`, DEMO_TAG, ['Daily', 'Weekly'][i % 2], new Date(Date.now() - i * 86400000), new Date(Date.now() + i * 86400000), ['Pending', 'In Progress', 'Done'][i % 3], `$${(i % 5) + 1}`, DEMO_TAG],
  },
  {
    name: 'allergy_logs',
    columns: ['child_id', 'allergen', 'severity', 'reaction', 'first_observed', 'last_reaction', 'treatment', 'is_confirmed', 'notes'],
    value: (i, ctx) => [ctx.childId(i), ['Peanuts', 'Milk', 'Eggs', 'Wheat', 'Soy'][i % 5], ['Mild', 'Moderate', 'Severe'][i % 3], 'Rash', new Date(Date.now() - (30 + i) * 86400000), new Date(Date.now() - i * 86400000), 'Antihistamine', i % 2 === 0, DEMO_TAG],
  },
  {
    name: 'playdates',
    columns: ['child_id', 'friend_name', 'friend_age', 'playdate_date', 'start_time', 'end_time', 'location', 'activity', 'notes'],
    value: (i, ctx) => [ctx.childId(i), `Demo Friend ${i + 1}`, 3 + (i % 5), new Date(Date.now() + i * 86400000), '15:00', '17:00', ['Home', 'Park', 'Playground'][i % 3], ['Arts', 'Blocks', 'Outdoor play'][i % 3], DEMO_TAG],
  },
  {
    name: 'emergency_contacts',
    columns: ['user_id', 'name', 'relationship', 'phone', 'email', 'address', 'is_primary'],
    value: (i, ctx) => [ctx.userId(i), `Demo Contact ${i + 1}`, ['Grandparent', 'Neighbor', 'Pediatrician', 'Aunt', 'Uncle'][i % 5], `(555) 01${String(i).padStart(2, '0')}-01${String(i).padStart(2, '0')}`, `demo.contact.${i + 1}@example.com`, `${100 + i} Demo Street`, i % 4 === 0],
  },
  {
    name: 'shopping_lists',
    columns: ['user_id', 'child_id', 'item_name', 'category', 'quantity', 'priority', 'is_purchased', 'estimated_cost', 'store', 'notes'],
    value: (i, ctx) => [ctx.userId, ctx.childId(i), `Demo Item ${i + 1}`, ['Diapers', 'Food', 'Clothing', 'Toys'][i % 4], 1 + (i % 5), ['Low', 'Medium', 'High'][i % 3], i % 3 === 0, 9.99 + i, ['Online', 'Supermarket', 'Pharmacy'][i % 3], DEMO_TAG],
  },
];

async function main() {
  const client = await pool.connect();
  try {
    const users = await client.query('SELECT id FROM users ORDER BY id');
    const children = await client.query('SELECT id FROM children ORDER BY id');
    if (!users.rows.length) throw new Error('No users found; run the base seed first.');
    if (!children.rows.length) throw new Error('No children found; run the base seed first.');
    // Rows are distributed across every account so each login sees the list
    // full, not only the account that happened to own the original seed data.
    const ctx = {
      userId: (i) => users.rows[i % users.rows.length].id,
      childId: (i) => children.rows[i % children.rows.length].id,
    };

    const userScoped = new Set(['expenses', 'caregiver_logs', 'shopping_lists', 'emergency_contacts']);
    const report = {};
    for (const table of TABLES) {
      let current;
      if (userScoped.has(table.name)) {
        // Ensure EVERY account has at least MIN_ROWS of its own rows.
        for (const user of users.rows) {
          const own = await client.query(
            `SELECT COUNT(*)::int AS c FROM ${table.name} WHERE user_id = $1`,
            [user.id],
          );
          const existing = own.rows[0].c;
          for (let index = 0; existing + (index + 1) <= MIN_ROWS; index += 1) {
            const values = table.value(index, ctx);
            // Force this row onto the account being topped up.
            const userIdColumn = table.columns.indexOf('user_id');
            if (userIdColumn >= 0) values[userIdColumn] = user.id;
            const placeholders = table.columns.map((_, position) => `$${position + 1}`).join(', ');
            await client.query(
              `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})`,
              values,
            );
          }
          current = MIN_ROWS;
        }
      } else {
        current = (await client.query(`SELECT COUNT(*)::int AS c FROM ${table.name}`)).rows[0].c;
        for (let index = current; index < MIN_ROWS; index += 1) {
          const values = table.value(index, ctx);
          const placeholders = table.columns.map((_, position) => `$${position + 1}`).join(', ');
          await client.query(
            `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})`,
            values,
          );
        }
      }
      const after = (await client.query(`SELECT COUNT(*)::int AS c FROM ${table.name}`)).rows[0].c;
      report[table.name] = { before: current, after };
      console.log(`${table.name.padEnd(20)} total ${after}`);
    }

    // The requirement is per-account for scoped tables and overall otherwise.
    for (const user of users.rows) {
      for (const name of userScoped) {
        const own = await client.query(`SELECT COUNT(*)::int AS c FROM ${name} WHERE user_id = $1`, [user.id]);
        report[`${name}:user${user.id}`] = { after: own.rows[0].c };
      }
    }

    const under = Object.entries(report).filter(([, value]) => value.after < MIN_ROWS);
    if (under.length) {
      throw new Error(`Tables still below ${MIN_ROWS}: ${under.map(([name, value]) => `${name}=${value.after}`).join(', ')}`);
    }
    console.log(`\nAll CRUD tables have at least ${MIN_ROWS} rows.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
