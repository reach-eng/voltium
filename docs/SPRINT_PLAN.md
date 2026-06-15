# Voltium — Execution Sprint Plan

> Based on the 14-phase architecture plan.
> Phase 1 (Production Safety Cleanup) is complete.

---

## Sprint 1 — Safety & Structure (Phases 1+2+3)

**Status:** Phase 1 ✅ Done · Phase 2 ⬜ · Phase 3 ⬜

### Phase 2 — Project Packaging & Repo Structure

| Task | Status |
|------|--------|
| Move docs/ into dedicated `/docs` directory | ⬜ |
| Create `web/` directory and move Next.js app there (`src/`, `prisma/`, `package.json`, `next.config.*`, `tsconfig.json`, `tailwind.config.*`, `postcss.config.*`, `public/`, `.next/`) | ⬜ |
| Create `docs/PROJECT_STRUCTURE.md` documenting the repo layout | ⬜ |
| Create ZIP export script (`scripts/export.sh`) that preserves folder structure | ⬜ |
| Remove duplicate flattened files if any exist | ⬜ |
| Verify `route.ts` files don't collide on extraction | ⬜ |
| Add `docs/ARCHITECTURE.md` with system architecture overview | ⬜ |
| Update root `README.md` with accurate repo structure and build instructions | ⬜ |

### Phase 3 — PostgreSQL Decision

| Task | Status |
|------|--------|
| Remove `schema.production.prisma` — keep single `schema.prisma` with PostgreSQL provider | ⬜ |
| Add Prisma enums for all major status fields (RiderLifecycle, KycStatus, GuarantorStatus, etc.) | ⬜ |
| Add missing production tables (AdminSession, RolePermission, NotificationDelivery) | ⬜ |
| Add comprehensive indexes | ⬜ |
| Add `docker-compose.postgres.yml` for local Postgres | ⬜ |
| Update `docker-compose.yml` to use PostgreSQL instead of SQLite | ⬜ |
| Update seed script for PostgreSQL compatibility | ⬜ |
| Update `.env.example` and `env.ts` to reflect PostgreSQL defaults | ✅ Done |
| Update `prisma/seed.ts` to produce realistic demo data | ⬜ |
| Document migration workflow in `docs/DATABASE.md` | ⬜ |

---

## Sprint 2 — Backend Modules & State Machines (Phases 4+5)

**Status:** ⬜

### Phase 4 — Backend Modular Monolith

| Task | Status |
|------|--------|
| Create `src/server/modules/` directory structure | ⬜ |
| Create `src/server/shared/` with db, errors, auth, logger, rbac, storage, validation, config | ⬜ |
| Move DB client from `src/lib/db.ts` → `src/server/shared/db/` | ⬜ |
| Move error handling from `src/lib/api-error.ts` → `src/server/shared/errors/` | ⬜ |
| Move auth/session from `src/lib/auth.ts` → `src/server/shared/auth/` | ⬜ |
| Create module skeletons for all 15 modules | ⬜ |
| **Migration: Auth module** — thin routes, extract use-cases, services, repositories | ⬜ |
| **Migration: Rider profile/state module** | ⬜ |
| **Migration: KYC module** | ⬜ |
| **Migration: Guarantor module** | ⬜ |
| **Migration: Deposit module** | ⬜ |
| **Migration: Wallet module** | ⬜ |
| **Migration: Rental/pickup module** | ⬜ |
| **Migration: Vehicle/hub module** | ⬜ |
| **Migration: Support module** | ⬜ |
| **Migration: Notifications module** | ⬜ |
| **Migration: Analytics module** | ⬜ |
| **Migration: Device compliance module** | ⬜ |

### Phase 5 — State Machines

| Task | Status |
|------|--------|
| Create `src/server/modules/rider-state.machine.ts` with allowed RiderLifecycleStatus transitions | ⬜ |
| Create `src/server/modules/kyc-state.machine.ts` with KycStatus transitions | ⬜ |
| Create `src/server/modules/guarantor-state.machine.ts` with GuarantorStatus transitions | ⬜ |
| Create `src/server/modules/deposit-state.machine.ts` with DepositStatus transitions | ⬜ |
| Create `src/server/modules/transaction-state.machine.ts` with TransactionStatus transitions | ⬜ |
| Create `src/server/modules/rental-state.machine.ts` with RentalStatus transitions | ⬜ |
| Create `src/server/modules/vehicle-state.machine.ts` with VehicleStatus transitions | ⬜ |
| Replace scattered string statuses in Prisma queries with enum references | ⬜ |
| Add `canTransition(from, to)` guard in all state machines | ⬜ |
| Update admin filters to use enums | ⬜ |
| Add unit tests for every state machine (all allowed + blocked transitions) | ⬜ |

