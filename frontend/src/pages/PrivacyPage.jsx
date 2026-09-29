import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { deleteAccount, downloadAccountExport, getAccountSummary } from '../api';

/**
 * Privacy & data page.
 *
 * Everything here is deterministic: the counts come from the account summary
 * endpoint, and export/download triggers a real database read. Account deletion
 * is irreversible and requires typing the account email to confirm.
 */
export default function PrivacyPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSummary(await getAccountSummary());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async (format) => {
    setBusy(format);
    setError('');
    try {
      await downloadAccountExport(format);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this account and every record it owns? This cannot be undone.')) return;
    setDeleting(true);
    setError('');
    try {
      await deleteAccount(confirmEmail.trim());
      logout();
      navigate('/login');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title"><span className="page-icon">🔐</span>Privacy &amp; Data</h1>
          <p className="page-subtitle">Export or delete everything this account owns.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title">Your data</h2>
        {loading ? (
          <p>Counting your records…</p>
        ) : summary ? (
          <>
            <p className="text-muted">
              Signed in as <strong>{summary.account?.email ?? user?.email}</strong>. The counts below are exactly
              what an export includes and what deletion removes.
            </p>
            <div className="detail-grid" style={{ marginTop: '1rem' }}>
              {Object.entries(summary.counts || {}).map(([key, value]) => (
                <div className="detail-field" key={key}>
                  <span className="detail-label">{key.replace(/_/g, ' ')}</span>
                  <span className="detail-value">{value}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p>No summary available.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title">Export</h2>
        <p className="text-muted">
          Download every row this account owns, as a portable JSON file or a CSV bundle. The export contains only
          your own records.
        </p>
        <div className="row-actions" style={{ marginTop: '0.75rem' }}>
          <button className="btn btn-primary" disabled={busy === 'json'} onClick={() => handleExport('json')}>
            {busy === 'json' ? 'Preparing…' : '⬇️ Download JSON'}
          </button>
          <button className="btn btn-secondary" disabled={busy === 'csv'} onClick={() => handleExport('csv')}>
            {busy === 'csv' ? 'Preparing…' : '⬇️ Download CSV'}
          </button>
        </div>
      </div>

      <div className="card" style={{ borderColor: '#fecaca' }}>
        <h2 className="card-title" style={{ color: '#b91c1c' }}>Delete account</h2>
        <p className="text-muted">
          This permanently deletes your account and every child and record it owns. It cannot be undone, and no
          export is created automatically — download your data first.
        </p>
        <div className="form-group" style={{ maxWidth: 420, marginTop: '0.75rem' }}>
          <label className="form-label" htmlFor="confirmEmail">
            Type <strong>{user?.email}</strong> to confirm
          </label>
          <input
            id="confirmEmail"
            className="form-input"
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
            placeholder={user?.email || 'your email'}
          />
        </div>
        <button
          className="btn btn-danger"
          disabled={deleting || !confirmEmail.trim() || confirmEmail.trim() !== (user?.email || '')}
          onClick={handleDelete}
          style={{ marginTop: '0.75rem' }}
        >
          {deleting ? 'Deleting…' : '🗑️ Delete my account and all data'}
        </button>
      </div>
    </div>
  );
}
