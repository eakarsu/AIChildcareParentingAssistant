import React, { useState } from 'react';
import { apiCall } from '../api';

const FOCUS_OPTIONS = ['motor', 'cognitive', 'language', 'social', 'mixed'];
const LOCATION_OPTIONS = ['home', 'outdoor', 'park'];
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function ActivityPlanner() {
  const [step, setStep] = useState(1); // 1 intake, 2 suggest, 3 plan
  const [focus, setFocus] = useState('cognitive');
  const [location, setLocation] = useState('home');
  const [duration, setDuration] = useState(60);
  const [suggestions, setSuggestions] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const callStep = async (stepName) => {
    setLoading(true); setError(null);
    try {
      const res = await apiCall('/custom-views/activity-planner', {
        method: 'POST',
        body: JSON.stringify({ focus, location, duration_minutes: duration, step: stepName }),
      });
      if (stepName === 'suggest') { setSuggestions(res.suggestions); setStep(2); }
      else if (stepName === 'plan') { setPlan(res.plan); setStep(3); }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="cv-card" data-testid="cv-activity-planner">
      <div className="cv-card-header">
        <h3>Activity Planner Wizard</h3>
        <span className="cv-badge">Step {step} of 3</span>
      </div>

      <div className="cv-stepper">
        <span className={step >= 1 ? 'on' : ''}>1. Intake</span>
        <span className={step >= 2 ? 'on' : ''}>2. Suggestions</span>
        <span className={step >= 3 ? 'on' : ''}>3. Plan</span>
      </div>

      {step === 1 && (
        <div className="cv-form">
          <label>Focus
            <select value={focus} onChange={(e) => setFocus(e.target.value)}>
              {FOCUS_OPTIONS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          <label>Location
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              {LOCATION_OPTIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </label>
          <label>Duration (minutes)
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATION_OPTIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" disabled={loading} onClick={() => callStep('suggest')}>
            {loading ? 'Loading...' : 'Get Suggestions →'}
          </button>
        </div>
      )}

      {step === 2 && suggestions && (
        <div>
          <h4>Suggested Activities</h4>
          <ul className="cv-suggestions">
            {suggestions.map((s, i) => (
              <li key={i}>
                <b>{s.title}</b>
                <span className="cv-pill">{s.focus}</span>
                <span className="cv-pill">{s.location}</span>
                <span className="cv-pill">{s.est_minutes} min</span>
              </li>
            ))}
          </ul>
          <div className="cv-btn-row">
            <button className="btn" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" disabled={loading} onClick={() => callStep('plan')}>
              {loading ? 'Building...' : 'Build Plan →'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && plan && (
        <div>
          <h4>Your Plan ({plan.total_minutes} min · {plan.focus} · {plan.location})</h4>
          <ol className="cv-plan-slots">
            {plan.slots.map((s) => (
              <li key={s.order}>
                <div className="cv-slot-head"><b>#{s.order} {s.title}</b><span>{s.minutes} min</span></div>
                <p>{s.notes}</p>
              </li>
            ))}
          </ol>
          <button className="btn" onClick={() => { setStep(1); setSuggestions(null); setPlan(null); }}>↺ Start Over</button>
        </div>
      )}

      {error && <p style={{color:'#ef4444', marginTop: 10}}>Error: {error}</p>}
    </div>
  );
}
