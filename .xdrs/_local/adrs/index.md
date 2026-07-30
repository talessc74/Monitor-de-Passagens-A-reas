# _local ADRs Index

Architectural and technical decisions for FlySpot.

## platform

Platform-level runtime and enabling capabilities.

- [001-cloud-run-deploy-architecture](platform/001-cloud-run-deploy-architecture.md) — Cloud Run (not Cloud Functions), native Artifact Registry (not gcr.io), GitHub Actions workflow_dispatch (not Cloud Shell)

## data

Data architecture and information modeling choices.

- [001-passenger-and-date-flexibility-model](data/001-passenger-and-date-flexibility-model.md) — `FlightMonitor.passengers` splits into adults/children/infants, and dates gain an optional flexibility window (`flexDays`), driven by `_local-bdr-policy-001`
- [002-firestore-shared-project-convention](data/002-firestore-shared-project-convention.md) — Reuses `lista-ai-f2916` (shared with Lista Aí); every FlySpot collection carries the `mpa_` prefix

## controls

Architecture controls for risk, security, and compliance at a high level.

- [001-multi-tenant-auth-and-account-lifecycle](controls/001-multi-tenant-auth-and-account-lifecycle.md) — Firebase ID token verification + userId scoping on every route; account deletion cascades (LGPD)

## application

System and service design decisions at application level.

- [001-pricing-source-abstraction](application/001-pricing-source-abstraction.md) — Scan logic isolated behind `scanSimulator.ts`, swappable for real Duffel/Amadeus adapters without touching the rest of the system
