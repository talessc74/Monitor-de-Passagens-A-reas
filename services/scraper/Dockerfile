# Build a partir da raiz do monorepo:
#   docker build -f services/scraper/Dockerfile .

# ── Stage 1: instala dependências e builda ─────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY services/scraper/package.json services/scraper/package.json
RUN npm install

COPY . .
RUN npm run build --workspace=@mpa/scraper

# ── Stage 2: runtime — imagem oficial do Playwright, já traz o Chromium
# e todas as dependências de sistema (libnss3, libatk etc.) instaladas.
# node:20-slim exigiria instalar isso tudo manualmente; a imagem oficial
# evita esse risco de esquecer uma dependência de sistema. A versão da
# tag PRECISA bater com o `playwright` do package.json (1.49.1) — senão
# o navegador instalado na imagem não corresponde ao que o pacote espera.
# ────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.49.1-jammy AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/scraper/dist ./dist

# Cloud Run injeta PORT; src/env.ts já lê process.env.PORT.
EXPOSE 8083
CMD ["node", "dist/index.cjs"]
