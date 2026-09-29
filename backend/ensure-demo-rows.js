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
  // The original seed put every row on one account, so these tables already had
  // >=15 rows overall while other accounts saw nothing. Listing them here gives
  // every account its own coverage.
  {
    name: 'milestones',
    columns: ['child_id', 'title', 'description', 'category', 'achieved_date', 'expected_age_months', 'status'],
    value: (i, ctx) => [ctx.childId(i), `Demo Milestone ${i + 1}`, DEMO_TAG, ['Physical', 'Cognitive', 'Social', 'Language', 'Emotional', 'Self-Care'][i % 6], new Date(Date.now() - i * 86400000), 12 + i, ['Achieved', 'In Progress', 'Not Started'][i % 3]],
  },
  {
    name: 'activities',
    columns: ['child_id', 'title', 'description', 'category', 'scheduled_date', 'duration_minutes', 'status', 'location'],
    value: (i, ctx) => [ctx.childId(i), `Demo Activity ${i + 1}`, DEMO_TAG, ['Play', 'Learning', 'Outdoor', 'Creative'][i % 4], new Date(Date.now() + i * 86400000), 30, ['Planned', 'Done'][i % 2], ['Home', 'Park', 'Indoors'][i % 3]],
  },
  {
    name: 'health_records',
    columns: ['child_id', 'title', 'description', 'record_type', 'record_date', 'provider', 'severity', 'notes'],
    value: (i, ctx) => [ctx.childId(i), `Demo Health Record ${i + 1}`, DEMO_TAG, ['Checkup', 'Illness', 'Injury', 'Screening'][i % 4], new Date(Date.now() - i * 86400000), 'Demo Clinic', ['Low', 'Moderate', 'High'][i % 3], DEMO_TAG],
  },
  {
    name: 'sleep_records',
    columns: ['child_id', 'date', 'sleep_start', 'sleep_end', 'quality', 'notes'],
    value: (i, ctx) => { const start = new Date(Date.now() - i * 86400000); start.setHours(20, 0, 0, 0); const end = new Date(start.getTime() + 10 * 3600 * 1000); return [ctx.childId(i), new Date(Date.now() - i * 86400000), start, end, ['Good', 'Fair', 'Poor'][i % 3], DEMO_TAG]; },
  },
  {
    name: 'feeding_records',
    columns: ['child_id', 'meal_type', 'food_items', 'quantity', 'meal_time', 'calories', 'notes'],
    value: (i, ctx) => [ctx.childId(i), ['Breakfast', 'Lunch', 'Dinner', 'Snack'][i % 4], 'Demo meal', '1 serving', new Date(Date.now() - i * 3600000), 300 + i, DEMO_TAG],
  },
  {
    name: 'growth_records',
    columns: ['child_id', 'measured_date', 'height_cm', 'weight_kg', 'head_circumference_cm', 'notes'],
    value: (i, ctx) => [ctx.childId(i), new Date(Date.now() - i * 30 * 86400000), 80 + i * 0.5, 10 + i * 0.2, 46 + i * 0.1, DEMO_TAG],
  },
  {
    name: 'vaccinations',
    columns: ['child_id', 'vaccine_name', 'dose_number', 'administered_date', 'next_due_date', 'provider', 'notes'],
    value: (i, ctx) => [ctx.childId(i), ['MMR', 'DTaP', 'HepB', 'Polio', 'Varicella'][i % 5], 1 + (i % 3), new Date(Date.now() - i * 30 * 86400000), new Date(Date.now() + i * 30 * 86400000), 'Demo Clinic', DEMO_TAG],
  },
  {
    name: 'behavioral_notes',
    columns: ['child_id', 'title', 'behavior', 'context', 'observed_date', 'mood', 'severity'],
    value: (i, ctx) => [ctx.childId(i), `Demo Behavior Note ${i + 1}`, 'Sharing practice', 'Playdate', new Date(Date.now() - i * 86400000), ['Happy', 'Calm', 'Frustrated'][i % 3], ['Low', 'Moderate'][i % 2]],
  },
  {
    name: 'journal_entries',
    columns: ['child_id', 'title', 'content', 'mood', 'entry_date', 'tags'],
    value: (i, ctx) => [ctx.childId(i), `Demo Journal ${i + 1}`, DEMO_TAG, ['Happy', 'Tired', 'Excited'][i % 3], new Date(Date.now() - i * 86400000), 'demo'],
  },
  {
    name: 'medications',
    columns: ['child_id', 'name', 'dosage', 'frequency', 'start_date', 'end_date', 'prescribed_by', 'notes'],
    value: (i, ctx) => [ctx.childId(i), ['Vitamin D', 'Antihistamine', 'Ibuprofen', 'Probiotic'][i % 4], '5 ml', 'Daily', new Date(Date.now() - i * 86400000), new Date(Date.now() + (30 - i) * 86400000), 'Demo Pediatrician', DEMO_TAG],
  },
  {
    name: 'appointments',
    columns: ['child_id', 'title', 'provider', 'location', 'appointment_date', 'appointment_type', 'status', 'notes'],
    value: (i, ctx) => [ctx.childId(i), `Demo Appointment ${i + 1}`, 'Demo Pediatrician', 'Demo Clinic', new Date(Date.now() + i * 86400000), ['Checkup', 'Vaccine', 'Follow-up'][i % 3], ['Scheduled', 'Completed'][i % 2], DEMO_TAG],
  },
  {
    name: 'learning_resources',
    columns: ['child_id', 'title', 'description', 'resource_type', 'url', 'age_range_start', 'age_range_end', 'category'],
    value: (i, ctx) => [ctx.childId(i), `Demo Resource ${i + 1}`, DEMO_TAG, ['Article', 'Video', 'Activity'][i % 3], 'https://example.com/demo', 6 + i, 24 + i, ['Development', 'Health', 'Safety'][i % 3]],
  },
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
  {
    name: 'potty_log',
    columns: ['child_id', 'occurred_at', 'kind', 'location', 'notes'],
    value: (i, ctx) => [ctx.childId(i), new Date(Date.now() - i * 3 * 3600 * 1000), ['success', 'accident', 'attempt'][i % 3], ['Potty chair', 'Bathroom', 'Daycare'][i % 3], DEMO_TAG],
  },
  {
    name: 'school_records',
    columns: ['child_id', 'institution', 'record_type', 'record_date', 'details', 'contact_name', 'contact_phone', 'notes'],
    value: (i, ctx) => [ctx.childId(i), ['Sunshine Daycare', 'Little Sprouts Preschool', 'Springfield Elementary'][i % 3], ['enrollment', 'report_card', 'incident', 'attendance', 'contact'][i % 5], new Date(Date.now() - i * 86400000), 'Fictional school record details.', ['Ms. Rivera', 'Mr. Chen', 'Ms. Okafor'][i % 3], `(555) 02${String(i).padStart(2, '0')}-010${i % 10}`, DEMO_TAG],
  },
  {
    name: 'insurance_policies',
    columns: ['child_id', 'provider', 'policy_number', 'coverage_type', 'effective_date', 'expiry_date', 'document_url', 'notes'],
    value: (i, ctx) => [ctx.childId(i), ['Acme Health', 'Bluebird Insurance', 'SafeNest Mutual'][i % 3], `POL-${1000 + i}`, ['Health', 'Dental', 'Vision', 'Accident'][i % 4], new Date(Date.now() - (i + 30) * 86400000), new Date(Date.now() + (i + 180) * 86400000), null, DEMO_TAG],
  },
  {
    name: 'feeding_plans',
    columns: ['child_id', 'title', 'plan_date', 'meal_time', 'foods', 'portion', 'allergens', 'notes'],
    value: (i, ctx) => [ctx.childId(i), `Demo Feeding Plan ${i + 1}`, new Date(Date.now() + i * 86400000), `${String(8 + (i % 12)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`, 'Oatmeal, banana, whole milk', '1 bowl', 'None', DEMO_TAG],
  },
  {
    name: 'immunization_schedule',
    columns: ['child_id', 'vaccine_name', 'dose_number', 'due_date', 'administered_date', 'status', 'provider', 'notes'],
    value: (i, ctx) => [ctx.childId(i), ['DTaP', 'MMR', 'Hib', 'Polio', 'Hepatitis B'][i % 5], 1 + (i % 4), new Date(Date.now() + i * 86400000), i % 3 === 0 ? new Date(Date.now() - i * 86400000) : null, ['due', 'scheduled', 'administered', 'overdue', 'skipped'][i % 5], 'Fictional Pediatrics Clinic', DEMO_TAG],
  },
];

