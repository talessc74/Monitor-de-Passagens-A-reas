# Roadmap — FlySpot (v8 — revisado)

> **v8 (07/2026):** Fase 1 validada ponta a ponta contra o Firestore real do `lista-ai-f2916`. No processo, dois bloqueios de infraestrutura foram encontrados e resolvidos: API do Firestore precisou ser habilitada manualmente no projeto GCP, e o banco Firestore em si precisou ser criado (projeto nunca tinha um banco Firestore, só possivelmente Realtime Database do Lista Aí). CRUD de monitor, scan e persistência após reinício do processo testados com sucesso. Falta só o deploy real no Cloud Run para fechar a fase.
>
> **v7 (07/2026):** domínio registrado: **`flyspot.com.br`**. Destrava a configuração de DNS (SPF/DKIM) necessária na Fase 5 para o e-mail transacional não cair em spam.
>
> **v6 (07/2026):** nome oficial do produto definido: **FlySpot**. O código, o projeto Firebase (`lista-ai-f2916`) e o prefixo de coleções (`mpa_`) continuam como estão — trocar esses identificadores internos agora não traz benefício e só gera trabalho de migração; o nome do produto vale para marca, domínio, UI e comunicação daqui em diante. Ver nota em `CLAUDE.md`.

> **v5 (07/2026):** deploy do backend trocado de **Firebase Cloud Functions** para **Cloud Run direto (contêiner Docker)** — mesmo padrão já usado no projeto irmão `multi-agent-system`. Motivo: Cloud Functions exige o projeto Firebase no plano **Blaze**; o projeto `lista-ai-f2916` está no **Spark** (gratuito) e serve a outro produto (Lista Aí, hoje inativo) — não há motivo para forçar upgrade de plano só por causa deste produto. Cloud Run publicado diretamente não exige esse upgrade. Isso muda o mecanismo interno das Fases 4 e 5 (que dependiam de dois outros produtos "Cloud Functions" do Firebase — `onSchedule` e Firestore Trigger): ambos voltam a ser loops de polling dentro dos próprios serviços Cloud Run, que já são processos persistentes.
>
> **v4 (07/2026):** reordenação estratégica de **construção** para evitar custo de API real antes da hora. As 8 fases abaixo continuam sendo a referência de arquitetura e critérios de aceite — o que muda é **a ordem em que a equipe as executa**. Ver seção "Ordem real de construção" logo abaixo.
>
> **v3 (07/2026):** deploy do backend migrado de Railway para **Firebase (Cloud Functions/Cloud Run)** — ecossistema único (banco + backend no Firebase), sem provedor de deploy extra. Isso também simplifica a Fase 4 (scheduler nativo via Cloud Scheduler, no lugar de loop manual) e a Fase 5 (Firestore Triggers no lugar de listener manual).
>
> **v2 (07/2026):** revisão técnica completa. Correções: fila de jobs incompatível com Firestore substituída por scheduler; caveats de custo do Duffel/Amadeus; cache de buscas para controle de custo; segurança movida para padrão transversal desde a Fase 1.

## Ordem real de construção (v4)

**Motivo:** o dono do produto não quer assumir custo de API real (Duffel/Amadeus em produção, Stripe fora do modo teste) enquanto o site ainda está em construção. A maior parte dos serviços listados no roadmap é **gratuita em modo desenvolvimento/sandbox/teste** (Amadeus sandbox, Stripe test mode, cota grátis do Firebase e do Resend) — o único ponto que gera custo real é formalizar contrato de produção com Duffel/Amadeus antes da hora. Solução: construir o produto inteiro primeiro com a fonte de preços simulada (o Gemini já faz isso hoje), e só trocar essa peça pela conexão real por último.

Isso é possível **sem redesenhar nada**, porque a Fase 3 já isola a busca de preço atrás de uma interface única (`searchFlights`) — hoje implementada pelo simulador do Gemini, depois substituída pelos adaptadores Duffel/Amadeus, sem tocar no resto do sistema.

