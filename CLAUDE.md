# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Nome do produto

**FlySpot** é o nome oficial de marca. O repositório, o projeto Firebase (`lista-ai-f2916`, compartilhado com o produto Lista Aí) e o prefixo de coleções (`mpa_`) permanecem com o nome interno herdado do começo do projeto — decisão deliberada, sem plano de renomear esses identificadores técnicos.

## Stack (padrão dos projetos do owner)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + React + Tailwind CSS — **ainda não migrado**, hoje é Vite SPA (Fase 2) |
| Backend | Fastify (Node.js/TypeScript) — 3 serviços independentes |
| Banco de dados | Firestore (Firebase) via `firebase-admin` — projeto **`lista-ai-f2916`**, compartilhado com o produto Lista Aí |
| IA | Google Gemini API |
| Pagamentos | Stripe |
| Deploy backend | Cloud Run (contêiner Docker — não Firebase Cloud Functions) |
| Deploy frontend | Vercel |

## Estrutura do monorepo (Fase 1 — em vigor)

```
├── src/                    # frontend Vite/React atual (migra pra apps/web na Fase 2)
├── packages/
│   └── types/              # @mpa/types — fonte da verdade dos tipos, compartilhada com o backend
└── services/
    └── api/                # @mpa/api — Fastify: gateway REST, CRUD de monitores, scan (simulado)
        ├── src/
        │   ├── index.ts          # bootstrap Fastify (helmet, rate-limit, cors, static em produção)
        │   ├── env.ts            # validação de ambiente com Zod — não sobe com config faltando
        │   ├── firestore.ts      # inicialização do firebase-admin + nomes das coleções (prefixo mpa_)
        │   ├── scanSimulator.ts  # simulação de preços via Gemini (temporário — Fase 3 troca por Duffel/Amadeus)
        │   ├── purchaseLink.ts   # deep-links de compra por companhia
        │   ├── repositories/     # única camada que fala com o Firestore
        │   ├── routes/           # rotas Fastify com validação Zod
        │   └── seed.ts           # popula mpa_sites (LATAM, GOL, Azul, Decolar, Skyscanner)
        └── Dockerfile            # build multi-stage para Cloud Run
```

Gerenciado via **npm workspaces** (`services/*`, `packages/*`) — sem ferramenta extra de monorepo. `services/generator` e `services/publisher` nascem nas Fases 3 e 5, respectivamente.

Cada serviço é empacotado em contêiner Docker e deployado no **Cloud Run** — mesmo padrão já usado no projeto irmão `multi-agent-system` (repo `lexforum-ai-studio`). Escolha deliberada: **não** usar o produto "Cloud Functions" do Firebase, porque ele exige o projeto estar no plano Blaze; o Cloud Run publicado diretamente via contêiner não exige essa mudança de plano no Firebase e mantém `lista-ai-f2916` no Spark.

## Convenção de nomes no Firestore (projeto compartilhado)

O projeto Firebase (`lista-ai-f2916`) é compartilhado com outro produto (Lista Aí, hoje inativo). **Toda coleção deste produto usa o prefixo `mpa_`** para nunca colidir com dados do outro produto: `mpa_monitors`, `mpa_notifications`, `mpa_sites`, `mpa_users`. Nunca criar ou consultar uma coleção sem esse prefixo neste projeto. Ver `services/api/src/firestore.ts` (`COLLECTIONS`).

## Commands

```bash
npm install                 # instalar dependências (raiz do monorepo)
npm run dev                 # sobe frontend (Vite, :5173 por padrão) + api (Fastify, :8080) juntos
npm run dev:web             # só o frontend
npm run dev:api             # só o serviço api
npm run build                # build de produção do frontend
npm run build --workspace=@mpa/api   # type-check + bundle (esbuild) do serviço api
npm run seed                # popula a coleção mpa_sites no Firestore (idempotente)
npm run lint                 # type-check do frontend + do serviço api
```

Em dev, o Vite faz proxy de `/api/*` para `http://localhost:8080` (ver `vite.config.ts`). Em produção, o próprio `api` serve o build estático do frontend (`web-dist/`, copiado pelo Dockerfile) — mesmo padrão do MVP original, até a migração para Next.js/Vercel na Fase 2.

## Variáveis de ambiente

Ver `.env.example`. Resumo:

| Variável | Obrigatória | Notas |
|----------|-------------|-------|
| `FIREBASE_PROJECT_ID` | Não (default `lista-ai-f2916`) | Projeto Firestore |
| `GOOGLE_APPLICATION_CREDENTIALS` | Só em dev local | Caminho do JSON de service account; em Cloud Run as credenciais são automáticas |
| `GEMINI_API_KEY` | Não | Habilita simulação de preços via IA; sem ela roda fallback offline |
| `GEMINI_MODEL` | Não (default `gemini-3.5-flash`) | Modelo usado na simulação (Fase 1/2 — some na Fase 3) |
| `PORT` | Não (default `8080`) | Porta do serviço api |
| `APP_URL` | Não | URL base para links auto-referenciais |

Validação de env acontece no boot via Zod (`services/api/src/env.ts`) — o serviço recusa subir com configuração inválida.

## Modelo de dados (`packages/types`)

- **`FlightMonitor`** — entidade central: `userId` (nullable até a Fase 2), códigos IATA origem/destino, datas, contagem de passageiros, `targetPrice`, `currentPrice`, `history[]`, `trackedSites`, `nextScanAt` (usado pela Fase 4), `status: 'active' | 'paused'`
- **`NotificationLog`** — gerada quando `currentPrice ≤ targetPrice` ou preço muda; inclui `purchaseUrl` deep-link para o site da companhia
- **`AirlineSite`** — metadata de cada fonte (LATAM, GOL, Azul, Decolar, Skyscanner): `status`, `scrapedCount`, `avgResponseMs`

## Lógica de scan (`POST /api/monitors/:id/scan`)

Implementada em `services/api/src/scanSimulator.ts` + `routes/monitors.ts`. **Temporária** — a Fase 3 substitui por busca real (Duffel/Amadeus) atrás da mesma assinatura, sem tocar no resto do sistema.

1. Chama Gemini (`GEMINI_MODEL`) com schema JSON estruturado para gerar preços realistas em BRL por site
2. Fallback para simulação determinística se `GEMINI_API_KEY` ausente ou chamada falhar
3. Pega o resultado mais barato, atualiza `monitor.currentPrice` e `monitor.history`, incrementa stats do site (via `FieldValue.increment`)
4. Cria `NotificationLog` se preço ≤ meta ou preço mudou desde o último scan

## Processo de desenvolvimento

- Toda feature passa por **UX** antes de implementar
- Toda feature passa por **QA** antes de ir ao ar
- Agente Argus aciona a equipe técnica — o dono do produto não resolve questões técnicas diretamente
