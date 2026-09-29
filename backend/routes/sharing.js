/**
 * Caregiver sharing with an audit trail.
 *
 * Access rule: a user may read a child's records when they own the child
 * (children.user_id) or hold an active child_caregivers row for that child.
 * See ../lib/childAccess.js.
 *
 * Guardians (the child owner, or an active guardian caregiver) may invite,
 * update, and remove caregivers. The last remaining active guardian cannot be
 * revoked or removed.
 */
const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireChildAccess } = require('../lib/childAccess');
const { recordAudit } = require('../lib/audit');

const router = express.Router();

const ROLES = ['guardian', 'caregiver'];
const STATUSES = ['invited', 'active', 'revoked'];

function newInviteToken() {
  // 48 hex chars, comfortably under the VARCHAR(80) limit.
  return crypto.randomBytes(24).toString('hex');
}

async function isChildGuardian(userId, childId) {
  const owner = await pool.query(
    'SELECT 1 FROM children WHERE id = $1 AND user_id = $2',
    [childId, userId]
  );
  if (owner.rows.length > 0) return true;

  const guardian = await pool.query(
    `SELECT 1 FROM child_caregivers
      WHERE child_id = $1 AND user_id = $2 AND role = 'guardian' AND status = 'active'`,
    [childId, userId]
  );
  return guardian.rows.length > 0;
}

async function activeGuardianCount(childId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM child_caregivers
      WHERE child_id = $1 AND role = 'guardian' AND status = 'active'`,
    [childId]
  );
  return result.rows[0].count;
}

// ─── GET /sharing/:childId - List caregivers for a child ─────────────────────
router.get('/:childId', auth, requireChildAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cc.*, u.name AS user_name, u.email AS user_email
         FROM child_caregivers cc
         JOIN users u ON u.id = cc.user_id
        WHERE cc.child_id = $1
        ORDER BY CASE cc.status
                   WHEN 'active' THEN 0
                   WHEN 'invited' THEN 1
                   ELSE 2
                 END,
                 cc.role,
                 cc.created_at`,
      [Number(req.params.childId)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('list caregivers error:', err);
    res.status(500).json({ error: 'Failed to list caregivers.' });
  }
});

// ─── POST /sharing/accept - Accept a pending invitation ──────────────────────
router.post('/accept', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required.' });

    const found = await pool.query('SELECT * FROM child_caregivers WHERE invite_token = $1', [token]);
    if (found.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or already used.' });
    }

    const invite = found.rows[0];
    if (invite.user_id !== req.user.id) {
      return res.status(403).json({ error: 'This invitation was issued to a different user.' });
    }
    if (invite.status === 'active') {
      return res.json({ caregiver: invite, already_accepted: true });
    }
    if (invite.status === 'revoked') {
      return res.status(409).json({ error: 'This invitation has been revoked.' });
    }

    const updated = await pool.query(
      `UPDATE child_caregivers
          SET status = 'active', invite_token = NULL, updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [invite.id]
    );

    await recordAudit({
      userId: req.user.id,
      action: 'caregiver.accepted',
      entity: 'child',
      entityId: invite.child_id,
      details: { caregiver_user_id: req.user.id, role: invite.role },
    });

    res.json({ caregiver: updated.rows[0], already_accepted: false });
  } catch (err) {
    console.error('accept invite error:', err);
    res.status(500).json({ error: 'Failed to accept invitation.' });
  }
});

// ─── POST /sharing/:childId/invite - Invite a registered user ────────────────
router.post('/:childId/invite', auth, requireChildAccess, async (req, res) => {
  try {
    const childId = Number(req.params.childId);
    const { email, role } = req.body;
    const inviteRole = role || 'caregiver';

    if (!email) return res.status(400).json({ error: 'email is required.' });
    if (!ROLES.includes(inviteRole)) {
      return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
    }
    if (!(await isChildGuardian(req.user.id, childId))) {
      return res.status(403).json({ error: 'Only a guardian can invite caregivers.' });
    }

    const normalized = String(email).trim().toLowerCase();
    const userResult = await pool.query(
      'SELECT id, name, email FROM users WHERE LOWER(email) = $1',
      [normalized]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No registered user with that email. Ask them to register first.' });
    }
    const invited = userResult.rows[0];

    const existing = await pool.query(
      'SELECT * FROM child_caregivers WHERE child_id = $1 AND user_id = $2',
      [childId, invited.id]
    );
    if (existing.rows.length > 0 && existing.rows[0].status === 'active') {
      return res.status(409).json({ error: 'That user is already an active caregiver for this child.' });
    }

    const token = newInviteToken();
    let row;
    if (existing.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE child_caregivers
            SET role = $1, status = 'invited', invited_by = $2, invite_token = $3, updated_at = NOW()
          WHERE child_id = $4 AND user_id = $5
          RETURNING *`,
        [inviteRole, req.user.id, token, childId, invited.id]
      );
      row = updated.rows[0];
    } else {
      const inserted = await pool.query(
        `INSERT INTO child_caregivers (child_id, user_id, role, status, invited_by, invite_token)
         VALUES ($1, $2, $3, 'invited', $4, $5)
         RETURNING *`,
        [childId, invited.id, inviteRole, req.user.id, token]
      );
      row = inserted.rows[0];
    }

    await recordAudit({
      userId: req.user.id,
      action: 'caregiver.invited',
      entity: 'child',
      entityId: childId,
      details: { caregiver_user_id: invited.id, email: invited.email, role: inviteRole },
    });

    res.status(201).json({
      caregiver: { ...row, user_name: invited.name, user_email: invited.email },
      invite_token: token,
    });
  } catch (err) {
    console.error('invite caregiver error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That user already has a caregiver record for this child.' });
    }
    res.status(500).json({ error: 'Failed to invite caregiver.' });
  }
});

