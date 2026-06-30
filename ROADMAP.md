# Roadmap — Monitor de Passagens Aéreas

## Stack definitiva (padrão dos projetos)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + React + Tailwind CSS |
| Backend | Fastify (Node.js/TypeScript) — 3 serviços independentes |
| Banco | Firestore (Firebase) via `firebase-admin` |
| IA | Google Gemini API |
| Pagamentos | Stripe |
| E-mail | Resend + React Email |
| Deploy backend | Railway |
| Deploy frontend | Vercel |

---

## Fase 1 — Fundação: Banco Real + Deploy

**O que será construído:** Migrar do arquivo JSON local para Firestore, e colocar o sistema na nuvem.

**Ações técnicas:**
- Criar projeto Firebase e configurar Firestore
- Substituir `readDatabase()` / `writeDatabase()` em `server.ts` por chamadas `firebase-admin`
- Coleções Firestore espelhando os tipos atuais: `monitors`, `notifications`, `sites`, `users`
- Deploy do backend no Railway, frontend na Vercel, ligados ao repositório GitHub

**Dependências:** Nenhuma — é a fundação de tudo.

**Ações imediatas (fora do código):**
- [ ] Criar projeto no Firebase Console
- [ ] Criar projeto no Railway
- [ ] Conectar repositório GitHub à Vercel

---

## Fase 2 — Autenticação de Usuários

**O que será construído:** Login e cadastro. Cada usuário vê apenas seus próprios monitores. O e-mail fixo hardcoded no código some.

**Ações técnicas:**
- Habilitar Firebase Authentication (e-mail/senha + Google)
- Middleware Fastify para validar o token Firebase em todas as rotas protegidas
- Campo `userId` adicionado à coleção `monitors` no Firestore
- Remover `CURRENT_USER_EMAIL` hardcoded do `App.tsx`
- Migrar frontend de React SPA para Next.js 14 (App Router)

**UX precisa desenhar antes:**
- Tela de login e cadastro
- Recuperação de senha
- Perfil do usuário com opção "Deletar minha conta" (obrigatório LGPD)

**Decisões do produto:**
- Aceitar login via Google?
- Exigir confirmação de e-mail no cadastro?

---

## Fase 3 — Busca Real de Passagens

**O que será construído:** Substituir o Gemini simulando preços por APIs que retornam preços reais.

**APIs de busca (avaliação):**

| API | Dados | Custo | Status |
|-----|-------|-------|--------|
| **Duffel** | Direto das companhias | Gratuito para busca | ✅ Principal |
| **Amadeus** | GDS global | Grátis em sandbox | ✅ Secundária |
| Skyscanner Partners | Agregado | Acesso restrito | ❌ Processo lento |
| Scraping direto | Real | Zero de API | ❌ Proibido nos ToS |

**Ações técnicas:**
- Criar serviço `generator` (Fastify) separado do `api`
- Módulo de adaptadores `/services/generator/src/flights/` com interface comum: `searchFlights(params) → FlightResult[]`
- Duffel e Amadeus implementam essa interface
- Gemini continua com papel diferente: analisa os preços recebidos e gera texto de tendência

**Ações imediatas (fora do código):**
- [ ] Iniciar aprovação no Duffel *(pode levar dias — fazer agora)*
- [ ] Criar conta no Amadeus for Developers *(aprovação automática)*

**Decisões do produto:**
- Orçamento mensal para APIs de busca?
- Lançar com rotas domésticas apenas ou internacionais também?

---

## Fase 4 — Varreduras Automáticas

**O que será construído:** O sistema verifica preços sozinho em intervalos regulares, sem ninguém clicar.

**Ações técnicas:**
- Usar **Cloud Tasks** (Firebase) ou **BullMQ + Upstash Redis** para fila de jobs
- Ao criar um monitor, agendar primeira varredura automaticamente
- Worker no serviço `generator` consome a fila e executa buscas
- Campo `nextScanAt` adicionado à coleção `monitors`
- Botão "Escanear agora" na UI coloca o monitor na frente da fila (varredura prioritária)

**Frequências por plano:**
- Gratuito: a cada 6 horas
- Pago: a cada 1 hora

**Decisões do produto:**
- Frequência de varredura por plano (confirmar os valores acima)?

---

## Fase 5 — Notificações por E-mail

**O que será construído:** E-mails reais chegando quando o preço bater a meta.

