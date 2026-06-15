# Voltium Refactoring Plan

> Phased execution plan to move Voltium from a broad prototype to a clean, maintainable, production-ready modular monolith.

---

## Guiding Principles

1. **Do not rewrite the entire project at once** — refactor workflow by workflow
2. **No business logic changes during structural refactors** — Phase 1 is purely structural
3. **Each workflow is complete only when it has** use-case, repository, schema, state machine, Flutter feature module, tests, and audit logs
4. **Money safety first** — wallet/deposit phase is highest priority for correctness

---

## Phase 0 — Project Stabilization

**Goal**: Prepare the project for refactoring without breaking anything.

### Tasks

1. **Create architecture branches**
   ```
   main
   develop
   architecture/refactor-backend-modules
   architecture/refactor-flutter-features
   architecture/api-contracts
   architecture/wallet-ledger
   ```

2. **Freeze new feature work** — only allow:
   - Bug fixes
   - Security fixes
   - Architecture migration
   - Tests

3. **Document everything** (this plan + ARCHITECTURE.md + WORKFLOWS.md + STATE_MACHINES.md)

4. **Identify risky files** — files where logic is tangled and refactoring requires extra care.

**Done when**: All docs created, branches set up, risky files identified.

---

## Phase 1 — Clean Module Structure (No Logic Changes)

**Goal**: Create the new folder structure, then migrate logic gradually.

### Tasks

1. **Create module folders** under `src/server/modules/`:
   - `auth/`, `riders/`, `onboarding/`, `kyc/`, `guarantors/`
   - `wallet/`, `deposits/`, `rentals/`, `vehicles/`, `hubs/`
   - `support/`, `notifications/`, `device-compliance/`, `analytics/`

2. **Create shared folders** under `src/server/shared/`:
   - `auth/`, `rbac/`, `errors/`, `logger/`, `storage/`, `queue/`, `validation/`

3. **Move shared utilities** from `src/lib/` into `src/server/shared/`:
   - `auth.ts` → `shared/auth/jwt.ts`
   - `validators.ts` → `shared/validation/`
   - `logger.ts` → `shared/logger/`
   - `api-response.ts` → `shared/errors/`
   - `db.ts` → `shared/db/prisma.ts`
   - `env.ts` → `shared/config/env.ts`

4. **Create module template files** — empty files following the template:
   ```
   module/
   ├─ module.routes.ts
   ├─ module.use-cases.ts
   ├─ module.service.ts
   ├─ module.repository.ts
   ├─ module.policy.ts
   ├─ module.schemas.ts
   └─ module.types.ts
   ```

5. **Verify app still runs** — no logic changes, just structure.

**Done when**: New structure exists, app runs, route files are ready to migrate.

---

## Phase 2 — Thin API Routes

**Goal**: Remove business logic from route handlers.

### Migration Order

1. **Auth routes** — `POST /api/auth/*`
   - Extract OTP send/verify into `auth.use-cases.ts`
   - Move Prisma queries to `auth.repository.ts`

2. **Rider profile routes** — `GET/PUT /api/rider/profile`
   - Extract profile CRUD into `riders.use-cases.ts`
   - Move queries to `riders.repository.ts`

3. **KYC routes** — `POST /api/rider/kyc`, `POST /api/admin/kyc`
   - Extract submit/approve/reject into `kyc.use-cases.ts`
   - Extract state machine checks

4. **Wallet/Deposit routes** — wallet top-up, admin approval
   - Extract into `wallet.use-cases.ts` and `deposit.use-cases.ts`
   - Add ledger service, idempotency checks

5. **Rental/Vehicle routes** — booking, pickup, return
   - Extract into `rentals.use-cases.ts` and `vehicles.use-cases.ts`

6. **Support/Notification routes**
   - Extract into respective modules

### Target Route Pattern

```typescript
export async function POST(req: NextRequest) {
  const session = await requireRiderSession(req);
  const body = await req.json();
  const input = SubmitKycSchema.parse(body);
  const result = await kycUseCases.submitKyc({ riderId: session.riderId, input });
  return Response.json({ success: true, data: result });
}
```

**Done when**: API routes no longer contain business logic, Prisma calls live in repositories, each workflow has a use-case file.

---

## Phase 3 — State Machines

**Goal**: Replace free-form `String` statuses with controlled enums and valid transitions.

### Tasks

