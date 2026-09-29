const pool = require('../db');

/**
 * Shared child-access rule.
 *
 * A user may read a child's records when either:
 *   - they own the child (children.user_id = userId), or
 *   - they hold an active child_caregivers row for (childId, userId).
 *
 * NOTE: this helper is used by the new /api/sharing routes. Existing record
 * routes still enforce their own ownership checks and have deliberately not
 * been retrofitted, so the wider API remains permissive for now.
 */
async function canAccessChild(userId, childId) {
  const numericChildId = Number(childId);
  if (!userId || !Number.isInteger(numericChildId)) return false;

  const result = await pool.query(
    `SELECT 1
       FROM children c
      WHERE c.id = $1
        AND (
          c.user_id = $2
          OR EXISTS (
            SELECT 1
              FROM child_caregivers cc
             WHERE cc.child_id = c.id
               AND cc.user_id = $2
               AND cc.status = 'active'
          )
        )
      LIMIT 1`,
    [numericChildId, userId]
  );

  return result.rows.length > 0;
}

/**
 * Express middleware. Expects the child id in req.params.childId (falls back to
 * req.params.id).
 */
async function requireChildAccess(req, res, next) {
  const childId = req.params.childId || req.params.id;
  try {
    if (await canAccessChild(req.user.id, childId)) return next();
    return res.status(403).json({ error: 'You do not have access to this child.' });
  } catch (err) {
    console.error('childAccess middleware error:', err.message);
    return res.status(500).json({ error: 'Failed to verify child access.' });
  }
}

module.exports = { canAccessChild, requireChildAccess };