// ─── GET /sharing/:childId/audit - Child audit trail (newest first, cap 200) ─
router.get('/:childId/audit', auth, requireChildAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ae.*, u.name AS user_name, u.email AS user_email
         FROM audit_events ae
         LEFT JOIN users u ON u.id = ae.user_id
        WHERE ae.entity = 'child' AND ae.entity_id = $1
        ORDER BY ae.created_at DESC, ae.id DESC
        LIMIT 200`,
      [Number(req.params.childId)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('child audit error:', err);
    res.status(500).json({ error: 'Failed to load audit trail.' });
  }
});

// ─── PUT /sharing/:childId/:userId - Update a caregiver (guardian only) ──────
router.put('/:childId/:userId', auth, async (req, res) => {
  try {
    const childId = Number(req.params.childId);
    const targetUserId = Number(req.params.userId);
    const { role, status } = req.body;

    if (role === undefined && status === undefined) {
      return res.status(400).json({ error: 'Provide role and/or status.' });
    }
    if (role !== undefined && !ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
    }
    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }
    if (!(await isChildGuardian(req.user.id, childId))) {
      return res.status(403).json({ error: 'Only a guardian can change caregiver access.' });
    }

    const existing = await pool.query(
      'SELECT * FROM child_caregivers WHERE child_id = $1 AND user_id = $2',
      [childId, targetUserId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Caregiver not found for this child.' });
    }
    const current = existing.rows[0];
    const nextRole = role !== undefined ? role : current.role;
    const nextStatus = status !== undefined ? status : current.status;

    const losesGuardian =
      current.role === 'guardian' &&
      current.status === 'active' &&
      (nextRole !== 'guardian' || nextStatus !== 'active');
    if (losesGuardian && (await activeGuardianCount(childId)) <= 1) {
      return res.status(409).json({ error: 'Cannot revoke the last guardian for this child.' });
    }

    const updated = await pool.query(
      `UPDATE child_caregivers
          SET role = $1, status = $2, updated_at = NOW()
        WHERE child_id = $3 AND user_id = $4
        RETURNING *`,
      [nextRole, nextStatus, childId, targetUserId]
    );

    await recordAudit({
      userId: req.user.id,
      action: 'caregiver.updated',
      entity: 'child',
      entityId: childId,
      details: {
        caregiver_user_id: targetUserId,
        before: { role: current.role, status: current.status },
        after: { role: nextRole, status: nextStatus },
      },
    });

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('update caregiver error:', err);
    res.status(500).json({ error: 'Failed to update caregiver.' });
  }
});

// ─── DELETE /sharing/:childId/:userId - Remove a caregiver (guardian only) ───
router.delete('/:childId/:userId', auth, async (req, res) => {
  try {
    const childId = Number(req.params.childId);
    const targetUserId = Number(req.params.userId);

    if (!(await isChildGuardian(req.user.id, childId))) {
      return res.status(403).json({ error: 'Only a guardian can remove caregivers.' });
    }

    const existing = await pool.query(
      'SELECT * FROM child_caregivers WHERE child_id = $1 AND user_id = $2',
      [childId, targetUserId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Caregiver not found for this child.' });
    }
    const current = existing.rows[0];
    if (
      current.role === 'guardian' &&
      current.status === 'active' &&
      (await activeGuardianCount(childId)) <= 1
    ) {
      return res.status(409).json({ error: 'Cannot remove the last guardian for this child.' });
    }

    await pool.query(
      'DELETE FROM child_caregivers WHERE child_id = $1 AND user_id = $2',
      [childId, targetUserId]
    );

    await recordAudit({
      userId: req.user.id,
      action: 'caregiver.removed',
      entity: 'child',
      entityId: childId,
      details: { caregiver_user_id: targetUserId, role: current.role, status: current.status },
    });

    res.json({ message: 'Caregiver removed.', caregiver: current });
  } catch (err) {
    console.error('remove caregiver error:', err);
    res.status(500).json({ error: 'Failed to remove caregiver.' });
  }
});

module.exports = router;
