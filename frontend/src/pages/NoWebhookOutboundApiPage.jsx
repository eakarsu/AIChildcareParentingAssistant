// === Outbound Webhooks ===
// No service backs this page in this deployment; the form fills and Run explains why.
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  "key": "webhook",
  "label": "Webhook test",
  "description": "A webhook requires a destination and a signing secret to be configured before it can send anything.",
  "fields": [
    {
      "name": "url",
      "label": "Destination URL",
      "type": "text",
      "example": "https://example.com/hooks/childcare"
    },
    {
      "name": "event",
      "label": "Event",
      "type": "text",
      "example": "record.created"
    }
  ]
};

export default function NoWebhookOutboundApiPage() {
  return (
    <AIFeatureForm
      title="Outbound Webhooks"
      intro="Notify an external system when records change."
      tool={TOOL}
      endpoint=""
      unavailable="No webhook dispatcher is deployed here. A webhook needs a destination URL, a signing secret and a delivery worker, none of which are configured in this environment."
    />
  );
}
