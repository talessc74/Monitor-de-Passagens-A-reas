---
name: _local-adr-policy-002-manual-admin-access-override
description: A manual, Stripe-independent "full access" override (UserProfile.isAdmin) for the developer's own account and for granting beta-tester access on request — gated by a server-side email allowlist (ADMIN_EMAILS), never a client-settable field. Use when touching plan-limit enforcement (monitor creation, scan interval, history retention) or /api/admin routes.
apply-to: packages/types (UserProfile.isAdmin, effectiveLimits), services/api/src/auth.ts (requireAdmin), services/api/src/routes/admin.ts, services/generator/src/scheduler.ts, services/generator/src/purgeHistory.ts, apps/web/src/app/profile/page.tsx
valid-from: 2026-08-03
---

# _local-adr-policy-002 (controls): manual admin access override

## Context and Problem Statement

The product owner (also the developer and primary beta-tester) asked for "full access to
everything" on their own account, plus a way to grant the same to beta-testers as agreed — without
routing either through Stripe checkout. `plan: 'free' | 'pro'` already gates three things
(`maxMonitors`, `scanIntervalHours`, `historyRetentionDays` via `PLAN_LIMITS`), all Stripe-driven.
The question: how to grant unlimited-equivalent access without corrupting the billing model or
opening a self-service privilege-escalation path.

## Decision Outcome

**A separate `isAdmin: boolean` field on `UserProfile`, orthogonal to `plan`, resolved through one
new helper (`effectiveLimits`) at every enforcement point — granted only via a `/api/admin/*` route
gated by a server-side e-mail allowlist (`ADMIN_EMAILS` env var), never a client-supplied flag.**

### Why orthogonal to `plan`, not a third plan value

- `billing.ts`'s Stripe webhook handler writes `{ plan: newPlan, stripeSubscriptionId }` via
  `updateUser(uid, patch)` with `{ merge: true }` — it only ever touches those two keys. Keeping
  `isAdmin` a separate field means a subscription change (upgrade, downgrade, cancellation) can
  never silently clobber an admin grant as a side effect of unrelated Stripe logic.
- `plan` staying strictly `'free' | 'pro'` means every existing Stripe-facing code path
  (`billing.ts`, the `/plans` upgrade CTA) keeps meaning exactly what it already means — no new
  enum value to thread through UI copy that assumes only two plans exist.

### Why a single `effectiveLimits()` helper instead of `isAdmin` checks scattered per call site

Three enforcement points read plan limits today: monitor-count check (`routes/monitors.ts`), scan
interval (`generator/scheduler.ts`), history retention (`generator/purgeHistory.ts`). A bare
`PLAN_LIMITS[profile.plan]` lookup at each site is exactly the shape of bug that's easy to forget
to update — `effectiveLimits(profile)` is the one place `isAdmin` is checked, so a fourth future
enforcement point only has to call the helper, not remember the flag exists.

One exception, not blanket-applied: `generator/scheduler.ts`'s free/pro interval hours still read
`env.FREE_SCAN_INTERVAL_HOURS`/`env.PRO_SCAN_INTERVAL_HOURS` (ops-configurable without a redeploy of
`@mpa/types`) rather than `effectiveLimits()`'s hardcoded pro-equivalent value — `effectiveLimits()`
is only consulted when `profile.isAdmin` is true, preserving that existing configurability for the
non-admin path instead of quietly removing it.

### Why an e-mail allowlist (`ADMIN_EMAILS`), not a Firestore-only flag

- Sentinel's zero-trust framing: granting the *ability to grant admin access to others* must not be
  reachable by anyone who merely already has `isAdmin: true` on their own profile — otherwise the
  first grant is one accidental Firestore write away from being self-perpetuating with no
  server-side check independent of that same mutable document. `ADMIN_EMAILS` is a deploy-time env
  var (same no-op-safe pattern as every other optional secret in this codebase, `services/api/src/env.ts`)
  that only the product owner controls via the GitHub Actions secret — it is not writable from any
  authenticated API surface.
- `requireAdmin` (auth.ts) re-checks the allowlist on every call, chained after `authenticate` — no
  session-level caching of "is this caller an admin" that could go stale after a revocation.

### Why the grant is visible to the recipient (Sovereign's identity/consent framing)

`/profile` shows a small "Acesso total" badge next to the plan name whenever `isAdmin` is true —
a beta-tester granted this should see it, not have their plan silently behave differently from what
the UI claims. The admin-management panel itself (email input + concede/revoke) is only rendered
for `profile.isAdmin === true`, so it's invisible to everyone else rather than a disabled/greyed-out
affordance that reveals the feature exists.

### Details

- `POST /api/admin/grant-access` — body `{ email, isAdmin: boolean }`, `preHandler: [authenticate, requireAdmin]`.
  404s if no `UserProfile` exists for that e-mail yet (the target must have logged in at least once —
  `ensureUser` is what creates the Firestore doc, on first `/api/me` call).
- `ADMIN_EMAILS` — comma-separated e-mail list, same no-op-without-config convention as
  `RESEND_API_KEY`/`TRAVELPAYOUTS_API_TOKEN`: absent means the allowlist is empty, `requireAdmin`
  always 403s, never "no allowlist configured, so allow everyone."
- Acceptance criterion (verifiable): an account with `isAdmin: true` can create more than 10
  monitors (the Pro cap) and gets scanned on the Pro-equivalent interval; a `POST
  /api/admin/grant-access` call from a non-allowlisted e-mail 403s regardless of the request body.

## Considered Options

- **Alias admin to `plan: 'pro'`** — rejected: conflates a manual grant with a real Stripe
  subscription; a webhook event for that user (however unlikely without a real subscription) could
  overwrite it, and it gives no way to tell "actually paying" from "granted for free" apart in any
  future reporting.
- **Allow any authenticated user with `isAdmin: true` to call the grant endpoint** — rejected per
  Sentinel's note above: self-perpetuating privilege with no independent server-side gate.

## References

- `_local-adr-policy-003` (application) — the existing Stripe billing architecture and `PLAN_LIMITS`
  table this decision extends without modifying
- `_local-adr-policy-001` (controls) — multi-tenant auth and account lifecycle, the `authenticate`
  preHandler this ADR's `requireAdmin` chains after
