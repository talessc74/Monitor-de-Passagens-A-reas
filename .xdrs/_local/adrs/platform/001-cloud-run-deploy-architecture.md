---
name: _local-adr-policy-001-cloud-run-deploy-architecture
description: Backend deploys to Cloud Run (not Firebase Cloud Functions), via a native Artifact Registry repository (not legacy gcr.io), through a GitHub Actions workflow_dispatch pipeline (not manual gcloud/Cloud Shell). Use when touching services/api's Dockerfile, deploy.yml, or any new service (generator, publisher) that needs the same deploy path.
apply-to: services/api, and any future services/generator or services/publisher deploy setup
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
