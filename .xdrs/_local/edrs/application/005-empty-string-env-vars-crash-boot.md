---
name: _local-edr-policy-005-empty-string-env-vars-crash-boot
description: services/api's env.ts must treat an empty-string environment variable the same as an absent one before Zod validation — GitHub Actions/Cloud Run inject unset secrets as empty strings, not as missing keys, which silently breaks any `.optional()` field that also carries an extra validator (`.url()`, `.min()`). Found during a Fase 6 code-review audit (Galera do Código) after a container reset required reconstructing the Stripe integration from scratch.
apply-to: services/api/src/env.ts
valid-from: 2026-07-30
---

# _local-edr-policy-005: Empty-string env vars crash the boot

## Context and Problem Statement

After a container reset mid-session lost the uncommitted Fase 6 backend work, the user asked for
a full correctness audit before merging the reconstruction — not just a re-check that the lint
passed. The Galera do Código (Scout, Literate, Flux) reviewed the diff line by line against
`_local-adr-policy-003` and found a defect unrelated to the file loss itself, introduced (and, in
one case, pre-existing) in `services/api/src/env.ts`.

Three fields combine `.optional()` with an additional Zod validator:
`APP_URL: z.string().url().optional()`, `INTERNAL_SCAN_TOKEN: z.string().min(16).optional()`, and
`EMAIL_ACTION_SECRET: z.string().min(16).optional()`. The intent of `.optional()` in all three is
"the corresponding feature is disabled if this isn't configured" (Stripe redirect URLs,
service-to-service scan auth, pause-link signing, respectively) — each already has a runtime
fallback or a 503 guard for the absent case.

The defect: GitHub Actions' `env_vars: | KEY=${{ secrets.KEY }}` syntax (used throughout
`deploy.yml`) always emits the `KEY=` line, even when the referenced secret doesn't exist —
substituting an **empty string**, not omitting the variable. Cloud Run then sets that environment
variable to `""`, which is present, not absent. Zod's `.optional()` only treats `undefined` as
absent; an empty string still runs through `.url()` or `.min(16)` and fails validation. The result
is `envSchema.safeParse` failing entirely and `loadEnv()` calling `process.exit(1)` — the whole
`services/api` container crash-loops on Cloud Run, for a value that was supposed to be
gracefully optional.

`EMAIL_ACTION_SECRET`'s GitHub secret is confirmed still unset (`ROADMAP.md`'s Fase 5 "Ações fora
do código" checkbox is open) — this bug has been live on `main` since the Fase 5 merge, latent
only because `deploy.yml` has not been re-run since. Fase 6 introduced `APP_URL` into
`deploy.yml` following the same pattern, which would have hit the identical crash the first time
a deploy ran without that secret configured too.

## Decision Outcome

**Normalize empty-string environment values to `undefined` before Zod parses them, in `loadEnv()`.**

```ts
const sanitized = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value])
);
const parsed = envSchema.safeParse(sanitized);
```

This restores the actual intent of every `.optional()` field in the schema without weakening any
required field (a required field with an empty string still fails, correctly — `undefined` isn't
a valid value for a non-optional field either). It is a general fix, not a special case per
variable, so it also protects any future optional-plus-validator field without needing to be
revisited each time one is added.

### Details

- Acceptance criterion (verifiable): booting `services/api` with `EMAIL_ACTION_SECRET=""` (or
  `APP_URL=""`, `INTERNAL_SCAN_TOKEN=""`) in the environment succeeds — the service starts, and
  the corresponding feature (pause-link signing, Stripe redirect base URL, internal scan auth)
  behaves exactly as if the variable were entirely absent (falls back to its documented default
  or returns 503/401 for the dependent route).
- This fix lives only in `services/api/src/env.ts`. `services/generator` and `services/publisher`
  were reviewed for the same pattern: neither currently has a field that is both `.optional()` and
  carries an extra validator fed by a value that can legitimately be empty in `deploy.yml`, so no
  change was needed there in this pass — but the same audit should be repeated if a future phase
  adds one.
- `deploy.yml`'s new `APP_URL=${{ vars.APP_URL }}` line (introduced alongside this bug) was also
  corrected to `secrets.APP_URL` — this repository has no prior use of GitHub Actions' `vars`
  context anywhere else, and introducing it without documenting a new ops action would have been
  its own undocumented gap. `APP_URL` is now listed under Fase 6's "Ações fora do código."

## References

- `_local-adr-policy-003` — the Stripe integration whose `APP_URL` addition to `deploy.yml`
  surfaced this defect during review
- `_local-edr-policy-002` — the prior instance of a QA/review pass finding a real defect in
  already-written code before merge, same project convention
- Found and fixed 2026-07-30, during a Galera do Código audit requested explicitly by the product
  owner after a container reset — no automated regression test exists yet for env parsing;
  `services/api` has no test suite at all today (tracked as a coverage gap, Fase 8 per `ROADMAP.md`)
