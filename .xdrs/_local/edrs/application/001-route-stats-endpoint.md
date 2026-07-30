---
name: _local-edr-policy-001-route-stats-endpoint
description: Defines GET /api/route-stats as a read-only reuse of scanSimulator.ts's Gemini call, run before a monitor exists, to power the onboarding price estimate required by _local-bdr-policy-001. Use when implementing or touching route-stats, scanSimulator.ts, or the onboarding price-insight card.
apply-to: services/api (scanSimulator.ts, routes), apps/web onboarding form
valid-from: 2026-07-30
---

# _local-edr-policy-001: Route-stats endpoint

## Context and Problem Statement

`_local-bdr-policy-001` requires the onboarding to show a price estimate (average, minimum,
maximum over the last 60 days) before the user sets a target price. Today, `services/api`
only ever calls Gemini for pricing *after* a monitor already exists, inside
`POST /api/monitors/:id/scan` (`scanSimulator.ts`). There is no query path that runs before
a monitor is created, and the product must stay on the simulated pricing source until the
Duffel/Amadeus integration phase, per the roadmap's build-order decision (`ROADMAP.md`,
"Por que esta ordem").

Question: how should the onboarding price estimate be served without introducing a second
pricing engine or persisting a monitor just to preview a price?

## Decision Outcome

**New `GET /api/route-stats` route, same Gemini model and prompt family as `scanSimulator.ts`, no persistence**

Add `GET /api/route-stats?origin=&destination=&departDate=&departFlexDays=&returnDate=&returnFlexDays=&adults=&children=&infants=` to `services/api`. It calls the same `GEMINI_MODEL` client already configured in `scanSimulator.ts`, with a prompt asking for an
average/min/max over a 60-day lookback instead of a single current price, and returns the
result directly — it never writes to Firestore and never requires an existing `mpa_monitors`
document.

### Details

- Acceptance criterion (verifiable): calling `GET /api/route-stats` with a valid query and a
  valid auth token returns `{ average, min, max, sampleWindowDays, observations }` in BRL,
  and creates zero documents in any `mpa_*` collection.
- Reuse, don't fork: the Gemini client setup (API key, model name, fallback-when-missing-key
  behavior) must be extracted from `scanSimulator.ts` into a shared helper so both the scan
  and route-stats prompts share one source of truth for the simulated-pricing fallback
  behavior (deterministic offline fallback when `GEMINI_API_KEY` is absent).
- This endpoint stays behind the same `authenticate` preHandler as the rest of
  `/api/monitors` — it is only reachable from the onboarding form inside the logged-in app
  shell, not a public endpoint.
- No caching layer yet (unlike the real Duffel/Amadeus adapter planned for the busca-real
  phase, which requires a Firestore `searchCache` for cost control). Route-stats runs against
  the free simulator, so a cache is not required until that phase swaps in a paid source —
  do not add one preemptively.
- Query params follow the shape defined in `_local-adr-policy-001` (`adults`/`children`/
  `infants`, `departFlexDays`/`returnFlexDays`) — do not introduce a parallel shape here.

## References

- `_local-bdr-policy-001` — product decision this endpoint exists to satisfy
- `_local-adr-policy-001` — passenger/date-flexibility shape this endpoint's query params follow
- `ROADMAP.md`, Fase 3 item 7 and Fase 7 (escopo 3) — build-order rationale for staying on
  the simulator until real price APIs are integrated
