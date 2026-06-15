# Backup & Restore Procedures

## Backup Types

| Type | When | Retention |
|------|------|-----------|
| **Manual** | Admin-triggered via UI | Unlimited (configurable) |
| **Scheduled** | Automatic (daily/weekly/monthly) | Configurable (default: 7 daily, 4 weekly, 6 monthly) |
| **Pre-restore** | Automatic before any restore | Deleted after restore completes |

## Backup Contents

Each backup creates a folder:

```
D:\VoltiumServer\data\backups\[type]\backup_20260616_020000\
├── database.sql           # PostgreSQL dump (pg_dump)
├── uploads.zip            # Uploaded files archive
├── manifest.json          # Metadata (backupId, type, timestamp, version)
├── checksums.sha256       # SHA-256 checksums for verification
└── backup.log             # Operation log
```

## Creating a Backup

### Via Admin UI

1. Go to **Admin → Data Management → Backups**
2. Click **Create Backup**
3. Monitor progress in the backups table

### Via PowerShell Script

```powershell
.\scripts\backup-local.ps1 -BackupDir "D:\VoltiumServer\data\backups\manual"
```

With secondary copy:
```powershell
$env:BACKUP_SECONDARY_ROOT = "E:\VoltiumBackups"
.\scripts\backup-local.ps1 -BackupDir "D:\VoltiumServer\data\backups\manual"
```

### Via API

```bash
curl -X POST http://localhost:8081/api/admin/data-management/backups \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=..." \
  -d '{"type":"MANUAL"}'
```

## Verifying a Backup

### Via Admin UI

1. Go to **Admin → Data Management → Backups**
2. Click the shield icon on any completed backup
3. Result shows valid/invalid with details

### Via API

```bash
curl -X POST http://localhost:8081/api/admin/data-management/backups/{id}/verify \
  -H "Cookie: admin_session=..."
```

Verification checks:
- Backup directory exists
- Database dump file exists
- Uploads archive exists
- Manifest file exists
- SHA-256 checksums match

## Downloading a Backup

### Via Admin UI

1. Go to **Admin → Data Management → Backups**
2. Click the download icon on any completed backup
3. Archive is generated and downloaded

### Via API

```bash
curl -o backup.tar.gz http://localhost:8081/api/admin/data-management/backups/{id}/download \
  -H "Cookie: admin_session=..."
```

## Restoring a Backup

### Via Admin UI

1. Go to **Admin → Data Management → Restore**
2. Select a completed backup from the list
3. Click **Validate & Continue**
4. Review validation results
5. Click **Continue to Restore**
6. Read the warning and click **Start Restore**

### Restore Process

When restore starts, the system:

1. Creates a **pre-restore backup** of current state
2. Validates the backup again
3. Sets **maintenance mode** (app becomes read-only)
4. Acquires **backup lock** (prevents scheduled backups)
5. Restores **database** via `psql`
6. Restores **uploaded files** from archive
7. Runs **database migrations** (`prisma migrate deploy`)
8. Releases **maintenance mode** and **backup lock**
9. Logs to **audit trail**

### Via PowerShell Script

```powershell
.\scripts\restore-local.ps1 -BackupPath "D:\VoltiumServer\data\backups\manual\backup_20260616_020000"
```

With options:
```powershell
# Skip pre-restore backup (if you already have one)
.\scripts\restore-local.ps1 -BackupPath "..." -SkipPreRestoreBackup

# Skip migrations (if restoring to same schema version)
.\scripts\restore-local.ps1 -BackupPath "..." -SkipMigrations
```

## Scheduled Backup Configuration

Configured via **Admin → Data Management → Schedule**:

| Setting | Default | Description |
|---------|---------|-------------|
| Enabled | Yes | Enable/disable automatic backup |
| Frequency | DAILY | DAILY/WEEKLY/MONTHLY |
| Time | 02:00 | Backup time (HH:mm) |
| Timezone | Asia/Kolkata | Backup timezone |
| Primary path | — | Main backup storage folder |
| Secondary path | — | Optional USB/external drive |
| Keep daily | 7 | Daily backups to retain |
| Keep weekly | 4 | Weekly backups to retain |
| Keep monthly | 6 | Monthly backups to retain |
| Keep manual | unlimited | Manual backup retention |
| Min free disk | 20 GB | Safety threshold |

## Backup Locks

A **backup lock** prevents race conditions between backup and restore:

| Scenario | Lock State | Behavior |
|----------|------------|----------|
| Manual backup during restore | `RESTORE_RUNNING` | Fails with error |
| Scheduled backup during restore | `RESTORE_RUNNING` | Skips run |
| Restore during backup | `BACKUP_RUNNING` | Fails with error |
| Concurrent backups | First acquires lock | Second fails |

## Retention Cleanup

Retention is applied automatically after each scheduled backup:

1. Finds old `BackupJob` records beyond retention window
2. Deletes **primary backup folder** from disk
3. Deletes **secondary backup folder** if configured
4. Deletes **database record**
5. Writes **audit log**

## Disaster Recovery

If the laptop is lost:

1. Install PostgreSQL on new machine (see [LAPTOP_SERVER_SETUP.md](./LAPTOP_SERVER_SETUP.md))
2. Restore latest backup from external drive
3. Run `.\scripts\restore-local.ps1 -BackupPath "E:\backups\latest"`
4. Verify app health
5. Update Cloudflare Tunnel DNS

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Backup fails "disk space" | Low disk | Free space or increase threshold |
| Backup fails "pg_dump" | PostgreSQL tools not in PATH | Verify `pg_dump --version` |
| Restore fails "checksum" | Corrupted backup | Use different backup |
| Restore fails "not found" | Backup path invalid | Check backup exists on disk |
| Scheduled backup skipped | Restore in progress | Wait for restore to complete |
