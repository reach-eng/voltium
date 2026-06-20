# Secret Rotation Checklist

## Schedule

- Quarterly: `JWT_SECRET`, `SESSION_SECRET`, `CRON_SECRET`, `WORKER_SECRET`, `CI_JWT_SECRET`
- Annual: Firebase service-account key, FCM server key if legacy APIs are used, Cloudflare Tunnel credentials, database password
- On personnel change: admin passwords, Android signing keystore access, GitHub Actions secrets access
- On suspected leak: rotate affected secret immediately, review audit logs, and invalidate sessions where relevant

## Secrets Inventory

| Secret | Owner | Rotation | Trigger | Stored In |
| --- | --- | --- | --- | --- |
| `JWT_SECRET` | Tech Lead | Quarterly | Suspected leak | `web/.env.production.local` |
| `SESSION_SECRET` | Tech Lead | Quarterly | Suspected leak | `web/.env.production.local` |
| `CRON_SECRET` | Tech Lead | Quarterly | Suspected leak | `web/.env.production.local` |
| `WORKER_SECRET` | Tech Lead | Quarterly | Suspected leak | `web/.env.production.local` |
| `CI_JWT_SECRET` | Tech Lead | Quarterly | Suspected leak | GitHub Actions secrets |
| `DATABASE_URL` password | Tech Lead | Annual | Suspected leak | PostgreSQL role plus `web/.env.production.local` |
| `DIRECT_URL` password | Tech Lead | Annual | Suspected leak | PostgreSQL role plus `web/.env.production.local` |
| `ADMIN_PASSWORD` | Tech Lead | On personnel change | Dev admin access change | Development-only env |
| Firebase service-account key | Tech Lead | Annual | Suspected leak | `web/.env.production.local` or local secret store |
| FCM server key, if legacy APIs are enabled | Tech Lead | Annual | Suspected leak | Firebase Console |
| Cloudflare Tunnel credentials | Tech Lead | Annual | Suspected leak | Cloudflared credentials file on host |
| Android signing keystore | Tech Lead | On personnel change | Developer leaves | GitHub Actions secrets plus offline backup |
| `KEYSTORE_BASE64` | Tech Lead | On personnel change | Developer leaves | GitHub Actions secrets |
| `KEYSTORE_PASSWORD` | Tech Lead | On personnel change | Developer leaves | GitHub Actions secrets |
| `KEY_ALIAS` | Tech Lead | On personnel change | Developer leaves | GitHub Actions secrets |
| `KEY_PASSWORD` | Tech Lead | On personnel change | Developer leaves | GitHub Actions secrets |
| `MSG91_AUTH_KEY`, if enabled | Tech Lead | Annual | Suspected leak | `web/.env.production.local` |

## JWT Rotation Procedure

1. Generate a new value: `openssl rand -hex 32`.
2. Update `web/.env.production.local` on the laptop.
3. Restart services: `pm2 restart ecosystem.config.js`.
4. Expect all existing rider and admin sessions to require login again.
5. Watch logs and audit entries for unexpected `500` errors.

## Verification After Any Rotation

- Confirm old credentials no longer work.
- Confirm health checks pass after restart.
- Confirm GitHub Actions secrets exist for CI-only secrets.
- Confirm no rotated secret appears in repository files.
- Review authentication and admin audit logs for anomalous activity.
