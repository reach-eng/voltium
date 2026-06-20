# Voltium 10/10 Architecture Acceptance Standard

This document is the source of truth for the production architecture.

## Target

Voltium production is a laptop-only deployment for app data. The laptop is the compute, database host, file server, worker host, backup machine, and admin console host.

Allowed runtime components:

- Next.js Admin/API on the laptop
- Flutter rider app connecting to the laptop API
- PostgreSQL running on `localhost:5432`
- Local uploads under `LOCAL_STORAGE_ROOT`
- Local backups under `BACKUP_ROOT`
- Optional external-drive backup copy under `BACKUP_SECONDARY_ROOT`
- Node worker process using PostgreSQL OutboxEvent
- PM2 process manager
- Cloudflare Tunnel only for routing traffic to the laptop

Forbidden for production app data:

- Docker and Docker service containers
- Neon, Supabase, Railway, or any managed production database
- Upstash Redis or any cloud queue/cache for app state
- GCS, S3, R2, or any cloud object storage for uploads/backups
- Sentry or any cloud error-tracking service

## Required architecture invariants

1. `DATA_MODE=local_laptop` in production.
2. `DATABASE_URL` points to `localhost:5432`.
3. `STORAGE_PROVIDER=local`.
4. All uploads are written below `LOCAL_STORAGE_ROOT`.
5. All backup folders are written below `BACKUP_ROOT`; optional secondary copies go to `BACKUP_SECONDARY_ROOT`.
6. File read/write routes block path traversal and never serve from `public/`.
7. Jobs use PostgreSQL `OutboxEvent`; no Redis dependency.
8. Rate limiting uses local PostgreSQL in production, with in-memory fallback only for development.
9. Admin-managed settings are stored in `SystemSetting`; boot secrets remain in `.env.production.local`.
10. Backup/restore uses a lock to prevent concurrent backup/restore operations.
11. Restore creates a pre-restore backup and enables maintenance mode.
12. Maintenance mode changes are `SUPER_ADMIN` only.
13. No real `.env`, uploads, backups, reports, screenshots, or build artifacts are exported.

## Production acceptance test

The architecture reaches 10/10 only when this full flow passes on the laptop:

1. Start PostgreSQL, web, worker, and tunnel.
2. Run migrations and seed.
3. Upload KYC/payment/pickup/return files.
4. Create manual backup from Admin.
5. Verify and download backup from Admin.
6. Run scheduled backup now.
7. Restore a backup from Admin.
8. Confirm database records and uploaded files work after restore.
9. Restart the laptop and confirm all processes recover.
