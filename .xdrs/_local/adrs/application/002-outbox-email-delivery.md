---
name: _local-adr-policy-002-outbox-email-delivery
description: Real e-mail delivery (Fase 5) uses an outbox pattern in mpa_outbox, consumed by a new services/publisher via onSnapshot + a 60s polling safety net (not a Firestore Trigger, which is a Cloud Function and would require Blaze). The outbox event is a thin pointer to an already-created NotificationLog, not a duplicate of its payload. Use when touching executeScan.ts's notification creation, services/publisher, or anything reading/writing mpa_outbox.
apply-to: services/api's executeScan.ts, services/publisher (new)
valid-from: 2026-07-30
---

# _local-adr-policy-002: Outbox pattern for e-mail delivery

## Context and Problem Statement

`ROADMAP.md`'s Fase 5 section already specifies the outbox architecture (outbox in Firestore,
consumed by polling instead of a Firestore Trigger, to stay off Blaze — same constraint as
`_local-adr-policy-001`, platform). What it left open: `executeScanForMonitor()`
(`_local-adr-policy-002`, platform — the Fase 4 scan logic) already creates a `NotificationLog`
document synchronously the moment a scan detects a target-reached or price-change event, and
the dashboard's notification feed already reads from that collection. Fase 5 needs a
`publisher` to actually send an e-mail for that event — does it replace that existing
notification-creation flow, or add to it?

## Decision Outcome

**Outbox event is a thin pointer to the existing `NotificationLog`, written alongside it —
publisher sends the e-mail, it doesn't decide whether a notification happened**

`executeScanForMonitor()` keeps creating `NotificationLog` exactly as before (Fase 1-4
behavior unchanged — the dashboard feed keeps working immediately, no regression risk). It
additionally writes one `mpa_outbox` document per notification, whose only job is to track
e-mail delivery of that already-decided event: `{ type, monitorId, userId, notificationId,
status: 'pending' | 'sent' | 'failed', attempts, createdAt, sentAt?, lastError? }`.
`services/publisher` listens to `mpa_outbox` (`onSnapshot`, plus a 60s poll as a safety net for
missed reconnections — not a Firestore Trigger, which is a Cloud Function), fetches the
referenced `NotificationLog` for render data, sends via Resend, and updates the outbox doc's
status.

### Details

- Acceptance criterion (verifiable): the outbox document's ID is the deterministic dedup key
  itself (`${monitorId}:${type}:${window}`, see below), written via Firestore `.create()` (not
  `.set()`) — a second write attempt with the same key throws `ALREADY_EXISTS`, which the
  caller catches and ignores. This makes throttling atomic without a separate read-then-write
  race.
- Dedup/throttle window: `target_reached` always sends (`window` = the `notificationId`
  itself, so it's unique per event, never throttled). `price_update` throttles to one e-mail
  per monitor per hour (`window` = `Math.floor(Date.now() / 3_600_000)`), per
  `ROADMAP.md`'s Fase 5 requirement.
- Acceptance criterion (verifiable): a `pending` outbox event that fails to send is retried
  with backoff, up to 5 attempts (`attempts` field incremented each try); after the 5th
  failure, `status` becomes `'failed'` and the publisher stops retrying it automatically.
- `services/publisher` follows the same Cloud Run shape as `services/generator`
  (`_local-adr-policy-002`, platform): Fastify with only `/health`, `min-instances=1`, no
  user-facing HTTP surface.
- `RESEND_API_KEY` absent (e.g. local dev) means e-mail sending is a no-op that logs instead
  of throwing — same fallback shape as `GEMINI_API_KEY`'s absence in `geminiClient.ts` — so
  the outbox event is marked `sent` with a note, not stuck retrying forever in dev.
- Sender identity: `alertas@flyspot.com.br` — already the address shown in the existing
  `EmailModal.tsx` preview mockup, so this decision just confirms what was already assumed in
  the UI, not a new choice.

## Considered Options

- Firestore Trigger (`onCreate` on `mpa_notifications`) instead of an application-level outbox
  — rejected: Firestore Triggers are Cloud Functions, which require the Blaze plan this
  project deliberately avoids (`_local-adr-policy-001`, platform).
- Have `publisher` create the `NotificationLog` itself after sending, instead of `executeScan`
  creating it synchronously — rejected: would delay the dashboard feed update until the e-mail
  actually sends (seconds to tens of seconds via the listener/poll), a visible regression from
  today's immediate feed update, for no benefit — the two concerns (recording that an event
  happened vs. delivering an e-mail about it) are legitimately separable.

## References

- `ROADMAP.md`, Fase 5 — outbox architecture rationale and acceptance criteria
- `_local-adr-policy-002` (platform) — the Fase 4 scan logic this phase adds an outbox write to
- `_local-adr-policy-001` (platform) — Cloud Run over Cloud Functions, the same constraint
  that rules out Firestore Triggers here
