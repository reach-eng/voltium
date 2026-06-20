# No Cloud Data

Voltium public-beta production keeps app data on the laptop. Cloudflare Tunnel may route HTTPS traffic to the laptop, but it must not store application data.

## Allowed And Not Allowed

| Component | Allowed | NOT Allowed |
| --- | --- | --- |
| Database | Local PostgreSQL | Neon, Supabase, Railway, RDS, Cloud SQL, any managed database |
| Storage | Local filesystem | GCS, S3, R2, Cloudinary, any cloud object storage |
| Cache | In-process cache or local database table | Upstash Redis, Redis Cloud, ElastiCache |
| Queue | PostgreSQL `OutboxEvent` table | SQS, Pub/Sub, Cloud Tasks, managed Kafka |
| Error tracking | Local log files | Sentry, Datadog, Bugsnag, cloud APM storage |
| Backups | Local disk plus optional external USB copy | Cloud backup buckets or managed snapshots |
| Public routing | Cloudflare Tunnel routing only | Cloudflare storage, Workers KV, R2, D1 |

## Production Rules

- `DATA_MODE` must be `local_laptop`.
- `STORAGE_PROVIDER` must be `local`.
- `DATABASE_URL` and `DIRECT_URL` must point to localhost.
- Uploaded files stay under the configured local storage root.
- Backups stay on local disk or an attached external drive.
- Secrets are supplied by local environment configuration, not committed files.

## Why

The laptop-only architecture keeps rider identity documents, payments evidence, telemetry, and operational data under local control for the beta. It also keeps the deployment small: PostgreSQL, local disk, PM2, the Next.js app, and the worker.
