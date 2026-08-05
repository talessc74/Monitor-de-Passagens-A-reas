---
name: _local-bdr-policy-012-travelpayouts-specific-route-tester
description: /admin gets a tool that runs the exact same origin+destination Travelpayouts call executeScan.ts makes, surfacing the raw item count / cheapest fare / error — for debugging the case where a destination shows up in the origin-wide coverage explorer (_local-bdr-policy-011) but a real monitor for that same pair still comes back simulated. Use when touching travelpayoutsClient.ts or the /admin page's price-source tooling.
apply-to: services/api travelpayoutsClient.ts/routes/admin.ts, apps/web app/admin/page.tsx
valid-from: 2026-08-05
---

# _local-bdr-policy-012: Travelpayouts specific-route tester

## Context and Problem Statement

`_local-bdr-policy-011`'s coverage explorer showed `MIA` and `MCO` as destinations with cached
Travelpayouts data from `BSB`. The product owner then created a real `BSB→MCO` monitor and it
still came back `estimated: true` (simulated) after scanning. `getCheapestRealFare(origin,
destination)` — the function `executeScan.ts` actually calls — swallows every failure into a
bare `null`, so there was no way to see why this specific origin+destination pair produced no
usable fare even though the origin-wide listing suggested it should.

## Decision Outcome

**`travelpayoutsClient.testRoute(origin, destination)` runs the identical `/v2/prices/latest`
call `getCheapestRealFare` makes, but returns `{ configured, httpStatus, itemCount, cheapest?,
error? }` instead of collapsing everything to `null`. `GET /api/admin/travelpayouts-route-test`
(admin-only) exposes it, and `/admin` gets an origin+destination input pair next to the coverage
explorer, specifically to debug "it's in the list above but still shows simulated."**

This distinguishes three outcomes that all look identical as a bare `null` to `executeScan.ts`:
1. HTTP error (auth/quota) — `error` set, `httpStatus` present.
2. HTTP 200 but zero items for this exact pair (`itemCount: 0`) — the origin-wide listing can
   include a destination whose specific cached fare has since expired or was filtered
   differently than the broader per-origin query; this is a legitimate "no data right now for
   this exact pair," not a bug.
3. Items present (`itemCount > 0`, `cheapest` populated) — if a real monitor for the same pair
   still shows simulated in this case, the bug is elsewhere (`executeScan.ts`'s cascade order,
   monitor's stored origin/destination casing, a stale pre-fix scan never re-run), not in
   Travelpayouts connectivity/coverage itself.

### Details

- Acceptance criterion: `GET /api/admin/travelpayouts-route-test?origin=BSB&destination=MCO`
  returns one of the three shapes above, never a bare `null` or unhandled exception.
- This tool answers "is Travelpayouts itself the reason," not "is my monitor mis-scanning" — if
  `itemCount > 0` here but the monitor is still simulated, the next debugging step is
  `executeScan.ts`'s cascade and the monitor's stored `origin`/`destination` values, not this
  client.

## References

- `_local-bdr-policy-011` — the origin-wide coverage explorer this narrows into a single-pair
  test when the broader listing doesn't explain a specific monitor's behavior
- `_local-bdr-policy-010` — the connectivity test this extends with per-route detail
