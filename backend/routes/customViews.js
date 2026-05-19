/*
 * Custom Views routes — Parent Views feature (childcare / parenting assistant)
 *
 * 4 synthesized endpoints:
 *   VIZ:     GET  /child-growth-chart   — dual-line height/weight series for charting
 *   VIZ:     GET  /milestone-timeline   — chronological milestone achievements timeline
 *   NON-VIZ: POST /developmental-report — structured developmental report payload (PDF on FE)
 *   NON-VIZ: POST /activity-planner     — multi-step wizard plan generator
 *
 * Read-only synthesis. Pulls child profiles from DB when available, falls back to a sample
 * child so endpoints succeed even on an empty DB. No DB writes.
 */
const express = require('express');
const auth = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
router.use(auth);

// ---- helpers ---------------------------------------------------------------
function monthsBetween(date) {
  const ms = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)));
}

async function getChildren(userId) {
  try {
    const r = await db.query(
      'SELECT id, name, date_of_birth, gender FROM children WHERE user_id = $1 ORDER BY id ASC',
      [userId]
    );
    return r.rows || [];
  } catch (e) {
    return [];
  }
}

function resolveChild(children, childIdParam) {
  return (
    children.find((c) => String(c.id) === String(childIdParam)) ||
    children[0] || {
      id: 0,
      name: 'Sample Child',
      date_of_birth: new Date(Date.now() - 18 * 30 * 86400000).toISOString(),
      gender: 'unspecified',
    }
  );
}

// Synthesized WHO-ish reference growth (illustrative only)
function syntheticGrowthSeries(ageMonths) {
  const points = [];
  const span = Math.max(ageMonths, 24);
  const step = Math.max(1, Math.ceil(span / 12));
  for (let m = 0; m <= span; m += step) {
    const heightCm = 50 + m * 1.4 - Math.pow(m / 50, 2) * 8;
    const weightKg = 3.3 + m * 0.32 - Math.pow(m / 60, 2) * 1.2;
    const headCm = 35 + m * 0.45 - Math.pow(m / 70, 2) * 1.5;
    points.push({
      age_months: m,
      height_cm: +heightCm.toFixed(1),
      weight_kg: +weightKg.toFixed(2),
      head_cm: +headCm.toFixed(1),
      percentile_height: 25 + ((m * 7) % 60),
      percentile_weight: 30 + ((m * 5) % 55),
    });
  }
  return points;
}

const MILESTONE_BANK = [
  { age_months: 2,  category: 'Motor',     title: 'Holds head steady',    description: 'Lifts head and chest during tummy time.' },
  { age_months: 4,  category: 'Social',    title: 'Smiles spontaneously', description: 'Smiles at people and reacts to faces.' },
  { age_months: 6,  category: 'Cognitive', title: 'Tracks objects',       description: 'Follows moving objects with eyes.' },
  { age_months: 9,  category: 'Motor',     title: 'Sits without support', description: 'Maintains seated position unaided.' },
  { age_months: 12, category: 'Language',  title: 'First words',          description: 'Says "mama" / "dada" with meaning.' },
  { age_months: 15, category: 'Motor',     title: 'Walks independently',  description: 'Takes several unaided steps.' },
  { age_months: 18, category: 'Language',  title: '10+ word vocabulary',  description: 'Uses single words to label items.' },
  { age_months: 24, category: 'Social',    title: 'Parallel play',        description: 'Plays alongside other children.' },
  { age_months: 30, category: 'Cognitive', title: 'Sorts by shape/color', description: 'Groups objects by attribute.' },
  { age_months: 36, category: 'Language',  title: 'Three-word sentences', description: 'Forms simple sentences in conversation.' },
];

function pickMilestones(ageMonths) {
  return MILESTONE_BANK.map((m) => ({
    ...m,
    status:
      m.age_months <= ageMonths
        ? 'achieved'
        : m.age_months <= ageMonths + 3
        ? 'in_progress'
        : 'upcoming',
    achieved_date:
      m.age_months <= ageMonths
        ? new Date(Date.now() - (ageMonths - m.age_months) * 30 * 86400000)
            .toISOString()
            .slice(0, 10)
        : null,
  }));
}

// ---- 1) VIZ: child growth dual-line chart (height / weight) ----------------
router.get('/child-growth-chart', async (req, res) => {
  try {
    const children = await getChildren(req.user.id);
    const target = resolveChild(children, req.query.child_id);
    const ageMonths = monthsBetween(target.date_of_birth);
    const series = syntheticGrowthSeries(ageMonths);
    return res.json({
      feature: 'child_growth_chart',
      child: { id: target.id, name: target.name, age_months: ageMonths },
      metrics: ['height_cm', 'weight_kg', 'head_cm'],
      series,
      latest: series[series.length - 1],
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'child-growth-chart failed', details: String(err.message || err) });
  }
});

