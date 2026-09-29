import React, { useMemo, useState } from 'react';
import { aiFeatures } from '../api';
import AIResultView from '../components/AIResultView';
import KeyValueResult from '../components/KeyValueResult';

/**
 * AI Parenting Tools.
 *
 * Every tool declares an `example` for each field — including optional ones —
 * so "Fill example" can populate the whole form in one click and "Run analysis"
 * works immediately. Examples are clearly fictional.
 */
const TOOLS = [
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
      { name: 'child_id', label: 'Child ID', type: 'number', example: '1' },
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
      { name: 'child_id', label: 'Child ID (optional)', type: 'number', optional: true, example: '1' },
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
      { name: 'child_id', label: 'Child ID', type: 'number', example: '1' },
      { name: 'since', label: 'Since date (optional, YYYY-MM-DD)', type: 'text', optional: true, example: '2026-01-01' },
    ],
  },
];

/** Build the input state that fills every field, optional ones included. */
export function exampleInputs(tool) {
  const next = {};
  for (const field of tool.fields) {
    next[field.name] = field.example ?? '';
  }
  return next;
}

export default function AIToolsPage() {
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
    setInputs(exampleInputs(next)); // switching tools fills every field
    setResult(null);
    setError('');
  };

  const fillExample = () => {
    setInputs(exampleInputs(tool));
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
        if (!v && !f.optional) continue;
        if (f.type === 'json' && v) {
          try { payload[f.name] = JSON.parse(v); }
          catch { throw new Error(`Invalid JSON in ${f.label}`); }
        } else if (f.type === 'list' && v) {
          payload[f.name] = String(v).split(',').map(s => s.trim()).filter(Boolean);
        } else if (f.type === 'number' && v !== undefined && v !== '') {
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={fillExample}>
              ✨ Fill example
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFields}>
              Clear fields
            </button>
          </div>
        </div>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
          {filledCount} of {tool.fields.length} fields filled. Examples are fictional sample data, not your records.
        </p>
        <form onSubmit={handleSubmit}>
          {tool.fields.map(f => (
            <div className="form-group" key={f.name}>
              <label className="form-label">
                {f.label}
                {f.optional && <span className="form-optional"> (optional)</span>}
              </label>
              {f.type === 'json' ? (
                <textarea
                  className="form-input form-textarea"
                  rows={6}
                  placeholder={f.type === 'json' ? '[]' : ''}
                  value={inputs[f.name] || ''}
                  onChange={(e) => setInputs({ ...inputs, [f.name]: e.target.value })}
                />
              ) : (
                <input
                  className="form-input"
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={inputs[f.name] || ''}
                  onChange={(e) => setInputs({ ...inputs, [f.name]: e.target.value })}
                />
              )}
            </div>
          ))}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
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
