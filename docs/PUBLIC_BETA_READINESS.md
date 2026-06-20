# Voltium Public Beta Readiness

Voltium public beta is allowed only when the product is safe for a small controlled group of real riders and admins while still operating as a laptop-only deployment.

## Public beta architecture

- Production app data stays on the laptop.
- PostgreSQL runs locally on `localhost:5432`.
- Uploaded files are stored under `LOCAL_STORAGE_ROOT`.
- Backups are stored under `BACKUP_ROOT`, with optional external-drive copy via `BACKUP_SECONDARY_ROOT`.
- Web and worker processes run under PM2.
- Cloudflare Tunnel may route traffic, but must not store app data.
- Firebase Auth and Firebase Cloud Messaging (FCM) are permitted for authentication and push notifications.
- Docker, cloud databases, cloud file storage (such as Google Cloud Storage or S3), cloud queues, and cloud error tracking are not part of public beta.

## Public beta entry gates

All static gates must pass:

```bash
cd web
npm run check:no-docker
npm run check:no-cloud-data
npm run check:laptop-service
npm run check:public-beta
```

All build gates must pass on the beta laptop:

```bash
cd web
npm ci
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run typecheck
npm run build
npm run worker:build
```

Flutter gates must pass:

```bash
cd flutter
flutter pub get
flutter analyze
flutter test
```

## Required live smoke test

Before inviting beta users, complete this sequence on the laptop:

1. Start PostgreSQL.
2. Run `npm run service:preflight`.
3. Run `npm run service:build`.
4. Run `npm run service:start`.
5. Confirm Admin → Server Health is green.
6. Upload a test KYC file.
7. Read the file as an authorized admin.
8. Create a manual backup from Admin → Data Management.
9. Verify the backup.
10. Run scheduled backup now.
11. Restore from a backup.
12. Confirm database records and uploaded files still open.
13. Reboot the laptop.
14. Confirm PostgreSQL, PM2 web, PM2 worker, and tunnel recover.

## Beta limits

Recommended beta limit:

- 5–20 real riders initially.
- One SUPER_ADMIN owner.
- One or two operations admins.
- No automated destructive cleanup until restore is proven.
- Daily backup enabled at 02:00 Asia/Kolkata.
- Manual backup before every beta release update.

## Exit criteria from public beta

Do not move beyond public beta until:

- Fresh-laptop restore test passes.
- Backup verification passes for at least seven consecutive daily backups.
- No failed worker jobs remain unresolved.
- No unauthorized file read/write is possible.
- Admin audit logs cover all sensitive actions.
- Support and incident workflows are tested with real operators.
