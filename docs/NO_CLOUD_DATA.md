# No Cloud Data — Laptop-Only Architecture

Voltium runs all production app data **on the laptop** — no cloud databases, no cloud object storage, no cloud queues.

## What is allowed

- **PostgreSQL** on localhost for all app data
- **Local disk** filesystem for uploaded files
- **Local disk** for backups
- **Optional external USB drive** for secondary backup copy
- **Cloudflare Tunnel** for public HTTPS routing only (no data storage)

## What is NOT allowed

| Service | Reason |
|---------|--------|
| Docker | Not needed for single-machine deployment |
| Neon | Managed PostgreSQL — data leaves laptop |
| Supabase | Managed database + storage |
| AWS S3 | Cloud object storage |
| Google Cloud Storage | Cloud object storage |
| Cloudflare R2 | Cloud object storage |
| Upstash Redis | Cloud queue — replaced with PostgreSQL OutboxEvent |
| Any managed cloud DB | Data must stay on local PostgreSQL |
| Any cloud object storage | Files must stay on local disk |

## Architecture

```
┌─────────────────────────────────────────┐
│           Laptop (PM2)                  │
│                                         │
│  ┌──────────┐    ┌──────────────────┐   │
│  │ Next.js  │    │   Worker Process │   │
│  │ (Port 8081)│    │  (scheduled jobs)│   │
│  └────┬─────┘    └───────┬──────────┘   │
│       │                  │              │
│  ┌────▼──────────────────▼──────────┐   │
│  │       PostgreSQL (localhost)     │   │
│  │       + Local Disk Storage       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │    Backup Storage (Local Disk)  │   │
│  │    Optional USB External Copy   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Cloudflare Tunnel → Public URL │   │
│  │  (routing only, no storage)     │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Why Laptop-Only?

1. **Simplicity** — No cloud accounts, no credentials to manage
2. **Privacy** — Rider KYC documents stay on local hardware
3. **Offline-capable** — App works without internet (except CF Tunnel)
4. **Low cost** — No cloud storage/compute bills
5. **Full control** — Physical access to all data

## Migration History

This project was migrated from cloud-dependent architecture (Neon DB, Upstash Redis, S3/GCS/R2 storage) to laptop-only. See commit history for details.
