// === Evidence-Based Literature Search ===
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  "key": "evidenceLitRag",
  "label": "Literature Question",
  "description": "Ask a question; the service grounds the answer in evidence-based sources and applies safe-content filters.",
  "fields": [
    {
      "name": "question",
      "label": "Your question",
      "type": "text",
      "example": "What does the evidence say about introducing solids and allergy risk?"
    },
    {
      "name": "child_age_months",
      "label": "Child age (months)",
      "type": "number",
      "optional": true,
      "example": "6"
    }
  ]
};

export default function RagOverEvidenceBasedParentingLiteratureAapNPage() {
  return (
    <AIFeatureForm
      title="Evidence-Based Literature Search"
      intro="Answers grounded in parenting literature (AAP, NICHD) with safe-content filtering."
      tool={TOOL}
      endpoint="/api/evidence-lit-rag/run"
      resultMode="kv"
    />
  );
}
