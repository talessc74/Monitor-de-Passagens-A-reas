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

## Amendment (2026-08-01): real signup completed, real coverage test — mixed result

Product owner registered a real Travelpayouts affiliate account and obtained a Data API token
(`Profile → API token`, no approval gate — confirmed exactly as the vendor's own documentation
states: "Access is allowed without restrictions, but you must have a token"). This closes the open
item from this document's original "what this spike does NOT establish yet" section: **the
Brazil-incorporation-style block Duffel had does not exist for Travelpayouts.**

### Real test results (`GET /v2/prices/latest`, cache-based, not live search)

| Route | Result |
|---|---|
| GRU→GIG (originally queried, API normalized to `SAO`→`RIO` city codes) | **6 cached fares returned**, R$681–R$3668, gates `Trip.com`/`Clickavia` |
| GRU→REC | Empty (`data: []`) |
| GRU→LIS | Empty (`data: []`) |
| GRU→MIA | Empty (`data: []`) — notable: this is a high-volume route in absolute terms, empty result here is not explained by low traffic alone |
| MOW→HKT (control query, a route Travelpayouts' own docs use as an example) | **30 cached fares returned**, dense coverage across many dates |

### What this means

- **Auth and access mechanics are fully confirmed working** — no blocker at all here, unlike Duffel.
- **Coverage is real but skewed away from Brazilian routes.** The Data API is a cache built from
  real search traffic across Travelpayouts' whole affiliate network, which is CIS/Russia/Europe-
  heavy by origin (Aviasales' core market) — MOW→HKT (a market example route) returned dense data,
  while three different Brazil-outbound routes, including a high-absolute-volume one (GRU→MIA),
  returned nothing. GRU→GIG (Brazil's own highest-volume domestic trunk) did return data, so
  coverage is not zero for Brazil — it's inconsistent and route-dependent in a way this project
  doesn't yet have a model for.
- **Also note the `gate` field**: results surface OTA resellers (`Trip.com`, `Clickavia`,
  `Kupi.com`, `Wingie`, `Aviakassa`), not marketing carriers (no GOL/Azul/LATAM appeared in any
  result). This is a structural difference from Duffel/Amadeus (which return carrier-level offers)
  and from FlySpot's existing `trackedSites` concept (`latam`/`gol`/`azul`/`decolar`) — mapping a
  `gate` onto an existing "site" in the product's UI is not a like-for-like swap.

### Revised recommendation

**Downgrade from "viable Plan B" to "partially viable, needs a longer observation window before
committing."** A single snapshot in time under-samples a cache that refills continuously (2-7 day
retention per the vendor's own docs) — a route empty right now may populate within days as more
users search it elsewhere on the network. Concretely:

1. Do not build a production adapter against this source yet based on this single test.
2. Re-run the same 4 Brazil routes (GRU-GIG, GRU-REC, GRU-LIS, GRU-MIA) at least once a day for
   3-5 days to see whether coverage improves, stays sparse, or is genuinely close to zero outside
   GRU-GIG. This is cheap (the API has no approval gate and, per the vendor's docs, generous rate
   limits) and doesn't block anything else.
3. If coverage stays sparse after that window, Travelpayouts' Data API is a real integration (auth
   works, format is clean, no Brazil block) but not a meaningful hedge against Duffel/Amadeus for
   FlySpot's actual route mix — worth keeping registered as "confirmed accessible, low Brazil
   coverage" rather than pursued further, and the Skyscanner/RapidAPI option (parked in the original
   analysis above) would need to be revisited instead.
4. The `gate`-vs-carrier mismatch is a separate, real product question (does FlySpot show "Trip.com"
   as the source instead of "LATAM"?) that needs a decision even if coverage improves — not
   something to silently paper over in an adapter.

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
