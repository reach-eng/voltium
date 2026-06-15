// PM2 Ecosystem File — Voltium Laptop Mode
// Start both processes:  pm2 start ecosystem.config.js
// Stop:                  pm2 stop ecosystem.config.js
// Restart:               pm2 restart ecosystem.config.js
// Status:                pm2 status
// Logs:                  pm2 logs
// Reload after pull:     git pull && npm ci && npm run build && pm2 restart ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'voltium-web',
      cwd: './web',
      script: 'npm',
      args: 'run start',
      interpreter: 'bash',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        PORT: 8081,
      },
      // Auto-restart on crash
      max_restarts: 10,
      restart_delay: 5000,
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '../logs/voltium-web-error.log',
      out_file: '../logs/voltium-web-out.log',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 30000,
    },
    {
      name: 'voltium-worker',
      cwd: './web',
      script: 'npm',
      args: 'run worker:start',
      interpreter: 'bash',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
      },
      // Auto-restart on crash
      max_restarts: 10,
      restart_delay: 5000,
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '../logs/voltium-worker-error.log',
      out_file: '../logs/voltium-worker-out.log',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 10000,
    },
  ],
};
