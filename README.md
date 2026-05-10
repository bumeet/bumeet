# BUMEET

E-ink presence display for office doors. Shows FREE / BUSY / UPCOMING based on calendar events, Slack calls, Zoom meetings, and microphone activity — automatically, with no manual interaction.

## Components

| Directory | Description |
|---|---|
| `firmware/` | M5Stack CoreInk firmware (Arduino / NimBLE) — BLE GATT server |
| `src/bumeet_agent/` | Python desktop agent (macOS + Windows) — detects calls and pushes state |
| `platform/apps/api/` | NestJS API — integrations, calendar sync, presence |
| `platform/apps/web/` | Next.js — public landing + user dashboard |
| `infra/` | Terraform on Azure (App Service, PostgreSQL, Redis, SWA, ACR) |

## Quick start (development)

### Prerequisites

- Node.js ≥ 20, pnpm ≥ 9
- Python ≥ 3.11
- Docker (for PostgreSQL + Redis)
- Arduino IDE or `arduino-cli` (for firmware)

### 1. Start infrastructure

```bash
cd platform
docker compose up -d          # PostgreSQL + Redis
```

### 2. Start the API

```bash
cp platform/apps/api/.env.example platform/apps/api/.env  # fill in OAuth secrets
cd platform
pnpm install
pnpm --filter api db:migrate
pnpm --filter api dev
# → http://localhost:3001
```

### 3. Start the web app

```bash
cp platform/apps/web/.env.local.example platform/apps/web/.env.local
pnpm --filter web dev
# → http://localhost:3000
```

### 4. Run the desktop agent

```bash
pip install -e ".[dev]"
PYTHONPATH=src python -m bumeet_agent.app
# Simulate without BLE hardware:
PYTHONPATH=src python -m bumeet_agent.app --simulate --scenario default
```

Simulation scenarios: `default` (call enters and ends), `bounce` (rapid busy/free), `camera-only`.

### 5. Flash the firmware

Open `firmware/coreink/coreink.ino` in Arduino IDE. Board: **M5Stack-CoreInk**. Libraries: M5Unified, NimBLE-Arduino, Preferences.

## Production

| Service | URL |
|---|---|
| Landing | https://bumeet.es |
| Dashboard | https://app.bumeet.es |
| API | https://api.bumeet.es |

## Architecture overview

```
[Door] ←BLE← [Desktop Agent] ←→ [API (Azure App Service)]
                                         ↕
                              [PostgreSQL + Redis (Azure)]
                                         ↕
                              [Web Dashboard (Azure SWA)]
```

The desktop agent detects microphone/camera usage via OS APIs and polls calendar integrations (Google, Outlook, Slack, Teams, Zoom, Webex). It pushes the presence state to the CoreInk display over BLE and reports it to the API for the web dashboard.

## CI / CD

| Workflow | Trigger | Description |
|---|---|---|
| `quality.yml` | PRs to `main` | lint, tsc, tests, firmware compile, terraform validate |
| `api-deploy.yml` | push to `main` | Build Docker image → push to ACR → deploy to App Service |
| `web-deploy.yml` | push to `main` | Deploy to Azure SWA (dev) |
| `web-deploy-prod.yml` | push to `main` | Deploy to Azure SWA (prod) |
| `terraform-apply.yml` | push to `main` | Terraform apply dev → prod (with environment approval) |
| `agent-release.yml` | version tag `v*.*.*` | Build + sign + release agent binaries |

## Security

See [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Proprietary — © BUMEET. All rights reserved.
