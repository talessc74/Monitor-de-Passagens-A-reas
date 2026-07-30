# Governance System — Engineering Council
# Version: 4.1.0
# Modelo: Deliberação Coletiva sob ARGUS
# Seeds under governance: 17
# Grupos: Galera do Código (4) · Galera de UX (3) · Galera de Segurança (5) · Galera de QA (3) · Galera de Governança (2)

---

## O que é este sistema

Este projeto opera sob governança distribuída de 17 seeds organizadas em
cinco equipes. As seeds não executam em fila — elas deliberam em mesa.

ARGUS é o orquestrador permanente. Ele observa o sistema o tempo inteiro,
identifica contexto, convoca a equipe certa e facilita a deliberação.
O output de qualquer tarefa é uma criação coletiva das seeds ativas,
não o resultado de um pipeline sequencial.

---

## Instrução obrigatória

Antes de iniciar qualquer tarefa, leia integralmente:
  `.seeds/ARGUS.md`

ARGUS define como o sistema opera: vigilância permanente, convocação por
contexto, deliberação coletiva, convergência orgânica e arbitragem apenas
em impasse genuíno.

---

## Regra absoluta

Nenhum output é válido sem assinatura coletiva das seeds ativas para aquela tarefa.

Uma seed que não consegue assinar sem violar seu `kernel_logic` deve
sinalizar antes da convergência. Output sem assinatura completa é inválido.

---

## Como acionar ARGUS

| Comando | O que acontece |
|---|---|
| `"Argus, revisa este código"` | ARGUS lê o contexto e convoca a equipe certa |
| `"Argus, chama a galera do código"` | Scout · Flux · Literate · RiverRaid |
| `"Argus, chama a galera de UX"` | Compass · Empiricus · PolarBear |
| `"Argus, chama a galera de segurança"` | Blast · BAU · Sentinel · Sovereign · Ghost |
| `"Argus, chama a galera de QA"` | Pareto · Probe · Scaffold |
| `"Argus, chama a galera de governança"` | Scribe · Herald |
| `"Argus, chama todo mundo"` | todas as 17 seeds |
| `"Argus, quem é o [nome]?"` | ARGUS apresenta a seed e sua jurisdição |
| `"Argus, apresenta a equipe"` | ARGUS lista todos os membros e papéis |
| `"Argus, apresenta a [galera]"` | ARGUS lista os membros do grupo solicitado |

---

## Como a deliberação funciona

ARGUS abre a mesa. As seeds convocadas falam a partir dos seus domínios.
Elas podem concordar, complementar, tensionar, ceder, escalar ou se abster.
A convergência é orgânica — acontece quando todas as tensões foram respondidas
e todas as seeds ativas assinaram o output.

ARGUS arbitra apenas quando há impasse que a equipe não resolve sozinha.
A hierarquia de resolução está em `.seeds/ARGUS.md` — Seção V.

---

## Seeds disponíveis

### Galera do Código
- `.seeds/SCOUT.json`      → Clean Code, TDD, responsabilidade profissional
- `.seeds/FLUX.json`       → Evolutionary Design, refatoração contínua
- `.seeds/LITERATE.json`   → Algoritmos, análise assintótica, narrativa antes de execução
- `.seeds/RIVERRAID.json`  → Recursos finitos, geração procedural determinística, bitmask boundary

### Galera de UX
- `.seeds/COMPASS.json`    → Human-Centered Design, affordances, feedback cognitivo
- `.seeds/EMPIRICUS.json`  → Usabilidade empírica, redução de carga cognitiva
- `.seeds/POLARBEAR.json`  → Information Architecture, findability, wayfinding

### Galera de Segurança
- `.seeds/BLAST.json`      → Data minimization, transparência radical
- `.seeds/BAU.json`        → Perpetual Integrity Lifecycle, compliance contínuo
- `.seeds/SENTINEL.json`   → Zero Trust, micro-segmentação
- `.seeds/SOVEREIGN.json`  → Identity, consentimento, minimal disclosure
- `.seeds/GHOST.json`      → Attacker mindset, engenharia social, fator humano

