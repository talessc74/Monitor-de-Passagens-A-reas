---
name: _local-bdr-policy-010-real-price-source-diagnostics
description: Admin panel gets a live connectivity test for each real price source (Travelpayouts, Sky Scrapper), not just an env-var-presence check — a configured-but-invalid/rate-limited key looks identical to "not configured" from the outside otherwise. Use when touching travelpayoutsClient.ts, skyScrapperClient.ts, routes/admin.ts, or the /admin page.
apply-to: services/api travelpayoutsClient.ts/skyScrapperClient.ts/routes/admin.ts, apps/web app/admin/page.tsx
valid-from: 2026-08-05
---

# _local-bdr-policy-010: Real price source diagnostics

## Context and Problem Statement

Every scan for the user's monitors — including `GRU→MIA`, a route with confirmed real coverage
from `_local-bdr-plan-006`'s spike — was coming back `estimated: true` (simulated). Neither
`travelpayoutsClient.ts` nor `skyScrapperClient.ts` throw or surface failures anywhere visible to
the product owner: both catch every error internally and return `null`, logging only to
`console.error` (Cloud Run runtime logs, not reachable from this session or the product owner
without GCP console access). A present-but-invalid `RAPIDAPI_KEY` (revoked, rotated, or
rate-limited on the free tier) is indistinguishable from an absent one from outside the service.

## Decision Outcome

**Each real price source client exports a `testConnection()` that makes one minimal, cheap live
call and reports `{ configured, ok, httpStatus?, error? }` — distinct from `configured: false`
(no key at all). `GET /api/admin/diagnostics` (admin-only) runs both and returns the results
alongside whether `GEMINI_API_KEY` is set. The `/admin` page renders this with a manual "Testar
agora" button — not run automatically on page load, since it spends real API quota.**

- `travelpayoutsClient.testConnection()` queries `GRU→GIG` — the route confirmed to have cache
  data in `_local-bdr-plan-004` — so `ok: false` here means token/quota/network trouble, not "this
  particular test route happens to have no data."
- `skyScrapperClient.testConnection()` only calls `searchAirport` for `GRU` (airport resolution),
  not a full flight search, to spend the least quota possible on a check that just needs to prove
  the key authenticates.
- Neither function changes the behavior or return type of the existing `getCheapestRealFare`
  functions used by `executeScan.ts` — this is a read-only diagnostic path, additive only.

### Details

- Acceptance criterion: with no `RAPIDAPI_KEY` set, `skyScrapper.configured` is `false` and `ok`
  is `false` with no `httpStatus`/`error` (never attempted a call). With a key that returns 401
  (revoked/invalid), `configured: true`, `ok: false`, `httpStatus: 401`.
- Acceptance criterion: the diagnostics call never runs on `/admin` page load — only on click —
  so viewing the admin panel doesn't silently spend RapidAPI/Travelpayouts quota every time.

## References

- `_local-bdr-plan-004` / `_local-bdr-plan-006` — the spikes that established which routes have
  confirmed real coverage, used here as the fixed test route
- `_local-adr-policy-004` (application) — the `estimated: true/false` labeling this diagnostic
  exists to help debug when it unexpectedly stays `true` everywhere
