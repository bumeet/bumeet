# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What BUMEET is

An e-ink presence display for office doors. A door-mounted ESP32 device shows **FREE / BUSY / UPCOMING** based on calendar events, Slack/Zoom/Teams/Webex calls, and live microphone/camera activity — automatically, with no manual interaction. The system spans four codebases in this monorepo plus infrastructure:

```
[Door display] ←BLE← [Desktop agent] ──HTTP──▶ [API] ──▶ [PostgreSQL + Redis]
   (firmware/)        (src/bumeet_agent/)   (platform/apps/api/)      ▲
                                                                      │
                                              [Web dashboard] ────────┘
                                            (platform/apps/web/)
```

| Path | Stack | Role |
|---|---|---|
| `firmware/` | Arduino / C++ (ESP32, NimBLE) | BLE GATT **server** on the door display |
| `src/bumeet_agent/` | Python 3.11+ (asyncio, bleak) | Desktop agent: detects calls, computes presence, pushes over BLE |
| `platform/apps/api/` | NestJS 10 + Prisma + PostgreSQL | Integrations, OAuth, calendar sync, unified presence |
| `platform/apps/web/` | Next.js 14 (App Router) + next-auth v5 | Landing site + authenticated dashboard |
| `infra/` | Terraform on Azure | App Service, PostgreSQL, Redis, ACR, SWA, Key Vault |

The presence value originates in **two places** that must agree: the agent's local hardware state machine and the API's `getLiveStatus()` aggregator. The BLE payload string (`"FREE"`, `"BUSY"`, `"BUSY · Slack"`, `"UPCOMING · Google Calendar · starts 15:00"`) is the contract rendered verbatim by the firmware.

## Commands

The Node platform (`api` + `web`) is a pnpm workspace rooted at `platform/`. Run pnpm commands from `platform/`. Python and firmware live at the repo root.

### Platform (API + Web)
```bash
cd platform
docker compose up -d                 # PostgreSQL + Redis (required for API)
pnpm install
pnpm --filter api exec prisma generate   # required before tsc/test/build of api
pnpm --filter api db:migrate         # prisma migrate dev
pnpm --filter api dev                # API on :3001
pnpm --filter web dev                # Web on :3000
pnpm dev                             # both, via concurrently

# Quality gates (mirror CI exactly)
pnpm --filter web lint
pnpm --filter web exec tsc --noEmit
pnpm --filter web test               # vitest run
pnpm --filter api lint
pnpm --filter api exec tsc --noEmit
pnpm --filter api test               # jest

# Single test
pnpm --filter api exec jest src/auth/auth.service.spec.ts -t "wrong password"
pnpm --filter web exec vitest run src/components/auth/LoginForm.test.tsx

# Prisma helpers
pnpm --filter api db:studio          # prisma studio
pnpm --filter api db:seed
```

### Python agent (from repo root)
```bash
pip install -e ".[dev]"
PYTHONPATH=src python -m bumeet_agent.app            # real run (needs BLE hardware)
PYTHONPATH=src python -m bumeet_agent.app --simulate --scenario default   # no hardware/BLE
#   scenarios: default | bounce | camera-only ; --simulate-ui opens a Tkinter visualiser
ruff check . && ruff format --check .
mypy src/bumeet_agent                  # strict mode
pytest                                 # testpaths = tests/unit
pytest tests/unit/test_state_machine.py::PresenceStateMachineTests::test_snapshot_with_microphone_transitions_to_busy
```

### Firmware (Arduino)
```bash
# Board: M5Stack-CoreInk. Libraries: M5Unified, NimBLE-Arduino, Preferences.
arduino-cli compile --fqbn m5stack:esp32:m5stack_coreink:PartitionScheme=huge_app firmware/coreink/coreink.ino
```
`firmware/core2/core2.ino` is the same protocol for the LCD-based M5Stack-Core2.

### Terraform
```bash
terraform fmt -check -recursive infra/
tflint --recursive --chdir=infra/
# per env: cd infra/envs/{dev,prod} && terraform init -backend=false && terraform validate
```

## Architecture deep-dives

