# Tournament Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive, searchable Explorer modal backed exclusively by curated Bento tournament and F1 schedule data.

**Architecture:** A server-only catalog service calls the Bento tournaments client, enriches candidate tournaments with bracket stages or F1 rounds, and normalizes them into a stable read-only model. A focused frontend module handles fetching, search, filters, and ordering; a dedicated React component owns modal state and accessibility while `App` only owns the navbar trigger and focus return.

**Tech Stack:** React 19, Vite 6, Node test runner, `@bento.fun/sdk`, existing CSS design system.

## Global Constraints

- Never expose the Bento Builder API key to browser code.
- Never use localStorage, hard-coded tournaments, mock records, invented teams, or invented dates in Explorer.
- Exclude canceled, discarded, E2E, SDK, test, demo, mock, malformed, and date-stale records.
- F1 and football tournament interactions remain read-only discovery in this implementation.
- Dates come only from Bento tournament stages, fixtures, F1 rounds, and F1 events.
- Preserve all existing uncommitted source changes.

---

### Task 1: Curated Server Catalog

**Files:**
- Create: `api/_explorer.js`
- Create: `api/_explorer.test.js`
- Modify: `api/_bento.js`

**Interfaces:**
- Consumes: `sdk.tournaments.tournaments.list`, `sdk.tournaments.tournaments.getById`, and `sdk.tournaments.f1.listRounds`.
- Produces: `buildExplorerCatalog({ tournaments, loadTournament, loadF1Rounds, now, concurrency }) -> Promise<ExplorerItem[]>` and `fetchBentoExplorer({ now }) -> Promise<{ items: ExplorerItem[] }>`.

- [ ] **Step 1: Write failing catalog tests**

Cover exclusion of canceled/test/malformed records, completed tournament preservation, stale-live exclusion, football stage date extraction, F1 next-race extraction, and date ordering with fixed `now = Date.parse('2026-07-27T00:00:00Z')`.

```js
test("curates football and F1 records without test or stale data", async () => {
  const items = await buildExplorerCatalog({
    tournaments: [realFootball, e2eFootball, completedFootball, f1Season],
    loadTournament: async (id) => detailsById[id],
    loadF1Rounds: async () => ({ rounds: f1Rounds }),
    now,
  });
  assert.deepEqual(items.map((item) => item.name), ["F1 2026 Grid Predictor", "World Cup Tournament"]);
  assert.equal(items[0].nextEvent.gpName, "Dutch Grand Prix");
  assert.equal(items[1].status, "ended");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test api/_explorer.test.js`

Expected: FAIL because `api/_explorer.js` does not exist.

- [ ] **Step 3: Implement pure normalization and enrichment**

Implement:

```js
export async function buildExplorerCatalog({ tournaments, loadTournament, loadF1Rounds, now = Date.now(), concurrency = 4 })
export function normalizeExplorerTournament(row, enrichment, now = Date.now())
export function isExplorerCandidate(row)
```

Use a bounded worker loop. Treat `COMPLETED`, `SETTLED`, `ENDED`, and `RESOLVED` as ended; exclude canceled/discarded statuses. Normalize F1 rounds from `rounds`, bracket stages from `stages`, and markets/fixtures nested in stages. Choose the earliest future event as `nextEvent`; use real start/end windows for `live`; reject source-live records whose authoritative dates are entirely past. Build `searchText` from API-provided names, league, sport, teams, Grand Prix, circuit, and country.

- [ ] **Step 4: Add the SDK-backed catalog function**

In `api/_bento.js`, verify `tournamentsBaseUrl`, instantiate the existing server SDK, call `tournaments.list({ limit: 100, offset: 0 })`, and pass loaders into `buildExplorerCatalog`. Throw an exposed `503` when the tournaments host is absent.

- [ ] **Step 5: Run focused and existing server tests**

Run: `node --test api/_explorer.test.js api/_bento.test.js`

Expected: all tests pass with no warnings.

### Task 2: Explorer API Route

**Files:**
- Create: `api/explorer.js`
- Modify: `vite.config.js`
- Test: `api/_explorer.test.js`

**Interfaces:**
- Consumes: `fetchBentoExplorer({ now })`.
- Produces: `GET /api/explorer -> { items: ExplorerItem[] }` with `Cache-Control: no-store`.

- [ ] **Step 1: Add a failing route contract test**

Test that successful payloads contain only `items` and that missing tournament-host configuration surfaces a `503` error without secrets or fallback records.

