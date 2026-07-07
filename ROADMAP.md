# Roadmap — Monitor de Passagens Aéreas (v2 — revisado)

> **v2 (07/2026):** revisão técnica completa. Correções: fila de jobs incompatível com Firestore substituída por scheduler de polling; caveats de custo do Duffel/Amadeus; cache de buscas para controle de custo; segurança movida para padrão transversal desde a Fase 1; deploy Vercel movido para a Fase 2 (junto com Next.js).

## Stack definitiva (padrão dos projetos)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + React + Tailwind CSS |
| Backend | Fastify (Node.js/TypeScript) — 3 serviços independentes |
| Banco | Firestore (Firebase) via `firebase-admin` |
| IA | Google Gemini API (modelo via env `GEMINI_MODEL`) |
| Pagamentos | Stripe |
| E-mail | Resend + React Email |
| Deploy backend | Railway (3 serviços separados) |
| Deploy frontend | Vercel |

## Estrutura de monorepo alvo

```
Monitor-de-Passagens-Aereas/
├── apps/
│   └── web/                  # Next.js 14 (App Router)
├── services/
│   ├── api/                  # Fastify — gateway, auth, CRUD, Stripe
│   ├── generator/            # Fastify — busca de preços + scheduler + Gemini
│   └── publisher/            # Fastify — e-mail (Resend), futuramente Telegram
├── packages/
│   └── types/                # Tipos TypeScript compartilhados (fonte da verdade)
├── CLAUDE.md
└── ROADMAP.md
```

Gerenciador: **npm workspaces** (sem ferramenta extra de monorepo por enquanto).

## Padrões transversais (valem desde a Fase 1 — não deixar para o final)

Estes itens são **baratos de fazer desde o início e caros de adicionar depois**:

- **Validação de inputs com Zod** em toda rota Fastify que recebe dados do usuário
- **Rate limiting** (`@fastify/rate-limit`) em todas as rotas públicas
- **Headers de segurança** (`@fastify/helmet`) em todos os serviços
- **Variáveis de ambiente** validadas no boot (Zod schema do `process.env` — serviço não sobe com config faltando)
- **Idempotência**: todo processamento de evento (scan, e-mail, webhook Stripe) deve poder rodar duas vezes sem duplicar efeito
- **Logs estruturados** (Pino, já embutido no Fastify) com `monitorId`/`userId` no contexto
- **CI mínimo desde a Fase 1**: GitHub Actions rodando `lint` + `build` a cada push (testes entram na Fase 8, o pipeline existe desde o dia 1)

---

## Fase 1 — Fundação: Monorepo + Firestore + Deploy do backend

**O que será construído:** Estrutura definitiva de pastas, banco real (Firestore) e o serviço `api` no ar via Railway. O frontend atual (Vite SPA) continua funcionando apontando para a nova API — a migração dele para Next.js fica na Fase 2.

**Tarefas (ordem de execução):**

1. Reestruturar o repositório em monorepo npm workspaces (`apps/`, `services/`, `packages/`)
2. Criar `packages/types` movendo `src/types.ts` para lá; adicionar campo `userId` (nullable por enquanto) e `nextScanAt` ao `FlightMonitor`
3. Criar `services/api` (Fastify + TypeScript): portar todas as rotas REST do `server.ts` atual (`/api/monitors`, `/api/sites`, `/api/notifications`, scan manual)
4. Criar projeto Firebase + Firestore; coleções: `monitors`, `notifications`, `sites`, `users`
5. Camada de repositório (`services/api/src/repositories/`) usando `firebase-admin` — nenhuma rota fala com o Firestore diretamente
6. Seed script para popular a coleção `sites` (LATAM, GOL, Azul, Decolar, Skyscanner) — **não migrar** os monitores fictícios do JSON
7. Aplicar os padrões transversais (Zod, rate limit, helmet, env validado, Pino)
8. Mover a lógica de scan simulado (Gemini) do `server.ts` para o `api` temporariamente (vira serviço `generator` na Fase 3); modelo Gemini via env `GEMINI_MODEL`
9. Deploy do `api` no Railway; frontend Vite atual servido pelo próprio `api` (como hoje) até a Fase 2
10. GitHub Actions: `lint` + `build` a cada push

**Critérios de aceite (QA):**
- Criar, editar, pausar, deletar monitor funciona contra o Firestore em produção (Railway)
- Servidor não sobe com env inválida; rotas rejeitam payload malformado com erro 400 claro
- Reiniciar o serviço não perde nenhum dado (era o problema do JSON)

