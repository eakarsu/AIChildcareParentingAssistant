// Shared AI helpers: model standardization, parseAIJson 3-strategy, ai_results table.
const fetch = require('node-fetch');

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(systemPrompt, userPrompt, opts = {}) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  if (Array.isArray(userPrompt)) {
    messages.push(...userPrompt);
  } else {
    messages.push({ role: 'user', content: userPrompt });
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
      'X-Title': 'AI Childcare Parenting Assistant',
    },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODEL,
      messages,
      max_tokens: opts.max_tokens || 1500,
      temperature: opts.temperature ?? 0.7,
    }),
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${txt.slice(0, 500)}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

// 3-strategy JSON parser used across all AI endpoints
function parseAIJson(text) {
  if (!text || typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch (_) {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try { return JSON.parse(fenced[1].trim()); } catch (_) {}
  }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch (_) {}
  }
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch (_) {}
  }
  return null;
}

let aiResultsEnsured = false;
async function ensureAIResultsTable(pool) {
  if (aiResultsEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      feature VARCHAR(100) NOT NULL,
      input JSONB,
      output JSONB,
      raw_text TEXT,
      model VARCHAR(200),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ai_results_feature ON ai_results(feature);
    CREATE INDEX IF NOT EXISTS idx_ai_results_user ON ai_results(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_results_created_at ON ai_results(created_at DESC);
  `);
  aiResultsEnsured = true;
}

async function saveAIResult(pool, { user_id, feature, input, output, raw_text, model }) {
  try {
    await ensureAIResultsTable(pool);
    const result = await pool.query(
      `INSERT INTO ai_results (user_id, feature, input, output, raw_text, model)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [user_id || null, feature, JSON.stringify(input || {}), JSON.stringify(output || null), raw_text || null, model || DEFAULT_MODEL]
    );
    return result.rows[0];
  } catch (e) {
    console.warn('saveAIResult failed:', e.message);
    return null;
  }
}

module.exports = { callOpenRouter, parseAIJson, ensureAIResultsTable, saveAIResult, DEFAULT_MODEL };