**Ações técnicas:**
- Criar serviço `publisher` (Fastify) separado
- Integrar **Resend** com templates **React Email**
- E-mail contém: trecho, preço vs. meta, datas, botão "Comprar agora" com deep-link, link para pausar o monitor
- Serviço `api` publica evento no Firestore → `publisher` ouve e dispara o e-mail

**Fase 5b (não urgente):** Notificações por Telegram via bot.

**Ações imediatas (fora do código):**
- [ ] Criar conta no Resend
- [ ] Reservar domínio do produto (necessário para e-mails não caírem no spam)

**Decisões do produto:**
- Domínio para envio? (ex: `alertas@seudominio.com.br`)
- Nome da marca no remetente?

---

## Fase 6 — Monetização com Stripe

**O que será construído:** Planos de assinatura com limites por plano.

**Estrutura de planos sugerida:**

| Recurso | Gratuito | Pro (sugestão: R$29/mês) |
|---------|---------|--------------------------|
| Monitores ativos | 2 | 10 |
| Frequência de varredura | 6h | 1h |
| Histórico de preços | 7 dias | 90 dias |
| E-mail | ✅ | ✅ |
| Telegram | ❌ | ✅ |

**Ações técnicas:**
- Stripe Checkout para página de pagamento
- Stripe Billing para cobranças recorrentes
- Stripe Customer Portal para o usuário gerenciar a própria assinatura
- Webhook Stripe → Fastify para confirmar pagamentos e cancelamentos
- Campo `plan` e `stripeCustomerId` adicionados ao perfil do usuário no Firestore
- Middleware que verifica o plano antes de criar monitor além do limite

**Ações imediatas (fora do código):**
- [ ] Criar conta Stripe e verificar requisitos de CNPJ para receber pagamentos no Brasil

**Decisões do produto:**
- Preço do plano pago?
- Diferenças entre gratuito e pago (confirmar tabela acima)?
- Período de trial?

---

## Fase 7 — UX/UI para Produto Real

Cada item abaixo: **UX desenha → produto aprova → time implementa → QA valida → vai ao ar.**

1. **Onboarding** — guiar o novo usuário a criar o primeiro monitor
2. **Mobile-first** — a maioria dos usuários brasileiros acessa pelo celular
3. **Estado vazio** — o que aparece quando não há monitores ainda
4. **Erros amigáveis** — mensagens úteis quando algo falha
5. **Painel de histórico** — gráfico com mínima histórica, média, tendência
6. **Acessibilidade básica** — contraste, navegação por teclado, labels em formulários

---

## Fase 8 — Qualidade, Segurança e LGPD

### Testes e CI/CD
- Testes de integração das APIs Fastify (Vitest)
- Testes end-to-end com Playwright (fluxo: cadastro → criar monitor → receber e-mail)
- GitHub Actions: a cada `git push` roda `lint` + testes; deploy automático só se passar

### Segurança
- Rate limiting em todas as rotas (evitar abuso e custos surpresa nas APIs de busca)
- Validação de inputs com Zod em todos os serviços
- Headers de segurança com `@fastify/helmet`
- Nunca commitar chaves de API (verificar com `git-secrets` no CI)

### LGPD
- Política de Privacidade acessível antes do cadastro
- Termos de Uso
- Checkbox de consentimento no cadastro (não pode ser pré-marcado)
- Botão "Deletar minha conta" que apaga todos os dados do Firestore
- E-mail público para solicitações de dados (ex: `privacidade@seudominio.com.br`)
- ⚠️ Consultar advogado especializado em LGPD antes do lançamento público

---

## Sequência

```
Fase 1: Firestore + Deploy (Railway/Vercel)
Fase 2: Firebase Auth + Next.js 14
Fase 3: Busca real (Duffel + Amadeus) + serviço generator
Fase 4: Varreduras automáticas (fila de jobs)
Fase 5: E-mail transacional (Resend) + serviço publisher
Fase 6: Stripe / Assinaturas
Fase 7: UX/UI polida
Fase 8: Testes, segurança, LGPD
```

---

## Estrutura de serviços alvo

```
Monitor-de-Passagens-Aereas/
├── apps/
│   └── web/                  # Next.js 14 (App Router)
├── services/
│   ├── api/                  # Fastify — gateway, auth, CRUD
│   ├── generator/            # Fastify — IA + busca de preços
│   └── publisher/            # Fastify — e-mail, Telegram
├── packages/
│   └── types/                # Tipos TypeScript compartilhados
├── CLAUDE.md
└── ROADMAP.md
```
