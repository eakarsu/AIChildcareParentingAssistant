import React, { useEffect, useState } from 'react';
import { apiCall } from '../api';

export default function ChildGrowthChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiCall('/custom-views/child-growth-chart');
      setData(res);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="cv-card"><p>Loading growth chart...</p></div>;
  if (error) return <div className="cv-card"><p style={{color:'#ef4444'}}>Error: {error}</p></div>;
  if (!data) return null;

  const series = data.series || [];
  const W = 560, H = 240, P = 40;
  const maxH = Math.max(...series.map((s) => s.height_cm), 60);
  const maxW = Math.max(...series.map((s) => s.weight_kg), 5);
  const maxAge = Math.max(...series.map((s) => s.age_months), 1);
  const xs = (age) => P + ((W - 2 * P) * age) / maxAge;
  const yH = (v) => H - P - ((H - 2 * P) * v) / maxH;
  const yW = (v) => H - P - ((H - 2 * P) * v) / maxW;
  const pathH = series.map((s, i) => `${i === 0 ? 'M' : 'L'}${xs(s.age_months)},${yH(s.height_cm)}`).join(' ');
  const pathW = series.map((s, i) => `${i === 0 ? 'M' : 'L'}${xs(s.age_months)},${yW(s.weight_kg)}`).join(' ');

  return (
    <div className="cv-card" data-testid="cv-growth-chart">
      <div className="cv-card-header">
        <h3>Child Growth Chart</h3>
        <span className="cv-badge">{data.child.name} - {data.child.age_months} mo</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: '#f8fafc', borderRadius: 10 }}>
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#cbd5e1" />
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="#cbd5e1" />
        <path d={pathH} stroke="#6366f1" strokeWidth="2" fill="none" />
        <path d={pathW} stroke="#10b981" strokeWidth="2" fill="none" />
        {series.map((s, i) => (
          <g key={i}>
            <circle cx={xs(s.age_months)} cy={yH(s.height_cm)} r="3" fill="#6366f1" />
            <circle cx={xs(s.age_months)} cy={yW(s.weight_kg)} r="3" fill="#10b981" />
          </g>
        ))}
        <text x={P} y={20} fontSize="12" fill="#475569">Height (cm) - indigo · Weight (kg) - green</text>
        <text x={W - P} y={H - 10} fontSize="11" fill="#64748b" textAnchor="end">Age (months) →</text>
      </svg>
      <div className="cv-grid-2" style={{ marginTop: 12 }}>
        <div className="cv-stat"><b>Latest Height</b><span>{data.latest.height_cm} cm</span></div>
        <div className="cv-stat"><b>Latest Weight</b><span>{data.latest.weight_kg} kg</span></div>
      </div>
    </div>
  );
}
