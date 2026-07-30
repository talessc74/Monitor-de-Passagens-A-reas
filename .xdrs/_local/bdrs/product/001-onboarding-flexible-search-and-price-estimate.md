---
name: _local-bdr-policy-001-onboarding-flexible-search-and-price-estimate
description: Requires the monitor-creation onboarding to capture asymmetric date flexibility (days before / days after, independently) or no date at all (anytime mode), age-banded passenger counts, and to show a route price estimate before the user sets a target price. Use when touching the onboarding flow, the monitor-creation form, or its acceptance criteria.
apply-to: apps/web onboarding and monitor-creation forms (mobile and desktop)
valid-from: 2026-07-30
---

# _local-bdr-policy-001: Onboarding flexible search and price estimate

## Context and Problem Statement

The product owner reviewed the Fase 3 UX screens (FlySpot UX artifact) and raised three
gaps against the first draft: exact-date-only search does not match how travelers actually
shop for fares, passenger count as a single number cannot express child/infant fares, and
asking for a target price with zero market context turns it into a guess instead of an
informed decision.

After the first version shipped (symmetric ± N days flexibility, dates always required),
the product owner raised two further gaps: a traveler's tolerance for going earlier and for
coming back later are rarely the same number, so a single ± value is wrong; and some
travelers don't have a route/date preference at all — they only care about being told when
the price for a route drops below a number, on any date.

Question: what must the onboarding capture, and in what order, before a monitor is created?

## Decision Outcome

**Two search modes; asymmetric per-date flexibility; price context before the target field**

The onboarding offers two modes, chosen first:

1. **Datas (`dated`)** — the default. Collects, in order: (1) origin/destination, (2) a
   departure date and a return date, each with two independent counters — "quantos dias
   antes" and "quantos dias depois" of that date are acceptable (0 means exact date; the two
   counters are set separately, never mirrored) — (3) passenger counts split into adults
   (12+), children (2-11), and infants (on lap), (4) a price-history card (average/min/max
   over the last 60 days) shown immediately before the target-price field, with a one-click
   "usar como meta" action.
2. **Qualquer data (`anytime`)** — no date fields at all. Collects only origin/destination
   and passengers, then the same price-history card and target-price field. The monitor
   alerts whenever the route's price for those passengers drops to the target, regardless
   of which future date it flies.

### Details

- Acceptance criterion (verifiable): a user cannot reach the target-price field without
  first seeing the price-history card populated for their selected route (and dates, in
  `dated` mode) and passengers — the card is not optional decoration, it is a required step.
- Acceptance criterion (verifiable): the passenger step must expose three independent
  counters (adults, children, infants), each with its age-band hint text.
- Acceptance criterion (verifiable): in `dated` mode, both the departure and the return date
  each expose **two** independent counters — dias antes / dias depois — not a single shared
  ± selector; setting them to different values (e.g. 2 antes, 5 depois) must be possible and
  preserved.
- Acceptance criterion (verifiable): in `anytime` mode, no departure or return date input is
  rendered at all; the form does not silently default to a hidden date range.
- This is a business/product decision about *what* the flow must ask and *when*; the data
  shape that backs it (`FlightMonitor.searchMode`, the days-before/days-after fields) is
  `_local-adr-policy-001`, and the price-history data source is `_local-edr-policy-001`.
- Applies to both the mobile onboarding (phone-width flow) and the desktop "Nova rota"
  panel — the desktop panel must carry the same fields, not a reduced subset.

## References

- [FlySpot UX screens artifact](.assets/001-onboarding-ux-screens.html) (Fase 3, approved
  2026-07-30) — self-contained HTML mockup of all six reviewed screens; open in a browser.
  Screens 01 (onboarding) and 06 (desktop dashboard, "Nova rota" panel) are the ones this
  policy governs.
- `ROADMAP.md`, Fase 3, item 1 and item 7
- `_local-adr-policy-001` — data model this decision requires
- `_local-edr-policy-001` — endpoint that serves the price-history card
- [plans/001-fase-3-completion-and-next-phases](plans/001-fase-3-completion-and-next-phases.md) — tracks which of the six approved screens are still unbuilt (04, 05)
