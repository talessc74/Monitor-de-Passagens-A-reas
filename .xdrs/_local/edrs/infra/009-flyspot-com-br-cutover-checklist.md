---
name: _local-edr-policy-009-flyspot-com-br-cutover-checklist
description: Runbook for cutting flyspot-web/flyspot-api over from their run.app URLs to the registered flyspot.com.br domain, and for the still-pending Resend SPF/DKIM DNS records — both are external actions (domain registrar + Google Cloud Console) this sandbox has no credentials for, so this document is prepared ahead of time for the product owner to execute directly.
apply-to: apps/web (APP_URL, CORS origin), services/api (CORS allow-list), DNS zone for flyspot.com.br, Cloud Run domain mappings
valid-from: 2026-07-31
---

# _local-edr-policy-009: flyspot.com.br cutover — prepared runbook

## Context and Problem Statement

`flyspot.com.br` was registered in v7 (per `ROADMAP.md`), but two things still point at the raw
Cloud Run URLs instead of the custom domain: the live site itself
(`flyspot-web-1039076887535.southamerica-east1.run.app`) and transactional e-mail, which is blocked
on SPF/DKIM DNS records existing for the domain (`ROADMAP.md` Fase 5, "sem domínio próprio o e-mail
cai em spam, bloqueador real"). Both require access this sandbox does not have: the domain
registrar's DNS panel, and `gcloud`/Cloud Console for Cloud Run domain mapping and Firebase
Authentication's authorized-domains list — none of which are reachable from here (`gcloud` is not
even installed in this environment). This is the same class of blocker as the Duffel/Amadeus
accounts: real progress needs the product owner's hands on an external dashboard, not more code.

This document exists so that when the product owner has the time, execution is a checklist, not a
research problem.

## Decision Outcome

**Prepared checklist, to be executed by the product owner directly (registrar + Google Cloud
Console) — no code change unblocks this.**

### Checklist

1. **Firebase Hosting custom domain** (revised — Cloud Run's native domain mapping does not
   support `southamerica-east1`; see `_local-adr-policy-003` (platform) for why Firebase Hosting
   was chosen over moving the service's region or adding a load balancer):
   - `firebase deploy --only hosting` publishes the `hosting` config in `firebase.json` (wildcard
     rewrite into `flyspot-web`) — this is now automated as a step in `deploy.yml` (runs on every
     `workflow_dispatch`, right after the 4 Cloud Run services). It requires `GCP_SA_KEY`'s
     service account to hold `roles/firebasehosting.admin` in the `lista-ai-f2916` project's IAM —
     if the step fails with a permission error, that role is what's missing (Cloud Console → IAM →
     find the deploy service account → Edit → Add Role → Firebase Hosting Admin). Confirmed
     blocked once already: attempting "Add custom domain" in Firebase Console before this step
     ever ran showed the Hosting product's first-time onboarding screen instead of a live site —
     there was no Hosting site to attach a domain to.
   - Once `deploy.yml` has run successfully with the Hosting step green: Firebase Console →
     Hosting → Add custom domain → `flyspot.com.br` (and `www.flyspot.com.br` if desired).
   - Firebase gives back a TXT record for ownership verification, then the `A` records to point
     the domain at Firebase Hosting's edge (stable, documented IPs — not the Cloud Run service's
     own IP).
2. **DNS records at the registrar** for `flyspot.com.br`:
   - The records from step 1 (site mapping).
   - SPF/DKIM records for Resend (`ROADMAP.md` Fase 5) — Resend's dashboard, once the domain is
     added there, gives the exact `TXT`/`CNAME` records to create; this is the step that unblocks
     transactional e-mail from landing in spam.
