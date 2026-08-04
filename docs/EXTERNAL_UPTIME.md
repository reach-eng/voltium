# External Uptime Probe — Phase 7H PR-143

**Date:** 2026-08-04
**Status:** Operator action item (no code change)

## Why this exists

The Cloudflare Tunnel (`cloudflared`) is the only path from the public
internet to the Voltium API. A tunnel-down condition is **invisible**
until a rider complains that the app is broken. Internal liveness
checks (PM2, the app's `/api/health` endpoint) cannot detect a
tunnel outage because they probe the backend directly, not the
public hostname.

## Setup (UptimeRobot — free tier)

1. Create an account at <https://uptimerobot.com/>
2. Add a new monitor:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Voltium API (staging)
   - **URL:** `https://api-staging.voltium.app/api/health` (or the
     actual staging hostname)
   - **Monitoring Interval:** 5 minutes (free tier minimum)
3. Set alert contacts:
   - **Slack webhook:** the same `ALERT_WEBHOOK_URL` secret used
     by the secret-rotation nightly job. See `docs/SECRET_ROTATION.md`
     for the URL format.
4. Repeat for the production hostname when it ships.

## Setup (cron-job.org — free tier alternative)

1. Create an account at <https://cron-job.org/>
2. Create a new cron job:
   - **Title:** Voltium health probe
   - **URL:** `https://api-staging.voltium.app/api/health`
   - **Schedule:** every 5 minutes
3. In the **"On failure"** section, configure an HTTP POST to the
   same Slack webhook (cron-job.org will hit the webhook URL on
   consecutive failures).

## Acceptance

- A tunnel-down event fires a Slack alert within 5 minutes
- The probe is independent of the laptop (it runs on UptimeRobot /
  cron-job.org's infrastructure, not our PM2)
- The probe is documented in `docs/RUNBOOK_INCIDENTS.md` so the
  on-call knows to check the tunnel first

## Combined with PR-145

PR-145 added `metrics: localhost:2000` to
`cloudflared-config.example.yml` so an internal Prometheus
blackbox exporter can also scrape the tunnel. Together:

- **External probe** (this doc): catches public-hostname-down,
  tunnel-down, certificate-expiry.
- **Internal probe** (PR-145): catches cloudflared-process-crashed
  but tunnel-still-up anomalies.

The two are complementary. Skip either at your peril.
