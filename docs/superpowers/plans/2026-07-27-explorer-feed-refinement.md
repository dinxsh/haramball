# Explorer Feed Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a unique, lifecycle-prioritized Tournament Explorer with prefetched data, compact skeletons, and responsive filters.

**Architecture:** The API curator groups normalized tournaments by competition and selects the most relevant record. A small client request cache handles prefetch and refresh, while the modal renders a unified filter rail and responsive cards.

**Tech Stack:** React 19, Vite 6, Node test runner, Bento SDK, CSS.

## Global Constraints

- Never substitute mock or fallback tournament data.
- Ended competitions are read-only.
- Preserve the existing paper-and-ink design language.
- No new runtime dependencies.

---

### Task 1: Competition Selection

**Files:**
- Modify: `api/_explorer.js`
- Test: `api/_explorer.test.js`

**Interfaces:**
- Consumes: normalized Explorer items from `normalizeExplorerTournament`.
- Produces: a unique array sorted `live`, `upcoming`, `ended`.

- [ ] Write failing tests proving same-league aliases collapse and live records sort first.
- [ ] Run `node --test api/_explorer.test.js` and confirm the assertions fail.
- [ ] Replace exact-record deduplication with competition-level selection and lifecycle-aware ordering.
- [ ] Re-run `node --test api/_explorer.test.js` and confirm it passes.

### Task 2: Client Cache And Filters

**Files:**
- Modify: `src/explorer.js`
- Test: `src/explorer.test.js`

**Interfaces:**
- Produces: `fetchExplorerItems({ refresh?: boolean })`, `preloadExplorerItems()`, and lifecycle-first `filterExplorerItems()`.

- [ ] Write failing tests for live-first sorting, filtering, shared in-flight requests, and forced refresh.
- [ ] Run `node --test src/explorer.test.js` and confirm the new assertions fail.
- [ ] Add a module-level request/data cache and lifecycle-aware sorting.
- [ ] Re-run `node --test src/explorer.test.js` and confirm it passes.

### Task 3: Responsive Explorer Presentation

**Files:**
- Modify: `src/ExplorerModal.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: client cache and filter helpers from `src/explorer.js`.

- [ ] Start client prefetch while the modal is mounted but closed.
- [ ] Merge sport and lifecycle controls into a labelled, horizontally scrollable filter toolbar.
- [ ] Add visible-result count, clear-filters behavior, and compact structural skeleton markup.
- [ ] Tighten desktop and mobile dimensions while retaining keyboard and screen-reader behavior.

### Task 4: Verification

**Files:**
- Verify all modified source and test files.

- [ ] Run `npm.cmd test` and require zero failures.
- [ ] Run `npm.cmd run build` and require a successful Vite production build.
- [ ] Run `git diff --check` and require no whitespace errors.
- [ ] Probe `/api/explorer` and confirm unique competition identities and lifecycle-first ordering.

