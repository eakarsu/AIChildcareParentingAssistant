// === Pediatrician Handoff PDF ===
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  "key": "pediatricianHandoffPdf",
  "label": "Handoff Summary",
  "description": "Select the child and the period to include. The summary is built from recorded data, not from the model; the PDF is a discussion aid, not a medical record.",
  "fields": [
    {
      "name": "child_id",
      "label": "Child ID",
      "type": "number",
      "example": "1"
    },
    {
      "name": "since",
      "label": "Include records since (YYYY-MM-DD)",
      "type": "text",
      "optional": true,
      "example": "2026-01-01"
    }
  ]
};

export default function NoPediatricianHandoffPdfGeneratorPage() {
  return (
    <AIFeatureForm
      title="Pediatrician Handoff PDF"
      intro="A record summary you can hand to a clinician, built from the child's own recorded data."
      tool={TOOL}
      endpoint="/api/ai/pediatrician-handoff-pdf"
      resultMode="ai"
    />
  );
}
