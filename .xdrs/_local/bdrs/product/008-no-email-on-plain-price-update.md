---
name: _local-bdr-policy-008-no-email-on-plain-price-update
description: A scan that only finds the price changed (no target/margin hit) stops sending an e-mail — it still shows up in the in-app notification feed. Supersedes the "price changed still applies independently" clause of _local-bdr-policy-005. Use when touching executeScan.ts's notification trigger or the outbox/e-mail pipeline.
apply-to: services/api executeScan.ts, services/publisher outboxConsumer.ts/templates.ts
valid-from: 2026-08-04
---

# _local-bdr-policy-008: No e-mail on a plain price update

## Context and Problem Statement

`_local-bdr-policy-005` established `target_reached` and `price_in_range` as the two
margin-aware notification types, but left the pre-existing "price changed since last scan"
notification (`type: 'price_update'`) firing independently, unthrottled by relevance — any scan
whose cheapest price differs from the previous one creates a `NotificationLog` *and* an
`OutboxEvent`, which the publisher turns into an e-mail.

Testing the Pro plan's 1h scan frequency (`_local-bdr-policy-007`) surfaced this concretely: with
prices varying scan to scan, the user was getting an e-mail on effectively every scan, regardless
of whether the price was anywhere near their target. The product owner's intent was always
narrower: e-mail only when the target or the warning margin is actually hit.

## Decision Outcome

**`price_update` keeps generating a `NotificationLog` (visible in the dashboard's notification
feed, useful as a price-history signal), but `executeScanForMonitor` no longer creates an
`OutboxEvent` for it — so the publisher never turns a plain price change into an e-mail.**

`target_reached` and `price_in_range` are unaffected — both still create the outbox event exactly
as before.

### Details

- Acceptance criterion: a scan where the cheapest price changed but stays above
  `targetPrice * (1 + targetPriceMarginPercent / 100)` produces a `NotificationLog` with
  `type: 'price_update'` and zero new `OutboxEvent` documents.
- Acceptance criterion: a scan that reaches `target_reached` or `price_in_range` still produces
  exactly one `OutboxEvent`, unchanged from `_local-bdr-policy-005`.

## References

- `_local-bdr-policy-005` — the margin-range decision this narrows (its "price changed... still
  applies independently" clause no longer holds for e-mail, only for the in-app feed)
- `_local-adr-policy-002` — outbox/e-mail delivery architecture
- `_local-bdr-policy-007` — the Pro scan-frequency change that surfaced this as a real problem
