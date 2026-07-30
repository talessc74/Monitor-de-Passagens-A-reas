---
name: _local-edr-policy-001-mobile-and-accessibility-baseline
description: Baseline mobile-first and accessibility rules for apps/web — modal semantics (role=dialog, aria-modal, Esc-to-close), icon-only buttons need aria-label, form labels need htmlFor/id, and layouts must not overflow at 375px. Use when adding or reviewing any apps/web component, especially modals and action rows.
apply-to: apps/web (all components and pages)
valid-from: 2026-07-30
---

# _local-edr-policy-001: Mobile and accessibility baseline

## Context and Problem Statement

`ROADMAP.md` Fase 3 items 2 and 6 call for a mobile-first (375px) and accessibility audit
before this phase's UI work is considered done. An audit of `apps/web` after Fase 3 shipped
found concrete violations: modals with no `role="dialog"`/`aria-modal`, no keyboard Escape
handling, and close buttons with no `aria-label`; icon-only action buttons in `MonitorCard`
relying on `title` alone (not reliably accessible); a footer action row in `MonitorCard` with
5 buttons in a non-wrapping flex row that would overflow at 375px; a header
(`Header.tsx`) packing brand + platform badge + active-count pill + notifications + profile/
sign-out into one non-wrapping row; and login form `<label>`s with no `htmlFor`/`id` pairing
to their inputs.

Question: what is the minimum baseline every `apps/web` component must meet, and what did
the first audit pass actually fix?

## Decision Outcome

**Baseline rules below are mandatory for all apps/web components; first pass fixed the
concrete violations found**

### Details

Mandatory baseline (checked in review, not just at audit time):
- Every modal/overlay: `role="dialog"` + `aria-modal="true"` on the panel, `aria-labelledby`
  pointing to its heading (or `aria-label` if there's no single heading), a close control with
  `aria-label`, click-outside-to-close via a `role="presentation"` backdrop with
  `stopPropagation()` on the panel, and Escape-to-close via the shared
  `apps/web/src/lib/useEscapeToClose.ts` hook.
- Any icon-only button (no visible text label) must have `aria-label`; `title` alone is not
  sufficient (not reliably exposed to assistive tech, not usable via keyboard focus alone).
- Any `<label>` paired with an `<input>`/`<select>` must use `htmlFor`/matching `id` — visual
  proximity is not a substitute for the programmatic association.
- Destructive actions (delete) require an explicit confirmation step before firing.
- Action rows and header bars must use `flex-wrap` (or an explicit responsive stacking
  breakpoint) — a non-wrapping flex row with more than 2-3 interactive elements will overflow
  at 375px; this must be checked at that width, not just at desktop sizes.
- Dynamically-rendered error text should carry `role="alert"` so assistive tech announces it
  without requiring focus to move.

Fixed in the first pass (2026-07-30): `MonitorDetailModal`, `EditMonitorModal`, `EmailModal`
(dialog semantics, Escape, `aria-label` on close); `MonitorCard` (aria-labels on the four
icon-only actions, `flex-wrap` + responsive stacking on the footer action row, confirm()
guard on delete); `Header` (wraps and hides secondary labels below `sm`, `aria-label` on
sign-out); login page (`htmlFor`/`id` on both fields, `role="alert"` on the error message).

### Known gaps not fixed in this pass

- **Color contrast**: `text-slate-400` (and similar low-contrast grays) is used pervasively
  across the app for captions/labels/timestamps — some instances likely fail WCAG AA for
  normal text (~2.8:1 against white). Fixing this correctly means auditing and adjusting the
  color scale app-wide, not a handful of files; scoped out of this pass as too large a diff to
  bundle with the modal/header/action-row fixes. Needs its own pass.
- **Focus trap inside modals**: Escape-to-close and click-outside-to-close are covered, but
  Tab does not loop focus inside an open modal — focus can escape to the page behind it.
  Acceptable for now given the modals are short-lived and dismissible, but a real gap for
  screen-reader/keyboard-only users.
- No dedicated screen-reader testing (VoiceOver/NVDA) was performed — this pass is a static
  code audit, not a live assistive-tech pass.

## References

- `ROADMAP.md`, Fase 3, item 2 (mobile-first) and item 6 (acessibilidade)
- `apps/web/src/lib/useEscapeToClose.ts`
