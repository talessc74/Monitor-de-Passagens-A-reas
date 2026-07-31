---
name: _local-bdr-plan-004-plan-b-flight-data-source
description: Technical spike, requested by the product owner's advisory board, to validate a fallback real flight-pricing source in case Duffel and/or Amadeus never grant API access (both currently blocked, see _local-bdr-plan-002). Documents why the board's top two candidates (Travelpayouts/Aviasales, Kiwi Tequila) don't actually clear their live-search tier at FlySpot's current scale, and what does. Read before evaluating any third-party flight-data provider as a fallback to the Gemini simulator.
apply-to: services/api (future alternate adapter), packages/types (SearchParams/FlightResult, same shape as _local-bdr-plan-002)
valid-from: 2026-07-31
---

# _local-bdr-plan-004: Plan B flight data source (contingency for Duffel/Amadeus)

## Context and Problem Statement

`_local-bdr-plan-002` documents that both Duffel (Brazil-incorporation block) and Amadeus
(self-service decommissioned 17/07/2026) are stalled on human/sales response with no guaranteed
timeline. The product's advisory board (Conselho Consultivo) requested a technical spike into a
fallback real-pricing source, proposing Travelpayouts/Aviasales and Kiwi.com (Tequila API) as
top candidates, both marketed as self-service with affiliate monetization built in.

## Decision Outcome

**Neither of the board's two suggested candidates is actually usable at FlySpot's current scale —
but Travelpayouts' own lower tier (the Data API, not the Search API) is a real, self-service,
architecturally-compatible fallback, and is the recommended Plan B.**

### Why the board's top two candidates don't clear, as proposed

- **Travelpayouts / Aviasales Flight Search API (live search)**: gated behind a **minimum 50,000
  monthly active users** requirement — confirmed as a hard, non-negotiable prerequisite in
  Travelpayouts' own support documentation, independent of company country. FlySpot has ~0 MAU
  today. This is not a bureaucratic hurdle like Duffel's incorporation-country block — it's a
  business-scale gate that no amount of paperwork resolves before the product has real users.
- **Kiwi.com Tequila API**: no longer a self-service program at all as of this research — new
  partnerships are invitation-only, and third-party API access (where documented) carries the same
  class of MAU/scale gate as Travelpayouts' live search. Worse starting position than Travelpayouts
  for a pre-launch product, not better.
- Both facts contradict the board's Section 3 framing ("self-service, aceita empresas do Brasil") —
  that part is true, but it's not the operative constraint; MAU is.

### What actually clears: Travelpayouts' Data API

- Travelpayouts' own support documentation explicitly tells projects below the 50k MAU threshold
  to use the **Aviasales Data API** instead of the Search API — this isn't a workaround, it's the
  vendor's own recommended path for FlySpot's stage.
- The Data API returns the cheapest observed fare (non-stop, 1-stop, 2-stop) for a route/date
  window — aggregated/historical, not a live real-time search across airlines at request time.
- Registration is via Travelpayouts' standard affiliate signup (free, self-service, no MAU gate
  found for the affiliate program itself or the Data API token) — no Brazil-incorporation block
  found in this research, unlike Duffel (still needs to be confirmed by actually registering, same
  as every other provider in this project's history — documentation review is not the same as a
  completed signup).

### Why this fits the architecture better than a live search API would have

`scanSimulator.ts` and `routeStats.ts` already run on a **periodic cycle** (the `generator`
scheduler ticks and rescans monitors on an interval; `routeStats` itself already returns
average/min/max, not a single live quote) — not an on-demand live search triggered synchronously by
a user click. "Cheapest fare observed for this route recently" (what the Data API returns) is
already the shape of data this system consumes today. A live per-request search API (Duffel,
Amadeus, or a hypothetical MAU-cleared Travelpayouts Search API) would need to be adapted down to
that same periodic shape anyway. The Data API arrives already in the right shape — `_local-adr-
policy-001`'s pluggable pricing-source contract holds here without modification.

### What this spike does NOT establish yet

- Whether Travelpayouts' affiliate signup itself is free of the same kind of blocker Duffel had —
  this requires actually registering, not reading docs (every prior spike in this project confirmed
  real blockers only appear at actual signup, not in marketing copy).
- Real response samples for the routes FlySpot cares about (GRU-GIG, GRU-REC, GRU-LIS, a GOL/Azul
  regional pair) — requires a real token, which requires the signup above.
- Whether the Data API's "cheapest observed fare" cadence and freshness (how recent is "recent"?)
  is tight enough for `_local-bdr-policy-005`'s margin-based alert logic to stay meaningful — an
  aggregated/historical price could lag a live one by hours or days, unlike Duffel/Amadeus's
  real-time quotes.
- Affiliate commission/link mechanics and how a redirect-to-partner flow interacts with the
  existing `purchaseLink.ts` deep-link pattern — explicitly out of scope for this document (product/
  UX decision, per the board's own Section 6), noted here only so it isn't forgotten.

### Recommended next step (mirrors `_local-bdr-plan-002`'s pattern)

1. Product owner registers a real Travelpayouts affiliate account (self-service, free) —
   https://www.travelpayouts.com — same "just do the signup and see what actually happens" approach
   already used for Duffel/Amadeus in this project's history, since real blockers only surface at
   actual signup, not in documentation.
2. If signup clears without a Brazil-specific block: request/generate a Data API token and run a
   small sample of real calls (same route list as `_local-bdr-plan-002`'s matrix, or a subset) to
   confirm response shape, freshness, and GOL/Azul/LATAM coverage.
3. Register the outcome as an amendment to this document (same convention as `_local-bdr-plan-002`'s
   amendments), including real response samples — not as a new document, to keep the Plan B thread
   in one place.

## Considered Options

- **Pursue Travelpayouts/Kiwi live search APIs as the board proposed** — rejected: both are gated
  behind a 50k MAU requirement FlySpot cannot meet pre-launch; pursuing them now would repeat the
  same "spend a contact-form cycle waiting on a gate we can't clear" pattern already hit twice with
  Duffel/Amadeus, this time predictably instead of by surprise.
- **Skyscanner via RapidAPI / unofficial access** (board's third, lowest-priority candidate) — not
  evaluated in this pass, per the board's own framing ("não avançar sem validação jurídica"); stays
  parked unless Travelpayouts' Data API also turns out non-viable at actual signup.
- **Wait on Duffel/Amadeus only, no Plan B** — rejected: this is exactly the single-point-of-failure
  risk the board's briefing was written to close; a viable, architecturally-compatible fallback that
  costs one free signup to validate is worth pursuing in parallel, not instead of continuing to wait.

## References

- `_local-bdr-plan-002` (product) — the Duffel/Amadeus spike this document is a contingency for;
  same route-matrix concept reused once a Data API token exists
- `_local-adr-policy-001` (application) — the pricing-source abstraction this Plan B must slot into,
  same as the primary plan
- `services/api/src/routeStats.ts` — the existing periodic/aggregated pricing shape this Plan B's
  Data API response naturally matches
