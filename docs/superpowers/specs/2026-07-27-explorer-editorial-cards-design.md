# Explorer Editorial Cards Design

## Direction

Refine Tournament Explorer into an editorial sports calendar: confident display typography, warm paper surfaces, controlled use of cyan/green/gold, and a consistent spacing rhythm. Preserve the existing stadium-green header and verified-data behavior.

## Typography

- Use `Barlow Condensed` at weights 600-800 for competition titles, dates, and compact labels.
- Use `DM Sans` at weights 500-800 for search, filters, descriptions, and supporting metadata.
- Keep `Bangers` only for the modal headline so the Explorer still belongs to the Haramball visual language.
- Use sentence case for supporting copy and uppercase only for short labels.

## Cards

- Use a 2px ink border, 16px radius, and a restrained offset shadow.
- Use 22-24px desktop padding and 16px mobile padding.
- Organize each card into a flexible identity column and a compact date panel.
- Use a slim lifecycle accent at the top rather than a thick left stripe.
- Make title, fixture, date, and lifecycle immediately distinguishable.
- Keep ended cards non-interactive with a quiet read-only treatment.

## Controls

- Align search, refresh, filters, and result count to a shared 16px content gutter.
- Reduce pill borders and shadows while retaining clear selected states.
- Keep filters horizontally scrollable on small screens.
- Preserve keyboard focus visibility and minimum touch targets.

## Responsive Behavior

- At tablet width, cards retain two columns when space permits.
- At mobile width, date information moves below the title and spans the card width.
- No labels, shadows, or card content may overflow a 320px viewport.

## Verification

- Existing Explorer data, filtering, caching, and ordering tests remain green.
- Vite production build succeeds.
- Static CSS and live API checks remain clean.

