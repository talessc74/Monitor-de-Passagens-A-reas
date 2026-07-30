---
name: _local-adr-policy-001-passenger-and-date-flexibility-model
description: Adds an infants field alongside FlightMonitor's existing adults/children fields, and adds optional flexDays to travel dates. Use when touching the FlightMonitor shape, monitor creation payload, or the route-stats/scan simulator inputs.
apply-to: packages/types, services/api routes and repositories for monitors, apps/web onboarding and monitor forms
valid-from: 2026-07-30
---

# _local-adr-policy-001: Passenger and date flexibility model

## Context and Problem Statement

`_local-bdr-policy-001` requires the onboarding to capture passengers by age band and dates
as a flexible window. `FlightMonitor` already has flat `adults`/`children` fields (from
Fase 1) but no `infants` field, and `departureDate`/`returnDate` are fixed strings with no
flexibility window.

Question: how should `FlightMonitor` model the infant count and date flexibility to satisfy
the approved onboarding decision without a breaking, all-at-once rewrite of the type?

## Decision Outcome

**Add `infants` alongside the existing flat passenger fields; add optional flexDays per date**

`FlightMonitor` gains `infants: number` as a third flat field next to the existing `adults`
and `children` (children 2-11, infants on lap, matching airline fare rules) — kept flat, not
nested into a `passengers` object, to match the existing field style and minimize the diff.
`departureDate`/`returnDate` keep their existing shape but each gains a sibling optional field
`departFlexDays?: number` / `returnFlexDays?: number` (0 or undefined means an exact date,
matching today's behavior).

### Details

- Acceptance criterion (verifiable): `packages/types`' `FlightMonitor` interface exposes
  `adults: number`, `children: number`, `infants: number` as flat fields, plus
  `departFlexDays?: number` / `returnFlexDays?: number`.
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
