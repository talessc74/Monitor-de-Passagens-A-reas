---
name: _local-bdr-policy-004-edit-existing-monitors
description: Users must be able to fully edit an existing monitor (route, search mode, dates/flexibility, passengers, target price, e-mail, tracked sites) regardless of its current status (active, paused). Use when touching the monitor edit UI or the PUT /api/monitors/:id route.
apply-to: apps/web dashboard (MonitorCard and its edit flow), services/api PUT /api/monitors/:id
valid-from: 2026-07-30
---

# _local-bdr-policy-004: Edit existing monitors

## Context and Problem Statement

Through Fase 3, a created monitor could only be paused/resumed, re-scanned, or deleted — none
of its search parameters (route, dates, flexibility, passengers, target price) could be
changed after creation. The product owner flagged this as a real gap: a traveler's plans
shift (dates move, they decide to switch to "any date", the target price needs adjusting)
and today the only path is deleting the monitor and recreating it from scratch, losing its
price history.

Question: what must be editable on an existing monitor, and does its current status
(active/paused) restrict what can be edited?

## Decision Outcome

**Full edit, independent of status**

Every field captured at creation — origin/destination, search mode (`dated`/`anytime`),
dates and their asymmetric before/after flexibility, passengers (adults/children/infants),
target price, notification e-mail, and tracked sites — must be editable after creation,
through an explicit "Editar" action, whether the monitor is currently `active` or `paused`.
Editing does not implicitly change the monitor's `active`/`paused` status; pausing/resuming
remains a separate action.

### Details

- Acceptance criterion (verifiable): a `paused` monitor exposes the same "Editar" action as
  an `active` one — status is never a precondition for editing.
- Acceptance criterion (verifiable): switching `searchMode` from `dated` to `anytime` through
  edit removes the date/flexibility fields from the stored monitor entirely (see
  `_local-adr-policy-001`'s requirement that `anytime` monitors carry no date fields) — it is
  not enough for the UI to merely hide them while stale values remain in Firestore.
- Editing preserves `history[]`, `createdAt`, and `id` — this is an edit of the existing
  monitor, not a delete-and-recreate; "monitorando há X dias" (`_local-bdr-policy-001`'s
  onboarding decision, applied in the dashboard card) must keep counting from the original
  `createdAt`.
- Editing does not force an immediate re-scan; the next scheduled scan (or a manual "Varrer
  Agora") picks up the new parameters.

## References

- `_local-bdr-policy-001` — onboarding decision that defines the field set this edit flow reuses
- `_local-adr-policy-001` — data shape (`searchMode`, asymmetric flex fields) this edit flow writes
