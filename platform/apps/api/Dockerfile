# Build context: platform/ (monorepo root)
FROM node:20-alpine AS base
RUN apk add --no-cache openssl && npm install -g pnpm@9

# ── install + build ────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --no-frozen-lockfile --filter api...
COPY apps/api ./apps/api
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

COPY --from=builder /app .

ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app/apps/api

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main"]
