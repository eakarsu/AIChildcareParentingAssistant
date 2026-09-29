// === Content Library ===
// No service backs this page in this deployment; the form fills and Run explains why.
import React from 'react';
import AIFeatureForm from '../components/AIFeatureForm';

const TOOL = {
  "key": "contentLibrary",
  "label": "Library search",
  "description": "A curated library requires a content source to be configured.",
  "fields": [
    {
      "name": "query",
      "label": "Search the library",
      "type": "text",
      "example": "toddler sleep"
    },
    {
      "name": "age_months",
      "label": "Child age (months)",
      "type": "number",
      "optional": true,
      "example": "24"
    }
  ]
};

export default function NoContentLibraryArticlesVideosWithCurationPage() {
  return (
    <AIFeatureForm
      title="Content Library"
      intro="Curated articles and videos for parents."
      tool={TOOL}
      endpoint=""
      unavailable="No curated content source is configured for this deployment, so there is nothing to search yet."
    />
  );
}
