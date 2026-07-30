---
name: _local-adr-policy-001-pricing-source-abstraction
description: Price scanning is implemented today by scanSimulator.ts (Gemini), built to be replaced by real Duffel/Amadeus adapters later without touching the rest of the system. Use when touching scanSimulator.ts, monitor scan routes, or planning the real pricing integration.
apply-to: services/api/src/scanSimulator.ts, routes/monitors.ts scan endpoint, future services/generator
valid-from: 2026-07-30
---

# _local-adr-policy-001: Pricing source abstraction

## Context and Problem Statement

The product owner wants the full product built and validated before taking on the real cost
and contractual overhead of Duffel/Amadeus production accounts. Question: how should the
scan logic be structured so the simulated pricing source can later be swapped for a real one
without a rewrite of the monitors/notifications system built around it?

## Decision Outcome

**Scan logic isolated behind a single call site (`scanSimulator.ts`), same call shape a real
adapter will use**

`services/api/src/scanSimulator.ts` owns all Gemini calls for pricing simulation, called from
one place in `routes/monitors.ts` (`POST /api/monitors/:id/scan`). It returns the same shape
(cheapest result, updates `monitor.currentPrice`/`history`, site stats, notification
creation) that a real Duffel/Amadeus adapter will need to return later.

### Details

- Acceptance criterion (verifiable): no file other than `scanSimulator.ts` calls the Gemini
  API for pricing; swapping the simulator for `services/generator`'s real adapters (planned)
  requires changing only this module's internals, not its callers.
- Deterministic offline fallback: when `GEMINI_API_KEY` is absent or the call fails, a
  deterministic simulation runs instead — the scan endpoint never breaks for lack of a key.
- Per the roadmap's build-order decision (`_local-bdr-policy-002`), this simulator stays the
  pricing source through the UX, scheduler, e-mail, and Stripe phases; it is only replaced in
  the phase dedicated to real price search, after a spike validates route coverage.
- When the real adapter lands, it must not silently fall back to simulated prices on
  provider failure — a real product returning an invented price is worse than a clear error.
  This constraint belongs to the future adapter's own EDR when written, not to this document,
  but is noted here so it isn't forgotten when this policy is eventually superseded.

## References

- `_local-bdr-policy-002` — build-order rationale for staying on the simulator
- `_local-edr-policy-001` — `route-stats` endpoint, the second consumer of this same
  simulator, run before a monitor exists
- `ROADMAP.md`, Fase 3 (escopo 3) — Duffel/Amadeus adapter plan and spike requirement
