import React from 'react';

function formatAIText(text) {
  if (!text) return '';

  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text*
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Headers: ### text
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Paragraphs: double newline
  html = html
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol')
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('');

  return html;
}

export default function AIOutput({ response, model, usage }) {
  if (!response) return null;

  return (
    <div className="ai-output">
      <div className="ai-output-header">
        <span className="ai-output-icon">🤖</span>
        <span className="ai-output-title">AI Insight</span>
      </div>
      <div
        className="ai-output-body"
        dangerouslySetInnerHTML={{ __html: formatAIText(response) }}
      />
      {(model || usage) && (
        <div className="ai-output-footer">
          {model && <span className="ai-output-model">Model: {model}</span>}
          {usage && (
            <span className="ai-output-usage">
              Tokens: {usage.prompt_tokens || 0} prompt / {usage.completion_tokens || 0} completion
            </span>
          )}
        </div>
      )}
    </div>
  );
}
