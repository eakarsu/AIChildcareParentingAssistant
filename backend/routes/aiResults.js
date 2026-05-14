// AI results history (paginated)
const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { ensureAIResultsTable } = require('../lib/aiHelpers');

const router = express.Router();

// GET /api/ai-results?page=&limit=&feature=
router.get('/', auth, async (req, res) => {
  try {
    await ensureAIResultsTable(pool);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const feature = req.query.feature;

    let where = 'WHERE user_id = $1';
    const params = [req.user.id];
    if (feature) {
      params.push(feature);
      where += ` AND feature = $${params.length}`;
    }

    const dataParams = [...params, limit, offset];
    const dataQuery = `SELECT id, feature, input, output, model, created_at
                       FROM ai_results ${where}
                       ORDER BY created_at DESC
                       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const countQuery = `SELECT COUNT(*) FROM ai_results ${where}`;

    const [data, count] = await Promise.all([
      pool.query(dataQuery, dataParams),
      pool.query(countQuery, params),
    ]);

    const total = parseInt(count.rows[0].count);
    res.json({
      data: data.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('ai-results list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai-results/:id
router.get('/:id', auth, async (req, res) => {
  try {
    await ensureAIResultsTable(pool);
    const result = await pool.query(
      'SELECT * FROM ai_results WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('ai-results detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ai-results/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureAIResultsTable(pool);
    const result = await pool.query(
      'DELETE FROM ai_results WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('ai-results delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
