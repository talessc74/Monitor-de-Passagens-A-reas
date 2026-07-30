---
name: _local-adr-policy-003-stripe-billing-architecture
description: Stripe integration architecture for Fase 6 monetization — checkout/portal routes, signed+idempotent webhook, plan enforcement counting total monitors (not just active), and automatic pausing of excess monitors on downgrade. Use when touching services/api billing routes, the Stripe webhook handler, UserProfile plan fields, or monitor-creation limit enforcement.
apply-to: services/api billing routes and webhook, packages/types UserProfile/PlanLimits, services/api monitorsRepository enforcement, services/generator history purge job
valid-from: 2026-07-30
---

# _local-adr-policy-003: Stripe billing architecture

## Context and Problem Statement

Fase 6 introduces a paid Pro plan (test mode only — no real charges) with different limits than
Free: monitor count, scan frequency, and price-history retention. This requires: a checkout flow,
a way for the user to manage/cancel their subscription, a way for our backend to learn about
subscription state changes, and enforcement of the plan's limits that cannot be bypassed by
calling the API directly (UI-only enforcement is not enforcement).

The product owner confirmed the plan table as proposed (Free: 2 monitors/6h scans/7-day history;
Pro: 10 monitors/1h scans/90-day history, R$29/month), confirmed a 10-day free trial, and
confirmed their existing Stripe account already receives payments in Brazil without a CNPJ
(validated on a sibling project), removing the business blocker the roadmap flagged before any
code in this phase.

Questions: how is the webhook trusted and processed exactly once per event; what exactly does
"monitor limit" count; what happens to a user's monitors when they downgrade.

## Decision Outcome

**Official Stripe SDK for checkout/portal/webhook signature verification; webhook idempotency via
the same deterministic-ID `.create()` pattern as the Fase 5 outbox; monitor limit counts every
monitor the user owns regardless of status; downgrade pauses (never deletes) monitors beyond the
new limit, keeping the oldest by `createdAt`.**

### Checkout and portal

- `POST /billing/checkout` (authenticated): creates a Stripe Checkout Session for the Pro price,
  with `client_reference_id` set to the Firebase `uid` — this is how the webhook maps a Stripe
  event back to a `UserProfile` without trusting any client-supplied identifier. Includes
  `subscription_data.trial_period_days: 10` **only** when the user has no `stripeSubscriptionId`
  on record yet (first subscription) — without this guard, cancel-and-resubscribe would grant an
  unlimited trial.
- `POST /billing/portal` (authenticated): creates a Stripe Customer Portal session for the user's
  `stripeCustomerId`, so the user can update payment method or cancel without us building UI for it.

### Webhook: signature and idempotency

- `POST /webhooks/stripe` is registered outside `authenticate` (Firebase) and outside
  `authenticateInternal` (shared-secret) — neither applies to a request originating from Stripe's
  servers. It is not implicit trust: the request is denied by default until
  `stripe.webhooks.constructEvent(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET)` validates the
  signature against the raw request body (Fastify's default JSON body parser must be bypassed for
  this route specifically, since signature verification requires the exact bytes Stripe sent).
- Every event is recorded in `mpa_webhook_events`, keyed by Stripe's own `event.id`, written via
  `.create()` before processing — a second delivery of the same `event.id` (Stripe explicitly
  documents that webhooks can be delivered more than once) hits `ALREADY_EXISTS` and is ignored,
  identical in shape to `_local-adr-policy-002`'s outbox dedup mechanism. This is deliberate reuse
  of an already-validated pattern, not a new idempotency mechanism invented for this phase.
- Handled events: `checkout.session.completed` (sets `plan: 'pro'`, `stripeCustomerId`,
  `stripeSubscriptionId` on the `UserProfile` identified by `client_reference_id`),
  `customer.subscription.updated` (re-syncs `plan` from the subscription's `status` — `active` or
  `trialing` means Pro, anything else means Free), `customer.subscription.deleted` (sets
  `plan: 'free'`). The last two both trigger `pauseExcessMonitorsForUser`.

