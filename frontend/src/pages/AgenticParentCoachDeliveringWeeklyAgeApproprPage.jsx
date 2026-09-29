// === Agentic Parent Coach ===
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  "key": "parentCoach",
  "label": "Weekly Plan Request",
  "description": "Describe the child and the week you want planned. The coach returns a summary, actions and risks as strict JSON.",
  "fields": [
    {
      "name": "child_age_months",
      "label": "Child age (months)",
      "type": "number",
      "example": "24"
    },
    {
      "name": "goals",
      "label": "Goals for the week (comma-separated)",
      "type": "list",
      "example": "more outdoor play, consistent bedtime, fewer tantrums at transitions"
    },
    {
      "name": "constraints",
      "label": "Constraints (comma-separated)",
      "type": "list",
      "optional": true,
      "example": "both parents work until 5pm, no screen time before dinner"
    },
    {
      "name": "notes",
      "label": "Anything else the coach should know",
      "type": "text",
      "optional": true,
      "example": "Recently started daycare and is more tired in the evenings."
    }
  ]
};

export default function AgenticParentCoachDeliveringWeeklyAgeApproprPage() {
  return (
    <AIFeatureForm
      title="Agentic Parent Coach"
      intro="Weekly, age-appropriate plans generated from the context you provide."
      tool={TOOL}
      endpoint="/api/parent-coach/run"
      resultMode="kv"
    />
  );
}
