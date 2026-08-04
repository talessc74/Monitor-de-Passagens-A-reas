---
name: _local-bdr-policy-007-pro-scan-interval-choice
description: Pro users choose between 6h (standard, same as Free) and 1h scan frequency per monitor, instead of Pro being hard-locked to 1h. Use when touching FlightMonitor.scanIntervalHours, PLAN_LIMITS/SCAN_INTERVAL_OPTIONS, the generator scheduler's interval resolution, or the monitor create/edit forms.
apply-to: packages/types (FlightMonitor, SCAN_INTERVAL_OPTIONS), services/api routes/monitors.ts, services/generator scheduler.ts, apps/web MonitorForm/EditMonitorModal
valid-from: 2026-08-04
---

# _local-bdr-policy-007: Pro scan interval choice

## Context and Problem Statement

Through Fase 6, `PLAN_LIMITS.pro.scanIntervalHours = 1` meant every Pro monitor scanned every
hour, unconditionally — no choice, no way to dial it back. The product owner asked for Pro to
default to the same 6h cadence as Free ("como o standard"), with 1h available as an opt-in per
monitor, not a plan-wide forced setting.

## Decision Outcome

**`FlightMonitor` gains an optional `scanIntervalHours` field, validated per-plan against
`SCAN_INTERVAL_OPTIONS` (`free: [6]`, `pro: [6, 1]`, admin inherits Pro's set). Unset means
`DEFAULT_SCAN_INTERVAL_HOURS` (6), even for Pro.**

`PLAN_LIMITS.pro.scanIntervalHours` keeps its old meaning (fastest ceiling, `1`) — it is not the
new default, just the floor `effectiveLimits`/plan-limit checks still reason about elsewhere.

- `services/api/src/routes/monitors.ts` rejects (403, `upgradeRequired`) a `scanIntervalHours`
  value not in the caller's `allowedScanIntervals(user)` on both `POST /api/monitors` and
  `PUT /api/monitors/:id`.
- `services/generator/src/scheduler.ts`'s `planIntervalHours` now takes the whole monitor (not
  just `userId`): Free/no-profile always gets `env.FREE_SCAN_INTERVAL_HOURS` regardless of what
  is stored on the monitor (defense in depth against a bypassed validation); Pro/admin honors
  the monitor's stored choice when it is a valid option for the plan, else falls back to the 6h
  default.
- `apps/web`'s `MonitorForm`/`EditMonitorModal` show a 6h/1h picker only when the account is
  Pro/admin (fetched via `/api/me` on the dashboard); Free sees the fixed 6h with an upsell link
  to `/plans`.

### Details

- Acceptance criterion: a Free account's create/edit payload with `scanIntervalHours: 1` is
  rejected with 403; the same payload from a Pro/admin account is accepted and persisted.
- Acceptance criterion: a Pro monitor created before this policy, with no `scanIntervalHours`
  stored, is scanned every 6h by the scheduler — not every 1h as it silently was before.

## References

- `_local-adr-policy-003` — `PLAN_LIMITS`/plan enforcement this decision extends
- `_local-bdr-policy-004` — every monitor field must be editable after creation
