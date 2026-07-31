---
name: _local-adr-policy-003-firebase-hosting-custom-domain-rewrite
description: Cloud Run's native "Custom Domains" (domain mapping) does not support southamerica-east1 — the console blocks it and suggests copying the service to a different region or using a load balancer/Firebase Hosting. Decision — use Firebase Hosting as the domain-facing layer with a rewrite into the existing flyspot-web Cloud Run service, keeping the service in its current region. Use when mapping flyspot.com.br (or any future custom domain) to a Cloud Run service running in southamerica-east1.
apply-to: firebase.json (hosting config), hosting/public, flyspot-web (Cloud Run service, unchanged)
valid-from: 2026-07-31
---

# _local-adr-policy-003 (platform): flyspot.com.br → Firebase Hosting rewrite, not Cloud Run domain mapping

## Context and Problem Statement

Attempting to map `flyspot.com.br` directly onto the `flyspot-web` Cloud Run service (via Cloud Run
console → Custom Domains) failed with: "Os mapeamentos de domínio não estão disponíveis na região
do serviço selecionado. Copie esse serviço para uma região diferente e use um balanceador de
carga de aplicativo ou o Firebase Hosting." — Cloud Run's native domain-mapping feature has a
smaller region allowlist than Cloud Run itself, and `southamerica-east1` isn't in it.

## Decision Outcome

**Use Firebase Hosting as the domain-facing layer, with a wildcard rewrite into the existing
`flyspot-web` Cloud Run service (`southamerica-east1`) — the service itself does not move or
duplicate.**

### Why, against the two alternatives actually on the table

- **Move/copy the service to a supported region (e.g. `us-central1`)** — rejected: FlySpot's users
  are Brazilian, and `southamerica-east1` was chosen for exactly that reason (same region as the
  rest of the stack, per `ROADMAP.md` Fase 1). Moving the service further from its users to satisfy
  a domain-mapping feature limitation is solving the problem backwards.
- **Global External HTTPS Load Balancer + Serverless NEG** — rejected as more than this problem
  needs: it is the "correct" GCP-native answer, but it's a new billed resource (forwarding rules,
  the LB itself) and a second piece of infra to maintain (backend service, NEG, managed cert)
  purely to solve a domain-mapping gap. This project has exactly one Cloud Run region already
  and no other need for a load balancer.
- **Firebase Hosting rewrite (chosen)** — the project already runs on a Firebase project
  (`lista-ai-f2916`) for Firestore and Authentication; Firebase Hosting's custom-domain support has
  no such region restriction (it fronts the request through Firebase's own edge network and
  forwards to the Cloud Run service's URL, which works regardless of the service's region — this is
  Firebase's documented pattern for exactly this situation, not a workaround). No new billed
  resource beyond Hosting's free tier at FlySpot's traffic level, and the domain verification flow
  is the same Firebase Console the project already uses for Auth.

### Details

- `firebase.json` gains a `hosting` block: `public: "hosting/public"` (a near-empty directory —
  Hosting requires one to exist even when every request is rewritten) and a single wildcard
  rewrite (`source: "**"`) targeting `run: { serviceId: "flyspot-web", region: "southamerica-east1" }`.
  This does not touch `flyspot-web`'s own deploy (`deploy.yml`, `Dockerfile`) — Hosting calls the
  same running service by name/region, it doesn't need a new container or build step.
- The Cloud Run service keeps whatever URL it already has
  (`flyspot-web-1039076887535.southamerica-east1.run.app`) — that URL is not removed or changed,
  Firebase Hosting is simply an additional front door to the same backend.
- Adding the custom domain itself (Firebase Console → Hosting → Add custom domain →
  `flyspot.com.br`) still requires: domain ownership verification (a TXT record) and then the A
  records Firebase Hosting provides — both go in whichever DNS host actually controls
  `flyspot.com.br`'s zone (Registro.br's own panel, confirmed as of this decision to still be on
  Registro.br's default nameservers — nothing was configured anywhere else yet). This ADR only
  decides the *mechanism* (Hosting rewrite vs. LB vs. region move); the actual DNS records and
  their creation are tracked in `_local-edr-policy-009` (infra), which is updated to reflect this
  decision instead of the originally-assumed direct Cloud Run domain mapping.
- Acceptance criterion (verifiable): after `firebase deploy --only hosting` and DNS propagation,
  `https://flyspot.com.br` returns the same response as the `run.app` URL for the same path.
- Not yet done: the actual `firebase deploy --only hosting`, adding the custom domain in Firebase
  Console, and creating the resulting DNS records — these remain external-dashboard actions for the
  product owner (or an agent with browser access to the relevant consoles), same class of blocker
  as `_local-edr-policy-009` already documents.

## References

- `_local-edr-policy-009` (infra) — the cutover checklist this decision revises (step 1 changes
  from "Cloud Run domain mapping" to "Firebase Hosting custom domain + rewrite")
- `ROADMAP.md` Fase 1 — why `southamerica-east1` was chosen in the first place (proximity to
  Brazilian users), the constraint this decision protects rather than abandons
