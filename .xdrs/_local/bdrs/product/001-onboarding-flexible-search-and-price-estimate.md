---
name: _local-bdr-policy-001-onboarding-flexible-search-and-price-estimate
description: Requires the monitor-creation onboarding to capture flexible date windows, age-banded passenger counts, and to show a route price estimate before the user sets a target price. Use when touching the onboarding flow, the monitor-creation form, or its acceptance criteria.
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

Question: what must the onboarding capture, and in what order, before a monitor is created?

## Decision Outcome

**Flexible dates + age-banded passengers, price context before the target field**

The onboarding form must collect, in this order: (1) origin/destination, (2) a departure
date and a return date, each with an independent flexibility window (exact date, or ± 3/5/7
days), (3) passenger counts split into adults (12+), children (2-11), and infants (on lap),
(4) a price-history card (average/min/max over the last 60 days for that route/dates/
passengers) shown immediately before the target-price field, with a one-click "usar como
meta" action that fills the field with the observed minimum.

### Details

- Acceptance criterion (verifiable): a user cannot reach the target-price field without
  first seeing the price-history card populated for their selected route, dates, and
  passengers — the card is not optional decoration, it is a required step in the flow.
- Acceptance criterion (verifiable): the passenger step must expose three independent
  counters (adults, children, infants), each with its age-band hint text, matching the
  approved onboarding screen.
- Acceptance criterion (verifiable): both the departure and the return date each expose
  their own flexibility selector (data exata / ± 3 / ± 5 / ± 7 dias); a single shared
  flexibility value for both dates does not satisfy this decision.
- This is a business/product decision about *what* the flow must ask and *when*; the data
  shape that backs it (`FlightMonitor.passengers`, `flexDays`) is `_local-adr-policy-001`,
  and the price-history data source is `_local-edr-policy-001`.
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
