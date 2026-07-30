---
name: _local-edr-policy-007-missing-firestore-indexes-for-user-queries
description: GET /api/monitors and GET /api/notifications 500 for every real logged-in user in production — both query patterns (equality filter on userId + orderBy a different field) require Firestore composite indexes that were never declared or created, unlike the Fase 4 scheduler index. Found during the first real end-to-end login test against production Firestore.
apply-to: firestore.indexes.json, services/api/src/repositories/monitorsRepository.ts, services/api/src/repositories/notificationsRepository.ts
valid-from: 2026-07-30
---

# _local-edr-policy-007: Missing Firestore indexes for per-user queries

## Context and Problem Statement

The first real end-to-end test of the deployed product — sign up on `flyspot-web`, land on the
dashboard — failed silently past login: `GET /api/monitors` and `GET /api/notifications` both
returned `500 Internal Server Error`, shown in the browser console with no further detail (the
routes have no try/catch, so an uncaught Firestore error becomes Fastify's generic 500).

Root cause: `listMonitorsForUser` (`.where('userId', '==', userId).orderBy('createdAt', 'desc')`)
and `listNotificationsForUser` (`.where('userId', '==', userId).orderBy('sentAt', 'desc').limit(100)`)
both combine an equality filter on one field with an `orderBy` on a *different* field — Firestore
requires a composite index for this combination; a query hitting production without one throws
`FAILED_PRECONDITION`. `firestore.indexes.json` only declared the one composite index the Fase 4
scheduler needed (`status` + `nextScanAt`) — these two per-user query patterns, present since
Fase 2 introduced multi-tenant auth, were never declared or created.

This had never surfaced before because nobody had actually logged in as a real end user against
production Firestore and loaded the dashboard until now — all prior verification of Fase 2's
multi-tenant isolation was either code review or testing against a project state that didn't
enforce this the same way (there is no automated test suite for `services/api` at all, tracked as
a known gap for Fase 8).

## Decision Outcome

**Declare both missing composite indexes in `firestore.indexes.json`, and create them in the real
Firestore project the same way the Fase 4 scheduler index was created — via the direct
"create index" link Firestore embeds in the `FAILED_PRECONDITION` error, since this project has no
Firebase CLI access from this environment.**

- `mpa_monitors`: `userId` ASC, `createdAt` DESC
- `mpa_notifications`: `userId` ASC, `sentAt` DESC

`firestore.indexes.json` is kept as the source of truth for what indexes this project needs, even
though nothing here currently runs `firebase deploy --only firestore:indexes` — it documents intent
and gives a reference if that ever changes, consistent with why the Fase 4 index was added there
too even though it was actually created via the Firestore Console error link.

**Confirmed in production (2026-07-30):** both indexes created directly from the
`FAILED_PRECONDITION` error links found in `flyspot-api`'s Cloud Run logs — no manual field
entry needed. Both reached status "Ativado" within ~4 minutes of creation.

### Details

- Acceptance criterion (verifiable): a real user (not the internal scan path) logging in and
  loading `/dashboard` gets `200` from both `GET /api/monitors` and `GET /api/notifications`, not
  `500` — verified once the two indexes are "Ativado" ("Enabled") in the Firestore Console, the
  same confirmation pattern used for the Fase 4 index.
- This is the second time a missing-Firestore-index bug has only been caught by testing against
  real production data rather than code review or local dev (`_local-adr-policy-002`'s Fase 4
  scheduler index was the first) — worth treating "does this query need a composite index" as a
  standing question whenever a new `.where(...).orderBy(differentField)` pattern is added anywhere
  in `services/api` or `services/generator`.

## References

- `ROADMAP.md` Fase 4 — the first missing-index incident, resolved the same way (Firestore Console
  error link, confirmed "Ativado")
- Found and fixed 2026-07-30, via the first real end-to-end login test against production —
  `services/api` has no automated test suite today (tracked as a coverage gap, Fase 8)