3. **Firebase Authentication → Settings → Authorized domains**: add `flyspot.com.br` (and `www.`
   variant if mapped) — Google sign-in and e-mail link auth silently fail on unauthorized domains
   (same class of issue as `_local-edr-policy-008`'s Google sign-in incident, different cause).
4. **Google Cloud Console → Credentials → the OAuth client used for Google Identity Services**:
   add `https://flyspot.com.br` (and `www.` variant) to Authorized JavaScript origins — same
   place `flyspot-web-....run.app` was added in `_local-edr-policy-008`; the `run.app` origin
   should stay too, not be removed (keeps the raw Cloud Run URL working as a fallback/staging entry
   point).
5. **`APP_URL` GitHub Actions secret** (consumed by `deploy.yml` at build time, `services/api/src/env.ts`
   and equivalents): update from the `run.app` URL to `https://flyspot.com.br`, then re-run
   `deploy.yml` so it's baked into the next build. Any CORS allow-list keyed off `APP_URL` picks up
   the new domain automatically since it reads the same env var — no separate code change needed
   unless a service hardcodes the `run.app` origin instead of reading `APP_URL` (audit before
   cutover, not assumed).
6. **Verify, in order**: DNS records resolve (`dig flyspot.com.br`) → Cloud Run mapping shows
   "Certificate: Active" (can take up to 24h for the managed TLS cert) → site loads over
   `https://flyspot.com.br` → Google sign-in works on that origin → a real e-mail send lands in the
   primary inbox, not spam (confirms SPF/DKIM took effect, which itself can take up to 24-48h to
   propagate fully).
7. Once confirmed, decide whether the `run.app` URLs stay reachable (recommended: keep them — no
   reason to break them, and Cloud Run doesn't charge extra for having both) or are documented as
   deprecated in `ROADMAP.md`.

### Details

- Acceptance criterion (verifiable): `https://flyspot.com.br` loads the live product, Google
  sign-in succeeds on that origin, and a test monitor's "meta atingida" e-mail lands in a real
  inbox's primary tab (not spam) — all three checked after DNS propagation, not immediately after
  adding records.
- Nothing in this checklist is destructive or hard to reverse (DNS records can be removed, domain
  mappings deleted, `APP_URL` reverted) — safe to execute without extra caution beyond the normal
  "wait for propagation before concluding it failed."
- This is independent of the Duffel/Amadeus spike (`_local-bdr-plan-002`) and of Fase 8's testing/
  LGPD work — none of the three block each other, they can proceed in any order or in parallel.

## Considered Options

- **Wait until Fase 8 (launch gate) to do this** — rejected as a hard rule: nothing here requires
  Fase 8 to be done first, and transactional e-mail (Fase 5, already built) is actively degraded
  (landing in spam) until the DNS half of this checklist happens — earlier is strictly better here.

## Amendment (2026-08-03)

Item 2's Resend half (SPF/DKIM) is confirmed done — product owner verified `flyspot.com.br` in the
Resend dashboard (Domains → Verified, DKIM `TXT` record present, SPF `MX`+`TXT` records present,
"Enable Sending" on). This resolves the "actively degraded" framing above for outbound e-mail from
this domain specifically. Not yet independently confirmed here: whether `RESEND_API_KEY` (the
GitHub Actions secret consumed by `deploy.yml`) actually holds a valid key from this same Resend
account, and whether a deploy has run since that secret was set — a verified domain doesn't help if
the deployed services aren't authenticating with a real key. Next step to close this out: re-run
`deploy.yml`, then use the real test-send button in the dashboard's "Central de notificações"
(`_local-adr-policy-004` application amendment, `/api/test-email`) to confirm end-to-end.

Items 1, 3, 4 (Firebase Hosting custom domain, Authentication authorized domains, OAuth JS origins)
remain unverified as of this amendment — `flyspot.com.br` is confirmed loading the live site
(product owner screenshot), which implies item 1 succeeded, but items 3-4 (Google sign-in on the
custom domain) have not been explicitly tested in this conversation.

## References

- `ROADMAP.md` v7 note, Fase 5 task 2 and its "Ações fora do código" — where the domain and the
  pending DNS work were first flagged
- `_local-edr-policy-008` — the Google sign-in incident this checklist's step 3-4 extend to the new
  domain (same authorized-origins/authorized-domains mechanism, applied to `flyspot.com.br` instead
  of the `run.app` origin)
