---
name: _local-bdr-plan-006-plan-b-skyscrapper
description: Follow-up spike to _local-bdr-plan-004 (Travelpayouts, narrow SP-RJ coverage) and _local-bdr-plan-005 (Moblix, abandoned before signup). Validates Sky Scrapper (RapidAPI, apiheya/sky-scrapper), an unofficial Skyscanner scraper flagged as the board's third, lowest-priority Plan B candidate. Product owner walked real signup and ran live route queries through the RapidAPI browser test console. Read before evaluating any further third-party flight-data provider as a fallback to the Gemini simulator, and before wiring this source into services/api.
apply-to: services/api (future alternate adapter), packages/types (SearchParams/FlightResult, same shape as _local-bdr-plan-002/004/005)
valid-from: 2026-08-03
---

# _local-bdr-plan-006: Plan B flight data source — Sky Scrapper (RapidAPI, real coverage confirmed)

## Context and Problem Statement

`_local-bdr-plan-004` found Travelpayouts' Data API real but narrow (dense only on the SP-RJ air
bridge, empty on BSB and international routes — including this project's own canonical example,
BSB→MIA). `_local-bdr-plan-005` found Moblix abandoned before a single API call, gated behind a
R$523/month plan with a card-auto-charge trial and no way to preview coverage first. Both left the
board's third candidate — Skyscanner via RapidAPI, explicitly parked pending "não avançar sem
validação jurídica" — as the remaining untested option. This session tested it for real, same
protocol as the two prior spikes: sign up, run live queries against actual routes, read raw
responses instead of trusting marketing copy.

## Decision Outcome

**Real coverage confirmed for FlySpot's canonical gap route (BSB→MIA), on a genuinely free tier,
with functioning documented endpoints — the strongest Plan B result of the three sources tested so
far.** The legal/compliance caveat from `_local-bdr-plan-004` still applies and is not resolved by
this document: this remains an unofficial third-party scraper of Skyscanner's data, not an official
API, and production use requires legal validation first.

### What was tested

Provider: `apiheya/sky-scrapper` on RapidAPI (host `sky-scrapper.p.rapidapi.com`). Distinct from a
different, unrelated "Sky Scrapper" listing on RapidAPI that turned out to be a generic web-scraping
product (`Scrape`/`Selector` endpoints, nothing flight-related) — the product owner initially landed
on that wrong listing; this document only concerns the correct one, confirmed by its `searchAirport`
/ `getNearByAirports` / `searchFlights` endpoints matching the expected flight-search shape.

Pricing (RapidAPI, confirmed 2026-08-03): BASIC $0.00/mo (subscribed, no card-decline or trial-clock
risk observed, unlike Moblix), PRO $9.99/mo, ULTRA $49.00/mo, MEGA $120.00/mo.

### Real test results (`GET /api/v2/flights/searchFlights`, via `searchAirport` for skyId/entityId lookup first)

