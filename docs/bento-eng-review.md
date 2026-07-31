# Bento Engineering Review

Date: 2026-07-31

## Scope Challenge

The current app has two different product models living side by side:

1. **Markets host arcade loop:** list duels, auto-pick a side every 15 seconds, estimate/place a Bento bet, then refresh portfolio.
2. **Tournaments host discovery:** list real Bento tournaments/F1 events, show schedules, rounds, and leaderboards.

The next improvement should not blur those models. Bento tournament play uses tournament entry, vault deposits, stage chips, picks, and claims; it is not the same as `sdk.user.bets.placeBet`. The highest-value scope is to convert tournament pages from read-only discovery into real entry/status/picks, while keeping market-host betting separate.

## What Already Exists

- `api/_bento.js` already creates public/user Bento SDK clients with both `baseUrl` and `tournamentsBaseUrl`.
- `api/_bento.js` now passes `tournamentsAuth` for authenticated tournament-host calls.
- `api/_explorer.js` already rejects canceled/discarded/test/demo/mock tournament records and does not synthesize fallback competitions.
- `api/_tournament.js` normalizes football stages, F1 rounds, Bento leaderboards, winners, and scores without inventing missing leaderboard rows.
- `src/ExplorerModal.jsx` and `src/TournamentPage.jsx` already load selected tournament details and expose schedules/leaderboards.
- `src/main.jsx` already has market-host login, estimate, place, portfolio refresh, and local profile onboarding.

## Missing Bento Surfaces To Offer

| Priority | Product Offer | Bento SDK/API Surface | Why It Matters |
|---|---|---|---|
| P0 | Tournament entry/status CTA | `sdk.tournaments.tournaments.getEligibility`, `getMyStatus`, `enter`, `getDepositInstructions`; F1 `getEligibility`, `enter`, `reenter`, `getMyPicks` | Turns tournament pages from read-only catalog into actual gameplay. |
| P0 | Stage chip picks | `sdk.tournaments.tournaments.submitPicks`, `getPicks`, `getStageOdds`, `getStageFixtures`, `getStageStandings` | Bento docs say tournament matches use chip balances, not market-host bet placement. |
| P1 | F1-native picker | `sdk.tournaments.f1.listDrivers`, `getRoundMatchups`, `getHeatmap`, `getRaceAnalytics`, `listRoundSideBets`, `postRoundSideBets`, `predict`, `lockMyPredictions` | F1 should feel like grid prediction/side bets, not generic YES/NO. |
| P1 | Market analytics and live conviction | `sdk.public.publicBets.getYesPercentageSnapshots`, `estimatedWin`, `getSellUnlockLiquidity`, `sdk.public.analytics.getPlatformReport`, `sdk.public.protocolStats.*` | Adds odds/history/trader confidence around the current random ticket. |
| P1 | Position exit flow | `sdk.user.bets.estimateSell`, `sellBet`, `getUserShares`, `sdk.user.portfolio.*` | Serious prediction-market users expect to manage and exit positions. |
| P2 | Bento trader/creator leaderboards | `sdk.public.leaderboard.listTraders`, `listCreators`, `getGlobalAggregate`, chart endpoints | Replaces local leaderboard vibes with real Bento social proof. |
| P2 | Parlays | `sdk.tournaments.parlay.validateLegs`, `createQuote`, `prepareQuoteForPlacement`, `getTickets`, `getHistory`, `claim` | A natural sports expansion, but on-chain placement means bigger auth/wallet scope. |
| P3 | Packs | `sdk.public.packs.*`, `sdk.user.packs.enter`, `estimatePick`, `placePick`, `getMyEntry` | Fun retention loop after core market/tournament gameplay is trustworthy. |
| P3 | Creator/community flows | `sdk.user.duels.createDuel`, parent markets, tournament creator eligibility/bond/dispute APIs | High scope and trust-sensitive; save until core flows are stable. |

## Phantom Data Audit

| Area | File | Phantom Risk | Recommendation |
|---|---|---|---|
| Local app leaderboard | `api/users.js`, `src/main.jsx` | `wins`, `losses`, `points`, `streak`, team/style, and activity feed are app-local, not Bento PnL or Bento tournament rank. | Label as local profile/community data or replace with `sdk.public.leaderboard` and tournament leaderboard data. |
| Local activity feed | `src/main.jsx` | Feed entries like wallet connected, ticket locked, account refreshed are local UI events, not Bento public bet events. | Split into `Local activity` vs `Bento activity`; add `sdk.public.publicBets` for real public bet history where available. |
| TxLINE initial snapshot | `src/integrations.js`, `api/_txline.js` | `initialMatchSnapshot` has default zeros/WAITING and `normalizeTxLine` carries previous values forward. This is useful for UI stability but can look like live sports data. | Gate display on `connected === true`; show explicit unavailable state for zeros inherited from fallback. |
| Fixture labels from market titles | `src/bento.js` | `fixtureFromMarket` parses teams from prose or falls back to option labels/Home/Away. This can invent a matchup shape from generic markets. | Add `isInferredFixture`/`fixtureSource` and visually mark inferred labels; avoid using inferred teams in receipts. |
| Bento market defaults | `api/_bento.js` | Missing category/status/options become `Prediction`, `listed`, `YES`, `NO`; title can become `YES vs NO`. | Return null/empty plus `fieldCompleteness` instead of pretending the market is well-described. |
| Token decimals | `src/bento.js`, `src/main.jsx` | UI says Base USDC but `humanToWei` always uses 18 decimals. Bento docs note 18 decimals for credits/BSC USDC and 6 for Base USDC. | Read `collateralMode`/decimals from Bento or config; pass `tokenDecimals` to `placeBetFromEstimate`; enforce platform minimum before quote. |
| Tournament final scores | `api/_tournament.js`, `api/_bento.js` | Winner/score normalization accepts many field aliases. Good coverage, but ambiguous aliases may map wrong home/away semantics. | Preserve source field names in a `resultSource` field and only render score when both sides map confidently. |

