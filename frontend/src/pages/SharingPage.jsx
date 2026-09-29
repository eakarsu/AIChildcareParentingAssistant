import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCall, sharing } from '../api';

const ROLES = ['caregiver', 'guardian'];
const STATUS_OPTIONS = ['invited', 'active', 'revoked'];

function StatusBadge({ status }) {
  const map = { active: 'badge-success', invited: 'badge-warning', revoked: 'badge-danger' };
  return <span className={`badge ${map[status] || 'badge-secondary'}`}>{status}</span>;
}

export default function SharingPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState('');
  const [caregivers, setCaregivers] = useState([]);
  const [audit, setAudit] = useState([]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('caregiver');
  const [inviteToken, setInviteToken] = useState('');
  const [acceptToken, setAcceptToken] = useState(tokenFromUrl);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiCall('/children')
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setChildren(list);
        if (list.length > 0) setChildId(String(list[0].id));
      })
      .catch((err) => setError(err.message));
  }, []);

  const refresh = useCallback(async (id) => {
    if (!id) return;
    try {
      const [cg, events] = await Promise.all([sharing.list(id), sharing.audit(id)]);
      setCaregivers(Array.isArray(cg) ? cg : []);
      setAudit(Array.isArray(events) ? events : []);
      setError('');
    } catch (err) {
      setCaregivers([]);
      setAudit([]);
      setError(err.message);
    }
  }, []);

  useEffect(() => { refresh(childId); }, [childId, refresh]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setInviteToken('');
    try {
      const res = await sharing.invite(childId, { email: inviteEmail, role: inviteRole });
      setInviteToken(res.invite_token);
      setNotice(`Invitation created for ${res.caregiver.user_email}.`);
      setInviteEmail('');
      await refresh(childId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await sharing.accept(acceptToken);
      setNotice(res.already_accepted ? 'Invitation was already accepted.' : 'Invitation accepted.');
      setAcceptToken('');
      await refresh(childId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (userId, patch) => {
    setBusy(true);
    setError('');
    try {
      await sharing.update(childId, userId, patch);
      await refresh(childId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId, email) => {
    if (!window.confirm(`Remove caregiver ${email || userId}?`)) return;
    setBusy(true);
    setError('');
    try {
      await sharing.remove(childId, userId);
      await refresh(childId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title"><span className="page-icon">🧑‍🤝‍🧑</span> Caregiver Sharing</h1>
        <p className="page-subtitle">Invite co-parents and caregivers and review every access change.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Accept an invitation</h3>
        <p className="muted">Paste the invite token you received, or open the invite link with <code>?token=…</code>.</p>
        <form onSubmit={handleAccept} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ flex: '1 1 320px' }}
            placeholder="Invite token"
            value={acceptToken}
            onChange={(e) => setAcceptToken(e.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={busy || !acceptToken}>Accept invitation</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ maxWidth: 420 }}>
          <label className="form-label" htmlFor="sharing-child">Child</label>
          <select
            id="sharing-child"
            className="form-input"
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
          >
            <option value="">Select a child…</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>{child.name}</option>
            ))}
          </select>
        </div>

        <h3 style={{ marginTop: '1rem' }}>Invite a caregiver</h3>
        <p className="muted">The person must already have an account. They accept using the token below.</p>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1 1 260px' }}>
            <label className="form-label" htmlFor="invite-email">Email</label>
            <input
              id="invite-email"
              type="email"
              className="form-input"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ width: 180 }}>
            <label className="form-label" htmlFor="invite-role">Role</label>
            <select id="invite-role" className="form-input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !childId}>Send invite</button>
        </form>

        {inviteToken && (
          <div className="alert alert-success" style={{ marginTop: '1rem', wordBreak: 'break-all' }}>
            Share this token with the invitee: <code>{inviteToken}</code>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Caregivers</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {caregivers.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24 }}>No caregivers yet.</td></tr>
              ) : caregivers.map((cg) => (
                <tr key={cg.id}>
                  <td>{cg.user_name || cg.user_id}</td>
                  <td>{cg.user_email}</td>
                  <td>
                    <select
                      className="form-input"
                      value={cg.role}
                      disabled={busy}
                      onChange={(e) => handleUpdate(cg.user_id, { role: e.target.value })}
                    >
                      {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </td>
                  <td><StatusBadge status={cg.status} /></td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select
                      className="form-input"
                      style={{ width: 130 }}
                      value={cg.status}
                      disabled={busy}
                      onChange={(e) => handleUpdate(cg.user_id, { status: e.target.value })}
                    >
                      {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={busy}
                      onClick={() => handleRemove(cg.user_id, cg.user_email)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Audit trail</h3>
        <p className="muted">Newest first, capped at 200 events.</p>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>By</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 24 }}>No audit events yet.</td></tr>
              ) : audit.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.created_at).toLocaleString()}</td>
                  <td><span className="badge badge-primary">{event.action}</span></td>
                  <td>{event.user_name || event.user_email || event.user_id || 'system'}</td>
                  <td style={{ fontSize: 12 }}><code>{JSON.stringify(event.details)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
