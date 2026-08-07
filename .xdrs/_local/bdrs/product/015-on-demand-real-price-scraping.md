---
name: _local-bdr-policy-015-on-demand-real-price-scraping
description: A new, isolated services/scraper (Playwright/Chromium) opens a real browser to fetch a real price from Skyscanner, but ONLY on a user click ("Buscar preço real agora") — never wired into the automatic scan loop. Use when touching services/scraper, realSearchClient.ts, the /api/monitors/:id/real-search route, or RealSearchModal.tsx.
apply-to: services/scraper (new), services/api realSearchClient.ts/routes/monitors.ts, apps/web MonitorCard.tsx/RealSearchModal.tsx, .github/workflows/deploy.yml
valid-from: 2026-08-06
---

# _local-bdr-policy-015: On-demand real-price scraping

## Context and Problem Statement

After `_local-bdr-policy-010` through `-014` exposed just how narrow and fragile the paid/free
real-price sources are (Travelpayouts: cache-only, SP-RJ-heavy; Sky Scrapper: unofficial
RapidAPI scraper, free-tier quota already exhausted; Duffel: rejects Brazil-incorporated
companies at self-service signup; Amadeus: self-service portal decommissioned), the product owner
proposed a step back: instead of chasing another paid API, have a real browser do the search —
but explicitly **not** as a product feature run automatically for many users (that recreates
exactly the bot-detection problem Sky Scrapper already has, worse, since a self-hosted scraper has
no anti-detection engineering behind it and would run from a fixed, easily-fingerprinted Cloud Run
IP). The agreed middle ground: bring browser-based search into FlySpot, but gate it strictly to a
manual, human-initiated click — the same usage pattern as a person actually shopping for a
flight, which is far less likely to trip anti-bot defenses than a 24/7 automated loop.

## Decision Outcome

**A new `services/scraper` — a Cloud Run service built on the official `mcr.microsoft.com/
playwright` image (Chromium + all system deps preinstalled, avoiding a manual apt-get dependency
list on `node:20-slim`) — exposes one internal endpoint, `POST /internal/real-search`, that opens
a real headless browser against Skyscanner and extracts a price. It is called ONLY by `POST /api/
monitors/:id/real-search`, itself triggered ONLY by a "Preço real agora" button in `MonitorCard`
— never from `executeScanForMonitor`, the scheduler, or any automatic path.**

- **Isolated on purpose**: a separate service/Docker image/Cloud Run deployment, not folded into
  `flyspot-api`. A build failure or runtime crash in this experimental, Chromium-heavy image must
  never be able to block or take down `flyspot-api`/`generator`/`publisher`/`web`, which already
  work. `deploy.yml` builds and deploys `flyspot-scraper` *before* `flyspot-api` so the latter can
  receive its URL via `SCRAPER_INTERNAL_URL`.
- **No `min-instances`**: unlike `generator`/`publisher` (which must stay warm for their
  background loops), `scraper` scales to zero between clicks — cost matches actual on-demand use,
  accepting a cold-start delay (Chromium boot) shown as a loading state in `RealSearchModal`.
- **Authentication**: reuses `INTERNAL_SCAN_TOKEN` (the same secret `generator`→`api` already
  uses) rather than minting a third service-to-service secret — same purpose, same trust
  boundary, per `_local-adr-policy-002`.
- **First site, Skyscanner only**: aggregates many carriers in one search, raising the odds of at
  least one usable price even if the extractor needs iteration. Two extraction strategies in
  cascade (a specific approach, then a resilient regex scan of the rendered page's visible text
  for `R$ <value>` patterns in a plausible flight-price range) because **this code has never run
  against the real site** — this development sandbox's network egress policy blocks
  `skyscanner.com.br` the same way it blocked `api.travelpayouts.com` and `sky-scrapper.p.rapidapi
  .com` earlier in this project's history, so the first live test happens in production, from a
  real user click, not from local/CI verification.
- **Never a dead end**: the response always includes the raw `searchUrl` used, rendered as a
  fallback "Abrir busca no Skyscanner" link in `RealSearchModal` — even a total parsing failure
  still gets the user to a real, live search they can read themselves.

### Details

- Acceptance criterion: `/api/monitors/:id/real-search` never mutates `FlightMonitor` state
  (`currentPrice`, `history`, notifications) — it is a read-only, point-in-time query distinct
  from `/api/monitors/:id/scan`.
- Acceptance criterion: with `SCRAPER_INTERNAL_URL` unset (e.g., before this feature's first
  deploy, or a scraper outage), the route returns 503 with a clear message — never a crash that
  takes the rest of `/api/monitors/*` down with it.
- Known follow-up, not resolved by this decision: the first live click in production may reveal
  the extractor needs tuning (selector drift, anti-bot challenge page, different price formatting)
  — this is expected and does not indicate the architecture is wrong, only that the extraction
  logic needs a real sample to calibrate against.

## References

- `_local-bdr-policy-010` through `-014` — the real-price-source diagnostics that established just
  how constrained the paid/free API options are, motivating this pivot
- `_local-adr-policy-002` — the internal-service-to-service auth pattern (`INTERNAL_SCAN_TOKEN`)
  this reuses rather than duplicating
- `_local-bdr-plan-002` (Fase 7 Duffel/Amadeus spike) — documents why neither GDS aggregator was a
  viable near-term path for a Brazil-incorporated company, the deeper context behind this decision
