// === Reminder Delivery ===
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  "key": "reminderDelivery",
  "label": "Send a reminder",
  "description": "Delivery requires a configured email (SMTP) or SMS (Twilio) provider. Without one the response says so rather than claiming success.",
  "fields": [
    {
      "name": "reminder_id",
      "label": "Reminder ID",
      "type": "number",
      "example": "1"
    },
    {
      "name": "channel",
      "label": "Channel",
      "type": "text",
      "example": "email",
      "hint": "email or sms"
    }
  ]
};

export default function RemindersRoutesExistButNoSmsPushDeliveryChPage() {
  return (
    <AIFeatureForm
      title="Reminder Delivery"
      intro="Send a stored reminder by email or SMS, with an honest result from the provider."
      tool={TOOL}
      endpoint="/api/reminders/{reminder_id}/send"
      resultMode="kv"
    />
  );
}
