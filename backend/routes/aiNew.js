/**
 * New AI endpoints for AIChildcareParentingAssistant.
 * Persisted to ai_results JSONB. Uses parseAIJson 3-strategy.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const express = require('express');
const pool = require('../db');
const { aiLimiter } = require('../middleware/rateLimiter');
const { callOpenRouter, parseAIJson, saveAIResult, DEFAULT_MODEL } = require('../lib/aiHelpers');

const router = express.Router();

const SYSTEM_PROMPT =
  'You are an expert pediatric advisor and child development specialist. ' +
  'Provide helpful, evidence-based advice about childcare and parenting. ' +
  'Be warm, supportive, and professional. Always recommend consulting a pediatrician for medical concerns.';

const MEDICAL_DISCLAIMER =
  '\n\n*Note: This advice is for informational purposes only and does not constitute medical advice. ' +
  'Always consult your pediatrician for medical concerns.*';

router.use(aiLimiter);

async function runFeature(req, res, feature, prompt, extra = {}) {
  const data = await callOpenRouter(SYSTEM_PROMPT, prompt, { max_tokens: 1500 });
  const rawContent = data.choices[0].message.content;
  const analysis = parseAIJson(rawContent) || { raw: rawContent };

  const output = {
    analysis,
    disclaimer: MEDICAL_DISCLAIMER.trim(),
    model: data.model,
    usage: data.usage,
    ...extra,
  };

  await saveAIResult(pool, {
    user_id: req.user?.id,
    feature,
    input: req.body,
    output: { analysis, ...extra },
    raw_text: rawContent,
    model: data.model || DEFAULT_MODEL,
  });

  res.json(output);
}

// ─── POST /milestone-comparison ───────────────────────────────────────────────
router.post('/milestone-comparison', async (req, res) => {
  try {
    const { child_age_months, milestones_achieved } = req.body;

    if (child_age_months === undefined || child_age_months === null) {
      return res.status(400).json({ error: 'child_age_months is required.' });
    }
    if (!Array.isArray(milestones_achieved)) {
      return res.status(400).json({ error: 'milestones_achieved must be an array.' });
    }

    const prompt = `A child is ${child_age_months} months old. They have achieved the following milestones: ${milestones_achieved.join(', ') || 'none listed'}.

Compare these against CDC and WHO developmental milestone standards for a ${child_age_months}-month-old. Provide:
1. Expected milestones for this age (CDC/WHO standards)
2. Which milestones are on track
3. Which milestones may be delayed (not yet achieved)
4. Suggested interventions or activities for any delays
5. Overall developmental assessment
6. When to consult a pediatrician

Return as structured JSON with keys: expected_milestones, on_track, potential_delays, interventions, assessment, consult_if`;

    await runFeature(req, res, 'milestone-comparison', prompt);
  } catch (err) {
    console.error('milestone-comparison error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /sleep-optimizer ────────────────────────────────────────────────────
router.post('/sleep-optimizer', async (req, res) => {
  try {
    const { sleep_logs } = req.body;
    if (!Array.isArray(sleep_logs) || sleep_logs.length === 0) {
      return res.status(400).json({ error: 'sleep_logs array is required.' });
    }

    const logsText = JSON.stringify(sleep_logs, null, 2);
    const prompt = `Analyze these child sleep logs and provide:
1. Identified sleep patterns (consistent or irregular)
2. Recommended optimal bedtime and wake time
3. Detection of any sleep regressions
4. Sleep quality assessment
5. Actionable tips to improve sleep
6. Any concerning signs to discuss with a pediatrician

Sleep Logs:
${logsText}

Return as JSON with keys: patterns, recommended_bedtime, recommended_wake_time, regressions_detected, quality_assessment, tips, consult_signs`;

    await runFeature(req, res, 'sleep-optimizer', prompt);
  } catch (err) {
    console.error('sleep-optimizer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /nutrition-advisor ──────────────────────────────────────────────────
router.post('/nutrition-advisor', async (req, res) => {
  try {
    const { meals, child_age } = req.body;
    if (!Array.isArray(meals) || meals.length === 0) {
      return res.status(400).json({ error: 'meals array is required.' });
    }
    if (!child_age) {
      return res.status(400).json({ error: 'child_age is required.' });
    }

    const mealsText = JSON.stringify(meals, null, 2);
    const prompt = `Analyze this meal log for a ${child_age} child and provide:
1. Whether portions are age-appropriate
2. Nutritional balance assessment (proteins, carbs, fats, vitamins, minerals)
3. Potential allergen risks in the meals
4. Missing nutrients or food groups
5. Balanced meal suggestions for the next week
6. Foods to avoid at this age

Meals:
${mealsText}

Return as JSON with keys: age_appropriateness, nutritional_balance, allergen_risks, missing_nutrients, meal_suggestions, foods_to_avoid`;

    await runFeature(req, res, 'nutrition-advisor', prompt);
  } catch (err) {
    console.error('nutrition-advisor error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /behavior-analyzer ──────────────────────────────────────────────────
router.post('/behavior-analyzer', async (req, res) => {
  try {
    const { incidents, triggers } = req.body;
    if (!Array.isArray(incidents) || incidents.length === 0) {
      return res.status(400).json({ error: 'incidents array is required.' });
    }

    const incidentsText = JSON.stringify(incidents, null, 2);
    const triggersText = triggers ? JSON.stringify(triggers, null, 2) : 'Not specified';

    const prompt = `Analyze these child behavioral incidents and triggers:

Incidents:
${incidentsText}

Reported Triggers:
${triggersText}

Provide:
1. Detected behavioral patterns
2. Root cause analysis for each pattern
3. Suggested parental responses and strategies
4. Evidence-based techniques for behavior management
5. Signs of improvement to watch for
6. When professional support (therapist/pediatrician) may be warranted

Return as JSON with keys: patterns, root_causes, suggested_responses, techniques, improvement_signs, professional_referral_signs`;

    await runFeature(req, res, 'behavior-analyzer', prompt);
  } catch (err) {
    console.error('behavior-analyzer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /illness-tracker ────────────────────────────────────────────────────
router.post('/illness-tracker', async (req, res) => {
  try {
    const { symptoms, child_age } = req.body;
    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ error: 'symptoms array is required.' });
    }
    if (!child_age) {
      return res.status(400).json({ error: 'child_age is required.' });
    }

    const symptomsText = symptoms.join(', ');
    const prompt = `A ${child_age} child has the following symptoms: ${symptomsText}

Provide:
1. Possible common conditions these symptoms may indicate (NOT a diagnosis)
2. Safe home care suggestions for each symptom
3. Clear signs that require immediate emergency care (call 911)
4. Signs that require a same-day doctor visit
5. Signs that require a doctor appointment within a few days
6. General comfort measures
7. What to monitor at home

Important: Emphasize strongly that this is NOT a diagnosis and a pediatrician must be consulted.

Return as JSON with keys: possible_conditions, home_care, emergency_signs, same_day_doctor, routine_doctor, comfort_measures, monitor_at_home`;

    const data = await callOpenRouter(SYSTEM_PROMPT, prompt, { max_tokens: 1500 });
    const rawContent = data.choices[0].message.content;
    const analysis = parseAIJson(rawContent) || { raw: rawContent };
    const strongDisclaimer = '\n\n**IMPORTANT: This information is for general guidance only and does NOT constitute a medical diagnosis or treatment plan. Always consult your pediatrician or seek emergency care if you are concerned about your child\'s health. When in doubt, call your doctor.**';

    const output = {
      analysis,
      disclaimer: strongDisclaimer,
      model: data.model,
      usage: data.usage,
    };

    await saveAIResult(pool, {
      user_id: req.user?.id,
      feature: 'illness-tracker',
      input: req.body,
      output: { analysis },
      raw_text: rawContent,
      model: data.model || DEFAULT_MODEL,
    });

    res.json(output);
  } catch (err) {
    console.error('illness-tracker error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /stress-monitor ─────────────────────────────────────────────────────
router.post('/stress-monitor', async (req, res) => {
  try {
    const { parent_mood_logs } = req.body;
    if (!Array.isArray(parent_mood_logs) || parent_mood_logs.length === 0) {
      return res.status(400).json({ error: 'parent_mood_logs array is required.' });
    }

    const logsText = JSON.stringify(parent_mood_logs, null, 2);
    const prompt = `Analyze these parent mood/stress logs with empathy and professional care:

${logsText}

Provide:
1. Overall stress/mood assessment
2. Identified stress patterns or triggers
3. Personalized self-care suggestions (practical, actionable)
4. Signs that may indicate postpartum depression or anxiety (if applicable)
5. Recommended professional resources and support services
6. Immediate coping strategies for difficult moments
7. Positive affirmations and encouragement

Be warm, non-judgmental, and supportive. Parenting is hard.

Return as JSON with keys: mood_assessment, stress_patterns, self_care_suggestions, ppd_signs, resources, coping_strategies, affirmations`;

    const crisis_resources = {
      postpartum_support_international: '1-800-944-4773',
      national_crisis_line: '988 (call or text)',
      note: 'If you are in crisis or having thoughts of self-harm, please call 988 or go to your nearest emergency room.',
    };

    await runFeature(req, res, 'stress-monitor', prompt, { crisis_resources });
  } catch (err) {
    console.error('stress-monitor error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /screen-time-manager (audit feature #5) ────────────────────────────
router.post('/screen-time-manager', async (req, res) => {
  try {
    const { daily_usage, child_age } = req.body;
    if (!daily_usage || !Array.isArray(daily_usage)) {
      return res.status(400).json({ error: 'daily_usage array is required.' });
    }
    if (!child_age) return res.status(400).json({ error: 'child_age is required.' });

    const prompt = `For a ${child_age} child, analyze the following daily screen-time usage:

${JSON.stringify(daily_usage, null, 2)}

Return JSON with keys: weekly_total_hours, age_appropriate_limits, balanced_alternative_activities (array of 5), educational_recommendations (array of 5 by age), warning_signs_of_overuse, family_screen_rules`;

    await runFeature(req, res, 'screen-time-manager', prompt);
  } catch (err) {
    console.error('screen-time-manager error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /health-trend (apply pass 4: parental health brief) ────────────────
router.post('/health-trend', async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({
        error: 'AI not configured. Set OPENROUTER_API_KEY in backend .env.',
      });
    }
    const { child_age, growth, sleep, feeding, vaccinations } = req.body || {};
    if (!child_age) {
      return res.status(400).json({ error: 'child_age is required.' });
    }

    const prompt = `Synthesize a parental health brief for a ${child_age}-old child using the records below.

Growth records: ${growth ? JSON.stringify(growth) : 'none'}
Sleep records: ${sleep ? JSON.stringify(sleep) : 'none'}
Feeding records: ${feeding ? JSON.stringify(feeding) : 'none'}
Vaccinations: ${vaccinations ? JSON.stringify(vaccinations) : 'none'}

Return JSON with keys: summary, growth_trend, sleep_trend, feeding_trend, vaccination_status, positive_signs, watchpoints, suggested_questions_for_pediatrician, when_to_consult.
This is informational, NOT medical advice.`;

    await runFeature(req, res, 'health-trend', prompt);
  } catch (err) {
    console.error('health-trend error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /sibling-harmony (audit feature #6) ────────────────────────────────
router.post('/sibling-harmony', async (req, res) => {
  try {
    const { children, recent_conflicts } = req.body;
    if (!Array.isArray(children) || children.length < 2) {
      return res.status(400).json({ error: 'children array (at least 2) is required.' });
    }

    const prompt = `Develop sibling harmony recommendations for the following children: ${JSON.stringify(children, null, 2)}.
Recent conflicts (if any): ${recent_conflicts ? JSON.stringify(recent_conflicts) : 'None reported'}.

Return JSON with keys: shared_activities (array of 5), conflict_reduction_tips, fairness_strategies, individual_attention_schedule (per child), bonding_rituals, when_to_intervene_vs_let_them_resolve`;

    await runFeature(req, res, 'sibling-harmony', prompt);
  } catch (err) {
    console.error('sibling-harmony error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
