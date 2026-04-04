# BUMEET Platform

User-facing web platform for the BUMEET desk presence system.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     BUMEET Platform                      │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │  Next.js 14  │───▶│  NestJS API  │───▶│ PostgreSQL│  │
│  │  (port 3000) │    │  (port 3001) │    │ (port 5432│  │
│  └──────────────┘    └──────┬───────┘    └───────────┘  │
│                             │                            │
│                      ┌──────▼───────┐    ┌───────────┐  │
│                      │    Redis     │    │Local Agent│  │
│                      │  (port 6379) │    │  (Python) │  │
│                      └──────────────┘    └───────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker + Docker Compose

## Quick Start

```bash
# 1. Start infrastructure
cd platform
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Setup API environment
cp apps/api/.env.example apps/api/.env

# 4. Run database migrations and seed
cd apps/api
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
cd ../..

# 5. Setup web environment
cp apps/web/.env.local.example apps/web/.env.local

# 6. Start development servers
pnpm dev
```

Open http://localhost:3000

## Demo credentials

```
Email: demo@bumeet.io
Password: Demo1234!
```

Or click "Try demo account" on the login page.

## Environment Variables

### API (`apps/api/.env`)

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No (demo mode) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | No |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID | No (demo mode) |
| `AGENT_API_KEY` | API key for local Python agent | No |
| `FRONTEND_URL` | Frontend URL for CORS/redirects | Yes |

### Web (`apps/web/.env.local`)

| Variable | Description | Required |
|---|---|---|
| `NEXTAUTH_URL` | NextAuth callback URL | Yes |
| `NEXTAUTH_SECRET` | NextAuth session secret | Yes |
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth (same as API) | No |

## Running tests

```bash
# Backend tests
cd apps/api && pnpm test

# Frontend tests
cd apps/web && pnpm test
```

## Demo mode

When OAuth environment variables are not set, the platform runs in **demo mode**:
- Integration connections create mock records with sample data
- All flows are fully functional without real OAuth credentials
- A demo user is pre-seeded with sample events, integrations, and messages

## Agent API

The local Python agent can connect to the platform API:

```bash
# Report presence status
curl -X POST http://localhost:3001/api/v1/agent/presence \
  -H "x-agent-key: demo-agent-key-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{"status": "busy"}'

# Send message to display (from platform side)
curl -X POST http://localhost:3001/api/v1/agent/message \
  -H "x-agent-key: demo-agent-key-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{"content": "In a meeting", "userId": "user-id"}'
```

## Key API endpoints

```
POST /api/v1/auth/register       Register new user
POST /api/v1/auth/login          Login
GET  /api/v1/auth/me             Current user
GET  /api/v1/integrations        List integrations
POST /api/v1/integrations/connect/:provider  Connect provider
GET  /api/v1/calendar/events     Get events (query: start, end, providers)
POST /api/v1/messages            Send message to display
GET  /api/v1/messages            Message history
POST /api/v1/agent/presence      Report presence (agent key)
```

## MVP limitations

- OAuth is simulated in demo mode (no real token exchange)
- Calendar events are seeded/imported manually (no real sync daemon)
- Agent API uses a static key (no per-user agent authentication)
- Message delivery simulation uses setTimeout (no real BLE integration)
- No real-time updates (no WebSocket/SSE)

## Roadmap

1. Real OAuth token exchange and calendar sync daemon
2. WebSocket for real-time event updates and delivery status
3. Per-user agent authentication and pairing flow
4. Real BLE message delivery confirmation
5. Mobile app
6. Team/workspace support
