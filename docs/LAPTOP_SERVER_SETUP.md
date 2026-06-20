# Laptop Server Setup Guide

How to set up a fresh Windows laptop to run Voltium in production.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22.x | Runtime |
| PostgreSQL | 16.x | Database |
| Git | Latest | Version control |
| Cloudflare Tunnel | Latest | Public HTTPS routing |
| PM2 | Latest | Process manager |

## 1. Install PostgreSQL

1. Download from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run installer — include `pgAdmin` and **Command Line Tools**
3. Set password for `postgres` user (save it securely)
4. Port: `5432` (default)

Verify:
```powershell
psql --version
pg_dump --version
```

## 2. Create Database User and Database

```powershell
psql -U postgres
CREATE USER voltium_user WITH PASSWORD 'strong_password';
CREATE DATABASE voltium_prod OWNER voltium_user;
GRANT ALL PRIVILEGES ON DATABASE voltium_prod TO voltium_user;
\c voltium_prod
GRANT ALL ON SCHEMA public TO voltium_user;
\q
```

## 3. Clone and Install

```powershell
git clone https://github.com/reach-eng/voltium.git
cd voltium/web
npm ci --legacy-peer-deps
```

## 4. Configure Environment

Create `web/.env.production.local`:

```env
NODE_ENV=production
APP_ENV=production
DATA_MODE=local_laptop

DATABASE_URL="postgresql://voltium_user:strong_password@localhost:5432/voltium_prod"
DIRECT_URL="postgresql://voltium_user:strong_password@localhost:5432/voltium_prod"

STORAGE_PROVIDER=local

ENABLE_TEST_OTP=false
ENABLE_DEV_ADMIN_LOGIN=false

SESSION_SECRET="generate-a-random-64-char-string"
JWT_SECRET="generate-another-random-64-char-string"
```

Generate secrets:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 5. Run Database Migrations

```powershell
cd web
npx prisma migrate deploy
```

## 6. Create Data Directories

```powershell
mkdir D:\VoltiumServer\data\uploads
mkdir D:\VoltiumServer\data\backups
mkdir D:\VoltiumServer\data\backups\manual
mkdir D:\VoltiumServer\data\backups\scheduled
mkdir D:\VoltiumServer\data\backups\pre_restore
mkdir D:\VoltiumServer\logs
```

## 7. Start with PM2

```powershell
npm install -g pm2
pm2 start .zscripts/start.sh --name voltium
pm2 save
pm2 startup
```

## 8. Set Up Cloudflare Tunnel

1. Install `cloudflared` from [developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
2. Authenticate:
   ```powershell
   cloudflared tunnel login
   ```
3. Create tunnel:
   ```powershell
   cloudflared tunnel create voltium
   ```
4. Configure `Caddyfile` or point tunnel to `localhost:8081`
5. Run as service:
   ```powershell
   cloudflared service install
   ```

## 9. Verify

```powershell
curl http://localhost:8081/api/health/db
# → {"status":"healthy","database":"connected"}

curl http://localhost:8081/api/health/worker
# → {"status":"healthy","worker":"running"}
```

## 10. Run Manual Backup

```powershell
.\scripts\backup-local.ps1 -BackupDir "D:\VoltiumServer\data\backups\manual"
```

## Post-Setup Checklist

- [ ] PostgreSQL running and reachable
- [ ] Migrations applied
- [ ] Data directories created
- [ ] Admin user created (seed script)
- [ ] PM2 starts on boot
- [ ] Cloudflare tunnel running
- [ ] Manual backup works
- [ ] Scheduled backup configured
- [ ] External USB backup drive connected (optional)
