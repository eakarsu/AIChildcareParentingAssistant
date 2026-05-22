import React, { useEffect, useState } from 'react';

export default function ScreenTimeBalance() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/screen-time-balance', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData({ error: 'Unable to load screen time balance.' }));
  }, []);

  if (!data) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <h1>Screen Time Balance</h1>
      <p className="muted">Family screen-time patterns with sleep, outdoor activity, and caregiver interaction context.</p>
      <div className="summary-grid">
        <div className="summary-card"><strong>{data.summary?.weeklyMinutes}</strong><span>Weekly Minutes</span></div>
        <div className="summary-card"><strong>{data.summary?.overageMinutes}</strong><span>Overage Minutes</span></div>
        <div className="summary-card"><strong>{data.summary?.outdoorHours}</strong><span>Outdoor Hours</span></div>
        <div className="summary-card"><strong>{data.summary?.sleepImpactRisk}</strong><span>Sleep Risk</span></div>
      </div>
      <div className="card">
        {data.children?.map((child) => (
          <div key={child.name} className="row">
            <strong>{child.name}</strong><span>Age {child.age}</span><span>{child.minutes} min</span><span>{child.pattern}</span><span>{child.suggestion}</span>
          </div>
        ))}
      </div>
      <div className="card"><h2>Guidance</h2><ul>{data.guidance?.map((item) => <li key={item}>{item}</li>)}</ul></div>
    </div>
  );
}
