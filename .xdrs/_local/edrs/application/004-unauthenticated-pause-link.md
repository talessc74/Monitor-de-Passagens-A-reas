---
name: _local-edr-policy-004-unauthenticated-pause-link
description: The "pausar monitor" link inside e-mail notifications works without login, via an HMAC-signed, expiring token in the URL — not a Firebase session. Use when touching the pause-link route, EMAIL_ACTION_SECRET, or e-mail templates in services/publisher.
apply-to: services/api (public pause route), services/publisher (email templates)
valid-from: 2026-07-30
---

# _local-edr-policy-004: Unauthenticated pause-monitor link

## Context and Problem Statement

`ROADMAP.md`'s Fase 5 acceptance criteria require the e-mail's "pausar monitor" link to work
"sem login" — an LGPD-driven opt-out requirement (a user must be able to stop a monitor from
inside the e-mail itself, without first authenticating). Every existing monitor mutation route
(`PUT /api/monitors/:id`) requires a Firebase ID token via `authenticate`. A link clicked from
an e-mail client has no such token.

## Decision Outcome

**HMAC-signed, time-limited token in the URL, verified by a new unauthenticated route**

The pause link is `GET /api/monitors/:id/pause?token=...`, where `token` is
`base64url(expiresAt) + '.' + hex(HMAC-SHA256(monitorId + ':' + expiresAt, EMAIL_ACTION_SECRET))`.
The route recomputes the HMAC from the URL's `id` and the token's embedded `expiresAt`,
rejects if the signature doesn't match or `expiresAt` has passed, and otherwise sets the
monitor's `status` to `'paused'` — no Firebase auth check, no `userId` comparison (the
signature itself is the authorization: only `services/publisher`, holding
`EMAIL_ACTION_SECRET`, can mint a valid one, and only for the monitor ID it was minted for).

### Details

- Acceptance criterion (verifiable): the route works with no `Authorization` header at all;
  an expired or tampered token returns 400/401 and does not pause the monitor.
- Token lifetime: 30 days (an e-mail sitting unread in an inbox should still have a working
  opt-out link for a reasonable while) — configurable via `PAUSE_LINK_TTL_DAYS` if this proves
  too short or too long in practice.
- `EMAIL_ACTION_SECRET` is a new shared secret between `services/api` (verifies) and
  `services/publisher` (mints, when building the e-mail template) — same shared-secret shape
  as `INTERNAL_SCAN_TOKEN` (`_local-adr-policy-002`, platform), but a distinct value: these
  protect different things (service-to-service scan trigger vs. a token embedded in an e-mail
  a human clicks), so they must not be the same secret.
- This is intentionally not a generic "magic link" auth mechanism — it authorizes exactly one
  action (pause) on exactly one resource (the monitor ID baked into the signature), nothing
  else. Do not extend this token to authorize any other mutation without a new decision.

## References

- `ROADMAP.md`, Fase 5 — "Link de pausar monitor... obrigatório: LGPD/opt-out"
- `_local-adr-policy-002` (platform) — the shared-secret pattern this borrows from
- `_local-adr-policy-002` (application, this scope) — the outbox/e-mail delivery this link is
  embedded in
