# Voltium Laptop Service Architecture — 10/10 Target

Voltium production runs as a **native laptop service stack**. The laptop is the compute node, database node, file-storage node, backup node, and recovery node.

This document is the source of truth for operating Voltium without Docker and without cloud app-data services.

---

## 1. Service map

```text
Windows laptop
├─ Windows Service: PostgreSQL
│  ├─ host: localhost
│  ├─ port: 5432
│  └─ database: voltium_prod
│
├─ PM2 process: voltium-web
│  ├─ Next.js Admin/API
│  ├─ port: 8081
│  └─ health: /api/health
│
├─ PM2 process: voltium-worker
│  ├─ PostgreSQL OutboxEvent processor
│  ├─ scheduled backup runner
│  ├─ notification/reminder jobs
│  └─ cleanup jobs
│
├─ Local filesystem data
│  ├─ D:/VoltiumServer/data/uploads
│  ├─ D:/VoltiumServer/data/backups
│  ├─ D:/VoltiumServer/data/logs
│  └─ D:/VoltiumServer/data/restore-temp
│
└─ Optional routing service
   └─ Cloudflare Tunnel / static IP / LAN-only route
```

Cloudflare Tunnel is allowed only as a traffic router. It must not store app data.

---

## 2. Non-negotiable rules

Production must not use:

```text
Docker
managed cloud database
cloud object storage
cloud queue
Sentry/cloud error tracking
Upstash Redis
GCS/S3/R2/Neon/Supabase/Railway for app data
```

Production must use:

```text
local PostgreSQL on localhost:5432
local file uploads
local backup folders
PM2 for web + worker process supervision
Admin Data Management for backup/restore
Admin Server Health for runtime status
```

---

## 3. Required local folders

Create these folders before production start:

```text
D:/VoltiumServer/
├─ data/
│  ├─ uploads/
│  │  ├─ kyc/
│  │  ├─ guarantors/
│  │  ├─ payment-proofs/
│  │  ├─ pickup-photos/
│  │  ├─ return-photos/
│  │  └─ support-attachments/
│  ├─ backups/
│  │  ├─ daily/
│  │  ├─ weekly/
│  │  ├─ monthly/
│  │  ├─ manual/
│  │  └─ pre-restore/
│  ├─ logs/
│  └─ restore-temp/
└─ secure/
```

Optional external backup drive:

```text
E:/VoltiumBackups/
```

---

## 4. Environment contract

`web/.env.production.local` is required on the laptop but must never be committed or exported.

Required values:

```env
NODE_ENV=production
APP_ENV=production
DATA_MODE=local_laptop
STORAGE_PROVIDER=local
DATABASE_URL="postgresql://voltium_user:strong_password@localhost:5432/voltium_prod"
DIRECT_URL="postgresql://voltium_user:strong_password@localhost:5432/voltium_prod"
ENABLE_TEST_OTP=false
ENABLE_DEV_ADMIN_LOGIN=false
SESSION_SECRET="long-random-secret"
JWT_SECRET="long-random-secret"
```

Admin-editable runtime settings live in `SystemSetting`:

```text
APP_PUBLIC_URL
API_BASE_URL
LOCAL_STORAGE_ROOT
BACKUP_ROOT
BACKUP_SECONDARY_ROOT
BACKUP_MINIMUM_FREE_DISK_GB
MAINTENANCE_MODE
MAINTENANCE_MESSAGE
```

---

## 5. Service lifecycle commands

Use the single service manager:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 init-folders
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 preflight
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 build
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 start
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 status
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 health
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 restart
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 logs
```

Startup integration:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 install-startup
```

---

## 6. Boot sequence

After laptop reboot, the target sequence is:

```text
1. Windows starts PostgreSQL service.
2. PM2 startup resurrects voltium-web and voltium-worker.
3. Optional tunnel service starts.
4. Admin → Server Health shows all services green.
5. Worker heartbeat/outbox checks are healthy.
6. Scheduled backup remains enabled with nextRunAt set.
```

---

## 7. Health checks

Admin health must reflect real APIs:

```text
/api/health
/api/health/db
/api/health/storage
/api/health/worker
```

The laptop-service smoke test checks these endpoints:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/laptop-service-smoke.ps1 -BaseUrl http://localhost:8081
```

---

## 8. Service failure handling

| Failure | Expected behavior |
|---|---|
| web crash | PM2 restarts `voltium-web` |
| worker crash | PM2 restarts `voltium-worker` |
| PostgreSQL stopped | health goes unhealthy; admin actions fail safely |
| upload folder unavailable | file upload fails safely; Server Health warns |
| backup folder unavailable | scheduled backup fails safely and logs/audits failure |
| disk space low | backup skipped or fails safely before writing |
| restore running | scheduled backup is paused/skipped |

---

## 9. Production acceptance

Laptop service architecture is 10/10 only when this passes on the real laptop:

```text
[ ] PostgreSQL service auto-starts
[ ] localhost:5432 is listening
[ ] pg_dump and psql are available
[ ] PM2 starts voltium-web
[ ] PM2 starts voltium-worker
[ ] local upload folder is writable
[ ] local backup folder is writable
[ ] optional external backup drive is detected
[ ] Admin Server Health shows real green status
[ ] manual backup works
[ ] scheduled backup works
[ ] restore works
[ ] file read works after restore
[ ] laptop reboot recovery works
```
