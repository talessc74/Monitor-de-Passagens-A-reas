---
name: _local-bdr-plan-005-plan-b-moblix
description: Follow-up spike to _local-bdr-plan-004 (Travelpayouts), evaluating Moblix as a second Plan B flight-data candidate. Product owner walked the real signup flow through pricing; documents why it was abandoned before an API key was ever issued. Read before evaluating any further third-party flight-data provider as a fallback to the Gemini simulator.
apply-to: services/api (future alternate adapter), packages/types (SearchParams/FlightResult, same shape as _local-bdr-plan-002/004)
valid-from: 2026-08-03
---

# _local-bdr-plan-005: Plan B flight data source — Moblix (abandoned before signup completed)

## Context and Problem Statement

`_local-bdr-plan-004` found Travelpayouts real but narrow (SP-RJ air bridge only, empty on BSB,
international routes). The board's briefing flagged Moblix as a second candidate. Unlike
Travelpayouts, no prior research had confirmed pricing or access model — this session walked the
actual signup flow (business type, agency setup, storefront config) through to the pricing page,
same "test for real, don't just read docs" protocol as the Travelpayouts spike.

## Decision Outcome

**Abandoned before an API key was obtained — the API sits behind a paid plan with no free,
no-card-required tier, unlike Travelpayouts' free token.** Confirmed pricing (`app.moblix.net` →
Configurações → Desenvolvedor → Upgrade), as of 2026-08-03:

| Plano | Preço/mês | Acesso à API Moblix listado? |
|---|---|---|
| Free | R$ 0 | Não |
| Growth | R$ 148–197 (varia entre a tela de preços e o checkout do Stripe) | Não — só lista "Busca de Voos e Hotéis em Tempo Real" como recurso interno da própria interface Moblix, não a API REST |
| Business | R$ 523 | Sim — único plano com "Acesso à API Moblix" explicitamente listado |

Both Growth and Business offer a 7-day free trial, but the trial checkout (Stripe) requires a real
card up front and auto-charges the full monthly price at the end of the 7 days unless canceled —
not a no-risk sandbox like Travelpayouts' token. The product owner clicked into the Growth trial
checkout by mistake (dashboard's flow made it easy to reach Growth's trial before finding
Business's), saw the auto-charge terms, and decided not to proceed on either plan — R$ 523/month
recurring is not justifiable for a pre-launch product with no paying users yet, and even the
correctly-targeted Business trial carries real card-auto-charge risk that needs an explicit
cancel-before-day-7 action to avoid.

### Why this doesn't get evaluated further right now

- FlySpot has no Pro subscribers today (Stripe billing exists per `_local-adr-policy-003` but is
  not yet driving revenue) — recurring R$ 523/month has no revenue to offset it against.
- Unlike Travelpayouts, there was no way to validate actual route coverage (BSB→MIA, the project's
  own canonical gap) before committing to either a card-on-file trial or a paid subscription —
  Moblix's flow doesn't expose a coverage preview or sample response prior to signup.
- The signup flow itself also surfaced an unrelated finding worth flagging separately: Moblix's own
  root domain (`moblix.net`) resolves to nothing (see the earlier Travelpayouts-adjacent marketing
  e-mail confusion) — actual usage happens on `app.moblix.net` and `<agency>.moblix.net` storefront
  subdomains, with `moblix.com.br` as the separate marketing site. Worth remembering if this
  candidate is revisited, to avoid re-treading the same dead-end URL.

## Considered Options

- **Start the Business trial anyway, cancel before day 7 if coverage is narrow** — rejected by the
  product owner in the moment: the risk of forgetting to cancel (real card, real auto-charge) wasn't
  worth it for a candidate with no confirmed coverage advantage over Travelpayouts yet.
- **Take the Growth plan's in-app flight search as a substitute** — not viable: that feature runs
  inside Moblix's own booking UI, not exposed as an API a third-party backend (FlySpot's) can call.

## References

- `_local-bdr-plan-004` (product) — the Travelpayouts spike this follows the same protocol from
- `_local-adr-policy-004` (application) — the `estimated: boolean` pattern any future real source
  (Moblix or otherwise) would need to slot into, same as Travelpayouts