**Sequência de execução recomendada** (os números entre parênteses referem-se às fases de arquitetura abaixo, que não mudam de conteúdo — só de ordem):

1. Fase 1 — Firestore + deploy no Firebase *(sem custo)*
2. Fase 2 — Login e cadastro *(sem custo)*
3. Fase 7 adiantada — site completo (onboarding, mobile, dashboard, histórico), rodando 100% sobre o simulador Gemini existente *(sem custo, zero conexão paga)*
4. Fase 4 — Varreduras automáticas, testadas contra o simulador *(sem custo)*
5. Fase 5 — E-mail real via Resend *(cota gratuita cobre o volume de testes)*
6. Fase 6 — Assinatura Stripe **em modo teste** (cartão de teste, zero cobrança real)
7. Fase 3 por último — troca o simulador pelos adaptadores reais Duffel/Amadeus; **é só neste momento que se formaliza conta de produção e começa o custo real de API**
8. Fase 8 — testes finais e LGPD, antes do lançamento público

O conteúdo técnico de cada fase (tarefas, critérios de aceite, arquitetura) permanece exatamente como descrito nas seções abaixo — a numeração "Fase N" identifica o **escopo**, não a ordem cronológica de execução.

## Stack definitiva (padrão dos projetos)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + React + Tailwind CSS |
| Backend | Fastify (Node.js/TypeScript) — 3 serviços independentes |
| Banco | Firestore (Firebase) via `firebase-admin` |
| IA | Google Gemini API (modelo via env `GEMINI_MODEL`) |
| Pagamentos | Stripe |
| E-mail | Resend + React Email |
| Deploy backend | Cloud Run (contêiner Docker — não Firebase Cloud Functions) |
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

**Status: 🟢 Firestore real validado ponta a ponta. Falta só o deploy no Cloud Run.**

**O que será construído:** Estrutura definitiva de pastas, banco real (Firestore) e o serviço `api` no ar via Cloud Run. O frontend atual (Vite SPA) continua funcionando apontando para a nova API — a migração dele para Next.js fica na Fase 2.

**Tarefas (ordem de execução):**

1. [x] Reestruturar o repositório em monorepo npm workspaces (`services/`, `packages/`; `apps/` nasce na Fase 2 com o Next.js)
2. [x] Criar `packages/types` movendo `src/types.ts` para lá; adicionado `userId` (nullable) e `nextScanAt` ao `FlightMonitor` — `src/types.ts` na raiz virou um re-export, sem quebrar os componentes existentes
3. [x] Criar `services/api` (Fastify + TypeScript, `Dockerfile` para Cloud Run — mesmo padrão do `multi-agent-system`): rotas REST portadas do `server.ts` (`/api/monitors`, `/api/sites`, `/api/notifications`, `/api/test-email`, scan manual)
4. [x] Firestore no projeto Firebase **`lista-ai-f2916`**, coleções com prefixo `mpa_`: `mpa_monitors`, `mpa_notifications`, `mpa_sites`, `mpa_users` (`services/api/src/firestore.ts`)
5. [x] Camada de repositório (`services/api/src/repositories/`) usando `firebase-admin` — nenhuma rota fala com o Firestore diretamente
6. [x] Seed script (`npm run seed`) para popular `mpa_sites` (LATAM, GOL, Azul, Decolar, Skyscanner), idempotente
7. [x] Padrões transversais aplicados: Zod (env + payloads das rotas), `@fastify/rate-limit`, `@fastify/helmet`, logger Pino (nativo do Fastify)
8. [x] Lógica de scan simulado (Gemini) movida para `services/api/src/scanSimulator.ts`; modelo via env `GEMINI_MODEL`; `server.ts` antigo removido
9. [ ] **Deploy real do `api` no Cloud Run** (mesmo projeto GCP do Firestore, `lista-ai-f2916`) — pendente, depende da confirmação da conta de faturamento abaixo
10. [x] GitHub Actions (`lint` + `build` a cada push) criado; `gcloud run deploy` automático fica para quando o primeiro deploy manual for validado

