# Build a partir da raiz do monorepo:
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... \
#     --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=... \
#     .
#
# Cloud Run, não Vercel — ver _local-adr-policy-001 (amendment). O
# Next.js embute variáveis NEXT_PUBLIC_* no bundle em tempo de build,
# por isso elas entram como --build-arg, não como env_vars do Cloud
# Run (que só afetam o processo em runtime, tarde demais pro bundle).

# ── Stage 1: instala dependências e builda ─────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/types/package.json packages/types/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install

COPY . .

ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG API_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV API_URL=$API_URL

RUN npm run build --workspace=@mpa/web

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# output: 'standalone' (next.config.mjs) gera um server.js mínimo com
# só as dependências realmente usadas — preserva o caminho do monorepo
# (apps/web/...) porque o tracing roda a partir da raiz do workspace.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Cloud Run injeta PORT; o server standalone do Next.js já lê
# process.env.PORT nativamente.
EXPOSE 8080
ENV PORT=8080
CMD ["node", "apps/web/server.js"]
