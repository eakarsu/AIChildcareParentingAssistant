/**
 * RecordsEditor — full CRUD for every record type.
 *
 * Data lives in Anna's APS key-value store, so there is no SQL, no schema
 * migration, and no server. Listing sorts client-side by the type's date column,
 * matching the old `ORDER BY <dateCol> DESC LIMIT 25`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { RECORD_TYPES, sortRecords } from './anna-records';
import { readAll, writeOne, removeOne, nextId } from './anna-storage';

const emptyDraft = (type) =>
  Object.fromEntries(
    type.fields.map((f) => [f.name, f.type === 'checkbox' ? false : '']),
  );

function Field({ field, value, onChange }) {
  const common = {
    id: `f-${field.name}`,
    value: value ?? '',
    onChange: (e) =>
      onChange(field.type === 'checkbox' ? e.target.checked : e.target.value),
    style: { width: '100%', padding: 6, marginTop: 2, boxSizing: 'border-box' },
  };

  return (
    <label style={{ fontSize: 12, color: '#555', display: 'block' }}>
      {field.label}
      {field.required && <span style={{ color: '#b91c1c' }}> *</span>}
      {field.type === 'textarea' ? (
        <textarea {...common} rows={2} />
      ) : field.type === 'select' ? (
        <select {...common}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : field.type === 'checkbox' ? (
        <input
          id={common.id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={common.onChange}
          style={{ marginLeft: 8 }}
        />
      ) : (
        <input {...common} type={field.type === 'number' ? 'number' : field.type} />
      )}
    </label>
  );
}

export default function RecordsEditor({ onChanged }) {
  const [activeKey, setActiveKey] = useState(RECORD_TYPES[0].key);
  const type = RECORD_TYPES.find((t) => t.key === activeKey);

  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState(() => emptyDraft(type));
  const [editingKey, setEditingKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const list = await readAll(type.prefix);
      setRows(sortRecords(list, type.dateCol));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [type]);

  useEffect(() => {
    setDraft(emptyDraft(type));
    setEditingKey(null);
    setNotice('');
    load();
  }, [type, load]);

  const save = async () => {
    setError('');
    setNotice('');
    const missing = type.fields.filter((f) => f.required && !String(draft[f.name] ?? '').trim());
    if (missing.length) {
      setError(`Required: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    setBusy(true);
    try {
      const { __key, __etag, ...clean } = draft;
      const record = { ...clean, child: clean.child ?? 'main' };
      const key = editingKey ?? `${type.prefix}${await nextId(type.prefix)}`;
      await writeOne(key, record);
      setNotice(editingKey ? 'Updated.' : 'Added.');
      setDraft(emptyDraft(type));
      setEditingKey(null);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const edit = (row) => {
    const { __key, __etag, ...rest } = row;
    const next = emptyDraft(type);
    for (const f of type.fields) next[f.name] = rest[f.name] ?? (f.type === 'checkbox' ? false : '');
    setDraft(next);
    setEditingKey(__key);
    setNotice('');
    setError('');
  };

  const remove = async (row) => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      await removeOne(row.__key);
      if (editingKey === row.__key) {
        setEditingKey(null);
        setDraft(emptyDraft(type));
      }
      setNotice('Deleted.');
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setDraft(emptyDraft(type));
    setEditingKey(null);
    setError('');
    setNotice('');
  };

  return (
    <section>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {RECORD_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveKey(t.key)}
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              border: '1px solid #d1d5db',
              background: t.key === activeKey ? '#4f46e5' : '#fff',
              color: t.key === activeKey ? '#fff' : '#333',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>
          {editingKey ? `Edit ${type.label.replace(/s$/, '')}` : `Add ${type.label.replace(/s$/, '')}`}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {type.fields.map((f) => (
            <Field
              key={f.name}
              field={f}
              value={draft[f.name]}
              onChange={(v) => setDraft((d) => ({ ...d, [f.name]: v }))}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={save} disabled={busy} style={{ padding: '6px 12px', fontWeight: 600 }}>
            {editingKey ? '💾 Save changes' : '➕ Add record'}
          </button>
          <button onClick={cancel} disabled={busy} style={{ padding: '6px 12px' }}>
            Cancel
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 8, borderRadius: 6, marginBottom: 8 }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ background: '#dcfce7', color: '#166534', padding: 8, borderRadius: 6, marginBottom: 8 }}>
          {notice}
        </div>
      )}

      <p style={{ fontSize: 12, color: '#666', margin: '4px 0' }}>
        {busy ? 'Loading…' : `${rows.length} ${rows.length === 1 ? 'record' : 'records'} in ${type.label.toLowerCase()}`}
      </p>

      {rows.length === 0 && !busy ? (
        <p style={{ fontSize: 13, color: '#666' }}>
          Nothing recorded yet. Add the first one above — the handoff brief reads from these.
        </p>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {rows.map((row) => (
                <tr key={row.__key} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 10px' }}>
                    {type.summary(row) || '—'}
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.__key}</div>
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => edit(row)} style={{ marginRight: 4, cursor: 'pointer' }}>✏️ Edit</button>
                    <button onClick={() => remove(row)} style={{ cursor: 'pointer' }}>🗑️ Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
