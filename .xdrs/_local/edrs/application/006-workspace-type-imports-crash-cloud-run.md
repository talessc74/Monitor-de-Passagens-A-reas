---
name: _local-edr-policy-006-workspace-type-imports-crash-cloud-run
description: services/api, services/generator, and services/publisher's esbuild build script must not mark @mpa/types as external — it has no dist/ build output (main points at src/index.ts), so a runtime require('@mpa/types') resolves through a dangling node_modules symlink in the Cloud Run image and crashes with MODULE_NOT_FOUND. Found during the first real deploy.yml run since Fase 4, after Fase 6 introduced the first runtime (non-type) import of @mpa/types (PLAN_LIMITS).
apply-to: services/api/package.json, services/generator/package.json, services/publisher/package.json (esbuild build script)
valid-from: 2026-07-30
---

# _local-edr-policy-006: Workspace type-only imports crash Cloud Run at MODULE_NOT_FOUND

## Context and Problem Statement

The product owner asked for a Cowork handoff to run `deploy.yml` for the first time since Fase 4 —
covering everything built in Fases 5, 6, and the Fase 2 Vercel-to-Cloud-Run correction all at
once. The `flyspot-api` deploy step failed twice, identically, with Cloud Run reporting the
container failed to bind its port within the startup timeout.

Cowork's first hypothesis — a Stripe/`APP_URL` secret being empty and crashing boot — was ruled
out by direct reproduction: running `services/api` locally with every one of those variables set
to an empty string (`node dist/index.cjs`) booted cleanly, because `_local-edr-policy-005` had
already fixed exactly that failure mode in an earlier pass. The real cause needed the actual Cloud
Run revision logs, which Cowork then pulled: `MODULE_NOT_FOUND` for `@mpa/types` at boot.

Root cause, traced from there: `@mpa/types`'s `package.json` has no build step —
`"main": "src/index.ts"` points straight at TypeScript source, never compiled to a `dist/`. Every
service's Dockerfile only copies `node_modules` and its own `dist/` into the runtime stage — never
`packages/types/`. `node_modules/@mpa/types` is an npm-workspaces symlink to `../../packages/types`;
Docker's `COPY` preserves that symlink as a symlink rather than dereferencing it, so in the runtime
image it points at a path (`/app/packages/types`) that was never copied in — a dangling symlink.

This bug has existed since Fase 1's very first Dockerfile, but stayed **inert**: every import of
`@mpa/types` across all three services, until Fase 6, was `import type { ... }` — a type-only
import that TypeScript and esbuild erase completely at compile time, producing no runtime
`require('@mpa/types')` call at all. Fase 6 added `import { PLAN_LIMITS } from '@mpa/types'` in
`services/api/src/routes/{billing,monitors}.ts` and `services/generator/src/purgeHistory.ts` —
`PLAN_LIMITS` is a real exported constant, not a type, so this is the first import that survives
into the bundled output as an actual `require()` call. The dangling-symlink Dockerfile bug had
never been exercised before, because nothing needed `@mpa/types` to exist as a runtime module
until now — and it was never caught because `deploy.yml` had not been re-run since before Fase 6
existed.

## Decision Outcome

**Stop marking `@mpa/types` as an esbuild-external package; keep every other real npm dependency
external as before.**

Each service's `build` script replaced `--packages=external` (which externalizes every bare-import,
`@mpa/types` included) with an explicit list of `--external:<package>` flags naming only its real
npm dependencies (`fastify`, `firebase-admin`, `zod`, and — for `services/api` —
`@fastify/cors`/`@fastify/helmet`/`@fastify/rate-limit`/`@google/genai`/`stripe`). `@mpa/types` is
no longer in that list, so esbuild resolves and inlines its (tiny, dependency-free) source directly
into `dist/index.cjs` — the same outcome a `type`-only import already had, now also true for the
value exports. No Dockerfile changes were needed; the fix is entirely in what esbuild bundles.

### Details

- Acceptance criterion (verifiable): building each service (`npm run build --workspace=@mpa/api`,
  `@mpa/generator`, `@mpa/publisher`) produces a `dist/index.cjs` containing zero occurrences of
  the literal string `@mpa/types` — confirmed via `grep -c '@mpa/types' dist/index.cjs` returning 0
  for all three.
- Acceptance criterion (verifiable): running the built `dist/index.cjs` with `node_modules/@mpa`
  entirely removed (reproducing exactly what the Cloud Run runtime image looks like — no
  `packages/types` ever copied in) boots successfully for `services/api` and `services/generator`;
  validated locally by deleting `node_modules/@mpa` from a copy of the install and running
  `node dist/index.cjs` directly, observing a clean `"Server listening"` log line with no
  `MODULE_NOT_FOUND`.
- `services/publisher` was rebuilt the same way but could not be boot-tested end-to-end in this
  sandbox — it crashes on missing Google Application Default Credentials here (expected: Cloud Run
  provides ADC automatically via its service account; this sandbox has none configured). Its
  bundle was confirmed to contain zero `@mpa/types` references, same as the other two.
- If `@mpa/types` ever gains a real runtime dependency of its own (today it has none — only plain
  interfaces and one small `const` object), that dependency would need to either also be bundled or
  be added to each service's build script's external list — worth checking the next time
  `packages/types/src/index.ts` grows.

## References

- `_local-edr-policy-005` — the previous finding from the same review lineage (empty-string env
  vars crashing boot); ruled out first via direct local reproduction before chasing this one
- `_local-adr-policy-003` — introduced the first real (non-type) `@mpa/types` import
  (`PLAN_LIMITS`) that exposed this dormant Dockerfile defect
- Found and fixed 2026-07-30, via a Cowork-assisted production deploy attempt and Cloud Run
  revision logs — not caught by CI, since `npm run lint`/`build` never actually executes the
  bundled output the way Cloud Run does