## Recommended Implementation Plan

### Phase 1: De-phantom current data

1. Add provenance fields to normalized market and fixture models:
   - `fixtureSource: "bento" | "title-inferred" | "option-fallback"`
   - `fieldCompleteness: { title, optionA, optionB, category, endTime }`
   - `resultSource` for winner/score rendering.
2. Rename the local leaderboard UI to local/community profiles or replace it with Bento leaderboard data.
3. Fix token decimals:
   - Add token metadata per collateral/network.
   - Pass `tokenDecimals` into `placeBetFromEstimate`.
   - Block sub-minimum stake before estimate.

### Phase 2: Tournament entry/status

Data flow:

```text
TournamentPage
  -> /api/tournament?slug=...
  -> /api/tournament?route=status&slug=... + Bearer token
  -> Bento tournaments getEligibility/getMyStatus
  -> CTA state: Connect / Enter / Entered / Not eligible / Final
```

Endpoints to add:

- `GET /api/tournament?route=status&slug=...`
- `POST /api/tournament?route=enter`
- F1 branch: `sdk.tournaments.f1.getEligibility`, `enter`, `reenter`, `getMyPicks`.
- Bracket branch: `sdk.tournaments.tournaments.getEligibility`, `getMyStatus`, `enter`.

Failure modes:

- User has market JWT but tournaments host rejects it: visible `Reconnect wallet for tournament entry`.
- Free vs paid entry unclear: use `getDepositInstructions` before `enter` when buy-in is non-zero.
- HTTP entry accepted but finality lags: poll `getMyStatus` and show pending.

### Phase 3: Stage picks and F1-native play

Bracket stages:

- Use `getStageFixtures`, `getStageOdds`, `getStageStandings`.
- Use `submitPicks`/`getPicks` with stage chip language.
- Do not route stage chips through `estimateBentoBet` or `placeBentoBet`.

F1:

- Use `listDrivers`, `getRoundMatchups`, `getHeatmap`, `listRoundSideBets`.
- Use `predict`, `updatePrediction`, `lockMyPredictions`.
- Add explicit lock state from event/round timing.

### Phase 4: Market analytics and exits

- Add `GET /api/bento?route=market-analytics&duelId=...` for yes-percentage snapshots and sell liquidity.
- Add `GET /api/bento?route=user-shares&duelId=...`.
- Add `POST /api/bento?route=sell-estimate` and `POST /api/bento?route=sell`.
- Render position drawer only when Bento confirms shares.

## NOT In Scope For The Next PR

- Creator market/tournament flows: require trust, moderation, creator eligibility, and possibly bond/dispute UX.
- Full parlay placement: `createQuote` is available, but placement is on-chain and should be designed as a separate wallet/on-chain flow.
- Packs: attractive retention layer, but lower priority than making tournament entry and existing tickets real.
- Admin/protocol APIs: not product-user scope and should stay server/admin-only.

## Parallelization Strategy

| Step | Modules touched | Depends on |
|---|---|---|
| De-phantom market normalization | `api/`, `src/bento.js`, tests | None |
| Bento leaderboard/activity replacement | `api/`, `src/main.jsx`, tests | None |
| Tournament status/entry endpoints | `api/`, `src/explorer.js`, tests | None |
| Tournament CTA UI | `src/TournamentPage.jsx`, `src/styles.css` | Tournament status/entry endpoints |
| F1-native picks | `api/`, `src/TournamentPage.jsx`, tests | Tournament status/entry endpoints |
| Market analytics/exit drawer | `api/`, `src/main.jsx`, tests | De-phantom market normalization |

Execution:

- Lane A: de-phantom market normalization -> market analytics/exit drawer.
- Lane B: tournament status/entry endpoints -> tournament CTA UI -> F1-native picks.
- Lane C: Bento leaderboard/activity replacement.

Conflict flags:

- Lanes A and C both touch `src/main.jsx`; coordinate or sequence frontend integration.
- Lanes B and F1 work both touch `src/TournamentPage.jsx`; keep in one lane.

## Test Plan

- Unit-test normalization provenance and token decimal conversion.
- API tests for tournament status/entry with mocked SDK methods for eligible, ineligible, entered, and pending states.
- UI-level tests for CTA states: connect wallet, enter, pending, entered, final/read-only.
- Regression tests that Explorer never returns test/demo/mock/canceled/stale tournaments.
- Failure tests that leaderboard/activity UI does not show local data as Bento-sourced data.

## Completion Summary

- Scope challenge: scope should expand from read-only tournaments to real tournament entry/status, but not mix tournament chips with market-host bets.
- Architecture review: 6 gaps found.
- Code quality review: 3 phantom-data risks should be de-labeled or removed before adding more product surfaces.
- Test review: new endpoint/UI states need tests before implementation.
- Performance review: tournament details currently list all tournaments to resolve a slug; acceptable at current scale, but should use a cached slug/id map or direct id route later.
- Parallelization: 3 lanes, with frontend conflict risk in `src/main.jsx` and `src/TournamentPage.jsx`.
