# Roadmap — FlySpot (v10 — fases reordenadas pela ordem real de execução)

> **v10 (07/2026):** as fases abaixo foram **fisicamente reordenadas** para refletir a ordem real de construção (era só uma nota separada na v4-v9; agora é a ordem em que o documento lista tudo). Cada título mantém entre parênteses o número de **escopo original** (arquitetura), para referência cruzada com decisões antigas — mas a numeração principal agora é a ordem de execução. Nada de conteúdo técnico mudou, só a ordem de leitura.
>
> **v9 (07/2026): 🎉 FASE 1 CONCLUÍDA.** Deploy real em produção no Cloud Run, confirmado ponta a ponta: `https://flyspot-api-1039076887535.southamerica-east1.run.app`. O caminho até aqui exigiu resolver, em sequência, uma lista típica de bloqueios de "primeiro deploy" num projeto GCP novo — todos documentados na Fase 1 abaixo para servir de referência em deploys futuros de outros serviços (`generator`, `publisher`): API do Firestore, banco Firestore, conta de faturamento, API do Artifact Registry, permissões IAM da conta de deploy, migração de `gcr.io` (legado) para Artifact Registry nativo, e API do Cloud Run Admin. Deploy automatizado via GitHub Actions (botão "Run workflow" — sem terminal, sem Cloud Shell), mesmo padrão do `multi-agent-system`.
>
> **v8 (07/2026):** Fase 1 validada ponta a ponta contra o Firestore real do `lista-ai-f2916`. No processo, dois bloqueios de infraestrutura foram encontrados e resolvidos: API do Firestore precisou ser habilitada manualmente no projeto GCP, e o banco Firestore em si precisou ser criado (projeto nunca tinha um banco Firestore, só possivelmente Realtime Database do Lista Aí). CRUD de monitor, scan e persistência após reinício do processo testados com sucesso.
>
> **v7 (07/2026):** domínio registrado: **`flyspot.com.br`**. Destrava a configuração de DNS (SPF/DKIM) necessária na fase de e-mail para o e-mail transacional não cair em spam.
>
> **v6 (07/2026):** nome oficial do produto definido: **FlySpot**. O código, o projeto Firebase (`lista-ai-f2916`) e o prefixo de coleções (`mpa_`) continuam como estão — trocar esses identificadores internos agora não traz benefício e só gera trabalho de migração; o nome do produto vale para marca, domínio, UI e comunicação daqui em diante. Ver nota em `CLAUDE.md`.
>
> **v5 (07/2026):** deploy do backend trocado de **Firebase Cloud Functions** para **Cloud Run direto (contêiner Docker)** — mesmo padrão já usado no projeto irmão `multi-agent-system`. Motivo: Cloud Functions exige o projeto Firebase no plano **Blaze**; o projeto `lista-ai-f2916` está no **Spark** (gratuito) e serve a outro produto (Lista Aí, hoje inativo) — não há motivo para forçar upgrade de plano só por causa deste produto. Cloud Run publicado diretamente não exige esse upgrade. Isso muda o mecanismo interno das fases de scheduler e e-mail (que dependiam de dois outros produtos "Cloud Functions" do Firebase — `onSchedule` e Firestore Trigger): ambos voltam a ser loops de polling dentro dos próprios serviços Cloud Run, que já são processos persistentes.
>
> **v4 (07/2026):** reordenação estratégica de **construção** para evitar custo de API real antes da hora. O motivo e o racional completo estão preservados logo abaixo.

## Por que esta ordem

**Motivo:** o dono do produto não quer assumir custo de API real (Duffel/Amadeus em produção, Stripe fora do modo teste) enquanto o site ainda está em construção. A maior parte dos serviços listados no roadmap é **gratuita em modo desenvolvimento/sandbox/teste** (Amadeus sandbox, Stripe test mode, cota grátis do Firebase e do Resend) — o único ponto que gera custo real é formalizar contrato de produção com Duffel/Amadeus antes da hora. Solução: construir o produto inteiro primeiro com a fonte de preços simulada (o Gemini já faz isso hoje), e só trocar essa peça pela conexão real por último.

