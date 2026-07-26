# Explorer Editorial Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Tournament Explorer with polished editorial sports cards, consistent spacing, and responsive typography.

**Architecture:** Keep the existing React behavior and semantic markup. Add small card sections only where needed for styling, then replace Explorer-specific CSS with scoped typography, spacing, card, control, and responsive rules.

**Tech Stack:** React 19, CSS, Google Fonts, Vite 6.

## Global Constraints

- Preserve verified-data, deduplication, filtering, prefetch, and read-only ended behavior.
- No new runtime dependencies.
- Support viewports down to 320px.

---

### Task 1: Editorial Card Markup

**Files:**
- Modify: `src/ExplorerModal.jsx`

- [ ] Add semantic wrappers for card identity, date label, and read-only state without changing behavior.
- [ ] Keep accessible times, buttons, dialog labels, and filter groups intact.

### Task 2: Typography And Layout

**Files:**
- Modify: `src/styles.css`

- [ ] Add `Barlow Condensed` and `DM Sans` font faces.
- [ ] Define Explorer-scoped surface, spacing, and typography custom properties.
- [ ] Restyle controls and cards with consistent gutters, lighter borders, and refined shadows.
- [ ] Add tablet and mobile card layouts with no overflow.
- [ ] Match skeleton geometry to the final cards.

### Task 3: Verification

**Files:**
- Verify all pending Explorer source and test changes.

- [ ] Run `npm.cmd test` and require zero failures.
- [ ] Run `npm.cmd run build` and require a successful production bundle.
- [ ] Run `git diff --check` and require no whitespace errors.

