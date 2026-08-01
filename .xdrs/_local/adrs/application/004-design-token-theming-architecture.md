---
name: _local-adr-policy-004-design-token-theming-architecture
description: apps/web theming runs on CSS custom properties declared via Tailwind v4's @theme block, with dark-mode values applied through prefers-color-scheme plus an explicit data-theme override that always wins over OS preference. Fixed "-solid" token variants exist for colors used as button backgrounds. Use when adding any new color, background, or border to apps/web, or when adding a new themed page.
apply-to: apps/web/src/app/globals.css and any apps/web component introducing a new color
valid-from: 2026-08-01
---

# _local-adr-policy-004: Design token theming architecture

## Context and Problem Statement

`_local-bdr-policy-006` requires every `apps/web` page to carry a consistent visual identity
with mandatory light and dark themes, switchable independently of the OS preference. Tailwind
v4 has no built-in concept of a manually-overridable theme beyond its `dark:` variant, which
only reads `prefers-color-scheme` and cannot be toggled by user action. The question this
document answers: what mechanism makes a color themed once, everywhere it's used, without
duplicating markup per theme or silently missing a spot?

While porting components, one instance of exactly that failure mode was found and fixed:
several destructive/error surfaces (`ErrorCard`, the account-deletion warning, the "Limpar
histórico" action) used raw Tailwind `red-*` utilities. Because those aren't tokens, they
never re-balanced for dark mode — the review found the account-deletion card still rendering
as a bright light-red box against an otherwise dark page.

## Decision Outcome

**CSS custom properties under the `--color-*` namespace inside Tailwind v4's `@theme` block
are the single source of truth for every color in `apps/web`. Light values are the defaults;
dark values are applied by a `prefers-color-scheme: dark` media query, and a `[data-theme]`
attribute on `<html>` — set by `ThemeToggle.tsx`, persisted to `localStorage` — always
overrides the OS preference in both directions.**

### Details

- Declare a token as `--color-<name>` inside `@theme` in `globals.css`. Tailwind
  auto-generates the matching utilities (`bg-<name>`, `text-<name>`, `border-<name>`, etc.);
  never hardcode a `red-*`/`blue-*`/`slate-*` Tailwind color or a raw hex value in component
  code. The one deliberate exception is `EmailModal.tsx`'s simulated email body, which
  represents a fixed-brand HTML email a recipient's inbox renders independently of the app's
  live theme — that one uses literal hex by design, not oversight.
- Cascade order (all in `globals.css`, unlayered so it wins over Tailwind's `@theme` layer):
  1. `:root { --color-x: <light value> }` inside `@theme` — the default.
  2. `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --color-x:
     <dark value> } }` — applies when the OS prefers dark and the user hasn't explicitly
     chosen light.
  3. `:root[data-theme="dark"] { --color-x: <dark value> }` — explicit override, wins
     regardless of OS preference.
  4. `:root[data-theme="light"] { --color-x: <light value> }` — explicit override in the
     other direction. **Every token overridden in step 2/3 must also be restated here** — a
     token that forgets this still resolves to whichever of steps 1-2 has higher specificity
     when the OS prefers dark, silently ignoring an explicit light choice.
- **Fixed vs. theme-flipping variants**: a color used as inline text/border (`--color-
  terracotta`) should re-balance for dark (lighter, desaturated) exactly like `_local-bdr-
  policy-006` describes. The *same* color used as a solid button background with white text
  on top must **not** flip — flipping it would either break the button's own contrast or
  require a second white-text-safe value be re-derived per theme for no benefit, since a
  button's background/foreground pair only needs to satisfy contrast against itself. Such
  colors get a second, theme-invariant token (`--color-terracotta-solid`,
  `--color-danger-solid`) that component code uses specifically for backgrounds; the
  flipping token is for everything else.
- Every token pair (light value, dark value) must be checked against WCAG 2.2 AA before being
  added — 4.5:1 for normal text, 3:1 for large text and non-text UI components. Use the
  `ux-ui-agent-skills` kit's `scripts/contrast.py` (or equivalent) rather than eyeballing;
  several dark-mode values in this rollout (the `--color-amber` margin note, the
  `--color-danger-*` set) were adjusted after failing this check on the first attempt.
- `color-scheme: light` / `color-scheme: dark` must be set alongside the token overrides so
  native form controls (date picker, select chrome, scrollbars) render correctly per theme.
- Fonts (Lora, Inter, JetBrains Mono) are wired through `next/font/google` in `layout.tsx`,
  exposed as `--font-*-raw` CSS variables that `@theme`'s `--font-sans`/`--font-serif`/
  `--font-mono` reference — not a render-blocking `@import` from `fonts.googleapis.com`.

## Considered Options

- **Tailwind's built-in `dark:` variant** — rejected: it only tracks `prefers-color-scheme`
  by default; making it respect a manual toggle requires the same `data-theme` attribute
  mechanism anyway, so using `dark:` classes everywhere would mean maintaining two parallel
  theming systems for no gain.
- **A single token value per color, computed at runtime (e.g. via `color-mix()` or a JS
  theme object)** — rejected: harder to individually verify each theme's contrast pair ahead
  of time, and less transparent to review than two plain, explicit hex values sitting next to
  each other in `globals.css`.

## References

- `_local-bdr-policy-006` — product decision this architecture implements
- `apps/web/src/app/globals.css` — token declarations
- `apps/web/src/components/ThemeToggle.tsx` — sets `data-theme` and persists the choice
- `apps/web/src/app/layout.tsx` — blocking inline script that applies the stored theme before
  first paint, and the `next/font` wiring
