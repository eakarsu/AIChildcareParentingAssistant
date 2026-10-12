import React from 'react';
import AIResultView from './AIResultView';

/**
 * Renders advisor and record-insight responses with the same structured
 * presentation used by the dedicated AI tools. JSON strings (including fenced
 * model JSON) are unwrapped by AIResultView instead of appearing as raw text.
 */
export default function AIOutput({ response, model, usage }) {
  if (response === null || response === undefined || response === '') return null;

  const result = response && typeof response === 'object' && !Array.isArray(response)
    ? { ...response, model: response.model || model }
    : { analysis: response, model };

  return (
    <div className="ai-output">
      <AIResultView result={result} />
      {usage && (
        <div className="ai-output-footer">
          <span className="ai-output-usage">
            Tokens: {usage.prompt_tokens || 0} prompt / {usage.completion_tokens || 0} completion
          </span>
        </div>
      )}
    </div>
  );
}
