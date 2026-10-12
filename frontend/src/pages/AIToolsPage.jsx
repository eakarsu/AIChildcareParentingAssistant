import React, { useEffect, useMemo, useState } from 'react';
import { aiFeatures, fetchItems } from '../api';
import AIResultView from '../components/AIResultView';

/**
 * AI Parenting Tools.
 *
 * Every tool declares an `example` for each field — including optional ones —
 * so "Fill example" can populate the whole form in one click and "Run analysis"
 * works immediately. Examples are clearly fictional.
 */
export const TOOLS = [
  {
    key: 'milestoneComparison',
    label: 'Milestone Comparison',
    description: 'Compare your child\'s milestones to CDC/WHO standards.',
    fields: [
      { name: 'child_age_months', label: 'Child Age (months)', type: 'number', example: '24' },
      { name: 'milestones_achieved', label: 'Milestones Achieved (comma-separated)', type: 'list', example: 'walks, runs, says 20 words, stacks 4 blocks, follows two-step instructions' },
    ],
  },
  {
    key: 'sleepOptimizer',
    label: 'Sleep Pattern Optimizer',
    description: 'Analyze sleep logs and get optimal bedtime suggestions.',
    fields: [
      { name: 'sleep_logs', label: 'Sleep logs JSON array', type: 'json', example: JSON.stringify([
        { date: '2026-09-20', sleep_start: '20:00', sleep_end: '06:30', quality: 'Good' },
        { date: '2026-09-21', sleep_start: '20:30', sleep_end: '05:45', quality: 'Fair' },
        { date: '2026-09-22', sleep_start: '19:45', sleep_end: '06:15', quality: 'Good' },
      ], null, 2) },
    ],
  },
  {
    key: 'nutritionAdvisor',
    label: 'Nutrition Advisor',
    description: 'Check meal portions, allergens, balance.',
    fields: [
      { name: 'child_age', label: 'Child Age (e.g. 18 months)', type: 'text', example: '18 months' },
      { name: 'meals', label: 'Meals JSON array', type: 'json', example: JSON.stringify([
        { meal: 'Breakfast', foods: ['oatmeal', 'banana', 'whole milk'], portion: 'small bowl' },
        { meal: 'Lunch', foods: ['chicken', 'rice', 'peas'], portion: 'half plate' },
        { meal: 'Snack', foods: ['yogurt', 'blueberries'], portion: 'small cup' },
      ], null, 2) },
    ],
  },
  {
    key: 'behaviorAnalyzer',
    label: 'Behavior Pattern Analyzer',
    description: 'Detect triggers and suggest responses.',
    fields: [
      { name: 'incidents', label: 'Incidents JSON array', type: 'json', example: JSON.stringify([
        { date: '2026-09-18', behavior: 'tantrum at bedtime', context: 'after screen time', mood: 'Frustrated' },
        { date: '2026-09-19', behavior: 'refused to share toys', context: 'playdate', mood: 'Angry' },
      ], null, 2) },
      { name: 'triggers', label: 'Triggers JSON array (optional)', type: 'json', optional: true, example: JSON.stringify(['screen time', 'transitions', 'hunger'], null, 2) },
    ],
  },
  {
    key: 'illnessTracker',
    label: 'Illness & Recovery Tracker',
    description: 'Symptom triage with home care suggestions (NOT diagnosis).',
    fields: [
      { name: 'child_age', label: 'Child Age', type: 'text', example: '3 years' },
      { name: 'symptoms', label: 'Symptoms (comma-separated)', type: 'list', example: 'runny nose, mild cough, low fever, reduced appetite' },
    ],
  },
  {
    key: 'stressMonitor',
    label: 'Parental Stress Monitor',
    description: 'Mood logs analysis with self-care suggestions.',
    fields: [
      { name: 'parent_mood_logs', label: 'Mood Logs JSON array', type: 'json', example: JSON.stringify([
        { date: '2026-09-20', mood: 'Tired', energy: 3, note: 'woke twice overnight' },
        { date: '2026-09-21', mood: 'Anxious', energy: 4, note: 'work deadline' },
        { date: '2026-09-22', mood: 'Calm', energy: 6, note: 'walk after lunch' },
      ], null, 2) },
    ],
  },
  {
    key: 'screenTimeManager',
    label: 'Screen Time Manager',
    description: 'Balanced screen-time recommendations.',
    fields: [
      { name: 'child_age', label: 'Child Age', type: 'text', example: '5 years' },
      { name: 'daily_usage', label: 'Daily Usage JSON array', type: 'json', example: JSON.stringify([
        { date: '2026-09-20', minutes: 90, activity: 'cartoons' },
        { date: '2026-09-21', minutes: 45, activity: 'learning app' },
        { date: '2026-09-22', minutes: 120, activity: 'tablet games' },
      ], null, 2) },
    ],
  },
  {
    key: 'siblingHarmony',
    label: 'Sibling Harmony Coach',
    description: 'Strategies for multiple-child households.',
    fields: [
      { name: 'children', label: 'Children JSON array', type: 'json', example: JSON.stringify([
        { name: 'Ava', age: 5 },
        { name: 'Leo', age: 2 },
      ], null, 2) },
      { name: 'recent_conflicts', label: 'Recent Conflicts JSON (optional)', type: 'json', optional: true, example: JSON.stringify([
        { date: '2026-09-21', conflict: 'competing for the same toy', resolution: 'adult redirected' },
      ], null, 2) },
    ],
  },
  {
    key: 'healthTrend',
    label: 'Health Trend Brief',
    description: 'Parental brief synthesizing growth + sleep + feeding + vaccinations (informational only).',
    fields: [
      { name: 'child_age', label: 'Child Age (e.g. 18 months)', type: 'text', example: '18 months' },
      { name: 'growth', label: 'Growth records JSON (optional)', type: 'json', optional: true, example: JSON.stringify([
        { date: '2026-03-01', height_cm: 78, weight_kg: 10.2 },
        { date: '2026-09-01', height_cm: 83, weight_kg: 11.4 },
      ], null, 2) },
      { name: 'sleep', label: 'Sleep records JSON (optional)', type: 'json', optional: true, example: JSON.stringify([
        { date: '2026-09-20', sleep_start: '20:00', sleep_end: '06:00', quality: 'Good' },
      ], null, 2) },
      { name: 'feeding', label: 'Feeding records JSON (optional)', type: 'json', optional: true, example: JSON.stringify([
        { meal: 'Breakfast', foods: ['oatmeal', 'banana'] },
        { meal: 'Lunch', foods: ['chicken', 'rice'] },
      ], null, 2) },
      { name: 'vaccinations', label: 'Vaccinations JSON (optional)', type: 'json', optional: true, example: JSON.stringify([
        { vaccine_name: 'MMR', dose_number: 2, administered_date: '2026-06-15' },
      ], null, 2) },
    ],
  },
  {
    key: 'handoffSummary',
    label: 'Sitter Handoff Summary',
    description: 'Deterministic child records plus an AI "what a sitter needs to know today" brief.',
    fields: [
      { name: 'child_id', label: 'Child record', type: 'child', requiresExistingRecord: true },
      { name: 'timeframe_hours', label: 'Timeframe (hours, optional)', type: 'number', optional: true, example: '24' },
    ],
  },
  {
    key: 'milestoneGapAdvisor',
    label: 'Milestone Gap Advisor',
    description: 'Age-appropriate expectations, gaps, next steps and pediatrician questions.',
    fields: [
      { name: 'child_age_months', label: 'Child Age (months)', type: 'number', example: '24' },
      { name: 'milestones_achieved', label: 'Milestones Achieved (comma-separated)', type: 'list', example: 'walks, runs, says 20 words, stacks 4 blocks' },
    ],
  },
  {
    key: 'sleepFeedingAnalyzer',
    label: 'Sleep & Feeding Analyzer',
    description: 'Deterministic sleep/feeding aggregates plus an AI explanation (facts are computed in code).',
    fields: [
      { name: 'sleep_logs', label: 'Sleep logs JSON array (optional)', type: 'json', optional: true, example: JSON.stringify([
        { date: '2026-09-20', sleep_start: '20:00', sleep_end: '06:00', quality: 'Good' },
        { date: '2026-09-21', sleep_start: '20:30', sleep_end: '05:30', quality: 'Fair' },
      ], null, 2) },
      { name: 'feeding_logs', label: 'Feeding logs JSON array (optional)', type: 'json', optional: true, example: JSON.stringify([
        { meal: 'Breakfast', foods: ['oatmeal'], calories: 200 },
        { meal: 'Lunch', foods: ['chicken', 'rice'], calories: 300 },
      ], null, 2) },
    ],
  },
  {
    key: 'behaviorCoach',
    label: 'Behavior Coach (Safe)',
    description: 'Safe, de-escalation-focused guidance. Punitive or unsafe advice is refused.',
    fields: [
      { name: 'incidents', label: 'Incidents JSON array', type: 'json', example: JSON.stringify([
        { date: '2026-09-18', behavior: 'tantrum at bedtime', context: 'after screen time', mood: 'Frustrated' },
      ], null, 2) },
      { name: 'triggers', label: 'Triggers JSON array (optional)', type: 'json', optional: true, example: JSON.stringify(['screen time', 'transitions'], null, 2) },
    ],
  },
  {
    key: 'growthChartAnalyzer',
    label: 'Growth Chart Analyzer',
    description: 'Deterministic growth-series summary; no percentiles unless a reference curve is supplied.',
    fields: [
      { name: 'child_id', label: 'Child record (optional)', type: 'child', optional: true, requiresExistingRecord: true },
      { name: 'measurements', label: 'Measurements JSON array', type: 'json', example: JSON.stringify([
        { date: '2026-03-01', height_cm: 78, weight_kg: 10.2, head_circumference_cm: 46 },
        { date: '2026-06-01', height_cm: 80.5, weight_kg: 10.9, head_circumference_cm: 46.6 },
        { date: '2026-09-01', height_cm: 83, weight_kg: 11.4, head_circumference_cm: 47.1 },
      ], null, 2) },
    ],
  },
  {
    key: 'pediatricianHandoffPdf',
    label: 'Pediatrician Handoff PDF',
    description: 'Deterministic record summary as a downloadable PDF (or JSON if PDF is unavailable).',
    fields: [
      { name: 'child_id', label: 'Child record', type: 'child', requiresExistingRecord: true },
      { name: 'since', label: 'Since date (optional, YYYY-MM-DD)', type: 'text', optional: true, example: '2026-01-01' },
    ],
  },
];