1. **Define rider lifecycle enum** in `riders/rider-lifecycle.types.ts`
2. **Add transition validation** — reject impossible state jumps
3. **Update Prisma schema** — replace `String` with enum where possible (SQLite doesn't support enums, so use validation at application layer)
4. **Add state machine service per entity** — `kyc-state-machine.ts`, `deposit-state-machine.ts`, etc.

### Files to create

```
src/server/modules/riders/rider-lifecycle.service.ts
src/server/modules/riders/rider-lifecycle.types.ts
src/server/modules/kyc/kyc-state-machine.ts
src/server/modules/deposits/deposit-state-machine.ts
src/server/modules/rentals/rental-state-machine.ts
```

**Done when**: Every important status uses controlled transitions, impossible jumps are blocked, admin dashboards use the same statuses.

---

## Phase 4 — Wallet/Debit Architecture

**Goal**: Make wallet and deposit operations safe, auditable, and production-ready.

**This is one of the most important phases.**

### Tasks

1. **Create wallet ledger table** — append-only record of every balance change
2. **Move all balance changes** into `wallet.service.ts`
3. **Move all deposit actions** into `deposit.service.ts`
4. **Add idempotency keys** to payment/deposit actions
5. **Standardize transaction statuses** using state machine
6. **Add reconciliation report** — compare ledger sum vs wallet balance
7. **Add admin audit log** for all money actions
8. **Add tests** for every money workflow

### Critical Rule

```
No wallet balance changes without a ledger entry.
No route directly updates wallet balance.
All money changes pass through wallet service.
Deposit approval must be idempotent — double-click should not double-credit.
```

### Wallet Ledger Model

```typescript
interface WalletLedgerEntry {
  id: string;
  riderId: string;
  transactionId?: string;
  entryType: 'CREDIT' | 'DEBIT';
  category: LedgerCategory;
  amountInPaise: number;
  balanceBeforePaise: number;
  balanceAfterPaise: number;
  idempotencyKey?: string;
  note?: string;
  actorId?: string; // admin ID if admin-triggered
  createdAt: DateTime;
}

type LedgerCategory =
  | 'TOPUP_CREDIT'
  | 'DEPOSIT_CREDIT'
  | 'RENT_DEBIT'
  | 'REWARD_CREDIT'
  | 'FINE_DEBIT'
  | 'REFUND_CREDIT'
  | 'REVERSAL'
  | 'ADMIN_ADJUSTMENT';
```

**Done when**: No direct wallet balance changes outside wallet service, every money action has ledger entry, double approval cannot double-credit.

---

## Phase 5 — API Contracts

**Goal**: Stop Flutter and backend from guessing each other's API shapes.

### Tasks

1. **Define DTOs** for every API response in `src/contracts/`
2. **Define request schemas** using Zod per module
3. **Generate OpenAPI spec** from Zod schemas
4. **Generate Flutter API client** from OpenAPI
5. **Remove manually typed endpoint response parsing** from Flutter
6. **Add contract tests**

### Structure

```
src/contracts/
├─ auth.contract.ts
├─ rider.contract.ts
├─ kyc.contract.ts
├─ wallet.contract.ts
├─ rental.contract.ts
├─ support.contract.ts
├─ notification.contract.ts
└─ openapi.ts
```

**Done when**: Flutter uses generated client for core workflows, backend validates every input, response shapes are documented.

---

## Phase 6 — Flutter Feature-First Refactor

**Goal**: Move Flutter from large screen files into feature modules.

### Target Structure

```
flutter/lib/
├─ app/           → app.dart, router.dart, bootstrap.dart
├─ core/          → network, storage, errors, theme, widgets
└─ features/      → auth, onboarding, kyc, wallet, dashboard, etc.
```

### Refactor Order

1. **Core** — theme, constants, network client, error handling
2. **Auth** — login, OTP, session, logout
3. **Onboarding** — profile form, progress, routing
4. **KYC & Guarantor** — document upload, submission, status
5. **Wallet & Deposits** — balance, top-up, transaction history
6. **Rental, Pickup, Dashboard** — plan, hub, vehicle, active dashboard, return
7. **Support, Notifications, Profile** — remaining secondary features

### Each Feature Module

```
feature/
├─ data/
│  ├─ api.dart
│  ├─ dto.dart
│  └─ repository_impl.dart
├─ domain/
│  ├─ entity.dart
│  ├─ repository.dart
│  └─ use_cases.dart
└─ presentation/
   ├─ screens/
   ├─ widgets/
   └─ controller.dart
```

**Done when**: No major screen is over 500 lines, screens don't contain API logic, controllers handle UI state, repositories handle API/cache.

---

## Phase 7 — File Upload & KYC Storage

**Goal**: Make document upload secure and consistent.

### Tasks

1. **Create signed URL upload flow**
2. **Move files to private bucket** — no public KYC URLs
3. **Add file ownership checks** — rider cannot access another rider's file
4. **Store file metadata** in database
5. **Log admin file views**
6. **Validate MIME type and file size**
7. **Create file upload module**: `src/server/modules/files/`

### Target Upload Flow

```
Flutter requests upload URL
→ backend checks rider/admin permission
→ backend returns signed upload URL
→ Flutter uploads file directly
→ backend stores file metadata
→ admin views file through signed read URL
```

**Done when**: KYC files are private, ownership is enforced, admin views are logged.

---

## Phase 8 — Background Workers

**Goal**: Move background tasks out of API request logic.

### Jobs to Separate

```
Payment reconciliation
Wallet ledger reconciliation
Notification sending
SMS sending
Rental overdue detection
Rent reminder generation
Support SLA checks
Referral reward processing
Device compliance checks
```

### Structure

```
src/server/workers/
├─ index.ts
├─ queues.ts
└─ jobs/
   ├─ reconciliation.job.ts
   ├─ notifications.job.ts
   ├─ rent-reminders.job.ts
   └─ device-compliance.job.ts
```

**Recommended**: BullMQ + Redis, or managed queue from hosting provider.

### Outbox Pattern

For important events, use an outbox table:

```
OutboxEvent { id, type, payload, status, attempts, createdAt, processedAt }
```

**Done when**: Background jobs are retryable, failed jobs visible, notification sending is not hidden in route files.

---

## Phase 9 — Admin RBAC & Audit

**Goal**: Make admin panel secure, role-based, and workflow-driven.

### Admin Roles

```
SUPER_ADMIN        → Full system access
OPERATIONS_ADMIN   → Daily fleet operations
KYC_REVIEWER       → KYC + guarantor review only
FINANCE_ADMIN      → Wallet, deposits, refunds
SUPPORT_AGENT      → Support tickets only
HUB_MANAGER        → Vehicle pickup/return at hub
FLEET_MANAGER      → Vehicle/hub CRUD
READ_ONLY          → Dashboard/reports only
```

### Admin Action Architecture

```
Admin request → auth check → permission check → use-case
→ state machine check → DB transaction → audit log → notification
```

**Done when**: Every sensitive admin action checks permission, every approval/rejection has audit log.

---

## Phase 10 — Database Upgrade

**Goal**: Make database production-safe.

### Tasks

1. **Convert to PostgreSQL** for all environments
2. **Replace String statuses** with Prisma enums
3. **Add indexes** for common queries
4. **Add audit log tables**
5. **Add wallet ledger table**
6. **Add file metadata table**
7. **Add outbox event table**
8. **Add migration scripts**
9. **Add seed data** (fake demo users only)

### Critical Indexes

```prisma
Rider.phone
Rider.lifecycleStatus
KycProfile.status
Guarantor.status
Transaction.riderId
Transaction.status
Transaction.createdAt
WalletLedger.riderId
WalletLedger.createdAt
RentalLease.riderId
RentalLease.status
Vehicle.status
Vehicle.hubId
SupportTicket.status
Notification.riderId
```

---

## Phase 11 — Testing Architecture

**Goal**: Make workflows safe before production.

### Test Layers

| Layer | Focus | Examples |
|-------|-------|----------|
| Unit | State machines, services, policies | Wallet service, KYC policy, RBAC |
| Integration | Full workflows | OTP login, KYC submit, deposit approve |
| Contract | API shapes | OpenAPI responses, Flutter client |
| E2E | Full user journeys | New rider → active rider, top-up → approval |

### Priority Test Workflows

1. Money workflows (wallet top-up, deposit, refund)
2. KYC workflows (submit, approve, reject, re-submit)
3. Rental lifecycle (plan, pickup, return)
4. Every state machine transition

---

## Phase 12 — Observability

**Goal**: Make production issues traceable.

### Add

```
Structured logging (request IDs)
Admin audit logs (every sensitive action)
Sentry error tracking
Performance monitoring
Job failure dashboard
Payment reconciliation dashboard
Security event logs
```

### Important Log Events

```
Admin login/logout
Admin approval/rejection
KYC file view
Wallet balance change
Deposit approval/rejection
Vehicle assignment
Rental closure
Failed OTP attempts (rate limit near)
Permission denied events
```

---

## Phase 13 — Deployment

**Goal**: Separate environments and deploy safely.

### Environments

| Env | Database | Storage | Credentials |
|-----|----------|---------|-------------|
| local | SQLite/PostgreSQL | Local | Dev keys |
| staging | PostgreSQL | GCS bucket | Test keys |
| production | PostgreSQL | GCS bucket | Live keys |

### CI/CD Gates

```
→ typecheck → lint → unit tests → integration tests
→ Prisma migration check → Flutter analyze → Flutter tests
→ security scan → secret scan → build check
→ deploy
```

---

## Phase 14 — Final Target Architecture

```text
voltium/
├─ apps/
│  ├─ api/              (Next.js or Express)
│  ├─ admin-web/        (Next.js admin dashboard)
│  ├─ rider-app/        (Flutter)
│  └─ workers/          (BullMQ workers)
│
├─ packages/
│  ├─ db/               (Prisma schema + migrations)
│  ├─ contracts/        (OpenAPI + generated clients)
│  ├─ domain/           (Shared domain types)
│  ├─ config/           (Env config, secrets)
│  ├─ observability/    (Logging, metrics, tracing)
│  └─ testing/          (Test utilities, fixtures)
```

This is the eventual monorepo target, **not the immediate goal**. The practical migration path stays inside the current Next.js + Flutter structure, cleaning it incrementally.

---

## Priority Execution Order

```text
1. Backend module structure     ← CURRENT PHASE
2. Thin API routes
3. Status/state machines
4. Wallet/deposit ledger
5. KYC/file security
6. API contracts
7. Flutter feature refactor
8. Workers/jobs
9. Admin RBAC/audit logs
10. PostgreSQL migration
11. Tests
12. Deployment hardening
```
