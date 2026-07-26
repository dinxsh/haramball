# Explorer Feed Refinement Design

## Goal

Make Tournament Explorer fast, unique, easy to filter, and usable at every viewport size without introducing fabricated or stale data.

## Catalog Behavior

- Return at most one card per competition identity.
- Use normalized `sport + league` as the identity when a league exists; otherwise use `sport + name`.
- Choose the most useful record in this order: `live`, nearest `upcoming`, most recently `ended`.
- Sort the final feed in the same lifecycle order, with nearest live/upcoming dates first and most recent ended dates first.
- Continue rejecting canceled, discarded, E2E, SDK, test, demo, and mock records.

## Loading

- Start a single Explorer request during browser idle time, before the modal opens.
- Reuse the same in-flight promise and resolved data for subsequent opens.
- A manual refresh bypasses the client cache and replaces it only after a successful request.
- Use compact structural skeleton cards that mirror card metadata, title, and date rather than large blank blocks.

## Filters

- Keep text search.
- Present sport and lifecycle filters in one horizontal toolbar.
- Lifecycle choices are `All`, `Live`, `Upcoming`, and `Ended`.
- Filters stay available on small screens through horizontal scrolling and never wrap into overlapping rows.
- Display the number of visible competitions and offer a clear-filters action when no result matches.

## Responsive Layout

- Preserve the existing paper-and-ink visual language.
- Use a restrained header height so results remain visible on laptop screens.
- Keep the search and refresh button in one row where possible; use an icon-only refresh control on narrow screens.
- Collapse card columns below tablet width and keep all text and controls within the viewport.
- Ended cards remain read-only and non-interactive.

## Testing

- Server tests cover competition-level deduplication and lifecycle ordering.
- Client tests cover lifecycle-first sorting, all filters, and request caching/refresh behavior.
- The complete Node test suite and Vite production build must pass.

