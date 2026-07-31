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
        DATABASE_POOL_SIZE: process.env.DATABASE_POOL_SIZE || '8',
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '60s',          // Bumped from 10s — Next.js boot can be 8s on slow disk
      restart_delay: 30000,       // Bumped from 5s — allow slow boot to settle
      max_memory_restart: '1200M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: path.join(logsDir, 'voltium-web-error.log'),
      out_file: path.join(logsDir, 'voltium-web-out.log'),
      merge_logs: true,
      kill_timeout: 30000,        // Bumped from 10s — graceful shutdown of in-flight requests
      kill_signal: 'SIGINT',      // Graceful shutdown signal for Next.js
      kill_retry_time: 5000,      // Retry SIGTERM 5s before SIGKILL
      listen_timeout: 60000,      // Bumped from 30s — Next.js cold start
    },
    {
      name: 'voltium-worker',
      cwd: webCwd,
      script: 'dist/workers.js',
      args: '',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        ...commonEnv,
        DATABASE_POOL_SIZE: process.env.WORKER_DATABASE_POOL_SIZE || '5',
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '60s',          // Bumped from 10s
      restart_delay: 30000,       // Bumped from 5s
      max_memory_restart: '768M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: path.join(logsDir, 'voltium-worker-error.log'),
      out_file: path.join(logsDir, 'voltium-worker-out.log'),
      merge_logs: true,
      kill_timeout: 30000,        // Bumped from 10s
      kill_retry_time: 5000,      // Retry SIGTERM 5s before SIGKILL
    },
  ],
};
