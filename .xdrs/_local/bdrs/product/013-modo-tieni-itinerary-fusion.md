---
name: _local-bdr-policy-013-modo-tieni-itinerary-fusion
description: The 'anytime' search mode ("Modo Tieni" / "Só me importa o preço") on a regular FlightMonitor now also searches a multi-leg connecting itinerary (via the Fase 9 itinerary engine) and uses it when cheaper than the direct fare by margin, overnight layovers allowed — instead of the separate, frontend-less ItineraryMonitor entity being the only way to get this. Use when touching executeScan.ts, itinerarySearch.ts, MonitorCard/MonitorDetailModal, or FlightMonitor.lastItineraryLegs.
apply-to: services/api executeScan.ts/itinerarySearch.ts, packages/types FlightMonitor/ItineraryLeg, apps/web MonitorCard.tsx/MonitorDetailModal.tsx
valid-from: 2026-08-05
---

# _local-bdr-policy-013: "Modo Tieni" fuses into the itinerary engine

## Context and Problem Statement

The product owner's original intent for `searchMode: 'anytime'` ("Só me importa o preço", the
button the product owner calls "Modo Tieni") was for the system to explore multi-leg alternative
routes — summed legs cheaper than the direct fare, overnight layovers allowed — not just a direct
search with no fixed date. The Fase 9 itinerary engine (`itinerarySearch.ts`, `hubSuggestion.ts`,
`executeItineraryScan.ts`) already implements exactly this logic (Dijkstra over curated hubs,
`MIN_CONNECTION_HOURS` floor, `beatsBaselineByMargin` 15% threshold, liability disclaimer), but as
a completely separate `ItineraryMonitor` entity — Pro-only, with a full backend API
(`/api/itineraries`) but **zero frontend** (no form, no card — confirmed by grep, nothing in
`apps/web` references it). Two more gaps found while investigating: `itinerarySearch.ts`'s
`priceLeg` priced every leg via the Gemini/offline simulator, never a real source; and running the
full hub graph (~7 curated hubs, up to ~50 leg-price calls per search) on every scan would have
quickly exhausted Travelpayouts' quota.

## Decision Outcome

**`executeScanForMonitor` now runs `findCheapestItinerary` for every `searchMode: 'anytime'`
monitor (not the separate `ItineraryMonitor` entity, not Pro-gated), fixed at `maxLegs: 2`
(one connection) and `allowOvernightLayovers: true`. If the itinerary total beats the direct
fare by `beatsBaselineByMargin`'s 15% margin, it becomes a `ScanResult` entry (`site: 'Itinerário
multi-trecho'`) competing on equal footing with every direct site/real-fare result — the existing
cheapest-price/notification/history logic picks it up unmodified if it wins.**

- `itinerarySearch.ts`'s `priceLeg` now tries Travelpayouts first (dateless, same rationale as
  `_local-bdr-policy-012`'s reasoning for skipping Sky Scrapper — no per-leg date to give it),
  falling back to the simulator only when there's no real cache for that specific pair. Each
  `ItineraryLeg` gets its own `estimated` flag; the synthetic `ScanResult`'s `estimated` is true if
  *any* leg was simulated (only real when every leg is).
- A 30-minute in-memory per-process cache (`legPriceCache`, keyed `origin-destination-adults-
  children`) bounds Travelpayouts calls — without it, a single scan's hub graph could make ~50
  calls; the cache means repeated pairs (common — the hub list is only 7 airports) are reused
  across scans and monitors within the TTL window instead of re-querying every time.
- The winning itinerary's legs are persisted as `FlightMonitor.lastItineraryLegs` (cleared via
  `FieldValue.delete()` when a scan's itinerary doesn't win or isn't found) — `MonitorDetailModal`
  renders it as a dedicated leg-by-leg breakdown with per-leg Real/Simulado badges and the
  liability disclaimer; `MonitorCard` shows a one-line banner linking to that detail when present.
- `ItineraryMonitor`/`/api/itineraries` are untouched by this decision — they remain a separate,
  still-frontend-less multi-leg tool for the Pro-only, user-configured-window case (`maxLegs`,
  `maxLayoverHours`, explicit date window). This fusion is specifically the automatic "anytime"
  behavior, not a replacement for that entity.

### Details

- Acceptance criterion: an `anytime` monitor whose direct fare is R$1000 and whose cheapest 2-leg
  itinerary totals ≤ R$850 (15% margin) shows the itinerary as `cheapestResult`, with
  `lastItineraryLegs` populated; if the itinerary totals R$900 (doesn't clear the margin), the
  direct fare wins and `lastItineraryLegs` is absent.
- Acceptance criterion: a `dated` monitor never triggers `findCheapestItinerary` — this is
  specifically "Modo Tieni" behavior, not a change to fixed-date monitors.
- Acceptance criterion: two different `anytime` monitors scanning the same origin within the
  30-minute cache window reuse `legPriceCache` entries — verified by the cache existing at the
  module level in `itinerarySearch.ts`, shared across all calls in the same process.

## References

- `_local-bdr-plan-003` — original Fase 9 itinerary decision (curated hubs, margin threshold,
  liability disclaimer) this fuses into regular monitor scanning
- `_local-bdr-policy-012` / `_local-bdr-policy-011` — the diagnostic tools that surfaced
  Travelpayouts' real behavior and shaped the decision to skip Sky Scrapper per-leg
- `_local-adr-policy-004` (application) — the `estimated: true/false` real-vs-simulated labeling
  this extends to itinerary legs
