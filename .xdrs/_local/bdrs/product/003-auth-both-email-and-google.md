---
name: _local-bdr-policy-003-auth-both-email-and-google
description: FlySpot accepts both e-mail/senha and Google login, not one or the other. Use when touching the login/signup screen or auth-context.tsx.
apply-to: apps/web login and signup flow
valid-from: 2026-07-30
---

# _local-bdr-policy-003: Authentication accepts both e-mail/senha and Google

## Context and Problem Statement

Fase 2 needed a login method decision before implementation. Question: e-mail/senha only,
Google only, or both?

## Decision Outcome

**Both.** The product owner chose "sim, aceitar os dois" when asked directly. The login
screen offers e-mail/senha as the primary form and "Continuar com Google" as an equally
supported alternative — neither is a fallback for the other.

### Details

- Acceptance criterion (verifiable): a new user can complete signup via e-mail/senha alone,
  and separately via Google alone; both paths reach the same `mpa_users/{uid}` profile
  creation on first login (`_local-adr-policy-001`, controls subject).
- E-mail confirmation requirement was flagged as recommended but not yet decided at the time
  of writing; treat it as open until a separate decision records it.

## References

- `ROADMAP.md`, Fase 2, "Decisões do produto"
- `_local-adr-policy-001` (controls) — account creation and multi-tenant scoping this feeds into
