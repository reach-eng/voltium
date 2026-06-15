# Voltium Deployment Guide

> Deployment instructions for local development, staging, and production environments.
> **Voltium does not use Docker.** All services use managed infrastructure or native Node.js process commands.

---

## Environment Overview

| Environment    | Database               | Storage         | Purpose                  |
| -------------- | ---------------------- | --------------- | ------------------------ |
| **local**      | Managed PostgreSQL     | Local files     | Development & testing    |
| **staging**    | Managed PostgreSQL     | Local + GCS     | Integration testing      |
| **production** | Managed PostgreSQL     | GCS bucket      | Live operations          |

Recommended managed databases: [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway PostgreSQL](https://railway.app).

---

## 1. Local Development

### Prerequisites
- Node.js 20+
- npm or Bun
- Managed PostgreSQL database (Neon / Supabase / Railway free tier)

### Setup

```bash
cd web
cp ../.env.local.example .env.local
# Edit .env.local — set DATABASE_URL to your managed PostgreSQL connection string
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

## 2. Staging Environment

### Prerequisites
- Managed PostgreSQL staging database (separate from production)
- Staging secrets configured on your hosting platform

### Environment Variables

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/voltium_staging?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/voltium_staging?sslmode=require"
APP_ENV="staging"
NODE_ENV="production"
JWT_SECRET="<secure-random-64-char-string>"
CRON_SECRET="<secure-random-32-char-string>"
SMS_PROVIDER="mock"
STORAGE_PROVIDER="local"
```

### Deploy to Render (Recommended)

**Web service:**
```
Build command: cd web && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
Start command: cd web && npm run start
```

**Worker service:**
```
Build command: cd web && npm ci && npx prisma generate && npm run worker:build
Start command: cd web && npm run worker:start
```

### Verify Health

```bash
curl https://your-staging-url/api/health
curl https://your-staging-url/api/health/db
curl https://your-staging-url/api/health/worker
curl https://your-staging-url/api/health/storage
```

---

## 3. Production Environment

### Prerequisites
- Managed PostgreSQL production database
- Production secrets configured in your hosting platform
- Domain name with DNS configured

### Required Secrets

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/voltium_prod?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/voltium_prod?sslmode=require"
APP_ENV="production"
NODE_ENV="production"
JWT_SECRET="<strong-random-64-char-hex-string>"
CRON_SECRET="<strong-random-32-char-string>"
SENTRY_DSN="<sentry-dsn>"          # Optional but recommended
SMS_PROVIDER="msg91"               # Or your SMS provider
STORAGE_PROVIDER="gcs"             # Or 'local' for file storage
GCS_BUCKET_NAME="voltium-uploads"
NEXT_PUBLIC_APP_URL="https://voltium.example.com"
```

### Deploy to Render / Railway

**Web service:**
```
Build command: cd web && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
Start command: cd web && npm run start
```

**Worker service (separate service):**
```
Build command: cd web && npm ci && npx prisma generate && npm run worker:build
Start command: cd web && npm run worker:start
```

> Both services share the same `DATABASE_URL` environment variable pointing to your managed PostgreSQL.

### Deploy to Vercel (Web only)

Vercel handles the web/API process. For the background worker, use a separate Render or Railway service.

```bash
# Deploy via Vercel CLI
vercel --prod
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
    ├──► (PR) Deploy Preview  → Vercel preview URL
    │
    └──► (main) Deploy Production → Vercel/Render production
```

### GitHub Actions Workflows

| Workflow File | Trigger | Purpose |
|--------------|---------|---------|
| `ci-cd.yml` | Push to main/develop, PRs | Lint, typecheck, build, test, deploy |
| `daily-smoke-tests.yml` | Daily schedule | Smoke tests on production |
| `e2e-windows.yml` | Push, PRs | Playwright E2E tests on Windows |
| `flutter-ci-cd.yml` | Push to main | Flutter analyze + test |
| `flutter-e2e-manual.yml` | Manual trigger | Flutter E2E on emulator |

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

- **Daily**: Automated backups via your managed PostgreSQL provider (Neon / Supabase auto-backup)
- **Pre-deployment**: Use your provider's point-in-time restore or `pg_dump` before any production deploy
- **PostgreSQL**: `pg_dump <DATABASE_URL> > backup.sql`

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
- [ ] Sentry DSN configured
- [ ] Managed PostgreSQL provisioned (not SQLite, not Docker)
- [ ] `prisma migrate deploy` run against production database
- [ ] SMS provider configured (not mock)
- [ ] Storage provider configured (not local)
- [ ] CORS/middleware configured for production domain
- [ ] `VOLTIUM_DEV_BYPASS_RATELIMIT` NOT set
- [ ] `LOG_LEVEL` set to `info` (not `debug`)
- [ ] SSL certificates in place (managed by Caddy or your hosting platform)
- [ ] Database backed up
- [ ] Worker service running separately (not inside the Next.js process)
- [ ] Cron jobs configured for reconciliation and cleanup
- [ ] No Docker files or commands present (`bash scripts/check-no-docker.sh`)
