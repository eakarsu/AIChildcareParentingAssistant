# Anna App port: scoping plan

**Source app:** `AIChildcareParentingAssistant` (live at https://parent.family)
**Target:** one submittable Anna App — the **Sitter Handoff Summary**
**Purpose:** give a realistic, verified effort estimate before any code is written.

Everything below is based on Anna's own published docs, read on 2026-09-30:

- `/developers/apps/app-quickstart.md`, `app-manifest.md`, `app-ui-manifest.md`
- `/developers/apps/app-ui-bundle.md`, `app-ui-sdk.md`, `app-ui-overview.md`
- `/developers/apps/llm-and-agent.md`, `app-mobile.md`
- `/developers/reference/host-api-storage.md`

---

## 1. Recommendation

**Port one feature, not the whole app.** Ship the *Sitter Handoff Summary* as a
standalone Anna App first.

Why this feature:

| Criterion Anna requires | How the handoff summary satisfies it |
|---|---|
| "AI-Native Core — primary value must depend on AI reasoning" | The value *is* the summarisation; it isn't a CRUD list with a chatbot bolted on |
| "Successfully performs its declared core task… meaningful, non-trivial result" | It reads records and produces a sitter brief — satisfies *Qualified App Run* |
| Small state surface | One child profile + a handful of records → maps cleanly onto APS key-value |
| Already built and proven | `backend/routes/aiChildcare.js` line 251, plus the UI in `AIFeatureForm` |

Porting all 24 features first is the mistake to avoid: the 200-MAU threshold is
the real risk, and it applies equally to a one-feature app.

---

## 2. What survives and what is rewritten

### Survives (reusable)

- **The React UI pattern** — `AIFeatureForm.jsx`, `AIResultView.jsx`,
  `KeyValueResult.jsx`. The Vite build output is already a static SPA, which is
  exactly what Anna's bundle format wants.
- **The prompt engineering** — the system prompt, the "use ONLY the supplied
  facts / say *not recorded*" instruction, the strict-JSON response contract,
  and the advisory/medical-disclaimer discipline. This is genuinely the hard-won
  part and it ports verbatim.
- **The deterministic helpers** — `ageInMonths`, `trendDirection`, `avg`,
  `round`, `buildHandoffFallback`. Pure functions, no server needed.
- **The `AIResultView` rendering** — including the fenced-JSON unwrapping and
  truncated-JSON salvage. Keep it; Anna returns model text the same way.

### Rewritten (not portable)

| Current | Anna equivalent | Notes |
|---|---|---|
| Express server (`backend/server.js`) | **Nothing** — you ship no server | Hard removal |
| 33 route files | Host API calls from the iframe | Only ~4 endpoints matter for this feature |
| `pg` direct queries (18 files) | `anna.storage.*` (APS) | No SQL, no schema, no migrations |
| PostgreSQL, 29 tables | APS key-value + objects | Remodel as JSON documents |
| JWT auth, `users`, login | Anna user accounts | Remove entirely |
| `callOpenRouter` + OpenRouter key | `anna.llm.complete()` | Anna bills it; no key to manage |
| Sidebar / app shell / router | Anna window chrome (`views`) | Delete your own shell |
| File uploads | `host.upload` → R2 presigned URL | Only if you add photos later |

**Headline:** the frontend and the prompts survive; the backend and database do not.

---

## 3. Effort estimate

| Workstream | Effort | Notes |
|---|---|---|
| Scaffold with `anna-app init` | **0.5 h** | CLI does this; `minimal` template is valid out of the box |
| Move Vite build into `bundle/` | **1–2 h** | Point the SDK at it; drop `react-router-dom`, single view |
| Replace storage layer | **3–5 h** | Lower than first estimated — `gatherChildRecords` does no aggregation (see §4) |
| Replace LLM call | **1 h** | `anna.llm.complete` replaces `callOpenRouter` |
| Manifest + listing metadata | **1–2 h** | `manifest.json`, `app.json` |
| Strip auth/shell/sidebar | **2–3 h** | Mostly deletion |
| Local harness iteration (`anna-app dev`) | **2–4 h** | Getting the iframe bridge working first time |
| Review fixes after submission | **2–6 h** | Assume 3–5 business days, expect at least one round |

**Realistic total: 2–3 focused days** for a first submittable version.
The storage port is lighter than feared because the handoff path does no SQL
aggregation; the unknown is the first-time harness setup, not the rewrite.

### If you later port more features

The cost curve rises sharply on the **Reports** feature, which contains 23 SQL
aggregates (`COUNT`/`SUM`/`GROUP BY`, date windows, percentiles). Reimplementing
those over APS `list`+`get` is genuinely expensive and is the reason to ship the
handoff summary alone first.


---

## 4. The storage remodelling (the actual work)

Today the feature reads real tables. Anna has no SQL — only a per-`(user, App)`
JSON key-value bucket.

**Current reads** (`gatherChildRecords` over `HANDOFF_TABLES`): children,
milestones, medications, allergy_logs, appointments, sleep_records,
feeding_records, diaper_records, behavioral_notes.

**Proposed APS key layout** (stable prefixes so `storage.list({prefix})` works):

```
profile/main                 → { name, dob, gender, blood_type, allergies }
profile/notes                → free text
milestones/<id>              → { title, achieved_date, category, status }
medications/<id>             → { name, dosage, frequency, start_date }
allergies/<id>               → { allergen, severity, notes }
appointments/<id>            → { title, provider, when, status }
logs/sleep/<id>              → { date, sleep_start, sleep_end, quality }
logs/feeding/<id>            → { meal, foods, calories }
logs/diaper/<id>             → { time, type }
notes/behavior/<id>          → { date, behavior, mood, severity }
imports/last-summary         → cached last generated brief
```

**Manifest grants required** (`manifest.ui.host_api`):

```json
{
  "storage": ["get", "set", "delete", "list"],
  "llm":     ["complete"]
}
```

The default `(scope: "app", owner: "self")` bucket needs **no extra capability
strings** — only `host_capabilities` for non-default scopes. Keep it simple and
stay on the default bucket.

**Rules to respect** (from `host-api-storage.md`):
- Keys ≤1024 chars, ≤128 per `/`-segment; no leading `/`, no `.`/`..`
- Always branch on `cur.exists`, **never** on `cur.value` — `null` is a legal stored value
- Use `if_match` with the returned `etag` for optimistic concurrency
- `storage.list` returns metadata only (no values) and pages with an opaque `cursor`
- Page/aggregate in the client; there is no GROUP BY

**Effort driver (corrected after reading the code):** this is better than
expected. `gatherChildRecords` does **no** SQL aggregation — it runs
`SELECT <cols> FROM <table> WHERE child_id = $1 ORDER BY <date> DESC LIMIT 25`
per table, plus one `COUNT(*)` purely as an existence/non-empty check. There is
**no GROUP BY, no SUM, no date-window maths** in the handoff path.

That means the storage port is close to a 1:1 mapping:

| Current | APS equivalent |
|---|---|
| `SELECT cols FROM medications WHERE child_id=$1 LIMIT 25` | `storage.list({prefix:'medications/'})` → `get` each |
| `SELECT COUNT(*)` existence probe | the `items.length` from `list` |
| `INSERT INTO medications (...)` | `storage.set({key:'medications/<id>'})` |
| `UPDATE ... WHERE id=$1` | `set` with `if_match: etag` |
| `DELETE FROM ... WHERE id=$1` | `storage.delete` |

Client-side sorting by `dateCol` replaces `ORDER BY`. That is a few lines per
table, because `CHILD_TABLES` already declares `columns` and `dateCol` for each
of the 9 tables — reuse that table as the source of truth in the port.

The heavier aggregate work (23 aggregates in `reports.js`) belongs to the
*Reports* features, **not** to the handoff summary. Those only matter if you port
more than the first feature.


---

## 5. Concrete port plan

### Step 1 — Scaffold (0.5 h)

```bash
npm i -g @anna-ai/cli
curl -LsSf https://astral.sh/uv/install.sh | sh   # one-time
anna-app doctor
anna-app init childcare-handoff --slug childcare-handoff
cd childcare-handoff
anna-app dev            # confirm the harness runs before adding code
```

Produces: `manifest.json`, `app.json`, `bundle/`, `executas/`.

### Step 2 — Reuse the UI (1–2 h)

- Build the existing React app into `bundle/` (Vite `outDir` → `bundle/assets`)
- Remove `react-router-dom` and the sidebar — one view only
- In `bundle/index.html`, import the host SDK:

```html
<script type="module">
  import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";
  const anna = await AnnaAppRuntime.connect();
  window.__anna = anna;
</script>
```

- `AIFeatureForm` stops calling `fetch('/api/...')` and calls `anna.llm.complete` instead

### Step 3 — Swap storage for APS (3–5 h)

```js
// read everything for this user
const keys = await anna.storage.list({ prefix: "medications/" });
const meds = await Promise.all(
  keys.items.map(k => anna.storage.get({ key: k.key }).then(r => r.value))
);

// write
await anna.storage.set({ key: `profile/main`, value: profile });
```

Port the deterministic helpers unchanged. Remove `gatherChildRecords`' SQL and reimplement it over `list` + `get`.

### Step 4 — Swap the LLM (1 h)

```js
const reply = await anna.llm.complete({
  messages: [{ role: "user", content: { type: "text", text: userPrompt } }],
});
```

Keep: the system prompt, the facts-first separation, the strict-JSON contract, the
`parseAIJson` + fence-strip + truncation-salvage logic, and the advisory text.

### Step 5 — Manifest (1–2 h)

`schema: 2`, `ui.views` with one `main` view, `host_api.storage` + `host_api.llm`,
plus `form_factors: ["desktop", "mobile"]` — see §6.

### Step 6 — Local test, then submit (2–4 h + review)

`anna-app dev`, then push through the Developer Console. Review is stated at 3–5
business days; expect one round of fixes.

---

## 6. Decisions to make before starting

1. **Declare mobile?** `form_factors: ["desktop", "mobile"]` puts you in the Anna
   mobile launcher — a much larger pool of potential MAU for a sitter-facing app.
   Your UI is already responsive. **Recommend yes.**
2. **Keep the deterministic facts block?** Anna's review rewards "AI-Native Core",
   but your facts-first design is also what makes the output trustworthy.
   **Recommend keeping it** — it's a differentiator, not a liability.
3. **One feature or more at launch?** Review rejects "simple clones" and
   "placeholder" content but does not require breadth. **Recommend one polished
   feature** and add the others only after 200 MAU is proven.

---

## 7. Risks and open questions

| Risk | Severity | Mitigation |
|---|---|---|
| **200 MAU to earn anything at all** | **High** | The real risk. You have no Anna audience today. Requires genuine distribution — the grant table starts at $50/mo for 200 MAU |
| No SQL aggregates | Low | The handoff path has none; client-side sort over `list`/`get`. Reports would be expensive if ported |
| Legacy 256 KiB bucket cap on fallback path | Low–Medium | Stay on the APS path; keep documents small and paginate |
| Review rejects "not AI-native" | Low | The handoff summary is genuinely AI-core |
| Grant is **not** guaranteed by invitation | High | Isabel states this explicitly; eligibility is assessed after publish |
| "70% token revenue share" appears in the email but **not** in the published program rules | Medium | **Ask for it in writing before porting** |
| "Official Program Rules" link | Medium | Ask for the direct, stable URL before committing |
| Unpaid-grant forfeiture on disqualification | Medium | Read §10 of the program rules carefully before submitting |

---

## 8. Bottom line

- **Effort:** 2–3 focused days for one submittable feature.
- **Cost to you:** the backend is thrown away; the UI and prompts are kept.
- **Upside:** $50–$100/month at 200–500 MAU, with real distribution work.
- **Downside:** if you never reach 200 Anna users, **you earn $0** and the port
  effort is unrecovered.

**Suggested first move:** spend 2–3 hours on Steps 1–2 only (`anna-app init` +
`anna-app dev` + get the existing UI rendering inside the Anna harness). That
answers the only question that matters — whether the developer experience works
for you — before investing days in the storage rewrite.