---

## Sprint 3 — Wallet, Deposit & Files (Phases 6+7)

**Status:** ⬜

### Phase 6 — Wallet & Deposit Hardening

| Task | Status |
|------|--------|
| Audit all wallet mutations — ensure every change goes through ledger | ⬜ |
| Create `wallet.service.ts` — centralized wallet operations | ⬜ |
| Create `deposit.service.ts` — centralized deposit lifecycle | ⬜ |
| Add idempotency to deposit approval (prevent double-credit) | ⬜ |
| Add transaction-level locking for balance changes | ⬜ |
| Add refund flow (reverses ledger entry, updates wallet) | ⬜ |
| Add reversal flow (for admin corrections) | ⬜ |
| Add finance audit logs for all wallet/deposit operations | ⬜ |
| Add `ReconciliationReport` generation job | ⬜ |
| **Unit tests:** top-up submit/approve/reject, deposit submit/approve/reject, double approval blocked, refund, reversal, negative balance blocked, rent debit, fine debit, reward credit | ⬜ |

### Phase 7 — Secure File & KYC Document Architecture

| Task | Status |
|------|--------|
| Create `files.module.ts` with use-cases, service, repository, policy, schemas, types | ⬜ |
| Implement signed upload URL generation | ⬜ |
| Implement signed read URL generation (with expiration) | ⬜ |
| Replace `/api/upload` with `/api/files/request-upload` + `/api/files/confirm-upload` | ⬜ |
| Store every uploaded file as a `FileRecord` in DB | ⬜ |
| Add MIME type and file size validation | ⬜ |
| Add file ownership checks (riders can access only their own files) | ⬜ |
| Add admin document-view audit logging | ⬜ |
| Update Flutter upload flows to use new signed URL approach | ⬜ |
| **Tests:** file ownership, unauthorized access blocked, MIME validation | ⬜ |

---

## Sprint 4 — API Contracts (Phase 8)

**Status:** ⬜

### Phase 8 — API Contracts & Generated Flutter Client

| Task | Status |
|------|--------|
| Define Zod request/response schemas for Auth APIs | ⬜ |
| Define Zod schemas for Rider state/profile APIs | ⬜ |
| Define Zod schemas for KYC APIs | ⬜ |
| Define Zod schemas for Guarantor APIs | ⬜ |
| Define Zod schemas for File APIs | ⬜ |
| Define Zod schemas for Wallet APIs | ⬜ |
| Define Zod schemas for Deposit APIs | ⬜ |
| Define Zod schemas for Rental/Pickup APIs | ⬜ |
| Define Zod schemas for Support APIs | ⬜ |
| Define Zod schemas for Notification APIs | ⬜ |
| Generate OpenAPI JSON from Zod schemas | ⬜ |
| Generate Flutter API client from OpenAPI | ⬜ |
| Replace manual endpoint strings in Flutter with generated client | ⬜ |
| Standardize API error shape (`{ success, error: { code, message, details }, requestId }`) | ⬜ |
| Add contract tests (request/response shape validation) | ⬜ |

---

## Sprint 5 — Flutter Feature Refactor (Phase 9)

**Status:** ⬜

### Phase 9 — Flutter Feature-First Refactor

| Task | Status |
|------|--------|
| Create `flutter/lib/core/` — network, storage, errors, theme, widgets, permissions, constants | ⬜ |
| Create `flutter/lib/features/auth/` — migrate auth screens | ⬜ |
| Create `flutter/lib/features/onboarding/` — migrate onboarding screens | ⬜ |
| Create `flutter/lib/features/kyc/` — migrate KYC screens | ⬜ |
| Create `flutter/lib/features/guarantor/` — migrate guarantor screens | ⬜ |
| Create `flutter/lib/features/wallet/` — migrate wallet screens | ⬜ |
| Create `flutter/lib/features/deposits/` — migrate deposit screens | ⬜ |
| Create `flutter/lib/features/rental/` — migrate rental screens | ⬜ |
| Create `flutter/lib/features/pickup/` — migrate pickup screens | ⬜ |
| Create `flutter/lib/features/dashboard/` — migrate dashboard screens | ⬜ |
| Create `flutter/lib/features/support/` — migrate support screens | ⬜ |
| Create `flutter/lib/features/notifications/` — migrate notification screens | ⬜ |
| Create `flutter/lib/features/profile/` — migrate profile screens | ⬜ |
| Create `flutter/lib/features/rewards/` — migrate rewards screens | ⬜ |
| Create `flutter/lib/features/referrals/` — migrate referral screens | ⬜ |
| Replace `ChangeNotifier` providers with Riverpod | ⬜ |
| Replace manual navigation with `go_router` | ⬜ |
| Replace `http` client with `Dio` | ⬜ |
| Add `freezed` models + `json_serializable` | ⬜ |
| Split screens > 700 lines into smaller components | ⬜ |
| Add route guards based on rider lifecycle state | ⬜ |

