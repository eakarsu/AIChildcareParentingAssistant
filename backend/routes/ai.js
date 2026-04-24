const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

// POST /insight
router.post('/insight', async (req, res) => {
  try {
    const { feature, context, question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'A question is required.' });
    }

    const systemPrompt =
      'You are an expert pediatric advisor and child development specialist. ' +
      'Provide helpful, evidence-based advice about childcare and parenting. ' +
      'Be warm, supportive, and professional.';

    let userMessage = '';
    if (feature) {
      userMessage += `Topic area: ${feature}\n`;
    }
    if (context) {
      userMessage += `Context: ${JSON.stringify(context)}\n`;
    }
    userMessage += `Question: ${question}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Childcare Parenting Assistant',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', response.status, errorData);
      return res.status(502).json({ error: 'AI service temporarily unavailable.' });
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      return res.status(502).json({ error: 'No response from AI service.' });
    }

    res.json({
      response: data.choices[0].message.content,
      model: data.model,
      usage: data.usage || null,
    });
  } catch (err) {
    console.error('AI insight error:', err);
    res.status(500).json({ error: 'Failed to get AI insight.' });
  }
});

module.exports = router;