**Validado com credenciais reais do `lista-ai-f2916` nesta sessão:**
- `npm install`, type-check e build de produção (frontend + `api`) — OK
- Descobertos e resolvidos dois bloqueios de infraestrutura na hora do teste: (1) API do Firestore não estava habilitada no projeto GCP — ativada; (2) nenhum banco Firestore existia ainda no projeto — criado em modo Nativo
- `npm run seed` populou `mpa_sites` (LATAM, GOL, Azul, Decolar, Skyscanner) de verdade no Firestore
- Fluxo completo testado contra o banco real: criar monitor → rodar scan (preço simulado + histórico gravado) → **reiniciar o processo do servidor por completo** → monitor e histórico continuam intactos → deletar monitor de teste (limpeza)
- Credencial de teste usada apenas localmente nesta sessão e descartada ao final (nunca commitada; recomendado revogar essa chave específica no Firebase Console e gerar uma nova só se for reusar em dev)

**Não validado ainda:** build real da imagem Docker (daemon Docker bloqueado neste ambiente sandbox) e deploy efetivo no Cloud Run.

**Critérios de aceite (QA):**
- [x] Criar, editar, pausar, deletar monitor funciona contra o Firestore real
- [x] Reiniciar o serviço não perde nenhum dado (era o problema do JSON) — confirmado
- [x] Servidor não sobe com env inválida; rotas rejeitam payload malformado com erro 400 claro
- [ ] Mesmos critérios, agora rodando de fato no Cloud Run (não só localmente com credencial de dev)

**Ações fora do código:**
- [x] Projeto Firebase definido: **`lista-ai-f2916`** (compartilhado com o produto Lista Aí, hoje inativo — permanece no plano **Spark**, sem upgrade necessário, já que o deploy usa Cloud Run direto e não Cloud Functions)
- [x] API do Firestore habilitada no projeto GCP
- [x] Banco Firestore criado (modo Nativo)
- [x] Credenciais de service account geradas e validadas (uso local/dev)
- [ ] Confirmar que a conta de faturamento GCP usada pelo `multi-agent-system` no Cloud Run está disponível para publicar também os serviços deste produto no mesmo projeto

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
7. Deploy do `apps/web` na Vercel; `api` no Firebase passa a ser API pura (remove o serving de estáticos)

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

> 🔧 **v5 — ajustado para evitar Blaze:** `onSchedule` é um produto Cloud **Functions** do Firebase e exigiria o mesmo upgrade de plano que estamos evitando (ver decisão em §Fase 1). Solução: como `generator` já é um serviço Cloud Run de processo persistente (não uma Function), ele mesmo roda um loop de polling interno — mesmo padrão do `multi-agent-system` (Cloud Run direto, sem depender de produtos Firebase que exigem Blaze). Cloud Scheduler (produto GCP separado do Firebase, tem cota gratuita própria) pode opcionalmente bater num endpoint HTTP do `generator` a cada minuto como redundância/keep-alive, mas o loop interno já é suficiente sozinho.

**Arquitetura escolhida — loop de polling dentro do `generator` (Cloud Run):**

- A cada 60s, dentro do próprio processo do `generator`:
  1. Query no Firestore: `mpa_monitors` onde `status == 'active'` e `nextScanAt <= now` (exige índice composto)
  2. Para cada monitor vencido: executa o scan (com o cache da Fase 3), grava resultado, calcula `nextScanAt = now + intervalo do plano`
  3. Concorrência limitada (ex.: 5 scans em paralelo, `p-limit`)
- **Lease/lock por documento** (`scanningLockedUntil`) para o caso de mais de uma instância do Cloud Run rodando ao mesmo tempo (autoscaling) — evita scan duplicado
- "Escanear agora" na UI: seta `nextScanAt = now` (o loop pega em até 60s) e mostra feedback imediato na tela enquanto isso
- Cloud Run precisa estar configurado com **mínimo 1 instância sempre ativa** (não escalar a zero), senão o loop para quando não há requisição HTTP chegando