**Ações fora do código:**
- [ ] Criar projeto no Firebase Console (plano Blaze — necessário para uso via firebase-admin em produção)
- [ ] Criar projeto no Railway

---

## Fase 2 — Next.js 14 + Firebase Auth

**O que será construído:** Frontend definitivo em Next.js 14 com login/cadastro. Cada usuário vê só os próprios monitores.

**Tarefas:**

1. Criar `apps/web` (Next.js 14 App Router + Tailwind); portar os componentes existentes (`MonitorCard`, `MonitorForm`, `NotificationFeed`, `SitesList`, `Header`, `EmailModal`)
2. Habilitar Firebase Authentication: e-mail/senha + Google (SDK client no Next.js)
3. Middleware Fastify no `api`: valida o Firebase ID Token (`Authorization: Bearer`) em toda rota protegida; injeta `userId` no request
4. Todas as queries de `monitors`/`notifications` filtram por `userId`; remover `CURRENT_USER_EMAIL` hardcoded
5. Documento `users/{uid}` criado no primeiro login (e-mail, nome, `plan: 'free'`, `createdAt`)
6. Tela de perfil com "Deletar minha conta" (apaga user + monitores + notificações — obrigatório LGPD)
7. Deploy do `apps/web` na Vercel; `api` no Railway passa a ser API pura (remove o serving de estáticos)

**Gate de UX (desenhar e aprovar antes de implementar):** login/cadastro, recuperação de senha, perfil.

**Critérios de aceite (QA):**
- Dois usuários diferentes não veem os monitores um do outro (testar explicitamente)
- Rota sem token ou com token expirado retorna 401
- Deletar conta remove todos os dados do usuário no Firestore

**Decisões do produto:** login Google (recomendado: sim) · exigir confirmação de e-mail (recomendado: sim)

---

## Fase 3 — Busca Real de Passagens (serviço `generator`)

**O que será construído:** Preços reais no lugar da simulação. Nasce o serviço `generator`.

**Realidade de custo das APIs (corrigido na revisão):**

| API | Dados | Custo real | Papel |
|-----|-------|-----------|-------|
| **Duffel** | Direto das companhias (NDC/GDS) | Busca sem cobrança direta, mas exige conta aprovada, tem rate limits, e o modelo de negócio deles é comissão sobre reserva. Cobertura de GOL/Azul **precisa ser validada no sandbox antes de assumir** | Candidata a principal |
| **Amadeus Self-Service** | GDS global | Sandbox grátis; produção tem cota gratuita mensal pequena e depois **paga por chamada** (~fração de centavo de EUR por busca) | Secundária / fallback |
| Skyscanner Partners | Agregado | Acesso restrito, aprovação lenta | ❌ Descartada |
| Scraping direto | Real | Proibido nos ToS das companhias | ❌ Descartada |

> ⚠️ **Tarefa 0 desta fase é um spike de validação:** com contas sandbox, testar cobertura real de rotas domésticas BR (GRU-GIG, GRU-REC, voos Azul regionais) nas duas APIs **antes** de escrever o adaptador definitivo. O resultado decide qual é a principal.

**Tarefas:**

1. **Spike de cobertura** Duffel × Amadeus em rotas BR (1-2 dias, relatório curto para decisão)
2. Criar `services/generator` (Fastify)
3. Interface comum em `packages/types`: `searchFlights(params: SearchParams): Promise<FlightResult[]>`
4. Adaptadores: `duffel.ts`, `amadeus.ts` — com timeout, retry com backoff e circuit breaker simples por fonte
5. **Cache de buscas no Firestore** (`searchCache`, chave = rota+datas+pax, TTL 30-60 min): dois usuários monitorando a mesma rota geram **uma** chamada de API — controle de custo essencial
6. Gemini muda de papel: recebe os preços reais e gera o texto de análise de tendência (mantém a UX atual do scan)
7. `api` chama `generator` via HTTP interno (service-to-service com token compartilhado via env)
8. Fallback: se todas as fontes falharem, o scan retorna erro claro — **não volta para preço simulado** (preço inventado em produto real é pior que erro)

**Critérios de aceite (QA):**
- Scan de GRU→LIS e GRU→GIG retorna preços reais coerentes com busca manual nos sites
- Duas buscas idênticas em < 30 min geram só 1 chamada de API (verificar no log)
- Fonte fora do ar não derruba o scan (usa a outra fonte)

**Decisões do produto:** orçamento mensal de API · rotas domésticas ou internacionais no lançamento

**Ações fora do código:**
- [ ] Conta Duffel (aprovação pode levar dias — **iniciar já**)
- [ ] Conta Amadeus for Developers (automática)

