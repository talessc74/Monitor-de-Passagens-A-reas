---
name: _local-bdr-policy-014-itinerary-search-transparency
description: The "Modo Tieni" itinerary search (_local-bdr-policy-013) now always records and shows its attempt — which hubs it tried and the best total found — even when the direct fare still wins. Use when touching itinerarySearch.ts, executeScan.ts's itinerary block, or MonitorDetailModal's itinerary section.
apply-to: services/api itinerarySearch.ts/executeScan.ts, packages/types FlightMonitor.lastItinerarySearch, apps/web MonitorDetailModal.tsx
valid-from: 2026-08-06
---

# _local-bdr-policy-014: Itinerary search transparency

## Context and Problem Statement

`_local-bdr-policy-013` fused multi-leg itinerary search into "Modo Tieni" (`searchMode:
'anytime'`), but only surfaced anything to the user when the itinerary *won* (beat the direct
fare by 15%+ margin). The product owner tested it, saw nothing different from before, and asked
"where are the alternative routes? How will we know the full route the site is trying to search?"
— a losing (or coverage-less) search left `lastItineraryLegs` unset and the UI showed literally
nothing, indistinguishable from the feature not running at all.

## Decision Outcome

**`itinerarySearch.ts`'s core logic moves into `searchItinerary`, which always returns `{ hubs,
best }` — the hub graph actually considered and the cheapest itinerary found, whether or not it
qualifies. `findCheapestItinerary` (used by the untouched `ItineraryMonitor` flow) becomes a thin
wrapper returning just `.best`, preserving its existing contract. `executeScanForMonitor` records
the full attempt on `FlightMonitor.lastItinerarySearch` (hubs tried, best total found, the direct
price it was compared against, whether it won) on every `'anytime'` scan — separate from
`lastItineraryLegs`, which stays win-only.**

`MonitorDetailModal` renders a "Busca de itinerário multi-trecho" section whenever
`lastItinerarySearch` is present (any `'anytime'` monitor that has scanned at least once since
this decision): the existing leg-by-leg breakdown when it won, or a plain-language summary
("Testamos conexões via GRU, LIM, BOG, SCL, PTY, MIA, MCO. Melhor combinação achada: R$X — não
ficou 15% mais barata que o direto (R$Y)") when it didn't — never silence.

### Details

- Acceptance criterion: an `'anytime'` monitor that scans and finds no itinerary beating margin
  still has `lastItinerarySearch.hubs` populated with the hub list tried, and the UI shows the
  "testamos conexões via..." summary — not an empty state indistinguishable from pre-
  `_local-bdr-policy-013` behavior.
- Acceptance criterion: `ItineraryMonitor`'s `executeItineraryScan.ts` is unaffected — it still
  calls `findCheapestItinerary` and only ever sees `.best`, no `hubs` field, no behavior change.

## References

- `_local-bdr-policy-013` — the fusion decision this makes transparent
- `_local-bdr-plan-003` — original Fase 9 hub list / margin threshold this attempt record surfaces
