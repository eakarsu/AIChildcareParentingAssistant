const pool = require('../db');

/**
 * Append an audit event. Auditing must never break the request path, so this
 * helper swallows (and logs) its own errors.
 *
 * @param {object} event
 * @param {number|null} event.userId    Actor.
 * @param {string}      event.action    e.g. 'caregiver.invited'.
 * @param {string}      event.entity    e.g. 'child' or 'reminder'.
 * @param {number|null} event.entityId  Related row id.
 * @param {object|null} event.details   Arbitrary JSON payload.
 */
async function recordAudit({ userId = null, action, entity, entityId = null, details = null }) {
  if (!action || !entity) return;
  try {
    await pool.query(
      `INSERT INTO audit_events (user_id, action, entity, entity_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, action, entity, entityId, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('audit_events insert failed:', err.message);
  }
}

module.exports = { recordAudit };
