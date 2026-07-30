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
