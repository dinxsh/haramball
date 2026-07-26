# Tournament Explorer Design

## Goal

Add an Explorer entry to the top navigation that opens a responsive modal for discovering trustworthy Bento tournaments and F1 races. Users can search and filter the real Bento catalog without seeing local fallbacks, synthetic competitions, canceled records, stale schedules, or malformed test data.

## User Experience

The existing top navigation gains an `Explore` button. It opens a centered modal on desktop and a full-screen sheet on mobile.

The modal contains:

- A search input that matches tournament name, sport, league, team, Grand Prix, circuit, and country.
- Sport filters derived only from valid API records, with `All`, `Football`, and `Formula 1` prioritized.
- Lifecycle filters for `Upcoming`, `Live`, and `Ended`.
- Tournament cards ordered by the nearest actionable date, then by name.
- Explicit loading, empty, configuration-error, and request-error states.

Football cards show the league, tournament name, next real fixture or stage date, status, format, entry count, and prize pool when supplied by Bento. F1 cards show the tournament name, next Grand Prix, circuit, country, qualifying date, race date, and prediction availability.

Selecting an item expands its schedule and metadata inside the Explorer. Ended items use the same detail presentation with an explicit read-only label. Tournament-host records do not navigate into the existing market-host betting view because their IDs and interaction models are different.

## Catalog Policy

The Explorer is curated from API data, not manually curated content.

A record is excluded when any of these conditions apply:

- Status is canceled or discarded.
- Name, description, or league identifies an E2E, SDK, fixture, demo, mock, or test record.
- Required identity fields are absent.
- It claims to be upcoming or live but all authoritative stage, fixture, round, or event dates have passed.
- Its date fields cannot be parsed and it has no other actionable schedule information.

Completed tournaments may remain visible under `Ended` when they have a real sport, league or game type, and meaningful tournament metadata.

Lifecycle is derived from both Bento status and authoritative dates. Dates win when status is stale. No localStorage data, hard-coded tournaments, invented dates, or generated fallback teams may enter the Explorer response.

## Bento Integration

The browser never contacts Bento directly and never receives the Builder API key.

Add a server endpoint that creates the Bento SDK with both configured hosts and fetches:

- `sdk.tournaments.tournaments.list()` for the base catalog.
- `sdk.tournaments.tournaments.getById(id)` for bracket stage and fixture dates when needed.
- `sdk.tournaments.f1.listRounds(id)` for F1 race schedules.

The endpoint normalizes source records into a stable explorer model:

```text
id
kind: tournament | f1
name
sport
league
status: upcoming | live | ended
startTime
endTime
nextEvent
format
entryCount
prizePool
stakeAsset
searchText
sourceStatus
```

F1 `nextEvent` additionally contains Grand Prix, circuit, country, qualifying time, race time, round ID, and event status. Football `nextEvent` contains stage or fixture identifiers, title, teams when supplied, and start/lock times.

The endpoint returns only normalized, curated records with `Cache-Control: no-store`. It returns an empty list when Bento has no qualifying competitions; it never substitutes mock records.

To control request volume, list enrichment is bounded and concurrent. Only valid candidate records are enriched, with a small concurrency limit and per-record failures omitted or returned without unsupported schedule details. A total Bento outage produces an error state rather than cached content.

## Frontend Architecture

Keep explorer responsibilities separate from the existing market interaction state:

- `src/explorer.js`: fetch client, normalization-independent UI helpers, local search/filter/sort logic.
- `src/explorer.test.js`: behavior tests for search, filtering, ordering, and lifecycle presentation.
- `ExplorerModal` component: modal shell, filters, states, and cards.
- `App`: owns open/closed state and selection handoff only.

The modal fetches when first opened. Reopening during the same mounted session may reuse the successful in-memory response, but it must not use localStorage or persist catalog data. A visible refresh action requests fresh data.

## Interaction Rules

- Search and filter controls remain available for ended records.
- Entry, prediction, betting, and ticket actions are unavailable for ended records.
- F1 prediction controls are not part of this first implementation; F1 races are discovery-only until a dedicated predictor view is designed.
- Football tournament entry and bracket picks are also out of scope.
- Records use a `View schedule` affordance inside the modal rather than a misleading action button.

## Accessibility

- The modal uses `role="dialog"`, `aria-modal="true"`, and an accessible name.
- Opening moves focus to search; closing returns focus to the Explore button.
- Escape and the close button dismiss the modal.
- Focus stays inside the open modal.
- Filters expose pressed or selected state.
- Dates use readable local formatting while retaining machine-readable `datetime` values.
- Loading is announced politely and request failures use an alert.

## Error Handling

- Missing tournaments-host configuration: explain that Explorer is unavailable; show no catalog.
- Bento request failure: show a retry action and no stale records.
- Partial enrichment failure: retain trustworthy base metadata only when lifecycle can still be established.
- Empty valid catalog: show `No verified competitions available`.
- Invalid or stale dates: exclude the item rather than guessing.

## Testing

Server tests cover:

- Bento list response normalization.
- E2E, test, canceled, malformed, and stale record exclusion.
- Date-based lifecycle overriding stale API status.
- Football stage date extraction.
- F1 round and race-date extraction.
- Partial upstream failures and missing configuration.

Frontend tests cover:

- Search across tournament, league, team, race, circuit, and country.
- Sport and lifecycle filters.
- Nearest-date ordering.
- Ended and unsupported records never receiving interaction actions.
- Empty and error states never using local or mock data.

The full existing test suite and production build must remain green. Browser QA covers desktop and mobile modal layout, keyboard dismissal, focus return, category filtering, search, retry, and an ended record.

## Out Of Scope

- Tournament creation or administration.
- Tournament deposits, entry, bracket picks, claims, and disputes.
- F1 predictions, driver selection, side bets, and leaderboards.
- External sports-data providers.
- Persisted favorites, recent searches, or catalog caching.
- A standalone Explorer route.

## Acceptance Criteria

- The top navigation opens a responsive Explorer modal.
- The catalog contains only live Bento API data that passes the quality policy.
- Search supports leagues, sports, tournaments, football teams, and F1 schedule metadata.
- Upcoming F1 races display real qualifying and race dates from Bento rounds.
- Football dates come only from Bento stages or fixtures.
- Ended competitions are clearly labeled and read-only.
- No mock, E2E, canceled, malformed, stale, localStorage, or invented catalog data appears.
- API keys remain server-side.