---

## Sprint 6 — Admin, Workers, Tests, Observability (Phases 10+11+12+13+14)

**Status:** ⬜

### Phase 10 — Admin RBAC & Audit

| Task | Status |
|------|--------|
| Add `requirePermission()` middleware for admin routes | ⬜ |
| Add admin role management UI (`AdminUser` CRUD in admin panel) | ⬜ |
| Add permission mapping for new granular roles (KYC_REVIEWER, FINANCE_ADMIN, etc.) | ⬜ |
| Apply permission checks to all sensitive admin APIs | ⬜ |
| Add audit log service | ✅ Partially done (AuditLog model exists) |
| Log all approval/rejection/finance/file-view actions to AuditLog | ⬜ |

### Phase 11 — Workers & Outbox

| Task | Status |
|------|--------|
| Create `src/server/workers/` with outbox processor | ⬜ |
| Create job handlers: sms, notification, rent reminders, overdue detection | ⬜ |
| Create job handlers: wallet reconciliation, payment reconciliation, file cleanup | ⬜ |
| Add BullMQ (or compatible) queue integration | ⬜ |
| Add retry + dead-letter queue | ⬜ |
| Fix worker Docker build | ⬜ |

### Phase 12 — Testing Architecture

| Task | Status |
|------|--------|
| Write unit tests: all state machines | ⬜ |
| Write unit tests: wallet ledger operations | ⬜ |
| Write unit tests: deposit service | ⬜ |
| Write unit tests: KYC policy, file policy, RBAC policy | ⬜ |
| Write unit tests: rental lifecycle, vehicle lifecycle | ⬜ |
| Write integration tests: OTP login → profile → KYC → guarantor → deposit → plan → pickup | ⬜ |
| Write integration tests: wallet top-up → admin approval → balance updated | ⬜ |
| Write integration tests: support ticket → admin reply → rider sees reply | ⬜ |
| Wire CI pipeline with typecheck → lint → unit tests → integration → build | ⬜ |

### Phase 13 — Observability

| Task | Status |
|------|--------|
| Add request ID middleware to all API responses | ✅ Partially done |
| Ensure Sentry DSN is configurable and active | ✅ Already configured |
| Add health check endpoint (`/api/health`) with DB + Redis checks | ⬜ |
| Add Prometheus metrics endpoint (`/api/metrics`) | ⬜ |
| Ensure all wallet/deposit/approval events are logged to AuditLog | ⬜ |

### Phase 14 — Deployment

| Task | Status |
|------|--------|
| Document staging vs production environment separation | ⬜ |
| Document rollback procedure | ⬜ |
| Add pre-deploy checklist script | ⬜ |
| Verify no dev features leak into production builds | ⬜ |

---

## Pilot-Readiness Tracker

| Criteria | Status |
|----------|--------|
| No hardcoded OTP | ⚠️ Kept per request (gated behind dev tools for non-prod) |
| No admin auto-login | ⚠️ Kept per request |
| No secrets in repo | ✅ Done |
| PostgreSQL only | ⬜ Sprint 1 |
| Private KYC files | ⬜ Sprint 3 |
| Signed upload/read URLs | ⬜ Sprint 3 |
| Wallet ledger enforced | ✅ Partially done (model exists, needs hardening) |
| Deposit double-approval blocked | ⬜ Sprint 3 |
| Admin RBAC active | ✅ Partially done (system exists, needs enforcement) |
| Audit logs active | ⬜ Sprint 6 |
| Worker service running | ⬜ Sprint 6 |
| Flutter uses Voltium API only | ✅ Done |
| No Ryd URLs | ✅ Done |
| No production test-mode buttons | ✅ Done |
| Core workflows tested E2E | ⬜ Sprint 6 |
| Staging deployment works | ⬜ Sprint 6 |

---

## Legend

- ✅ Done
- ⚠️ In progress / intentionally kept
- ⬜ Not started
