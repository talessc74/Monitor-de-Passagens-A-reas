---
name: _local-adr-policy-002-firestore-shared-project-convention
description: FlySpot reuses the existing Firebase project lista-ai-f2916 (shared with the inactive Lista Aí product) instead of creating a new project, and every collection this product owns must use the mpa_ prefix. Use when creating or querying any Firestore collection, or when deciding whether a new Firebase project is needed.
apply-to: services/api/src/firestore.ts and any code reading or writing Firestore collections
valid-from: 2026-07-30
---

# _local-adr-policy-002: Firestore shared-project convention

## Context and Problem Statement

FlySpot needed a Firestore database. The organization already has a Firebase project,
`lista-ai-f2916`, created for a now-inactive product (Lista Aí). Question: create a new
Firebase project for FlySpot, or reuse the existing one — and if reused, how to guarantee
FlySpot's data never collides with Lista Aí's leftover data?

## Decision Outcome

**Reuse `lista-ai-f2916`; every FlySpot collection is prefixed `mpa_`**

FlySpot's Firestore data lives in the same project as Lista Aí. Every collection this
product owns — `mpa_monitors`, `mpa_notifications`, `mpa_sites`, `mpa_users` — carries the
`mpa_` prefix (the repository's original internal name, Monitor de Passagens Aéreas),
guaranteeing no collision with any unprefixed Lista Aí collection in the same project.

### Details

- Acceptance criterion (verifiable): every collection name referenced anywhere in
  `services/api` resolves through `COLLECTIONS` in `services/api/src/firestore.ts`; no
  string literal collection name without the `mpa_` prefix is created or queried against
  this project.
- Deliberate non-goal: renaming `lista-ai-f2916`, the `mpa_` prefix, or the `@mpa/*` package
  names to match the FlySpot brand. These are internal technical identifiers; renaming them
  brings no product benefit and only creates migration risk. See `CLAUDE.md`, "Nome do
  produto".
- This convention is what allowed the product to skip creating and provisioning a second
  Firebase project (billing, IAM, API enablement) entirely — a real cost and time saving
  validated in Fase 1.

## References

- `CLAUDE.md`, "Convenção de nomes no Firestore (projeto compartilhado)"
- `services/api/src/firestore.ts` — `COLLECTIONS` constant, the single source of truth
