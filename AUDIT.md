# BUMEET — Auditoría profunda y plan de remediación

Auditoría multi-componente (firmware · agente · API · web · infra) con verificación
de cada hallazgo. 100 hallazgos confirmados; este documento resume lo **aplicado y
verificado**, lo **diferido con justificación**, y los **pasos obligatorios antes de
desplegar**.

## ⚠️ ACCIÓN REQUERIDA antes de desplegar (nuevas variables de entorno / secretos)

Varios fixes de seguridad hacen que la app **falle de forma ruidosa** si faltan estos
valores (eso es intencionado — ya no hay secretos "fallback"):

| Variable | Dónde | Por qué |
|---|---|---|
| `JWT_SECRET` (≥32 chars) | API (App Service) | La API se niega a arrancar sin él (antes usaba `fallback-secret`). |
| `INTERNAL_AUTH_SECRET` | **API _y_ Web** (mismo valor) | Protege `POST /auth/oauth-login` (era account-takeover). La web lo envía en `x-internal-secret`. Si no coincide, el login social falla. |
| `ENCRYPTION_KEY` | API | Cifra los tokens OAuth en reposo (AES-256-GCM). Sin él se guardan en claro (con aviso en logs). |
| `AUTH_SECRET` (o `NEXTAUTH_SECRET`) | Web | NextAuth falla en prod sin él (antes `fallback-secret`). |
| `CORS_ORIGINS` (opc.) | API | Lista blanca exacta de orígenes (sustituye al regex de comodín). Por defecto usa `FRONTEND_URL`. |
| `ENABLE_DEMO_LOGIN` (opc.) | API | `GET /auth/demo-login` ahora devuelve 404 salvo que valga `"true"`. No ponerlo en prod. |
| `DB_KEEPALIVE` (opc.) | API | `"false"` desactiva el ping anti-pausa de Postgres. |

**Migración Prisma**: se añadieron índices (`Session.userId`, `IntegrationAccount.userId`,
`CalendarEvent[userId,startAt]`/`[integrationId]`, `MessageToDisplay[userId,createdAt]`).
Ejecuta `pnpm --filter api db:migrate` (o `prisma migrate deploy`) contra la BD.

**Rotar secretos expuestos**: el GitHub PAT `ghp_…` y el token de Cloudflare `cfut_…`
aparecían en texto plano en `~/.claude/settings.json`. Revócalos y emite nuevos.

## Estado por componente (todo verificado)

| Componente | Aplicados | Verificación |
|---|---|---|
| Firmware (ESP32) | 12/12 | `arduino-cli compile` CoreInk + Core2 (huge_app) ✅ |
| Agente (Python) | 20/20 | ruff ✅ · mypy ✅ · pytest 5/5 ✅ |
| API (NestJS) | 24/27 (+3 diferidos) | `nest build` ✅ · jest 5/5 ✅ |
| Web (Next.js) | 14/16 (+2 diferidos) | vitest 8/8 ✅ · `next build` ✅ |
| Infra (Terraform/CI) | 11/25 aplicados, 14 diferidos | `terraform validate` dev+prod ✅ · `fmt` ✅ |

### Lo más destacado aplicado
- **Firmware**: Core2 reescrito a event-driven con light sleep + atenuación de backlight
  (de horas a semanas de batería); CoreInk: race en `gCurrentMsg`, advertising centralizado,
  watchdog.
- **Agente**: crash crítico (`logger` indefinido) corregido; loop BLE event-driven (sin
  busy-wake de 1 Hz); cámara cada 15 s (≈7,5× menos subprocesos); detector de Windows
  implementado; token cifrado en disco (0600 + escritura atómica); HTTPS forzado.
- **API**: 2 críticos (account-takeover de `oauth-login` → secreto interno; JWT sin fallback
  + fail-fast); **CSRF de OAuth state** en los 6 proveedores; **cifrado AES-256-GCM** de tokens
  en reposo (middleware Prisma); throttler global, helmet, CORS allowlist; logout/cambio de
  contraseña por `sessionId` + revocación de sesiones; refresh proactivo de Zoom; índices.
- **Web**: ruta `debug-env` eliminada (fuga de entorno); secreto fallback de NextAuth
  eliminado; polls de Slack 1 s→20 s y live-status con gating de visibilidad; Suspense;
  efectos de calendario sin re-fetch/race; toggle accesible; `lang="es"`; reduced-motion.
- **Infra**: KV purge-protection (prod) + sin `Purge` para CI; retención de backups (prod 35d)
  + auto-grow; **monitorización** (App Insights + Log Analytics + alerta 5xx + action group);
  state SA sin acceso anónimo; gate de entorno en deploy de prod; `-lock-timeout`; gitleaks
  rango completo; workflow de **detección de drift**.

## Diferidos con justificación (requieren revisión / despliegue por fases)

No se aplicaron a ciegas porque empeorarían algo medible, cambian un contrato entre
componentes, o tocan red/auth que el pipeline **auto-aplica** (riesgo de caída sin un
`terraform plan` revisado y rollout por fases):

**API**: cache de live-status (dañaría la latencia → mejor SSE/Redis), cache de sesión en
JWT strategy (debilitaría el logout), `pollSecret` de pairing (cambio de contrato con el
agente), Slack→calendarEvent (decisión de producto), PKCE (complemento del state CSRF ya hecho).

**Web**: mover el `apiToken` a llamadas server-side proxy (refactor multi-fichero grande);
CSP estricta con nonce (requiere middleware de Next, no el JSON estático de SWA — una
eliminación naíf de `unsafe-inline` rompería la hidratación).

**Infra (alto valor, alto riesgo — aplicar con plan revisado)**:
- Postgres en red privada (VNet) + quitar firewall `0.0.0.0` (hoy es "solo Azure", no
  Internet público).
- ACR `admin_enabled=false` + pull por managed identity, y App Service de Node→Docker
  (acoplados; romperían el deploy si se hacen a medias).
- HA Zone-Redundant en Postgres + zonas en App Service (coste + cambio create-time/migración).
- OIDC federado para el CI (sustituir `ARM_CLIENT_SECRET`; requiere crear la credencial
  federada primero).
- `terraform-plan` con secretos en PRs no confiables → gating por entorno.
- Pin de GitHub Actions por SHA (Dependabot ya configurado).
- Front Door/CDN delante de API y releases; RBAC + network deny en Key Vault.

Detalle completo de cada hallazgo (archivo, línea, fix, verificación) en el backlog generado
durante la auditoría.
