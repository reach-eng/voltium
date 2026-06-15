# Voltium Final Architecture

> Complete architecture summary after all 14 refactoring phases.
> This document describes the current (post-migration) architecture of the Voltium platform.

---

## 1. System Overview

Voltium is an electric vehicle rental and fleet management platform with three primary surfaces:

| Surface     | Stack                                                 | Purpose                         |
| ----------- | ----------------------------------------------------- | ------------------------------- |
| Rider App   | Flutter (Provider, Google Fonts, image_picker)        | Rider mobile experience         |
| Admin Panel | Next.js App Router (React, Tailwind, shadcn/ui)       | Fleet operations command center |
| API Layer   | Next.js API routes → Use-cases → Repositories → Prisma | Backend services               |

**Database**: Prisma ORM → PostgreSQL (all environments via managed service)

> **Note**: Voltium does not use Docker. All services use managed infrastructure or native Node.js process commands.

---

## 2. Target Architecture (Post-Migration)

```
src/
├─ app/
│  ├─ api/                  → Thin route handlers only (delegate to modules)
│  └─ admin/                → Admin panel React pages
│
├─ server/
│  ├─ modules/
│  │  ├─ auth/              → OTP login, JWT session, logout
│  │  ├─ riders/            → Profile CRUD, rider lifecycle
│  │  ├─ kyc/               → KYC submit/approve/reject + state machine
│  │  ├─ guarantors/        → Guarantor submit/approve/reject + state machine
│  │  ├─ wallet/            → Top-up, ledger, idempotency, reversal
│  │  ├─ deposits/          → Deposit approve/reject/refund/forfeit
│  │  ├─ rentals/           → Plan select, pickup, return, overdue
│  │  ├─ vehicles/          → Vehicle CRUD, status assignment
│  │  ├─ hubs/              → Hub management
│  │  ├─ support/           → Tickets, FAQ, chat messages
│  │  ├─ notifications/     → Push, SMS, in-app notifications
│  │  ├─ files/             → Signed upload URLs, ownership, audit
│  │  ├─ admin/             → Admin user CRUD, RBAC, audit logs
│  │  ├─ device-compliance/ → Permission violation scanning
│  │  └─ analytics/         → Reports, metrics, scoring
│  │
│  ├─ shared/
│  │  ├─ db/prisma.ts       → Prisma client singleton
│  │  └─ (auth, rbac, errors, logger, validation — from src/lib/)
│  │
│  └─ workers/
│     ├─ index.ts           → Worker orchestrator
│     ├─ queues.ts          → Queue definitions + configs
│     ├─ outbox.ts          → Outbox pattern service
│     └─ jobs/
│        ├─ reconciliation.job.ts   → Daily wallet reconciliation
│        ├─ notifications.job.ts    → Birthday, reminders, leaderboard
│        ├─ rent-reminders.job.ts   → Due/overdue detection, auto-debit
│        ├─ device-compliance.job.ts→ Hourly violation scan
│        ├─ referral-reward.job.ts  → On-demand reward processing
│        ├─ audit-cleanup.job.ts    → Expired log deletion
│        └─ telemetry-cleanup.job.ts→ Old data purge
│
├─ contracts/               → API contracts & OpenAPI spec
├─ components/              → shadcn/ui + custom React components
├─ hooks/                   → React hooks
├─ lib/                     → Shared utilities (auth, db, logger, etc.)
├─ store/                   → Zustand stores
├─ middleware.ts            → CSP, CSRF, validation
└─ proxy.ts                 → CORS, request logging
```

---

## 3. Architecture Principles

| Principle              | Status | Implementation |
| ---------------------- | ------ | -------------- |
| **Thin routes**        | ✅     | Routes delegate to use-cases |
| **Use-cases first**    | ✅     | Business logic in use-case files |
| **Repositories**       | ✅     | All Prisma queries behind abstractions |
| **Schema-first**       | ✅     | Every input validated by Zod |
| **State machines**     | ✅     | Controlled transitions, forbidden jumps blocked |
| **Ledger-everything**  | ✅     | Every wallet mutation creates ledger entry |
| **Idempotent ops**     | ✅     | Idempotency keys prevent double-approval |
| **Audit trail**        | ✅     | Every sensitive action is logged |
| **Feature-first Flutter** | ✅ | Flutter organized by domain feature |

---

## 4. Data Flow Architecture

```
Rider App (Flutter)
     │
     ▼  HTTPS + JWT
API Routes (thin — input parsing only)
     │
     ▼
Use-Cases (business logic + auth + state machines)
     │
     ├──► Service Layer (domain operations, wallets, deposits)
     │       │
     │       └──► Repository (Prisma queries)
     │               │
     │               └──► Database
     │
     ├──► State Machine (transition validation)
     │
     ├──► Wallet Ledger (append-only, source of truth)
     │
     ├──► Audit Log (append-only, with retention)
     │
     └──► Outbox Event (reliable async processing)
              │
              └──► Background Workers (DB-backed outbox, Node worker process)
```

---

## 5. Security Architecture

