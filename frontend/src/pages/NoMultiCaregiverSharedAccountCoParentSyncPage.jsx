// === Shared Caregiver Access ===
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  "key": "sharing",
  "label": "Invite a caregiver",
  "description": "Creates a pending invitation for an existing account. Roles are guardian or caregiver.",
  "fields": [
    {
      "name": "child_id",
      "label": "Child ID",
      "type": "number",
      "example": "1"
    },
    {
      "name": "email",
      "label": "Caregiver email",
      "type": "text",
      "example": "caregiver@example.com"
    },
    {
      "name": "role",
      "label": "Role",
      "type": "text",
      "example": "caregiver",
      "hint": "guardian or caregiver"
    }
  ]
};

export default function NoMultiCaregiverSharedAccountCoParentSyncPage() {
  return (
    <AIFeatureForm
      title="Shared Caregiver Access"
      intro="Invite a caregiver or co-parent to a child's records, with roles and an audit trail."
      tool={TOOL}
      endpoint="/api/sharing/{child_id}/invite"
      resultMode="kv"
    />
  );
}