| Route | Result |
|---|---|
| GRU→MIA (São Paulo–Miami) | **7 itineraries returned**, $256–$770, Avianca via Bogotá, real flight numbers/times |
| BSB→MIA / BSB→JFK (Brasília–Miami/New York — this project's own canonical gap route, empty in both Travelpayouts amendments) | **10 itineraries returned**, $412–$770, Copa via Panama City, GOL via GRU/FLL, Azul via Viracopos/Fort Lauderdale |
| LHR→JFK (accidental — RapidAPI's browser test console left stale example values in the query params on first attempts) | Returned real London–New York itineraries — confirms the endpoint itself works correctly; the early "wrong route" results were a test-console UI artifact (stale placeholder values not overwritten), not an API defect |

First calls to both GRU→MIA and BSB→MIA returned `context.status: "incomplete"` with zero
itineraries — this is the API's async scraping-in-progress state, not a coverage gap. A second call
with the same parameters returned full results both times. **Any integration against this source
must handle `status: "incomplete"` as "retry, not empty," not treat a first-call empty result as
confirmed no-coverage** — this is a live implementation detail, not just a testing quirk, since a
production scan loop would hit this on every request.

### Why this clears where Travelpayouts and Moblix did not

- Unlike Travelpayouts' Data API (a cache of real search traffic, structurally biased toward
  Aviasales' CIS/Europe-heavy affiliate network), Sky Scrapper performs a scrape of Skyscanner's own
  live search, so results are not dependent on some other user having searched the same route
  recently — it found BSB→MIA on the first substantively-complete call.
- Unlike Moblix, there is a genuinely free tier with no card required to reach it and no trial clock
  — the product owner could test real routes with zero financial risk, the same property that made
  Travelpayouts worth testing in the first place.
- Results include marketing-carrier-level detail (airline, flight number, times, stops, connecting
  airports) rather than Travelpayouts' OTA-`gate` field — closer in shape to what Duffel/Amadeus
  would have returned, and more directly mappable onto FlySpot's existing `trackedSites` /
  `FlightMonitor` concepts than Travelpayouts' `gate`-vs-carrier mismatch was.

### What this spike does NOT establish yet

- **Legal/compliance clearance.** This is unchanged from `_local-bdr-plan-004`'s original framing:
  Skyscanner has no official public API, and this is a third-party scraper of it. The board's
  requirement to not proceed to production without legal validation stands untouched by a positive
  coverage result — a good technical fit does not resolve a legal question.
- **Rate limits and real usage cost at FlySpot's scan cadence.** The `generator` scheduler ticks
  monitors on an interval (free/pro cadence per `_local-adr-policy-003`) — this spike ran a handful
  of manual browser-console calls, not a sustained polling load. BASIC-tier rate limits (not yet
  read from the vendor's docs in this session) need checking against realistic monitor-count ×
  scan-interval math before assuming BASIC stays free at production scale.
  What happens on `status: "incomplete"` under an actual automated scheduler needs a defined retry
  policy (fixed delay? poll `searchIncomplete` by `sessionId`? how many attempts before giving up?),
  not just "call it again," which is fine for a human in the RapidAPI console but not a defined
  contract for `services/api`.
- **Terms of Service risk specific to scraping**, distinct from the generic third-party-API legal
  caveat: RapidAPI marketplace listings for unofficial scrapers can be taken down or changed by their
  maintainer without notice (this project's own `apiheya`/`sky-scrapper` naming collision with an
  unrelated scraping product on the same marketplace is a small preview of how fluid the
  unofficial-provider space is) — a production dependency here has a different risk profile than a
  vendor-published, contractually-backed API.
- Broader route sample beyond GRU-MIA and BSB-MIA/JFK — international routes, other Brazilian
  regional pairs (GOL/Azul-specific corridors), and whether `currency`/`market`/`countryCode`
  parameters need tuning for BRL-denominated results (test ran in default USD).

## Amendment (2026-08-03): product owner authorizes development-stage integration, legal caveat deferred to a user-facing disclaimer

Product owner reviewed the legal/compliance implication in plain terms (unofficial scraper, third
party's own ToS risk, not FlySpot's own scraping) and decided **not to block development on legal
validation** at this stage: FlySpot is pre-launch, pre-revenue, with no real users depending on this
data yet. Explicit decision: proceed with building the adapter now; the legal caveat is deferred to
becoming a **user-facing disclaimer** (e.g. "preços estimados via fontes de terceiros não-oficiais")
rather than a hard gate before writing any code.

This changes this document's own "Considered Options" framing below — "build now, flag-gated" was
the abandoned middle path; the actual decision is closer to building it as a real adapter and
deciding the disclaimer/production-exposure question at the point features actually ship, not before
implementation starts. The legal validation requirement from `_local-bdr-plan-004` is **not
withdrawn** — it is deferred, and must be revisited before this source is relied upon for a paying
user's purchase decision at scale, not treated as permanently resolved by this amendment.

## Considered Options

- **Treat the two "incomplete/empty" first-call results as confirmed no-coverage** — rejected: a
  second identical call returned full results both times, so this would have been a false negative
  caused by not understanding the API's async behavior, the same category of mistake this project's
  "test for real" protocol exists to catch.
- **Stop after the wrong "Sky Scrapper" (web-scraping) listing** — rejected: the product owner
  correctly flagged that its endpoints (`Scrape`/`Selector`) didn't match what was expected, which is
  what led to finding the correct `apiheya/sky-scrapper` flight-search listing instead.
- **Proceed straight to building a production adapter now that coverage looks good** — rejected for
  this document: the legal-validation gate from `_local-bdr-plan-004` is still open and unresolved by
  a coverage result, and rate-limit/retry-policy questions above are unanswered; this document
  registers the coverage finding, not a go-ahead to integrate.

## References

- `_local-bdr-plan-004` (product) — the Travelpayouts spike that first parked Skyscanner/RapidAPI as
  the board's third candidate, pending legal validation; that requirement carries forward unchanged
- `_local-bdr-plan-005` (product) — the Moblix spike this follows the same "test for real" protocol
  from
- `_local-adr-policy-001` (application) — the pluggable pricing-source contract any future adapter
  (Sky Scrapper or otherwise) would need to slot into
- `_local-adr-policy-004` (application) — the `estimated: boolean` pattern real vs. simulated prices
  already use, same shape a Sky Scrapper adapter would need
