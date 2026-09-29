// === AI sleep/feeding-log analyzer ===
// Deterministic aggregates computed in code, with an AI explanation on top.
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  key: 'sleepFeedingAnalyzer',
  label: 'Sleep & Feeding Analyzer',
  description:
    'Aggregates your sleep and feeding logs (counts, averages, trends) and adds an AI explanation. The numbers are computed from the logs you supply, never invented.',
  fields: [
    {
      name: 'sleep_logs',
      label: 'Sleep logs (JSON array)',
      type: 'json',
      example: JSON.stringify([
        { date: '2026-09-20', sleep_start: '20:00', sleep_end: '06:00', quality: 'Good' },
        { date: '2026-09-21', sleep_start: '20:30', sleep_end: '05:30', quality: 'Fair' },
        { date: '2026-09-22', sleep_start: '19:45', sleep_end: '06:15', quality: 'Good' },
      ], null, 2),
    },
    {
      name: 'feeding_logs',
      label: 'Feeding logs (JSON array)',
      type: 'json',
      example: JSON.stringify([
        { meal: 'Breakfast', foods: ['oatmeal', 'banana'], calories: 200 },
        { meal: 'Lunch', foods: ['chicken', 'rice'], calories: 300 },
        { meal: 'Snack', foods: ['yogurt'], calories: 120 },
      ], null, 2),
    },
  ],
};

export default function NoAiSleepFeedingLogAnalyzerForPatternsPage() {
  return (
    <AIFeatureForm
      title="Sleep & Feeding Analyzer"
      intro="Patterns across sleep and feeding logs, with the underlying numbers shown as facts."
      tool={TOOL}
      endpoint="/api/ai/sleep-feeding-analyzer"
      resultMode="ai"
    />
  );
}
