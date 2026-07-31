---
name: _local-bdr-plan-002-fase-7-duffel-amadeus-spike
description: Execution plan for Fase 7's mandatory spike — validate real Duffel/Amadeus coverage of Brazilian domestic routes before writing either adapter. Use when starting Fase 7 work, or when deciding which flight-search API becomes primary.
apply-to: services/api (future duffel.ts/amadeus.ts adapters), packages/types (SearchParams/FlightResult)
valid-from: 2026-07-31
---

# _local-bdr-plan-002: Fase 7 — Duffel × Amadeus coverage spike

## Context and Problem Statement

Fase 7 is the first phase with real per-call API cost (`ROADMAP.md`'s own warning). Before writing
a production adapter for either Duffel or Amadeus, `ROADMAP.md` mandates a spike: prove which API
(or both, in what role) actually covers the routes FlySpot needs, using sandbox accounts, before
any adapter code is written against a single assumed winner.

This document is the concrete execution plan for that spike — what to test, what "coverage" means
here, and the decision rule for picking a primary source — written now so that the moment sandbox
credentials exist, execution is mechanical rather than improvised.

## Decision Outcome

**Test a fixed route matrix against both sandboxes, score each on coverage + latency + response
shape, and let the score — not a prior assumption — pick the primary source.**

### Route matrix (fixed, run identically against both APIs)

| Route | Why it's in the matrix |
|---|---|
| GRU → GIG (São Paulo–Rio) | Highest-volume domestic trunk route; if this fails, nothing else matters |
| GRU → REC (São Paulo–Recife) | Mid-haul domestic, tests coverage beyond the SP–RJ corridor |
| GRU → LIS (São Paulo–Lisbon) | International, already used throughout the simulator (Fases 1-6) — needed to confirm the existing onboarding/UX examples keep working with real data |
| A regional route on a to-be-picked Azul-only city pair (e.g. GRU → run-time picked from Azul's published domestic network) | Duffel's own caveat in `ROADMAP.md` explicitly flags GOL/Azul coverage as unverified — this is the route most likely to expose that gap |
| GRU → GIG, `searchMode: 'anytime'` equivalent (a date range instead of one fixed pair) | FlySpot's own product decision (`_local-adr-policy-001`) supports date-agnostic monitors; confirms both APIs' search parameters can express "any date in a window," not just a single fixed date-pair query |

Each route is queried with: 1 adult (baseline), then 2 adults + 1 child (confirms passenger-count
handling matches `FlightMonitor`'s `adults`/`children`/`infants` shape without silently dropping or
mis-pricing a passenger type).

### Scoring per API, per route

- **Coverage**: did the API return at least one real, bookable-looking offer (not an empty result)?
- **Carrier match**: does the result include GOL/Azul/LATAM as marketing or operating carrier where
  expected, or does it silently omit a carrier known to fly that route?
- **Latency**: round-trip time for a single search call — feeds directly into whether the existing
  `searchCache` TTL (30-60 min, per `ROADMAP.md` task 4) is sufficient or needs adjusting per source.
- **Response shape sanity**: does `price`, `durationHours`, `stops` map cleanly onto `FlightResult`
  (`packages/types`) without requiring source-specific special-casing beyond the adapter itself?

### Decision rule

- If one API clearly covers the full matrix and the other has real gaps (especially GOL/Azul, per
  the flagged risk) → that one is primary, the other becomes the documented fallback (or is dropped
  from Fase 7's scope if it adds no coverage at all).
- If both cover the matrix comparably → Duffel is primary by default (its business model, commission
  on booking, has no per-call charge; Amadeus Self-Service is pay-per-call past a small free quota) —
  cost, not just coverage, breaks the tie.
- If neither covers the Azul-only regional route → this is escalated back to the product owner as a
  scope decision (`ROADMAP.md`'s own open "Decisões do produto: rotas domésticas ou internacionais
  no lançamento" line), not silently absorbed into the adapter code.

### Details

- Acceptance criterion (verifiable): the spike produces a short table (this route × this API →
  coverage/carrier-match/latency/shape, pass or fail) covering all 5 routes × both passenger
  configurations × both APIs — 20 data points total — before either `duffel.ts` or `amadeus.ts` is
  written as anything beyond a throwaway spike script.
- This plan does not require code changes to ship — it is written now, ahead of having sandbox
  credentials, so execution is a matter of running the matrix, not designing it under time pressure
  once accounts exist.
- `SearchParams`/`FlightResult` (added to `packages/types` alongside this plan) are the common shape
  the spike's throwaway scripts should already target, even before the real adapters exist — so the
  spike's own code isn't thrown away, just formalized.

## Considered Options

- **Just start Duffel first since it has no per-call charge** — rejected: `ROADMAP.md` explicitly
  already flags Duffel's GOL/Azul coverage as unverified; skipping the comparison would risk building
  the whole adapter against a source that silently under-covers the routes FlySpot's Brazilian users
  actually monitor.
- **Free-form manual testing without a fixed matrix** — rejected: a fixed, identical matrix run
  against both APIs is the only way the comparison is apples-to-apples; ad hoc testing tends to test
  whatever's convenient per API, not the same thing twice.

## References

- `ROADMAP.md` Fase 7 — the phase this spike unblocks, including its own flagged Duffel GOL/Azul
  coverage risk and the "Ações fora do código" (Duffel account approval, Amadeus sandbox signup)
- `_local-adr-policy-001` (application, pricing-source-abstraction) — the existing abstraction
  boundary (`scanSimulator.ts`'s call signature) this spike's adapters must slot into
