---
name: _local-bdr-policy-011-travelpayouts-coverage-explorer
description: /admin gets a tool to list every destination with cached Travelpayouts fare data from a given origin, instead of the product owner having to create one monitor per destination to discover coverage by trial and error. Use when touching travelpayoutsClient.ts or the /admin page's price-source tooling.
apply-to: services/api travelpayoutsClient.ts/routes/admin.ts, apps/web app/admin/page.tsx
valid-from: 2026-08-05
---

# _local-bdr-policy-011: Travelpayouts coverage explorer

## Context and Problem Statement

`_local-bdr-policy-010` added a connectivity test (is the source configured and reachable) but
not a coverage explorer (which specific routes actually have data). After confirming
Travelpayouts was working (`_local-bdr-policy-010`'s diagnostic), the product owner asked which
destinations from BSB have real coverage — the only way to answer that from the app was to create
one monitor per candidate destination and watch for the "Real" badge, which is slow and wastes
monitor slots (`PLAN_LIMITS.maxMonitors`).

Travelpayouts' `/v2/prices/latest` endpoint, when called with only `origin` (no `destination`),
returns every cached destination from that origin at once — this was already available from the
provider, just never exposed anywhere in the app.

## Decision Outcome

**`travelpayoutsClient.listCachedDestinations(origin)` calls `/v2/prices/latest?origin=X` (no
destination) and returns every cached destination, cheapest first. `GET /api/admin/travelpayouts-
routes?origin=X` (admin-only) exposes it. The `/admin` page gets an input + button ("Ver
destinos") — manual trigger only, same reasoning as `_local-bdr-policy-010`'s diagnostics button:
this spends real API quota, so it must not run automatically.**

This is intentionally admin-only and manual — it is a debugging/coverage-research tool for the
product owner, not a user-facing feature (regular users still just create a monitor and see
`estimated: true/false` on the result, per `_local-bdr-policy-010`'s card badge).

### Details

- Acceptance criterion: `GET /api/admin/travelpayouts-routes?origin=BSB` with a working token
  returns `{ origin: 'BSB', configured: true, destinations: [...] }`, sorted cheapest-first, each
  entry carrying `destination`, `price`, `gate`, `stops`.
- Acceptance criterion: an origin with zero cached destinations (Travelpayouts' coverage is
  narrow outside SP-RJ, per `_local-bdr-plan-004`) returns `destinations: []`, not an error — an
  empty array is a legitimate, expected answer for most non-GRU origins.

## References

- `_local-bdr-policy-010` — the connectivity-test decision this extends into a coverage explorer
- `_local-bdr-plan-004` — original Travelpayouts coverage findings (narrow, SP-RJ-heavy) this tool
  lets the product owner re-verify live instead of trusting a point-in-time spike forever
