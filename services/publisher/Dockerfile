# Build a partir da raiz do monorepo:
#   docker build -f services/publisher/Dockerfile .

# ── Stage 1: instala dependências e builda ─────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/types/package.json packages/types/package.json
COPY services/publisher/package.json services/publisher/package.json
RUN npm install

COPY . .
RUN npm run build --workspace=@mpa/publisher

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/publisher/dist ./dist

# Cloud Run injeta PORT; src/env.ts já lê process.env.PORT. O servidor
# HTTP só existe para health check — o trabalho real é o consumidor do
# outbox, que precisa de min-instances=1 configurado no Cloud Run para
# não parar quando não há requisição HTTP chegando.
EXPOSE 8082
CMD ["node", "dist/index.cjs"]
