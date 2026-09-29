const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { FEATURE_TABLES } = require('../lib/featureTables');

const router = express.Router();

const MAX_RESULTS = 50;
const MAX_PER_FEATURE = 5;

/**
 * Escape the LIKE/ILIKE wildcards so a user typing "50%" or "a_b" searches for
 * those literal characters instead of turning them into patterns.
 */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Build one SELECT per feature table. Returns null when the table (or every
 * declared search column) is missing, so a schema drift skips the feature
 * instead of failing the whole search.
 */
async function buildQuery(feature, columnMap) {
  const cols = columnMap.get(feature.table);
  if (!cols) return null;

  const searchCols = feature.search.filter((col) => cols.has(col));
  if (searchCols.length === 0) return null;

  const titleCols = feature.title.filter((col) => cols.has(col));
  const subtitleCols = feature.subtitle.filter((col) => cols.has(col));

  const text = (col) => `t.${col}::text`;
  const titleExpr = titleCols.length
    ? `COALESCE(${titleCols.map((col) => `NULLIF(${text(col)}, '')`).join(', ')}, '')`
    : `''`;
  const subtitleExpr = subtitleCols.length
    ? `CONCAT_WS(' · ', ${subtitleCols.map(text).join(', ')})`
    : `''`;

  const matches = searchCols.map((col) => `${text(col)} ILIKE $1 ESCAPE '\\'`).join(' OR ');
  const scope =
    feature.scope === 'user'
      ? 't.user_id = $2'
      : 't.child_id IN (SELECT id FROM children WHERE user_id = $2)';

  const sql = `SELECT t.id, ${titleExpr} AS title, ${subtitleExpr} AS subtitle
                 FROM ${feature.table} t
                WHERE (${matches}) AND (${scope})
                ORDER BY t.id ASC
                LIMIT ${MAX_PER_FEATURE}`;

  return { sql, feature };
}

// ─── GET /?q= ────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      return res.json([]);
    }

    const columnResult = await pool.query(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'`
    );
    const columnMap = new Map();
    for (const row of columnResult.rows) {
      if (!columnMap.has(row.table_name)) columnMap.set(row.table_name, new Set());
      columnMap.get(row.table_name).add(row.column_name);
    }

    const pattern = `%${escapeLike(q)}%`;
    const plans = (await Promise.all(FEATURE_TABLES.map((feature) => buildQuery(feature, columnMap)))).filter(
      Boolean
    );

    // Each table is queried in its own right; a failure in one feature must not
    // hide results from the others.
    const perFeature = await Promise.all(
      plans.map(async ({ sql, feature }) => {
        try {
          const result = await pool.query(sql, [pattern, req.user.id]);
          return result.rows.map((row) => ({
            feature: feature.feature,
            id: row.id,
            title: row.title || `${feature.feature} #${row.id}`,
            subtitle: row.subtitle || null,
            path: feature.path,
          }));
        } catch (err) {
          console.error(`GET /search skipped ${feature.table}:`, err.message);
          return [];
        }
      })
    );

    // Flatten in feature order (groups are contiguous) and cap the total.
    const results = perFeature.flat().slice(0, MAX_RESULTS);
    res.json(results);
  } catch (err) {
    console.error('GET /search error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

module.exports = router;
