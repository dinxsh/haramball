# Tournament-Native Routes Design

## Goal

Allow every verified Explorer competition to open at a stable readable URL and render only authoritative data for that selected Bento tournament.

## Routes And Slugs

- Canonical client route: `/tournaments/{name-slug}-{id-prefix}`.
- `name-slug` is lowercase ASCII words separated by hyphens.
- `id-prefix` is the first eight characters of the Bento tournament ID.
- The server resolves the prefix against the verified tournament catalog and rejects missing, ambiguous, canceled, test, demo, SDK, and mock records.
- Browser back, forward, reload, and direct navigation use the same pathname-derived slug.

## Selection

- The title/content area of every Explorer card is a real link to its canonical route.
- Schedule expansion remains a separate control for non-ended cards.
- Navigation causes the route page to fetch a fresh tournament detail payload; no previous competition state is retained.

## Detail API

- Endpoint: `GET /api/tournament?slug={slug}`.
- Common payload includes identity, lifecycle, description, dates, entry count, prize pool, format, and canonical slug.
- Football payload includes normalized stages and fixtures from `tournaments.getById`, plus a tournament leaderboard when Bento returns one.
- F1 payload includes all normalized rounds from `f1.listRounds`, plus the season leaderboard when Bento returns one.
- Optional upstream requests may fail independently; the API returns an empty corresponding collection, never fabricated values.
- Unknown and ambiguous slugs return `404`.

## Tournament Page

- The page has a tournament identity hero and an Explorer button.
- It renders status, sport, league, format, entries, pool, schedule, and tournament-native leaderboard only when provided by Bento.
- Football fixtures and F1 rounds have distinct renderers.
- Empty sections state that Bento has not published that dataset.
- Ended tournaments are read-only and have no transactional controls.
- Existing duel betting, local profiles, generic activity, and generic leaderboard are not reused on tournament routes.

## Deployment

- Vite handles history fallback in development.
- Vercel rewrites non-API routes to `/index.html` so direct slug URLs load the React application.

## Testing

- Slug generation and resolution tests cover uniqueness, invalid slugs, and rejected records.
- Detail normalization tests cover football and F1 payloads without placeholder fallback.
- API handler tests cover required slug, success, and 404 behavior.
- Client helper tests cover pathname parsing and detail fetching.
- Full Node tests and the Vite production build must pass.

