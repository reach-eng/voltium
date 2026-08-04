# Cloudflare Tunnel Health Check — Phase 7H PR-145

**Date:** 2026-08-04

## What was added

PR-145 added `metrics: localhost:2000` to
`cloudflared-config.example.yml`. The cloudflared daemon now
exposes a Prometheus-compatible metrics endpoint on port 2000.

## Available metrics

`cloudflared` exposes these key metrics (full list at
<https://github.com/cloudflare/cloudflared/blob/master/METRICS.md>):

- `cloudflared_tunnel_connections` — current active connections
- `cloudflared_tunnel_request_per_second` — request rate
- `cloudflared_tunnel_response_by_code` — HTTP response codes
- `cloudflared_tunnel_response_latency` — request latency
- `cloudflared_tunnel_datagram_*` — QUIC/UDP metrics (if used)

## Prometheus scrape config

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'cloudflared'
    metrics_path: /metrics
    static_configs:
      - targets: ['localhost:2000']
    scrape_interval: 30s
```

## Blackbox probe (alternative)

If you don't run Prometheus, you can use a blackbox exporter to
probe the tunnel's public hostname instead:

```yaml
scrape_configs:
  - job_name: 'blackbox_tunnel'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
        - https://api-staging.voltium.app/api/health
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: localhost:9115
```

## Run cloudflared under PM2 (recommended)

For automatic restart on crash, run cloudflared as a third PM2 app:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    // ... existing voltium and worker apps
    {
      name: 'cloudflared',
      script: 'cloudflared',
      args: 'tunnel --config /root/.cloudflared/config.yml run',
      autorestart: true,
      max_memory_restart: '128M',
      max_restarts: 10,
    },
  ],
};
```

Then `pm2 start ecosystem.config.js` and the tunnel auto-restarts
on crash.

## Combined with PR-143 (external uptime probe)

- **External probe (PR-143, UptimeRobot / cron-job.org):**
  catches public-hostname-down, tunnel-down, certificate-expiry
  from the public internet.
- **Internal probe (PR-145, this doc):** catches cloudflared-
  process-crashed-but-tunnel-still-up anomalies that an external
  probe might miss (rare, but documented in the cloudflared
  METRICS.md).

The two are complementary. Operators should run both.

## Acceptance

- `/metrics` on `localhost:2000` returns Prometheus output
- A Prometheus or blackbox_exporter scrape job is configured
  to pull these metrics
- A Slack alert fires if `cloudflared_tunnel_connections == 0`
  for more than 2 minutes (cloudflared has lost the upstream
  tunnel to Cloudflare's edge)
