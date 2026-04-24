const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /export/:table - Export table data as CSV
router.get('/:table', auth, async (req, res) => {
  const allowedTables = [
    'children', 'milestones', 'activities', 'health_records', 'sleep_records',
    'feeding_records', 'growth_records', 'vaccinations', 'behavioral_notes',
    'journal_entries', 'medications', 'appointments', 'emergency_contacts',
    'learning_resources', 'diaper_records', 'expenses', 'caregiver_logs',
    'daily_routines', 'tooth_records', 'photo_memories', 'chores',
    'allergy_logs', 'playdates', 'shopping_lists'
  ];

  const table = req.params.table;
  if (!allowedTables.includes(table)) {
    return res.status(400).json({ error: 'Invalid table name.' });
  }

  try {
    const result = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
    if (result.rows.length === 0) {
      return res.status(200).send('No data to export.');
    }

    const headers = Object.keys(result.rows[0]);
    const csvRows = [headers.join(',')];

    for (const row of result.rows) {
      const values = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvRows.push(values.join(','));
    }

    const csv = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${table}_export.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export data.' });
  }
});

module.exports = router;
