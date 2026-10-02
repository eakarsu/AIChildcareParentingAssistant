/**
 * Anna App entry point — Sitter Handoff Summary.
 *
 * Reuses the real UI components and prompts from the standalone app
 * (`AIResultView`, and the handoff prompt from backend/routes/aiChildcare.js),
 * replacing the two data layers with Anna's host APIs:
 *
 *   fetch('/api/ai/handoff-summary')  ->  anna.llm.complete()
 *   PostgreSQL via pg                 ->  anna.storage.* (APS key-value)
 *   JWT auth, login, sidebar          ->  removed (Anna supplies accounts + chrome)
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AnnaAppRuntime } from '@anna-ai/app-runtime';
import AIResultView from './src/components/AIResultView';
import RecordsEditor from './anna-records-editor';
import { setRuntime, gatherForHandoff, readOne, writeOne } from './anna-storage';

const PROFILE_KEY = 'profile/main';

const ADVISORY =
  'Informational only: this supports caregiving decisions and is not medical ' +
  'advice, diagnosis, or treatment. Always consult a qualified pediatrician.';

const SYSTEM_PROMPT =
  'You are an expert pediatric advisor and child development specialist. Provide helpful, ' +
  'evidence-based advice. Be warm and professional. Always recommend consulting a pediatrician ' +
  'for medical concerns.';

// ─── deterministic helpers (ported unchanged from the backend) ───────────────

function ageInMonths(dob) {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86400000 / 30.4375);
}

function unwrapModelText(text) {
  if (typeof text !== 'string') return text;
  let value = text.trim();
  const fence = value.match(/^```(?:json|JSON)?\s*\n([\s\S]*?)\n?```$/);
  if (fence) value = fence[1].trim();
  else if (value.startsWith('```')) {
    value = value.replace(/^```(?:json|JSON)?[ \t]*\r?\n?/, '').replace(/```\s*$/, '').trim();
  }
  if (/^[[{]/.test(value)) {
    try {
      return JSON.parse(value);
    } catch {
      return salvageJson(value) ?? value;
    }
  }
  return value;
}

function salvageJson(text) {
  let inString = false;
  let escaped = false;
  const stack = [];
  let lastSafe = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') {
      stack.pop();
      if (stack.length === 0) lastSafe = i + 1;
    }
  }
  if (lastSafe > 0) {
    try {
      return JSON.parse(text.slice(0, lastSafe));
    } catch {
      /* fall through */
    }
  }
  let repaired = text;
  if (inString) repaired += '"';
  repaired = repaired.replace(/[,\s]+$/, '');
  for (let i = stack.length - 1; i >= 0; i -= 1) repaired += stack[i] === '{' ? '}' : ']';
  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

// ─── app ────────────────────────────────────────────────────────────────────

