---
name: _local-adr-policy-001-passenger-and-date-flexibility-model
description: Splits FlightMonitor.passengers into adults/children/infants and adds optional flexDays to travel dates. Use when touching the FlightMonitor shape, monitor creation payload, or the route-stats/scan simulator inputs.
apply-to: packages/types, services/api routes and repositories for monitors, apps/web onboarding and monitor forms
valid-from: 2026-07-30
---

# _local-adr-policy-001: Passenger and date flexibility model

## Context and Problem Statement

`_local-bdr-policy-001` requires the onboarding to capture passengers by age band and dates
as a flexible window. The current `FlightMonitor` type has a single numeric `passengers`
field and fixed `departDate`/`returnDate` strings, which cannot represent either.

Question: how should `FlightMonitor` model passengers and date flexibility to satisfy the
approved onboarding decision without a breaking, all-at-once rewrite of the type?

## Decision Outcome

**Structured passengers object + optional flexDays per date**

`passengers` becomes `{ adults: number; children: number; infants: number }` (children 2-11,
infants on lap, matching airline fare rules). `departDate`/`returnDate` keep their existing
shape but each gains a sibling optional field `departFlexDays?: number` /
`returnFlexDays?: number` (0 or undefined means an exact date, matching today's behavior).

### Details

- Acceptance criterion (verifiable): `packages/types`' `FlightMonitor` interface exposes
  `passengers: { adults: number; children: number; infants: number }` and
  `departFlexDays?: number` / `returnFlexDays?: number`; a build with the old single-number
  `passengers` type is non-compliant.
- `adults` must be `>= 1`; `children` and `infants` default to `0`.
- `flexDays` is expressed once per date (not a shared range), because ida and volta are
  independently flexible per `_local-bdr-policy-001`.
- Existing monitors created before this change do not have the new fields. Reads must
  treat a missing `passengers` object or missing `flexDays` as `{ adults: 1, children: 0,
  infants: 0 }` and `flexDays: 0` respectively — no backfill migration script, since Fase 1/2
  data is still test data.
- This model is consumed by `GET /api/route-stats` (`_local-edr-policy-001`) exactly as it
  will be consumed by monitor creation, so both share one Zod schema in `packages/types`
  instead of duplicating passenger/date validation.

## Considered Options

- Keep `passengers` as a single total number and infer a default age mix — rejected: the
  Gemini route-stats simulation needs the real mix to produce a realistic price, and
  `_local-bdr-policy-001` already requires the breakdown to be collected explicitly.
- Model flexibility as a single `dateRangeDays` shared between ida and volta — rejected:
  `_local-bdr-policy-001` requires each date to carry its own flexibility selector.

## References

- `_local-bdr-policy-001` — product decision that requires this data shape
- `_local-edr-policy-001` — endpoint whose query params follow this shape
- `ROADMAP.md`, Fase 3, item 7 — records the same decision at the product-roadmap level
