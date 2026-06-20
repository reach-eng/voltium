# Data Management

Voltium's Data Management system handles local backups, restores, and storage monitoring — all stored on laptop-local disk with no cloud dependencies.

## Access

Only **SUPER_ADMIN** role can:
- Create, delete, verify, and download backups
- Manage backup schedule
- Initiate restore operations
- Change system settings

## Admin UI

Navigate to **Admin → Data Management**.

### Tabs

| Tab | Description |
|-----|-------------|
| **Overview** | Dashboard with backup stats, schedule status, disk usage |
| **Backups** | List, create, verify, download, delete backups |
| **Schedule** | Configure automatic backup schedule and retention |
| **Restore** | Select, validate, and execute restore |
| **Storage** | Detailed disk usage breakdown |
| **Backup Logs** | Audit log filtered to backup/restore events |
| **Disaster Recovery** | Health checks and maintenance mode toggle |

## Backup Types

| Type | Description |
|------|-------------|
| `MANUAL` | Created on-demand by admin |
| `SCHEDULED` | Created automatically by scheduled job |
| `PRE_RESTORE` | Created automatically before a restore operation |

## Backup Contents

Each backup creates a folder containing:

```
backup_20260616_020000/
├── database.sql          # PostgreSQL dump (pg_dump, no shell)
├── uploads.zip           # Uploaded files archive (PowerShell or tar)
├── manifest.json         # Backup metadata
├── checksums.sha256      # SHA-256 checksums for integrity verification
└── backup.log            # Backup operation log
```

## Backup Schedule

Configured via **Admin → Data Management → Schedule**:

- Enable/disable automatic backups
- Daily / Weekly / Monthly frequency
- Time and timezone
- Primary and optional secondary backup locations
- Retention policy (keep N daily/weekly/monthly/manual)
- Minimum free disk space safety check

Default schedule: **Daily at 02:00 AM Asia/Kolkata**

## Retention

Retention is applied automatically after each scheduled backup:

- **Daily**: Keep last 7 (configurable)
- **Weekly**: Keep last 4 (configurable)
- **Monthly**: Keep last 6 (configurable)
- **Manual**: Unlimited by default (configurable)

Retention **deletes both**:
1. The backup folder from disk (primary + secondary)
2. The BackupJob database row

## Restore Workflow

The restore process follows a safe multi-step workflow:

1. **Select** — Choose a completed backup
2. **Validate** — System verifies manifest, checksums, and file integrity
3. **Confirm** — Warning shown, admin must confirm
4. **Execute** — System:
   - Creates a pre-restore backup
   - Sets maintenance mode
   - Acquires backup lock
   - Restores database via psql
   - Restores uploaded files
   - Runs database migrations
   - Releases lock and maintenance mode

## Backup/Restore Lock

A **backup lock** prevents race conditions:

- `backupLock = RESTORE_RUNNING` is set when restore starts
- Scheduled backups skip if lock is set
- Manual backups fail if lock is set
- Lock is released on restore completion (success or failure)

## Storage Monitoring

The Storage tab shows:
- Database size (from PostgreSQL)
- Uploads folder size
- Backups folder size
- Logs folder size
- Free / total disk space
- Largest file categories
- Warnings for low disk space
