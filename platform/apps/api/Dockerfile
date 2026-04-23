# Build context: platform/ (monorepo root)
FROM acrbumeetdev.azurecr.io/node:20-alpine AS base
RUN apk add --no-cache openssl && npm install -g pnpm@9

# ── install ────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --no-frozen-lockfile --filter api...

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npx nest build && ls dist/main.js

# ── runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

# Copy installed packages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy built output and runtime files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/package.json ./apps/api/package.json
COPY package.json ./package.json
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml

ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app/apps/api

# Generate Prisma client for the runner platform
RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main"]
