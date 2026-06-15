# Voltium — Project Structure

> **Note**: Voltium does not use Docker. All services run as native Node.js processes.
> Database, files, and backups stay on local disk. Cloudflare Tunnel for public routing only.

## Repository Layout

```
voltium/
├─ web/                          # Next.js backend + admin dashboard
│  ├─ src/
│  │  ├─ app/
│  │  │  ├─ admin/               # Admin panel routes
│  │  │  └─ api/                 # Backend API routes
│  │  ├─ server/
│  │  │  ├─ modules/             # Domain modules (auth, riders, wallet, etc.)
│  │  │  ├─ shared/              # Shared utilities (db, auth, errors, logger, etc.)
│  │  │  └─ workers/             # Background job workers (outbox processor)
│  │  ├─ contracts/              # Zod schemas + OpenAPI contracts
│  │  ├─ components/             # React components (admin + rider UI)
│  │  ├─ hooks/                  # React hooks
│  │  ├─ lib/                    # Utility libraries
│  │  └─ store/                  # Zustand stores
│  │
│  ├─ prisma/                    # Prisma schema + migrations
│  ├─ public/                    # Static assets
│  ├─ tests/                     # Unit & integration tests
│  ├─ e2e/                       # Playwright E2E tests
│  │
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ next.config.ts
│  ├─ tailwind.config.ts
│  ├─ postcss.config.mjs
│  ├─ vitest.config.ts
│  ├─ playwright.config.ts
│  └─ eslint.config.mjs
│
├─ flutter/                      # Flutter rider mobile app
│  ├─ lib/                       # Dart source code
│  ├─ integration_test/          # Flutter integration tests
│  ├─ test/                      # Unit tests
│  ├─ android/                   # Android platform
│  ├─ ios/                       # iOS platform
│  └─ pubspec.yaml
│
├─ docs/                         # Documentation
│  ├─ SPRINT_PLAN.md             # Execution sprint plan
│  ├─ PROJECT_STRUCTURE.md       # This file
│  ├─ ARCHITECTURE.md            # System architecture
│  ├─ API.md                     # API documentation
│  ├─ DEPLOYMENT.md              # Deployment guide
│  └─ ...
│
├─ scripts/                      # Build & utility scripts
│  ├─ check-no-docker.sh         # Enforcement: fails if Docker files/commands found
│  ├─ export.sh                  # Clean ZIP export script
│  ├─ db-sync.sh                 # Database sync/backup
│  └─ ...
│
├─ .github/workflows/            # CI/CD pipelines
├─ .zscripts/                    # Workflow agent scripts
├─ Caddyfile                     # Reverse proxy config (for VPS deployments)
├─ .gitignore
├─ README.md
└─ SECRET_ROTATION_CHECKLIST.md
```

## Runtime Processes

Two separate processes are needed:

| Process | Command | Purpose |
|---------|---------|---------|
| Web/API | `npm run start` | Next.js server (admin dashboard + API routes) |
| Worker  | `npm run worker:start` | Background job processor (outbox events, notifications) |

Both processes connect to the same local PostgreSQL database.

## Key Separations

- **`web/`** — All backend code, admin dashboard, API routes, database schema, and tests.
- **`flutter/`** — All mobile app code, completely separate from backend.
- **`docs/`** — All documentation.
- **`scripts/`** — Utility scripts for building, exporting, syncing.

## Path Aliases

Within `web/`, the `@/` path alias maps to `web/src/` as configured in `tsconfig.json`:

```json
{ "paths": { "@/*": ["./src/*"] } }
```

This means `import { db } from '@/lib/db'` resolves to `web/src/lib/db.ts`.
