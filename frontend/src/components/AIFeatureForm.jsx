import React, { useEffect, useMemo, useState } from 'react';
import AIResultView from './AIResultView';
import KeyValueResult from './KeyValueResult';
import NativeAIControls from './NativeAIControls';
import useNativeAIRequest from './useNativeAIRequest';
import { fetchItems } from '../api';

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

const PRESET_LABELS = ['Standard example', 'Focused review', 'Latest observations'];
const isReferenceField = (field) => /(?:^|_)(?:id|ids)$|[a-z]Id$/.test(field.name);

function exampleValue(field, variant) {
  const base = field.example ?? '';
  if (field.type === 'json' && String(base).trim()) {
    const parsed = JSON.parse(base);
    if (!Array.isArray(parsed) || variant === 0 || parsed.length < 2) return JSON.stringify(parsed, null, 2);
    const selected = variant === 1 ? parsed.slice(0, Math.max(1, Math.ceil(parsed.length / 2))) : parsed.slice(-Math.max(1, Math.ceil(parsed.length / 2)));
    return JSON.stringify(selected, null, 2);
  }
  if (field.type === 'list' && variant > 0) {
    const items = String(base).split(',').map((item) => item.trim()).filter(Boolean);
    const selected = variant === 1 ? items.slice(0, Math.max(1, Math.ceil(items.length / 2))) : items.slice(-Math.max(1, Math.ceil(items.length / 2)));
    return selected.join(', ');
  }
  if (field.type === 'number' && String(base).trim() && Number.isFinite(Number(base))) {
    return String(Number(base) + variant * (field.name.includes('hour') ? 12 : 3));
  }
  return base;
}

export function buildPayload(tool, inputs) {
  const payload = {};
  for (const field of tool.fields) {
    const value = coerce(field, inputs[field.name]);
    if (value !== undefined) payload[field.name] = value;
  }
  return payload;
}

function OptionalAIControls({ enabled, children, ...props }) {
  return enabled ? <NativeAIControls {...props}>{children}</NativeAIControls> : <>{children}</>;
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
  const nativeAIRequest = useNativeAIRequest();
  const aiForm = resultMode === 'ai';
  const referenceFields = useMemo(
    () => aiForm ? tool.fields.filter(isReferenceField) : [],
    [aiForm, tool],
  );
  const [children, setChildren] = useState([]);
  const sampleInputs = (variant = 0, current = {}, availableChildren = children) => Object.fromEntries(tool.fields.map((field) => {
    if (aiForm && isReferenceField(field)) {
      const selected = availableChildren.find((child) => String(child.id) === String(current[field.name]))
        || availableChildren[variant % Math.max(availableChildren.length, 1)];
      return [field.name, selected ? String(selected.id) : ''];
    }
    return [field.name, exampleValue(field, variant)];
  }));
  const [inputs, setInputs] = useState(() => sampleInputs());
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filled, setFilled] = useState(false);
  useEffect(() => nativeAIRequest.cancel, [endpoint, tool.key, nativeAIRequest.cancel]);
  useEffect(() => {
    if (!referenceFields.length) return undefined;
    let alive = true;
    fetchItems('/children', { limit: 200 })
      .then((response) => {
        if (!alive) return;
        const available = Array.isArray(response) ? response : response.data || response.items || [];
        setChildren(available);
        setInputs((current) => sampleInputs(0, current, available));
      })
      .catch(() => {
        if (alive) setError('Child records could not be loaded. Reload before using a child-linked AI request.');
      });
    return () => { alive = false; };
  // The tool definition is static for each mounted page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceFields.length]);

  const filledCount = useMemo(
    () => tool.fields.filter((f) => String(inputs[f.name] ?? '').trim() !== '').length,
    [tool, inputs],
  );

  const fillExample = (variant = 0) => {
    const next = sampleInputs(variant, inputs);
    setInputs(next);
    setError('');
    setFilled(true);
    const manual = referenceFields
      .filter((field) => !next[field.name])
      .map((field) => field.label);
    return {
      filled: tool.fields.length - manual.length,
      manual,
    };
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
      const transport = async (signal) => {
        const response = await fetch(url, {
        ...(signal ? { signal } : {}),
        method,
        headers: {
          ...(sendBody ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(sendBody ? { body: JSON.stringify(payload) } : {}),
        });
        await response.clone().arrayBuffer();
        return response;
      };
      const response = aiForm ? await nativeAIRequest.run(transport) : await transport();

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
            {!aiForm && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillExample(0)}>
                {filled ? '✓ Example filled' : '✨ Fill example'}
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFields}>
              Clear fields
            </button>
          </div>
        </div>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
          {filledCount} of {tool.fields.length} fields filled. Examples are fictional sample data, not your records.
        </p>
        {referenceFields.length > 0 && (
          <p role="status" className="text-muted" style={{ fontSize: '0.8rem' }}>
            {children.length
              ? 'Child-linked presets keep your current real child selection; they never invent a record ID.'
              : 'Load an actual child record to complete child-linked presets. No record ID will be invented.'}
          </p>
        )}

        <OptionalAIControls
          enabled={aiForm && !unavailable}
          busy={nativeAIRequest.busy}
          onCancel={() => { nativeAIRequest.cancel(); setLoading(false); }}
          context={title}
          presets={PRESET_LABELS.map((name, variant) => ({ name, fill: () => fillExample(variant) }))}
        >
        <form onSubmit={handleSubmit}>
          {tool.fields.map((field) => (
            <div className="form-group" key={field.name}>
              <label className="form-label" htmlFor={`${tool.key || 'field'}-${field.name}`}>
                {field.label}
                {field.optional && <span className="form-optional"> (optional)</span>}
              </label>
              {aiForm && isReferenceField(field) ? (
                <select
                  data-ai-field={field.name}
                  id={`${tool.key || 'field'}-${field.name}`}
                  className="form-input"
                  value={inputs[field.name] ?? ''}
                  onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                  required={!field.optional}
                >
                  <option value="">Select an actual child…</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>{child.name || `Child #${child.id}`}</option>
                  ))}
                </select>
              ) : field.type === 'json' ? (
                <textarea
                  data-ai-field={field.name}
                  id={`${tool.key || 'field'}-${field.name}`}
                  className="form-input form-textarea"
                  rows={5}
                  value={inputs[field.name] || ''}
                  onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                />
              ) : (
                <input
                  data-ai-field={field.name}
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

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || referenceFields.some((field) => !field.optional && !inputs[field.name])}
          >
            {loading ? 'Running…' : 'Run'}
          </button>
        </form>
        </OptionalAIControls>
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
