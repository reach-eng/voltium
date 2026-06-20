# Public Beta Runbook

This runbook is for operating Voltium during public beta on the laptop-only architecture.

## Daily operator checklist

1. Open Admin → Server Health.
2. Confirm PostgreSQL is running.
3. Confirm PM2 web and worker are online.
4. Confirm upload and backup folders are writable.
5. Confirm free disk space is above the configured threshold.
6. Confirm the last scheduled backup succeeded.
7. Review failed jobs and support tickets.
8. Review pending KYC, guarantor, deposit, pickup, and return queues.

## Before each release update

1. Put system into maintenance mode.
2. Create a manual backup.
3. Verify the backup.
4. Stop PM2 services.
5. Apply code update.
6. Run `npx prisma migrate deploy`.
7. Run `npm run build` and `npm run worker:build`.
8. Start PM2 services.
9. Run health checks.
10. Disable maintenance mode.

## Emergency rollback

1. Enable maintenance mode.
2. Stop PM2 worker.
3. Select the latest verified backup in Admin → Data Management → Restore.
4. Validate the backup.
5. Type `RESTORE VOLTIUM` to confirm.
6. Restore database and uploads.
7. Start worker.
8. Run Server Health.
9. Disable maintenance mode only after files and database are verified.

## Backup policy for beta

- Daily scheduled backup: enabled.
- Manual backup: before every release update.
- External drive backup: strongly recommended.
- Keep at least seven daily backups.
- Keep pre-restore backups until the release is stable.

## Incident levels

### Level 1 — warning

Examples: disk space warning, secondary drive unavailable, one failed notification job.

Action: resolve within the same day.

### Level 2 — degraded

Examples: failed scheduled backup, worker not running, uploads folder not writable.

Action: enable maintenance mode if rider operations are affected, fix immediately, then create manual backup.

### Level 3 — critical

Examples: database unavailable, restore failed, file access broken, security issue.

Action: enable maintenance mode, stop public beta access, restore from last verified backup if needed.
