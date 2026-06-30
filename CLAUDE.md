# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack (padrão dos projetos do owner)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + React + Tailwind CSS |
| Backend | Fastify (Node.js/TypeScript) — 3 serviços independentes |
| Banco de dados | Firestore (Firebase) via `firebase-admin` |
| IA | Google Gemini API |
| Pagamentos | Stripe |
| Deploy backend | Railway |
| Deploy frontend | Vercel |

## Serviços backend (estrutura alvo)

```
services/
  api/          # gateway REST — autenticação, CRUD de monitores, orquestração
  generator/    # IA + busca de preços (Gemini, Duffel, Amadeus)
  publisher/    # disparo de notificações (e-mail via Resend, futuramente Telegram)
```

Cada serviço é um processo Fastify independente, deployado separadamente no Railway.

## Estado atual (MVP herdado do AI Studio)

O MVP usa Express + Vite + arquivo JSON como banco. **Ainda não foi migrado** para a stack definitiva acima. Os arquivos atuais na raiz (`server.ts`, `src/`, `vite.config.ts`) são a base de partida — a migração ocorre nas fases do roadmap.

## Commands (MVP atual — enquanto não migra)

```bash
npm install       # instalar dependências
npm run dev       # servidor dev (Express + Vite HMR) em http://localhost:3000
npm run build     # build de produção
npm start         # servir build de produção
npm run lint      # type-check TypeScript (noEmit)
```

## Arquitetura do MVP atual

```
Browser (React SPA)
  └─ fetch /api/*
       └─ Express (server.ts)
            ├─ JSON file DB  (server_db_passagens.json, auto-criado em runtime)
            └─ Gemini AI API  (opcional — fallback offline se sem GEMINI_API_KEY)
```

### Arquivos-chave do MVP

| Arquivo | Papel |
|---------|-------|
| `server.ts` | Todo o backend: rotas REST, leitura/escrita do JSON, chamadas Gemini, lógica de scan e notificações |
| `src/types.ts` | Interfaces TypeScript compartilhadas — fonte da verdade para o shape dos dados |
| `src/App.tsx` | Componente raiz: todo o state, fetch da API, passa handlers para baixo |
| `src/components/MonitorCard.tsx` | UX do scan: animação passo a passo, exibição de resultado |

### Modelo de dados (types.ts)

- **`FlightMonitor`** — entidade central: códigos IATA origem/destino, datas, contagem de passageiros, `targetPrice`, `currentPrice`, `history[]`, `trackedSites`, `status: 'active' | 'paused'`
- **`NotificationLog`** — gerada quando `currentPrice ≤ targetPrice` ou preço muda; inclui `purchaseUrl` deep-link para o site da companhia
- **`AirlineSite`** — metadata de cada fonte (LATAM, GOL, Azul, Decolar, Skyscanner): `status`, `scrapedCount`, `avgResponseMs`

### Lógica de scan (`POST /api/monitors/:id/scan`)

1. Chama Gemini (`gemini-3.5-flash`) com schema JSON estruturado para gerar preços realistas em BRL por site
2. Fallback para simulação determinística se `GEMINI_API_KEY` ausente ou chamada falhar
3. Pega o resultado mais barato, atualiza `monitor.currentPrice` e `monitor.history`, incrementa stats do site
4. Cria `NotificationLog` se preço ≤ meta ou preço mudou desde o último scan

### Variáveis de ambiente

| Variável | Obrigatória | Notas |
|----------|-------------|-------|
| `GEMINI_API_KEY` | Não | Habilita simulação AI; sem ela roda fallback offline |
| `APP_URL` | Não | URL base para links auto-referenciais |

Copiar `.env.example` para `.env.local` para desenvolvimento local.

### Dev vs produção

`server.ts` verifica `NODE_ENV`:
- **development** — monta Vite como middleware Express (HMR funciona)
- **production** — serve pasta estática `dist/` do `npm run build`

## Processo de desenvolvimento

- Toda feature passa por **UX** antes de implementar
- Toda feature passa por **QA** antes de ir ao ar
- Agente Argus aciona a equipe técnica — o dono do produto não resolve questões técnicas diretamente
