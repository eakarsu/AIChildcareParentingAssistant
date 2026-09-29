// === Pediatric Network Deployment ===
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  "key": "pediatricNetwork",
  "label": "Deployment Request",
  "description": "Describe the organisation and rollout; the service returns a structured assessment.",
  "fields": [
    {
      "name": "organisation",
      "label": "Organisation name",
      "type": "text",
      "example": "Northside Pediatric Group"
    },
    {
      "name": "locations",
      "label": "Number of locations",
      "type": "number",
      "example": "12"
    },
    {
      "name": "requirements",
      "label": "Requirements (comma-separated)",
      "type": "list",
      "example": "single sign-on, audit logging, per-tenant data isolation"
    },
    {
      "name": "notes",
      "label": "Additional context",
      "type": "text",
      "optional": true,
      "example": "Must integrate with an existing patient portal."
    }
  ]
};

export default function WhiteLabelDeploymentForHospitalPediatricNetwPage() {
  return (
    <AIFeatureForm
      title="Pediatric Network Deployment"
      intro="Configuration request for a white-label deployment to hospital and pediatric networks."
      tool={TOOL}
      endpoint="/api/pediatric-network/run"
      resultMode="kv"
    />
  );
}
