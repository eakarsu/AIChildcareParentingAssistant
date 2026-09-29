import React, { useMemo, useState } from 'react';
import AIResultView from './AIResultView';
import KeyValueResult from './KeyValueResult';

/**
 * Shared form for the extension / AI pages.
 *
 * Each page declares the fields its endpoint expects. Every field carries an
 * `example`, including optional ones, so "Fill example" populates the whole form
 * in one click and the page is usable immediately. Examples are fictional and
 * are labelled as such.
 *
 * If a page has no working backend, pass `unavailable` with a reason: the form
 * still fills, but Run explains the honest state instead of pretending to call
 * something.
 */

function coerce(field, raw) {
  const value = raw ?? '';
  if (field.optional && String(value).trim() === '') return undefined;
  if (field.type === 'json') {
    if (!String(value).trim()) return field.optional ? undefined : [];
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`Invalid JSON in ${field.label}`);
    }
  }
  if (field.type === 'list') {
    const list = String(value).split(',').map((s) => s.trim()).filter(Boolean);
    return list.length ? list : undefined;
  }
  if (field.type === 'number') {
    if (String(value).trim() === '') return undefined;
    return Number(value);
  }
  return String(value);
}

export function exampleInputs(fields) {
  const next = {};
  for (const field of fields) next[field.name] = field.example ?? '';
  return next;
}

export function buildPayload(tool, inputs) {
  const payload = {};
  for (const field of tool.fields) {
    const value = coerce(field, inputs[field.name]);
    if (value !== undefined) payload[field.name] = value;
  }
  return payload;
}

export default function AIFeatureForm({
  title,
  intro,
  tool,
  endpoint,
  getEndpoint = null,
  unavailable,
  resultMode = 'auto', // 'ai' | 'kv' | 'auto'
  extraActions = null,
}) {
  const [inputs, setInputs] = useState(() => exampleInputs(tool.fields));
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filled, setFilled] = useState(false);

  const filledCount = useMemo(
    () => tool.fields.filter((f) => String(inputs[f.name] ?? '').trim() !== '').length,
    [tool, inputs],
  );

  const fillExample = () => {
    setInputs(exampleInputs(tool.fields));
    setError('');
    setFilled(true);
  };

  const clearFields = () => {
    setInputs(Object.fromEntries(tool.fields.map((f) => [f.name, ''])));
    setError('');
    setFilled(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (unavailable) {
      setError(unavailable);
      return;
    }

    setLoading(true);
    try {
      const payload = buildPayload(tool, inputs);

      // Some endpoints take an id in the path (e.g. /api/reminders/1/send) or are
      // read-only (GET). Resolve those from the same field values.
      let url = getEndpoint || endpoint;
      const method = getEndpoint ? 'GET' : 'POST';
      for (const field of tool.fields) {
        const token = `{${field.name}}`;
        if (url.includes(token)) {
          url = url.replace(token, encodeURIComponent(String(inputs[field.name] ?? '').trim()));
        }
      }

      const sendBody = method !== 'GET';
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '';
      const response = await fetch(url, {
        method,
        headers: {
          ...(sendBody ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(sendBody ? { body: JSON.stringify(payload) } : {}),
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${tool.key || 'document'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setResult({ downloaded: true, note: 'The PDF was downloaded to your device.' });
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.detail || `Request failed (${response.status})`);
      }
      setResult(data);
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const showAI = resultMode === 'ai' || (resultMode === 'auto' && result && (result.analysis || result.facts));

  return (
    <div className="container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{title}</h1>
          {intro && <p className="page-subtitle">{intro}</p>}
        </div>
      </div>

      {unavailable && (
        <div className="alert alert-warning">
          <strong>Not connected to a backend.</strong> {unavailable} The fields and examples below are illustrative;
          running the request will explain this instead of returning a result.
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="tool-header">
          <div>
            <h2>{tool.label}</h2>
            <p className="text-muted" style={{ margin: 0 }}>{tool.description}</p>
          </div>
          <div className="row-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={fillExample}>
              {filled ? '✓ Example filled' : '✨ Fill example'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFields}>
              Clear fields
            </button>
          </div>
        </div>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
          {filledCount} of {tool.fields.length} fields filled. Examples are fictional sample data, not your records.
        </p>

        <form onSubmit={handleSubmit}>
          {tool.fields.map((field) => (
            <div className="form-group" key={field.name}>
              <label className="form-label" htmlFor={`${tool.key || 'field'}-${field.name}`}>
                {field.label}
                {field.optional && <span className="form-optional"> (optional)</span>}
              </label>
              {field.type === 'json' ? (
                <textarea
                  id={`${tool.key || 'field'}-${field.name}`}
                  className="form-input form-textarea"
                  rows={5}
                  value={inputs[field.name] || ''}
                  onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                />
              ) : (
                <input
                  id={`${tool.key || 'field'}-${field.name}`}
                  className="form-input"
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={inputs[field.name] || ''}
                  onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                />
              )}
              {field.hint && <p className="form-hint">{field.hint}</p>}
            </div>
          ))}

          {extraActions}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Running…' : 'Run'}
          </button>
        </form>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {result && (
        <div className="card">
          {showAI ? <AIResultView result={result} /> : <KeyValueResult result={result} />}
        </div>
      )}
    </div>
  );
}
