---
name: _local-edr-policy-002-edit-monitor-dated-mode-validation
description: PUT /api/monitors/:id must reject a payload with searchMode 'dated' unless departureDate and returnDate are both non-empty; EditMonitorModal must guard the same rule client-side before submitting. Found during the Fase 3 QA pass (Milestone 3) — the edit modal was not a <form> and had no required enforcement.
apply-to: services/api/src/routes/monitors.ts (PUT handler), apps/web/src/components/EditMonitorModal.tsx
valid-from: 2026-07-30
---

# _local-edr-policy-002: Edit-monitor dated-mode validation

## Context and Problem Statement

QA (Pareto · Probe · Scaffold) reviewed the edit flow introduced by `_local-bdr-policy-004`.
Pareto flagged the mode-switching logic (`dated`/`anytime`) as the highest-risk cluster of
this phase — the newest, least-exercised code path. Probe traced a scenario the acceptance
criteria never named: edit an `anytime` monitor, click "Tenho datas", save without filling
either date field.

Tracing that path found a real defect: `EditMonitorModal` renders its date `<input>`s without
`required` and is not wrapped in a `<form>` — a plain `onClick` handler calls `handleSave`
directly, so HTML5 `required` (even if added) would never be enforced, since no submit event
fires. Server-side, `updateMonitorSchema` (`services/api/src/routes/monitors.ts`) accepted
`departureDate`/`returnDate` as any string, including empty — no `min(1)`, unlike the
creation schema's `dated` branch. The result: a monitor could be saved with
`searchMode: 'dated'` and empty date strings — an inconsistent state that happened to *look*
like an `anytime` monitor in the UI only by accident (every consumer's `date && date` truthy
check treats `''` the same as `undefined`), not because the data was actually valid per
`_local-adr-policy-001`.

## Decision Outcome

**Reject `dated` + empty dates on both sides — server as the source of truth, client as fast
feedback**

`updateMonitorSchema` gains a `superRefine`: when the payload's `searchMode` is `'dated'`,
`departureDate` and `returnDate` must both be present and non-empty, or the request is
rejected with 400 naming the missing field(s). `EditMonitorModal.handleSave` checks the same
condition before calling the save callback, showing an inline error instead of making a
request that would fail.

### Details

- Acceptance criterion (verifiable): `PUT /api/monitors/:id` with
  `{ searchMode: 'dated', departureDate: '', returnDate: '2026-12-01', ... }` (or either date
  omitted/empty) returns 400, not 200.
- Acceptance criterion (verifiable): in the UI, clicking "Salvar alterações" in `dated` mode
  with either date field empty shows the inline error and makes no network request.
- This only applies to the edit path. Monitor creation was already safe — the
  `passengerDateUnion` discriminated union's `dated` branch requires
  `departureDate: z.string().min(1)` since `_local-adr-policy-001`.
- QA judgment (Pareto): this single fix is not "testing everything" — it addresses the one
  cluster (mode-switch validation) most likely to hide further defects of the same shape.
  Confirming this fix does not mean the edit flow overall is defect-free; it means this
  specific, higher-probability defect is closed.

## References

- `_local-bdr-policy-004` — edit-existing-monitors decision this validates
- `_local-adr-policy-001` — the dated/anytime data shape this enforces
- Found and fixed 2026-07-30, Fase 3 Milestone 3 (QA gate) — no automated regression test
  exists yet for this path; `services/api` and `apps/web` have no test suite at all today
  (Scaffold: flagged as a coverage gap, formally scoped to Fase 8 per `ROADMAP.md`)
