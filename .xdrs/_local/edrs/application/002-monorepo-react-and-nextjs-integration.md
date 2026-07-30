---
name: _local-edr-policy-002-monorepo-react-and-nextjs-integration
description: React is pinned to 18.3.1 across the whole monorepo (root override), and the Firebase client SDK only initializes in the browser. Use when adding a new app/package to the monorepo, upgrading React, or touching apps/web/src/lib/firebase.ts.
apply-to: root package.json, apps/web
valid-from: 2026-07-30
---

# _local-edr-policy-002: Monorepo React version and Next.js/Firebase integration

## Context and Problem Statement

The root Vite app was on React 19; Next.js 14 (`apps/web`, added in Fase 2) requires React
18, and npm workspaces hoisting created two coexisting React copies. Separately, initializing
the Firebase client SDK unconditionally crashed Next.js's build-time prerendering (`auth/
invalid-api-key`), since real Firebase Web App credentials don't exist in every environment
that runs a production build.

## Decision Outcome

**React pinned to 18.3.1 monorepo-wide via root `overrides`; Firebase client SDK initializes
only when `typeof window !== 'undefined'`**

Root `package.json` sets both `react`/`react-dom` to `^18.3.1` and adds a matching
`overrides` block, guaranteeing a single React copy resolves everywhere in the workspace.
`apps/web/src/lib/firebase.ts` wraps `initializeApp`/`getAuth` in a browser-only guard,
returning `null` server-side; all auth logic runs in client components after hydration.

### Details

- Acceptance criterion (verifiable): `npm ls react` at the repo root shows exactly one
  resolved `react@18.3.1`, no nested copy under `apps/web/node_modules`; `npm run build`
  (root, `@mpa/api`, `@mpa/web`) exits 0.
- Root cause of the original crash: Next's internal `/404`/`/500` static page generation
  picked up the wrong React copy in some resolution path when two majors coexisted
  (`Cannot read properties of null (reading 'useContext')` in styled-jsx) — fixed only once
  the workspace had a single resolved React version, not by any Next.js-specific flag.
- Any future app added to `apps/*` or `packages/*` must not introduce a second React version
  without updating this decision — the `overrides` block is the single source of truth.
- `export const dynamic = 'force-dynamic'` is kept on pages that touch auth as
  defense-in-depth, but the browser-only guard in `firebase.ts` is what actually fixes the
  prerender crash; do not rely on `dynamic` alone if this pattern is copied elsewhere.

## References

- Root `package.json` — `overrides` block
- `apps/web/src/lib/firebase.ts` — `initClient()` browser guard
- `ROADMAP.md`, Fase 2 — changelog entry for both fixes
