# _local BDRs Index

Business process and product decisions for FlySpot.

## principles

Business principles and decision criteria that guide all product areas.

- [001-product-naming-flyspot](principles/001-product-naming-flyspot.md) — FlySpot is the brand; repo, Firebase project, and `mpa_` prefix keep their inherited internal names, never renamed for branding

## product

Product behavior, lifecycle, and offering decisions.

- [001-onboarding-flexible-search-and-price-estimate](product/001-onboarding-flexible-search-and-price-estimate.md) — Onboarding offers a "dated" mode (asymmetric days-before/days-after per date) and an "anytime" mode (no dates at all), age-banded passengers, and a price estimate before the user sets a target
- [002-build-order-defer-paid-apis](product/002-build-order-defer-paid-apis.md) — Build the whole product on the free Gemini simulator first; integrate paid Duffel/Amadeus APIs last
- [003-auth-both-email-and-google](product/003-auth-both-email-and-google.md) — Login accepts both e-mail/senha and Google, not one or the other
- [004-edit-existing-monitors](product/004-edit-existing-monitors.md) — Every monitor field is editable after creation, regardless of active/paused status
- [005-notification-margin-range](product/005-notification-margin-range.md) — Discrete percentage presets (0/5/10/15/20%) above the target price trigger a distinct `price_in_range` notification, shown identically in onboarding and edit

**Plans:**
- [001-fase-3-completion-and-next-phases](product/plans/001-fase-3-completion-and-next-phases.md) — What's left of Fase 3 (screens 04/05, mobile/a11y audit, QA gate) and a milestone-level handoff to Fases 4-8
