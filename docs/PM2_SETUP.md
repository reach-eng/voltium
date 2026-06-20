# Voltium PM2 Production Setup

Voltium production runs from the committed `ecosystem.config.js` in the repository root. Do not create a separate `ecosystem.config.cjs`; keeping one PM2 file avoids drift between docs and deployment.

## Services

| PM2 app | Working directory | Script | Args | Memory restart | Logs |
| --- | --- | --- | --- | --- | --- |
| `voltium-web` | `web/` | `node_modules/next/dist/bin/next` | `start` | `1200M` | `$VOLTIUM_LOG_ROOT/voltium-web-{error,out}.log` |
| `voltium-worker` | `web/` | `dist/workers.js` | none | `768M` | `$VOLTIUM_LOG_ROOT/voltium-worker-{error,out}.log` |

`ecosystem.config.js` sets production-safe defaults:

- `NODE_ENV=production`
- `APP_ENV=production`
- `DATA_MODE=local_laptop`
- `STORAGE_PROVIDER=local`
- `PORT=8081` for `voltium-web`

PM2 does not natively support an `env_file` key in ecosystem files. Load secrets into the shell or process manager environment before starting PM2, or add explicit non-secret defaults to `ecosystem.config.js`.

## Build

Run this before starting or reloading PM2:

```bash
cd web
npm ci --legacy-peer-deps
npx prisma generate
npx prisma migrate deploy
npm run build
npm run worker:build
cd ..
```

## Start

```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs voltium-web --lines 100
pm2 logs voltium-worker --lines 100
pm2 save
```

## Restart

```bash
pm2 restart ecosystem.config.js
```

Use `pm2 reload ecosystem.config.js` only after confirming the worker tolerates reload semantics for the current release.

## Startup

Linux:

```bash
pm2 startup
pm2 save
```

Windows:

```powershell
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

## Log Root

By default, logs are created under:

- Windows: `D:/VoltiumServer/data/logs`
- Linux: `/opt/voltium/data/logs`

Override with:

```bash
VOLTIUM_LOG_ROOT=/path/to/logs pm2 start ecosystem.config.js
```
