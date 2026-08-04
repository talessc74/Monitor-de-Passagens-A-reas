---
name: _local-bdr-policy-009-airport-code-validation-everywhere
description: origin/destination must be a code from the closed airport list on every entry point that accepts them — POST/PUT /api/monitors and GET /api/route-stats on the backend, plus the EditMonitorModal's edit flow on the frontend (which previously accepted free text). Use when touching monitor create/edit, the shared airport list, or passengerDate.ts.
apply-to: packages/types (AIRPORTS/findAirport, now the shared source), services/api schemas/passengerDate.ts and routes/monitors.ts, apps/web MonitorForm/EditMonitorModal/AirportAutocomplete
valid-from: 2026-08-04
---

# _local-bdr-policy-009: Airport code validation everywhere

## Context and Problem Statement

`MonitorForm` (creation) already restricted origin/destination to `AIRPORTS`, a closed list, via
`AirportAutocomplete` — typing an unknown code produces no suggestion to click, so `value` never
leaves the list. `EditMonitorModal`, though, used plain text `<input>`s with no validation at
all, and the backend's `PUT /api/monitors/:id` only checked string length (3-4 chars), not
whether the code corresponded to a real airport.

A live monitor was found with `destination: 'ORL'` — not a real IATA code (Orlando is `MCO`) —
almost certainly typed by hand through the edit modal. Every scan for it silently fell back to
the Gemini/offline simulator, because Travelpayouts/Sky Scrapper have no route data for a code
that doesn't exist, and nothing surfaced this as an error to the user.

## Decision Outcome

**The airport list (`AIRPORTS`, `findAirport`, `searchAirports`) moves from `apps/web/src/lib/
airports.ts` to `packages/types` as the single shared source. Both the API and the web app import
it from there, so neither side can accept a code the other would reject.**

- `services/api/src/schemas/passengerDate.ts`: `origin`/`destination` now go through
  `airportCodeSchema`, a `z.string().min(3).max(4).refine(...)` that calls `findAirport` — this
  covers `POST /api/monitors` (via `passengerDateUnion`) and `GET /api/route-stats` (via
  `passengerDateSchema`).
- `services/api/src/routes/monitors.ts`: `updateMonitorSchema`'s `superRefine` adds the same
  `findAirport` check for `origin`/`destination` when present in a `PUT` payload — this is the
  route that previously had no such check.
- `apps/web/src/components/EditMonitorModal.tsx`: origin/destination inputs are replaced with the
  same `AirportAutocomplete` used in `MonitorForm`, so free text is rejected at the source, not
  just after a failed save. The save button is disabled until both resolve to a real airport,
  mirroring `MonitorForm`'s `originValid`/`destinationValid` gate.
- The dashboard's `handleEditMonitor` now throws with the API's actual `error` message on a
  non-2xx response (instead of silently returning `false`), and `EditMonitorModal` displays that
  message instead of a generic "could not save" string — so a validation failure that does reach
  the backend (e.g. a future API caller that bypasses the UI) is explained, not silent.

### Details

- Acceptance criterion: `PUT /api/monitors/:id` with `destination: 'ORL'` (or any code absent
  from `AIRPORTS`) is rejected with 400 and message `Código de aeroporto inválido: ORL`.
- Acceptance criterion: `EditMonitorModal`'s save button is disabled while origin or destination
  doesn't resolve via `findAirport`, identical in spirit to `MonitorForm`'s existing gate.
- A monitor created before this policy with an invalid code (like the `ORL` one that surfaced it)
  is not migrated automatically — it keeps scanning as simulated until edited, since this is a
  validation-on-write decision, not a backfill.

## References

- `_local-bdr-policy-004` — every monitor field must be editable after creation, which is why
  `EditMonitorModal` existed to have this gap in the first place
- `_local-adr-policy-004` (application) — `estimated: true/false` labeling that made this gap
  visible (a route with no real airport code never gets real fares)
