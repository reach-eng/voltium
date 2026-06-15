# Voltium Deployment Guide

> Deployment instructions for the Voltium platform.
> **Voltium runs entirely on a local workstation.** Database, files, and backups stay on local disk.
> Public access is provided via Cloudflare Tunnel (routing only — no data storage).

---

## Environment Overview

| Environment    | Database           | Storage         | Public Access                     |
| -------------- | ------------------ | --------------- | --------------------------------- |
| **local**      | Local PostgreSQL   | Local disk      | Cloudflare Tunnel (optional)      |
| **staging**    | Local PostgreSQL   | Local disk      | Cloudflare Tunnel                 |
| **production** | Local PostgreSQL   | Local disk      | Cloudflare Tunnel                 |

All data stays on the laptop. Cloudflare Tunnel provides HTTPS routing without storing app data.
Optional external USB drive for backup redundancy.

---

## 1. Local Development

### Prerequisites
- Node.js 20+
- npm or Bun
- PostgreSQL installed locally (default port 5432)

### Setup

```bash
cd web
cp ../.env.local.example .env.local
# Edit .env.local — set DATABASE_URL to your local PostgreSQL connection string
# Set JWT_SECRET to a random string (min 32 chars)

npm install
npx prisma generate
npx prisma migrate dev
npm run dev  # starts on port 8081
```

### Running Workers

```bash
# In a separate terminal:
cd web
npm run worker:dev
```

### Running Tests

```bash
cd web
npm run test:unit        # Unit tests
npm run test:contracts   # Contract consistency tests
```

---

## 2. Staging & Production (Laptop Mode)

### Prerequisites
- PostgreSQL running locally on the laptop
- Cloudflare Tunnel (`cloudflared`) installed for public access

### Environment Variables

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voltium"
APP_ENV="production"
NODE_ENV="production"
JWT_SECRET="<secure-random-64-char-string>"
CRON_SECRET="<secure-random-32-char-string>"
SMS_PROVIDER="mock"
# Local storage (data management)
DATA_MANAGEMENT_ENABLED=true
BACKUP_ROOT="D:/VoltiumServer/data/backups"
BACKUP_SECONDARY_ROOT="E:/VoltiumBackups"
```

### Run with PM2 (Recommended)

```bash
# Start both web server and worker using PM2
npm install -g pm2
pm2 start npm --name "voltium-web" -- run start
pm2 start npm --name "voltium-worker" -- run worker:start
pm2 save
pm2 startup  # auto-start on boot
```

### Set Up Cloudflare Tunnel

```bash
# Install cloudflared
# Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# Authenticate and create tunnel
cloudflared tunnel login
cloudflared tunnel create voltium

# Configure tunnel (edit ~/.cloudflared/config.yml)
# tunnel: <tunnel-uuid>
# credentials-file: /root/.cloudflared/<tunnel-uuid>.json
# ingress:
#   - hostname: voltium.example.com
#     service: http://localhost:8081
#   - service: http_status:404

# Start tunnel
cloudflared tunnel run voltium

# Configure DNS
cloudflared tunnel route dns voltium voltium.example.com
```

### Verify Health

```bash
curl http://localhost:8081/api/health
curl http://localhost:8081/api/health/db
curl http://localhost:8081/api/health/worker
curl http://localhost:8081/api/health/storage
```

### Database Migrations (Production)

Always use `migrate deploy` — never `db push` — in production:

```bash
cd web
npx prisma migrate deploy
```

### Rollback

```bash
# Revert to previous migration
cd web
npx prisma migrate resolve --rolled-back "<migration-name>"
npx prisma migrate deploy
```

---

## 4. CI/CD Pipeline

### Pipeline Structure

```text
Push to main/develop
    │
    ▼
┌─────────────────────┐
│ Secret Scan         │ ← Gitleaks
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ No-Docker Check     │ ← scripts/check-no-docker.sh
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Lint & Typecheck    │ ← ESLint, Prettier, tsc --noEmit
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Prisma Check        │ ← prisma generate + prisma migrate status
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Build               │ ← next build + worker:build
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Tests               │ ← unit tests (vitest) + contract tests
└─────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────┐
│ Manual Deploy (on laptop)                        │
│ git pull → npm ci → npm run build → pm2 restart  │
│ Verify: cloudflared tunnel list                  │
└──────────────────────────────────────────────────┘
```

### GitHub Actions Workflows

| Workflow File | Trigger | Purpose |
|--------------|---------|---------|
| `ci-cd.yml` | Push to main/develop, PRs | Lint, typecheck, build, test |
| `daily-smoke-tests.yml` | Daily schedule | Smoke tests on production |
| `e2e-windows.yml` | Push, PRs | Playwright E2E tests on Windows |
| `flutter-ci-cd.yml` | Push to main | Flutter analyze + test |
| `flutter-e2e-manual.yml` | Manual trigger | Flutter E2E on emulator |

Deployment is done manually on the laptop: pull latest, build, restart PM2 processes, and verify the Cloudflare Tunnel is active.

---

## 5. Database Migrations

### Development

```bash
cd web

# Create a new migration after schema changes
npx prisma migrate dev --name describe_change

# Apply all pending migrations
npx prisma migrate dev

# Reset database (loses data — dev only)
npx prisma migrate reset
```

### Staging / Production

```bash
cd web

# Apply pending migrations safely (preserves data)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Validate schema
npx prisma validate
```

> **Never use `prisma db push` in staging or production.** Use `prisma migrate deploy` only.

### Backup Strategy

- **Daily**: `pg_dump DATABASE_URL > backups/voltium_$(date +%Y-%m-%d).sql`
- **External drive**: Optionally copy backups to external USB drive for redundancy
- **Retention**: Keep 7 daily backups locally, 30 daily on external drive
- **Pre-deployment**: Always backup before running migrations

---

## 6. Monitoring & Observability

### Health Checks

- `GET /api/health` — Basic health check (DB, Redis, disk)
- `GET /api/health?detailed=true` — Detailed health with latencies
- `GET /api/health/db` — Database connectivity, pending migrations, table count
- `GET /api/health/worker` — Worker liveness (outbox pending/failed/stuck)
- `GET /api/health/storage` — Storage provider connectivity

### Metrics

- `GET /api/monitoring/metrics` — APM metrics, counts, reconciliation status
  (Requires `Authorization: Bearer <CRON_SECRET>` or admin session)

### Logging

- All logs are JSON-structured with correlation IDs
- PII is automatically masked (phone, email, aadhaar, PAN)
- Log level is configurable via `LOG_LEVEL` env var

### Error Tracking

- Sentry is configured via `SENTRY_DSN` env var
- Errors are logged locally even without Sentry
- Security events are logged to both the logger and `AuditLog` table

---

## 7. Environment Checklist

### Pre-Production Checklist

- [ ] All secrets set (JWT_SECRET, CRON_SECRET, DB passwords)
- [ ] Sentry DSN configured (optional)
- [ ] Local PostgreSQL running
- [ ] `prisma migrate deploy` run against database
- [ ] SMS provider configured (not mock)
- [ ] PM2 processes running (web + worker)
- [ ] Cloudflare Tunnel configured and verified
- [ ] `VOLTIUM_DEV_BYPASS_RATELIMIT` NOT set
- [ ] `LOG_LEVEL` set to `info` (not `debug`)
- [ ] Caddy/TLS in place for local HTTPS
- [ ] Database backed up
- [ ] Optional external USB drive mounted for backup redundancy
