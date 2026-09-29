// === AI Coverage Review ===
// No service backs this page in this deployment; the form fills and Run explains why.
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  "key": "aiCoverage",
  "label": "Coverage request",
  "description": "This page does not call a service; see AI Parenting Tools for the available capabilities.",
  "fields": [
    {
      "name": "area",
      "label": "Area of interest",
      "type": "text",
      "example": "sleep and feeding"
    }
  ]
};

export default function Only4AiEndpointsNarrowCoveragePage() {
  return (
    <AIFeatureForm
      title="AI Coverage Review"
      intro="Which AI capabilities this deployment exposes."
      tool={TOOL}
      endpoint=""
      unavailable="This is a coverage note rather than a service. The working AI capabilities are listed on the AI Parenting Tools page."
    />
  );
}
