// === Subscription Billing ===
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  "key": "billing",
  "label": "Plan enquiry",
  "description": "Shows the plans this deployment offers and whether checkout is configured.",
  "fields": [
    {
      "name": "plan",
      "label": "Plan you are considering",
      "type": "text",
      "optional": true,
      "example": "family"
    }
  ]
};

export default function NoSubscriptionBillingForPremiumTierPage() {
  return (
    <AIFeatureForm
      title="Subscription Billing"
      intro="Plans and checkout status. Checkout requires a configured payment provider."
      tool={TOOL}
      endpoint="/api/billing/status"
      getEndpoint="/api/billing/status"
      resultMode="kv"
    />
  );
}
