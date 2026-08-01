---
name: _local-adr-policy-004-waitlist-landing-root-page
description: Pre-launch waitlist landing page replaces the automatic /login redirect at the root path for unauthenticated visitors, while the real product (login/dashboard) stays reachable unchanged. Email capture stored in a new isolated mpa_waitlist collection, no relation to FlightMonitor/user accounts. Use when touching apps/web's root page, or the waitlist capture flow.
apply-to: apps/web/src/app/page.tsx, apps/web/src/components/WaitlistLanding.tsx, services/api/src/routes/waitlist.ts, packages/types (WaitlistSignup)
valid-from: 2026-08-01
---

# _local-adr-policy-004: Waitlist landing page at the root path

## Context and Problem Statement

The board requested a pre-launch waitlist landing page as FlySpot's first public artifact,
explicitly because the real search engine (Duffel/Amadeus) remains blocked and the Plan B spike
(`_local-bdr-plan-004`) found no viable general-purpose alternative — there is no real backend to
show publicly yet, so the landing "advertises the promise, not the delivery."

The technical question this document answers: where does this page live, given `apps/web`'s root
path (`/`) already has real behavior — it redirects every visitor to `/login` or `/dashboard`
depending on auth state (Fase 2, already in production)?

## Decision Outcome

**The waitlist landing renders directly at `/` for unauthenticated visitors, replacing the
redirect-to-`/login` behavior. Authenticated users still redirect straight to `/dashboard`
unchanged. `/login` remains reachable by direct URL, untouched.**

### Why this instead of a separate path (e.g. `/waitlist` or `/em-breve`)

- The root domain (`flyspot.com.br`) is what any public marketing link (SocialShelf content, niche
  community posts, per the board's Marketing section) will point to. A separate path would require
  every public link to include it and would leave the root domain showing the old redirect-to-login
  behavior — confusing for anyone landing on the bare domain.
- This keeps the board's "isolado, não tocar no fluxo do produto real" requirement intact in the
  sense that matters: `/login` and `/dashboard` are unmodified, still fully functional for
  continued development/testing of the real product. Only the *unauthenticated root* changes what
  it shows.

### Data model and backend

- New `WaitlistSignup` type (`packages/types`) — deliberately minimal (`id`, `email`, `createdAt`),
  no `userId`, no relation to `FlightMonitor` or any authenticated concept — this is pre-account
  interest, not a product entity.
- `mpa_waitlist` Firestore collection (prefix convention per `CLAUDE.md`).
- Document ID = base64url of the normalized (lowercased, trimmed) e-mail, not a random ID — makes
  `.create()` idempotent by construction (Firestore throws `ALREADY_EXISTS` on a duplicate signup
  instead of silently creating a second document), without needing a read-before-write.
- `POST /api/waitlist` — deliberately public, no `authenticate` preHandler: the whole point is
  capturing interest from people who don't have an account.
- Anti-spam: a honeypot field (`website`) that a bot is likely to fill and a human never sees
  (visually hidden, `tabIndex={-1}`, `aria-hidden`) plus the existing global Fastify rate-limit
  plugin already registered in `index.ts` — matches the board's own stated bar ("rate limit ou
  honeypot já é suficiente nessa fase"), no CAPTCHA or third-party anti-bot service added.
- The honeypot schema deliberately does **not** reject a filled value at the Zod layer (would
  return `400`, revealing the filter's existence to an adversarial bot) — validation always
  succeeds; the route handler silently no-ops (returns generic success, writes nothing) when the
  honeypot is non-empty.

### Content constraints enforced in the component (board's non-negotiable rules, Section 2 of the brief)

- No technical data-source name anywhere in copy (Duffel, Amadeus, Travelpayouts, or any other
  vendor) — the promise is the outcome ("te avisamos quando o preço bater sua meta"), never the
  mechanism.
- No launch date or deadline language, explicit or implied — the confirmation message after signup
  says plainly there's no defined date yet, rather than omitting the topic (which could read as an
  implied "soon").
- No claim of technical price accuracy — copy talks about being notified, not about "finding the
  real lowest price."
- Minimal personal-data transparency line ("Usaremos seu e-mail só pra avisar sobre o lançamento do
  FlySpot") shown directly under the form — satisfies this delivery's minimum legal bar per the
  brief; the full Privacy Policy/Terms of Use remain a separate, still-pending Fase 8 item, not a
  blocker for this one.

### Details

- Acceptance criterion (verifiable): visiting `flyspot.com.br` while logged out shows the waitlist
  form, not a redirect; submitting a valid e-mail returns success and creates exactly one
  `mpa_waitlist` document even if submitted twice; `/login` and `/dashboard` behave exactly as
  before for anyone navigating to them directly or already authenticated.
- Not in scope for this pass (per the board's own brief): SocialShelf content publication, full
  Privacy Policy/Terms of Use, any admin view of collected waitlist e-mails (can be read directly
  from Firestore console for now — no UI built for it, deliberately, matching "página estática ou
  quase estática").

## Amendment (2026-08-01): admin notification e-mail on real signup

Product owner asked to receive a real e-mail (to `contato@flyspot.com.br`, the address confirmed to
have an actual working inbox — see `_local-edr-policy-008`/`EMAIL_REPLY_TO` amendment) each time
someone signs up on the waitlist, since the only way to see signups otherwise is opening the
Firestore console directly.

`services/api/src/waitlistNotifier.ts` (new): a thin direct `fetch` call to Resend's REST API,
same shape as `services/publisher/src/resendClient.ts` but living in `api` instead — deliberately
**not** routed through the outbox pattern (`_local-adr-policy-002` application), because this is an
internal admin ping, not a user-facing transactional notification requiring retry/dedup semantics.
Reusing the outbox here would also require `services/publisher`'s outbox consumer to stop assuming
every `monitorId` resolves in `mpa_monitors` (it doesn't for a waitlist signup) — a bigger, unrelated
change for a one-line internal notification.

- New `RESEND_API_KEY` in `services/api`'s env (same secret value as `services/publisher`'s, wired
  into `deploy.yml`'s `flyspot-api` step) — no-op without it, same fallback pattern as every other
  optional integration in this codebase.
- `WAITLIST_NOTIFICATION_EMAIL` (default `contato@flyspot.com.br`).
- Only fires on a genuinely new signup (`addWaitlistSignup`'s `created: true`) — a repeat submission
  of the same e-mail (already idempotent at the Firestore layer) does not re-notify.
- Fire-and-forget from the route handler: a Resend failure is logged, never fails the user's
  waitlist submission itself.

## Considered Options

- **Separate `/waitlist` or `/em-breve` path, root keeps redirecting to `/login`** — rejected: would
  make the bare domain (the one link every public mention will actually use) show developer-login
  UI to a cold visitor, defeating the landing's purpose.
- **CAPTCHA or third-party anti-spam service** — rejected as more than this stage needs; the board's
  brief explicitly says honeypot/rate-limit is sufficient, and adding a new external dependency for
  a single-field form is disproportionate.
- **Reuse `FlightMonitor`'s `email` field / `NotificationLog` shape for the waitlist** — rejected:
  waitlist signups have no relationship to routes, prices, or monitors; forcing them into an
  existing product entity would be a false coupling for the sake of avoiding one new small type.

## References

- Board brief "Landing de Espera (FlySpot)" — the product/content requirements this decision
  implements at the architecture level
- `_local-bdr-plan-004` (product) — the Plan B spike whose inconclusive result is *why* this landing
  exists instead of the real product launching now
- `CLAUDE.md` — `mpa_` collection prefix convention this follows (`mpa_waitlist`)
