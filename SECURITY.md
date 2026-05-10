# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by email to **security@bumeet.es**.

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- (Optional) Suggested fix

We will acknowledge receipt within **48 hours** and aim to provide an initial assessment within **5 business days**.

## Disclosure Policy

We follow responsible disclosure:

1. You report the issue privately.
2. We investigate and develop a fix.
3. We coordinate a disclosure date (typically ≤ 90 days from report).
4. We publish a fix and credit the reporter (if desired).

## Scope

In scope:
- `api.bumeet.es` — authentication, authorization, data exposure
- `app.bumeet.es` — XSS, CSRF, session issues
- Desktop agent — local privilege escalation, insecure BLE handling
- Firmware — BLE authentication bypass

Out of scope:
- Issues requiring physical access to the device after BLE bonding
- Social engineering
- Denial of service (rate limiting is a mitigation, not a guarantee)
- Vulnerabilities in third-party services (Google, Microsoft, Slack, Zoom, Webex)

## Supported Versions

| Component | Supported |
|---|---|
| API (latest on `main`) | ✅ |
| Web (latest on `main`) | ✅ |
| Agent (latest release) | ✅ |
| Firmware (latest release) | ✅ |
| Older pinned versions | ❌ |

## Security Hardening

- API uses HTTPS only, HSTS with preload
- BLE characteristic requires authenticated write (bonded devices only)
- Agent does not record audio or video — only detects device usage state
- All API-to-agent communication uses bearer tokens scoped per installation
- Secrets stored in Azure Key Vault, not in environment variables where possible