/** Build the input state that fills every field, optional ones included. */
export function exampleInputs(tool, variant = 0, children = [], current = {}) {
  return Object.fromEntries(tool.fields.map(field => {
    if (field.requiresExistingRecord) {
      const selected = children.find(child => String(child.id) === String(current[field.name])) || children[variant % Math.max(children.length, 1)];
      return [field.name, selected ? String(selected.id) : ''];
    }
    if (field.type === 'json') {
      const value = JSON.parse(field.example);
      return [field.name, JSON.stringify(Array.isArray(value) && variant > 0 ? value.slice(variant === 1 ? 0 : -1, variant === 1 ? 1 : undefined) : value, null, 2)];
    }
    if (field.type === 'number') return [field.name, Number(field.example) + variant * (field.name === 'timeframe_hours' ? 12 : 3)];
    return [field.name, field.example];
  }));
}

export default function AIToolsPage() {
  const [children, setChildren] = useState([]);
  const [childrenError, setChildrenError] = useState('');
  useEffect(() => {
    let alive = true;
    fetchItems('/children', { limit: 200 }).then(response => { if (alive) setChildren(Array.isArray(response) ? response : response.data || []); }).catch(() => { if (alive) setChildrenError('Your child records could not be loaded. Reload them before generating a handoff.'); });
    return () => { alive = false; };
  }, []);
  const [activeTool, setActiveTool] = useState(TOOLS[0].key);
  const [inputs, setInputs] = useState(() => exampleInputs(TOOLS[0]));
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const tool = TOOLS.find(t => t.key === activeTool);
  const filledCount = useMemo(
    () => tool.fields.filter(f => String(inputs[f.name] ?? '').trim() !== '').length,
    [tool, inputs],
  );

  const selectTool = (key) => {
    const next = TOOLS.find(t => t.key === key);
    setActiveTool(key);
    setInputs(exampleInputs(next, 0, children, inputs)); // fill the complete selected tool, retaining real references
    setResult(null);
    setError('');
  };

  const fillExample = (variant) => {
    setInputs(exampleInputs(tool, variant, children, inputs));
    setError('');
  };

  const clearFields = () => {
    setInputs(Object.fromEntries(tool.fields.map(f => [f.name, ''])));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setResult(null); setLoading(true);
    try {
      const payload = {};
      for (const f of tool.fields) {
        const v = inputs[f.name];
        if ((v === '' || v === undefined || v === null) && !f.optional) continue;
        if (f.type === 'json' && v) {
          try { payload[f.name] = JSON.parse(v); }
          catch { throw new Error(`Invalid JSON in ${f.label}`); }
        } else if (f.type === 'list' && v) {
          payload[f.name] = String(v).split(',').map(s => s.trim()).filter(Boolean);
        } else if ((f.type === 'number' || f.type === 'child') && v !== undefined && v !== '') {
          payload[f.name] = Number(v);
        } else if (v) {
          payload[f.name] = v;
        }
      }
      const data = await aiFeatures[activeTool](payload);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title"><span className="page-icon">🧠</span> AI Parenting Tools</h1>
        <p className="page-subtitle">Specialized AI features for childcare insights.</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {TOOLS.map(t => (
          <button
            key={t.key}
            className={`btn ${activeTool === t.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => selectTool(t.key)}
            title={`Load ${t.label} and fill its example values`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 24 }}>
        Each button loads that feature and fills every field with example values — including the optional ones.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="tool-header">
          <div>
            <h2>{tool.label}</h2>
            <p>{tool.description}</p>
          </div>
          <div className="row-actions">
            {['Standard example', 'Focused review', 'Latest observations'].map((label, index) => <button key={label} type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={() => fillExample(index)}>Demo AI · {label}</button>)}
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFields}>
              Clear fields
            </button>
          </div>
        </div>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
          {filledCount} of {tool.fields.length} fields filled. Examples are fictional sample data, not your records.
        </p>
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Each Demo AI button fills required and optional inputs. Fictional examples are for review; generating is a separate action.</p>
        {tool.fields.some(field => field.requiresExistingRecord) && <p role="status">{childrenError || (children.length ? 'Record-linked examples use a real child from your authenticated account and preserve the current selection.' : 'Add or load an actual child record to complete record-linked examples. Presets never invent child IDs.')}</p>}
        <form onSubmit={handleSubmit}>
          {tool.fields.map(f => (
            <div className="form-group" key={f.name}>
              <label className="form-label" htmlFor={`${tool.key}-${f.name}`}>
                {f.label}
                {f.optional && <span className="form-optional"> (optional)</span>}
              </label>
              {f.type === 'child' ? <select data-ai-field={f.name} id={`${tool.key}-${f.name}`} className="form-input" value={inputs[f.name] ?? ''} onChange={event => setInputs({ ...inputs, [f.name]: event.target.value })} required={!f.optional}><option value="">Select an actual child…</option>{children.map(child => <option key={child.id} value={child.id}>{child.name || `Child #${child.id}`}</option>)}</select> : f.type === 'json' ? (
                <textarea
                  data-ai-field={f.name}
                  id={`${tool.key}-${f.name}`}
                  className="form-input form-textarea"
                  rows={6}
                  placeholder={f.type === 'json' ? '[]' : ''}
                  value={inputs[f.name] ?? ''}
                  onChange={(e) => setInputs({ ...inputs, [f.name]: e.target.value })}
                />
              ) : (
                <input
                  data-ai-field={f.name}
                  id={`${tool.key}-${f.name}`}
                  className="form-input"
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={inputs[f.name] ?? ''}
                  onChange={(e) => setInputs({ ...inputs, [f.name]: e.target.value })}
                />
              )}
            </div>
          ))}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading || tool.fields.some(field => field.requiresExistingRecord && !field.optional && !inputs[field.name])}>
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </form>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {result && (
        <div className="card">
          <AIResultView result={result} />
        </div>
      )}
    </div>
  );
}