// ---- 2) VIZ: milestone timeline -------------------------------------------
router.get('/milestone-timeline', async (req, res) => {
  try {
    const children = await getChildren(req.user.id);
    const target = resolveChild(children, req.query.child_id);
    const ageMonths = monthsBetween(target.date_of_birth);
    const milestones = pickMilestones(ageMonths);
    const achieved = milestones.filter((m) => m.status === 'achieved').length;
    return res.json({
      feature: 'milestone_timeline',
      child: { id: target.id, name: target.name, age_months: ageMonths },
      milestones,
      summary: {
        total: milestones.length,
        achieved,
        in_progress: milestones.filter((m) => m.status === 'in_progress').length,
        upcoming: milestones.filter((m) => m.status === 'upcoming').length,
        completion_pct: Math.round((achieved / milestones.length) * 100),
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'milestone-timeline failed', details: String(err.message || err) });
  }
});

// ---- 3) NON-VIZ: developmental report (consumed by jsPDF on FE) ------------
router.post('/developmental-report', async (req, res) => {
  try {
    const {
      child_id,
      include_sections = ['overview', 'growth', 'milestones', 'recommendations'],
    } = req.body || {};
    const children = await getChildren(req.user.id);
    const target = resolveChild(children, child_id);
    const ageMonths = monthsBetween(target.date_of_birth);
    const growth = syntheticGrowthSeries(ageMonths);
    const milestones = pickMilestones(ageMonths);

    const report = {
      title: `Developmental Report — ${target.name}`,
      child: {
        id: target.id,
        name: target.name,
        age_months: ageMonths,
        gender: target.gender || 'unspecified',
      },
      generated_at: new Date().toISOString(),
      sections: [],
    };

    if (include_sections.includes('overview')) {
      report.sections.push({
        heading: 'Overview',
        body: `${target.name} is ${ageMonths} months old. This report summarizes recent developmental indicators across motor, cognitive, language, and social domains.`,
      });
    }
    if (include_sections.includes('growth')) {
      const latest = growth[growth.length - 1];
      report.sections.push({
        heading: 'Growth Metrics',
        body: `Latest measurement: ${latest.height_cm}cm height, ${latest.weight_kg}kg weight, ${latest.head_cm}cm head circumference.`,
        data: growth.slice(-6),
      });
    }
    if (include_sections.includes('milestones')) {
      report.sections.push({
        heading: 'Milestone Progress',
        body: `${milestones.filter((m) => m.status === 'achieved').length} of ${milestones.length} reference milestones achieved.`,
        data: milestones.filter((m) => m.status !== 'upcoming'),
      });
    }
    if (include_sections.includes('recommendations')) {
      report.sections.push({
        heading: 'Recommendations',
        body: 'Continue regular pediatric checkups. Encourage age-appropriate play, reading, and social interaction. Track sleep and nutrition consistently.',
        items: [
          'Schedule next well-child visit',
          'Offer 30+ min reading time daily',
          'Maintain consistent sleep schedule',
          'Introduce age-appropriate fine-motor activities',
        ],
      });
    }

    return res.json({ feature: 'developmental_report', report });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'developmental-report failed', details: String(err.message || err) });
  }
});

// ---- 4) NON-VIZ: activity planner multi-step wizard ------------------------
router.post('/activity-planner', async (req, res) => {
  try {
    const {
      child_id,
      duration_minutes = 60,
      focus = 'cognitive', // motor | cognitive | language | social | mixed
      location = 'home',   // home | outdoor | park
      step = 'plan',       // intake | suggest | plan
    } = req.body || {};

    const children = await getChildren(req.user.id);
    const target = resolveChild(children, child_id);
    const ageMonths = monthsBetween(target.date_of_birth);

    const ACTIVITY_BANK = {
      motor:     ['Obstacle course', 'Ball toss', 'Dance freeze', 'Tunnel crawl', 'Balance beam walk'],
      cognitive: ['Shape sorting', 'Memory matching', 'Puzzle building', 'Pattern blocks', 'Counting game'],
      language:  ['Story reading', 'Rhyming game', 'Picture book chat', 'Sing-along', 'Word hunt'],
      social:    ['Pretend play', 'Role swap', 'Sharing circle', 'Turn-taking game', 'Helper role'],
      mixed:     ['Sensory bin', 'Art with story', 'Nature walk', 'Build-and-tell', 'Cooking helper'],
    };
    const bank = ACTIVITY_BANK[focus] || ACTIVITY_BANK.mixed;

    if (step === 'intake') {
      return res.json({
        feature: 'activity_planner',
        step: 'intake',
        next: 'suggest',
        options: {
          focus: Object.keys(ACTIVITY_BANK),
          location: ['home', 'outdoor', 'park'],
          duration_minutes: [15, 30, 45, 60, 90, 120],
        },
        child: { id: target.id, name: target.name, age_months: ageMonths },
      });
    }

    if (step === 'suggest') {
      return res.json({
        feature: 'activity_planner',
        step: 'suggest',
        next: 'plan',
        child: { id: target.id, name: target.name, age_months: ageMonths },
        suggestions: bank.map((a, i) => ({
          title: a,
          focus,
          location,
          est_minutes: Math.min(duration_minutes, [15, 20, 25, 30, 45][i % 5]),
        })),
      });
    }

    // step === 'plan' — synthesize a full plan
    const slots = [];
    let remaining = duration_minutes;
    let i = 0;
    while (remaining > 0 && i < 6) {
      const dur = Math.min(remaining, [15, 20, 25][i % 3]);
      slots.push({
        order: i + 1,
        title: bank[i % bank.length],
        focus,
        location,
        minutes: dur,
        notes: `Age-appropriate for ${ageMonths} months. Keep instructions simple.`,
      });
      remaining -= dur;
      i++;
    }

    return res.json({
      feature: 'activity_planner',
      step: 'plan',
      child: { id: target.id, name: target.name, age_months: ageMonths },
      plan: {
        focus,
        location,
        duration_minutes,
        total_minutes: slots.reduce((s, x) => s + x.minutes, 0),
        slots,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'activity-planner failed', details: String(err.message || err) });
  }
});

// health
router.get('/health', (req, res) =>
  res.json({ feature: 'custom_views', ok: true, endpoints: 4 })
);

module.exports = router;
