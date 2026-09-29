import React from 'react';

/**
 * Compact renderer for generic extension results.
 *
 * The extension routes return small, loosely-specified JSON objects. Rather
 * than dumping them as JSON, this renders them as labelled fields, bullet lists
 * and simple tables. Nothing is invented: whatever the endpoint returned is
 * shown, and nested structures are rendered recursively.
 */

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

/** Pretty prose block for longer free text. */
function Prose({ text }) {
  return (
    <div className="ai-prose">
      {String(text)
        .split(/\n{2,}/)
        .filter((block) => block.trim())
        .map((block, i) => (
          <p key={i}>{block.trim()}</p>
        ))}
    </div>
  );
}

function Value({ value, name = '', depth = 0 }) {
  if (value === null || value === undefined || value === '') {
    return <span className="ai-value ai-value-empty">—</span>;
  }

  if (isScalar(value)) {
    // Long strings read as prose, short ones as values.
    if (typeof value === 'string' && (value.length > 120 || /\n/.test(value))) {
      return <Prose text={value} />;
    }
    return <span className="ai-value">{displayScalar(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (!value.length) return <span className="ai-value ai-value-empty">None returned.</span>;

    if (value.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
      const columns = [...new Set(value.flatMap((v) => Object.keys(v)))];
      const flat = columns.every((c) => value.every((v) => v[c] === undefined || isScalar(v[c])));
      if (flat && columns.length && columns.length <= 6) {
        return (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>{columns.map((c) => <th key={c}>{humanize(c)}</th>)}</tr>
              </thead>
              <tbody>
                {value.map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => <td key={c}>{displayScalar(row[c])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }

    // Array of strings → chips when short enough, otherwise a bullet list.
    if (value.every((v) => isScalar(v))) {
      if (value.every((v) => typeof v === 'string' && v.length <= 42)) {
        return (
          <div className="ai-chips">
            {value.map((v, i) => <span className="ai-chip" key={i}>{displayScalar(v)}</span>)}
          </div>
        );
      }
      return (
        <ul className="ai-list">
          {value.map((v, i) => <li key={i}>{displayScalar(v)}</li>)}
        </ul>
      );
    }

    return (
      <ul className="ai-list">
        {value.map((v, i) => (
          <li key={i}>
            {isScalar(v) ? displayScalar(v) : <Value value={v} depth={depth + 1} />}
          </li>
        ))}
      </ul>
    );
  }

  // Nested object.
  const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== '');
  if (!entries.length) return <span className="ai-value ai-value-empty">No detail returned.</span>;
  return (
    <div className="ai-block">
      {entries.map(([key, item]) => (
        <section className="ai-field" key={key}>
          <h4 className="ai-field-label">{humanize(key)}</h4>
          <Value value={item} name={key} depth={depth + 1} />
        </section>
      ))}
    </div>
  );
}

export default function KeyValueResult({ result }) {
  if (!result) return null;

  if (isScalar(result)) {
    return <div className="ai-result"><Value value={result} /></div>;
  }

  const entries = Object.entries(result).filter(([, v]) => v !== undefined);
  if (!entries.length) return null;

  return (
    <div className="ai-result">
      <div className="ai-result-header">
        <span className="ai-result-icon">🧾</span>
        <div>
          <h3 className="ai-result-title">Result</h3>
          <p className="ai-result-meta">Returned by the service — shown as structured fields.</p>
        </div>
      </div>
      <div className="ai-block">
        {entries.map(([key, value]) => (
          <section className="ai-field" key={key}>
            <h4 className="ai-field-label">{humanize(key)}</h4>
            <Value value={value} name={key} />
          </section>
        ))}
      </div>
    </div>
  );
}