### Desktop agent (`src/bumeet_agent/`)
Layered, dependency-injected, fully async. Wiring lives in `bootstrap.py` (`AgentContainer` / `build_container()`); entry point is `app.py::run()`.

- **`detection/`** — `HardwareDetector` ABC (`base.py`) with `macos.py` (CoreAudio mic polling every ~2s + `ioreg` camera polling every ~15s) and `windows.py` (registry `CapabilityAccessManager\ConsentStore`). `app.py::_build_detector()` picks per `sys.platform`. Each emits `HardwareSnapshot`.
- **`domain/state_machine.py`** — `PresenceStateMachine.apply_snapshot()` maps snapshots to `OccupancyStatus` (only **FREE/BUSY** locally: BUSY iff camera or mic in use). UPCOMING does **not** exist locally — it comes from the API.
- **`detection/service.py`** — `AgentOrchestrator` is the hub: snapshot → state machine → `_push_combined_state()`. **Hardware BUSY always wins**; otherwise it polls the API `/agent/live-status` (~5s) and uses the API's richer payload (`"BUSY · Slack"`, `"UPCOMING · …"`). Also holds `build_simulation_steps()`.
- **`ble/`** — `client.py::BleClient` keeps a persistent connection with a 20s keepalive resend (works around macOS's ~45s idle drop) and reconnect. `protocol.py` encodes payloads as `hex` or `text` per config. `simulated.py` provides `FakeBleakClient` for tests.
- **`events/bus.py`** — in-process async pub/sub (`AsyncEventBus`) decouples detection, BLE, API, and UI.
- **`config.py`** — pydantic `AppSettings` (`BleSettings` / `ApiSettings` / `RuntimeSettings`) persisted as JSON in `~/.config/bumeet-agent/` via `SettingsStore`.

Tests in `tests/unit/` mock BLE with `build_fake_client_factory()` and drive `SimulatedHardwareDetector`; `test_simulation_flow.py` asserts the full detector→orchestrator→BLE payload sequence.

### API (`platform/apps/api/`)
NestJS modules under `src/` (imported by `app.module.ts`): `auth`, `users`, `integrations`, `calendar`, `messages`, `agent`, `device`, `pairing`.

- **Presence is computed by `integrations.service.ts::getLiveStatus()`** — a priority-ordered merge: in-call (Slack/Teams/Zoom/Webex) → Teams Busy → live mic state → calendar event → Free. It returns `{ busy, upcoming, payload, source, endAt }`; the agent and web both consume it. Special cases include a 5-min pre-meeting UPCOMING window and a grace period when the mic is released early.
- **Integration provider pattern** — each provider service (`google-calendar.service.ts`, `microsoft-calendar.service.ts`, `slack.service.ts`, `teams.service.ts`, `zoom.service.ts`, `webex.service.ts`, `apple-calendar.service.ts`) exposes `getAuthUrl` / `handleCallback` / `syncEvents` / `getPresence`. A scheduler re-syncs active integrations every ~5 min. OAuth CSRF state is in `oauth-state.service.ts`.
- **Two auth surfaces.** Web/user routes use JWT (`JwtStrategy`, `JwtAuthGuard`) backed by `Session` rows (7-day TTL, argon2 password hashing). The desktop agent authenticates with a long-lived per-user token via the `x-agent-key` header on `/agent/*` routes. Web sign-in calls the trusted `/auth/oauth-login` endpoint guarded by `x-internal-secret`.
- **Agent ↔ API contract**: `POST /agent/presence` (mic heartbeat ~every 25s; treated stale after 30s), `GET /agent/config` (polling + BLE device/UUID config), `GET /agent/live-status`. Pairing uses an ephemeral 6-char code (`pairing.service.ts`) exchanged for the agent token.
- **Prisma** (`prisma/schema.prisma`): `User`, `Session`, `IntegrationAccount` (unique on userId+provider+providerAccountId, up to 5/provider), `CalendarEvent` (unique on integrationId+externalId), `MessageToDisplay`.
- `main.ts` validates required env (`JWT_SECRET` ≥32 chars, `DATABASE_URL`, `CORS_ORIGINS`/`FRONTEND_URL`), enables helmet, a global `ValidationPipe` (whitelist + transform), and a global `ThrottlerGuard` (100 req/60s). DTOs use `class-validator`. Note: `ioredis` is a dependency but OAuth state and the sync scheduler are currently in-memory (single-instance only).
- Jest config: `jest.config.ts`, `*.spec.ts` colocated in `src/`. Mock `PrismaService` via `useValue`.

### Web (`platform/apps/web/`)
- App Router under `src/app/` with route groups `(auth)` and `(dashboard)`; the landing/corporate site vs app is toggled by `NEXT_PUBLIC_SITE_MODE`.
- Auth: `src/lib/auth.ts` (next-auth v5) — Credentials + Google + Microsoft Entra + Slack; the JWT callback exchanges OAuth identity for an API token via `/auth/oauth-login` and stores `apiToken` on the session.
- API access: `src/lib/api.ts` typed `api.get/post/patch/delete` wrapper (Bearer token; base `NEXT_PUBLIC_API_URL` default `http://localhost:3001/api/v1`). React Query is configured in `src/app/providers.tsx` (30s stale time). `src/lib/useBusyStatus.ts` watches presence and auto-posts status messages.
- UI: Radix primitives + Tailwind + `class-variance-authority`; `cn()` helper in `src/lib/utils.ts`. Tests: Vitest + Testing Library (`vitest.config.ts`, `src/test/setup.ts`).

### Firmware (`firmware/coreink/coreink.ino`) — the BLE contract
NimBLE GATT **server** that the agent writes to. UUIDs must match `BleSettings` on the agent:
- Service `a1b2c3d4-e5f6-7890-abcd-ef1234567891`
- Status characteristic `a1b2c3d4-e5f6-7890-abcd-ef1234567892` (WRITE / WRITE_NR, unauthenticated, ≤64 bytes UTF-8)
- Battery service `0x180F` / characteristic `0x2A19` (READ/NOTIFY)

It parses the UTF-8 payload (`FREE` / `BUSY` / `UPCOMING`, optional ` · source · detail`) and renders via `renderFree/renderBusy/renderUpcoming`. Power-managed (CPU throttling, ~1s BLE interval), persists last message to NVS, and auto-clears BUSY after 5 min without a connection.

### Infra (`infra/`)
`infra/modules/` (app_service, container_registry, key_vault, postgresql, redis, static_web_app, releases_storage) instantiated per environment in `infra/envs/dev` and `infra/envs/prod`. Dev uses budget SKUs (B1 / B_Standard_B1ms / Basic Redis); prod uses HA SKUs (P1v3 / GP_Standard_D2s_v3, 35-day backups, Standard Redis). Naming: `{app}-{env}-{resource}`; RG `rg-bumeet-{env}`. App Service health check: `/api/v1/health`. State in Azure blob storage.

## Conventions & workflow

- **Branching**: `main` is protected. Feature: `feat/<desc>`, fix: `fix/<desc>`, phase: `fase-N/<area>`. PRs target `main` and must pass the `quality` check; keep PRs ≤400 changed lines.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `ci:`, `docs:`, `refactor:`). One logical change per commit.
- **TypeScript**: strict — no `any`, no `as unknown`.
- **Python**: ruff (`E,F,W,I,N,UP,B,C4,SIM`, line length 100) + `ruff format`; mypy strict on `src/bumeet_agent`; type annotations on all public functions.
- **Firmware**: clang-format style; document each ISR/callback with its calling context (BLE task vs main task).
- **Terraform**: `terraform fmt -recursive`; document module outputs.

## CI/CD (`.github/workflows/`)
- `quality.yml` — PR gate, **path-filtered** so only changed areas run (web / api / agent / firmware / terraform). Note the api job runs `prisma generate` before tsc/test — do the same locally.
- `api-deploy.yml` / `web-deploy.yml` / `web-deploy-prod.yml` — build + deploy to Azure (App Service via ACR image; SWA for web) on push to `main`.
- `terraform-plan.yml` / `terraform-apply.yml` / `terraform-drift.yml`, plus `dev-resources-start/stop.yml` for scheduled dev scaling.
- `agent-release.yml` — on `v*.*.*` tags, builds signed agent binaries via `pyinstaller bumeet-agent.spec`.
- `codeql.yml` + `gitleaks.yml` — security scanning.
