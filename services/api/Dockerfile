# Build a partir da raiz do monorepo:
#   docker build -f services/api/Dockerfile .

# ── Stage 1: instala dependências e builda tudo ────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/types/package.json packages/types/package.json
COPY services/api/package.json services/api/package.json
RUN npm install

COPY . .
RUN npm run build --workspace=@mpa/api

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# npm workspaces faz hoist das dependências para o node_modules da raiz —
# é de lá que o node resolve os pacotes de services/api em runtime.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/api/dist ./dist

# Cloud Run injeta PORT; src/env.ts já lê process.env.PORT. api é API
# pura — o frontend (apps/web) é servido pelo serviço flyspot-web, não
# mais por aqui. Ver _local-adr-policy-001 (amendment, Fase 2 tarefa 7).
EXPOSE 8080
CMD ["node", "dist/index.cjs"]