### Galera de QA
- `.seeds/PARETO.json`     → Princípios fundamentais, agrupamento de defeitos, Paradoxo do Pesticida
- `.seeds/PROBE.json`      → Teste exploratório, heurísticas, sessões por missão
- `.seeds/SCAFFOLD.json`   → Automação, arquitetura de QA, Page Objects, anti-flakiness

### Galera de Governança
- `.seeds/SCRIBE.json`     → Integridade do artefato XDRS, arquivamento, índice canônico, lint
- `.seeds/HERALD.json`     → Ciclo de vida de policies, valid-from, rollout, obsolescência, remoção

---

## Estrutura de arquivos

```
/
  CLAUDE.md              ← este arquivo — lido primeiro
  .seeds/
    ARGUS.md             ← orquestrador — lido segundo
    SCOUT.json
    FLUX.json
    LITERATE.json
    RIVERRAID.json
    COMPASS.json
    EMPIRICUS.json
    POLARBEAR.json
    BLAST.json
    BAU.json
    SENTINEL.json
    SOVEREIGN.json
    GHOST.json
    PARETO.json
    PROBE.json
    SCAFFOLD.json
    SCRIBE.json
    HERALD.json
```

---
---

# Documentação do produto — FlySpot

A governança ARGUS acima rege como as seeds deliberam neste repositório.
A partir daqui, a documentação abaixo é específica do produto FlySpot e
continua valendo integralmente — inclusive para as seeds, que devem lê-la
como parte do contexto de "o que já existe no sistema" (Protocolo de
Vigilância Permanente, `.seeds/ARGUS.md` §I).

## Nome do produto

**FlySpot** é o nome oficial de marca. O repositório, o projeto Firebase (`lista-ai-f2916`, compartilhado com o produto Lista Aí) e o prefixo de coleções (`mpa_`) permanecem com o nome interno herdado do começo do projeto — decisão deliberada, sem plano de renomear esses identificadores técnicos.

## Stack (padrão dos projetos do owner)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + React + Tailwind CSS — código pronto em `apps/web`, deploy pendente (ver Fase 2, tarefa 7) |
| Backend | Fastify (Node.js/TypeScript) — 3 serviços independentes |
| Banco de dados | Firestore (Firebase) via `firebase-admin` — projeto **`lista-ai-f2916`**, compartilhado com o produto Lista Aí |
| IA | Google Gemini API |
| Pagamentos | Stripe |
| Deploy backend | Cloud Run (contêiner Docker — não Firebase Cloud Functions) |
| Deploy frontend | Cloud Run (mesmo padrão do backend — não Vercel; decisão corrigida, ver `_local-adr-policy-001`) |

## Estrutura do monorepo (Fase 5 — em vigor)

