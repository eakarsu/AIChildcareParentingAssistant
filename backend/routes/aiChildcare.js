/**
 * aiChildcare.js — deterministic + AI-assisted childcare endpoints.
 *
 * Mounted at /api/ai (server.js). Every route:
 *   - is guarded by `auth` and the shared `aiLimiter`
 *   - validates its input and returns clear 400s
 *   - computes deterministic facts in code (never fabricates numbers)
 *   - asks the model through `callOpenRouter` and parses with `parseAIJson`
 *   - persists the run through `saveAIResult`
 *   - carries `advisory: true` plus the shared advisory/disclaimer text
 *
 * When the model output cannot be parsed, the raw text is returned under
 * `raw` with `parsed: false` and a route-specific reason — never thrown.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { callOpenRouter, parseAIJson, saveAIResult, DEFAULT_MODEL } = require('../lib/aiHelpers');

const router = express.Router();

const SYSTEM_PROMPT =
  'You are an expert pediatric advisor and child development specialist. ' +
  'Provide helpful, evidence-based advice about childcare and parenting. ' +
  'Be warm, supportive, and professional. Always recommend consulting a pediatrician for medical concerns. ' +
  'Never invent numbers, measurements, records, diagnoses, or events that were not supplied to you.';

const MEDICAL_DISCLAIMER =
  '\n\n*Note: This advice is for informational purposes only and does not constitute medical advice. ' +
  'Always consult your pediatrician for medical concerns.*';

// Shared guardrail text returned with every response as `advisory_text`.
const ADVISORY =
  'Informational only: this output supports caregiving decisions and is not medical advice, ' +
  'diagnosis, or treatment. Always consult a qualified pediatrician or healthcare professional.';

// Every route applies the same guard chain: authentication then AI rate limit.
const guards = () => [auth, aiLimiter];

// Parse-failure reasons, one per route (returned as `parse_reason`).
const PARSE_REASONS = {
  'handoff-summary': 'The model reply for the sitter handoff was not valid JSON; returning the raw text under "raw".',
  'milestone-gap-advisor': 'The model reply for milestone guidance was not valid JSON; returning the raw text under "raw".',
  'sleep-feeding-analyzer': 'The model reply for the sleep/feeding analysis was not valid JSON; returning the raw text under "raw".',
  'behavior-coach': 'The model reply for behavior coaching was not valid JSON; returning the raw text under "raw".',
  'growth-chart-analyzer': 'The model reply for the growth interpretation was not valid JSON; returning the raw text under "raw".',
  'pediatrician-handoff-pdf': 'The model reply for discussion questions was not valid JSON; the section was omitted from the PDF.',
};

// ─── small numeric / date helpers (all deterministic) ────────────────────────

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round(n, digits = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function avg(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function hoursBetween(a, b) {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
  return (t2 - t1) / 3600000;
}

function daysBetween(a, b) {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
  return (t2 - t1) / 86400000;
}

function monthsBetween(a, b) {
  const d = daysBetween(a, b);
  return d === null ? null : d / 30.4375;
}

// Direction of a chronological numeric series: up / down / stable / insufficient.
function trendDirection(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length < 2) return 'insufficient_data';
  const mid = Math.floor(nums.length / 2);
  const first = avg(nums.slice(0, mid));
  const second = avg(nums.slice(mid));
  if (first === null || second === null) return 'insufficient_data';
  if (first === 0) return second > 0 ? 'up' : 'stable';
  const change = (second - first) / Math.abs(first);
  if (change > 0.1) return 'up';
  if (change < -0.1) return 'down';
  return 'stable';
}

function ageInMonths(dob) {
  if (!dob) return null;
  const m = monthsBetween(dob, new Date());
  return m === null ? null : Math.floor(m);
}

function advisoryFields() {
  return { advisory: true, advisory_text: ADVISORY, disclaimer: MEDICAL_DISCLAIMER.trim() };
}

// Call the model and normalise the result without ever throwing.
async function askModel(systemPrompt, userPrompt, opts = {}) {
  try {
    const data = await callOpenRouter(systemPrompt, userPrompt, opts);
    const raw = (data && data.choices && data.choices[0] && data.choices[0].message
      && data.choices[0].message.content) || '';
    return {
      provider_used: true,
      raw,
      parsed: parseAIJson(raw),
      model: data && data.model ? data.model : null,
      usage: (data && data.usage) || null,
      error: null,
    };
  } catch (e) {
    return {
      provider_used: false,
      raw: null,
      parsed: null,
      model: null,
      usage: null,
      error: e && e.message ? e.message : String(e),
    };
  }
}

// Normalise an `askModel` result into an object analysis with parse metadata.
function resolveAnalysis(ai, feature) {
  if (ai.parsed && typeof ai.parsed === 'object' && !Array.isArray(ai.parsed)) {
    return { analysis: ai.parsed, parsed: true };
  }
  const out = { analysis: null, parsed: false, provider_used: ai.provider_used };
  if (ai.raw) {
    out.raw = ai.raw;
    out.parse_reason = PARSE_REASONS[feature] || 'The model output could not be parsed as JSON.';
  } else {
    out.parse_reason = ai.error
      ? `AI provider request failed: ${ai.error}`
      : 'AI provider returned no content; deterministic facts only.';
  }
  return out;
}

// ─── deterministic child-record gathering ────────────────────────────────────

// Only tables that exist and are globally non-empty are queried; each query is
// wrapped in its own try/catch so one bad table cannot break the request.
const CHILD_TABLES = [
  { name: 'milestones', columns: 'title, description, category, achieved_date, expected_age_months, status', dateCol: 'achieved_date' },
  { name: 'medications', columns: 'name, dosage, frequency, start_date, end_date, prescribed_by, notes', dateCol: 'start_date' },
  { name: 'allergy_logs', columns: 'allergen, severity, reaction, first_observed, last_reaction, treatment, is_confirmed, notes', dateCol: 'last_reaction' },
  { name: 'appointments', columns: 'title, provider, location, appointment_date, appointment_type, status, notes', dateCol: 'appointment_date' },
  { name: 'sleep_records', columns: 'date, sleep_start, sleep_end, quality, notes', dateCol: 'date' },
  { name: 'feeding_records', columns: 'meal_type, food_items, quantity, meal_time, calories, notes', dateCol: 'meal_time' },
  { name: 'diaper_records', columns: 'change_time, type, notes', dateCol: 'change_time' },
  { name: 'behavioral_notes', columns: 'title, behavior, context, observed_date, mood, severity', dateCol: 'observed_date' },
  { name: 'vaccinations', columns: 'vaccine_name, dose_number, administered_date, next_due_date, provider, notes', dateCol: 'administered_date' },
];

const HANDOFF_TABLES = CHILD_TABLES
  .map((t) => t.name)
  .filter((n) => n !== 'vaccinations');

async function gatherChildRecords(childId, opts = {}) {
  const { since = null, tableNames = null, limit = 25 } = opts;
  const specs = tableNames
    ? CHILD_TABLES.filter((t) => tableNames.includes(t.name))
    : CHILD_TABLES;

  const data = {};
  const facts = { counts: {}, tables_used: [], tables_skipped: [], since: since || null };

  for (const spec of specs) {
    // Existence + non-empty check (defensive: missing table throws and is skipped).
    try {
      const total = await pool.query(`SELECT COUNT(*)::int AS n FROM ${spec.name}`);
      if (!total.rows[0] || total.rows[0].n === 0) {
        facts.tables_skipped.push({ table: spec.name, reason: 'empty' });
        continue;
      }
    } catch (_) {
      facts.tables_skipped.push({ table: spec.name, reason: 'missing_or_unreadable' });
      continue;
    }

    try {
      const params = [childId];
      let where = 'child_id = $1';
      if (since && spec.dateCol) {
        params.push(since);
        where += ` AND ${spec.dateCol} >= $${params.length}`;
      }
      const rows = await pool.query(
        `SELECT ${spec.columns} FROM ${spec.name} WHERE ${where} ORDER BY ${spec.dateCol} DESC NULLS LAST LIMIT ${limit}`,
        params
      );
      data[spec.name] = rows.rows;
      facts.counts[spec.name] = rows.rows.length;
      facts.tables_used.push(spec.name);
    } catch (e) {
      facts.tables_skipped.push({ table: spec.name, reason: String(e.message || e).slice(0, 120) });
    }
  }
  return { data, facts };
}

function compactJson(value, max = 6000) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch (_) {
    text = '{}';
  }
  return text.length > max ? `${text.slice(0, max)}…[truncated]` : text;
}

// ─── 1. POST /handoff-summary ────────────────────────────────────────────────

function buildHandoffFallback(child, facts) {
  const age = ageInMonths(child.date_of_birth);
  const lines = [
    `Sitter handoff for ${child.name}${age !== null ? ` (about ${age} months old)` : ''}.`,
  ];
  const entries = Object.entries(facts.counts);
  lines.push(
    entries.length
      ? `Records reviewed: ${entries.map(([k, v]) => `${k} ${v}`).join(', ')}.`
      : 'No child records were available to review.'
  );
  if (facts.timeframe_hours) lines.push(`Timeframe: last ${facts.timeframe_hours} hours.`);
  lines.push('Review the deterministic facts alongside this note; confirm all care details with the parent.');
  return lines.join(' ');
}

router.post('/handoff-summary', ...guards(), async (req, res) => {
  try {
    const { child_id, timeframe_hours } = req.body || {};

    if (child_id === undefined || child_id === null || child_id === '') {
      return res.status(400).json({ error: 'child_id is required.' });
    }
    const childId = Number(child_id);
    if (!Number.isInteger(childId) || childId <= 0) {
      return res.status(400).json({ error: 'child_id must be a positive integer.' });
    }

    let timeframe = null;
    if (timeframe_hours !== undefined && timeframe_hours !== null && timeframe_hours !== '') {
      timeframe = Number(timeframe_hours);
      if (!Number.isFinite(timeframe) || timeframe <= 0) {
        return res.status(400).json({ error: 'timeframe_hours must be a positive number when provided.' });
      }
    }

    const childRes = await pool.query(
      'SELECT id, user_id, name, date_of_birth, gender, blood_type, allergies, notes FROM children WHERE id = $1',
      [childId]
    );
    if (childRes.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found.' });
    }
    const child = childRes.rows[0];

    const { data, facts } = await gatherChildRecords(childId, { tableNames: HANDOFF_TABLES });

    const deterministic = {
      child: {
        id: child.id,
        name: child.name,
        date_of_birth: child.date_of_birth,
        age_months: ageInMonths(child.date_of_birth),
        gender: child.gender,
        blood_type: child.blood_type,
        allergies: child.allergies,
      },
      timeframe_hours: timeframe,
      counts: facts.counts,
      tables_used: facts.tables_used,
      tables_skipped: facts.tables_skipped,
      generated_at: new Date().toISOString(),
    };

    const userPrompt =
      'Prepare a concise babysitter/caregiver handoff for the child below. Use ONLY the supplied facts and ' +
      'records; do not invent numbers, medications, allergies, or events. Say "not recorded" when a detail is absent. ' +
      'Return strict JSON with keys: summary (string, "what a sitter needs to know today"), ' +
      'sitter_checklist (string[]), watch_outs (string[]), emergency_notes (string).\n\n' +
      `DETERMINISTIC FACTS:\n${compactJson(deterministic, 2500)}\n\n` +
      `RECORDS:\n${compactJson(data)}`;

    const ai = await askModel(SYSTEM_PROMPT, userPrompt, { max_tokens: Number(process.env.AI_MAX_TOKENS || 4000) });

    let summary;
    let details = null;
    let parsed = false;
    let raw;
    let parse_reason;

    if (ai.parsed && typeof ai.parsed === 'object' && !Array.isArray(ai.parsed) && typeof ai.parsed.summary === 'string') {
      summary = ai.parsed.summary + MEDICAL_DISCLAIMER;
      details = ai.parsed;
      parsed = true;
    } else if (ai.raw) {
      summary = ai.raw + MEDICAL_DISCLAIMER;
      raw = ai.raw;
      parse_reason = PARSE_REASONS['handoff-summary'];
    } else {
      summary = buildHandoffFallback(child, facts) + MEDICAL_DISCLAIMER;
      parse_reason = ai.error
        ? `AI provider request failed: ${ai.error}`
        : 'AI provider returned no content; returning the deterministic handoff only.';
    }

    const output = {
      summary,
      facts: deterministic,
      details,
      ...advisoryFields(),
      parsed,
      provider_used: ai.provider_used,
    };
    if (raw !== undefined) output.raw = raw;
    if (parse_reason) output.parse_reason = parse_reason;
    if (ai.model) output.model = ai.model;
    if (ai.usage) output.usage = ai.usage;

    const saved = await saveAIResult(pool, {
      user_id: req.user && req.user.id,
      feature: 'handoff-summary',
      input: { child_id: childId, timeframe_hours: timeframe },
      output: { summary, facts: deterministic, details },
      raw_text: ai.raw,
      model: ai.model || DEFAULT_MODEL,
    });
    if (saved) output.ai_result_id = saved.id;

    res.json(output);
  } catch (err) {
    console.error('handoff-summary error:', err);
    res.status(500).json({ error: err.message || 'Failed to build handoff summary.' });
  }
});

// ─── 2. POST /milestone-gap-advisor ──────────────────────────────────────────

router.post('/milestone-gap-advisor', ...guards(), async (req, res) => {
  try {
    const { child_age_months, milestones_achieved } = req.body || {};

    if (child_age_months === undefined || child_age_months === null || child_age_months === '') {
      return res.status(400).json({ error: 'child_age_months is required.' });
    }
    const age = Number(child_age_months);
    if (!Number.isFinite(age) || age < 0) {
      return res.status(400).json({ error: 'child_age_months must be a non-negative number.' });
    }
    if (!Array.isArray(milestones_achieved)) {
      return res.status(400).json({ error: 'milestones_achieved must be an array of strings.' });
    }
    const achieved = milestones_achieved
      .map((m) => (typeof m === 'string' ? m.trim() : String(m || '').trim()))
      .filter(Boolean);
    if (achieved.some((m) => m.length === 0)) {
      return res.status(400).json({ error: 'milestones_achieved must not contain empty entries.' });
    }

    const facts = {
      child_age_months: age,
      milestones_achieved_count: achieved.length,
      milestones_achieved: achieved,
      reference_curve_supplied: false,
      generated_at: new Date().toISOString(),
    };

    const userPrompt =
      `A child is ${age} months old. The parent reports these achieved milestones: ` +
      `${achieved.length ? achieved.join(', ') : 'none listed'}.\n\n` +
      'Compare against general CDC/WHO-style developmental expectations for this age. ' +
      'Do not invent specific numbers, dates, or scores. Return strict JSON with keys: ' +
      'expected (string[] age-appropriate expectations), on_track (string[]), gaps (string[]), ' +
      'next_steps (string[]), pediatrician_questions (string[]), when_to_consult (string[]).';

    const ai = await askModel(SYSTEM_PROMPT, userPrompt, { max_tokens: Number(process.env.AI_MAX_TOKENS || 4000) });
    const resolved = resolveAnalysis(ai, 'milestone-gap-advisor');

    const output = {
      ...resolved,
      facts,
      ...advisoryFields(),
      provider_used: ai.provider_used,
    };
    if (ai.model) output.model = ai.model;
    if (ai.usage) output.usage = ai.usage;

    const saved = await saveAIResult(pool, {
      user_id: req.user && req.user.id,
      feature: 'milestone-gap-advisor',
      input: { child_age_months: age, milestones_achieved: achieved },
      output: { analysis: resolved.analysis, facts },
      raw_text: ai.raw,
      model: ai.model || DEFAULT_MODEL,
    });
    if (saved) output.ai_result_id = saved.id;

    res.json(output);
  } catch (err) {
    console.error('milestone-gap-advisor error:', err);
    res.status(500).json({ error: err.message || 'Failed to build milestone guidance.' });
  }
});

// ─── 3. POST /sleep-feeding-analyzer ─────────────────────────────────────────

function extractSleepDurationHours(r) {
  const direct = toNum(r.duration_hours);
  if (direct !== null) return direct;
  const mins = toNum(r.duration_minutes);
  if (mins !== null) return mins / 60;
  const start = r.sleep_start || r.start;
  const end = r.sleep_end || r.end;
  if (start && end) return hoursBetween(start, end);
  return null;
}

function extractTimestamp(r, fields) {
  for (const f of fields) {
    if (r[f]) {
      const t = new Date(r[f]).getTime();
      if (Number.isFinite(t)) return t;
    }
  }
  return null;
}

function summarizeSleepLogs(logs) {
  const rows = logs.filter((r) => r && typeof r === 'object');
  const durations = [];
  const quality = {};
  const starts = [];
  for (const r of rows) {
    const d = extractSleepDurationHours(r);
    durations.push(d);
    if (r.quality !== undefined && r.quality !== null && r.quality !== '') {
      quality[String(r.quality)] = (quality[String(r.quality)] || 0) + 1;
    }
    const t = extractTimestamp(r, ['sleep_start', 'start']);
    if (t !== null) starts.push(t);
  }
  starts.sort((a, b) => a - b);
  const intervals = [];
  for (let i = 1; i < starts.length; i += 1) intervals.push((starts[i] - starts[i - 1]) / 3600000);

  const validDurations = durations.filter((d) => d !== null);
  const facts = {
    record_count: rows.length,
    duration: validDurations.length
      ? {
          samples: validDurations.length,
          average_hours: round(avg(validDurations)),
          min_hours: round(Math.min(...validDurations)),
          max_hours: round(Math.max(...validDurations)),
          trend: trendDirection(durations.map((d) => (d === null ? NaN : d))),
        }
      : null,
    interval: intervals.length
      ? { samples: intervals.length, average_hours: round(avg(intervals)) }
      : null,
    quality_counts: quality,
  };
  if (!validDurations.length) {
    facts.note = 'No sleep_start/sleep_end (or duration) fields were present, so no duration aggregates were computed.';
  }
  return facts;
}

function summarizeFeedingLogs(logs) {
  const rows = logs.filter((r) => r && typeof r === 'object');
  const mealTypes = {};
  const calories = [];
  const times = [];
  for (const r of rows) {
    if (r.meal_type) mealTypes[String(r.meal_type)] = (mealTypes[String(r.meal_type)] || 0) + 1;
    calories.push(toNum(r.calories));
    const t = extractTimestamp(r, ['meal_time', 'time', 'date']);
    if (t !== null) times.push(t);
  }
  times.sort((a, b) => a - b);
  const intervals = [];
  for (let i = 1; i < times.length; i += 1) intervals.push((times[i] - times[i - 1]) / 3600000);

  const validCalories = calories.filter((c) => c !== null);
  const facts = {
    record_count: rows.length,
    meal_type_counts: mealTypes,
    calories: validCalories.length
      ? {
          samples: validCalories.length,
          average: round(avg(validCalories)),
          total: round(validCalories.reduce((a, b) => a + b, 0)),
          trend: trendDirection(calories.map((c) => (c === null ? NaN : c))),
        }
      : null,
    interval: intervals.length
      ? { samples: intervals.length, average_hours: round(avg(intervals)) }
      : null,
  };
  if (!validCalories.length) {
    facts.note = 'No numeric `calories` field was present on any feeding log; calorie aggregates were not computed.';
  }
  return facts;
}

router.post('/sleep-feeding-analyzer', ...guards(), async (req, res) => {
  try {
    const { sleep_logs, feeding_logs } = req.body || {};
    if (sleep_logs !== undefined && sleep_logs !== null && !Array.isArray(sleep_logs)) {
      return res.status(400).json({ error: 'sleep_logs must be an array when provided.' });
    }
    if (feeding_logs !== undefined && feeding_logs !== null && !Array.isArray(feeding_logs)) {
      return res.status(400).json({ error: 'feeding_logs must be an array when provided.' });
    }
    const sleepLogs = Array.isArray(sleep_logs) ? sleep_logs : null;
    const feedingLogs = Array.isArray(feeding_logs) ? feeding_logs : null;
    if ((!sleepLogs || sleepLogs.length === 0) && (!feedingLogs || feedingLogs.length === 0)) {
      return res.status(400).json({
        error: 'Provide at least one non-empty sleep_logs or feeding_logs array.',
      });
    }
    for (const [name, arr] of [['sleep_logs', sleepLogs], ['feeding_logs', feedingLogs]]) {
      if (arr && arr.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) {
        return res.status(400).json({ error: `${name} must be an array of objects.` });
      }
    }

    const facts = {
      sleep: sleepLogs && sleepLogs.length ? summarizeSleepLogs(sleepLogs) : null,
      feeding: feedingLogs && feedingLogs.length ? summarizeFeedingLogs(feedingLogs) : null,
      generated_at: new Date().toISOString(),
    };

    const userPrompt =
      'Explain the following deterministically computed sleep and feeding aggregates for a child. ' +
      'Use ONLY the supplied aggregates; do not invent numbers. Return strict JSON with keys: ' +
      'patterns (string[]), interpretation (string), recommendations (string[]), ' +
      'concerns (string[]), when_to_consult (string[]).\n\n' +
      `FACTS:\n${compactJson(facts, 4000)}\n\n` +
      `RAW LOGS (context only):\n${compactJson({ sleep_logs: sleepLogs || [], feeding_logs: feedingLogs || [] }, 4000)}`;

    const ai = await askModel(SYSTEM_PROMPT, userPrompt, { max_tokens: Number(process.env.AI_MAX_TOKENS || 4000) });
    const resolved = resolveAnalysis(ai, 'sleep-feeding-analyzer');

    const output = {
      ...resolved,
      facts,
      ...advisoryFields(),
      provider_used: ai.provider_used,
    };
    if (ai.model) output.model = ai.model;
    if (ai.usage) output.usage = ai.usage;

    const saved = await saveAIResult(pool, {
      user_id: req.user && req.user.id,
      feature: 'sleep-feeding-analyzer',
      input: { sleep_logs: sleepLogs || [], feeding_logs: feedingLogs || [] },
      output: { analysis: resolved.analysis, facts },
      raw_text: ai.raw,
      model: ai.model || DEFAULT_MODEL,
    });
    if (saved) output.ai_result_id = saved.id;

    res.json(output);
  } catch (err) {
    console.error('sleep-feeding-analyzer error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze sleep/feeding logs.' });
  }
});

// ─── 4. POST /behavior-coach ─────────────────────────────────────────────────

const BEHAVIOR_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' You coach caregivers using ONLY safe, evidence-based, de-escalation-focused strategies. ' +
  'You must NOT recommend or describe punitive, shaming, or unsafe responses — including physical or ' +
  'corporal punishment, hitting, spanking, yelling, humiliation, withholding food/water/affection, ' +
  'physical restraint, or locking a child in a room. If asked for such methods, refuse and offer a safe ' +
  'alternative. Never diagnose.';

router.post('/behavior-coach', ...guards(), async (req, res) => {
  try {
    const { incidents, triggers } = req.body || {};
    if (!Array.isArray(incidents) || incidents.length === 0) {
      return res.status(400).json({ error: 'incidents must be a non-empty array.' });
    }
    if (triggers !== undefined && triggers !== null && !Array.isArray(triggers)) {
      return res.status(400).json({ error: 'triggers must be an array when provided.' });
    }

    const severityCounts = {};
    for (const inc of incidents) {
      if (inc && typeof inc === 'object' && inc.severity) {
        severityCounts[String(inc.severity)] = (severityCounts[String(inc.severity)] || 0) + 1;
      }
    }

    const facts = {
      incident_count: incidents.length,
      trigger_count: Array.isArray(triggers) ? triggers.length : 0,
      triggers: Array.isArray(triggers) ? triggers : [],
      severity_counts: severityCounts,
      generated_at: new Date().toISOString(),
    };

    const userPrompt =
      'Provide safe, de-escalation-focused coaching for the caregiver based on these behavioral incidents. ' +
      'Do NOT suggest any punitive or unsafe response. Do not invent details or numbers. ' +
      'Return strict JSON with keys: patterns (string[]), likely_triggers (string[]), ' +
      'de_escalation_steps (string[]), safe_responses (string[]), avoid (string[]), when_to_seek_help (string[]).\n\n' +
      `FACTS:\n${compactJson(facts, 2000)}\n\n` +
      `INCIDENTS:\n${compactJson(incidents, 4000)}`;

    const ai = await askModel(BEHAVIOR_SYSTEM_PROMPT, userPrompt, { max_tokens: Number(process.env.AI_MAX_TOKENS || 4000) });
    const resolved = resolveAnalysis(ai, 'behavior-coach');

    const output = {
      ...resolved,
      facts,
      ...advisoryFields(),
      provider_used: ai.provider_used,
    };
    if (ai.model) output.model = ai.model;
    if (ai.usage) output.usage = ai.usage;

    const saved = await saveAIResult(pool, {
      user_id: req.user && req.user.id,
      feature: 'behavior-coach',
      input: { incidents, triggers: Array.isArray(triggers) ? triggers : [] },
      output: { analysis: resolved.analysis, facts },
      raw_text: ai.raw,
      model: ai.model || DEFAULT_MODEL,
    });
    if (saved) output.ai_result_id = saved.id;

    res.json(output);
  } catch (err) {
    console.error('behavior-coach error:', err);
    res.status(500).json({ error: err.message || 'Failed to produce behavior coaching.' });
  }
});

// ─── 5. POST /growth-chart-analyzer ──────────────────────────────────────────

const GROWTH_METRICS = ['height_cm', 'weight_kg', 'head_circumference_cm'];

function summarizeGrowth(measurements) {
  const rows = measurements
    .map((m) => ({
      date: m && m.date,
      height_cm: m ? toNum(m.height_cm) : null,
      weight_kg: m ? toNum(m.weight_kg) : null,
      head_circumference_cm: m ? toNum(m.head_circumference_cm) : null,
    }))
    .filter((m) => m.date && Number.isFinite(new Date(m.date).getTime()))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const facts = {
    measurement_count: rows.length,
    date_range: rows.length ? { first: rows[0].date, last: rows[rows.length - 1].date } : null,
    metrics: {},
    percentiles: null,
    reference_curve_supplied: false,
    percentile_note: 'No reference curve was supplied, so percentile / percentile-rank values were not computed. No values are fabricated.',
    generated_at: new Date().toISOString(),
  };

  for (const metric of GROWTH_METRICS) {
    const points = rows.filter((r) => r[metric] !== null).map((r) => ({ date: r.date, value: r[metric] }));
    if (points.length === 0) {
      facts.metrics[metric] = null;
      continue;
    }
    const first = points[0];
    const last = points[points.length - 1];
    const delta = round(last.value - first.value);
    const months = monthsBetween(first.date, last.date);
    facts.metrics[metric] = {
      count: points.length,
      first: { date: first.date, value: first.value },
      last: { date: last.date, value: last.value },
      delta,
      rate_per_month: months !== null && months > 0.25 ? round(delta / months) : null,
      min: round(Math.min(...points.map((p) => p.value))),
      max: round(Math.max(...points.map((p) => p.value))),
    };
  }
  return { facts, rows };
}

router.post('/growth-chart-analyzer', ...guards(), async (req, res) => {
  try {
    const { child_id, measurements, reference_curve } = req.body || {};

    let series = measurements;
    if ((!Array.isArray(series) || series.length === 0) && child_id !== undefined && child_id !== null && child_id !== '') {
      const childId = Number(child_id);
      if (!Number.isInteger(childId) || childId <= 0) {
        return res.status(400).json({ error: 'child_id must be a positive integer when provided.' });
      }
      const childRes = await pool.query('SELECT id FROM children WHERE id = $1', [childId]);
      if (childRes.rows.length === 0) return res.status(404).json({ error: 'Child not found.' });
      try {
        const r = await pool.query(
          'SELECT measured_date, height_cm, weight_kg, head_circumference_cm FROM growth_records WHERE child_id = $1 ORDER BY measured_date ASC',
          [childId]
        );
        series = r.rows.map((row) => ({
          date: row.measured_date,
          height_cm: row.height_cm,
          weight_kg: row.weight_kg,
          head_circumference_cm: row.head_circumference_cm,
        }));
      } catch (_) {
        series = [];
      }
    }

    if (!Array.isArray(series) || series.length === 0) {
      return res.status(400).json({ error: 'measurements must be a non-empty array (or provide a child_id with growth_records).' });
    }
    if (series.some((m) => !m || typeof m !== 'object' || Array.isArray(m))) {
      return res.status(400).json({ error: 'Each measurement must be an object with at least a `date`.' });
    }

    const { facts, rows } = summarizeGrowth(series);
    if (facts.measurement_count === 0) {
      return res.status(400).json({ error: 'No measurement had a valid `date`; nothing to analyze.' });
    }
    facts.reference_curve_supplied = !!(reference_curve && typeof reference_curve === 'object');
    if (facts.reference_curve_supplied) {
      facts.percentile_note = 'A reference curve was supplied, but this endpoint does not implement reference-curve interpolation, so percentile values are not computed. No values are fabricated.';
    }

    const userPrompt =
      'Interpret the following deterministic growth series for a child. Use ONLY the supplied facts; ' +
      'do not invent percentiles or any numbers. Percentile values were NOT computed — say so explicitly. ' +
      'Return strict JSON with keys: growth_summary (string), trends (string[]), ' +
      'pediatrician_questions (string[]), when_to_consult (string[]).\n\n' +
      `FACTS:\n${compactJson(facts, 4000)}\n\n` +
      `SERIES:\n${compactJson(rows, 4000)}`;

    const ai = await askModel(SYSTEM_PROMPT, userPrompt, { max_tokens: Number(process.env.AI_MAX_TOKENS || 4000) });
    const resolved = resolveAnalysis(ai, 'growth-chart-analyzer');

    const output = {
      ...resolved,
      facts,
      ...advisoryFields(),
      provider_used: ai.provider_used,
    };
    if (ai.model) output.model = ai.model;
    if (ai.usage) output.usage = ai.usage;

    const saved = await saveAIResult(pool, {
      user_id: req.user && req.user.id,
      feature: 'growth-chart-analyzer',
      input: { child_id: child_id || null, measurements: series },
      output: { analysis: resolved.analysis, facts },
      raw_text: ai.raw,
      model: ai.model || DEFAULT_MODEL,
    });
    if (saved) output.ai_result_id = saved.id;

    res.json(output);
  } catch (err) {
    console.error('growth-chart-analyzer error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze growth measurements.' });
  }
});

// ─── 6. POST /pediatrician-handoff-pdf ───────────────────────────────────────

const PDF_LABEL = 'Generated summary for discussion with a clinician — not a medical record.';

let PDFDocument = null;
try {
  PDFDocument = require('pdfkit');
} catch (_) {
  // pdfkit not installed — fall back to structured JSON below.
}

function fmtDate(d) {
  if (!d) return 'N/A';
  const t = new Date(d);
  return Number.isFinite(t.getTime()) ? t.toISOString().slice(0, 10) : String(d);
}

router.post('/pediatrician-handoff-pdf', ...guards(), async (req, res) => {
  try {
    const { child_id, since } = req.body || {};

    if (child_id === undefined || child_id === null || child_id === '') {
      return res.status(400).json({ error: 'child_id is required.' });
    }
    const childId = Number(child_id);
    if (!Number.isInteger(childId) || childId <= 0) {
      return res.status(400).json({ error: 'child_id must be a positive integer.' });
    }
    let sinceDate = null;
    if (since !== undefined && since !== null && since !== '') {
      const t = new Date(since);
      if (!Number.isFinite(t.getTime())) {
        return res.status(400).json({ error: 'since must be a valid date when provided.' });
      }
      sinceDate = t.toISOString();
    }

    const childRes = await pool.query(
      'SELECT id, user_id, name, date_of_birth, gender, blood_type, allergies, notes FROM children WHERE id = $1',
      [childId]
    );
    if (childRes.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found.' });
    }
    const child = childRes.rows[0];

    const { data, facts } = await gatherChildRecords(childId, {
      since: sinceDate,
      tableNames: CHILD_TABLES.map((t) => t.name),
    });

    const summary = {
      label: PDF_LABEL,
      generated_at: new Date().toISOString(),
      since: sinceDate,
      child: {
        id: child.id,
        name: child.name,
        date_of_birth: child.date_of_birth,
        age_months: ageInMonths(child.date_of_birth),
        gender: child.gender,
        blood_type: child.blood_type,
        allergies: child.allergies,
      },
      counts: facts.counts,
      tables_used: facts.tables_used,
      tables_skipped: facts.tables_skipped,
      vaccinations: data.vaccinations || [],
      medications: data.medications || [],
      allergies: data.allergy_logs || [],
      recent_visits: data.appointments || [],
      milestones: data.milestones || [],
    };

    // Optional AI discussion prompts — never part of the deterministic record summary.
    const prompt =
      'List neutral, non-diagnostic questions a parent could ask a pediatrician at a handoff visit, ' +
      'based only on the supplied record summary. Do not invent numbers, results, or diagnoses. ' +
      'Return strict JSON with keys: questions_for_pediatrician (string[]), topics_to_discuss (string[]).\n\n' +
      `RECORD SUMMARY:\n${compactJson(summary, 5000)}`;
    const ai = await askModel(SYSTEM_PROMPT, prompt, { max_tokens: Number(process.env.AI_MAX_TOKENS || 4000) });
    const aiQuestions = ai.parsed && typeof ai.parsed === 'object' && !Array.isArray(ai.parsed)
      ? ai.parsed
      : null;

    const saved = await saveAIResult(pool, {
      user_id: req.user && req.user.id,
      feature: 'pediatrician-handoff-pdf',
      input: { child_id: childId, since: sinceDate },
      output: { summary, ai_questions: aiQuestions },
      raw_text: ai.raw,
      model: ai.model || DEFAULT_MODEL,
    });

    if (!PDFDocument) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Advisory', 'true');
      return res.json({
        ...summary,
        ai_questions: aiQuestions,
        parsed: !!aiQuestions,
        provider_used: ai.provider_used,
        ...advisoryFields(),
        note: 'PDF generation unavailable (pdfkit not installed); returning the structured deterministic record summary instead.',
        ai_result_id: saved ? saved.id : null,
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pediatrician_handoff_child_${childId}.pdf"`);
    res.setHeader('X-Advisory', 'true');
    res.setHeader('X-Provider-Used', String(ai.provider_used));

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(20).fillColor('#2c3e50').text('Pediatrician Handoff Summary', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#b00020').text(PDF_LABEL, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(12).fillColor('#333');
    doc.text(`Child: ${child.name}`);
    doc.text(`Date of birth: ${fmtDate(child.date_of_birth)}`);
    const age = ageInMonths(child.date_of_birth);
    if (age !== null) doc.text(`Age: ${age} months`);
    if (child.gender) doc.text(`Gender: ${child.gender}`);
    if (child.blood_type) doc.text(`Blood type: ${child.blood_type}`);
    if (child.allergies) doc.text(`Recorded allergies (free text): ${child.allergies}`);
    if (sinceDate) doc.text(`Records since: ${fmtDate(sinceDate)}`);
    doc.moveDown(1);

    const section = (title) => {
      doc.moveDown(0.6);
      doc.fontSize(14).fillColor('#2c3e50').text(title, { underline: true });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#333');
    };

    section('Vaccinations');
    if (!summary.vaccinations.length) doc.text('No vaccination records in range.');
    for (const v of summary.vaccinations) {
      doc.text(`• ${v.vaccine_name} (dose ${v.dose_number || 1}) — ${fmtDate(v.administered_date)}${v.next_due_date ? ` | next due ${fmtDate(v.next_due_date)}` : ''}`);
    }

    section('Medications');
    if (!summary.medications.length) doc.text('No medication records in range.');
    for (const m of summary.medications) {
      doc.text(`• ${m.name} ${m.dosage || ''} — ${m.frequency || 'frequency N/A'} | ${fmtDate(m.start_date)}${m.end_date ? ` → ${fmtDate(m.end_date)}` : ''}${m.prescribed_by ? ` | ${m.prescribed_by}` : ''}`);
    }

    section('Allergies');
    if (!summary.allergies.length) doc.text('No allergy-log records in range.');
    for (const a of summary.allergies) {
      doc.text(`• ${a.allergen} — severity ${a.severity || 'N/A'}${a.reaction ? ` | reaction: ${a.reaction}` : ''}${a.is_confirmed !== undefined ? ` | confirmed: ${a.is_confirmed}` : ''}`);
    }

    section('Recent visits');
    if (!summary.recent_visits.length) doc.text('No visit/appointment records in range.');
    for (const v of summary.recent_visits) {
      doc.text(`• ${fmtDate(v.appointment_date)} — ${v.title || 'Visit'}${v.provider ? ` (${v.provider})` : ''}${v.appointment_type ? ` | ${v.appointment_type}` : ''}${v.status ? ` | ${v.status}` : ''}`);
    }

    section('Milestones');
    if (!summary.milestones.length) doc.text('No milestone records in range.');
    for (const m of summary.milestones) {
      doc.text(`• ${m.title} — ${m.status || 'N/A'}${m.achieved_date ? ` (${fmtDate(m.achieved_date)})` : ''}`);
    }

    if (aiQuestions) {
      const pq = Array.isArray(aiQuestions.questions_for_pediatrician) ? aiQuestions.questions_for_pediatrician : [];
      const td = Array.isArray(aiQuestions.topics_to_discuss) ? aiQuestions.topics_to_discuss : [];
      section('Suggested questions for the pediatrician (AI-generated, informational)');
      for (const q of pq) doc.text(`• ${q}`);
      if (td.length) {
        doc.moveDown(0.3);
        doc.text('Topics to discuss:');
        for (const t of td) doc.text(`- ${t}`);
      }
    } else if (!ai.provider_used) {
      section('Suggested questions for the pediatrician (AI-generated, informational)');
      doc.text('AI provider was unavailable; no model-generated questions were included.');
    }

    doc.moveDown(1.5);
    doc.fontSize(9).fillColor('#7f8c8d').text(`${PDF_LABEL} ${ADVISORY}`, { align: 'center' });
    doc.end();
  } catch (err) {
    console.error('pediatrician-handoff-pdf error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Failed to generate handoff PDF.' });
    } else {
      res.end();
    }
  }
});

module.exports = router;
