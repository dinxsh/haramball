# Competitive Bento Scope

Date: 2026-07-31

## What Shipped In This Pass

- Random 15-second ticket loop now auto-selects a side and auto-quotes it before the user locks the ticket.
- Ended markets route users to Explore instead of leaving them in a dead trading loop.
- Explore now opens live tournaments first, previews tournament schedules, and loads selected tournament details from Bento.
- Tournament detail pages surface official fixtures, F1 rounds, paged leaderboards, winners, and score fields when Bento publishes them.
- Server SDK setup now passes `tournamentsAuth` for authenticated tournament-host calls.

## Competitor Gaps To Close

Sources checked: Polymarket, Kalshi, Manifold, Bento docs, and the installed `@bento.fun/sdk@0.7.0`.

1. **Actual tournament entry and user status**
   - Competitor parity: users expect a clear join/entered/not-eligible state, not just a schedule page.
   - Bento APIs: `sdk.tournaments.tournaments.getEligibility`, `getMyStatus`, `enter`, `getDepositInstructions`, `withdraw`; F1 has `getEligibility`, `enter`, `reenter`, `getMyPicks`.
   - Proposed next scope: add `/api/tournament?route=status` and `/api/tournament?route=enter`, then make the tournament page primary CTA become `Enter`, `Entered`, or `Not eligible`.

2. **Live trader identity, portfolio, and public profiles**
   - Competitor parity: Polymarket and Kalshi emphasize PnL leaderboards/public trader discovery; Manifold emphasizes social identity and holders/trades.
   - Bento APIs: `sdk.public.leaderboard.*`, `sdk.public.portfolio.*`, `sdk.public.publicBets.*`, `sdk.user.portfolio.*`.
   - Proposed next scope: replace local leaderboard cache with Bento leaderboards and show recent public bets/activity for the current market.

3. **Order/trading depth and exit flows**
   - Competitor parity: prediction-market users expect buy/sell, position state, and richer price history rather than only quote-and-buy.
   - Bento APIs: `sdk.user.bets.estimateSell`, `sellBet`, `getSellUnlockLiquidity`, `sdk.public.analytics`, `sdk.public.protocolStats`.
   - Proposed next scope: add a position drawer with current shares, sell preview, sell confirmation, and market volume/liquidity context.

4. **F1-native prediction surface**
   - Competitor parity: sports prediction apps win when the gameplay matches the sport instead of forcing every event into YES/NO cards.
   - Bento APIs: `sdk.tournaments.f1.listDrivers`, `getRoundMatchups`, `getHeatmap`, `getRaceAnalytics`, `listRoundSideBets`, `postRoundSideBets`, `predict`, `lockMyPredictions`.
   - Proposed next scope: turn F1 detail pages into a grid-predictor surface with driver picks, heatmap consensus, side bets, and lock state.

5. **Parlays and packs**
   - Competitor parity: sports users expect combined tickets, boosted moments, and collectible/pack loops.
   - Bento APIs: `sdk.tournaments.parlay.*`, `sdk.public.packs.*`, `sdk.user.packs.*`.
   - Proposed next scope: add a `Build slip` mode from Explore where multiple Bento events become one parlay ticket.

6. **Creator and community loops**
   - Competitor parity: Manifold and Bento both lean on fast market creation and sharing.
   - Bento APIs: `sdk.user.duels.createDuel`, parent markets, `sdk.tournaments.tournaments.getCreatorEligibility`, creator bond flows, disputes.
   - Proposed next scope: add a guarded creator path after the trading loop is stable: market draft, eligibility check, submit, share link.

## Recommended Order

1. Tournament entry/status: highest user-facing mismatch and already aligned with the new Explore/Tournament pages.
2. Portfolio + public activity: makes locked tickets feel real after placement and improves trust.
3. F1-native picks/side bets: differentiates the product from generic YES/NO competitors.
4. Sell/exit and analytics: important for serious traders, but less critical for the current arcade loop.
5. Parlays/packs/creator: bigger scope, best after the core loop proves retention.