```
├── apps/
│   └── web/                # @mpa/web — Next.js 14 (App Router), frontend definitivo (Fase 2)
│       ├── next.config.mjs # output: 'standalone' (build p/ Cloud Run) + rewrite de /api/* para o api
│       └── Dockerfile       # build multi-stage, mesmo padrão dos services/* — deploy em Cloud Run, não Vercel
├── src/                    # frontend Vite/React antigo (sendo descontinuado; apps/web é o atual)
├── packages/
│   └── types/              # @mpa/types — fonte da verdade dos tipos, compartilhada com todo o backend
└── services/
    ├── api/                # @mpa/api — Fastify: gateway REST, auth, CRUD de monitores, scan (simulado)
    │   ├── src/
    │   │   ├── index.ts          # bootstrap Fastify (helmet, rate-limit, cors, static em produção)
    │   │   ├── env.ts            # validação de ambiente com Zod — não sobe com config faltando
    │   │   ├── firestore.ts      # inicialização do firebase-admin + nomes das coleções (prefixo mpa_)
    │   │   ├── auth.ts           # verifica ID Token Firebase; internalAuth.ts verifica o segredo de serviço-a-serviço
    │   │   ├── executeScan.ts    # lógica de um scan (Gemini + notificação + stats) — reaproveitada por /api e /internal
    │   │   ├── scanSimulator.ts  # simulação de preços via Gemini (temporário — Fase 7 troca por Duffel/Amadeus)
    │   │   ├── routeStats.ts     # estimativa de preço (média/mín/máx) antes de o monitor existir
    │   │   ├── geminiClient.ts   # cliente Gemini único, compartilhado entre scanSimulator e routeStats
    │   │   ├── purchaseLink.ts   # deep-links de compra por companhia
    │   │   ├── repositories/     # única camada que fala com o Firestore
    │   │   ├── routes/           # rotas Fastify com validação Zod (inclui /internal/scan/:id)
    │   │   └── seed.ts           # popula mpa_sites (LATAM, GOL, Azul, Decolar, Skyscanner)
    │   └── Dockerfile            # build multi-stage para Cloud Run
    ├── generator/          # @mpa/generator — Fastify mínimo + loop de polling do scheduler (Fase 4)
    │   ├── src/
    │   │   ├── index.ts          # bootstrap Fastify (só /health) + inicia/encerra o scheduler
    │   │   ├── env.ts            # POLL_INTERVAL_MS, MAX_CONCURRENT_SCANS, intervalo por plano, etc.
    │   │   ├── firestore.ts      # mesmo projeto/coleções do api (leitura de mpa_monitors/mpa_users)
    │   │   └── scheduler.ts      # tick: query de vencidos, lease por transação, chama /internal/scan/:id
    │   └── Dockerfile
    └── publisher/          # @mpa/publisher — Fastify mínimo + consumidor do outbox de e-mail (Fase 5)
        ├── src/
        │   ├── index.ts          # bootstrap Fastify (só /health) + inicia/encerra o consumidor
        │   ├── env.ts            # RESEND_API_KEY, EMAIL_ACTION_SECRET, POLL_INTERVAL_MS, etc.
        │   ├── firestore.ts      # mesmo projeto/coleções do api (leitura de mpa_outbox/mpa_notifications/mpa_monitors)
        │   ├── outboxConsumer.ts # onSnapshot + poll de segurança, lease 'sending', retry com backoff até 'failed'
        │   ├── resendClient.ts   # cliente fino via fetch para a API REST do Resend (no-op sem RESEND_API_KEY)
        │   ├── pauseLink.ts      # mint-only do token HMAC de "pausar monitor" (verificado pelo api)
        │   └── templates.ts      # e-mails HTML: meta atingida / preço variou
        └── Dockerfile
```

Gerenciado via **npm workspaces** (`services/*`, `packages/*`, `apps/*`) — sem ferramenta extra de monorepo.

**Autenticação de serviço-a-serviço:** `generator` não tem usuário Firebase logado para autenticar como (quem dispara o scan é o scheduler, não um clique). Por isso ele chama `POST /internal/scan/:id` no `api`, autenticado por um segredo compartilhado (`INTERNAL_SCAN_TOKEN`, mesmo valor nos dois serviços) em vez de ID Token — ver `_local-adr-policy-002` no XDRS.

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

Em dev, o `src/` antigo (Vite) faz proxy de `/api/*` para `http://localhost:8080` (ver `vite.config.ts`) — descontinuado, `apps/web` é o frontend atual. O `apps/web` (Next.js) faz o mesmo via `rewrites()` em `next.config.mjs`. Em produção, cada um roda como seu próprio serviço Cloud Run (`flyspot-api`, `flyspot-web`) — o `api` não serve mais estático, é API pura desde a Fase 2 (tarefa 7).

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
