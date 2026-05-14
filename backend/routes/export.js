const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Attempt to load pdfkit
let PDFDocument = null;
try {
  PDFDocument = require('pdfkit');
} catch (_) {
  // pdfkit not installed, will fall back to structured JSON
}

// ─── GET /child/:id/report - PDF (or JSON) report for a child ────────────────
// NOTE: This must come before the /:table catch-all below
router.get('/child/:id/report', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch child data
    const childResult = await pool.query('SELECT * FROM children WHERE id = $1', [id]);
    if (childResult.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found.' });
    }
    const child = childResult.rows[0];

    // Fetch associated data in parallel
    const [milestones, activities, growthRecords, healthRecords, vaccinations, sleepRecords] =
      await Promise.all([
        pool.query('SELECT * FROM milestones WHERE child_id = $1 ORDER BY achieved_date DESC NULLS LAST', [id]),
        pool.query('SELECT * FROM activities WHERE child_id = $1 ORDER BY scheduled_date DESC NULLS LAST LIMIT 50', [id]),
        pool.query('SELECT * FROM growth_records WHERE child_id = $1 ORDER BY measured_date DESC', [id]),
        pool.query('SELECT * FROM health_records WHERE child_id = $1 ORDER BY record_date DESC LIMIT 20', [id]),
        pool.query('SELECT * FROM vaccinations WHERE child_id = $1 ORDER BY administered_date DESC', [id]),
        pool.query('SELECT * FROM sleep_records WHERE child_id = $1 ORDER BY date DESC LIMIT 30', [id]),
      ]);

    const reportData = {
      generated_at: new Date().toISOString(),
      child: {
        id: child.id,
        name: child.name,
        date_of_birth: child.date_of_birth,
        gender: child.gender,
        blood_type: child.blood_type,
        allergies: child.allergies,
        notes: child.notes,
      },
      milestone_history: milestones.rows,
      activity_log: activities.rows,
      growth_tracking: growthRecords.rows,
      health_records: healthRecords.rows,
      vaccinations: vaccinations.rows,
      sleep_records: sleepRecords.rows,
    };

    if (!PDFDocument) {
      // Fallback: return structured JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="child_${id}_report.json"`);
      return res.json(reportData);
    }

    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="child_${id}_report.pdf"`);
    doc.pipe(res);

    const addSection = (title) => {
      doc.addPage();
      doc.fontSize(16).fillColor('#2c3e50').text(title, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#333333');
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';

    // Cover page
    doc.fontSize(24).fillColor('#2c3e50').text('Child Development Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).fillColor('#34495e').text(child.name, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).fillColor('#7f8c8d').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Child info on cover
    doc.fontSize(12).fillColor('#333');
    if (child.date_of_birth) doc.text(`Date of Birth: ${formatDate(child.date_of_birth)}`);
    if (child.gender) doc.text(`Gender: ${child.gender}`);
    if (child.blood_type) doc.text(`Blood Type: ${child.blood_type}`);
    if (child.allergies) doc.text(`Allergies: ${child.allergies}`);

    // Milestone History
    addSection('Milestone History');
    if (milestones.rows.length === 0) {
      doc.text('No milestones recorded.');
    } else {
      for (const m of milestones.rows) {
        doc.text(`• [${m.status || 'N/A'}] ${m.title} — ${formatDate(m.achieved_date)}`);
        if (m.description) doc.text(`  ${m.description}`, { indent: 10 });
        doc.moveDown(0.3);
      }
    }

    // Growth Tracking
    addSection('Growth Tracking');
    if (growthRecords.rows.length === 0) {
      doc.text('No growth records.');
    } else {
      for (const g of growthRecords.rows) {
        doc.text(`• ${formatDate(g.measured_date)}: Height ${g.height_cm || '?'} cm | Weight ${g.weight_kg || '?'} kg | Head ${g.head_circumference_cm || '?'} cm`);
      }
    }

    // Vaccinations
    addSection('Vaccinations');
    if (vaccinations.rows.length === 0) {
      doc.text('No vaccination records.');
    } else {
      for (const v of vaccinations.rows) {
        doc.text(`• ${v.vaccine_name} (Dose ${v.dose_number || 1}) — ${formatDate(v.administered_date)}`);
        if (v.next_due_date) doc.text(`  Next due: ${formatDate(v.next_due_date)}`, { indent: 10 });
      }
    }

    // Health Records
    addSection('Health Records (Recent 20)');
    if (healthRecords.rows.length === 0) {
      doc.text('No health records.');
    } else {
      for (const h of healthRecords.rows) {
        doc.text(`• [${h.record_type}] ${h.title} — ${formatDate(h.record_date)}`);
        if (h.description) doc.text(`  ${h.description}`, { indent: 10 });
      }
    }

    // Recent Activities
    addSection('Activity Log (Recent 50)');
    if (activities.rows.length === 0) {
      doc.text('No activities recorded.');
    } else {
      for (const a of activities.rows) {
        doc.text(`• [${a.status || 'N/A'}] ${a.title} — ${formatDate(a.scheduled_date)}`);
        if (a.description) doc.text(`  ${a.description}`, { indent: 10 });
      }
    }

    // Disclaimer
    doc.addPage();
    doc.fontSize(10).fillColor('#7f8c8d')
      .text(
        'Disclaimer: This report is for informational purposes only and does not constitute medical advice. ' +
        'Always consult your pediatrician for medical concerns.',
        { align: 'center' }
      );

    doc.end();
  } catch (err) {
    console.error('Child report error:', err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// ─── GET /export/:table - Export table data as CSV (existing) ────────────────
router.get('/:table', auth, async (req, res) => {
  const allowedTables = [
    'children', 'milestones', 'activities', 'health_records', 'sleep_records',
    'feeding_records', 'growth_records', 'vaccinations', 'behavioral_notes',
    'journal_entries', 'medications', 'appointments', 'emergency_contacts',
    'learning_resources', 'diaper_records', 'expenses', 'caregiver_logs',
    'daily_routines', 'tooth_records', 'photo_memories', 'chores',
    'allergy_logs', 'playdates', 'shopping_lists',
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
