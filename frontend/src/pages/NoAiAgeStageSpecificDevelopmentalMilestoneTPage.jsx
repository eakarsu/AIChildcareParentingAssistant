// === AI age-stage-specific developmental milestone tracker ===
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  key: 'milestoneGapAdvisor',
  label: 'Milestone Gap Advisor',
  description:
    'Age-appropriate expectations, any gaps against what you report, next steps, and questions to raise with your pediatrician.',
  fields: [
    { name: 'child_age_months', label: 'Child age (months)', type: 'number', example: '24' },
    {
      name: 'milestones_achieved',
      label: 'Milestones achieved (comma-separated)',
      type: 'list',
      example: 'walks, runs, says 20 words, stacks 4 blocks, follows two-step instructions',
    },
  ],
};

export default function NoAiAgeStageSpecificDevelopmentalMilestoneTPage() {
  return (
    <AIFeatureForm
      title="Developmental Milestone Tracker"
      intro="Compare achieved milestones against typical expectations for the child's age."
      tool={TOOL}
      endpoint="/api/ai/milestone-gap-advisor"
      resultMode="ai"
    />
  );
}
