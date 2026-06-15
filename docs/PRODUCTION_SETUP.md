# Production Setup Guide

This document is the definitive step-by-step guide for deploying Voltium to a production server.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 LTS | Required for the web app |
| npm | ≥ 10 | Bundled with Node.js 20 |
| PostgreSQL | 15+ | Managed by `scripts/start-local-postgres.ps1` or system service |
| PM2 | Latest | `npm install -g pm2` |
| Caddy | 2.x | [caddyserver.com/docs/install](https://caddyserver.com/docs/install) |
| Flutter | 3.24.0 | Only needed for mobile build |

---

## 2. Environment Variables

Copy `.env.production.example` to `.env.production.local` and fill in all values:

```bash
cp .env.production.example .env.production.local
```

### Required variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Minimum 32 characters. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SESSION_SECRET` | Minimum 32 characters. Same generation command as above. |
| `NODE_ENV` | Set to `production` |
| `APP_ENV` | Set to `production` |
| `NEXT_PUBLIC_APP_URL` | Public URL, e.g. `https://voltium.com` |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins |

### Optional variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUDIT_RETENTION_DAYS` | `90` | Days to keep audit log records |
| `SENTRY_DSN` | — | Sentry DSN for error tracking (deferred) |
| `TWILIO_SID` / `TWILIO_TOKEN` / `TWILIO_FROM` | — | SMS provider credentials (deferred) |

> **Security reminder**: Never commit `.env.production.local` to version control.

---

## 3. Database Setup

### Using the local PostgreSQL script (Windows)

```powershell
# First-time setup (initialises cluster + starts server)
pwsh -File scripts/start-local-postgres.ps1

# Subsequent runs
pwsh -File scripts/start-local-postgres.ps1 -Action start

# Stop the server
pwsh -File scripts/start-local-postgres.ps1 -Action stop

# Check status
pwsh -File scripts/start-local-postgres.ps1 -Action status
```

### Apply migrations

```bash
npm run db:deploy
```

---

## 4. Web App Build & Start

```bash
# In the web/ directory
npm ci
npm run build
```

---

## 5. PM2 Process Management

The `ecosystem.config.js` at the repo root manages both the web app and worker. For production it runs in **cluster mode with max instances** (one per CPU core).

```bash
# Start all services
pm2 start ecosystem.config.js --env production

# Check status
pm2 status

# Reload after deployment (zero-downtime)
git pull && npm ci --prefix web && npm run build --prefix web && pm2 reload ecosystem.config.js

# Save process list for auto-start on reboot
pm2 save
pm2 startup
```

---

## 6. Caddy Reverse Proxy

`Caddyfile.prod` configures TLS with Let's Encrypt and HTTP→HTTPS redirection automatically.

1. Edit `Caddyfile.prod` and replace `you@example.com` with your actual email address.
2. Ensure DNS for `voltium.com` points to this server.
3. Open ports 80 and 443 in your firewall.

```bash
# Start Caddy with the production config
caddy run --config Caddyfile.prod

# Or run as a background daemon
caddy start --config Caddyfile.prod
```

---

## 7. Audit-Trail Cleanup

The audit-trail cleanup cron job runs daily at **02:00 UTC** and deletes records older than `AUDIT_RETENTION_DAYS` (default 90).

The service is located at `web/src/server/modules/audit/cleanup.service.ts`. It is initialised automatically when the server starts. No additional configuration is required beyond setting `AUDIT_RETENTION_DAYS` in your environment file.

---

## 8. Flutter Mobile Build

```bash
# From the flutter/ directory
bash flutter/build_release.sh https://api.voltium.com
```

The script:
- Cleans the build
- Runs `flutter pub get`
- Builds an **unsigned APK** with obfuscation enabled
- Places the APK at `flutter/build/app/outputs/flutter-apk/app-release.apk`

For signing, refer to the [Flutter docs on app signing](https://docs.flutter.dev/deployment/android#signing-the-app).

---

## 9. Health & Metrics Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Returns `{ status: "ok" \| "unhealthy", db: boolean, redis: true }` |
| `GET /api/metrics` | Prometheus-compatible metrics |

Use `/api/health` as the upstream health check target in Caddy (already configured in `Caddyfile.prod`).

---

## 10. CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) runs:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test:unit`

Ensure `SESSION_SECRET` and `JWT_SECRET` are set as repository secrets in GitHub.

---

## 11. Security Checklist

- [ ] `JWT_SECRET` is ≥ 32 characters
- [ ] `SESSION_SECRET` is ≥ 32 characters
- [ ] `ENABLE_TEST_OTP=false` in production
- [ ] `ENABLE_DEV_ADMIN_LOGIN=false` in production
- [ ] TLS enabled via Caddy
- [ ] Firewall blocks direct access to port 8081 (only Caddy should reach it)
- [ ] Audit log retention configured (`AUDIT_RETENTION_DAYS`)
- [ ] PM2 auto-start configured (`pm2 save && pm2 startup`)
