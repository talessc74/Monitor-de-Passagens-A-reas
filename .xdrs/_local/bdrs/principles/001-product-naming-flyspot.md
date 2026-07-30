---
name: _local-bdr-policy-001-product-naming-flyspot
description: FlySpot is the official brand name; the repository, Firebase project (lista-ai-f2916), and mpa_ collection prefix keep their inherited internal names and are never renamed to match the brand. Use when naming anything user-facing, or when tempted to rename an internal technical identifier for brand consistency.
apply-to: All user-facing surfaces (UI, marketing, domain, communication); does not apply to internal technical identifiers
valid-from: 2026-07-30
---

# _local-bdr-policy-001: Product naming — FlySpot

## Context and Problem Statement

The product needed an official brand name distinct from the repository's original working
name ("Monitor de Passagens Aéreas"). Question: what is the brand name, and do internal
technical identifiers (repo name, Firebase project, collection prefix) need to change to
match it?

## Decision Outcome

**Brand name: FlySpot. Internal identifiers stay as they are — deliberately, permanently.**

**FlySpot** is the product's brand for UI, domain (`flyspot.com.br`, registered), marketing,
and all user/customer-facing communication. The GitHub repository name, the Firebase project
id (`lista-ai-f2916`), and the Firestore collection prefix (`mpa_`) keep their inherited
internal names from the project's early days.

### Details

- Acceptance criterion (verifiable): no code change ever renames `lista-ai-f2916`,
  `mpa_*` collections, or `@mpa/*` package names for branding reasons; any PR attempting to
  do so should be rejected on this ground alone.
- Rationale for not renaming: these are internal technical identifiers with real migration
  cost (Firestore collection renames require data migration; the Firebase project id cannot
  be changed at all) and zero user-facing benefit — no customer ever sees `lista-ai-f2916`
  or `mpa_monitors`.
- This decision does not apply to anything a user sees: UI copy, e-mail sender name, support
  contact address, App/Play store listing, etc. must all say FlySpot.

## References

- `CLAUDE.md`, "Nome do produto"
- Domain registration: `flyspot.com.br`