Isso é possível **sem redesenhar nada**, porque a busca de preço já é isolada atrás de uma interface única (`searchFlights`) — hoje implementada pelo simulador do Gemini, depois substituída pelos adaptadores Duffel/Amadeus, sem tocar no resto do sistema.

**Correspondência entre ordem de execução e escopo original:**

| Ordem de execução | Fase (escopo original) | Custo |
|---|---|---|
| 1 | Fase 1 — Fundação (Firestore + deploy) | sem custo |
| 2 | Fase 2 — Login e cadastro | sem custo |
| 3 | Fase 7 — UX/UI completa (site inteiro, sobre o simulador) | sem custo |
| 4 | Fase 4 — Varreduras automáticas (sobre o simulador) | sem custo |
| 5 | Fase 5 — E-mail real via Resend | cota gratuita cobre os testes |
| 6 | Fase 6 — Assinatura Stripe em modo teste | zero cobrança real |
| 7 | Fase 3 — Busca real (Duffel/Amadeus) | **só aqui começa custo real de API** |
| 8 | Fase 8 — Testes finais e LGPD | sem custo |

O conteúdo técnico de cada fase (tarefas, critérios de aceite, arquitetura) é o mesmo de sempre — o que mudou nesta versão é que o documento agora **lista as seções nessa mesma ordem**, em vez de ordem de escopo arquitetural.

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
| Deploy frontend | Cloud Run (mesmo padrão do backend — decisão corrigida de Vercel, ver `_local-adr-policy-001`) |

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
- **CI mínimo desde a Fase 1**: GitHub Actions rodando `lint` + `build` a cada push (testes entram na fase de QA final, o pipeline existe desde o dia 1)

---

## Fase 1 (escopo: Fase 1) — Fundação: Monorepo + Firestore + Deploy do backend

**Status: ✅ CONCLUÍDA — deploy real em produção, confirmado ponta a ponta.**

**URL de produção:** `https://flyspot-api-1039076887535.southamerica-east1.run.app`

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
9. [x] **Deploy real do `api` no Cloud Run** — feito e validado em produção (`flyspot-api`, região `southamerica-east1`)
10. [x] GitHub Actions: `ci.yml` (lint + build a cada push) e `deploy.yml` (deploy sob demanda via botão "Run workflow", mesmo padrão do `multi-agent-system`)

**Validado com credenciais reais do `lista-ai-f2916` nesta sessão:**
- `npm install`, type-check e build de produção (frontend + `api`) — OK
- Bloqueios de infraestrutura encontrados e resolvidos no processo (todos comuns em projeto GCP novo): API do Firestore desabilitada, banco Firestore inexistente (criado em modo Nativo), Artifact Registry API desabilitada, conta de faturamento não vinculada, permissões IAM incompletas na conta de deploy (`flyspot-deploy` precisou de Cloud Run Admin + Storage Admin + Artifact Registry Admin + Service Account User), domínio legado `gcr.io` bloqueado por política (`createOnPush`) — contornado migrando para Artifact Registry nativo (`southamerica-east1-docker.pkg.dev`), Cloud Run Admin API desabilitada
- `npm run seed` populou `mpa_sites` (LATAM, GOL, Azul, Decolar, Skyscanner) de verdade no Firestore
- Fluxo completo testado localmente contra o banco real: criar monitor → rodar scan (preço simulado + histórico gravado) → **reiniciar o processo do servidor por completo** → monitor e histórico continuam intactos → deletar monitor de teste (limpeza)
- Credencial de teste (Firestore) usada apenas localmente nesta sessão e descartada ao final (nunca commitada)
- **Deploy real confirmado em produção**: `GET /health` → `{"status":"ok"}`; `GET /api/sites` → retorna as 5 companhias, lidas do Firestore de produção

