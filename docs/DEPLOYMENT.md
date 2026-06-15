# Voltium Deployment Guide

> Deployment instructions for local development, staging, and production environments.

---

## Environment Overview

| Environment | Database     | Storage         | Purpose                  |
| ----------- | ------------ | --------------- | ------------------------ |
| **local**   | SQLite       | Local files     | Development & testing    |
| **staging** | PostgreSQL   | Local + GCS     | Integration testing      |
| **production** | PostgreSQL | GCS bucket      | Live operations          |

---

## 1. Local Development

### Prerequisites
- Node.js 20+
- Bun (recommended package manager)
- VS Code (recommended)

### Setup

```bash
cp .env.template .env
# Edit .env — set JWT_SECRET to a random string
bun install
bun run db:push
bun run dev  # starts on port 8081
```

### Running Workers

```bash
# In a separate terminal:
npx tsx src/server/workers/index.ts
```

### Running Tests

```bash
bun run test:unit        # Unit tests
bun run test:api         # API integration tests
bun run test:contracts   # Contract consistency tests
```

---

## 2. Staging Environment

### Prerequisites
- Docker & Docker Compose
- Access to staging secrets

### Setup

```bash
# 1. Set up environment
export STAGING_DB_PASSWORD=<secure-password>
export JWT_SECRET=<jwt-secret>
export CRON_SECRET=<cron-secret>

# 2. Build and start
docker compose -f docker-compose.staging.yml build
docker compose -f docker-compose.staging.yml up -d

# 3. Run database migrations (automatic in docker-compose)
# Migrations run via the 'migrate' service before web starts.
# Manual: docker compose -f docker-compose.staging.yml run --rm migrate

# 4. Verify health
curl http://localhost:8082/api/health
curl http://localhost:8082/api/health/db
curl http://localhost:8082/api/health/worker
curl http://localhost:8082/api/health/storage
```

### CI/CD

Staging deployments are triggered by pushes to the `develop` branch.
See `.github/workflows/ci-cd.yml` for details.

---

## 3. Production Environment

### Prerequisites
- Docker & Docker Compose
- Production secrets (see below)
- Domain name with DNS configured
- SSL certificates (auto-managed by Caddy)

### Required Secrets

```bash
export PROD_DB_PASSWORD=<strong-random-password>
export REDIS_PASSWORD=<strong-random-password>
export JWT_SECRET=<random-64-char-hex-string>
export CRON_SECRET=<random-32-char-string>
export SENTRY_DSN=<sentry-dsn>  # Optional but recommended
export SMS_PROVIDER=msg91       # Or your SMS provider
export STORAGE_PROVIDER=gcs     # Or 'local' for file storage
export GCS_BUCKET_NAME=voltfleet-uploads
export SITE_URL=https://voltium.example.com
```

### Deployment Steps

```bash
# 1. Build production images
docker compose -f docker-compose.production.yml build

# 2. Start services
docker compose -f docker-compose.production.yml up -d

# 3. Run database migrations (automatic in docker-compose)
# Migrations run via the 'migrate' service before web starts.
# Manual: docker compose -f docker-compose.production.yml run --rm migrate

# 4. Verify health
curl https://voltium.example.com/api/health
curl https://voltium.example.com/api/health/db
curl https://voltium.example.com/api/health/worker
curl https://voltium.example.com/api/health/storage

# 5. Check monitoring dashboard
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://voltium.example.com/api/monitoring/metrics
```

### Rollback

```bash
# Rollback to previous version
docker compose -f docker-compose.production.yml down
git checkout <previous-tag>
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d

# Database rollback (if needed)
docker compose -f docker-compose.production.yml exec db \
  psql -U voltfleet_prod -c "DROP DATABASE voltfleet_prod;"
docker compose -f docker-compose.production.yml exec db \
  psql -U voltfleet_prod -c "CREATE DATABASE voltfleet_prod;"
# Restore from backup
docker compose -f docker-compose.production.yml exec db \
  psql -U voltfleet_prod voltfleet_prod < /backups/latest.sql
```

---

## 4. CI/CD Pipeline

### Pipeline Structure

```text
Push to main/develop
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
│ Build               │ ← next build
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Tests               │ ← unit tests (vitest)
└─────────────────────┘
    │
    ├──► (PR) Deploy Preview  → Vercel preview URL
    │
    └──► (main) Deploy Production → Vercel production
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

### Daily Operations

```bash
# Backup (should run daily via cron)
bash scripts/migrate.sh backup

# Check status
bash scripts/migrate.sh status

# Full SQLite → PostgreSQL migration
bash scripts/migrate.sh to-pg
```

### Backup Strategy

- **Daily**: Automated SQLite backups via cron
- **Pre-deployment**: Manual backup before any production deploy
- **PostgreSQL**: Use `pg_dump` for production DB backups

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
- [ ] Redis credentials set
- [ ] SMS provider configured (not mock)
- [ ] Storage provider configured (not local)
- [ ] CORS/middleware configured for production domain
- [ ] `VOLTIUM_DEV_BYPASS_RATELIMIT` NOT set
- [ ] `LOG_LEVEL` set to `info` (not `debug`)
- [ ] SSL certificates in place
- [ ] Database backed up
- [ ] Workers configured for background job processing
- [ ] Cron jobs configured for reconciliation and cleanup
