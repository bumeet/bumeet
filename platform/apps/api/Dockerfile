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
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

# Copy workspace config + package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY apps/api/package.json ./apps/api/package.json

# Install production deps (creates correct pnpm symlinks in-place)
RUN pnpm install --no-frozen-lockfile --filter api... --prod

# Copy built output and prisma schema
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Generate prisma client in runner (needed for correct platform binaries)
RUN pnpm --filter api exec prisma generate

ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app/apps/api

EXPOSE 8080

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main"]
