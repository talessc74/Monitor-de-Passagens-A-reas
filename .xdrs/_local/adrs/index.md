# _local ADRs Index

Architectural and technical decisions for FlySpot.

## platform

Platform-level runtime and enabling capabilities.

- [001-cloud-run-deploy-architecture](platform/001-cloud-run-deploy-architecture.md) — Cloud Run (not Cloud Functions), native Artifact Registry (not gcr.io), GitHub Actions workflow_dispatch (not Cloud Shell); amended to bring `apps/web` onto Cloud Run instead of an unexamined default of Vercel
- [002-scheduler-polling-and-internal-auth](platform/002-scheduler-polling-and-internal-auth.md) — Fase 4's scheduler is a polling loop in a new `generator` service, triggering scans on `api` via a shared-secret internal route
- [003-firebase-hosting-custom-domain-rewrite](platform/003-firebase-hosting-custom-domain-rewrite.md) — Cloud Run's native domain mapping doesn't support `southamerica-east1`; `flyspot.com.br` fronts through Firebase Hosting with a wildcard rewrite into the existing `flyspot-web` service instead of moving regions or adding a load balancer

## data

Data architecture and information modeling choices.

- [001-passenger-and-date-flexibility-model](data/001-passenger-and-date-flexibility-model.md) — `FlightMonitor` gains a flat `infants` field, asymmetric days-before/days-after flexibility per date, and a `searchMode: 'dated' | 'anytime'` for date-agnostic monitors, driven by `_local-bdr-policy-001`
- [002-firestore-shared-project-convention](data/002-firestore-shared-project-convention.md) — Reuses `lista-ai-f2916` (shared with Lista Aí); every FlySpot collection carries the `mpa_` prefix

## controls

Architecture controls for risk, security, and compliance at a high level.

- [001-multi-tenant-auth-and-account-lifecycle](controls/001-multi-tenant-auth-and-account-lifecycle.md) — Firebase ID token verification + userId scoping on every route; account deletion cascades (LGPD)

## application

System and service design decisions at application level.

- [001-pricing-source-abstraction](application/001-pricing-source-abstraction.md) — Scan logic isolated behind `scanSimulator.ts`, swappable for real Duffel/Amadeus adapters without touching the rest of the system
- [002-outbox-email-delivery](application/002-outbox-email-delivery.md) — `mpa_outbox` + `services/publisher` for real e-mail (Fase 5); outbox is a thin pointer to the already-created `NotificationLog`, not a replacement for it
- [003-stripe-billing-architecture](application/003-stripe-billing-architecture.md) — Stripe SDK for checkout/portal/webhook signing (Fase 6); webhook idempotency reuses the outbox's dedup pattern; monitor limit counts total monitors (not just active) to close a pause-and-recreate loophole; downgrade pauses excess monitors, never deletes
