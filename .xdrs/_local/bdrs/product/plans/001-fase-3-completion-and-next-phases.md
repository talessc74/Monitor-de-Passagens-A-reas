# _local-bdr-plan-001: Fase 3 completion and next phases

## Executive Summary

- Fase 3 (UX/UI sobre o simulador) shipped the onboarding fields, `route-stats`, the
  empty-state radar, dashboard cards with target line, and full monitor edit — but two of
  the six approved UX screens were never built in `apps/web`, and the QA gate has never
  actually run.
- This plan lists exactly what's still open from Fase 3, then hands off to the roadmap's
  next phases (4, 5, 6, 7, 8) at a milestone level, so nothing discussed in conversation is
  lost only in chat history.
- This plan is ephemeral per XDRS convention — delete it once every milestone below is either
  done or has become its own tracked policy/roadmap item.

## Context and Problem Statement

Across several sessions the product owner and Argus worked through Fase 3 UX approval and
partial implementation, plus one out-of-band feature (asymmetric date flexibility + anytime
mode) and one gap fix (edit existing monitors). What has NOT been built, and what comes after
Fase 3, was tracked only in conversation and in `ROADMAP.md`'s phase descriptions — not as a
concrete, checkable list. The product owner asked to organize this before continuing.

## Proposed Solution

Track the Fase 3 leftovers and the next-phase milestones in this plan until each item is
either implemented (and this plan updated/deleted) or promoted to its own policy.

Expected end date: 2026-09-30

## Acceptance Criteria

- [ ] Every unchecked item in "Milestones" below is either done or has a dated decision to
  defer it.
- [ ] This plan file is deleted once Fase 3 is fully closed out (QA gate included).

## Milestones

### Milestone 1: Close out Fase 3's remaining screens
Owner: Argus (Galera de UX + Código)
Due date: 2026-08-15

The approved UX artifact (`_local-bdr-policy-001`'s asset) has six screens. Four are built in
`apps/web` (onboarding fields inside the persistent form, empty-state radar, dashboard cards,
edit modal). Two are not:

**Acceptance checklist:**
- [x] Screen 04 (histórico do monitor) — `MonitorDetailModal.tsx`, opened via the "Ver
  histórico" action on `MonitorCard`. Big price, sparkline with target line, min/média/
  variação stats, and price-by-site breakdown from the new `FlightMonitor.lastScanResults`
  field (persisted by the scan route). Done 2026-07-30.
- [x] Screen 05 (erro amigável) — `ErrorCard.tsx` replaces the plain red banner in
  `dashboard/page.tsx`, with an explicit "Tentar novamente agora" action wired to `fetchData`.
  The mockup's "última leitura confiável" fallback was scoped out: that section is
  per-monitor (it shows one ticket's last known price), while this error surfaces at the
  whole-page fetch level (monitors/sites/notifications failing together) — no single
  monitor to show a fallback for at that point. Revisit if a monitor-scoped error surface
  (e.g. a failed scan) gets its own UI later.
- [x] The onboarding fields today live as an always-visible sidebar form, not the stepped
  full-screen wizard shown in screen 01 of the mockup — **decided 2026-07-30: keep the
  persistent form.** It already ships, works, and no usability complaint has surfaced; a
  stepped wizard would add a state machine for a first-run case that the persistent form
  already serves adequately. Revisit only if user feedback says otherwise.

### Milestone 2: Fase 3's other UX/UI items (ROADMAP.md, item 2 and 6)
Owner: Galera de UX
Due date: 2026-08-31

**Acceptance checklist:**
- [x] Mobile-first audit at 375px across every screen (onboarding, dashboard, detail, error)
  — done 2026-07-30, findings in `_local-edr-policy-001` (edrs/principles). Found and fixed:
  `Header` and `MonitorCard`'s action row overflowing at 375px.
- [x] Acessibilidade: contraste AA, navegação por teclado, labels/aria em formulários —
  done 2026-07-30, same policy. Fixed: modal dialog semantics, icon-button aria-labels,
  label/input pairing. **Not fully closed**: color contrast (`text-slate-400` used
  pervasively, some instances likely below AA) and modal focus-trap are known, registered
  gaps — see that policy's "Known gaps" section. Revisit before public launch (Fase 8).

### Milestone 3: Run the QA gate
Owner: Galera de QA (Pareto, Probe, Scaffold)
Due date: 2026-09-05

Every PR since Fase 2 has merged straight to `main` without an actual QA convocation, despite
`CLAUDE.md`'s "Processo de desenvolvimento" requiring it before something goes live.

**Acceptance checklist:**
- [x] Convene "Argus, chama a galera de QA" against the current `main` before calling Fase 3
  live — done 2026-07-30. Pareto clustered risk on the mode-switch logic; Probe traced an
  undocumented scenario (edit `anytime` → `dated` → save without dates) and found a real
  defect, fixed and archived as `_local-edr-policy-002`. Scaffold flagged that neither
  `services/api` nor `apps/web` has any automated test suite yet — formally in Fase 8's
  scope per `ROADMAP.md`, not blocking this gate, but a real coverage gap in the meantime.
- [x] Multi-tenant isolation re-verified against the new fields (`searchMode`, asymmetric
  flex, edit flow) — confirmed every monitor route (`GET`, `PUT`, `DELETE`, scan) still
  checks `existing.userId !== request.userId` before acting; the new fields ride through the
  same schema/lookup path, no new bypass introduced.

### Milestone 4: Fases 4-8 (unchanged scope, roadmap execution order)
Owner: Product owner + Argus
Due date: 2026-12-15

No new decisions here — just the existing `ROADMAP.md` phases, listed so the next-step
conversation has a checklist instead of re-deriving it from memory:

- [ ] Fase 4 — scheduler de varreduras automáticas (polling no `generator`, ainda não criado)
- [ ] Fase 5 — e-mail real via Resend (`publisher`, outbox no Firestore)
- [ ] Fase 6 — Stripe em modo teste (planos, limites por plano)
- [ ] Fase 7 (escopo 3) — spike Duffel/Amadeus, só depois de 4/5/6 — é a única fase que
  introduz custo real de API, por decisão já registrada (`_local-bdr-policy-002`)
- [ ] Fase 8 — testes automatizados, hardening de segurança, LGPD (Política de Privacidade,
  Termos de Uso, consentimento) antes do lançamento público
- [ ] Deploy do `apps/web` na Vercel (`ROADMAP.md` Fase 2, item 7, ainda pendente) e `api`
  virar API pura (remover o serving de estáticos)

## Risks Identified

- Skipping Milestone 3 (QA gate) repeatedly is the main compounding risk — every phase after
  Fase 3 builds on unverified multi-tenant/auth behavior.
- Milestone 1's third item (stepped wizard vs. persistent form) is a real UX decision, not
  just an implementation detail — should go back to the product owner explicitly before
  either path is built further.

## References

- `_local-bdr-policy-001` — onboarding UX artifact (screens 01-06) this plan tracks completion of
- `_local-bdr-policy-004` — edit-existing-monitors, the most recently closed item
- `ROADMAP.md` — phase-level scope and acceptance criteria for Milestone 4
- `CLAUDE.md`, "Processo de desenvolvimento" — the QA gate requirement Milestone 3 satisfies
