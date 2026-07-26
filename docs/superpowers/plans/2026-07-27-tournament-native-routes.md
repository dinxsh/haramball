# Tournament-Native Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Explorer competition selectable through a canonical slug route backed entirely by tournament-native Bento data.

**Architecture:** Extend the Explorer normalizer with canonical slugs, add a server detail resolver over the tournaments SDK, and render a dedicated React tournament page selected from `window.location.pathname`. Keep generic duel-board state isolated to `/`.

**Tech Stack:** React 19, Vite 6, Node test runner, Bento SDK, CSS.

## Global Constraints

- Never reuse generic duel, profile, feed, or leaderboard data on tournament routes.
- Never fabricate missing tournament fields.
- Ended tournaments remain read-only.
- Support direct route reloads in Vercel.

---

### Task 1: Canonical Tournament Slugs

**Files:**
- Modify: `api/_explorer.js`
- Test: `api/_explorer.test.js`

- [ ] Write failing tests for readable unique slugs and slug resolution.
- [ ] Run `node --test api/_explorer.test.js` and confirm failure.
- [ ] Implement `tournamentSlug()` and `resolveTournamentSlug()` and include `slug` in catalog items.
- [ ] Re-run the focused test and require success.

### Task 2: Tournament Detail API

**Files:**
- Modify: `api/_bento.js`
- Create: `api/tournament.js`
- Create: `api/tournament.test.js`
- Modify: `vite.config.js`

- [ ] Write failing handler and normalizer tests for football, F1, missing slug, and unknown slug.
- [ ] Implement verified slug resolution, native detail fetches, optional leaderboard fetches, and normalized output.
- [ ] Register `/api/tournament` in local Vite middleware.
- [ ] Run all API tests.

### Task 3: Client Route And Selection

**Files:**
- Modify: `src/explorer.js`
- Modify: `src/explorer.test.js`
- Modify: `src/ExplorerModal.jsx`
- Create: `src/TournamentPage.jsx`
- Modify: `src/main.jsx`

- [ ] Write failing tests for pathname parsing and detail fetching.
- [ ] Add card links using the server-provided slug.
- [ ] Render `TournamentPage` before generic duel-board effects can provide route content.
- [ ] Reset detail state on slug change and render football/F1 sections from the normalized response.

### Task 4: Tournament Page Styling And Deployment

**Files:**
- Modify: `src/styles.css`
- Modify: `vercel.json`

- [ ] Add responsive tournament hero, metadata, schedule, and leaderboard styles.
- [ ] Add an SPA fallback rewrite that excludes `/api/*`.

### Task 5: Verification

- [ ] Run `npm.cmd test` and require zero failures.
- [ ] Run `npm.cmd run build` and require a successful production build.
- [ ] Run `git diff --check` and require no whitespace errors.
- [ ] Probe one football and one F1 slug through `/api/tournament`.

