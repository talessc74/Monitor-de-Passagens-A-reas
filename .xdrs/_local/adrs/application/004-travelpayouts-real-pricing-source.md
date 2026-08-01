---
name: _local-adr-policy-004-travelpayouts-real-pricing-source
description: Travelpayouts Data API becomes FlySpot's first real (non-simulated) pricing source, slotted into the existing scanSimulator.ts abstraction — used when it has coverage, falling back to the Gemini simulator (explicitly labeled as an estimate) when it doesn't. Use when touching executeScan.ts, scanSimulator.ts, or ScanResult's estimated field.
apply-to: services/api/src/travelpayoutsClient.ts, services/api/src/executeScan.ts, services/api/src/scanSimulator.ts, packages/types (ScanResult.estimated), apps/web (MonitorDetailModal "Real" badge)
valid-from: 2026-08-01
---

# _local-adr-policy-004 (application): Travelpayouts as FlySpot's first real pricing source

## Context and Problem Statement

`_local-bdr-plan-004` found Travelpayouts' Data API has real, working, unblocked access (unlike
Duffel/Amadeus) but narrow coverage — dense on the São Paulo–Rio air bridge, empty on every other
route tested including this project's own canonical example (BSB→MIA). Product owner decided to
start integrating it now anyway, on the reasoning that partial real coverage today beats waiting
indefinitely on Duffel/Amadeus, and that FlySpot's pricing source was always going to end up
multi-sourced regardless.

The technical question this document answers: how does a source with known, uneven coverage slot
into a monitor flow that has always assumed a single pricing source (`scanSimulator.ts`) returns
a full comparison set?

## Decision Outcome

**Real data always wins when available; the simulator is the fallback, never silently blended
under the same label.** `ScanResult` gains a required `estimated: boolean` field — `false` for a
Travelpayouts-sourced result, `true` for anything from `scanSimulator.ts` (Gemini or its offline
fallback). The UI (`MonitorDetailModal`) shows a small "Real" badge next to any `estimated: false`
row so the distinction is visible, not just present in the data model.

### Why this instead of the two alternatives actually considered with the product owner

- **Fall back to the simulator silently, no visible distinction** — rejected: this is exactly the
  failure mode `ROADMAP.md`'s Fase 7 section already warns against ("preço inventado é pior que
  erro") applied at the field level, not just the source level. A user seeing "R$ 650" needs to know
  whether that's a real observed fare or a Gemini guess before deciding to trust an alert on it.
- **Show nothing when there's no real data (hard error, no fallback)** — rejected for this stage:
  it would leave the large majority of routes (everything outside SP-RJ, per the spike's own
  sample) with no monitor functionality at all while Duffel/Amadeus remain blocked with no ETA.
  The chosen middle path (fallback allowed, but never mislabeled) keeps the product usable
  everywhere today while being honest about what's real.

### How it's wired

- `travelpayoutsClient.ts` (new): `getCheapestRealFare(origin, destination)` — a single GET to
  `/v2/prices/latest`, returns the cheapest cached fare as a `ScanResult` (`site` = the `gate` field,
  e.g. "Trip.com" — Travelpayouts returns by reseller, not by marketing carrier, a structural
  difference from Duffel/Amadeus already noted in `_local-bdr-plan-004`), or `null` on missing
  token, no coverage, or any error — never throws.
- `executeScan.ts`: calls `getCheapestRealFare` alongside the existing `runScanSimulation`; if it
  returns a result, it's prepended to the simulated results before sorting/picking the cheapest —
  so a real fare naturally wins the "cheapest" comparison when it exists and is actually cheaper,
  without special-casing the selection logic.
- `scanSimulator.ts`: every result path (Gemini-parsed, offline fallback) is forced through a single
  `markAsEstimated` wrapper at the function's exit points, so `estimated: true` can never be
  forgotten on a new code path added later.
- `TRAVELPAYOUTS_API_TOKEN` (`services/api/src/env.ts`) — optional, same no-op-without-it pattern as
  every other integration in this codebase (`GEMINI_API_KEY`, `RESEND_API_KEY`, Stripe keys).

### Details

- Acceptance criterion (verifiable): scanning a monitor for GRU→GIG returns at least one result with
  `estimated: false` and `site` set to a real gate name (when `TRAVELPAYOUTS_API_TOKEN` is set);
  scanning BSB→MIA (or any route Travelpayouts doesn't cover) returns only `estimated: true` results,
  with no error and no silent substitution of a fake "real" label.
- Known limitation, not solved here: the Data API's cheapest fare isn't date-matched to the
  monitor's actual `departureDate`/`returnDate` — it's the cheapest cached fare for the route in
  general. Acceptable for this stage (the product's own "anytime" search mode already has the same
  looseness by design), but worth revisiting if it causes a real, cheaper-than-actual fare to trigger
  a false "target reached" notification.
- Not addressed here: `ItineraryMonitor`/`itinerarySearch.ts` (Fase 9) still runs 100% on the
  simulator — wiring Travelpayouts into the multi-leg graph search is a separate, larger change
  (per-leg real pricing across a whole candidate graph is a materially bigger integration than a
  single origin→destination lookup) and is explicitly out of scope for this pass.

## Considered Options

- **Wait for full Duffel/Amadeus/broader-coverage source before adding any real pricing** — rejected
  by the product owner's explicit call: partial real data now is worth more than continuing to wait
  with zero real data, given no ETA exists for the blocked sources.
- **Normalize Travelpayouts' `gate` field into an existing `trackedSites` id (latam/gol/azul/decolar)**
  — rejected: `Trip.com`/`Clickavia`/etc. are resellers, not the airlines those ids represent; forcing
  a false mapping would misattribute the fare to a specific airline that didn't necessarily offer it.

## References

- `_local-bdr-plan-004` (product) — the spike whose findings this decision acts on
- `_local-adr-policy-001` (application) — the original pricing-source-abstraction pattern this
  integration follows (pluggable source behind `scanSimulator.ts`'s call shape)
- `ROADMAP.md` Fase 7 — "sem fallback para preço simulado em produção: erro claro é melhor que preço
  inventado" — the principle this ADR's `estimated` field operationalizes at the per-result level
  instead of an all-or-nothing gate
