import React, { useState } from 'react';
import { aiFeatures } from '../api';

const TOOLS = [
  {
    key: 'milestoneComparison',
    label: 'Milestone Comparison',
    description: 'Compare your child\'s milestones to CDC/WHO standards.',
    fields: [
      { name: 'child_age_months', label: 'Child Age (months)', type: 'number' },
      { name: 'milestones_achieved', label: 'Milestones Achieved (comma-separated)', type: 'list' },
    ],
  },
  {
    key: 'sleepOptimizer',
    label: 'Sleep Pattern Optimizer',
    description: 'Analyze sleep logs and get optimal bedtime suggestions.',
    fields: [
      { name: 'sleep_logs', label: 'Sleep logs JSON array', type: 'json' },
    ],
  },
  {
    key: 'nutritionAdvisor',
    label: 'Nutrition Advisor',
    description: 'Check meal portions, allergens, balance.',
    fields: [
      { name: 'child_age', label: 'Child Age (e.g. 18 months)', type: 'text' },
      { name: 'meals', label: 'Meals JSON array', type: 'json' },
    ],
  },
  {
    key: 'behaviorAnalyzer',
    label: 'Behavior Pattern Analyzer',
    description: 'Detect triggers and suggest responses.',
    fields: [
      { name: 'incidents', label: 'Incidents JSON array', type: 'json' },
      { name: 'triggers', label: 'Triggers JSON array (optional)', type: 'json', optional: true },
    ],
  },
  {
    key: 'illnessTracker',
    label: 'Illness & Recovery Tracker',
    description: 'Symptom triage with home care suggestions (NOT diagnosis).',
    fields: [
      { name: 'child_age', label: 'Child Age', type: 'text' },
      { name: 'symptoms', label: 'Symptoms (comma-separated)', type: 'list' },
    ],
  },
  {
    key: 'stressMonitor',
    label: 'Parental Stress Monitor',
    description: 'Mood logs analysis with self-care suggestions.',
    fields: [
      { name: 'parent_mood_logs', label: 'Mood Logs JSON array', type: 'json' },
    ],
  },
  {
    key: 'screenTimeManager',
    label: 'Screen Time Manager',
    description: 'Balanced screen-time recommendations.',
    fields: [
      { name: 'child_age', label: 'Child Age', type: 'text' },
      { name: 'daily_usage', label: 'Daily Usage JSON array', type: 'json' },
    ],
  },
  {
    key: 'siblingHarmony',
    label: 'Sibling Harmony Coach',
    description: 'Strategies for multiple-child households.',
    fields: [
      { name: 'children', label: 'Children JSON array', type: 'json' },
      { name: 'recent_conflicts', label: 'Recent Conflicts JSON (optional)', type: 'json', optional: true },
    ],
  },
  {
    key: 'healthTrend',
    label: 'Health Trend Brief',
    description: 'Parental brief synthesizing growth + sleep + feeding + vaccinations (informational only).',
    fields: [
      { name: 'child_age', label: 'Child Age (e.g. 18 months)', type: 'text' },
      { name: 'growth', label: 'Growth records JSON (optional)', type: 'json', optional: true },
      { name: 'sleep', label: 'Sleep records JSON (optional)', type: 'json', optional: true },
      { name: 'feeding', label: 'Feeding records JSON (optional)', type: 'json', optional: true },
      { name: 'vaccinations', label: 'Vaccinations JSON (optional)', type: 'json', optional: true },
    ],
  },
];

export default function AIToolsPage() {
  const [activeTool, setActiveTool] = useState(TOOLS[0].key);
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const tool = TOOLS.find(t => t.key === activeTool);

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
        } else if (f.type === 'number' && v !== undefined) {
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {TOOLS.map(t => (
          <button
            key={t.key}
            className={`btn ${activeTool === t.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTool(t.key); setInputs({}); setResult(null); setError(''); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>{tool.label}</h2>
        <p>{tool.description}</p>
        <form onSubmit={handleSubmit}>
          {tool.fields.map(f => (
            <div className="form-group" key={f.name}>
              <label className="form-label">{f.label}</label>
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
          <h3>Result</h3>
          {result.disclaimer && <div className="alert alert-info">{result.disclaimer}</div>}
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, overflow: 'auto', maxHeight: 600 }}>
            {JSON.stringify(result.analysis || result, null, 2)}
          </pre>
          {result.crisis_resources && (
            <div className="alert alert-warning">
              <strong>Crisis Resources:</strong>
              <ul>
                <li>National Crisis Line: {result.crisis_resources.national_crisis_line}</li>
                <li>Postpartum Support International: {result.crisis_resources.postpartum_support_international}</li>
              </ul>
              <p>{result.crisis_resources.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
