# _local EDRs Index

Engineering workflow and implementation decisions for FlySpot.

## principles

Engineering principles and non-functional quality defaults.

- [001-mobile-and-accessibility-baseline](principles/001-mobile-and-accessibility-baseline.md) — Modal dialog semantics, icon-button aria-labels, label/input pairing, and 375px overflow rules mandatory across apps/web

## application

Code-level implementation patterns and application conventions.

- [001-route-stats-endpoint](application/001-route-stats-endpoint.md) — `GET /api/route-stats` reuses the existing Gemini scan simulator to answer pre-monitor price queries, instead of adding a second pricing engine
- [002-monorepo-react-and-nextjs-integration](application/002-monorepo-react-and-nextjs-integration.md) — React pinned to 18.3.1 monorepo-wide; Firebase client SDK initializes browser-only to avoid prerender crashes
- [003-monitor-edit-field-deletion](application/003-monitor-edit-field-deletion.md) — `PUT /api/monitors/:id` uses `FieldValue.delete()` for date/flex fields when an edit switches a monitor to `anytime`
- [002-edit-monitor-dated-mode-validation](application/002-edit-monitor-dated-mode-validation.md) — QA finding: edit flow could save a `dated` monitor with empty dates; both server and client now reject it
- [004-unauthenticated-pause-link](application/004-unauthenticated-pause-link.md) — E-mail "pausar monitor" link uses an HMAC-signed, expiring token instead of Firebase auth
- [005-empty-string-env-vars-crash-boot](application/005-empty-string-env-vars-crash-boot.md) — Code-review finding: GitHub Actions/Cloud Run inject unset secrets as empty strings, breaking `.optional()` fields with an extra validator (`APP_URL`, `INTERNAL_SCAN_TOKEN`, `EMAIL_ACTION_SECRET`); `services/api/src/env.ts` now normalizes empty strings to `undefined` before parsing
- [006-workspace-type-imports-crash-cloud-run](application/006-workspace-type-imports-crash-cloud-run.md) — First real deploy since Fase 4 crashed `flyspot-api` at `MODULE_NOT_FOUND`: `@mpa/types` has no build output and Docker never copies `packages/types/`, so Fase 6's first runtime (non-type) import of it (`PLAN_LIMITS`) exposed a dormant symlink bug; fixed by no longer marking `@mpa/types` external in each service's esbuild bundle
- [007-missing-firestore-indexes-for-user-queries](application/007-missing-firestore-indexes-for-user-queries.md) — First real end-to-end login found `GET /api/monitors` and `GET /api/notifications` both 500ing for every user: neither query's composite index (`userId`+`createdAt`, `userId`+`sentAt`) was ever declared or created, unlike the Fase 4 scheduler index
- [008-google-signin-popup-to-redirect](application/008-google-signin-popup-to-redirect.md) — "Continuar com Google" failed silently/generically in production; replaced `signInWithPopup` (three-origin popup+iframe coordination, a known-fragile pattern) with `signInWithRedirect`, per Firebase's own recommendation for this failure class