function App() {
  const [tab, setTab] = React.useState('handoff');
  const [profile, setProfile] = React.useState(null);
  const [name, setName] = React.useState('');
  const [dob, setDob] = React.useState('');
  const [allergies, setAllergies] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [timeframe, setTimeframe] = React.useState(24);
  const [result, setResult] = React.useState(null);
  const [counts, setCounts] = React.useState(null);
  const [status, setStatus] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [profileNotice, setProfileNotice] = React.useState('');
  const [recordVersion, setRecordVersion] = React.useState(0);

  const loadProfile = React.useCallback(async () => {
    const stored = await readOne(PROFILE_KEY);
    if (stored) {
      setProfile(stored);
      setName(stored.name ?? '');
      setDob(stored.date_of_birth ?? '');
      setAllergies(stored.allergies ?? '');
      setNotes(stored.notes ?? '');
    }
  }, []);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfile = async () => {
    setProfileNotice('');
    setError('');
    const value = {
      id: profile?.id ?? 'main',
      name: name.trim(),
      date_of_birth: dob || null,
      allergies: allergies.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      await writeOne(PROFILE_KEY, value);
      setProfile(value);
      setProfileNotice('Profile saved.');
    } catch (e) {
      setError(e.message);
    }
  };

  const run = async () => {
    setBusy(true);
    setResult(null);
    setError('');
    setStatus('Reading records…');
    try {
      const current = await readOne(PROFILE_KEY);
      const data = await gatherForHandoff();
      const recordCounts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
      setCounts(recordCounts);

      const deterministic = {
        child: {
          name: current?.name ?? name ?? null,
          date_of_birth: current?.date_of_birth ?? dob ?? null,
          age_months: ageInMonths(current?.date_of_birth ?? dob),
          allergies: current?.allergies ?? allergies ?? null,
          notes: current?.notes ?? notes ?? null,
        },
        timeframe_hours: timeframe,
        counts: recordCounts,
        generated_at: new Date().toISOString(),
      };

      setStatus('Asking the model…');
      const prompt =
        'Prepare a concise babysitter/caregiver handoff for the child below. Use ONLY the supplied facts and ' +
        'records; do not invent numbers, medications, allergies, or events. Say "not recorded" when a detail is absent. ' +
        'Return strict JSON with keys: summary (string, "what a sitter needs to know today"), ' +
        'sitter_checklist (string[]), watch_outs (string[]), emergency_notes (string).\n\n' +
        `DETERMINISTIC FACTS:\n${JSON.stringify(deterministic).slice(0, 2500)}\n\n` +
        `RECORDS:\n${JSON.stringify(data).slice(0, 8000)}`;

      const reply = await anna.llm.complete({
        messages: [
          { role: 'system', content: { type: 'text', text: SYSTEM_PROMPT } },
          { role: 'user', content: { type: 'text', text: prompt } },
        ],
      });

      const text =
        reply?.message?.content?.text ??
        reply?.text ??
        reply?.content ??
        (typeof reply === 'string' ? reply : JSON.stringify(reply));

      const parsed = unwrapModelText(text);
      setResult({
        analysis: typeof parsed === 'object' && parsed ? parsed : { summary: String(parsed) },
        facts: deterministic,
        advisory: true,
        advisory_text: ADVISORY,
        model: reply?.model,
      });
      setStatus('');
    } catch (e) {
      setError(e.message || String(e));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const tabBtn = (key, label, icon) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      style={{
        padding: '6px 12px',
        border: '1px solid #d1d5db',
        borderBottom: tab === key ? '2px solid #4f46e5' : '1px solid #d1d5db',
        background: tab === key ? '#eef2ff' : '#fff',
        fontWeight: tab === key ? 700 : 400,
        cursor: 'pointer',
      }}
    >
      {icon} {label}
    </button>
  );

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 940 }}>
      <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>🍼 Sitter Handoff Summary</h1>
      <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
        A brief for whoever is caring for your child today, grounded in the records you store here.
      </p>

      <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
        {tabBtn('handoff', 'Handoff', '📋')}
        {tabBtn('records', 'Records', '🗂️')}
        {tabBtn('profile', 'Child profile', '👶')}
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {tab === 'handoff' && (
        <>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={run} disabled={busy} style={{ padding: '8px 16px', fontWeight: 600 }}>
                {busy ? 'Working…' : '✨ Generate handoff'}
              </button>
              <label style={{ fontSize: 12, color: '#555' }}>
                Timeframe (hours)
                <input
                  type="number"
                  min={1}
                  value={timeframe}
                  onChange={(e) => setTimeframe(Number(e.target.value) || 24)}
                  style={{ width: 70, marginLeft: 6, padding: 4 }}
                />
              </label>
            </div>
            {status && <p style={{ fontSize: 13, color: '#555', marginBottom: 0 }}>{status}</p>}
          </div>

          {result ? (
            <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <AIResultView result={result} />
            </section>
          ) : (
            <p style={{ fontSize: 13, color: '#666' }}>
              {counts
                ? 'No brief generated yet.'
                : 'Add a few records under the Records tab, then generate the brief.'}
            </p>
          )}
        </>
      )}

      {tab === 'records' && (
        <RecordsEditor key={recordVersion} onChanged={() => setRecordVersion((v) => v + 1)} />
      )}

      {tab === 'profile' && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
            <label style={{ fontSize: 12, color: '#555' }}>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: 6, marginTop: 2 }} />
            </label>
            <label style={{ fontSize: 12, color: '#555' }}>
              Date of birth
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={{ width: '100%', padding: 6, marginTop: 2 }} />
            </label>
            <label style={{ fontSize: 12, color: '#555' }}>
              Allergies
              <input value={allergies} onChange={(e) => setAllergies(e.target.value)} style={{ width: '100%', padding: 6, marginTop: 2 }} />
            </label>
            <label style={{ fontSize: 12, color: '#555' }}>
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%', padding: 6, marginTop: 2 }} />
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={saveProfile} style={{ padding: '6px 12px', fontWeight: 600 }}>💾 Save profile</button>
              {profileNotice && <span style={{ fontSize: 12, color: '#166534' }}>{profileNotice}</span>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── host connection + standalone fallback ──────────────────────────────────

async function main() {
  const rootEl = document.getElementById('root') ?? document.body;
  let anna = null;

  try {
    anna = await AnnaAppRuntime.connect();
    try {
      await anna.window.set_title({ title: 'Sitter Handoff Summary' });
    } catch {
      /* title is cosmetic */
    }
  } catch {
    // Standalone browser preview (no host): in-memory stub so the UI renders and
    // behaves, without pretending an LLM answered.
    const mem = new Map();
    anna = {
      storage: {
        list: async ({ prefix, limit = 100 }) => ({
          items: [...mem.keys()]
            .filter((k) => k.startsWith(prefix))
            .slice(0, limit)
            .map((k) => ({ key: k })),
        }),
        get: async ({ key }) => (mem.has(key) ? { exists: true, value: mem.get(key) } : { exists: false, value: null }),
        set: async ({ key, value }) => {
          mem.set(key, value);
          return { generation: mem.size };
        },
        delete: async ({ key }) => {
          mem.delete(key);
          return { ok: true };
        },
      },
      llm: {
        complete: async () => ({
          message: {
            content: {
              type: 'text',
              text: JSON.stringify({
                summary: 'Standalone preview: the host LLM is not connected here.',
                sitter_checklist: ['Open this app inside the Anna dashboard to use the model.'],
                watch_outs: [],
                emergency_notes: 'Not recorded',
              }),
            },
          },
        }),
      },
    };
  }

  setRuntime(anna);
  window.__anna = anna; // handy for manual probing in the harness
  ReactDOM.createRoot(rootEl).render(<App />);
}

main();
