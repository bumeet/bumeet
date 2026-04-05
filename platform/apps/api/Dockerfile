# Build context: platform/ (monorepo root)
FROM node:20-alpine AS base
RUN npm install -g pnpm@9

# ── deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --no-frozen-lockfile --filter api...

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY apps/api ./apps/api
RUN cd apps/api && npx prisma generate
RUN pnpm --filter api run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy only production deps + built output
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json ./package.json

EXPOSE 8080

CMD ["sh", "-c", "node node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main"]
