# Voltium — PM2 Production Process Manager Setup

> Use PM2 to run Voltium as a persistent background service on your laptop or server.
> PM2 handles automatic restarts, log management, and process monitoring without Docker.

---

## Why PM2?

| Need                  | PM2 Solution                              |
|-----------------------|-------------------------------------------|
| Auto-start on reboot  | `pm2 startup` + `pm2 save`                |
| Log rotation          | `pm2-logrotate` or built-in log limit     |
| Graceful shutdown     | SIGINT/SIGTERM forwarding                 |
| Process monitoring    | `pm2 monit`, `pm2 status`                 |
| Zero-downtime reload  | `pm2 reload all`                          |

**PM2 replaces Docker Compose** in the Voltium architecture. No containers needed.

---

## 1. Install PM2

```bash
# Global install (recommended)
npm install -g pm2

# Verify
pm2 --version
```

---

## 2. Configuration

Create `ecosystem.config.cjs` in the project root (`D:\voltfleet`):

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'voltium-web',
      cwd: './web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 8081 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: '8081',
      },
      env_file: '.env.local',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-web-error.log',
      out_file: './logs/pm2-web-out.log',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 10000,
    },
    {
      name: 'voltium-worker',
      cwd: './web',
      script: 'dist/workers.js',
      env: {
        NODE_ENV: 'production',
      },
      env_file: '.env.local',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-worker-error.log',
      out_file: './logs/pm2-worker-out.log',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 10000,
    },
  ],
};
```

> **Note:** The `env_file` field points to `.env.local`. PM2 reads environment variables from this file automatically.

---

## 3. Build First

Before starting PM2, you **must** build the web app and worker. The PM2 config references `dist/workers.js` for the worker and Next.js production build for the web app — neither exists until you build.

```bash
cd web

# Install dependencies
npm ci --legacy-peer-deps

# Generate Prisma client
npx prisma generate

# Apply database migrations
npx prisma migrate deploy

# Build the Next.js web app (creates .next/standalone)
npm run build

# Build the worker (creates dist/workers.js)
npm run worker:build

cd ..
```

> **Important:** Re-run the build steps whenever you pull new code or update dependencies. The worker will crash at startup if `dist/workers.js` is missing.

---

## 4. Start Services

```bash
# Start all apps defined in ecosystem.config.cjs
pm2 start ecosystem.config.cjs

# Or start individually
pm2 start ecosystem.config.cjs --only voltium-web
pm2 start ecosystem.config.cjs --only voltium-worker

# Check status
pm2 status

# View logs (live tail)
pm2 logs voltium-web
pm2 logs voltium-worker --lines 50
```

---

## 5. Common Operations

```bash
# Restart
pm2 restart voltium-web

# Stop
pm2 stop voltium-web

# Delete from PM2
pm2 delete voltium-web

# Reload all (zero-downtime)
pm2 reload all

# Monitor CPU/memory
pm2 monit

# Show detailed info
pm2 show voltium-web
```

---

## 6. Startup on Boot

```bash
# Generate and configure startup script
pm2 startup

# Save current process list
pm2 save

# To disable: pm2 unstartup
```

On Windows, `pm2 startup` requires Administrator PowerShell:

```powershell
# Run as Administrator
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

---

## 7. Log Management

PM2 handles logs without `tee`:

```bash
# View last 100 lines
pm2 logs voltium-web --lines 100

# Flush logs
pm2 flush

# Rotate logs (install pm2-logrotate)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 5
```

---

## 8. CI/CD Integration

In deployment scripts, use PM2 for graceful updates:

```bash
#!/bin/bash
# deploy.sh — example

cd /path/to/voltium

# Pull latest
git pull origin main

# Build
cd web
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run worker:build
cd ..

# Reload (zero-downtime)
pm2 reload ecosystem.config.cjs
```

---

## 9. Troubleshooting

| Problem                          | Solution                                    |
|----------------------------------|---------------------------------------------|
| PM2 not found after install      | Run `npm install -g pm2` as admin           |
| App crashes immediately          | Check logs: `pm2 logs voltium-web --lines 50` |
| Port 8081 already in use         | Kill existing process or change PORT        |
| Environment variables not loaded | Verify `.env.local` exists and is correct   |
| Windows startup not working      | Use `pm2-windows-startup` (see section 6)   |