---

## Fase 4 — Varreduras Automáticas (scheduler)

**O que será construído:** O sistema varre preços sozinho, respeitando a frequência do plano de cada usuário.

> 🔧 **Correção da revisão:** a versão anterior citava **pg-boss**, que roda sobre PostgreSQL — **incompatível com Firestore**. Solução revisada abaixo, sem infra extra.

**Arquitetura escolhida — polling scheduler no `generator`:**

- Loop no serviço `generator` (Railway roda processos persistentes, então isso funciona sem Cloud Functions):
  1. A cada 60s, query no Firestore: `monitors` onde `status == 'active'` e `nextScanAt <= now` (exige índice composto)
  2. Para cada monitor vencido: executa o scan (com o cache da Fase 3), grava resultado, calcula `nextScanAt = now + intervalo do plano`
  3. Concorrência limitada (ex.: 5 scans em paralelo, `p-limit`)
- **Lease/lock por documento** (`scanningLockedUntil`) para o dia em que houver mais de uma instância do generator — evita scan duplicado
- "Escanear agora" na UI: seta `nextScanAt = now` (o loop pega em até 60s) e mostra feedback imediato

**Por que não fila externa:** BullMQ+Redis (Upstash) é a evolução natural **se** o volume crescer (milhares de monitores); começar com polling elimina uma dependência de infra e o padrão de upgrade é bem conhecido. Cloud Tasks amarraria o worker ao GCP sendo que o deploy é Railway.

**Tarefas:**

1. Índice composto Firestore (`status` + `nextScanAt`)
2. Loop de scheduling com lease, concorrência limitada e shutdown gracioso (termina scans em andamento no deploy)
3. Intervalo por plano lido de `users/{uid}.plan` (free: 6h, pro: 1h — configurável por env)
4. Ao criar monitor: `nextScanAt = now` (primeira varredura imediata)
5. Telemetria mínima: doc `system/schedulerHealth` com último tick e contagem de scans/erros (vira health check)

**Critérios de aceite (QA):**
- Monitor criado é varrido em ≤ 2 min sem clique
- Frequência respeitada por plano; deploy no meio de um scan não corrompe dados nem duplica notificação
- 2 instâncias do generator rodando ao mesmo tempo não geram scan duplicado (testar o lease)

---

## Fase 5 — Notificações por E-mail (serviço `publisher`)

**O que será construído:** E-mail real quando o preço bater a meta ou variar.

**Arquitetura — padrão outbox no Firestore:**

- Quem detecta o evento (`generator`) grava um doc em `outbox` (`type`, `payload`, `status: 'pending'`)
- `publisher` (Fastify no Railway) consome a `outbox` via listener `onSnapshot` do firebase-admin + polling de segurança a cada 60s (listener pode perder eventos em reconexão)
- Após envio: `status: 'sent'` + `sentAt` + id da mensagem no Resend. Falha: retry com backoff, máximo 5 tentativas, depois `status: 'failed'`
- **Idempotência**: chave de deduplicação por evento (`monitorId + tipo + janela de tempo`) — nunca dois e-mails iguais para o mesmo evento

**Tarefas:**

1. Criar `services/publisher` + coleção `outbox`
2. Integrar Resend; domínio verificado (SPF/DKIM) — **sem domínio próprio o e-mail cai em spam, bloqueador real**
3. Templates React Email: "Meta atingida" e "Preço variou" — trecho, preço vs. meta, datas, botão "Comprar agora" (deep-link já existe em `generatePurchaseLink`), link de pausar monitor (obrigatório: LGPD/opt-out)
4. Throttle por usuário (máx. 1 e-mail por monitor por hora, exceto meta atingida)
5. Registrar cada envio na coleção `notifications` (o feed da UI continua funcionando)

**Fase 5b (não urgente):** Telegram via bot — o padrão outbox já deixa pronto (só um novo consumer).

**Critérios de aceite (QA):**
- Preço abaixo da meta ⇒ e-mail chega na caixa de entrada (não spam) em < 2 min
- Evento processado 2x não gera 2 e-mails
- Link "pausar monitor" funciona sem login (token assinado na URL)

**Ações fora do código:**
- [ ] Conta Resend
- [ ] **Domínio do produto + DNS (SPF/DKIM)** — bloqueador desta fase, resolver antes

**Decisões do produto:** domínio e nome do remetente

---

## Fase 6 — Monetização com Stripe

**O que será construído:** Assinatura Pro com limites por plano aplicados no backend.

**Planos (proposta a confirmar):**

