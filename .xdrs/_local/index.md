# _local Scope Overview

## Overview

Project-local decisions for FlySpot (monitor de passagens aéreas — o repositório, o
projeto Firebase `lista-ai-f2916` e o prefixo de coleções `mpa_` mantêm o nome interno
herdado do começo do projeto; ver `CLAUDE.md`, seção "Nome do produto").

All policies in this scope were produced by ARGUS deliberation, structured by SCRIBE,
timestamped by HERALD, and validated by the project owner before archiving.

This scope stays in this workspace only and is never distributed to other contexts.
Decisions here override all other scopes.

## Project Context

FlySpot é um SaaS de monitoramento de preços de passagens aéreas, operando sob:
- Stack: Fastify (Node.js/TypeScript) + Next.js 14 (App Router) + Firestore (`firebase-admin`) + Google Gemini + Stripe
- Projeto Firebase: `lista-ai-f2916` (compartilhado com o produto Lista Aí, hoje inativo), coleções com prefixo `mpa_`
- Deploy backend: Cloud Run (`southamerica-east1`), via GitHub Actions (`workflow_dispatch`)
- Deploy frontend: Cloud Run, mesmo padrão do backend (pendente — ver `_local-adr-policy-001` amendment)
- Ver `CLAUDE.md` e `ROADMAP.md` na raiz do repositório para o contexto completo do produto e do roadmap de fases

## How to add a policy

1. Trigger an ARGUS deliberation on the topic ("Argus, chama a galera de governança" para arquivar uma convergência já fechada)
2. Reach convergence with seed signatures
3. SCRIBE structures the document — HERALD defines valid-from
4. Human validates the draft
5. Policy is saved under the appropriate type and subject below

## Type Indexes

- [ADRs Index](adrs/index.md) — Architectural and technical decisions
- [BDRs Index](bdrs/index.md) — Business process and strategy decisions
- [EDRs Index](edrs/index.md) — Engineering workflow and tooling decisions