**Por que não fila externa:** BullMQ+Redis (Upstash) é a evolução natural **se** o volume crescer muito; começar com polling elimina qualquer infraestrutura extra e não depende de nenhum produto Firebase gated pelo Blaze.

**Tarefas:**

1. Índice composto Firestore (`status` + `nextScanAt`)
2. Loop de polling com lease, concorrência limitada e shutdown gracioso
3. Configurar Cloud Run do `generator` com min-instances = 1
4. Intervalo por plano lido de `mpa_users/{uid}.plan` (free: 6h, pro: 1h — configurável via env)
5. Ao criar monitor: `nextScanAt = now` (primeira varredura no próximo ciclo do loop)
6. Telemetria mínima: doc `system/schedulerHealth` com último tick e contagem de scans/erros (vira health check)

**Critérios de aceite (QA):**
- Monitor criado é varrido em ≤ 2 min sem clique
- Frequência respeitada por plano; execução que estoura o timeout não corrompe dados nem duplica notificação
- Duas execuções sobrepostas não geram scan duplicado (testar o lease)

---

## Fase 5 — Notificações por E-mail (serviço `publisher`)

**O que será construído:** E-mail real quando o preço bater a meta ou variar.

**Arquitetura — padrão outbox no Firestore, consumido por polling (v5: sem Firestore Trigger, que é Cloud Function e exigiria Blaze):**

- Quem detecta o evento (`generator`) grava um doc em `mpa_outbox` (`type`, `payload`, `status: 'pending'`)
- `publisher` (Cloud Run, processo persistente, min-instances = 1) consome a `mpa_outbox` via listener `onSnapshot` do firebase-admin (funciona normalmente fora de Cloud Functions, dentro de qualquer processo Node com firebase-admin) + polling de segurança a cada 60s (cobre reconexões)
- Após envio: `status: 'sent'` + `sentAt` + id da mensagem no Resend. Falha: retry com backoff interno, máximo 5 tentativas, depois `status: 'failed'`
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
- [x] Domínio registrado: **`flyspot.com.br`** — falta configurar DNS (SPF/DKIM) para o Resend quando chegar a hora desta fase

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
- GitHub Actions completo: lint + testes bloqueando merge; deploy automático Firebase/Vercel só com pipeline verde

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

## Sequência e dependências (arquitetura — independe da ordem de execução)

```
Fase 1: Monorepo + Firestore + api no Firebase      ← fundação
Fase 2: Next.js 14 + Firebase Auth (Vercel)        ← precisa da 1
Fase 3: Busca real + generator                     ← precisa da 1; adaptador plugável no lugar do simulador Gemini
Fase 4: Scheduler de varreduras (Cloud Scheduler)   ← precisa de uma fonte de preço (simulada ou real)
Fase 5: E-mail (publisher + outbox/Firestore Trigger) ← precisa da 4; domínio/DNS pode andar em paralelo desde já
Fase 6: Stripe                                     ← precisa da 2 (users); pode rodar 100% em modo teste
Fase 7: UX/UI                                      ← contínua; itens podem intercalar com fases 4-6
Fase 8: Testes completos + LGPD                    ← antes do lançamento público
```

**Ordem real de execução recomendada (v4):** 1 → 2 → 7 (adiantada, sobre simulador) → 4 (sobre simulador) → 5 → 6 (Stripe em modo teste) → **3 por último** (troca simulador por Duffel/Amadeus reais — só aqui começa custo de API) → 8. Ver "Ordem real de construção" no topo do documento para o racional completo.

**Paralelizável desde hoje (sem código, sem custo):** domínio + DNS, projeto Firebase (novo, dentro da conta existente). **Adiar até a Fase 3 real:** contas de produção Duffel/Amadeus (sandbox pode ser criado antes sem custo, mas evitar assumir contrato de produção cedo demais). **Sem custo enquanto durar em modo teste:** conta Stripe (produto/config novos, modo teste), conta Resend (domínio de envio novo, cota gratuita).
