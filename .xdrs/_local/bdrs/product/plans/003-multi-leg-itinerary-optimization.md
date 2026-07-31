---
name: _local-bdr-plan-003-multi-leg-itinerary-optimization
description: Planning document for a new FlySpot product surface — instead of pricing a single origin→destination route, build the cheapest sequence of separate flight legs (potentially with overnight layovers on different dates) that gets the user to their destination, monitored over time like a regular FlightMonitor. Read before starting implementation of "Itinerários" (working name); defines scope, phasing, data model, and the risks that must be surfaced to users before this ships.
apply-to: packages/types (new entities), services/api (new routes/repositories), services/generator (recompute loop), apps/web (new flow)
valid-from: 2026-07-31
---

# _local-bdr-plan-003: Multi-leg itinerary optimization ("Itinerários")

## Context and Problem Statement

FlySpot's existing `FlightMonitor` prices exactly one origin→destination route (direct or with
airline-chosen connections, priced as a single ticket). The product owner's idea: for some routes,
a cheaper total trip exists by chaining together **separately-ticketed** legs through intermediate
cities — potentially with an overnight stay on a different date between legs — than any single
through-ticket offers. Example given: Brasília → Miami priced as one route might lose to
Brasília → Lima → (overnight) → Cayenne → Orlando → Miami priced as four independent tickets.

This is a materially different product surface from route monitoring: it optimizes a **graph of
legs** for total cost, not a single route for its own price. It deserves its own planning pass
before any code, per the product owner's explicit request.

## Decision Outcome

**Build "Itinerários" as a new, Pro-only, monitored product surface inside FlySpot, validated first
against the existing Gemini simulator before wiring to real Duffel/Amadeus data.** (These three
calls were made directly with the product owner — see the three decisions below — the rest of this
document works out their consequences.)

### The three product decisions already made

1. **Monitored, not one-off.** An itinerary search becomes an `ItineraryMonitor` — same lifecycle
   pattern as `FlightMonitor` (`services/generator`'s scheduler recomputes it periodically,
   `services/publisher` notifies on a price drop), not a "calculate once and forget" tool. This
   reuses the outbox/notification/scheduler infrastructure wholesale instead of building a second
   parallel system.
2. **Simulated first.** The leg-search-and-combine algorithm is built and validated against
   `scanSimulator.ts` (Gemini-simulated per-leg prices), decoupled from `_local-bdr-plan-002`'s
   Duffel/Amadeus spike and adapter work. When Fase 7 lands real per-leg pricing, this feature
   swaps its price source the same way `executeScanForMonitor` will (same abstraction boundary,
   `_local-adr-policy-001` application).
3. **Pro-only.** Computing an itinerary means pricing *every candidate leg*, not one route — an
   order of magnitude more source-API calls per recompute than a regular monitor. Gating to Pro
   controls cost from day one and matches `PLAN_LIMITS`' existing free/pro cost-tiering logic
   (`packages/types`).

### Why a graph-search problem, not a rules engine

The core computation is: given an origin, a final destination, a max number of legs, and a date
window, find the minimum-total-price path through a graph where nodes are airports and edge weight
is the cheapest fare for that single leg on (approximately) that date. This is shortest-path, not a
lookup table — Dijkstra/A* over a **candidate-limited** graph (see Details) is the right shape, not
brute-force enumeration of every possible routing (combinatorially explodes past ~4 legs).

### Details

**Data model (`packages/types`), additive, no changes to `FlightMonitor`:**

