---
name: _local-adr-policy-001-cloud-run-deploy-architecture
description: Backend deploys to Cloud Run (not Firebase Cloud Functions), via a native Artifact Registry repository (not legacy gcr.io), through a GitHub Actions workflow_dispatch pipeline (not manual gcloud/Cloud Shell). Amended to bring the apps/web (Next.js) frontend onto the same Cloud Run path instead of Vercel. Use when touching services/api's Dockerfile, deploy.yml, or any service (generator, publisher, web) that needs the same deploy path.
apply-to: services/api, services/generator, services/publisher, and apps/web deploy setup
valid-from: 2026-07-30
---

# _local-adr-policy-001: Cloud Run deploy architecture

## Context and Problem Statement

The backend needed a production deploy path on GCP under the shared Firebase project
`lista-ai-f2916` (Spark plan, shared with the inactive Lista Aí product), with a
one-click trigger the product owner (non-technical) could operate without copy-pasting
gcloud commands between screens.

Question: what deploy target, image registry, and trigger mechanism satisfy a Spark-plan
project and a non-technical operator?

## Decision Outcome

**Cloud Run (container) + native Artifact Registry + GitHub Actions `workflow_dispatch`**

`services/api` builds a multi-stage Docker image, pushed to a native Artifact Registry
repository (`southamerica-east1-docker.pkg.dev/lista-ai-f2916/flyspot`), deployed to Cloud
Run in `southamerica-east1`, all triggered by a GitHub Actions workflow with a manual
"Run workflow" button — no gcloud CLI, no Cloud Shell.

### Details

- Acceptance criterion (verifiable): the project owner can deploy by clicking "Run workflow"
  in the GitHub Actions tab; no terminal or gcloud command is required at any step.
- Cloud Run, not Cloud Functions: Cloud Functions requires the Firebase project to be on the
  Blaze plan; `lista-ai-f2916` stays on Spark because it also serves the unrelated Lista Aí
  product and there is no reason to force a plan upgrade for this product alone. This applies
  to every future Cloud Run service in this repo (`generator`, `publisher`).
- Native Artifact Registry, not `gcr.io`: the legacy Container Registry domain is blocked by a
  GCP deprecation policy on `repositories.createOnPush` for new projects, independent of IAM
  permissions — confirmed after granting the deploy service account Artifact Registry Admin
  and still failing. The `deploy.yml` workflow idempotently describes-or-creates the native
  repo before every push.
- The deploy service account (`flyspot-deploy`) requires four IAM roles: Cloud Run Admin,
  Storage Admin, Artifact Registry Admin, Service Account User. Missing any one reproduces
  the same generic push failure, so all four are a hard requirement, not a nice-to-have.
- Same pattern as the sibling project `multi-agent-system` (`lexforum-ai-studio`) — reuse it
  rather than inventing a new deploy shape when `generator`/`publisher` are created.

## Amendment: apps/web deploys to Cloud Run, not Vercel

`CLAUDE.md`'s stack table and `ROADMAP.md`'s Fase 2 task 7 originally named Vercel as the
frontend deploy target. No ADR ever justified that choice — it was carried forward as the
reflexive Next.js/Vercel pairing (Vercel is the company that makes Next.js) from early planning,
never re-examined against this specific product. It was also never actually executed: `apps/web`
has never been deployed anywhere, Vercel or otherwise; the only thing live in production has been
`services/api` serving the older pre-Fase-2 Vite SPA from `web-dist/`.

When this gap surfaced (the product owner asking "where is our page?"), reviewing what Vercel
would actually add for this project found nothing FlySpot uses: every page in `apps/web` is
`export const dynamic = 'force-dynamic'` (fully client-rendered, no static generation or ISR to
accelerate), there is no `next/image` usage, no Edge Middleware. Every other GCP-project the
product owner runs already lives on Cloud Run, and Vercel's Hobby tier explicitly prohibits
commercial use in its terms — a paid Vercel plan (~US$20/month) would be a new recurring cost and
a new account relationship for a feature set Cloud Run already serves for the rest of this
monorepo at no additional cost.

**Decision: `apps/web` deploys as its own Cloud Run service (`flyspot-web`), same pattern as
`api`/`generator`/`publisher`** — Next.js in standalone output mode (`next start` in a
minimal Docker image), added as a fourth block in `deploy.yml`. `services/api` stops serving
`web-dist/` (the old Vite SPA) once `flyspot-web` is live — Fase 2 task 7's original intent
("`api` vira API pura"), just via Cloud Run instead of Vercel.

## Considered Options

- Firebase Cloud Functions — rejected: requires Blaze plan upgrade for a shared project that
  doesn't need it otherwise.
- Manual `gcloud` deploy from Cloud Shell — rejected by the product owner explicitly: "não
  quero retroceder e voltar a ter que ficar copiando e colando comandos entre telas."
- Legacy `gcr.io` registry — rejected: blocked by GCP policy on this project, independent of
  IAM fixes attempted.

## References

- `ROADMAP.md`, Fase 1 — full changelog of every infra blocker resolved (Firestore API,
  Firestore DB creation, billing account, Artifact Registry API, IAM roles, gcr.io migration,
  Cloud Run Admin API)
- Production URL: `https://flyspot-api-1039076887535.southamerica-east1.run.app`
