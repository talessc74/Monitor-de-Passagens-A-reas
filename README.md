# ✈️ FlySpot

Sistema de monitoramento de preços de passagens aéreas em tempo real. Configure alertas com preço-alvo para suas viagens e receba notificações quando o valor desejado for atingido.

> Nome oficial do produto: **FlySpot**. O repositório e alguns identificadores internos ainda usam "Monitor de Passagens Aéreas" / `mpa_` por herança do nome provisório — ver `CLAUDE.md`.

> Ver `CLAUDE.md` para arquitetura detalhada e `ROADMAP.md` para o plano completo por fases.

## Funcionalidades

- **Monitores de voo** — Cadastre origem, destino, datas, número de passageiros e preço-alvo
- **Varredura** — Consulta simulada via Gemini AI em LATAM, GOL, Azul, Decolar e Skyscanner (busca real via Duffel/Amadeus chega na Fase 3)
- **Histórico de preços** — Rastreamento das variações ao longo do tempo por monitor
- **Notificações** — Feed de alertas quando o preço-alvo é atingido ou o preço varia
- **Gerenciamento de sites** — Ative/pause as fontes de dados individualmente

## Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 (Vite) — migra para Next.js 14 na Fase 2
- **Backend:** Fastify + TypeScript, monorepo com npm workspaces (`services/api`)
- **AI:** Google Gemini API (simulação de preços — temporário)
- **Banco de dados:** Firestore (Firebase), projeto `lista-ai-f2916`, coleções com prefixo `mpa_`
- **Deploy:** Cloud Run (backend) + Vercel (frontend, a partir da Fase 2)

## Pré-requisitos

- Node.js 20+
- Acesso ao projeto Firebase `lista-ai-f2916` (credenciais de service account para dev local)
- Chave de API do Gemini (opcional — há fallback offline)

## Como rodar localmente

```bash
# Instalar dependências (raiz do monorepo)
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local: GEMINI_API_KEY (opcional) e GOOGLE_APPLICATION_CREDENTIALS

# Popular a coleção mpa_sites no Firestore (uma vez)
npm run seed

# Iniciar frontend + backend juntos
npm run dev
```

Frontend em `http://localhost:5173` (proxy de `/api/*` para o backend em `:8080`).

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Frontend (Vite) + backend (`@mpa/api`) juntos |
| `npm run dev:web` / `npm run dev:api` | Só um dos dois |
| `npm run build` | Build de produção do frontend |
| `npm run build --workspace=@mpa/api` | Type-check + bundle do backend |
| `npm run seed` | Popula `mpa_sites` no Firestore |
| `npm run lint` | Type-check do frontend e do backend |

## Estrutura do projeto

```
├── src/                       # Frontend (Vite/React) — migra para apps/web na Fase 2
├── packages/
│   └── types/                 # @mpa/types — tipos compartilhados com o backend
├── services/
│   └── api/                   # @mpa/api — Fastify: rotas REST, Firestore, scan simulado
│       ├── src/
│       ├── Dockerfile
│       └── package.json
├── .github/workflows/ci.yml   # lint + build a cada push
├── CLAUDE.md                  # arquitetura detalhada para desenvolvimento
└── ROADMAP.md                 # plano completo por fases
```

## Roadmap

Plano completo em `ROADMAP.md`. Resumo:

- [x] Fase 1 — Monorepo, Firestore, backend Fastify no Cloud Run *(código pronto, deploy pendente)*
- [ ] Fase 2 — Login (Firebase Auth) + migração para Next.js 14
- [ ] Fase 3 — Busca real de passagens (Duffel/Amadeus)
- [ ] Fase 4 — Varreduras automáticas
- [ ] Fase 5 — Notificação por e-mail (Resend)
- [ ] Fase 6 — Assinatura paga (Stripe)
- [ ] Fase 7 — UX/UI de produto real
- [ ] Fase 8 — Testes, segurança e LGPD
