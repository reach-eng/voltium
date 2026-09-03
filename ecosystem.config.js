// PM2 Ecosystem File — Voltium Laptop Service Mode
// ------------------------------------------------
// This file is intentionally Docker-free and cloud-data-free.
// It runs the two local production services on the laptop:
//   1. voltium-web    — Next.js Admin/API server
//   2. voltium-worker — local PostgreSQL-backed worker/outbox scheduler
//
// Start:    pm2 start ecosystem.config.js
// Status:   pm2 status
// Logs:     pm2 logs
// Restart:  pm2 restart ecosystem.config.js
// Save:     pm2 save
//
// Memory restart strategy (PR-69 / Audit Infra N2)
// -------------------------------------------------
// PM2 `max_memory_restart` is set per-app because the two services have
// very different memory profiles. Going over the cap triggers an
// auto-restart — so the cap must sit ABOVE the steady-state working set
// (avoid spurious restarts) and BELOW the OOM-kill threshold (avoid
// crashing the host). Values are tuned for a 16 GB laptop with the
// 4-core CPU / 100-conn PostgreSQL envelope; revisit if pool size or
// hardware changes.
//
//   voltium-web    : 1200M — Next.js + Prisma + 4 conns per cluster
//                    worker; under load a single cluster can reach
//                    ~1.1 GB RSS. Per-instance, not per-cluster-total.
//   voltium-worker : 1G    — single instance holding in-memory job
//                    state (outbox poller, retry queue, cron registry).
//                    Raised from 768M in PR-69 to give 256M of headroom
//                    for batch jobs without crossing into OOM territory
//                    (4GB host-kill territory is still ~4x away).
//
// Query timeout (PR-74 / Audit Infra N3)
// --------------------------------------
// `statement_timeout=60s` is set on the `DATABASE_URL` in `web/.env.example`.
// PostgreSQL will cancel any query that runs longer than 60s, releasing
// the connection back to the pool. This prevents a single runaway
// analytics query (e.g. `wallet-reconciliation`) from holding one of the
// 4 pool connections for minutes. Increase the value there (not here)
// if a legitimate query gets killed.

const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';
const projectRoot = __dirname;
const webCwd = path.join(projectRoot, 'web');
const serverRoot = process.env.VOLTIUM_SERVER_ROOT || (isWindows ? 'D:/VoltiumServer' : '/opt/voltium');
const logsDir = process.env.VOLTIUM_LOG_ROOT || path.join(serverRoot, 'data', 'logs');

fs.mkdirSync(logsDir, { recursive: true });

const npmCommand = isWindows ? 'npm.cmd' : 'npm';

const commonEnv = {
  NODE_ENV: 'production',
  APP_ENV: 'production',
  DATA_MODE: 'local_laptop',
  STORAGE_PROVIDER: 'local',
  VOLTIUM_SERVER_ROOT: serverRoot,
  VOLTIUM_LOG_ROOT: logsDir,
  // P1-8 (2026-08-05 legal/device audit): env.ts now hard-requires
  // INTERNAL_API_URL in production — internal health probes must stay on the
  // loopback instead of round-tripping through the public URL (Caddy/TLS).
  INTERNAL_API_URL: process.env.INTERNAL_API_URL || 'http://127.0.0.1:8081',
};

module.exports = {
  apps: [
    {
      name: 'voltium-web',
      cwd: webCwd,
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 'max',       // One per CPU core — real zero-downtime reload
      exec_mode: 'cluster',   // Use Node.js cluster module
      watch: false,
      env: {
        ...commonEnv,
        PORT: process.env.PORT || '8081',
        DATABASE_POOL_SIZE: process.env.DATABASE_POOL_SIZE || '4',
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '60s',          // Bumped from 10s — Next.js boot can be 8s on slow disk
      restart_delay: 30000,       // Bumped from 5s — allow slow boot to settle
      max_memory_restart: '1200M', // 1.2G — Next.js + Prisma + 4 conns per cluster worker (see header)
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: path.join(logsDir, 'voltium-web-error.log'),
      out_file: path.join(logsDir, 'voltium-web-out.log'),
      merge_logs: true,
      kill_timeout: 30000,        // Bumped from 10s — graceful shutdown of in-flight requests
      kill_signal: 'SIGINT',      // Graceful shutdown signal for Next.js
      kill_retry_time: 5000,      // Retry SIGTERM 5s before SIGKILL
      listen_timeout: 60000,      // Bumped from 30s — Next.js cold start
      // PM2 log rotation (PR-94 / INF-OBS-1)
      // The values below are declarative intent; the actual rotation is
      // configured globally via `pm2-logrotate` at runtime. Run
      // `bash scripts/setup-logrotate.sh` once per host to apply.
      // PM2 ignores these keys in the app definition, but keeping them
      // here makes the policy visible alongside the apps it applies to.
      max_size: '50M',
      retain: 14,
      compress: true,
    },
    {
      name: 'voltium-worker',
      cwd: webCwd,
      script: 'dist/workers.js',
      args: '',
      instances: process.env.WORKER_INSTANCES ? parseInt(process.env.WORKER_INSTANCES, 10) : 1,
      exec_mode: process.env.WORKER_EXEC_MODE || (process.env.WORKER_INSTANCES && parseInt(process.env.WORKER_INSTANCES, 10) > 1 ? 'cluster' : 'fork'),
      watch: false,
      env: {
        ...commonEnv,
        DATABASE_POOL_SIZE: process.env.WORKER_DATABASE_POOL_SIZE || '5',
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '60s',          // Bumped from 10s
      restart_delay: 30000,       // Bumped from 5s
      max_memory_restart: '1G',    // 1G — single instance with in-memory job state (see header); raised from 768M in PR-69
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: path.join(logsDir, 'voltium-worker-error.log'),
      out_file: path.join(logsDir, 'voltium-worker-out.log'),
      merge_logs: true,
      kill_timeout: 30000,        // Bumped from 10s
      kill_retry_time: 5000,      // Retry SIGTERM 5s before SIGKILL
      // PM2 log rotation (PR-94 / INF-OBS-1)
      // See comment on the voltium-web block above; these keys are
      // declarative intent and are applied globally by setup-logrotate.sh.
      max_size: '50M',
      retain: 14,
      compress: true,
    },
  ],
};