**Critérios de aceite (QA):**
- [x] Criar, editar, pausar, deletar monitor funciona contra o Firestore real
- [x] Reiniciar o serviço não perde nenhum dado (era o problema do JSON) — confirmado
- [x] Servidor não sobe com env inválida; rotas rejeitam payload malformado com erro 400 claro
- [x] Mesmos critérios rodando de fato no Cloud Run — confirmado via `GET /health` e `GET /api/sites` na URL de produção

**Ações fora do código:**
- [x] Projeto Firebase definido: **`lista-ai-f2916`** (compartilhado com o produto Lista Aí, hoje inativo — permanece no plano **Spark**, sem upgrade necessário, já que o deploy usa Cloud Run direto e não Cloud Functions)
- [x] API do Firestore habilitada no projeto GCP
- [x] Banco Firestore criado (modo Nativo)
- [x] Credenciais de service account geradas e validadas (uso local/dev)
- [x] Conta de faturamento GCP vinculada ao projeto `lista-ai-f2916`
- [x] API do Artifact Registry habilitada; repositório Docker nativo criado (`southamerica-east1-docker.pkg.dev/lista-ai-f2916/flyspot`)
- [x] API do Cloud Run Admin habilitada
- [x] Conta de deploy `flyspot-deploy` com as 4 permissões necessárias (Cloud Run Admin, Storage Admin, Artifact Registry Admin, Service Account User)
- [x] Secret `GCP_SA_KEY` configurado no GitHub Actions

---

## Fase 2 (escopo: Fase 2) — Next.js 14 + Firebase Auth

**Status: em revisão — PR aberto.**

**O que será construído:** Frontend definitivo em Next.js 14 com login/cadastro. Cada usuário vê só os próprios monitores.

**Tarefas:**

1. [x] Criar `apps/web` (Next.js 14 App Router + Tailwind); portar os componentes existentes (`MonitorCard`, `MonitorForm`, `NotificationFeed`, `SitesList`, `Header`, `EmailModal`)
2. [x] Habilitar Firebase Authentication: e-mail/senha + Google (SDK client no Next.js)
3. [x] Middleware Fastify no `api`: valida o Firebase ID Token (`Authorization: Bearer`) em toda rota protegida; injeta `userId` no request
4. [x] Todas as queries de `monitors`/`notifications` filtram por `userId`; removido `CURRENT_USER_EMAIL` hardcoded
5. [x] Documento `users/{uid}` criado no primeiro login (e-mail, nome, `plan: 'free'`, `createdAt`)
6. [x] Tela de perfil com "Deletar minha conta" (apaga user + monitores + notificações — obrigatório LGPD)
7. [x] Deploy do `apps/web` em **Cloud Run** (não Vercel — decisão corrigida, ver `_local-adr-policy-001`); `api` vira API pura (remove o serving de estáticos de `web-dist/`) — feito: Web App registrado no Firebase Console, `flyspot-web` no ar em `https://flyspot-web-1039076887535.southamerica-east1.run.app` (2026-07-30). **Pendente de confirmação:** ativação dos provedores Email/Password e Google no Firebase Authentication, e adição do domínio do `flyspot-web` aos domínios autorizados — pedido ao Cowork, resposta ainda não confirmada

**Gate de UX (desenhar e aprovar antes de implementar):** login/cadastro, recuperação de senha, perfil.

**Critérios de aceite (QA):**
- Dois usuários diferentes não veem os monitores um do outro (testar explicitamente)
- Rota sem token ou com token expirado retorna 401
- Deletar conta remove todos os dados do usuário no Firestore

**Decisões do produto:** login Google — **decidido: sim, e-mail/senha + Google** · exigir confirmação de e-mail (recomendado: sim)

---

## Fase 3 (escopo: Fase 7) — UX/UI para Produto Real

