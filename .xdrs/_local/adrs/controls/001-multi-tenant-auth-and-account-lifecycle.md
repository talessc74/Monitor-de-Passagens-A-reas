---
name: _local-adr-policy-001-multi-tenant-auth-and-account-lifecycle
description: Every monitor/notification route requires a verified Firebase ID token and is scoped by userId; account deletion cascades to all of a user's data. Use when adding a route to services/api, or touching auth.ts, usersRepository.ts, or the account deletion flow.
apply-to: services/api routes and repositories for monitors, notifications, and accounts
valid-from: 2026-07-30
---

# _local-adr-policy-001: Multi-tenant auth and account lifecycle

## Context and Problem Statement

Fase 1 shipped with `userId` nullable on every monitor and no authentication — a single
shared dataset. Fase 2 introduces real user accounts (Firebase Auth, e-mail/senha + Google).
Question: how does the backend enforce that one user never sees or affects another user's
data, and what happens to a user's data when they close their account (LGPD requirement)?

## Decision Outcome

**`authenticate` preHandler verifies the Firebase ID token on every protected route; every
query is scoped by `userId`; account deletion cascades**

`services/api/src/auth.ts` exposes an `authenticate` Fastify preHandler that calls
`getAuth().verifyIdToken()` on the `Authorization: Bearer` header, injecting `request.userId`
and `request.userEmail`. Every monitor/notification route uses it, and every repository
query (`listMonitorsForUser`, `listNotificationsForUser`, etc.) filters by `userId` — never
returning another user's documents. `DELETE /api/me` deletes all of a user's monitors,
notifications, and their `mpa_users` profile document, in that order, before sign-out.

### Details

- Acceptance criterion (verifiable): a request to any `/api/monitors*` or
  `/api/notifications*` route without a valid Bearer token returns 401; a request with a
  valid token for user A never returns a document whose `userId` is user B's.
- Acceptance criterion (verifiable): `DELETE /api/me` leaves zero documents behind in
  `mpa_monitors`, `mpa_notifications`, or `mpa_users` for the deleted `uid`.
- `mpa_users/{uid}` is created on first login (via `GET /api/me` calling `ensureUser`), not
  at signup time — this keeps signup itself provider-agnostic (works identically for
  e-mail/senha and Google).
- This is the mechanism the "Deletar minha conta" UI screen (Fase 2, `apps/web`) depends on;
  it must keep working even as more collections are added in later phases (e.g. Stripe
  customer records, outbox entries) — new user-owned collections must be added to the
  deletion cascade, not left orphaned.

## References

- `CLAUDE.md`, "Processo de desenvolvimento" — LGPD deletion requirement
- `services/api/src/auth.ts`, `services/api/src/repositories/usersRepository.ts`
- `ROADMAP.md`, Fase 2, tarefas 3-6
