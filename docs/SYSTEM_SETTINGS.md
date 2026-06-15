# System Settings

Voltium uses a **hybrid configuration model** — sensitive/infrastructure settings stay in environment variables, while runtime-configurable settings are stored in the database and editable from the Admin panel.

## Boot Config (`.env.production.local`)

These are set once during server setup and are **not editable** from Admin:

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | Environment (`production`) |
| `APP_ENV` | App environment (`production`) |
| `DATA_MODE` | Data storage mode (`local_laptop`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | PostgreSQL direct connection (for migrations) |
| `STORAGE_PROVIDER` | Storage backend (`local`) |
| `JWT_SECRET` | JWT signing secret |
| `SESSION_SECRET` | Admin session secret |

## Admin-Editable Settings (Database `SystemSetting` table)

These are managed via **Admin → System Settings**:

### Application URLs
| Key | Description |
|-----|-------------|
| `APP_PUBLIC_URL` | Public-facing app URL (e.g., `https://voltium.example.com`) |
| `API_BASE_URL` | API base URL for riders |

### Local Storage
| Key | Description |
|-----|-------------|
| `LOCAL_STORAGE_ROOT` | Root directory for uploaded files |

### Backup Configuration
| Key | Description |
|-----|-------------|
| `BACKUP_ROOT` | Primary backup directory |
| `BACKUP_SECONDARY_ROOT` | Optional external/USB backup directory |
| `BACKUP_FREQUENCY` | Backup frequency (DAILY/WEEKLY/MONTHLY) |
| `BACKUP_TIME_OF_DAY` | Scheduled backup time (HH:mm) |
| `BACKUP_TIMEZONE` | Timezone for scheduled backups |
| `BACKUP_KEEP_DAILY` | Number of daily backups to retain |
| `BACKUP_KEEP_WEEKLY` | Number of weekly backups to retain |
| `BACKUP_KEEP_MONTHLY` | Number of monthly backups to retain |
| `BACKUP_KEEP_MANUAL` | Manual backup retention (empty = unlimited) |
| `BACKUP_MINIMUM_FREE_DISK_GB` | Minimum free disk space to allow backup |

## Read-Only Status Display

The Admin System Settings page shows these read-only indicators:

| Indicator | Source |
|-----------|--------|
| `NODE_ENV` | Environment variable |
| `APP_ENV` | Environment variable |
| `DATA_MODE` | Environment variable |
| `STORAGE_PROVIDER` | Environment variable |
| `DATABASE_HOST` | Parsed from DATABASE_URL (localhost/remote) |
| `ENABLE_TEST_OTP` | Test OTP toggle status |
| `ENABLE_DEV_ADMIN_LOGIN` | Dev admin login toggle status |
| Secrets configured status | Configured / Not configured |

## Seeding Default Settings

Run this SQL after initial migration to seed default system settings:

```sql
INSERT INTO system_settings (key, value, "valueType", category, "isSecret", "isEditable", description)
VALUES
  ('APP_PUBLIC_URL', 'http://localhost:8081', 'URL', 'APP_URLS', false, true, 'Public-facing application URL'),
  ('API_BASE_URL', 'http://localhost:8081', 'URL', 'APP_URLS', false, true, 'API base URL for rider app'),
  ('LOCAL_STORAGE_ROOT', 'D:/VoltiumServer/data/uploads', 'PATH', 'STORAGE', false, true, 'Root directory for uploaded files'),
  ('BACKUP_ROOT', 'D:/VoltiumServer/data/backups', 'PATH', 'BACKUP', false, true, 'Primary backup storage directory'),
  ('BACKUP_SECONDARY_ROOT', '', 'PATH', 'BACKUP', false, true, 'Optional secondary backup location (USB drive)'),
  ('BACKUP_FREQUENCY', 'DAILY', 'STRING', 'BACKUP', false, true, 'Backup frequency: DAILY, WEEKLY, or MONTHLY'),
  ('BACKUP_TIME_OF_DAY', '02:00', 'STRING', 'BACKUP', false, true, 'Scheduled backup time in HH:mm format'),
  ('BACKUP_TIMEZONE', 'Asia/Kolkata', 'STRING', 'BACKUP', false, true, 'Timezone for scheduled backups'),
  ('BACKUP_KEEP_DAILY', '7', 'NUMBER', 'BACKUP', false, true, 'Number of daily backups to retain'),
  ('BACKUP_KEEP_WEEKLY', '4', 'NUMBER', 'BACKUP', false, true, 'Number of weekly backups to retain'),
  ('BACKUP_KEEP_MONTHLY', '6', 'NUMBER', 'BACKUP', false, true, 'Number of monthly backups to retain'),
  ('BACKUP_KEEP_MANUAL', '', 'NUMBER', 'BACKUP', false, true, 'Manual backup retention (empty = unlimited)'),
  ('BACKUP_MINIMUM_FREE_DISK_GB', '20', 'NUMBER', 'BACKUP', false, true, 'Minimum free disk space in GB for backup to run');
```