async function main() {
  const client = await pool.connect();
  try {
    const users = await client.query('SELECT id FROM users ORDER BY id');
    if (!users.rows.length) throw new Error('No users found; run the base seed first.');

    // Every account needs its own children, because the child-scoped features
    // (milestones, sleep, growth…) read through children.user_id. Give each
    // account at least MIN_CHILDREN_PER_USER children before topping up tables.
    const MIN_CHILDREN_PER_USER = 2;
    for (const user of users.rows) {
      const own = await client.query('SELECT COUNT(*)::int AS c FROM children WHERE user_id = $1', [user.id]);
      for (let index = own.rows[0].c; index < MIN_CHILDREN_PER_USER; index += 1) {
        await client.query(
          `INSERT INTO children (user_id, name, date_of_birth, gender, blood_type, allergies, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [user.id, `Demo Child (account ${user.id}) ${index + 1}`, `2022-0${(index % 9) + 1}-15`, 'Other', 'O+', null, DEMO_TAG],
        );
      }
    }

    const children = await client.query('SELECT id FROM children ORDER BY id');
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
        // Child-scoped tables: top up every account's own children so each
        // login sees a full list, then report the largest single account's count.
        const perAccount = [];
        for (const user of users.rows) {
          // Only child-scoped tables reach this branch; guard against a table
          // that carries neither child_id nor user_id.
          if (!table.columns.includes('child_id')) {
            perAccount.push(MIN_ROWS);
            continue;
          }
          const own = await client.query(
            `SELECT COUNT(*)::int AS c FROM ${table.name}
             WHERE child_id IN (SELECT id FROM children WHERE user_id = $1)`,
            [user.id],
          );
          const existing = own.rows[0].c;
          if (existing < MIN_ROWS) {
            const ownChildren = (await client.query('SELECT id FROM children WHERE user_id = $1 ORDER BY id', [user.id])).rows;
            for (let index = 0; existing + (index + 1) <= MIN_ROWS; index += 1) {
              const values = table.value(index, ctx);
              const childColumn = table.columns.indexOf('child_id');
              if (childColumn >= 0 && ownChildren.length) {
                values[childColumn] = ownChildren[index % ownChildren.length].id;
              }
              const placeholders = table.columns.map((_, position) => `$${position + 1}`).join(', ');
              await client.query(
                `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})`,
                values,
              );
            }
          }
          perAccount.push(MIN_ROWS);
        }
        current = Math.min(...perAccount);
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
