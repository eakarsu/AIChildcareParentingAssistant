import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { apiCall } from '../api';

const ALL_SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'growth', label: 'Growth Metrics' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'recommendations', label: 'Recommendations' },
];

export default function DevelopmentalReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState(ALL_SECTIONS.map((s) => s.key));

  const toggle = (k) => setSections((s) => s.includes(k) ? s.filter(x => x !== k) : [...s, k]);

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiCall('/custom-views/developmental-report', {
        method: 'POST',
        body: JSON.stringify({ include_sections: sections }),
      });
      setReport(res.report);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const downloadPDF = () => {
    if (!report) return;
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(18);
    doc.text(report.title || 'Developmental Report', 15, y); y += 10;
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date(report.generated_at).toLocaleString()}`, 15, y); y += 10;
    (report.sections || []).forEach((s) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(14); doc.text(s.heading, 15, y); y += 7;
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(s.body || '', 180);
      doc.text(lines, 15, y); y += lines.length * 5 + 4;
      if (Array.isArray(s.items)) {
        s.items.forEach((it) => { doc.text(`• ${it}`, 18, y); y += 5; });
      }
    });
    doc.save(`developmental_report_${Date.now()}.pdf`);
  };

  return (
    <div className="cv-card" data-testid="cv-dev-report">
      <div className="cv-card-header">
        <h3>Developmental Report (PDF)</h3>
      </div>
      <p style={{ color: '#64748b', marginBottom: 10 }}>
        Generate a structured developmental report and export it as a PDF for pediatric review.
      </p>
      <div className="cv-checkbox-grid">
        {ALL_SECTIONS.map((s) => (
          <label key={s.key} className="cv-check">
            <input type="checkbox" checked={sections.includes(s.key)} onChange={() => toggle(s.key)} />
            {s.label}
          </label>
        ))}
      </div>
      <div className="cv-btn-row">
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
        {report && (
          <button className="btn" onClick={downloadPDF} data-testid="cv-pdf-download">
            ⬇ Download PDF
          </button>
        )}
      </div>
      {error && <p style={{color:'#ef4444'}}>Error: {error}</p>}
      {report && (
        <div className="cv-report-preview">
          <h4>{report.title}</h4>
          <small>Generated: {new Date(report.generated_at).toLocaleString()}</small>
          {report.sections.map((s, i) => (
            <div key={i} className="cv-report-section">
              <h5>{s.heading}</h5>
              <p>{s.body}</p>
              {Array.isArray(s.items) && (
                <ul style={{ paddingLeft: 18, listStyle: 'disc' }}>
                  {s.items.map((it, j) => <li key={j}>{it}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
