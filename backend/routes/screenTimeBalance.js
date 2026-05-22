const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    feature: 'Screen Time Balance',
    summary: { weeklyMinutes: 410, overageMinutes: 95, outdoorHours: 6, sleepImpactRisk: 'Medium' },
    children: [
      { name: 'Avery', age: 4, minutes: 185, pattern: 'Evening cluster', suggestion: 'Move tablet time before dinner' },
      { name: 'Milo', age: 7, minutes: 225, pattern: 'Weekend spike', suggestion: 'Pair with outdoor activity block' },
    ],
    guidance: [
      'Replace late-evening screen time with wind-down routine cues.',
      'Track co-viewing separately from solo passive viewing.',
      'Balance screen sessions with movement, reading, and caregiver interaction.',
    ],
  });
});

module.exports = router;
