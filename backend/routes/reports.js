const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { FEATURE_TABLES } = require('../lib/featureTables');

const router = express.Router();

// ─── shared helpers ──────────────────────────────────────────────────────────
// All numbers below are derived from rows the caller owns. Nothing is estimated
// or invented: when there is not enough data the endpoint says so explicitly.

const DAY_MS = 24 * 60 * 60 * 1000;
const AVG_MONTH_DAYS = 30.4375; // mean Gregorian month length

const toNum = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const round2 = (value) => {
  const n = toNum(value);
  return n === null ? null : Math.round(n * 100) / 100;
};

const money = (value) => {
  const cents = Math.round((toNum(value) || 0) * 100);
  return { cents, dollars: cents / 100 };
};

const isoDate = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.length >= 10 ? value.slice(0, 10) : value;
  return new Date(value).toISOString().slice(0, 10);
};

const daysBetween = (start, end) => {
  const a = Date.parse(`${isoDate(start)}T00:00:00Z`);
  const b = Date.parse(`${isoDate(end)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / DAY_MS);
};

const clampInt = (raw, fallback, min, max) => {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** Resolve a child the authenticated user actually owns, or null. */
async function findOwnedChild(childId, userId) {
  if (!Number.isInteger(childId)) return null;
  const result = await pool.query(
    'SELECT id, name, date_of_birth::text AS date_of_birth FROM children WHERE id = $1 AND user_id = $2',
    [childId, userId]
  );
  return result.rows[0] || null;
}

/** Most recent value of a date/timestamp column for one child (or null). */
async function latestRecordDate(table, dateColumn, childId) {
  const result = await pool.query(
    `SELECT MAX(${dateColumn})::text AS max_date FROM ${table} WHERE child_id = $1`,
    [childId]
  );
  const maxDate = result.rows[0] ? result.rows[0].max_date : null;
  return maxDate ? maxDate.slice(0, 10) : null;
}

/**
 * Build a [start, end] day window of `days` days ending at the child's most
 * recent record. Anchoring to real data (instead of "today") means an older
 * log still reports real numbers; the anchor is always included in the reply.
 */
function buildWindow(anchor, days) {
  const end = anchor || new Date().toISOString().slice(0, 10);
  const startDate = new Date(`${end}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
  return { start: startDate.toISOString().slice(0, 10), end, days };
}

/** first → last movement of one metric across a series, using the real span. */
function computeDelta(series, key, unit, label) {
  const points = series.filter((row) => row[key] !== null && row[key] !== undefined);
  if (points.length < 2) {
    return {
      available: false,
      unit,
      reason: `Only ${points.length} non-null ${label} measurement(s); at least 2 are required.`,
    };
  }
  const first = points[0];
  const last = points[points.length - 1];
  const spanDays = daysBetween(first.date, last.date);
  const months = spanDays > 0 ? spanDays / AVG_MONTH_DAYS : null;
  const delta = round2(last[key] - first[key]);
  return {
    available: true,
    unit,
    first: { date: first.date, value: first[key] },
    last: { date: last.date, value: last[key] },
    delta,
    spanDays,
    months: round2(months),
    perMonth: months && months > 0 ? round2(delta / months) : null,
  };
}

// ─── GET /growth/:childId ────────────────────────────────────────────────────
router.get('/growth/:childId', auth, async (req, res) => {
  const generatedAt = new Date().toISOString();
  const definition =
    'Growth measurements for one child, ordered oldest to newest. delta = last - first non-null value; ' +
    'perMonth = delta / (actual day span / 30.4375). Null measurements are skipped, never zero-filled.';
  try {
    const childId = parseInt(req.params.childId, 10);
    const child = await findOwnedChild(childId, req.user.id);
    if (!child) {
      return res.status(404).json({ error: 'Child not found.', generatedAt });
    }

    const result = await pool.query(
      `SELECT id,
              measured_date::text AS measured_date,
              height_cm,
              weight_kg,
              head_circumference_cm,
              notes
         FROM growth_records
        WHERE child_id = $1
        ORDER BY measured_date ASC, id ASC`,
      [childId]
    );

    const series = result.rows.map((row) => ({
      id: row.id,
      date: isoDate(row.measured_date),
      heightCm: toNum(row.height_cm),
      weightKg: toNum(row.weight_kg),
      headCircumferenceCm: toNum(row.head_circumference_cm),
      notes: row.notes,
    }));

    if (series.length < 2) {
      return res.json({
        childId,
        child: { id: child.id, name: child.name, dateOfBirth: child.date_of_birth },
        insufficient: true,
        reason: `Only ${series.length} growth measurement(s) recorded; at least 2 are required to compute deltas.`,
        count: series.length,
        series,
        generatedAt,
        definition,
      });
    }

    res.json({
      childId,
      child: { id: child.id, name: child.name, dateOfBirth: child.date_of_birth },
      insufficient: false,
      count: series.length,
      series,
      deltas: {
        heightCm: computeDelta(series, 'heightCm', 'cm', 'height'),
        weightKg: computeDelta(series, 'weightKg', 'kg', 'weight'),
        headCircumferenceCm: computeDelta(series, 'headCircumferenceCm', 'cm', 'head circumference'),
      },
      generatedAt,
      definition,
    });
  } catch (err) {
    console.error('GET /reports/growth error:', err);
    res.status(500).json({ error: 'Failed to build growth report.', generatedAt });
  }
});

// ─── GET /sleep/:childId?days=30 ─────────────────────────────────────────────
router.get('/sleep/:childId', auth, async (req, res) => {
  const generatedAt = new Date().toISOString();
  const definition =
    'Per-day and overall sleep from sleep_records. duration = sleep_end - sleep_start in hours ' +
    '(invalid/null timestamps are excluded and counted). The window ends at the child\'s most recent ' +
    'sleep date and spans ?days days. longestNight/shortestNight are single sleep sessions, not day totals.';
  try {
    const childId = parseInt(req.params.childId, 10);
    const days = clampInt(req.query.days, 30, 1, 365);
    const child = await findOwnedChild(childId, req.user.id);
    if (!child) {
      return res.status(404).json({ error: 'Child not found.', generatedAt });
    }

    const anchor = await latestRecordDate('sleep_records', 'date', childId);
    const window = buildWindow(anchor, days);

    const result = await pool.query(
      `SELECT id,
              date::text AS date,
              sleep_start::text AS sleep_start,
              sleep_end::text AS sleep_end,
              quality,
              CASE
                WHEN sleep_start IS NOT NULL AND sleep_end IS NOT NULL AND sleep_end > sleep_start
                THEN ROUND((EXTRACT(EPOCH FROM (sleep_end - sleep_start)) / 3600.0)::numeric, 2)
                ELSE NULL
              END AS duration_hours
         FROM sleep_records
        WHERE child_id = $1 AND date >= $2::date AND date <= $3::date
        ORDER BY date ASC, sleep_start ASC NULLS LAST, id ASC`,
      [childId, window.start, window.end]
    );

    const records = result.rows.map((row) => ({
      id: row.id,
      date: isoDate(row.date),
      sleepStart: row.sleep_start,
      sleepEnd: row.sleep_end,
      quality: row.quality,
      durationHours: toNum(row.duration_hours),
    }));

    const valid = records.filter((row) => row.durationHours !== null);
    const totalHours = round2(valid.reduce((sum, row) => sum + row.durationHours, 0));
    const missingOrInvalidCount = records.length - valid.length;

    const byDay = new Map();
    for (const row of valid) {
      const day = byDay.get(row.date) || { date: row.date, hours: 0, sessions: 0 };
      day.hours += row.durationHours;
      day.sessions += 1;
      byDay.set(row.date, day);
    }
    const perDay = [...byDay.values()]
      .map((day) => ({ date: day.date, hours: round2(day.hours), sessions: day.sessions }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const sessionFor = (row) => ({
      id: row.id,
      date: row.date,
      sleepStart: row.sleepStart,
      sleepEnd: row.sleepEnd,
      hours: row.durationHours,
    });
    let longestNight = null;
    let shortestNight = null;
    for (const row of valid) {
      if (!longestNight || row.durationHours > longestNight.hours) longestNight = sessionFor(row);
      if (!shortestNight || row.durationHours < shortestNight.hours) shortestNight = sessionFor(row);
    }

    const insufficient = valid.length === 0;
    res.json({
      childId,
      child: { id: child.id, name: child.name },
      days,
      window,
      count: records.length,
      validCount: valid.length,
      missingOrInvalidCount,
      totalHours,
      dayCount: perDay.length,
      averageHoursPerDay: perDay.length ? round2(totalHours / perDay.length) : null,
      perDay,
      longestNight,
      shortestNight,
      insufficient,
      reason: insufficient
        ? `No sleep sessions with valid start/end times in ${window.start}..${window.end}.`
        : undefined,
      generatedAt,
      definition,
    });
  } catch (err) {
    console.error('GET /reports/sleep error:', err);
    res.status(500).json({ error: 'Failed to build sleep report.', generatedAt });
  }
});

// ─── GET /feeding/:childId?days=30 ───────────────────────────────────────────
router.get('/feeding/:childId', auth, async (req, res) => {
  const generatedAt = new Date().toISOString();
  const definition =
    'Feeding counts from feeding_records by meal_type and by calendar day. The window ends at the ' +
    'child\'s most recent meal_time and spans ?days days. Calories are summed only where present; ' +
    'records without a meal_time cannot be placed in a day and are counted separately.';
  try {
    const childId = parseInt(req.params.childId, 10);
    const days = clampInt(req.query.days, 30, 1, 365);
    const child = await findOwnedChild(childId, req.user.id);
    if (!child) {
      return res.status(404).json({ error: 'Child not found.', generatedAt });
    }

    const anchor = await latestRecordDate('feeding_records', 'meal_time', childId);
    const window = buildWindow(anchor, days);

    const [byMealType, byDay, totals, missing] = await Promise.all([
      pool.query(
        `SELECT COALESCE(meal_type, '(unknown)') AS meal_type,
                COUNT(*)::int AS count,
                COUNT(calories)::int AS records_with_calories,
                COALESCE(SUM(calories), 0)::int AS calories
           FROM feeding_records
          WHERE child_id = $1 AND meal_time::date >= $2::date AND meal_time::date <= $3::date
          GROUP BY meal_type
          ORDER BY count DESC, meal_type ASC`,
        [childId, window.start, window.end]
      ),
      pool.query(
        `SELECT meal_time::date::text AS date,
                COUNT(*)::int AS count,
                COALESCE(SUM(calories), 0)::int AS calories
           FROM feeding_records
          WHERE child_id = $1 AND meal_time::date >= $2::date AND meal_time::date <= $3::date
          GROUP BY meal_time::date
          ORDER BY meal_time::date ASC`,
        [childId, window.start, window.end]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count,
                COUNT(DISTINCT meal_time::date)::int AS days,
                COALESCE(SUM(calories), 0)::int AS calories,
                COUNT(calories)::int AS records_with_calories
           FROM feeding_records
          WHERE child_id = $1 AND meal_time::date >= $2::date AND meal_time::date <= $3::date`,
        [childId, window.start, window.end]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM feeding_records WHERE child_id = $1 AND meal_time IS NULL`,
        [childId]
      ),
    ]);

    const totalCount = totals.rows[0].count;
    const dayCount = totals.rows[0].days;
    res.json({
      childId,
      child: { id: child.id, name: child.name },
      days,
      window,
      count: totalCount,
      dayCount,
      averageMealsPerDay: dayCount ? round2(totalCount / dayCount) : null,
      caloriesTotal: totals.rows[0].calories,
      caloriesRecordsWithValue: totals.rows[0].records_with_calories,
      recordsWithoutMealTime: missing.rows[0].count,
      byMealType: byMealType.rows,
      dailyTotals: byDay.rows,
      insufficient: totalCount === 0,
      reason:
        totalCount === 0
          ? `No feeding records with a meal_time in ${window.start}..${window.end}.`
          : undefined,
      generatedAt,
      definition,
    });
  } catch (err) {
    console.error('GET /reports/feeding error:', err);
    res.status(500).json({ error: 'Failed to build feeding report.', generatedAt });
  }
});

// ─── GET /expenses/summary?from=&to= ─────────────────────────────────────────
router.get('/expenses/summary', auth, async (req, res) => {
  const generatedAt = new Date().toISOString();
  try {
    const { from, to } = req.query;
    const params = [req.user.id];
    let where = 'user_id = $1';
    if (from) {
      params.push(from);
      where += ` AND expense_date >= $${params.length}::date`;
    }
    if (to) {
      params.push(to);
      where += ` AND expense_date <= $${params.length}::date`;
    }

    const [byCategory, byMonth, total] = await Promise.all([
      pool.query(
        `SELECT COALESCE(category, '(uncategorized)') AS category,
                COUNT(*)::int AS count,
                COALESCE(SUM(amount), 0) AS total
           FROM expenses
          WHERE ${where}
          GROUP BY COALESCE(category, '(uncategorized)')
          ORDER BY SUM(amount) DESC NULLS LAST, category ASC`,
        params
      ),
      pool.query(
        `SELECT COALESCE(TO_CHAR(expense_date, 'YYYY-MM'), '(undated)') AS month,
                COUNT(*)::int AS count,
                COALESCE(SUM(amount), 0) AS total
           FROM expenses
          WHERE ${where}
          GROUP BY COALESCE(TO_CHAR(expense_date, 'YYYY-MM'), '(undated)')
          ORDER BY month ASC`,
        params
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS total
           FROM expenses
          WHERE ${where}`,
        params
      ),
    ]);

    const moneyRow = (row) => {
      const amount = money(row.total);
      return { ...row, totalCents: amount.cents, totalDollars: amount.dollars, total: amount };
    };
    const grandTotal = money(total.rows[0].total);

    res.json({
      from: from || null,
      to: to || null,
      byCategory: byCategory.rows.map(moneyRow),
      byMonth: byMonth.rows.map(moneyRow),
      total: grandTotal,
      totalCents: grandTotal.cents,
      totalDollars: grandTotal.dollars,
      count: total.rows[0].count,
      currency: 'USD',
      note:
        'Only the authenticated user\'s own expenses are included. cents is the exact integer source ' +
        'of truth; dollars = cents / 100. Omitted from/to means all dates.',
      generatedAt,
      definition:
        'Sum of expenses.amount grouped by category and by calendar month (' +
        `TO_CHAR(expense_date, 'YYYY-MM')), with a grand total. Rows with a null expense_date fall ` +
        'into the "(undated)" month; null categories into "(uncategorized)".',
    });
  } catch (err) {
    console.error('GET /reports/expenses/summary error:', err);
    res.status(500).json({ error: 'Failed to build expense summary.', generatedAt });
  }
});

// ─── GET /overview ───────────────────────────────────────────────────────────
router.get('/overview', auth, async (req, res) => {
  const generatedAt = new Date().toISOString();
  const definition =
    'Row counts for the authenticated user: children plus, for every CRUD table that has a child_id ' +
    'column, the count of that user\'s rows. User-scoped tables filter on user_id; child-scoped ' +
    'tables join through children.user_id. Tables that do not exist are skipped.';
  try {
    const columns = await pool.query(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'`
    );
    const columnMap = new Map();
    for (const row of columns.rows) {
      if (!columnMap.has(row.table_name)) columnMap.set(row.table_name, new Set());
      columnMap.get(row.table_name).add(row.column_name);
    }

    const childCount = await pool.query('SELECT COUNT(*)::int AS count FROM children WHERE user_id = $1', [
      req.user.id,
    ]);

    const candidates = FEATURE_TABLES.filter((feature) => {
      if (feature.table === 'children') return false;
      const cols = columnMap.get(feature.table);
      return cols && cols.has('child_id');
    });

    const counts = await Promise.all(
      candidates.map(async (feature) => {
        const cols = columnMap.get(feature.table);
        const query = cols.has('user_id')
          ? `SELECT COUNT(*)::int AS count FROM ${feature.table} WHERE user_id = $1`
          : `SELECT COUNT(*)::int AS count FROM ${feature.table} WHERE child_id IN (SELECT id FROM children WHERE user_id = $1)`;
        try {
          const result = await pool.query(query, [req.user.id]);
          return {
            feature: feature.feature,
            table: feature.table,
            path: feature.path,
            count: result.rows[0].count,
          };
        } catch (err) {
          // Defensive: a table present in the catalog but unusable is skipped,
          // never allowed to fail the whole overview.
          console.error(`GET /reports/overview skipped ${feature.table}:`, err.message);
          return null;
        }
      })
    );

    res.json({
      children: childCount.rows[0].count,
      perFeature: counts.filter(Boolean),
      generatedAt,
      definition,
    });
  } catch (err) {
    console.error('GET /reports/overview error:', err);
    res.status(500).json({ error: 'Failed to build overview.', generatedAt });
  }
});

module.exports = router;