| Recurso | Gratuito | Pro (sugestão: R$29/mês) |
|---------|---------|--------------------------|
| Monitores ativos | 2 | 10 |
| Frequência de varredura | 6h | 1h |
| Histórico de preços | 7 dias | 90 dias |
| E-mail | ✅ | ✅ |
| Telegram | ❌ | ✅ |

**Tarefas:**

1. Produtos/preços no Stripe Dashboard (modo test primeiro)
2. `api`: rota `POST /billing/checkout` (cria sessão Stripe Checkout) e `POST /billing/portal` (Customer Portal)
3. Webhook `POST /webhooks/stripe`: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` → atualiza `users/{uid}.plan` e `stripeCustomerId`. **Verificar assinatura do webhook e processar de forma idempotente** (Stripe reenvia eventos)
4. Enforcement no backend (não só na UI): criar monitor além do limite → 403 com mensagem de upgrade; downgrade → monitores excedentes pausados automaticamente (não deletados)
5. Job de expurgo de histórico conforme o plano (7/90 dias) — roda 1x/dia no `generator`
6. UI: página de planos, badge do plano atual, CTA de upgrade nos limites

**Critérios de aceite (QA):**
- Fluxo completo em modo test: assinar → virar Pro → limites novos valem → cancelar → voltar a free com monitores excedentes pausados
- Webhook reenviado pelo Stripe não duplica efeito
- Usuário free não consegue criar 3º monitor nem via chamada direta à API

**Decisões do produto:** preço · trial · confirmação da tabela de limites

**Ações fora do código:**
- [ ] Conta Stripe — ⚠️ **verificar exigência de CNPJ para receber no Brasil antes de qualquer código desta fase**

---

## Fase 7 — UX/UI para Produto Real

Fluxo por item: **UX desenha → produto aprova → implementa → QA valida → ar.**

1. **Onboarding** — guiar o primeiro monitor (o momento "aha" é receber o primeiro alerta)
2. **Mobile-first** — auditar todas as telas em 375px; maioria dos usuários BR é mobile
3. **Estado vazio** — dashboards sem monitor apontam para a criação
4. **Erros amigáveis** — mapa de erros da API → mensagens em português com ação sugerida
5. **Painel de histórico** — mínima histórica, média, tendência (dados já existem em `history[]`)
6. **Acessibilidade** — contraste AA, navegação por teclado, labels/aria em formulários

---

## Fase 8 — Qualidade, Testes e LGPD

> Segurança básica (Zod, rate limit, helmet, idempotência) **já entrou nas fases 1-6** como padrão transversal. Esta fase cobre o que exige o produto estável.

### Testes e CI/CD
- Vitest: testes de integração por serviço (prioridade: regras de plano, scheduler, outbox, webhook Stripe)
- Playwright E2E: cadastro → criar monitor → scan → notificação
- GitHub Actions completo: lint + testes bloqueando merge; deploy automático Railway/Vercel só com pipeline verde

### Segurança (hardening final)
- Auditoria de regras do Firestore (acesso só via backend — regras negam client direto, exceto o que o Auth exigir)
- Revisão de rate limits com números reais de uso
- Verificação de segredos no CI (`gitleaks`)

### LGPD
- Política de Privacidade + Termos de Uso acessíveis antes do cadastro
- Checkbox de consentimento (não pré-marcado)
- "Deletar minha conta" já existe desde a Fase 2 — auditar que apaga **tudo** (incluindo `outbox` e logs de e-mail)
- Definir retenção: histórico de preço, logs de envio, contas inativas
- E-mail público `privacidade@…`
- ⚠️ Consulta com advogado LGPD antes do lançamento público

---

## Sequência e dependências

```
Fase 1: Monorepo + Firestore + api no Railway      ← fundação
Fase 2: Next.js 14 + Firebase Auth (Vercel)        ← precisa da 1
Fase 3: Busca real + generator                     ← precisa da 1; spike de APIs pode rodar em paralelo às fases 1-2
Fase 4: Scheduler de varreduras                    ← precisa da 3
Fase 5: E-mail (publisher + outbox)                ← precisa da 4; domínio/DNS pode andar em paralelo desde já
Fase 6: Stripe                                     ← precisa da 2 (users) e da 4 (frequência por plano)
Fase 7: UX/UI                                      ← contínua; itens podem intercalar com fases 4-6
Fase 8: Testes completos + LGPD                    ← antes do lançamento público
```

**Paralelizável desde hoje (sem código):** contas Duffel/Amadeus, domínio + DNS, conta Stripe (CNPJ), conta Resend, projeto Firebase, projeto Railway.
