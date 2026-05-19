# Audit Note — AIChildcareParentingAssistant

Source: `_AUDIT/reports/batch_01.md` (Project 20)

## Maturity: PARTIAL-BUILD (9 routes, 4 AI endpoints, deps installed)

## Original audit recommendations

### Gaps & Opportunities
- Limited AI Coverage: expand AI to scheduling, optimization, forecasting, content generation.
- Missing Notifications: No notification system (email/SMS/push) for alerts/updates/engagement.

### Strategic Feature Suggestions
1. Agentic Workflow Orchestration.
2. RAG over Domain Documents.
3. Real-time Anomaly Detection.
4. White-label/Reseller Platform.

## Categorization
- **MECHANICAL:** None — the existing `routes/reminders.js` already implements activity reminders
  with nodemailer email dispatch (the audit's "missing notifications" gap is partially resolved).
  The CRUD coverage is extensive (children, milestones, activities, health, sleep, feeding,
  growth, vaccinations, behavior, journal, medications, appointments, ER contacts, learning,
  diaper, expenses, caregiver logs, daily routines, tooth, photos, chores, allergies, playdates,
  shopping). Adding more crud would be busywork.
- **NEEDS-PRODUCT-DECISION:** Agentic workflow, RAG, anomaly detection, white-label.

## Implementations applied
- None this round. Decision: existing reminders.js + extensive CRUD already addresses both
  "notifications" and the breadth audit suggested. Domain expansion (e.g., a `/health-trend`
  AI endpoint that synthesizes growth + sleep + feeding) requires product framing first.

## Backlog (prioritized)

### High priority
- **`POST /api/ai/health-trend`** — AI endpoint that ingests recent growth, sleep, feeding,
  vaccination records and generates a parental brief. Mechanical to add but needs prompt
  design and a clear safety disclaimer (medical advice).
- **Push notifications** layer on top of reminders (web push or FCM integration).

### Medium priority
- **Multi-child households** — current schema is child-scoped but a guardian dashboard
  should aggregate insights across siblings.
- **Caregiver portal** (white-label) — partner childcare facilities to share child data.

### Low priority
- RAG over pediatric guideline documents (CDC, WHO milestones); needs vector DB choice.
- Anomaly detection on growth curves (deviation > 2 SD).

## Apply pass 4 (mechanical backlog)

- **Action:** IMPLEMENTED (1 feature)
- **Features added:**
  1. **Health Trend Brief** — `POST /api/ai/health-trend`
     - BE: `backend/routes/aiNew.js` (new handler, reuses existing `runFeature` + `callOpenRouter` + `parseAIJson` + `saveAIResult`; explicit 503 when `OPENROUTER_API_KEY` is missing).
     - FE: `frontend/src/api.js` (added `aiFeatures.healthTrend`) + `frontend/src/pages/AIToolsPage.jsx` (new "Health Trend Brief" tool entry with `child_age` + 4 optional JSON fields). Reuses existing form/result/tabs UX.
     - JWT bearer applied automatically via `apiCall` (router mounts `/api/ai` behind `auth` middleware).
- **Backlog deferred:** Push notifications (NEEDS-CREDS — FCM/web-push), multi-child guardian dashboard (NEEDS-PRODUCT-DECISION), caregiver portal/white-label (NEEDS-PRODUCT-DECISION), pediatric-guideline RAG (NEEDS-PRODUCT-DECISION + vector store), growth anomaly detection (NEEDS-PRODUCT-DECISION).
- **Smoke test:** PASS — `node --check backend/routes/aiNew.js` + `node --check frontend/src/api.js` + `@babel/parser` (jsx) on `AIToolsPage.jsx`. Live HTTP: backend started on port 4000, login as `demo@childcare.com` returned 200 token, `POST /api/ai/health-trend` returned a structured JSON brief (verified). Backend stopped after test.
- **Notes:** No new dependencies. Disclaimer pattern reused from existing `runFeature` (MEDICAL_DISCLAIMER). Idempotent style match — no other files touched.

## Apply pass 3 (frontend)

- Action: **LEFT-AS-IS**.
- FE already wires all backend AI endpoints with JWT Bearer auth from `localStorage`:
  - `frontend/src/api.js` — `apiCall` helper sets `Authorization: Bearer ${token}`.
  - `pages/AIAdvisorPage.jsx` — `/api/ai/insight` + conversations.
  - `pages/AIToolsPage.jsx` — eight `aiNew.js` features (milestone-comparison, sleep-optimizer, nutrition-advisor, behavior-analyzer, illness-tracker, stress-monitor, screen-time-manager, sibling-harmony).
  - `pages/AIResultsPage.jsx` — list/delete results.
- Routes `/ai-advisor`, `/ai-tools`, `/ai-results` registered in `App.jsx` behind `ProtectedRoute`.
- 503-no-key handling: server returns 503 with message; FE surfaces it via thrown `apiCall` error.
- Idempotent — no FE files touched.
