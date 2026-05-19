import React from 'react';
import ChildGrowthChart from '../components/ChildGrowthChart';
import MilestoneTimeline from '../components/MilestoneTimeline';
import DevelopmentalReport from '../components/DevelopmentalReport';
import ActivityPlanner from '../components/ActivityPlanner';

export default function CustomViewsPage() {
  return (
    <div className="container cv-page" data-testid="custom-views-page">
      <header className="cv-page-header">
        <h1>👨‍👩‍👧 Parent Views</h1>
        <p>Synthesized parenting insights: growth charts, milestones, reports, and activity planning.</p>
      </header>

      <div className="cv-grid">
        <ChildGrowthChart />
        <MilestoneTimeline />
        <DevelopmentalReport />
        <ActivityPlanner />
      </div>

      <style>{`
        .cv-page { padding-top: 1rem; }
        .cv-page-header { margin-bottom: 1.5rem; }
        .cv-page-header h1 { margin-bottom: 0.25rem; }
        .cv-page-header p { color: var(--text-secondary); }
        .cv-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 1.25rem; }
        .cv-card { background: var(--bg-white); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm); }
        .cv-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem; }
        .cv-card-header h3 { margin: 0; color: var(--primary-dark); }
        .cv-badge { background: var(--primary-bg); color: var(--primary-dark); padding: 4px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
        .cv-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
        .cv-stat { background: var(--bg); padding: 0.6rem 0.8rem; border-radius: 8px; display:flex; flex-direction:column; }
        .cv-stat b { font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); }
        .cv-stat span { font-size: 1.1rem; font-weight: 700; color: var(--text); }
        .cv-progress { background: var(--border-light); height: 10px; border-radius: 999px; overflow: hidden; margin-bottom: 0.75rem; }
        .cv-progress-bar { background: linear-gradient(90deg, var(--primary), var(--secondary)); height: 100%; transition: width 0.4s; }
        .cv-stats-row { display:flex; gap: 1rem; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; }
        .cv-timeline { list-style: none; padding: 0; max-height: 360px; overflow-y: auto; border-top: 1px solid var(--border-light); padding-top: 0.5rem; }
        .cv-timeline-item { display:flex; gap: 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid var(--border-light); }
        .cv-timeline-dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
        .cv-timeline-content { flex: 1; }
        .cv-timeline-head { display:flex; justify-content:space-between; align-items:center; }
        .cv-pill { background: var(--bg); padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; color: var(--text-secondary); margin-left: 4px; }
        .cv-checkbox-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.75rem 0; }
        .cv-check { display:flex; gap: 0.5rem; align-items:center; font-size: 0.9rem; cursor: pointer; }
        .cv-btn-row { display:flex; gap: 0.5rem; margin-top: 0.5rem; }
        .btn { padding: 0.55rem 1.1rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-white); cursor:pointer; font-weight: 600; font-size: 0.9rem; }
        .btn:hover { background: var(--bg); }
        .btn-primary { background: var(--primary); border-color: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-dark); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cv-report-preview { background: var(--bg); padding: 1rem; border-radius: 10px; margin-top: 1rem; max-height: 280px; overflow-y: auto; }
        .cv-report-section { margin-top: 0.75rem; }
        .cv-report-section h5 { color: var(--primary-dark); margin-bottom: 0.25rem; }
        .cv-stepper { display:flex; gap: 0.75rem; margin-bottom: 1rem; font-size: 0.85rem; color: var(--text-muted); }
        .cv-stepper .on { color: var(--primary-dark); font-weight: 700; }
        .cv-form { display:flex; flex-direction:column; gap: 0.75rem; }
        .cv-form label { display:flex; flex-direction:column; gap: 0.25rem; font-size: 0.85rem; color: var(--text-secondary); font-weight: 600; }
        .cv-form select { padding: 0.5rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem; }
        .cv-suggestions { list-style: none; padding: 0; }
        .cv-suggestions li { padding: 0.6rem; border-bottom: 1px solid var(--border-light); display:flex; align-items:center; gap: 0.5rem; flex-wrap: wrap; }
        .cv-plan-slots { padding-left: 0; list-style: none; }
        .cv-plan-slots li { padding: 0.6rem; background: var(--bg); border-radius: 8px; margin-bottom: 0.5rem; }
        .cv-slot-head { display:flex; justify-content:space-between; font-size: 0.95rem; }
        .cv-slot-head span { color: var(--primary-dark); font-weight: 700; }
        .cv-plan-slots p { font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; }
      `}</style>
    </div>
  );
}
