// === AI behavior-incident coach with safe-conversation guardrails ===
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  key: 'behaviorCoach',
  label: 'Behavior Coach (Safe)',
  description:
    'De-escalation-focused guidance for incidents you record. The system prompt explicitly rejects punitive or unsafe advice, and every answer carries an advisory notice.',
  fields: [
    {
      name: 'incidents',
      label: 'Incidents (JSON array)',
      type: 'json',
      example: JSON.stringify([
        { date: '2026-09-18', behavior: 'tantrum at bedtime', context: 'after screen time', mood: 'Frustrated' },
        { date: '2026-09-20', behavior: 'refused to share toys', context: 'playdate', mood: 'Angry' },
      ], null, 2),
    },
    {
      name: 'triggers',
      label: 'Known triggers (JSON array)',
      type: 'json',
      optional: true,
      example: JSON.stringify(['screen time', 'transitions', 'hunger'], null, 2),
    },
  ],
};

export default function NoAiBehaviorIncidentCoachWithSafeConversatiPage() {
  return (
    <AIFeatureForm
      title="Behavior Incident Coach"
      intro="Safe, de-escalation-focused guidance — never punitive, never medical advice."
      tool={TOOL}
      endpoint="/api/ai/behavior-coach"
      resultMode="ai"
    />
  );
}