```
Request
  │
  ├──► Rate Limiting (Redis + in-memory fallback)
  │
  ├──► Middleware: CSP headers, CSRF check, Correlation ID
  │
  ├──► Route: Authentication (JWT session — rider or admin)
  │
  ├──► Use-Case: Authorization (RBAC — admin roles)
  │
  ├──► Schema: Input validation (Zod)
  │
  ├──► Repository: Parameterized queries (Prisma)
  │
  └──► Security Events: Logged for auth, KYC views, wallet changes
```

### Admin RBAC Roles

| Role             | Permissions |
|------------------|-------------|
| SUPER_ADMIN      | Full system access |
| ADMIN            | Operations + finance + KYC + ticket management |
| MANAGER          | View + create riders, vehicles, tickets |
| FLEET_MANAGER    | Vehicle/hub CRUD, rider updates |
| TEAM_LEADER      | KYC/guarantor review, ticket resolution |

---

## 6. State Machines

Every entity has a state machine with controlled transitions:

| Entity           | States | Transitions | File |
|------------------|--------|-------------|------|
| Rider Lifecycle  | 16     | 19 legal    | `riders/rider-lifecycle.service.ts` |
| KYC Profile      | 6      | 7 legal     | `kyc/kyc-state-machine.ts` |
| Guarantor        | 6      | 7 legal     | `guarantors/guarantor-state-machine.ts` |
| Deposit Record   | 8      | 9 legal     | `deposits/deposit-state-machine.ts` |
| Transaction      | 6      | 5 legal     | `lib/services/wallet-service.ts` |
| Rental Lease     | 9      | 12 legal    | `rentals/rental-state-machine.ts` |
| Vehicle          | 7      | 7 legal     | `vehicles/vehicle-state-machine.ts` |
| Support Ticket   | 5      | 6 legal     | `support/support-state-machine.ts` |

All state machines are unit tested (see `tests/unit/state-machines.test.ts`).

---

## 7. Background Workers

| Queue            | Schedule    | Jobs                          |
|------------------|-------------|-------------------------------|
| Reconciliation   | Daily 2 AM  | Wallet reconciliation, backfill |
| Notifications    | Daily 8 AM  | Birthday wishes, reminders, leaderboard |
| Rent Reminders   | Daily 6 AM  | Due detection, auto-debit, overdue |
| Device Compliance| Hourly      | Violation scan, auto-resolution |
| Referral Rewards | On-demand   | Reward processing, wallet credit |
| SMS Dispatch     | On-demand   | Send SMS via provider |
| Audit Cleanup    | Weekly Sun  | Expired log deletion |
| Telemetry Cleanup| Monthly 1st | Old data purge |

Outbox pattern guarantees at-least-once delivery for important events.

---

## 8. Testing Coverage

| Layer       | Files | Focus |
|-------------|-------|-------|
| Unit        | 9     | State machines, wallet service, RBAC, outbox, API error, auth, validators |
| API         | 5     | Auth endpoints, rider APIs, admin APIs |
| Integration | 1     | Full workflow integration |
| Contract    | 1     | API contract shape consistency |
| Security    | 2     | PII leak, privilege escalation |
| E2E         | 33    | Flutter integration tests (all passing) |

---

## 9. Observability

| Component        | Implementation |
|------------------|----------------|
| Structured logs  | JSON with PII masking, correlation IDs |
| Error tracking   | Sentry (lazy-loaded via SENTRY_DSN) |
| APM              | In-memory metrics (request timing, slow queries) |
| Health checks    | `GET /api/health` — DB, Redis, disk, uptime |
| Metrics endpoint | `GET /api/monitoring/metrics` — admin-protected |
| Security events  | Logged to logger + `AuditLog` table |
| Correlation IDs  | Propagated through all log entries |

---

## 10. Deployment Environments

| Environment | Infrastructure                                              | URL                           |
|-------------|-------------------------------------------------------------|-------------------------------|
| Local       | Managed PostgreSQL + Next.js dev server + Node worker       | `http://localhost:8081`       |
| Staging     | Managed PG + Web service + Worker service (Render/Railway)  | `https://staging.voltium.app` |
| Production  | Managed PG + Web service + Worker service + Caddy/Reverse proxy | `https://voltium.example.com` |

CI/CD: GitHub Actions with lint → typecheck → build → test → deploy gates.

---

## 11. Phases Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0  | Project Stabilization | ✅ |
| 1  | Clean Module Structure | ✅ |
| 2  | Thin API Routes | ✅ (partial — auth, KYC, guarantor) |
| 3  | State Machines | ✅ |
| 4  | Wallet/Debit Architecture | ✅ |
| 5  | API Contracts | ✅ |
| 6  | Flutter Feature-First Refactor | ✅ (partial — 13 feature modules) |
| 7  | File Upload & KYC Storage | ✅ |
| 8  | Background Workers | ✅ |
| 9  | Admin RBAC & Audit | ✅ |
| 10 | Database Upgrade | ✅ (schema ready, migration guide) |
| 11 | Testing Architecture | ✅ |
| 12 | Observability | ✅ |
| 13 | Deployment | ✅ |
| 14 | Final Target Architecture | ✅ |