- `ItineraryMonitor` — new entity, sibling to `FlightMonitor`: `id`, `userId`, `origin`,
  `finalDestination`, `maxLegs` (product default TBD, suggest 4), `maxLayoverHours` (caps how long a
  same-day connection can be, separate from the "overnight allowed" toggle),
  `allowOvernightLayovers: boolean`, `dateWindowStart`/`dateWindowEnd`, `targetPrice`,
  `currentBestItinerary: ItineraryLeg[] | null`, `history[]` (mirrors `FlightHistoryEntry` but for a
  whole itinerary's total price), `status: 'active' | 'paused'`, `nextScanAt`,
  `scanningLockedUntil` — deliberately parallel to `FlightMonitor`'s shape so the scheduler/outbox
  code can treat both uniformly where possible.
- `ItineraryLeg` — one ticketed segment: `origin`, `destination`, `carrier`, `departureDate`,
  `price`, `layoverAfterHours` (null if this is the last leg) — an ordered array of these is the
  itinerary.
- Firestore collection: `mpa_itinerary_monitors` (prefix convention per `CLAUDE.md` — shared project
  `lista-ai-f2916`).

**Algorithm (new module, `services/api/src/itinerarySearch.ts` or similar):**

1. Build a **candidate hub list**, not the full global airport graph — MVP scope is a curated list
   of major hub airports reachable from the origin (start with a static list per region: LATAM hubs
   for BR-origin trips, expandable later) rather than an open-ended graph. This is what keeps the
   search tractable and the API-call count bounded; unconstrained global-graph search is explicitly
   out of scope for v1.
2. For each candidate hop, call the existing per-leg pricing function (today:
   `runScanSimulation`'s shape reused for a single leg; later: the real `searchFlights(params)`
   adapter from `_local-bdr-plan-002`) — this is the expensive part, and why caching
   (`_local-bdr-plan-002`'s planned `searchCache`) is shared infrastructure this feature leans on
   hard, not something it can skip.
3. Run Dijkstra (or A* with a straight-line/hub-distance heuristic) over the resulting weighted
   graph, respecting `maxLegs` as a hard cap on path length and `allowOvernightLayovers` as a
   constraint on which edges are eligible (same-day-only edges vs. edges that span a date change).
4. Compare the cheapest found multi-leg total against a single-ticket baseline (reuse the existing
   route-stats/scan logic for the direct origin→destination price) — **only surface a multi-leg
   itinerary if it beats the single-ticket baseline by a meaningful margin** (a percentage
   threshold, product decision, suggest starting at 15-20% cheaper to be worth the extra risk/
   complexity described below), otherwise the monitor just reports the direct price like a normal
   `FlightMonitor` would.

**Mandatory risk disclosure (UX + legal surface, not optional polish):**

- Separately-ticketed legs have **no connection protection** — if leg 2 is delayed, the user misses
  leg 3 with no airline recourse, no rebooking, no compensation (this is fundamentally different
  from an airline-issued connecting itinerary). This must be surfaced clearly at itinerary-creation
  time, not buried in fine print — this is a real financial/travel risk to the user, and FlySpot
  recommending the itinerary carries some responsibility to make that risk legible.
- Transit-visa requirements: some candidate hub countries require a transit visa even for
  passengers who never leave the airport (varies by nationality, not just by country-pair). v1
  ships with a static, clearly-labeled-as-non-exhaustive reference table and a standing disclaimer
  ("confirme exigências de visto de trânsito antes de comprar") — this is explicitly **not** legal
  advice and must not be presented as a guarantee of transit eligibility.
- Baggage: separate tickets typically mean re-checking baggage at each stop (can't check through to
  final destination) — worth a line item in the itinerary display, not just the visa/delay risks.

### Amendment (2026-07-31): minimum connection time is a hard filter, not a suggestion

Two follow-up product decisions, made after v1's first implementation PR:

1. **Minimum connection time is enforced by the algorithm itself, not surfaced as a warning after
   the fact.** The graph search never generates an edge with less than `MIN_CONNECTION_HOURS`
   between arrival and the next departure — if no path satisfies that floor, the itinerary search
   falls back to whatever direct/baseline option exists rather than ever returning a route with an
   unsafe connection. This is implemented in `services/api/src/itinerarySearch.ts` as
   `MIN_CONNECTION_HOURS` (v1 value: 1.5h, a conservative single floor — v1 doesn't yet distinguish
   domestic from international minimums, which typically differ; Fase 7's real schedule data can
   refine this per airport-pair once it exists).
2. **Explicit liability disclaimer, required acknowledgment, not fine print.** The API now exports
   `LIABILITY_DISCLAIMER` (same file) and returns it on itinerary creation; the create endpoint
   (`POST /api/itineraries`) requires `riskAcknowledged: true` in the request body and rejects the
   request otherwise (Zod `z.literal(true)`) — this operationalizes the "requires acknowledgment
   before an `ItineraryMonitor` can be created" acceptance criterion below into an actual API
   contract, not just a UI-layer intention. The disclaimer text explicitly states FlySpot is not
   responsible for delays, cancellations, or airline system failures that break a connection
   between independently-ticketed legs.

This changes the phasing note below only in scope, not structure: v1 already ships both the
connection-time floor and the disclaimer/acknowledgment contract at the API level — what's still
pending is the `apps/web` UI actually rendering the disclaimer and collecting the acknowledgment
from a real user (today only the API-level contract exists; nothing stops a non-browser API caller
from passing `riskAcknowledged: true` without having shown anything to a human).

### Amendment (2026-07-31): Gemini enriches the candidate hub list, never decides the route

Product owner asked directly whether an LLM (or a specialized "itinerary agent") should drive the
route selection. Decision: **no** — the price-optimal combination is a numeric shortest-path
problem (Dijkstra), and an LLM reasoning over candidate routes in text would be slower, more
expensive per call, non-deterministic, and carries no guarantee of finding the actual cheapest
combination. The algorithm stays the sole decision-maker.

Where an LLM does help, and is now wired in (`services/api/src/hubSuggestion.ts`): Gemini is asked,
given the specific origin/finalDestination pair, to suggest up to 5 *additional* candidate hub
airports beyond the static `CANDIDATE_HUBS` list — genuinely creative/regional routing knowledge an
LLM has and a static list doesn't. Those suggestions are merged into the graph's node list before
Dijkstra runs; Dijkstra still picks the cheapest path over that expanded graph. Same role-separation
already established elsewhere in the codebase (Fase 7: "Gemini recebe os preços reais e gera o
texto de análise" — narrates/enriches, never decides price or route). Fails open: no
`GEMINI_API_KEY`, an empty response, or any API error all fall back to the static `CANDIDATE_HUBS`
list alone — the suggestion step never blocks or breaks the search.

### Amendment (2026-07-31): generator scheduler wired, e-mail delivery deferred

`services/generator` now recomputes `ItineraryMonitor`s on its own, mirroring `FlightMonitor`'s
existing scheduler (`itineraryScheduler.ts`, parallel loop to `scheduler.ts`): polls
`mpa_itinerary_monitors` for `status: 'active'` + `nextScanAt <= now`, takes a per-document lease
via transaction (same pattern, same `LEASE_DURATION_MS`), calls the new
`POST /internal/itinerary-scan/:id` route (`authenticateInternal`, same shared secret as
`/internal/scan/:id`), and reschedules using `PRO_SCAN_INTERVAL_HOURS` directly — no per-user plan
lookup, since `ItineraryMonitor` creation is already Pro-gated (`routes/itineraries.ts`). Known gap,
not resolved in this pass: a plan downgrade after creation doesn't auto-pause existing
`ItineraryMonitor`s the way `pauseExcessMonitorsForUser` does for `FlightMonitor` — a future task if
it turns out to matter in practice.

The scan logic itself was extracted into `executeItineraryScan.ts` (shared between the authenticated
and internal routes, same shape as `executeScan.ts`/`_local-adr-policy-002`) and now creates an
in-app `NotificationLog` when the cheapest itinerary total drops at/below `targetPrice` or changes —
**but does not yet create an outbox event**. Reason: `services/publisher`'s outbox consumer resolves
`monitorId` by looking it up in `mpa_monitors` only (`outboxConsumer.ts`); pointing an outbox event
at an `mpa_itinerary_monitors` id would create an event the publisher can never resolve. Sending
itinerary notification e-mails for real is deferred until `services/publisher` is extended to check
both collections (or the `OutboxEvent` shape gets a discriminator) — in-app notifications work today,
e-mail delivery for them does not yet.

### Amendment (2026-07-31): ARGUS deliberation — UX brief for the pending screen, QA validation gap closed

Product owner convened Galera de UX (Compass, Empiricus, PolarBear) and Galera de QA (Pareto,
Probe, Scaffold) to validate the feature before `apps/web` work starts. Converged output, no open
tensions:

**UX brief for whoever builds the `apps/web` creation screen:**
- [COMPASS] `riskAcknowledged` cannot be a pre-checked or discreet checkbox — the forcing function
  must be an explicit step (e.g. a modal requiring scroll-to-end before enabling "Create").
- [EMPIRICUS] The scroll-forced-modal pattern itself needs empirical validation with real users
  before being locked in as final — until then, the only hard requirement is that the disclaimer
  cannot visually compete for attention with the rest of the form (no small grey footer text).
- [POLARBEAR] The creation screen must be discoverable from the main dashboard nav today — there is
  none yet — and, being Pro-only, needs a clear "Pro" label in navigation itself, not a surprise 403
  only at submit time.

**QA finding, already fixed in this same pass:** [PARETO] identified the actual defect-prone 20%
here isn't the graph algorithm (already at 10 test cases) — it's `createItinerarySchema`'s validation
(`riskAcknowledged` requirement, the `maxLayoverHours`-vs-`MIN_CONNECTION_HOURS` cross-field rule),
which had zero test coverage. [SCAFFOLD] flagged the schema wasn't exported from the route module,
making it untestable without booting Fastify — fixed by extracting it to
`services/api/src/schemas/itinerary.ts` (same pattern as the existing `schemas/passengerDate.ts`).
6 new tests added (`schemas/itinerary.test.ts`): `riskAcknowledged` required/rejected when
false/absent, `maxLayoverHours` below the safety minimum rejected without overnight but accepted
with it. [PROBE] additionally recommends a mission-based exploratory charter once the screen exists,
specifically attempting to bypass the disclaimer forcing function via DevTools — noted here for
whoever picks up the `apps/web` work, not yet executed (no screen to explore against).

### Phasing

1. **v1 (this plan's scope):** simulated pricing, monitored, Pro-only, static hub candidate list,
   Dijkstra over ≤4 legs, mandatory risk disclosure UI, direct-price baseline comparison.
2. **v2 (after Fase 7 lands):** swap simulated per-leg pricing for real Duffel/Amadeus per-leg
   calls — same algorithm, same data model, just the price source changes (per decision 2 above).
3. **Not in scope for v1, explicitly deferred:** open-ended global airport graph (candidate list
   only); automatic visa-eligibility checking (static reference table only); free-plan access.

### Acceptance criteria (verifiable)

- Given a route where the static simulator can be made to price a 2-hop combination cheaper than
  the direct route (test fixture, not live data), the algorithm returns that combination and *not*
  the direct price.
- An itinerary respecting `maxLegs: 2` never returns a 3+ leg result.
- The risk-disclosure UI is shown and requires acknowledgment before an `ItineraryMonitor` can be
  created — not a dismissible toast that can be missed.
- A free-plan user attempting to create an `ItineraryMonitor` is blocked with a clear upgrade
  prompt, consistent with how other Pro-gated actions behave today.

## Considered Options

- **One-off search tool instead of a monitor** — rejected per product owner's explicit choice
  (see decision 1) — a monitored surface reuses the scheduler/outbox/notification infra instead of
  needing a second delivery mechanism built from scratch.
- **Wait for Fase 7 real data before starting** — rejected per product owner's explicit choice (see
  decision 2) — the graph-search algorithm and its correctness are independent of where leg prices
  come from, and building it now means Fase 7's adapters slot into an already-working feature
  instead of this feature waiting in a queue behind Fase 7.
- **Available on both plans with a lower limit on Free** — rejected per product owner's explicit
  choice (see decision 3) — per-leg pricing multiplies API cost, and this is exactly the kind of
  cost-tiering `PLAN_LIMITS` already exists to express.
- **Full global airport graph in v1** — rejected as scope creep: unbounded graph search either
  needs heavy pruning infrastructure (which is itself a project) or produces impractically slow/
  expensive recomputes; a curated hub list gets the core value (creative multi-hop combinations)
  without that infrastructure cost, and can be widened later once the algorithm is proven.

## References

- `_local-bdr-plan-002` (product) — the Duffel/Amadeus spike this feature's v2 depends on for real
  per-leg pricing, and whose planned `searchCache` this feature's v1 recompute loop should also use
  to control simulated-mode API/compute cost
- `_local-adr-policy-001` (application) — the existing pricing-source-abstraction pattern
  (`scanSimulator.ts` swappable for real adapters) this feature's v1→v2 transition mirrors
- `packages/types` `PLAN_LIMITS` — the existing free/pro cost-tiering this feature's Pro-only gate
  extends
