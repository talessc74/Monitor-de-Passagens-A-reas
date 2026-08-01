---
name: _local-bdr-policy-006-warm-editorial-visual-identity
description: Replaces apps/web's generic Inter/blue-600/rounded-2xl SaaS look with a warm editorial visual identity (paper/ink/terracotta palette, serif display type, boarding-pass ticket motif) across every page, with mandatory light and dark themes. Use when touching apps/web UI, adding a new page, or reviewing visual consistency.
apply-to: apps/web (all pages and components)
valid-from: 2026-08-01
---

# _local-bdr-policy-006: Warm editorial visual identity

## Context and Problem Statement

An ARGUS-convened design review of `apps/web` (Galera de UX + Galera de Código) found the
product using the default look most AI-assisted scaffolding produces: Inter for every text
role including headlines, `blue-600` as the only accent, `rounded-2xl` cards with a generic
drop shadow on everything, and `text-slate-400` used pervasively for secondary text — later
confirmed to fail WCAG AA contrast (~2.5:1), the gap already flagged as unresolved in
`_local-edr-policy-001`.

The product owner's own reaction to that audit was explicit: they did not want incremental
fixes, they wanted real new page proposals that broke away from the templated,
machine-generated look. Three static mockups (landing, login, dashboard) were produced and
reviewed as artifacts before any production code changed. After approval, the owner asked
for two more requirements before implementation: dark mode, and mobile — then, after
implementation shipped for the three reviewed pages, asked why `/plans` and `/profile`
weren't included, since leaving them on the old palette breaks visual consistency (the new
`Header` already links to both).

Question: what visual identity does `apps/web` commit to, and what is its scope?

## Decision Outcome

**A warm editorial / boarding-pass-ticket design system, applied to every page and shared
component in `apps/web`, with light and dark themes as a first-class requirement — not an
afterthought.**

Brand elements:
- **Palette**: warm paper/ink neutrals (off-white page, near-black ink — never pure
  `#fff`/`#000`) with terracotta as the single primary accent, a teal accent reserved for
  "target reached" / success states, and amber for margin/warning notes. One primary + two
  narrow-purpose accents, not a rainbow.
- **Type**: Lora (serif) for display headings, Inter for UI/body text, JetBrains Mono for
  prices, IATA codes, and other tabular data — self-hosted via `next/font`.
- **Signature device**: a die-cut "perforation" (dashed rule + circular notches) borrowed
  from a boarding-pass ticket, used on monitor cards and the login split-screen, replacing
  generic rounded-corner-plus-shadow cards as the thing that signals "designed," not
  generated.

### Details

- Acceptance criterion (verifiable): every page under `apps/web/src/app` and every component
  under `apps/web/src/components` uses the token system in `globals.css`
  (`_local-adr-policy-004`) — no page may be left on the pre-existing default Tailwind
  palette once this policy is adopted, because a partial rollout reads as broken, not as
  work-in-progress.
- Acceptance criterion (verifiable): both a light and a dark theme exist and are manually
  selectable (not only OS-preference-driven) via a persistent toggle, present on every page
  a signed-out visitor can reach as well as the authenticated app.
- Acceptance criterion (verifiable): mobile (375px viewport) has no horizontal overflow on
  any redesigned page, checked with a real browser viewport, not just a resized window.
- Explicitly out of scope: `src/` — the old Vite/React frontend `CLAUDE.md` already marks as
  being discontinued in favor of `apps/web`. Owner instruction: leave it untouched.
- The technical mechanism (CSS custom properties, theme switching, contrast rules for future
  colors) is `_local-adr-policy-004`, not repeated here — this document is the product-level
  "what and why," that one is the "how."

## Considered Options

- **Incremental token/contrast fixes on the existing generic look** — rejected by the product
  owner explicitly: the ask was for a genuinely new design, not a patched version of the
  templated one.
- **OS-preference-only dark mode (`prefers-color-scheme`, no manual toggle)** — rejected:
  dark mode was requested as a real, user-facing product feature, not a passive fallback: a
  visitor who prefers a light OS theme but wants the app dark (or vice versa) must be able to
  choose.
- **Redesign only the three reviewed pages (landing/login/dashboard), leave `/plans` and
  `/profile` as-is** — rejected after the owner raised it directly: a shared `Header` linking
  into two pages still on the old palette is a visible inconsistency, not a neutral gap.

## References

- `_local-adr-policy-004` — token/theming architecture implementing this decision
- `_local-edr-policy-001` — accessibility baseline; its "known gap" on `text-slate-400`
  contrast is resolved by this redesign (see that document's amendment)
- `CLAUDE.md` — confirms `apps/web` (not `src/`) is the current frontend
