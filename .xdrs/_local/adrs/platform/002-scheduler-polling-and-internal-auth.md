---
name: _local-adr-policy-002-scheduler-polling-and-internal-auth
description: Fase 4's scheduler runs as an internal polling loop inside a new services/generator Cloud Run service, which triggers scans on services/api through a shared-secret-protected internal route (not the user-authenticated route). Use when touching services/generator, the internal scan route, or anything reading/writing nextScanAt/scanningLockedUntil.
apply-to: services/generator (new), services/api's internal scan route and env
valid-from: 2026-07-30
---

# _local-adr-policy-002: Scheduler polling and internal service auth

## Context and Problem Statement

`ROADMAP.md`'s Fase 4 section already worked out the scheduler architecture in detail
(polling instead of `onSchedule`/Cloud Scheduler triggers, to stay off the Firebase Blaze
plan — see `_local-adr-policy-001`, platform, for why Cloud Functions is avoided at all).
That architecture was decided before this repo had a `.xdrs` folder, so it was never archived
as a policy — only as prose in the roadmap. Separately, actually building it raises a
question the roadmap prose didn't nail down: the existing scan logic
(`POST /api/monitors/:id/scan`) requires a Firebase user ID token; a background scheduler has
no user to authenticate as. How does `generator`'s loop trigger a scan on `api` without one?

## Decision Outcome

**`generator` polls Firestore directly and calls a new internal-only route on `api`,
authenticated by a shared secret header instead of a user token**

Every 60s, `services/generator` queries `mpa_monitors` for `status == 'active' && nextScanAt
<= now` (composite index required), attempts a Firestore-transaction lease per document
(`scanningLockedUntil`), and for each leased monitor calls `POST /internal/scan/:id` on
`api` with an `X-Internal-Token` header matching the `INTERNAL_SCAN_TOKEN` env var shared by
both services. `api` extracts its existing scan logic
(`services/api/src/routes/monitors.ts`'s scan handler) into `executeScanForMonitor()`, reused
by both the user-authenticated route (manual "Varrer Agora") and the new internal route.

### Details

- Acceptance criterion (verifiable): `POST /internal/scan/:id` without a valid
  `X-Internal-Token` returns 401 and does not run a scan; with the correct token it runs the
  same `executeScanForMonitor()` path as the authenticated route.
- Acceptance criterion (verifiable): two `generator` instances racing on the same monitor
  cannot both scan it — the Firestore transaction that sets `scanningLockedUntil` only
  succeeds for one of them (the lease read-check-write happens inside the transaction, not as
  a separate read then write).
- `nextScanAt` after a successful scan is `now + intervalForPlan(monitor.userId's mpa_users
  plan)` — free: `FREE_SCAN_INTERVAL_HOURS` (default 6h), pro: `PRO_SCAN_INTERVAL_HOURS`
  (default 1h), both env-configurable on `generator`.
- A failed scan (network error, Gemini failure that also fails the offline fallback) clears
  the lease but does not advance `nextScanAt` far — it stays due, so the next tick retries it,
  bounded by `MAX_CONCURRENT_SCANS` so one broken monitor can't starve the queue.
- This is an interim shape. Fase 7's real Duffel/Amadeus adapter plan already says "`api`
  chama `generator` via HTTP interno" (the reverse direction) once `generator` owns real price
  search — at that point this internal-auth pattern gets reused, not redesigned, just pointed
  the other way.

## Validated in production (2026-07-30)

- `flyspot-generator` deployed via `deploy.yml` run #9, `--min-instances=1` applied
- Composite Firestore index (`mpa_monitors`, `status` + `nextScanAt`, both ascending)
  created via the auto-generated link from the first `FAILED_PRECONDITION` error in
  `flyspot-generator`'s Cloud Run logs — no Firebase CLI needed. Index ID `CICAgOjXh4EK`,
  confirmed "Ativado" (enabled).
- Confirmed the polling loop is really running against production Firestore: the
  `FAILED_PRECONDITION` error was recurring every tick (~60-70s) before the index existed,
  and stopped appearing in the logs immediately once the index finished building.

## References

- `ROADMAP.md`, Fase 4 — full architecture rationale (why polling, why not `onSchedule`)
- `_local-adr-policy-001` (platform) — Cloud Run over Cloud Functions, the constraint this
  scheduler design works within
- `ROADMAP.md`, Fase 7 (escopo 3) — the future api→generator HTTP call this pattern anticipates
