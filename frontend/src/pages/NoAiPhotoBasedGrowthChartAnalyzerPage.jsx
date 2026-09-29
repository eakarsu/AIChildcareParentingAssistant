// === AI photo-based growth-chart analyzer ===
// Deterministic growth-series summary; percentiles are only reported when a
// reference curve is supplied, otherwise the response says so.
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  key: 'growthChartAnalyzer',
  label: 'Growth Chart Analyzer',
  description:
    'Summarises a growth series (first/last, change, approximate rate per month) in code, then adds an AI interpretation. No percentile is invented without a reference curve.',
  fields: [
    {
      name: 'measurements',
      label: 'Measurements (JSON array)',
      type: 'json',
      example: JSON.stringify([
        { date: '2026-03-01', height_cm: 78, weight_kg: 10.2, head_circumference_cm: 46 },
        { date: '2026-06-01', height_cm: 80.5, weight_kg: 10.9, head_circumference_cm: 46.6 },
        { date: '2026-09-01', height_cm: 83, weight_kg: 11.4, head_circumference_cm: 47.1 },
      ], null, 2),
    },
    {
      name: 'child_id',
      label: 'Child ID',
      type: 'number',
      optional: true,
      example: '1',
      hint: 'Optional. Read the child’s recorded measurements directly instead of the JSON above.',
    },
  ],
};

export default function NoAiPhotoBasedGrowthChartAnalyzerPage() {
  return (
    <AIFeatureForm
      title="Growth Chart Analyzer"
      intro="Growth trends computed from real measurements, with the arithmetic shown as facts."
      tool={TOOL}
      endpoint="/api/ai/growth-chart-analyzer"
      resultMode="ai"
    />
  );
}