**O que será construído:** site completo, rodando 100% sobre o simulador de preços do Gemini — nenhuma conexão paga ainda.

Fluxo por item: **UX desenha → produto aprova → implementa → QA valida → ar.**

1. **Onboarding** — guiar o primeiro monitor (o momento "aha" é receber o primeiro alerta); passos: origem/destino → data de ida e volta **com flexibilidade** (± 3/5/7 dias, em vez de data fixa) → passageiros **discriminados** (adultos, crianças 2-11, bebês de colo) → meta de preço, já sugerida a partir do histórico da rota (item 7 abaixo)
2. **Mobile-first** — auditar todas as telas em 375px; maioria dos usuários BR é mobile
3. **Estado vazio** — dashboards sem monitor apontam para a criação
4. **Erros amigáveis** — mapa de erros da API → mensagens em português com ação sugerida
5. **Painel de histórico** — mínima histórica, média, tendência (dados já existem em `history[]`)
6. **Acessibilidade** — contraste AA, navegação por teclado, labels/aria em formulários
7. **Estimativa de preço no onboarding** — antes de o usuário definir a meta, mostrar média/mínima/máxima observada para aquela rota+datas+passageiros nos últimos 60 dias, com atalho "usar como meta". Requer:
   - Novo endpoint `GET /api/route-stats?origin=&destination=&departDate=&returnDate=&flexDays=&adults=&children=&infants=` em `services/api`, reaproveitando o Gemini do `scanSimulator.ts` (mesmo modelo, prompt novo — sem custo adicional, roda sobre o simulador como o resto da fase)
   - Muda o momento da consulta: hoje o Gemini só é chamado *depois* de o monitor existir (scan); esta consulta roda *antes*, no formulário de criação, sem persistir nada
   - Modelo de dados (`packages/types`) precisa acompanhar os novos campos capturados no onboarding: `passengers` deixa de ser um número único e vira `{ adults, children, infants }`; datas fixas (`departDate`/`returnDate`) ganham `flexDays` opcional

---

## Fase 4 (escopo: Fase 4) — Varreduras Automáticas (scheduler)

**Status: ✅ CONCLUÍDA — código, deploy e infraestrutura confirmados em produção.**

**O que será construído:** O sistema varre preços sozinho, respeitando a frequência do plano de cada usuário — testado contra o simulador (sem custo).

> 🔧 **v5 — ajustado para evitar Blaze:** `onSchedule` é um produto Cloud **Functions** do Firebase e exigiria o mesmo upgrade de plano que estamos evitando (ver decisão na Fase 1). Solução: como `generator` já é um serviço Cloud Run de processo persistente (não uma Function), ele mesmo roda um loop de polling interno — mesmo padrão do `multi-agent-system` (Cloud Run direto, sem depender de produtos Firebase que exigem Blaze). Cloud Scheduler (produto GCP separado do Firebase, tem cota gratuita própria) pode opcionalmente bater num endpoint HTTP do `generator` a cada minuto como redundância/keep-alive, mas o loop interno já é suficiente sozinho.

**Arquitetura escolhida — loop de polling dentro do `generator` (Cloud Run):**

- A cada 60s, dentro do próprio processo do `generator`:
  1. Query no Firestore: `mpa_monitors` onde `status == 'active'` e `nextScanAt <= now` (exige índice composto)
  2. Para cada monitor vencido: executa o scan (com o cache da fase de busca real), grava resultado, calcula `nextScanAt = now + intervalo do plano`
  3. Concorrência limitada (ex.: 5 scans em paralelo, `p-limit`)
- **Lease/lock por documento** (`scanningLockedUntil`) para o caso de mais de uma instância do Cloud Run rodando ao mesmo tempo (autoscaling) — evita scan duplicado
- "Escanear agora" na UI: seta `nextScanAt = now` (o loop pega em até 60s) e mostra feedback imediato na tela enquanto isso
- Cloud Run precisa estar configurado com **mínimo 1 instância sempre ativa** (não escalar a zero), senão o loop para quando não há requisição HTTP chegando

