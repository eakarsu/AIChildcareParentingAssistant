import React, { useEffect, useState } from 'react';
import { aiResults } from '../api';

const FEATURE_OPTIONS = [
  '', 'insight', 'conversation-message',
  'milestone-comparison', 'sleep-optimizer', 'nutrition-advisor', 'behavior-analyzer',
  'illness-tracker', 'stress-monitor', 'screen-time-manager', 'sibling-harmony',
];

export default function AIResultsPage() {
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [feature, setFeature] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (feature) params.feature = feature;
      const res = await aiResults.list(params);
      setResults(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, total_pages: 0 });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [feature]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this AI result?')) return;
    await aiResults.remove(id);
    load(pagination.page);
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title"><span className="page-icon">📜</span> AI Results History</h1>
        <p className="page-subtitle">Review and audit prior AI outputs.</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select className="form-input" style={{ width: 280 }} value={feature} onChange={(e) => setFeature(e.target.value)}>
          {FEATURE_OPTIONS.map(f => <option key={f} value={f}>{f || 'All features'}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={() => load(pagination.page)} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Feature</th>
              <th>Model</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24 }}>No AI results yet.</td></tr>
            ) : results.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td><span className="badge badge-primary">{r.feature}</span></td>
                <td style={{ fontSize: 12 }}>{r.model}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => setSelected(r)}>View</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)} style={{ marginLeft: 8 }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', justifyContent: 'center' }}>
        <button className="btn btn-secondary" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Prev</button>
        <span>Page {pagination.page} of {pagination.total_pages || 1} ({pagination.total} total)</span>
        <button className="btn btn-secondary" disabled={pagination.page >= pagination.total_pages} onClick={() => load(pagination.page + 1)}>Next</button>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, width: '90%', maxHeight: '85vh', overflow: 'auto', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Result #{selected.id} - {selected.feature}</h2>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>X</button>
            </div>
            <h3>Input</h3>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, overflow: 'auto' }}>
              {JSON.stringify(selected.input, null, 2)}
            </pre>
            <h3>Output</h3>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, overflow: 'auto' }}>
              {JSON.stringify(selected.output, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
