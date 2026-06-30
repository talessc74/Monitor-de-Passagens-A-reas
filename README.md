# ✈️ Monitor de Passagens Aéreas

Sistema de monitoramento de preços de passagens aéreas em tempo real. Configure alertas com preço-alvo para suas viagens e receba notificações quando o valor desejado for atingido.

## Funcionalidades

- **Monitores de voo** — Cadastre origem, destino, datas, número de passageiros e preço-alvo
- **Varredura automática** — Consulta simulada via Gemini AI em LATAM, GOL, Azul, Decolar e Skyscanner
- **Histórico de preços** — Rastreamento das variações ao longo do tempo por monitor
- **Notificações** — Feed de alertas quando o preço-alvo é atingido ou o preço varia
- **Gerenciamento de sites** — Ative/pause as fontes de dados individualmente

## Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4
- **Backend:** Express.js + TypeScript (`tsx` para dev)
- **AI:** Google Gemini API (para estimativa inteligente de preços)
- **Bundler:** Vite 6
- **Banco de dados:** JSON local (`server_db_passagens.json`)

## Pré-requisitos

- Node.js 18+
- Chave de API do Gemini (opcional — há fallback offline)

## Como rodar localmente

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local e adicione sua GEMINI_API_KEY

# Iniciar em desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Vite + Express) |
| `npm run build` | Build de produção |
| `npm start` | Inicia o servidor de produção |
| `npm run lint` | Checagem de tipos TypeScript |

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `GEMINI_API_KEY` | Chave da API Google Gemini (para simulação inteligente de preços) |
| `APP_URL` | URL base da aplicação |

## Estrutura do projeto

```
├── server.ts                 # Backend Express + API REST
├── src/
│   ├── App.tsx               # Componente raiz
│   ├── types.ts              # Interfaces TypeScript
│   ├── components/
│   │   ├── Header.tsx        # Cabeçalho da aplicação
│   │   ├── MonitorForm.tsx   # Formulário de criação de monitor
│   │   ├── MonitorCard.tsx   # Card de monitor individual
│   │   ├── NotificationFeed.tsx  # Feed de notificações
│   │   ├── SitesList.tsx     # Lista de sites monitorados
│   │   └── EmailModal.tsx    # Modal de detalhes de notificação
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Roadmap

- [ ] Agendamento automático de varreduras (cron)
- [ ] Envio real de e-mail (SendGrid / Resend)
- [ ] Suporte a múltiplos usuários
- [ ] Banco de dados persistente (PostgreSQL / SQLite)
- [ ] Integração com APIs reais de passagens (Amadeus, Skyscanner API)
- [ ] Notificações via Telegram / WhatsApp
- [ ] PWA / app mobile
