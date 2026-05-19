require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const express = require('express');
const pool = require('../db');
const { aiLimiter } = require('../middleware/rateLimiter');
const { callOpenRouter, saveAIResult, DEFAULT_MODEL } = require('../lib/aiHelpers');

const router = express.Router();

const SYSTEM_PROMPT =
  'You are an expert pediatric advisor and child development specialist. ' +
  'Provide helpful, evidence-based advice about childcare and parenting. ' +
  'Be warm, supportive, and professional. Always recommend consulting a pediatrician for medical concerns.';

const MEDICAL_DISCLAIMER =
  '\n\n*Note: This advice is for informational purposes only and does not constitute medical advice. ' +
  'Always consult your pediatrician for medical concerns.*';

// Apply rate limiter to all AI routes
router.use(aiLimiter);

// ─── POST /insight - General AI insight (existing endpoint) ───────────────────
router.post('/insight', async (req, res) => {
  try {
    const { feature, context, question, conversation_id } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'A question is required.' });
    }

    let priorMessages = [];
    if (conversation_id) {
      try {
        await ensureConversationTables();
        const historyResult = await pool.query(
          `SELECT role, content FROM ai_messages
           WHERE conversation_id = $1
           ORDER BY created_at DESC
           LIMIT 10`,
          [conversation_id]
        );
        priorMessages = historyResult.rows.reverse().map(m => ({ role: m.role, content: m.content }));
      } catch (histErr) {
        console.error('Failed to load conversation history for insight:', histErr.message);
      }
    }

    let userMessage = '';
    if (feature) userMessage += `Topic area: ${feature}\n`;
    if (context) userMessage += `Context: ${JSON.stringify(context)}\n`;
    userMessage += `Question: ${question}`;

    const messages = [...priorMessages, { role: 'user', content: userMessage }];
    const data = await callOpenRouter(SYSTEM_PROMPT, messages, { max_tokens: 1024 });
    const responseText = data.choices[0].message.content + MEDICAL_DISCLAIMER;

    const output = {
      response: responseText,
      model: data.model,
      usage: data.usage || null,
      conversation_id: conversation_id || null,
    };

    await saveAIResult(pool, {
      user_id: req.user?.id,
      feature: 'insight',
      input: { feature, question, conversation_id },
      output,
      raw_text: data.choices[0].message.content,
      model: data.model || DEFAULT_MODEL,
    });

    res.json(output);
  } catch (err) {
    console.error('AI insight error:', err);
    res.status(500).json({ error: err.message || 'Failed to get AI insight.' });
  }
});

// ─── Conversation History ─────────────────────────────────────────────────────

async function ensureConversationTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      child_id INTEGER,
      title VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// POST /conversations - Start new conversation
router.post('/conversations', async (req, res) => {
  try {
    await ensureConversationTables();
    const { child_id, title } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const result = await pool.query(
      `INSERT INTO ai_conversations (user_id, child_id, title, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *`,
      [userId, child_id || null, title || 'New Conversation']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('create conversation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /conversations - List user's conversations (paginated)
router.get('/conversations', async (req, res) => {
  try {
    await ensureConversationTables();
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      pool.query(
        `SELECT ac.*, ch.name as child_name
         FROM ai_conversations ac
         LEFT JOIN children ch ON ac.child_id = ch.id
         WHERE ac.user_id = $1
         ORDER BY ac.updated_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query('SELECT COUNT(*) FROM ai_conversations WHERE user_id = $1', [userId]),
    ]);
    const total = parseInt(count.rows[0].count);
    res.json({
      data: data.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('list conversations error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /conversations/:id/message - Send message with history context
router.post('/conversations/:id/message', async (req, res) => {
  try {
    await ensureConversationTables();
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!content) return res.status(400).json({ error: 'content is required.' });
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const convResult = await pool.query(
      'SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const historyResult = await pool.query(
      `SELECT role, content FROM ai_messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [id]
    );
    const priorMessages = historyResult.rows.reverse();

    await pool.query(
      'INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [id, 'user', content]
    );

    const messages = [
      ...priorMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ];

    const data = await callOpenRouter(SYSTEM_PROMPT, messages, { max_tokens: 1024 });
    const assistantContent = data.choices[0].message.content + MEDICAL_DISCLAIMER;

    const savedMsg = await pool.query(
      'INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [id, 'assistant', assistantContent]
    );

    await pool.query('UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1', [id]);

    await saveAIResult(pool, {
      user_id: userId,
      feature: 'conversation-message',
      input: { conversation_id: id, content },
      output: { response: assistantContent },
      raw_text: data.choices[0].message.content,
      model: data.model || DEFAULT_MODEL,
    });

    res.json({
      message: savedMsg.rows[0],
      response: assistantContent,
      model: data.model,
      usage: data.usage || null,
    });
  } catch (err) {
    console.error('conversation message error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