**Por que não fila externa:** BullMQ+Redis (Upstash) é a evolução natural **se** o volume crescer muito; começar com polling elimina qualquer infraestrutura extra e não depende de nenhum produto Firebase gated pelo Blaze.

**Tarefas:**

1. [x] Índice composto Firestore (`status` + `nextScanAt`) — declarado em `firestore.indexes.json`/`firebase.json`; criado no projeto real via o link automático do erro `FAILED_PRECONDITION` (ID `CICAgOjXh4EK`), confirmado "Ativado"
2. [x] Loop de polling com lease, concorrência limitada e shutdown gracioso — `services/generator/src/scheduler.ts`
3. [x] Configurar Cloud Run do `generator` com min-instances = 1 — `deploy.yml` (`--min-instances=1`), deploy rodado com sucesso (run #9)
4. [x] Intervalo por plano lido de `mpa_users/{uid}.plan` (free: 6h, pro: 1h — configurável via env)
5. [x] Ao criar monitor: `nextScanAt = now` (já era o comportamento desde a Fase 1)
6. [x] Telemetria mínima: doc `system/schedulerHealth` com último tick e contagem de scans/erros

**Arquitetura implementada (detalhe que não estava decidido antes de construir — ver `_local-adr-policy-002`):** como o `generator` não tem usuário Firebase logado para autenticar como, ele dispara o scan chamando uma nova rota interna do `api` (`POST /internal/scan/:id`), autenticada por segredo compartilhado (`INTERNAL_SCAN_TOKEN`) em vez de token de usuário. A lógica de scan foi extraída para `services/api/src/executeScan.ts`, reaproveitada tanto pela rota autenticada (clique manual) quanto pela interna (scheduler).

**Ações fora do código — todas concluídas:**
- [x] Índice composto criado no Firestore real (via link automático do erro, sem precisar da CLI do Firebase)
- [x] `INTERNAL_SCAN_TOKEN` gerado e cadastrado como secret no GitHub Actions
- [x] `deploy.yml` rodado com sucesso, publicando `flyspot-api` e `flyspot-generator` (run #9, 2026-07-30)

**Validado em produção:** erro `FAILED_PRECONDITION` (índice ausente) recorrente a cada tick desde antes do índice existir; parou de aparecer nos logs do `flyspot-generator` assim que o índice ficou "Ativado" — confirma que o loop de polling está rodando de verdade contra o Firestore de produção.

**Critérios de aceite (QA):**
- Monitor criado é varrido em ≤ 2 min sem clique
- Frequência respeitada por plano; execução que estoura o timeout não corrompe dados nem duplica notificação
- Duas execuções sobrepostas não geram scan duplicado (testar o lease)

---

## Fase 5 (escopo: Fase 5) — Notificações por E-mail (serviço `publisher`)

**O que será construído:** E-mail real quando o preço bater a meta ou variar — cota gratuita do Resend cobre o volume de testes.

**Arquitetura — padrão outbox no Firestore, consumido por polling (v5: sem Firestore Trigger, que é Cloud Function e exigiria Blaze):**

- Quem detecta o evento (`generator`) grava um doc em `mpa_outbox` (`type`, `payload`, `status: 'pending'`)
- `publisher` (Cloud Run, processo persistente, min-instances = 1) consome a `mpa_outbox` via listener `onSnapshot` do firebase-admin (funciona normalmente fora de Cloud Functions, dentro de qualquer processo Node com firebase-admin) + polling de segurança a cada 60s (cobre reconexões)
- Após envio: `status: 'sent'` + `sentAt` + id da mensagem no Resend. Falha: retry com backoff interno, máximo 5 tentativas, depois `status: 'failed'`
- **Idempotência**: chave de deduplicação por evento (`monitorId + tipo + janela de tempo`) — nunca dois e-mails iguais para o mesmo evento

**Tarefas:**

1. [x] Criar `services/publisher` + coleção `outbox`
2. [x] Integrar Resend (cliente REST via fetch, no-op sem `RESEND_API_KEY`) — falta apenas a parte de infra: domínio verificado (SPF/DKIM), ver "Ações fora do código" abaixo. **Sem domínio próprio o e-mail cai em spam, bloqueador real**
3. [x] Templates HTML: "Meta atingida" e "Preço variou" — preço vs. meta, botão "Comprar agora" (deep-link já existe em `purchaseUrl`), link de pausar monitor (LGPD/opt-out)
4. [x] Throttle por monitor (máx. 1 e-mail por monitor por hora, exceto meta atingida) — via chave de dedup determinística + `.create()` no outbox
5. [x] Registrar cada envio na coleção `notifications` (o feed da UI continua funcionando — outbox é um ponteiro fino para o `NotificationLog` já existente, não o substitui)

**Fase 5b (não urgente):** Telegram via bot — o padrão outbox já deixa pronto (só um novo consumer).

**Critérios de aceite (QA):**
- Preço abaixo da meta ⇒ e-mail chega na caixa de entrada (não spam) em < 2 min
- Evento processado 2x não gera 2 e-mails
- Link "pausar monitor" funciona sem login (token assinado na URL)

**Ações fora do código:**
- [ ] Conta Resend + API key — sem isso, o envio real de e-mail continua em modo no-op (só loga)
- [x] Domínio registrado: **`flyspot.com.br`** — falta configurar DNS (SPF/DKIM) para o Resend
- [x] Secret `EMAIL_ACTION_SECRET` no GitHub Actions — confirmado ativo; verificado em produção que `flyspot-publisher` está estável (sem crash-loop) rodando com ele (2026-07-30, revisão `flyspot-publisher-00003-nff`)
- [ ] `RESEND_API_KEY` — ainda não configurado no GitHub Actions
- [x] Rodar `deploy.yml` para publicar `flyspot-publisher` no Cloud Run — feito; serviço saudável em produção

**Decisões do produto:** domínio e nome do remetente

---

## Fase 6 (escopo: Fase 6) — Monetização com Stripe

**Status: ✅ CONCLUÍDA — código, deploy e configuração do Stripe confirmados em produção (modo test).**

**O que será construído:** Assinatura Pro com limites por plano aplicados no backend — tudo em modo teste (cartão de teste, zero cobrança real).

**Planos (confirmada pelo dono do produto):**

| Recurso | Gratuito | Pro (R$29/mês) |
|---------|---------|--------------------------|
| Monitores ativos | 2 | 10 |
| Frequência de varredura | 6h | 1h |
| Histórico de preços | 7 dias | 90 dias |
| E-mail | ✅ | ✅ |
| Telegram | ❌ | ✅ |

**Tarefas:**

1. [x] Produtos/preços no Stripe Dashboard (modo test primeiro) — "FlySpot Pro", R$29/mês recorrente, separado do produto irmão EAI Jurídico
2. [x] `api`: rota `POST /billing/checkout` (cria sessão Stripe Checkout) e `POST /billing/portal` (Customer Portal)
3. [x] Webhook `POST /webhooks/stripe`: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` → atualiza `users/{uid}.plan` e `stripeCustomerId`. Assinatura verificada via SDK oficial do Stripe (corpo bruto); idempotente por `event.id` (mesmo padrão de dedup do outbox da Fase 5)
4. [x] Enforcement no backend (não só na UI): criar monitor além do limite → 403 com mensagem de upgrade (conta todos os monitores do usuário, ativos ou pausados — ver `_local-adr-policy-003`); downgrade → monitores excedentes pausados automaticamente (não deletados), mantendo os mais antigos ativos
5. [x] Job de expurgo de histórico conforme o plano (7/90 dias) — roda 1x/dia no `generator`
6. [x] UI: página `/plans`, badge do plano atual no perfil, CTA de upgrade quando o limite é atingido no dashboard

**Critérios de aceite (QA):**
- Fluxo completo em modo test: assinar → virar Pro → limites novos valem → cancelar → voltar a free com monitores excedentes pausados
- Webhook reenviado pelo Stripe não duplica efeito
- Usuário free não consegue criar 3º monitor nem via chamada direta à API

**Decisões do produto:** preço R$29/mês confirmado · tabela de limites confirmada como proposta · trial de 10 dias grátis (só na primeira assinatura por usuário)

**Ações fora do código — todas concluídas:**
- [x] Conta Stripe — confirmado pelo dono do produto: já recebe pagamentos no Brasil sem CNPJ (validado no projeto irmão EAI Jurídico)
- [x] Produto/preço recorrente (R$29/mês) criado no Stripe Dashboard em modo test; `price_id` salvo em `STRIPE_PRICE_ID_PRO`
- [x] Endpoint de webhook configurado no Stripe Dashboard apontando para `flyspot-api/webhooks/stripe`, com os 3 eventos corretos (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`); `whsec_...` salvo em `STRIPE_WEBHOOK_SECRET`
- [x] Secrets no GitHub Actions: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `APP_URL`
- [x] `EMAIL_ACTION_SECRET` (pendente desde a Fase 5) — confirmado ativo
- [x] `deploy.yml` rodado com sucesso publicando os 4 serviços (`flyspot-api`, `flyspot-generator`, `flyspot-publisher`, `flyspot-web`), 2026-07-30 — tudo em modo TEST, zero cobrança real

---

## Fase 7 (escopo: Fase 3) — Busca Real de Passagens (serviço `generator`)

> ⚠️ **É só a partir desta fase que começa custo real de API** (contrato de produção Duffel/Amadeus). Todas as fases anteriores rodaram sobre o simulador Gemini de propósito, para validar o produto inteiro sem esse custo.

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

## Fase 8 (escopo: Fase 8) — Qualidade, Testes e LGPD

> Segurança básica (Zod, rate limit, helmet, idempotência) **já entrou desde a Fase 1** como padrão transversal. Esta fase cobre o que exige o produto estável, e é o portão final antes do lançamento público.

### Testes e CI/CD
- Vitest: testes de integração por serviço (prioridade: regras de plano, scheduler, outbox, webhook Stripe)
- Playwright E2E: cadastro → criar monitor → scan → notificação
- GitHub Actions completo: lint + testes bloqueando merge; deploy automático (Cloud Run, todos os serviços) só com pipeline verde

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

## Dependências entre fases (arquitetura — independe da ordem física acima)

```
Fase 1: Monorepo + Firestore + api no Firebase      ← fundação
Fase 2: Next.js 14 + Firebase Auth (Cloud Run)     ← precisa da 1
Fase 3 (escopo 7): UX/UI                           ← contínua; roda sobre o simulador
Fase 4: Scheduler de varreduras                    ← precisa de uma fonte de preço (simulada ou real)
Fase 5: E-mail (publisher + outbox)                ← precisa da 4; domínio/DNS pode andar em paralelo desde já
Fase 6: Stripe                                     ← precisa da 2 (users); pode rodar 100% em modo teste
Fase 7 (escopo 3): Busca real + generator          ← precisa da 1; adaptador plugável no lugar do simulador Gemini
Fase 8: Testes completos + LGPD                    ← antes do lançamento público
```

**Paralelizável desde hoje (sem código, sem custo):** domínio + DNS, projeto Firebase (novo, dentro da conta existente). **Adiar até a Fase 7 (escopo 3) real:** contas de produção Duffel/Amadeus (sandbox pode ser criado antes sem custo, mas evitar assumir contrato de produção cedo demais). **Sem custo enquanto durar em modo teste:** conta Stripe (produto/config novos, modo teste), conta Resend (domínio de envio novo, cota gratuita).