### What "monitor limit" counts

The limit counts **every monitor the user owns, active or paused** — not only `status: 'active'`.
Counting only active monitors is trivially bypassable (pause old monitors, create new ones
unpaused, reactivate in bulk), so `PLAN_LIMITS[plan].maxMonitors` is checked against
`listMonitorsForUser(userId).length` in `POST /api/monitors`, returning `403` with an
upgrade-oriented message when the count is already at the limit — enforced server-side, not only
hidden in the UI.

**Known accepted limitation:** the count-then-create sequence is not wrapped in a Firestore
transaction, so two concurrent `POST /api/monitors` requests from the same user at exactly the
limit could both read a count below the limit and both succeed, landing one monitor over. This is
a low-probability race (a single user firing genuinely concurrent creation requests against
themselves) rather than an externally exploitable bypass, and closing it fully would require
moving monitor creation into a transaction that also reads the user's current count — deferred
until a real occurrence or a stricter compliance requirement justifies the added complexity.

### Downgrade behavior

`pauseExcessMonitorsForUser(userId, newLimit)` is a pure, independently testable function (not
inlined in the webhook handler): it lists the user's monitors ordered by `createdAt` ascending,
keeps the oldest `newLimit` as-is, and sets `status: 'paused'` on the rest. Monitors are **never
deleted** by a downgrade — history and configuration survive, and the user can re-activate them
(subject to the limit) if they resubscribe.

### Data stored from Stripe

Only two opaque identifiers are added to `UserProfile`: `stripeCustomerId` and
`stripeSubscriptionId`. No payment method, billing address, or cardholder data is ever persisted
in Firestore — that surface stays entirely on Stripe's side, reachable only through the Customer
Portal link `/billing/portal` issues.

## Details

- Acceptance criterion (verifiable): a free user with 2 monitors (any status) gets `403` from
  `POST /api/monitors` on a 3rd creation attempt, including a direct API call bypassing the UI.
- Acceptance criterion (verifiable): replaying the same Stripe webhook `event.id` twice produces
  the plan-state side effect exactly once (`mpa_webhook_events` doc creation fails with
  `ALREADY_EXISTS` on the second delivery).
- Acceptance criterion (verifiable): a Pro user with 5 monitors who downgrades to Free (limit 2)
  ends up with the 2 oldest-`createdAt` monitors still `active` and the remaining 3 set to
  `paused` — none deleted.
- The history-retention purge (7 days Free / 90 days Pro) runs once per day inside
  `services/generator` (the existing persistent-process pattern from Fase 4), trimming
  `FlightMonitor.history` entries older than the user's plan's retention window — it does not
  touch `NotificationLog` or `mpa_outbox`.

## Considered Options

- **Custom HMAC verification instead of the Stripe SDK** — rejected: this project avoids adding
  SDKs where a thin `fetch` client suffices (Resend, in Fase 5), but Stripe's webhook signing
  scheme is non-trivial to reimplement correctly (timestamp tolerance, multiple signature
  versions) and the official SDK is the vendor-recommended, audited path — the tradeoff that
  favored `fetch` for Resend does not hold here.
- **Count only `status: 'active'` monitors against the limit** — rejected per Ghost's tension: a
  status-only count is bypassable by pausing old monitors and creating new ones, making the limit
  decorative rather than enforced.
- **Delete monitors beyond the limit on downgrade** — rejected: destroys price history and
  configuration the user may want back after resubscribing; pausing is reversible, deleting is not.

## References

- `_local-adr-policy-002` — outbox pattern whose dedup mechanism (`.create()` + deterministic ID)
  this decision reuses for webhook idempotency
- `ROADMAP.md` Fase 6 — plan table (limits, price) and acceptance criteria this decision implements