- [ ] **Step 2: Run the route test and verify RED**

Run: `node --test api/_explorer.test.js`

Expected: FAIL because the route handler is absent.

- [ ] **Step 3: Implement and register the route**

```js
import { fetchBentoExplorer, handleApiError, sendJson } from "./_bento.js";

export default async function handler(_request, response) {
  try {
    sendJson(response, 200, await fetchBentoExplorer());
  } catch (error) {
    handleApiError(response, error);
  }
}
```

Register `/api/explorer` in Vite's local API map.

- [ ] **Step 4: Run route and full API tests**

Run: `node --test api/*.test.js`

Expected: all API tests pass.

### Task 3: Frontend Search and Filter Model

**Files:**
- Create: `src/explorer.js`
- Create: `src/explorer.test.js`

**Interfaces:**
- Consumes: normalized `ExplorerItem[]` from `/api/explorer`.
- Produces: `fetchExplorerItems()`, `filterExplorerItems(items, { query, sport, status })`, `explorerSports(items)`, `formatExplorerDate(value)`, and `formatExplorerPrize(value)`.

- [ ] **Step 1: Write failing frontend behavior tests**

Test search across league/team/Grand Prix/circuit/country, derived sport ordering (`All`, `Football`, `Formula 1`, then alphabetical), lifecycle filtering, nearest-date sorting, and empty input behavior.

```js
test("searches F1 schedule metadata", () => {
  assert.deepEqual(
    filterExplorerItems(items, { query: "zandvoort", sport: "All", status: "upcoming" }).map((item) => item.id),
    ["f1-14"],
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test src/explorer.test.js`

Expected: FAIL because `src/explorer.js` does not exist.

- [ ] **Step 3: Implement the pure helpers and fetch client**

`fetchExplorerItems` must reject non-2xx responses and return only an array from `payload.items`; it must never read or write localStorage. Filtering is case-insensitive and sorts by `startTime`, then `name`.

- [ ] **Step 4: Run focused frontend tests**

Run: `node --test src/explorer.test.js`

Expected: all tests pass.

### Task 4: Accessible Explorer Modal

**Files:**
- Create: `src/ExplorerModal.jsx`
- Modify: `src/main.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `open: boolean`, `onClose: () => void`, and helpers from `src/explorer.js`.
- Produces: `<ExplorerModal open={explorerOpen} onClose={closeExplorer} />`.

- [ ] **Step 1: Add the navbar trigger and isolated modal component**

Add an `Explore` button with a compass/search icon beside notification/profile actions. Keep `ExplorerModal` mounted so a successful response is reused only for the current page session. Fetch on first open and on explicit refresh.

- [ ] **Step 2: Implement modal behavior**

Include autofocus search, Escape close, click-outside close, a Tab focus trap, focus return to the trigger, pressed-state sport/status filters, loading announcement, alert errors, retry, empty state, and expandable `View schedule` cards. Ended cards say `Read only`; no card contains bet, join, enter, or predict actions.

- [ ] **Step 3: Style desktop and mobile layouts**

Reuse the existing black outlines, paper panels, yellow/cyan accents, expressive typography, and dot texture. Use a centered maximum-width desktop modal and a full-screen mobile sheet below `620px`; prevent horizontal overflow and support reduced motion.

- [ ] **Step 4: Run full tests and production build**

Run: `npm.cmd test`

Expected: all tests pass.

Run: `npm.cmd run build`

Expected: Vite production build exits 0.

### Task 5: Browser QA and Final Verification

**Files:**
- Modify only if verification exposes a defect: `src/ExplorerModal.jsx`, `src/main.jsx`, or `src/styles.css`.

**Interfaces:**
- Consumes: local Vite app and `/api/explorer`.
- Produces: verified desktop/mobile Explorer behavior.

- [ ] **Step 1: Start the local app and use browser-harness**

Verify desktop and 390px mobile layouts, open/close, autofocus, Escape, focus return, search, sport filters, lifecycle filters, refresh, empty state, and expanded F1/football schedules.

- [ ] **Step 2: Verify data integrity in the rendered catalog**

Confirm no `E2E`, `SDK`, `test`, canceled, mock, malformed, or date-stale record appears. Confirm F1 dates and football dates match `/api/explorer` exactly.

- [ ] **Step 3: Run final evidence commands**

Run: `npm.cmd test`, `npm.cmd run build`, and `git diff --check`.

Expected: zero test failures, build exit 0, and no whitespace errors.
