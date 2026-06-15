# Known Issues & Risks

> Inventory of known problems, risky code areas, and architectural debt in the Voltium platform.

---

## 1. Backend Issues

### 1.1 Business Logic Mixed in Routes

**Risk**: High
**Location**: All files in `src/app/api/`
**Problem**: Route handlers contain auth checks, validation, business logic, Prisma queries, and response formatting all in one function. This makes routes:
- Hard to test in isolation
- Difficult to add authorization checks consistently
- Prone to errors when status transitions are bypassed
- Impossible to reuse business logic

**Fix**: Phase 2 of refactoring plan.

### 1.2 String Statuses Instead of Enums

**Risk**: High
**Location**: `prisma/schema.prisma` — all status fields use `String @default(...)`
**Problem**: Status values are free-form strings with no compile-time validation:
- `accountStatus: "PRE_ACTIVE" | "ACTIVE" | "SUSPENDED"` — but no enforcement
- `kyc.status: "PENDING" | "APPROVED" | "REJECTED"` — typos cause silent bugs
- No transition validation — impossible state jumps are not caught

**Fix**: Phase 3 — define state machines and validate at application layer (SQLite doesn't support enums; PostgreSQL does).

### 1.3 SQLite in Development, PostgreSQL Planned

**Risk**: Medium
**Location**: `prisma/schema.prisma` → `datasource db { provider = "sqlite" }`
**Problem**: SQLite and PostgreSQL have different feature sets:
- SQLite doesn't support enums
- SQLite doesn't support array columns
- Schema drift between environments is possible
- Some queries that work in SQLite may not work in PostgreSQL

**Fix**: Phase 10 — switch all environments to PostgreSQL.

### 1.4 Wallet Balance Mutated Directly

**Risk**: Critical
**Location**: Wallet-related API routes
**Problem**: Wallet balance (`wallet.balanceInPaise`) may be updated directly in route handlers without:
- Ledger entries (no audit trail)
- Idempotency checks (double-approval risk)
- Transaction wrapping (partial failure risk)

**Fix**: Phase 4 — all wallet changes must pass through `wallet.service.ts` with ledger entries.

### 1.5 No Repository Layer

**Risk**: Medium
**Location**: All API routes call `prisma` directly
**Problem**: 
- Cannot unit test business logic without a database
- Query optimizations require changing route code
- No centralized place to add caching or query hooks

**Fix**: Phase 2 — extract Prisma queries into `*.repository.ts` files.

### 1.6 KYC URLs May Be Public

**Risk**: High
**Location**: KYC upload/storage system
**Problem**: KYC documents (Aadhaar, PAN) may be stored at publicly accessible URLs. If true, any user (not just the document owner) could view another rider's KYC documents. This is a compliance and privacy issue.

**Fix**: Phase 7 — move to signed URLs, private bucket, ownership checks.

### 1.7 All Validation in Single File

**Risk**: Low
**Location**: `src/lib/validators.ts`
**Problem**: All Zod schemas are in one monolithic file. As the schema count grows, this becomes:
- Hard to navigate
- Creates merge conflicts
- Blurs ownership boundaries

**Fix**: Phase 1 — split into per-module schema files.

### 1.8 No Background Worker Infrastructure

**Risk**: Medium
**Location**: Missing entirely
**Problem**: Background tasks (rent reminders, reconciliation, notifications) may be handled inside API request handlers or not at all. This means:
- API response times include background work
- Failed background tasks are invisible
- Retry logic is missing

**Fix**: Phase 8.

---

## 2. Flutter Issues

### 2.1 Large Screen Files

**Risk**: Medium
**Location**: Multiple files in `flutter/lib/screens/`
**Problem**: Several screens exceed 1000+ lines:
- `active_dashboard_screen.dart` (3245 lines) → refactored to ~210 lines ✅
- `pickup_hub_screen.dart` (1703 lines) → refactored to ~410 lines ✅
- `pre_dashboard_screen.dart` (1539 lines) → refactored to ~340 lines ✅
- `earnings_screen.dart` (1344 lines) → refactored to ~430 lines ✅

**Status**: These large files have been partially refactored with widgets extracted.

### 2.2 API Logic in Screens

**Risk**: Medium
**Location**: Screen files call `ApiService()` directly
**Problem**: Screens (UI layer) contain direct API calls instead of going through a repository or service layer. This makes:
- Hard to mock API calls in tests
- UI changes risk breaking data fetching
- No caching layer between API and UI

**Fix**: Phase 6 — move API calls to feature-level repositories.

### 2.3 Single State Provider Pattern

**Risk**: Low
**Location**: `flutter/lib/providers/`
**Problem**: Using `Provider` (not `Riverpod` or `Bloc`) means:
- Provider is less testable than Riverpod
- Provider doesn't support autodispose easily
- Migration to Riverpod is recommended but not urgent

**Fix**: Phase 6 — migrate to Riverpod if team agrees.

### 2.4 No Generated API Client

**Risk**: Medium
**Location**: Flutter API calls manually typed
**Problem**: Every API response type is manually defined in Flutter. When the backend changes a response shape, Flutter won't know until runtime.

**Fix**: Phase 5 — generate Flutter API client from OpenAPI contract.

### 2.5 Theme Values Hardcoded in Widgets

**Risk**: Low
**Location**: Many widget files use inline color values (`Color(0xFF0053C1)`)
**Problem**: Changing the brand color requires finding and replacing every hardcoded value instead of updating a theme constant.

**Fix**: Phase 6 — migrate to centralized theme constants.

---

## 3. Database Issues

### 3.1 Missing Indexes

**Risk**: Medium
**Location**: `prisma/schema.prisma`
**Problem**: Several common query patterns lack indexes:
- `Rider.phone` — used for OTP login lookup
- `Rider.lifecycleStatus` — used for admin filtering
- `Transaction.createdAt` — used for history queries
- `WalletLedger.riderId` — used for ledger queries

**Fix**: Phase 10 — add indexes for all common query patterns.

### 3.2 Audit Log Table Exists but May Not Be Populated

**Risk**: Medium
**Location**: `AuditLog` model in schema
**Problem**: The `AuditLog` table exists in the schema but audit entries may not be consistently written for all admin actions.

**Fix**: Phase 9 — enforce audit logging for all sensitive admin actions.

### 3.3 Rider Model Has Too Many Fields

**Risk**: Low
**Location**: `Rider` model in `schema.prisma`
**Problem**: The Rider model has ~60 fields covering profile, KYC status, device compliance, and rental state. This violates single-responsibility and makes the schema hard to read.

**Fix**: Could split into related tables (RiderProfile, RiderCompliance, RiderLifecycle) but not urgent.

---

## 4. Security Issues

### 4.1 No Rate Limiting on Auth Routes

**Risk**: High
**Location**: `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`
**Problem**: No rate limiting means an attacker can:
- Bombard phones with OTP messages
- Brute-force OTP verification
- Exhaust SMS provider credits

**Fix**: Add rate limiting middleware (in-memory or Redis-based).

### 4.2 Dev Bypass Flags in Production Risk

**Risk**: Medium
**Location**: `VOLTFLEET_DEV_BYPASS_RATELIMIT` in env
**Problem**: Development bypass flags exist in the environment configuration. If accidentally set in production, security controls are disabled.

**Fix**: Add checks that crash the app if `NODE_ENV=production` and bypass flags are set.

### 4.3 Admin Auto-Login Risk

**Risk**: Medium
**Location**: Admin auth routes
**Problem**: Admin auto-login or development shortcuts may exist that bypass authentication in non-production environments. If deployed to production with these enabled, unauthorized admin access is possible.

**Fix**: Phase 9 — verify admin routes enforce authentication in production.

---

## 5. Testing Gaps

### 5.1 No Unit Tests for Business Logic

**Risk**: High
**Location**: Missing
**Problem**: Core business logic (wallet service, KYC state machine, rental lifecycle) has no unit tests. Changes to these areas risk breaking critical workflows.

**Fix**: Phase 11.

### 5.2 E2E Tests Are Fragile

**Risk**: Medium
**Location**: `e2e/` directory
**Problem**: Playwright E2E tests exist but may be fragile due to:
- Hardcoded test data dependencies
- Timing-dependent assertions
- Limited test isolation

**Fix**: Phase 11 — stabilize test fixtures and test data factories.

---

## 6. Infrastructure Issues

### 6.1 No Staging Environment

**Risk**: Medium
**Location**: Infrastructure
**Problem**: Without a staging environment that mirrors production, schema changes and new features cannot be safely validated before deployment.

**Fix**: Phase 13.

### 6.2 No CI/CD Pipeline

**Risk**: Medium
**Location**: Missing
**Problem**: Without CI/CD, every deployment is a manual process with no gates for typechecking, testing, or linting.

**Fix**: Phase 13.

---

## 7. Monitor & Watch

| Item | Risk | Action |
|------|------|--------|
| Duplicate referral code on signup | Medium | Fails with unique constraint; handle gracefully |
| Concurrent wallet transactions | Critical | Phase 4 adds optimistic locking via `version` field |
| Large file uploads without size limit | Medium | Phase 7 adds file validation |
| FCM token expiry not handled | Low | Refresh token periodically |
| Phone number formatting inconsistency | Low | Standardize to E.164 format |
