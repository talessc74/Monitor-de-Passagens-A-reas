---
name: _local-adr-policy-001-passenger-and-date-flexibility-model
description: Adds an infants field alongside FlightMonitor's existing adults/children fields; models date flexibility as independent days-before/days-after counters per date; adds an anytime search mode with no dates at all. Use when touching the FlightMonitor shape, monitor creation payload, or the route-stats/scan simulator inputs.
apply-to: packages/types, services/api routes and repositories for monitors, apps/web onboarding and monitor forms
valid-from: 2026-07-30
---

# _local-adr-policy-001: Passenger and date flexibility model

## Context and Problem Statement

`_local-bdr-policy-001` requires the onboarding to capture passengers by age band, and to
support both a flexible-but-dated search and a fully date-agnostic ("anytime") search.
`FlightMonitor` already has flat `adults`/`children` fields (from Fase 1) but no `infants`
field. An earlier version of this policy added a single symmetric `flexDays` per date, which
cannot express "I can leave 2 days early but only come back 5 days late" — a real asymmetry
the product owner flagged — and cannot express "no date at all, just alert me on price."

Question: how should `FlightMonitor` model the infant count, asymmetric date flexibility,
and the anytime mode?

## Decision Outcome

**Add `infants`; replace symmetric `flexDays` with independent before/after counters per
date; add `searchMode` making both dates optional**

`FlightMonitor` gains `infants: number` as a third flat field next to `adults`/`children`
(children 2-11, infants on lap) — kept flat, not nested, matching the existing field style.
A new `searchMode: 'dated' | 'anytime'` field selects the mode. In `dated` mode,
`departureDate`/`returnDate` are required strings as before, but flexibility is now four
independent optional numbers — `departDaysBefore`, `departDaysAfter`, `returnDaysBefore`,
`returnDaysAfter` — replacing the single `departFlexDays`/`returnFlexDays` symmetric pair.
In `anytime` mode, `departureDate`/`returnDate` and all four flexibility fields are absent;
the monitor carries only origin, destination, and passengers.

### Details

- Acceptance criterion (verifiable): `packages/types`' `FlightMonitor` interface exposes
  `searchMode: 'dated' | 'anytime'`; `departureDate`/`returnDate` are optional strings;
  `departDaysBefore?`, `departDaysAfter?`, `returnDaysBefore?`, `returnDaysAfter?` are
  optional numbers. The old symmetric `departFlexDays`/`returnFlexDays` fields are removed —
  this policy supersedes that shape entirely, not additively.
- `adults` must be `>= 1`; `children` and `infants` default to `0`.
- Each of the four before/after counters is independent — none may be derived from another,
  and a UI or API that only exposes a single shared value for a date's flexibility does not
  satisfy this decision.
- `searchMode: 'anytime'` monitors must not have `departureDate`/`returnDate` persisted at
  all (not even as empty strings) — their absence is how the scan/route-stats logic
  distinguishes the two modes, not a separate boolean flag.
- Existing monitors created before this change have neither `infants`, `searchMode`, nor the
  before/after fields. Reads must treat a missing `infants` as `0` and a missing `searchMode`
  as `'dated'` (preserving today's behavior for old data) — no backfill migration script,
  since Fase 1/2/3 data is still test data.
- This model is consumed by `GET /api/route-stats` (`_local-edr-policy-001`) exactly as it
  is consumed by monitor creation, so both share one Zod schema in `services/api` instead of
  duplicating passenger/date validation.

## Considered Options

- Keep `passengers` as a single total number and infer a default age mix — rejected: the
  Gemini route-stats simulation needs the real mix to produce a realistic price, and
  `_local-bdr-policy-001` already requires the breakdown to be collected explicitly.
- Keep a single symmetric `flexDays` per date — rejected: does not represent a traveler's
  real, often-asymmetric tolerance for going earlier vs. coming back later.
- Represent "anytime" as `dated` mode with an arbitrarily large `flexDays` (e.g. 365) instead
  of a distinct `searchMode` — rejected: it's a different query shape for route-stats/scan
  (no specific date to search around at all, not just a wide window around one), and would
  force every date-handling code path to special-case an arbitrary sentinel value instead of
  branching on an explicit, self-documenting mode.

## References

- `_local-bdr-policy-001` — product decision that requires this data shape
- `_local-edr-policy-001` — endpoint whose query params follow this shape
- `ROADMAP.md`, Fase 3, item 7 — records the same decision at the product-roadmap level
