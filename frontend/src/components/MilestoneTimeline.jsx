import React, { useEffect, useState } from 'react';
import { apiCall } from '../api';

const COLORS = { achieved: '#10b981', in_progress: '#f59e0b', upcoming: '#94a3b8' };

export default function MilestoneTimeline() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiCall('/custom-views/milestone-timeline');
        setData(res);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="cv-card"><p>Loading timeline...</p></div>;
  if (error) return <div className="cv-card"><p style={{color:'#ef4444'}}>Error: {error}</p></div>;
  if (!data) return null;

  return (
    <div className="cv-card" data-testid="cv-milestone-timeline">
      <div className="cv-card-header">
        <h3>Milestone Timeline</h3>
        <span className="cv-badge">{data.summary.completion_pct}% complete</span>
      </div>

      <div className="cv-progress">
        <div className="cv-progress-bar" style={{ width: `${data.summary.completion_pct}%` }} />
      </div>

      <div className="cv-stats-row">
        <div className="cv-stat-small"><span style={{color: COLORS.achieved}}>●</span> {data.summary.achieved} achieved</div>
        <div className="cv-stat-small"><span style={{color: COLORS.in_progress}}>●</span> {data.summary.in_progress} in progress</div>
        <div className="cv-stat-small"><span style={{color: COLORS.upcoming}}>●</span> {data.summary.upcoming} upcoming</div>
      </div>

      <ol className="cv-timeline">
        {data.milestones.map((m, i) => (
          <li key={i} className="cv-timeline-item">
            <span className="cv-timeline-dot" style={{ background: COLORS[m.status] }} />
            <div className="cv-timeline-content">
              <div className="cv-timeline-head">
                <b>{m.title}</b>
                <span className="cv-pill">{m.category} · {m.age_months} mo</span>
              </div>
              <p>{m.description}</p>
              <small style={{ color: COLORS[m.status] }}>
                {m.status.replace('_', ' ')}{m.achieved_date ? ` · ${m.achieved_date}` : ''}
              </small>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
