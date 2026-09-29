import React from 'react';

/**
 * Professional renderer for AI results.
 *
 * The AI endpoints return structured JSON. Dumping that raw is unreadable, so
 * this component walks the object and renders it as headings, prose, key/value
 * cards, bullet lists and simple tables instead of JSON. It never invents data:
 * whatever the endpoint returned is what is shown, including raw fallbacks.
 */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Minimal, safe markdown → HTML for model prose (bold/italic/lists/headers). */
function formatProse(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|\s)\*([^*]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  return html
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h|ul|ol|p|table)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('');
}

function humanize(key) {
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

function isScalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function displayScalar(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** Keys whose values read best as prose rather than a bullet list. */
const PROSE_KEYS = /summary|overview|answer|explanation|assessment|note|rationale|analysis|guidance|message/i;
/** Keys that are structured lists of records. */
const LIST_OF_OBJECTS = /^(bycategory|bymonth|perfeature|examples|actions|recommendations|findings|steps|questions|nextsteps|records|items|logs|entries)$/i;

function ObjectBlock({ value, depth = 0 }) {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== '');
  if (!entries.length) return <p className="ai-empty">No detail returned.</p>;
  return (
    <div className={`ai-block ai-block-depth-${Math.min(depth, 3)}`}>
      {entries.map(([key, item]) => (
        <section className="ai-field" key={key}>
          <h4 className="ai-field-label">{humanize(key)}</h4>
          <ValueBlock value={item} name={key} depth={depth + 1} />
        </section>
      ))}
    </div>
  );
}

function TableBlock({ rows, columns }) {
  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{humanize(c)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => <td key={c}>{displayScalar(row[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValueBlock({ value, name = '', depth = 0 }) {
  if (value === null || value === undefined || value === '') {
    return <p className="ai-value ai-value-empty">—</p>;
  }

  if (isScalar(value)) {
    if (typeof value === 'string' && PROSE_KEYS.test(name)) {
      return <div className="ai-prose" dangerouslySetInnerHTML={{ __html: formatProse(value) }} />;
    }
    return <p className="ai-value">{displayScalar(value)}</p>;
  }

  if (Array.isArray(value)) {
    if (!value.length) return <p className="ai-value ai-value-empty">None returned.</p>;
    // Array of objects → table when the shape is uniform and flat.
    if (value.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
      const columns = [...new Set(value.flatMap((v) => Object.keys(v)))];
      const flat = columns.every((c) => value.every((v) => v[c] === undefined || isScalar(v[c])));
      if (flat && columns.length && columns.length <= 8) {
        return <TableBlock rows={value} columns={columns} />;
      }
      return (
        <div className="ai-card-list">
          {value.map((item, i) => (
            <div className="ai-card" key={i}>
              <ObjectBlock value={item} depth={depth} />
            </div>
          ))}
        </div>
      );
    }
    // Array of strings → bullets (or chips when short).
    const chips = value.every((v) => typeof v === 'string' && v.length <= 42);
    if (chips) {
      return <div className="ai-chips">{value.map((v, i) => <span className="ai-chip" key={i}>{v}</span>)}</div>;
    }
    return (
      <ul className="ai-list">
        {value.map((v, i) => <li key={i}>{isScalar(v) ? displayScalar(v) : <ValueBlock value={v} depth={depth} />}</li>)}
      </ul>
    );
  }

  return <ObjectBlock value={value} depth={depth} />;
}

export default function AIResultView({ result }) {
  if (!result) return null;

  // The endpoints wrap answers as { analysis: {...} } or return facts + prose.
  const body = result.analysis ?? result;
  const facts = result.facts;
  const advisory = result.advisory_text || result.disclaimer || result.note;
  const model = result.model || result.ai?.model;
  const providerUsed = result.provider_used ?? result.ai?.usedProvider;

  return (
    <div className="ai-result">
      <div className="ai-result-header">
        <span className="ai-result-icon">🤖</span>
        <div>
          <h3 className="ai-result-title">Result</h3>
          <p className="ai-result-meta">
            {providerUsed === false ? 'Deterministic result (AI unavailable)' : model ? `Model: ${model}` : 'AI result'}
          </p>
        </div>
      </div>

      {advisory && <div className="alert alert-info">{advisory}</div>}

      {/* Deterministic facts computed in code are shown first, labelled. */}
      {facts && (
        <section className="ai-section">
          <h4 className="ai-section-title">Facts computed from your records</h4>
          <ValueBlock value={facts} name="facts" />
        </section>
      )}

      <section className="ai-section">
        <h4 className="ai-section-title">{facts ? 'AI interpretation' : 'Result'}</h4>
        <ValueBlock value={body} name="analysis" />
      </section>

      {result.crisis_resources && (
        <div className="alert alert-warning">
          <strong>Crisis resources</strong>
          <ul>
            {result.crisis_resources.national_crisis_line && (
              <li>National Crisis Line: {result.crisis_resources.national_crisis_line}</li>
            )}
            {result.crisis_resources.postpartum_support_international && (
              <li>Postpartum Support International: {result.crisis_resources.postpartum_support_international}</li>
            )}
          </ul>
          {result.crisis_resources.note && <p>{result.crisis_resources.note}</p>}
        </div>
      )}

      {result.parsed === false && result.raw && (
        <section className="ai-section">
          <h4 className="ai-section-title">Raw provider text (could not be parsed)</h4>
          {result.parse_reason && <p className="text-muted">{result.parse_reason}</p>}
          <div className="ai-prose" dangerouslySetInnerHTML={{ __html: formatProse(result.raw) }} />
        </section>
      )}
    </div>
  );
}
