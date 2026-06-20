# Voltium Laptop Service Runbook

## Daily check

```powershell
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 status
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 health
```

Then open:

```text
Admin → Server Health
Admin → Data Management → Overview
```

Expected:

```text
PostgreSQL: Running
Web: Online
Worker: Online
Upload path: Writable
Backup path: Writable
Last backup: Success
Next backup: Scheduled
Maintenance mode: Off
```

## Deploy update

```powershell
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 preflight
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 build
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 restart
powershell -ExecutionPolicy Bypass -File scripts/laptop-service-smoke.ps1 -BaseUrl http://localhost:8081
```

Before a production update, create a manual backup from:

```text
Admin → Data Management → Backups → Create Backup
```

## Emergency restart

```powershell
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 restart
powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 logs
```

## PostgreSQL not running

```powershell
Get-Service *postgres*
Start-Service postgresql-x64-16
Set-Service postgresql-x64-16 -StartupType Automatic
```

Use the exact service name shown by `Get-Service *postgres*`.

## PM2 process missing

```powershell
pm2 status
pm2 resurrect
pm2 start ecosystem.config.js
pm2 save
```

## Restore rehearsal

Run a restore rehearsal before production use and after every major schema change:

```text
1. Create manual backup from Admin.
2. Verify backup from Admin.
3. Restore into a test/staging local database if available.
4. Confirm rider records, wallet ledger, documents, and files open.
5. Record the restore test date in Data Management → Disaster Recovery.
```

## Never do this

```text
Do not run Docker.
Do not use cloud DB/storage/queue.
Do not store uploads under web/public.
Do not commit .env files.
Do not bypass backup before restore.
Do not delete PRE_RESTORE backups until a safe retention window has passed.
```
