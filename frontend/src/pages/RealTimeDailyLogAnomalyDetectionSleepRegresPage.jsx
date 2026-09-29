// === Daily Log Anomaly Detection ===
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  "key": "dailyLogAnomaly",
  "label": "Daily Log Review",
  "description": "Supply recent daily logs; the service identifies changes worth a closer look and whether a referral is warranted.",
  "fields": [
    {
      "name": "daily_logs",
      "label": "Daily logs (JSON array)",
      "type": "json",
      "example": "[\n  {\n    \"date\": \"2026-09-20\",\n    \"sleep_hours\": 11,\n    \"naps\": 2,\n    \"mood\": \"Calm\",\n    \"appetite\": \"Normal\"\n  },\n  {\n    \"date\": \"2026-09-21\",\n    \"sleep_hours\": 8.5,\n    \"naps\": 1,\n    \"mood\": \"Fussy\",\n    \"appetite\": \"Reduced\"\n  },\n  {\n    \"date\": \"2026-09-22\",\n    \"sleep_hours\": 7.5,\n    \"naps\": 1,\n    \"mood\": \"Fussy\",\n    \"appetite\": \"Reduced\"\n  }\n]"
    }
  ]
};

export default function RealTimeDailyLogAnomalyDetectionSleepRegresPage() {
  return (
    <AIFeatureForm
      title="Daily Log Anomaly Detection"
      intro="Flags unusual changes in daily logs, for example a sleep regression, and suggests what to watch."
      tool={TOOL}
      endpoint="/api/daily-log-anomaly/run"
      resultMode="kv"
    />
  );
}
