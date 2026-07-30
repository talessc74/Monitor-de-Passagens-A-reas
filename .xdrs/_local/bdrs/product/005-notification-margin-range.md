---
name: _local-bdr-policy-005-notification-margin-range
description: Users can define a warning margin above their target price (0/5/10/15/20% presets), so the monitor notifies both when the exact target is reached and when the price enters the warning range. Use when touching monitor creation/edit (onboarding, EditMonitorModal), executeScan.ts's notification trigger, or NotificationLog/OutboxEvent types.
apply-to: apps/web onboarding and EditMonitorModal, services/api executeScan.ts, packages/types FlightMonitor/NotificationLog
valid-from: 2026-07-30
---

# _local-bdr-policy-005: Notification margin range

## Context and Problem Statement

Through Fase 5, a monitor only notifies when `currentPrice ≤ targetPrice` (exact target reached)
or when the price changes since the last scan. A price sitting just above the target — e.g.
target R$1000, current price R$1050 — produces no distinct signal beyond the generic
"price changed" notification, so the user has no way to say "tell me when it's close, not
only when it's exactly there."

The product owner proposed a slider, anchored at the fixed target price, that widens a
warning range above it (e.g. "target + 10%").

Question: how is this range configured, and what distinct behavior does it trigger?

## Decision Outcome

**Discrete percentage presets (`targetPriceMarginPercent`), surfaced identically in onboarding
and in edit, triggering a distinct notification type from "target reached."**

`FlightMonitor` gains `targetPriceMarginPercent: number` (default `0`, meaning "no margin — only
exact target reached," preserving current behavior for every existing monitor without migration).
The control offers discrete presets — 0%, 5%, 10%, 15%, 20% — instead of a continuous slider,
and always displays the resulting absolute R$ value next to the percentage (e.g. "10% — avisar
até R$1100"), never the percentage alone.

`executeScan.ts`'s trigger logic becomes:
- `currentPrice ≤ targetPrice` → `NotificationLog.type: 'target_reached'` (unchanged, never
  throttled — per `_local-adr-policy-002`)
- `targetPrice < currentPrice ≤ targetPrice * (1 + targetPriceMarginPercent / 100)` →
  `NotificationLog.type: 'price_in_range'` (new; subject to the existing 1/hour throttle)
- `currentPrice > targetPrice * (1 + targetPriceMarginPercent / 100)` → no margin-triggered
  notification (the existing "price changed since last scan" notification still applies
  independently)

The control must appear with the same label and unit in both the onboarding flow and
`EditMonitorModal` — it is one product concept with two entry points, not two features.

### Details

- Acceptance criterion (verifiable): `targetPrice = 1000`, `targetPriceMarginPercent = 10` →
  a scan result of `currentPrice = 1100` produces exactly one `NotificationLog` with
  `type: 'price_in_range'`; `currentPrice = 1000` or lower produces `type: 'target_reached'`
  instead; `currentPrice = 1101` produces neither margin-triggered type.
- Acceptance criterion (verifiable): a monitor created before this policy's `valid-from`, with
  no `targetPriceMarginPercent` stored, behaves as if it were `0` — no `price_in_range`
  notification is ever produced for it until the user explicitly sets a margin through edit.
- The preset control always renders the absolute R$ value alongside the percentage; a bare
  percentage-only display does not satisfy this decision.
- `price_in_range` is a new value that must be added everywhere `NotificationLog['type']` and
  `OutboxEvent['type']` are enumerated (see `_local-adr-policy-002`) — the e-mail template for
  it is distinct from "meta atingida," per Fase 5's publisher.
- Acceptance criterion (verifiable): the margin has no lower bound and never delays or
  substitutes the "target reached" alert — `isUnderTarget` (`currentPrice ≤ targetPrice`) is
  evaluated first in `executeScan.ts`, and `isInMarginRange` is only ever considered when
  `isUnderTarget` is false. A sharp price drop far below the target (e.g. `targetPrice = 4000`,
  `currentPrice = 1500`) still produces `type: 'target_reached'` — unthrottled, same as any
  other price at or below the target — never `'price_in_range'` and never suppressed by it.

## Considered Options

- **Continuous slider (0–30%, freeform)** — rejected per UX deliberation (Compass/Empiricus):
  forces the user to do mental percentage-to-price arithmetic and produces non-meaningful
  values (e.g. "7.3%"); discrete presets with the absolute value shown reduce cognitive load
  and match established patterns in comparable price-alert products.
- **Single margin field only in onboarding, not editable later** — rejected per PolarBear:
  breaks wayfinding parity with `_local-bdr-policy-004`'s full-edit guarantee; the control must
  exist in both places with the same mental model.

## References

- `_local-bdr-policy-004` — establishes that every monitor field, including this one, must be
  editable after creation regardless of status
- `_local-adr-policy-002` — outbox/e-mail architecture that `price_in_range` extends with a
  new event type and throttle behavior
- `_local-adr-policy-001` — `FlightMonitor` data shape this decision adds a field to
