import React, { useState, useEffect } from 'react';
import { fetchItems, getAIInsight } from '../api';
import AIOutput from '../components/AIOutput';

const TOPICS = [
  { value: 'milestones', label: 'Development Milestones' },
  { value: 'sleep', label: 'Sleep & Rest' },
  { value: 'nutrition', label: 'Nutrition & Feeding' },
  { value: 'behavior', label: 'Behavior & Emotions' },
  { value: 'health', label: 'Health & Wellness' },
  { value: 'activities', label: 'Activities & Play' },
  { value: 'general', label: 'General Parenting' },
];

export default function AIAdvisorPage() {
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [topic, setTopic] = useState('general');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchItems('/children')
      .then((data) => {
        const items = Array.isArray(data) ? data : data.data || data.items || [];
        setChildren(items);
        if (items.length > 0) setSelectedChild(items[0].id);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    try {
      const child = children.find((c) => String(c.id) === String(selectedChild));
      const context = child
        ? `Child: ${child.name}, DOB: ${child.date_of_birth}, Gender: ${child.gender || 'N/A'}`
        : 'No specific child selected';

      const data = await getAIInsight(topic, context, question);

      setHistory((prev) => [
        {
          id: Date.now(),
          question,
          topic,
          childName: child?.name || 'General',
          response: data.response || data.message || JSON.stringify(data),
          model: data.model,
          usage: data.usage,
        },
        ...prev,
      ]);
      setQuestion('');
    } catch (err) {
      setHistory((prev) => [
        {
          id: Date.now(),
          question,
          topic,
          childName: children.find((c) => String(c.id) === String(selectedChild))?.name || 'General',
          response: `Error: ${err.message}`,
          model: null,
          usage: null,
          isError: true,
        },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-icon">🤖</span>
          AI Parenting Advisor
        </h1>
        <p className="page-subtitle">
          Get personalized, AI-powered parenting advice and insights
        </p>
      </div>

      <div className="ai-advisor-layout">
        <div className="ai-advisor-form-card card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Child</label>
              <select
                className="form-input"
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
              >
                <option value="">No specific child</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Topic</label>
              <select
                className="form-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              >
                {TOPICS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Your Question</label>
              <textarea
                className="form-input form-textarea"
                rows={4}
                placeholder="Ask anything about parenting, child development, health, nutrition..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading || !question.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner-sm" /> Thinking...
                </>
              ) : (
                'Ask AI Advisor'
              )}
            </button>
          </form>
        </div>

        <div className="ai-advisor-responses">
          {history.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <h3>No conversations yet</h3>
              <p>Ask a question to get started with your AI parenting advisor</p>
            </div>
          )}

          {loading && (
            <div className="ai-loading-card card">
              <div className="spinner" />
              <p>AI is thinking...</p>
            </div>
          )}

          {history.map((entry) => (
            <div key={entry.id} className="ai-history-entry">
              <div className="ai-history-question">
                <div className="ai-history-meta">
                  <span className="badge badge-primary">{entry.topic}</span>
                  <span className="badge badge-secondary">{entry.childName}</span>
                </div>
                <p className="ai-history-q-text">{entry.question}</p>
              </div>
              {entry.isError ? (
                <div className="alert alert-danger">{entry.response}</div>
              ) : (
                <AIOutput
                  response={entry.response}
                  model={entry.model}
                  usage={entry.usage}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
