---
name: _local-bdr-policy-002-build-order-defer-paid-apis
description: Build the whole product on the free Gemini price simulator first (Fases 1, 2, UX, scheduler, e-mail, Stripe test mode); only integrate paid Duffel/Amadeus APIs last, after the product is validated. Use when sequencing roadmap work or deciding whether a phase can start.
apply-to: Overall roadmap sequencing (ROADMAP.md); does not change the architectural scope of any individual phase
valid-from: 2026-07-30
---

# _local-bdr-policy-002: Build order — defer paid APIs to last

## Context and Problem Statement

The product owner does not want to take on real API cost (Duffel/Amadeus production
contracts, Stripe outside test mode) before the product is validated. Most services in the
roadmap are free in development/sandbox/test mode (Amadeus sandbox, Stripe test mode,
Firebase/Resend free quotas) — only formalizing a Duffel/Amadeus production contract early
would create real cost before it's warranted.

## Decision Outcome

**Build the whole product on the existing Gemini simulator first; integrate real pricing
APIs last**

Execution order: Fase 1 (Firestore + deploy) → Fase 2 (login) → UX/UI complete (site fully
built on the simulator) → scheduler (tested against the simulator) → e-mail (Resend free
quota) → Stripe in test mode → real Duffel/Amadeus integration last → final QA/LGPD. This is
possible without redesigning anything because pricing is already isolated behind one call
site (`_local-adr-policy-001`, pricing source abstraction).

### Details

- Acceptance criterion (verifiable): no Duffel/Amadeus production account exists and no
  Stripe live-mode charge occurs until every other phase listed above has shipped.
- This decision governs *sequencing only* — it does not change the technical scope or
  acceptance criteria of any individual phase, which remain as documented per-phase.
- `ROADMAP.md` reflects this physically: phases are listed in this execution order (not
  architectural-scope order), with the original scope number kept in parentheses for
  cross-reference.

## References

- `ROADMAP.md`, "Por que esta ordem" — full phase-by-phase correspondence table
- `_local-adr-policy-001` (application) — the pricing abstraction that makes this deferral
  possible without a rewrite
