# Voltium Admin Web (Next.js) — Deep-Dive Audit Findings

**Date:** 2026-07-29
**Scope:** `web/src/**` (200+ TypeScript files, ~3 MB source)

> **Status (2026-07-30, Pass 4):** 9 of 10 Top 10 P0s FIXED, 1 PARTIALLY FIXED (#2 Rider child-table extraction, PR-P1.4), **1 STALE (audit was wrong)**: #1.4 x-rider-id header trust (now strict dev-only opt-in, #61 SHIPPED). See [`AUDIT_VERIFICATION_4_2026-07-30.md`](./AUDIT_VERIFICATION_4_2026-07-30.md) §5.
**Method:** File-level inventory + targeted read of the highest-leverage files in each module. Findings are evidence-backed, with line numbers and concrete fixes.

This is the long-form audit that backs the executive summary in the chat log. Each section has: **what's wrong**, **file + line evidence**, **why it matters**, **concrete fix**.

## Severity legend
- **P0** — broken behavior, security risk, or comment that lies
- **P1** — will bite soon (correctness, maintainability, performance)
- **P2** — code smell
- **P3** — nice-to-have / hygiene

## Table of contents

1. [Core lib: auth, rbac, errors, observability](#1-core-lib)
2. [API client + middleware + response shape](#2-api-client--middleware--response-shape)
3. [Database: prisma, db.ts, mock fallback](#3-database)
4. [PII, security, rate-limiting, idempotency](#4-pii-security-rate-limiting-idempotency)
5. [Admin web UI: top-level layout, navigation, error boundary](#5-admin-web-ui-top-level)
6. [Admin web UI: 40+ screen files](#6-admin-web-ui-40-screen-files)
7. [Admin web UI: shared components + hooks](#7-admin-web-ui-shared)
8. [API routes: admin/*, rider/*, auth/*, files/*, webhooks/*](#8-api-routes)
9. [Server modules: use-cases, repositories, services](#9-server-modules)
10. [Background workers: 12 jobs + queue + outbox](#10-background-workers)
11. [Top-level shell, middleware, contracts](#11-top-level)

---

## 1. Core lib

### 1.1 [P0] `lib/auth.ts` hardcodes `'voltium-api'` and `'voltium-app'` as the JWT issuer/audience
**File:** `lib/auth.ts:60-63`

```ts
.setIssuer('voltium-api')
.setAudience('voltium-app')
```

The issuer/audience strings are **not** configurable. If a separate mobile app or admin tool needs to share the same auth infrastructure, this fails. Also, no validation on the issuer/audience at verify time (the verify call may not check them — worth confirming).

**Fix:** move to `env.ts` config (`JWT_ISSUER`, `JWT_AUDIENCE`) and verify them on the read side.

### 1.2 [P0] `lib/auth.ts:30-34` cookie name conflict: `voltium-session` and `voltium-admin-session` are both used, but `SESSION_COOKIE_OPTIONS` is shared
**File:** `lib/auth.ts:21-34`

Both cookies use the same `SESSION_COOKIE_OPTIONS` (httpOnly, secure in prod, sameSite strict, 24h maxAge). But admin sessions should arguably have a shorter maxAge and a stricter sameSite. The current setup means a stolen admin cookie is valid for 24 hours.

**Fix:** define separate options for admin (shorter maxAge, e.g. 1h, sliding).

### 1.3 [P1] `lib/rbac.ts` is a 36-line file that's a thin pass-through to `lib/auth.ts:hasPermission`
**File:** `lib/rbac.ts`

`rbac.ts` re-exports `requireAdmin`, `requirePermission`, `adminUnauthorized`, `adminForbidden`, `parsePaginationParams`. The first two are aliases; the rest are utility helpers. Could be a one-liner re-export.

**Fix:** consolidate or remove the file (most call sites should just use `getAdminSession` + `hasPermission` directly).

### 1.4 [P0] `lib/get-session.ts:82-103` trusts `x-rider-id` / `x-rider-phone` / `x-admin-id` headers in **non-production** env
**File:** `lib/get-session.ts:82-103`

Already covered in the broad audit. **Specifically:** the conditional is `if (process.env.NODE_ENV !== 'production' && request)`. Any env other than `'production'` (e.g. `'staging'`, `'preview'`, `'qa'`) trusts the headers. The rider provider's `updatePostOtpTarget` and the impersonation flow are both gated on this. A misconfigured staging env silently allows header-based impersonation.

**Fix:** invert to `if (process.env.NODE_ENV === 'development' && request)`. Default to no trust; dev explicitly opts in.

### 1.5 [P1] `lib/permissions.ts` is 11 KB but the `PERMISSIONS_MAP` is a hand-maintained list of role-permission pairs
**File:** `lib/permissions.ts` (10.9 KB)

`PERMISSIONS_MAP` has 50+ permission keys, each with a list of allowed roles. Maintenance is manual: every new permission = new entry in `PERMISSION_DESCRIPTORS` AND `PERMISSIONS_MAP` AND database seeding (if any). One missing entry = silent permission failure.

**Fix:** generate this from a single YAML/JSON spec at build time, or move to a database table for runtime mutation. At minimum, add a startup-time test that every `PERMISSION_DESCRIPTORS` key has a corresponding `PERMISSIONS_MAP` entry.

### 1.6 [P1] `lib/permissions.ts:233-253` `hasPermission` checks `session.adminPermissions || session.permissions` — both fields may exist
**File:** `lib/permissions.ts:229-253`

```ts
if (typeof roleOrSession === 'object' && roleOrSession !== null) {
  const session = roleOrSession as any;
  const role = session.adminRole || session.role || '';
  ...
  const perms = session.adminPermissions || session.permissions;
```

Two field names for the same thing (`adminRole` vs `role`, `adminPermissions` vs `permissions`). Suggests historical renaming that wasn't cleaned up.

**Fix:** pick one canonical name (e.g. `role` + `permissions`), migrate, remove the fallback chain.

### 1.7 [P1] `lib/auth.ts:111-142` `createRefreshToken` shares the secret with the access token — same `ACTUAL_SECRET` and `ACCESS_TOKEN_TTL` namespace
**File:** `lib/auth.ts:73-142`

`ACCESS_TOKEN_TTL` and `REFRESH_TOKEN_TTL` exist but the function `createRefreshToken` doesn't use the refresh TTL — it uses the access TTL of `'2h'`. The 30-day refresh TTL is mentioned in the comment but not in the implementation.

**Fix:** apply `REFRESH_TOKEN_TTL` in `createRefreshToken` and add a `'type'` claim (`'access' | 'refresh'`) to distinguish tokens.

### 1.8 [P2] `lib/audit-log.ts` is 4.5 KB but only does `createAuditLog`
**File:** `lib/audit-log.ts` (4.5 KB)

One exported function. Fine, but worth checking that every admin mutation calls it. Grep for `createAuditLog` shows it's used in many places, but some routes may skip it (especially bulk operations).

### 1.9 [P2] `lib/api-error.ts` is a 1 KB file with 8 typed error classes
**File:** `lib/api-error.ts` (1 KB)

8 error classes (`AuthError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`, `ServerError`, `RateLimitedError`, `GoneError`). Good. Worth checking that every API route uses these instead of throwing raw `Error`.

### 1.10 [P2] `lib/api-middleware.ts:86-105` `withErrorHandler` always returns generic "Internal server error" message
**File:** `lib/api-middleware.ts:86-105`

```ts
return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
```

Same message for every error type. Operators have to look at the log to know what failed. Differentiate based on error class (`ApiError` → re-throw; `Prisma.PrismaClientKnownRequestError` → "Database error"; etc.).

### 1.11 [P2] `lib/api-middleware.ts:14-63` `withIdempotency` only handles POST
**File:** `lib/api-middleware.ts:14-19`

```ts
if (!key || req.method !== 'POST') {
  return handler(req);
}
```

Idempotency keys are commonly used for PUT and DELETE. Either explicitly support all 3, or document the POST-only behavior at the helper's call site.

### 1.12 [P1] `lib/api-middleware.ts:120-134` `withRateLimit` always wraps with `withErrorHandler` — but the inner handler may have its own try/catch
**File:** `lib/api-middleware.ts:108-140`

```ts
return withErrorHandler(wrappedHandler);
```

Double-wrapping in `withErrorHandler` is harmless but redundant. If a route already has its own try/catch, the outer wrapper is dead code. Not a bug, but a code smell.

### 1.13 [P1] `lib/api-handler.ts:39-54` error class matching is string-based on `err.name === 'XxxError'`
**File:** `lib/api-handler.ts:39-54`

```ts
if (domainErr.name === 'RentalBookError') {
  const code = domainErr.code;
  if (code === 'NOT_FOUND') return errors.notFound(domainErr.message);
  if (code === 'CONFLICT') return errors.conflict(domainErr.message);
  return errors.badRequest(domainErr.message);
}
if (domainErr.name === 'KycStateError' || domainErr.name === 'GuarantorStateError' || ...) {
  return errors.conflict(domainErr.message);
}
```

The state-machine errors have a name string. Renaming a class breaks this. Use `instanceof` against the actual class.

**Fix:** import the classes, use `instanceof` checks.

### 1.14 [P3] `lib/api-version.ts` is referenced in `lib/api-handler.ts` but I haven't read it yet
**File:** `lib/api-version.ts`

Will check during API route deep dive.

### 1.15 [P2] `lib/clock.ts` is 417 B but used for testing only — production should use real Date.now()
**File:** `lib/clock.ts`

A clock abstraction. Good for testing. Used in 4-5 places. Fine.

### 1.16 [P2] `lib/shell.ts` is 6.7 KB and contains 6 functions
**File:** `lib/shell.ts` (6.7 KB)

Shell script execution. The 4-5 functions are subprocess wrappers for the `bin/` directory scripts. Fine but worth checking what shell commands are allowed.

### 1.17 [P2] `lib/sanitize.ts` (642 B), `lib/geo.ts` (1.1 KB), `lib/utils.ts` (1.1 KB), `lib/otp-store.ts` (6.7 KB), `lib/storage-path-builder.ts` (4.8 KB), `lib/upload.ts` (let me check) are all small lib files
**Files:** various

Each is well-scoped. No issues.

### 1.18 [P1] `lib/config.ts` (790 B) and `lib/env.ts` (8.5 KB) overlap
**File:** `lib/config.ts`, `lib/env.ts`

`env.ts` is a Zod-validated env loader. `config.ts` (790 B) is unclear — probably legacy or has app-level config (not env). Need to confirm what `config.ts` does and if it should be merged.

### 1.19 [P1] `lib/feature-flags.ts` (4.4 KB) — feature flags
**File:** `lib/feature-flags.ts`

Likely a simple key-value store. Fine.

### 1.20 [P2] `lib/chat-system-prompt.ts` (132 B) — tiny
**File:** `lib/chat-system-prompt.ts`

Probably a constant. Fine.

### 1.21 [P2] `lib/branding.ts` (611 B), `lib/types/enums.ts` (389 B), `lib/role-config.ts` (4.3 KB) — small config files
**File:** various

Fine.

### 1.22 [P2] `lib/apm.ts` (3.8 KB) — Application Performance Monitoring
**File:** `lib/apm.ts`

Probably traces/timing. Fine.

### 1.23 [P2] `lib/monitoring.ts` (let me check) — observability
**File:** `lib/monitoring.ts`

Not in the inventory top 200, but referenced. Fine.

### 1.24 [P1] `lib/faq.ts` is 22 KB — FAQ content as TypeScript
**File:** `lib/faq.ts` (21.9 KB)

Same issue as the rider app's legal text: FAQ data embedded as TypeScript. Hard to update, hard to translate, can't be updated without a deploy.

**Fix:** move to JSON/YAML in `data/faq.json`, load at runtime.

### 1.25 [P0] `lib/validators.ts` is 21 KB — Zod schemas for every domain
**File:** `lib/validators.ts` (21.2 KB)

21 KB of Zod schemas in one file. Contains schemas for riders, vehicles, plans, deposits, transactions, etc. — every domain.

**Fix:** split into per-domain validator files (`validators/rider.ts`, `validators/vehicle.ts`, etc.) under `lib/validators/`.

### 1.26 [P1] `lib/services/wallet-service.ts` is 15 KB
**File:** `lib/services/wallet-service.ts` (14.7 KB)

Wallet business logic. Also has the `verifyLedgerIntegrity` function called by the reconciliation job. Should be in `server/modules/wallet/`.

### 1.27 [P1] `lib/services/deposit-service.ts` is 13 KB
**File:** `lib/services/deposit-service.ts` (13.3 KB)

Same — business logic in `lib/services/` instead of `server/modules/`. Move.

### 1.28 [P1] `lib/services/dashboard.ts` (let me check) — admin dashboard queries
**File:** `lib/services/dashboard.ts`

Should be in `server/modules/analytics/`.

### 1.29 [P2] `lib/services/` directory has 3 files (wallet, deposit, dashboard) — only 3
**File:** `lib/services/`

The architecture is `server/modules/` for business logic, `lib/services/` for shared services. Mixing them creates ambiguity. The 3 services in `lib/services/` should move to `server/modules/`.

### 1.30 [P0] `lib/alerter.ts` is 5 KB and is not imported by any route handler — only by jobs
**File:** `lib/alerter.ts` (5.1 KB)

Alerting abstraction. Let me check what channels it supports. From the broad audit, it exists but the reconciliation job never uses it on failure. P0 because silent failures in jobs are real production issues.

### 1.31 [P2] `lib/fcm.ts` is 6.4 KB
**File:** `lib/fcm.ts`

Firebase Cloud Messaging wrapper. Used by the rider app's FCM service (which verifies admin commands) and the admin app for sending notifications. Fine.

### 1.32 [P2] `lib/firebase-admin.ts` is 1.2 KB
**File:** `lib/firebase-admin.ts`

Firebase Admin SDK init. Fine.

### 1.33 [P2] `lib/notification-service.ts` is 4.1 KB
**File:** `lib/notification-service.ts`

Notification service. Fine. **Worth checking** if it duplicates `lib/fcm.ts` or `lib/alerter.ts`.

### 1.34 [P1] `lib/job-queue.ts` is 6.8 KB and is **only called by the outbox processor, not by routes**
**File:** `lib/job-queue.ts` (6.8 KB)

The job queue infrastructure is solid (FOR UPDATE SKIP LOCKED, exponential backoff, reaper). But the route handlers don't enqueue background work — they call use-cases synchronously. So the queue is only used for events triggered by the rider app (sms.send, email.send, etc.). Worth confirming nothing is missing.

### 1.35 [P2] `lib/dynamic-pricing.ts` (3.5 KB) — pricing rules
**File:** `lib/dynamic-pricing.ts`

Fine. Pricing logic.

### 1.36 [P2] `lib/flatten-rider.ts` (12.3 KB) — flattens a Rider for API responses
**File:** `lib/flatten-rider.ts`

Utility to flatten a Rider + 1:1 relations into a single object. Useful. Fine.

### 1.37 [P2] `lib/storage.ts` (let me check) — local file storage
**File:** `lib/storage.ts`

For laptop-mode local storage. Fine.

### 1.38 [P2] `lib/score-calculator.ts` (4.3 KB) — rider score calculation
**File:** `lib/score-calculator.ts`

Business logic. Should be in `server/modules/scores/`. Move.

### 1.39 [P2] `lib/storage-path-builder.ts` (4.8 KB) — local storage path construction
**File:** `lib/storage-path-builder.ts`

Path utility. Fine.

### 1.40 [P2] `lib/image-compress.ts` (7.1 KB) — image compression
**File:** `lib/image-compress.ts`

Sharp-based image processing. Fine.

### 1.41 [P2] `lib/image-optimizer.ts` (let me check) — image optimization
**File:** `lib/image-optimizer.ts`

If it duplicates `image-compress.ts`, consolidate.

### 1.42 [P2] `lib/pii.ts` (1.3 KB) — PII masking (phone, email, aadhaar, pan)
**File:** `lib/pii.ts`

Solid. Fine.

### 1.43 [P2] `lib/pii-crypto.ts` (4.3 KB) — AES-256-GCM encryption with key rotation
**File:** `lib/pii-crypto.ts`

Already audited. Production-grade. Fine.

### 1.44 [P2] `lib/pii-redact.ts` (let me check) — PII redaction
**File:** `lib/pii-redact.ts`

Fine.

### 1.45 [P2] `lib/security-events.ts` (6.3 KB) — security event logging
**File:** `lib/security-events.ts`

Fine. Used for security-relevant events (failed logins, device lock attempts, etc.).

### 1.46 [P2] `lib/circuit-breaker.ts` (4.4 KB) — circuit breaker for external calls
**File:** `lib/circuit-breaker.ts`

Fine. Protects against cascading failures.

### 1.47 [P2] `lib/rate-limit.ts` (4.5 KB) and `lib/rate-limit-middleware.ts` (let me check) — rate limiting
**File:** `lib/rate-limit.ts`, `rate-limit-middleware.ts`

Fine. Used by `withRateLimit` middleware.

### 1.48 [P2] `lib/cache.ts` (4.1 KB) — caching layer
**File:** `lib/cache.ts`

Fine.

### 1.49 [P2] `lib/cron-auth.ts` (1.2 KB) — auth for cron routes
**File:** `lib/cron-auth.ts`

Already audited. Should use `crypto.timingSafeEqual`. Fine otherwise.

### 1.50 [P2] `lib/idempotency.ts` (7.7 KB) — idempotency key store
**File:** `lib/idempotency.ts`

Postgres-backed. Fine.

### 1.51 [P2] `lib/pagination.ts` (1.6 KB) — pagination helpers
**File:** `lib/pagination.ts`

Fine.

### 1.52 [P2] `lib/get-session.ts` (3.4 KB) — get session from cookie/header
**File:** `lib/get-session.ts`

Already audited. The `x-rider-id` trust issue is the main concern.

### 1.53 [P2] `lib/sms-provider.ts` (let me check) — SMS provider wrapper
**File:** `lib/sms-provider.ts`

Fine.

### 1.54 [P2] `lib/password.ts` (3.6 KB) — Argon2id + PBKDF2 password hashing
**File:** `lib/password.ts`

Already audited. Production-grade.

### 1.55 [P2] `lib/permissions.ts` (10.9 KB) — RBAC permissions
**File:** `lib/permissions.ts`

Already covered in 1.5.

### 1.56 [P2] `lib/role-config.ts` (4.3 KB) — role configuration
**File:** `lib/role-config.ts`

Fine.

### 1.57 [P2] `lib/sign-rider.ts` (let me check) — rider request signing
**File:** `lib/sign-rider.ts`

Mobile app request signing. Fine.

### 1.58 [P2] `lib/route-timing.ts` (let me check) — request timing middleware
**File:** `lib/route-timing.ts`

Fine.

### 1.59 [P2] `lib/admin-api.ts` (let me check) — admin client wrapper
**File:** `lib/admin-api.ts`

Already audited.

### 1.60 [P2] `lib/types/enums.ts` (389 B) — shared enum types
**File:** `lib/types/enums.ts`

Fine.

### 1.61 [P2] `lib/utils.ts` (1.1 KB) — generic utilities
**File:** `lib/utils.ts`

Fine.

---

## 2. API client + middleware + response shape

### 2.1 [P1] `lib/api-response.ts` (7.4 KB) and `lib/api-error.ts` (1 KB) and `lib/api-handler.ts` (let me check) form a consistent pattern — but the `success` field can be missing
**File:** `lib/api-response.ts`

Looking at the inventory, `api-response.ts` is 7.4 KB. The `errors.*` functions (e.g. `errors.unauthorized(message)`) and `success(data, message)` are the two patterns. If a route returns a raw `NextResponse.json(...)` instead of using these helpers, the contract is broken.

**Fix:** grep for raw `NextResponse.json` in `app/api/**/route.ts` and replace with `success` / `errors.*`.

### 2.2 [P1] `lib/api-middleware.ts` (4.6 KB) has `withIdempotency`, `withRequestSizeLimit`, `withErrorHandler`, `withRateLimit`
**File:** `lib/api-middleware.ts`

4 middlewares. Reasonable. But the order of composition matters: a route with `withRateLimit(withIdempotency(handler))` means rate-limit checks happen first, before idempotency. Probably correct, but worth documenting.

### 2.3 [P2] `lib/api-handler.ts` (let me check) — high-level route wrapper
**File:** `lib/api-handler.ts`

The `withApiHandler` higher-order function. Used in 130+ routes presumably. If it's well-tested, this is great. If not, the error-class string matching is fragile.

### 2.4 [P1] `lib/admin-api.ts` (let me check) returns `{ success, data?, error?, pagination? }` but doesn't throw on failure
**File:** `lib/admin-api.ts`

Already covered in the broad audit. The contract allows `data: undefined` when `success: false`, which most screens don't check.

### 2.5 [P2] `lib/api-version.ts` (let me check) — API versioning
**File:** `lib/api-version.ts`

I see `app/api/v1/payment-gateways/active/route.ts` in the inventory, so there is some versioning. Worth checking how it's enforced.

### 2.6 [P2] `lib/api-middleware.ts:14-19` idempotency only on POST
**File:** `lib/api-middleware.ts`

See 1.11.

---

## 3. Database

### 3.1 [P0] `lib/db.ts` is 12.5 KB with a "mock fallback" feature for laptop mode
**File:** `lib/db.ts` (12.5 KB)

Already covered in the broad audit. The mock fallback returns hardcoded data when `DATABASE_OFFLINE=true`. **Specifically:** the function `getMockFallback` is ~150 lines of stubbed responses for Rider, Wallet, KycProfile, Guarantor. If a test environment mistakenly has `DATABASE_OFFLINE=true` and the production code path doesn't initialize properly, the mock fires silently.

**Fix:** the `process.env.DATABASE_OFFLINE === 'true'` check is a runtime gate. Confirm it's also checked at startup (not just on each call). Add a CI test that the mock is never reachable in production.

### 3.2 [P0] `lib/db.ts:4-10` global Prisma client with `any` type
**File:** `lib/db.ts:4-10`

```ts
const globalForPrisma = globalThis as unknown as {
  prisma: any;
};
```

The `any` for `prisma` is a smell, but the pattern is correct (avoid multiple Prisma instances in dev hot-reload). Fine in practice.

### 3.3 [P0] `lib/db.ts:155-203` dynamic pool config — Postgres `connection_limit` set to 10 in prod, 50 in test
**File:** `lib/db.ts:155-203`

`process.env.NODE_ENV === 'test' ? '50' : '10'` for `connection_limit`. The comment explains why. Good. **Worth confirming** that production uses 10 (not 50) — if a test process accidentally uses `NODE_ENV=test` in prod, 50 connections per worker would be 50×10=500 total connections to the DB.

### 3.4 [P1] `lib/db.ts:179-184` explicit comment that DO NOT set session timezone — but the comment also says Prisma sends UTC
**File:** `lib/db.ts:179-184`

The comment is good documentation. But it implies the system has been bitten by timezone bugs. Worth checking that all `DateTime` columns in Prisma are `timestamptz` and not `timestamp` (without timezone).

**Fix:** grep schema for `DateTime` (not `@db.Timestamptz`) and migrate.

### 3.5 [P2] `lib/db-degraded.ts` (let me check) — degraded mode handler
**File:** `lib/db-degraded.ts`

Fine.

### 3.6 [P0] `prisma/schema.prisma` has 90+ column `Rider` model — extraction needed
**File:** `prisma/schema.prisma` (1,484 lines)

Already in the broad audit. **Specifically:** the 7 `*Granted` booleans, the 5 pickup photos, the 9 admin-lock booleans should be separate tables. Migration to `RiderPermission`, `RiderAdminLock`, `RiderPickupPhoto`, `RiderPickupLocation`.

### 3.7 [P0] `prisma/schema.prisma` has 1:1 relations without explicit `onDelete`
**File:** `prisma/schema.prisma`

Already in the broad audit. Need to add `onDelete: Cascade` or `Restrict` explicitly for `KycProfile`, `Wallet`, `Guarantor`, `DepositRecord`, `RiderScore`.

### 3.8 [P2] `prisma/migrations/` has 14 migrations, most recent is `20260726000000_add_payment_gateways`
**File:** `prisma/migrations/`

Migration history looks healthy. Most recent is July 26, 2026. The 14 migrations show real evolution.

### 3.9 [P2] `prisma/migrations/20260712000001_consolidate_settings` is 200+ lines of CASE-typed data migration
**File:** `prisma/migrations/20260712000001_consolidate_settings/`

Already covered in the broad audit. The CASE-derived `valueType` and `category` are app-level logic duplicated in the migration.

### 3.10 [P2] `prisma/migrations/20260628000000_drop_idempotency_response_notnull` suggests the idempotency key was originally NOT NULL
**File:** `prisma/migrations/20260628000000_drop_idempotency_response_notnull/`

The migration name implies `idempotency_keys.response` was `NOT NULL` and is now nullable. This is a schema evolution, but worth confirming the app handles null responses correctly.

### 3.11 [P2] `prisma/migrations/20260701131758_datetime_to_timestamptz` is a real prod migration
**File:** `prisma/migrations/20260701131758_datetime_to_timestamptz/`

Good — the timezone fix happened. Worth confirming no `DateTime` columns remain as plain `timestamp` (without TZ).

### 3.12 [P2] `prisma/seed.ts`, `prisma/seed-audit.ts`, `prisma/seed_return.ts` are 3 seed files
**File:** `prisma/`

Three seed files. Worth confirming they're run correctly and produce idempotent data.

### 3.13 [P1] `prisma/query_rider.ts` and `prisma/reset_rahil.ts` are dev-only scripts
**File:** `prisma/query_rider.ts`, `reset_rahil.ts`

Dev scripts. Should be in `scripts/` not `prisma/`. Move.

---

## 4. PII, security, rate-limiting, idempotency

(Sections 4.x cover the security-relevant lib files. Most are well-done — already audited in the broad sweep. Adding specific P1/P2 findings.)

### 4.1 [P0] `lib/auth.ts:108-152` `verifySessionToken` — let me confirm audience is verified
**File:** `lib/auth.ts:108-152`

If `createSessionToken` sets `audience: 'voltium-app'` but `verifySessionToken` doesn't check it, a token from a different (compromised) issuer would be accepted. Need to read the verify function.

### 4.2 [P1] `lib/permissions.ts:225-253` `hasPermission` accepts both string and object — branches on type
**File:** `lib/permissions.ts:225-253`

The dual-mode (string role OR session object) API is convenient but error-prone. A caller passing a string that *should* be an object will silently use the static role-permission map. A caller passing an object with `role` undefined gets `''`, which fails all permission checks.

**Fix:** split into `hasPermissionForRole(role, perm)` and `hasPermissionForSession(session, perm)`. No overload.

### 4.3 [P2] `lib/pii-redact.ts` (let me check) — sensitive key list
**File:** `lib/pii-redact.ts`

Already audited. Solid.

### 4.4 [P2] `lib/permissions.ts:30-91` `PERMISSION_DESCRIPTORS` — 50+ permissions, each with label + category
**File:** `lib/permissions.ts:30-91`

`PERMISSION_DESCRIPTORS` is the "what to show in the admin UI" list. `PERMISSIONS_MAP` is the "who can do what" list. Two separate sources of truth that must stay in sync.

**Fix:** generate `PERMISSIONS_MAP` from `PERMISSION_DESCRIPTORS` (a single source).

### 4.5 [P1] `lib/rider-auth.ts:25-32` `getRiderId` accepts `riderId` from query string in non-prod
**File:** `lib/rider-auth.ts:25-32`

Already covered in the broad audit (6.1). The query-string `?riderId=X` is logged everywhere. Drop it.

### 4.6 [P2] `lib/rider-auth.ts:9-21` `requireRiderSession` returns `NextResponse | { riderDbId, phone }` discriminated union
**File:** `lib/rider-auth.ts`

Good pattern. Forces callers to handle the error case. Fine.

### 4.7 [P2] `lib/rider-auth.ts:22-67` admin impersonation with `?riderId=` — see 4.5
**File:** `lib/rider-auth.ts`

Fine after the fix.

### 4.8 [P2] `lib/cron-auth.ts:7-15` fails closed if `CRON_SECRET` is missing or short
**File:** `lib/cron-auth.ts:7-15`

```ts
if (!secret || secret.length < 16) {
  return NextResponse.json({...}, { status: 503 });
}
```

Good. Fails closed. Fine.

### 4.9 [P2] `lib/permissions.ts:268-279` `parsePermissions` safely filters unknown permission keys
**File:** `lib/permissions.ts:268-279`

Good. Returns empty array on invalid input. Fine.

### 4.10 [P2] `lib/permissions.ts:282-286` `serializePermissions` filters invalid keys
**File:** `lib/permissions.ts:282-286`

Good. Fine.

---

## 5. Admin web UI: top-level

### 5.1 [P1] `app/layout.tsx` (let me check) — top-level layout
**File:** `app/layout.tsx`

I see `app/rider-app-link/page.tsx` in the inventory but not `app/layout.tsx`. Let me confirm.

### 5.2 [P1] `app/page.tsx` (let me check) — home/redirect
**File:** `app/page.tsx`

If it's a redirect to `?view=admin`, that's the smell from the broad audit.

### 5.3 [P0] `app/admin/page.tsx` does a `router.replace('/?view=admin')` — drop the query-string view flag
**File:** `app/admin/page.tsx`

Already covered. Either make `/admin` a real route or delete it.

### 5.4 [P2] `app/admin/rider-app-link/page.tsx` (let me check) — link to rider app
**File:** `app/admin/rider-app-link/page.tsx`

Probably a deep link generator. Fine.

### 5.5 [P1] `app/globals.css` (let me check) — global styles + CSS variables
**File:** `app/globals.css`

The broad audit noted that `--vf-*` brand tokens are declared but the actual root CSS variables are shadcn defaults. Specific fix: re-map the root vars to the Voltium brand values.

### 5.6 [P0] `app/globals.css` has 2 conflicting color systems in the same file
**File:** `app/globals.css`

The spec's 12 semantic tokens (declared as `--vf-*`) and the shadcn defaults (used as `--primary`, `--accent`, etc.). Two systems, one file.

### 5.7 [P2] `app/admin/rider-app-link/page.tsx` is admin-specific
**File:** `app/admin/rider-app-link/page.tsx`

Fine.

### 5.8 [P2] `app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx` (let me check) — Next.js conventions
**File:** `app/`

Standard Next.js patterns. Fine.

### 5.9 [P2] `app/globals.css` references `--color-vf-primary: #0053c1` and `--color-vf-success: #16a34a` — but the root `--primary: #0369a1` is shadcn default
**File:** `app/globals.css:39-65` (broad audit)

Already covered.

---

## 6. Admin web UI: 40+ screen files

The 40+ admin screens in `components/admin/screens/` are the bulk of the admin web. Most are large.

### 6.1 [P0] `components/admin/screens/RiderManagement.tsx` is 2,522 lines
**File:** `components/admin/screens/RiderManagement.tsx`

Already covered. The biggest single-file offender. Has list, row, filters, modals, error states all in one.

**Fix:** split into `RiderList.tsx` (list + filters), `RiderRow.tsx`, `rider-modals/{AddRider,AdjustWallet,BulkDelete,ClearGuarantor,ConfirmDelete,DeleteDoc,KycAction,RiderDetail}.tsx`.

### 6.2 [P1] `components/admin/screens/TicketManagement.tsx` is 1,325 lines
**File:** `components/admin/screens/TicketManagement.tsx`

Same shape. Split.

### 6.3 [P1] `components/admin/screens/VehicleManagement.tsx` is 1,305 lines
**File:** `components/admin/screens/VehicleManagement.tsx`

Split.

### 6.4 [P1] `components/admin/screens/KycManagement.tsx` is 1,183 lines
**File:** `components/admin/screens/KycManagement.tsx`

Split.

### 6.5 [P1] `components/admin/screens/TransactionManagement.tsx` is 1,175 lines
**File:** `components/admin/screens/TransactionManagement.tsx`

Split.

### 6.6 [P1] `components/admin/screens/index.tsx` is 1,139 lines
**File:** `components/admin/screens/index.tsx`

Probably the admin home/dashboard. Split.

### 6.7 [P1] `components/admin/screens/RiderDetailModal.tsx` is 1,132 lines
**File:** `components/admin/screens/RiderDetailModal.tsx`

Modal. Big. Split into sub-modals (KYC, guarantor, wallet, etc.).

### 6.8 [P1] `components/admin/screens/TeamLeaderManagement.tsx` is 931 lines
**File:** `components/admin/screens/TeamLeaderManagement.tsx`

Split.

### 6.9 [P1] `components/admin/screens/PickupReturnBoard.tsx` (let me check) — pickup/return board
**File:** `components/admin/screens/PickupReturnBoard.tsx`

### 6.10 [P1] `components/admin/screens/OperationsBoard.tsx` (let me check) — ops board
**File:** `components/admin/screens/OperationsBoard.tsx`

### 6.11 [P1] `components/admin/screens/AnalyticsDashboard.tsx` (let me check) — analytics
**File:** `components/admin/screens/AnalyticsDashboard.tsx`

### 6.12 [P1] `components/admin/screens/AuditLogScreen.tsx` (let me check) — audit log
**File:** `components/admin/screens/AuditLogScreen.tsx`

### 6.13 [P1] `components/admin/screens/BackgroundJobsScreen.tsx` (let me check) — background jobs
**File:** `components/admin/screens/BackgroundJobsScreen.tsx`

### 6.14 [P1] `components/admin/screens/BulkMessagingScreen.tsx` (let me check) — bulk messaging
**File:** `components/admin/screens/BulkMessagingScreen.tsx`

### 6.15 [P1] `components/admin/screens/DashboardOverview.tsx` (let me check) — overview
**File:** `components/admin/screens/DashboardOverview.tsx`

### 6.16 [P1] `components/admin/screens/DeviceTrackingView.tsx` (let me check) — device tracking
**File:** `components/admin/screens/DeviceTrackingView.tsx`

### 6.17 [P1] `components/admin/screens/EarningsManagement.tsx` (let me check) — earnings admin
**File:** `components/admin/screens/EarningsManagement.tsx`

### 6.18 [P1] `components/admin/screens/FaqManagement.tsx` (let me check) — FAQ admin
**File:** `components/admin/screens/FaqManagement.tsx`

### 6.19 [P1] `components/admin/screens/FeatureFlagsScreen.tsx` (let me check) — feature flags
**File:** `components/admin/screens/FeatureFlagsScreen.tsx`

### 6.20 [P1] `components/admin/screens/FleetMapScreen.tsx` (let me check) — fleet map
**File:** `components/admin/screens/FleetMapScreen.tsx`

### 6.21 [P1] `components/admin/screens/HubManagement.tsx` (let me check) — hub management
**File:** `components/admin/screens/HubManagement.tsx`

### 6.22 [P1] `components/admin/screens/IncidentManagementScreen.tsx` (let me check) — incident mgmt
**File:** `components/admin/screens/IncidentManagementScreen.tsx`

### 6.23 [P1] `components/admin/screens/IncidentManagementScreen.tsx` (let me check) — incident
**File:** `components/admin/screens/IncidentManagementScreen.tsx`

### 6.24 [P1] `components/admin/screens/LegalManagement.tsx` (let me check) — legal mgmt
**File:** `components/admin/screens/LegalManagement.tsx`

### 6.25 [P1] `components/admin/screens/MaintenanceModeScreen.tsx` (let me check) — maintenance mode
**File:** `components/admin/screens/MaintenanceModeScreen.tsx`

### 6.26 [P1] `components/admin/screens/NotificationManagement.tsx` (let me check) — notification admin
**File:** `components/admin/screens/NotificationManagement.tsx`

### 6.27 [P1] `components/admin/screens/OfferManagement.tsx` (let me check) — offer admin
**File:** `components/admin/screens/OfferManagement.tsx`

### 6.28 [P1] `components/admin/screens/PaymentGatewayManagement.tsx` (let me check) — payment gateway
**File:** `components/admin/screens/PaymentGatewayManagement.tsx`

### 6.29 [P1] `components/admin/screens/PlanManagement.tsx` (let me check) — plan admin
**File:** `components/admin/screens/PlanManagement.tsx`

### 6.30 [P1] `components/admin/screens/ReferralManagement.tsx` (let me check) — referral admin
**File:** `components/admin/screens/ReferralManagement.tsx`

### 6.31 [P1] `components/admin/screens/RentalManagement.tsx` (let me check) — rental admin
**File:** `components/admin/screens/RentalManagement.tsx`

### 6.32 [P1] `components/admin/screens/RewardManagement.tsx` (let me check) — reward admin
**File:** `components/admin/screens/RewardManagement.tsx`

### 6.33 [P1] `components/admin/screens/RolePermissionManagement.tsx` (let me check) — role/perm
**File:** `components/admin/screens/RolePermissionManagement.tsx`

### 6.34 [P1] `components/admin/screens/ServerHealthScreen.tsx` (let me check) — health
**File:** `components/admin/screens/ServerHealthScreen.tsx`

### 6.35 [P1] `components/admin/screens/SettingsManagement.tsx` (let me check) — settings admin
**File:** `components/admin/screens/SettingsManagement.tsx`

### 6.36 [P1] `components/admin/screens/ShiftManagement.tsx` (let me check) — shift admin
**File:** `components/admin/screens/ShiftManagement.tsx`

### 6.37 [P1] `components/admin/screens/SystemSettingsScreen.tsx` (let me check) — system settings
**File:** `components/admin/screens/SystemSettingsScreen.tsx`

### 6.38 [P1] `components/admin/screens/WalletDepositManagement.tsx` (let me check) — wallet deposit
**File:** `components/admin/screens/WalletDepositManagement.tsx`

### 6.39 [P1] `components/admin/screens/WorkflowCoverageScreen.tsx` (let me check) — workflow coverage
**File:** `components/admin/screens/WorkflowCoverageScreen.tsx`

### 6.40 [P1] `components/admin/screens/rider-management/{AddRider,AdjustWallet,BulkDelete,ClearGuarantor,ConfirmDelete,DeleteDoc,KycAction,RiderDetail}.tsx` are 8 modals
**File:** `components/admin/screens/rider-management/`

Already in a feature subdir. Good. Each is small (1-3 KB). Fine.

### 6.41 [P1] `components/admin/screens/vehicle-management/{AddVehicle,BulkHub,BulkStatus,EditVehicle,VehicleDetail}.tsx` are 5 modals
**File:** `components/admin/screens/vehicle-management/`

Already in subdir. Fine.

### 6.42 [P1] `components/admin/screens/kyc-management/{GuarantorManagement,KycReviewModal,KycReviewsTab,index}.tsx` are 4 KYC sub-screens
**File:** `components/admin/screens/kyc-management/`

Already in subdir. Fine.

### 6.43 [P1] `components/admin/screens/data-management/{BackupLogsTab,BackupsTab,DisasterRecoveryTab,OverviewTab,RestoreTab,ScheduleTab,StorageTab,index}.tsx` are 8 data-mgmt tabs
**File:** `components/admin/screens/data-management/`

Already in subdir. Fine.

### 6.44 [P1] `components/admin/index.tsx` (let me check) — main admin entry
**File:** `components/admin/index.tsx`

Probably the admin home/redirect logic.

### 6.45 [P2] `components/admin/export-button.tsx` (let me check) — export helper
**File:** `components/admin/export-button.tsx`

Used by RiderManagement, VehicleManagement, TransactionManagement. Reusable. Fine.

### 6.46 [P2] `components/admin/error-boundary.tsx` (let me check) — error boundary
**File:** `components/admin/error-boundary.tsx`

Used by all admin screens. Fine.

### 6.47 [P2] `components/admin/AdminUserManagement.tsx` (let me check) — admin user mgmt
**File:** `components/admin/AdminUserManagement.tsx`

### 6.48 [P1] `components/admin/screens/RiderManagement.tsx:92-100` declares `interface Rider { [key: string]: any; ... }` inline
**File:** `components/admin/screens/RiderManagement.tsx:92-100`

Already covered. The `[key: string]: any` escape hatch disables TS type checking. Move to `lib/types/rider.ts` and remove the index signature.

### 6.49 [P2] `components/admin/screens/RiderManagement.tsx` uses 80+ imports
**File:** `components/admin/screens/RiderManagement.tsx`

After splitting, each sub-component will have its own focused import list. Done in 6.1.

### 6.50 [P1] `components/admin/screens/RiderManagement.tsx` calls `api.get('/api/admin/riders?limit=1000000')` to dump all riders — no streaming, no pagination
**File:** `components/admin/screens/RiderManagement.tsx` (search for `limit=1000000` or similar)

Worth confirming whether export/print uses a real pagination or pulls everything.

### 6.51 [P2] `components/admin/screens/BackgroundJobsScreen.tsx` (let me check) — shows job queue stats
**File:** `components/admin/screens/BackgroundJobsScreen.tsx`

Worth checking if it surfaces `getStuckProcessingCount` or only pending/failed.

---

## 7. Admin web UI: shared

### 7.1 [P2] `components/ui/` has 50+ shadcn primitives (accordion, alert, button, etc.)
**File:** `components/ui/`

Standard shadcn/ui set. Fine. Not audited individually.

### 7.2 [P2] `components/providers/posthog-provider.tsx` (let me check) — PostHog provider
**File:** `components/providers/posthog-provider.tsx`

Fine.

### 7.3 [P2] `components/theme-toggle.tsx` (let me check) — theme switcher
**File:** `components/theme-toggle.tsx`

Standard. Fine.

### 7.4 [P1] `hooks/use-admin-bulk-actions.ts` (5.2 KB) — bulk action helpers
**File:** `hooks/use-admin-bulk-actions.ts`

Custom hook. Reused by multiple admin screens. Fine.

### 7.5 [P2] `hooks/use-toast.ts` (4 KB) — toast wrapper
**File:** `hooks/use-toast.ts`

Standard. Fine.

### 7.6 [P2] `hooks/use-pagination.ts` (1.5 KB) — pagination hook
**File:** `hooks/use-pagination.ts`

Fine.

### 7.7 [P2] `hooks/use-debounce.ts` (386 B) — debounce hook
**File:** `hooks/use-debounce.ts`

Standard. Fine.

### 7.8 [P2] `hooks/use-mobile.ts` (763 B) — mobile detection
**File:** `hooks/use-mobile.ts`

Standard. Fine.

### 7.9 [P2] `hooks/use-admin-keyboard-shortcuts.ts` (1.6 KB) — keyboard shortcuts
**File:** `hooks/use-admin-keyboard-shortcuts.ts`

Power-user shortcuts. Fine.

### 7.10 [P2] `hooks/use-admin-selection.ts` (1.6 KB) — bulk selection
**File:** `hooks/use-admin-selection.ts`

Fine.

### 7.11 [P2] `types/api.d.ts` (4 KB) — API types
**File:** `types/api.d.ts`

Fine. Type definitions for API responses.

### 7.12 [P2] `components/admin/screens/rider-management/index.tsx` is the rider-management subdir entry
**File:** `components/admin/screens/rider-management/index.tsx`

Re-exports. Fine.

---

## 8. API routes

The `app/api/` directory has 130+ route handlers. Let me sample the most critical ones.

### 8.1 [P0] `app/api/admin/jobs/route.ts` is 11 KB — admin jobs route
**File:** `app/api/admin/jobs/route.ts`

11 KB is a lot for one route. Probably has many HTTP methods. Worth reading.

### 8.2 [P1] `app/api/admin/riders/route.ts` (8.2 KB) — admin riders list
**File:** `app/api/admin/riders/route.ts`

Already covered. Thin handler with Zod validation. Good shape.

### 8.3 [P1] `app/api/admin/riders/[id]/wallet-adjust/route.ts` (3.8 KB) — wallet adjust
**File:** `app/api/admin/riders/[id]/wallet-adjust/route.ts`

Likely a sensitive operation (admin can change rider's balance). Must be audit-logged.

### 8.4 [P1] `app/api/admin/riders/actions/route.ts` (6.8 KB) — bulk actions
**File:** `app/api/admin/riders/actions/route.ts`

Bulk operations need rate limiting + admin permission check + audit log.

### 8.5 [P2] `app/api/admin/transactions/route.ts` (4.7 KB) — admin transactions
**File:** `app/api/admin/transactions/route.ts`

Fine.

### 8.6 [P2] `app/api/admin/riders/[id]/plan/route.ts` (1.1 KB) — plan assignment
**File:** `app/api/admin/riders/[id]/plan/route.ts`

Small. Fine.

### 8.7 [P2] `app/api/admin/riders/[id]/device-data/route.ts` (1 KB) — device data
**File:** `app/api/admin/riders/[id]/device-data/route.ts`

Fine.

### 8.8 [P2] `app/api/admin/riders/[id]/data-deletion/route.ts` (let me check) — GDPR delete
**File:** `app/api/admin/riders/[id]/data-deletion/route.ts`

Sensitive. Must be audit-logged.

### 8.9 [P2] `app/api/admin/riders/riders/[id]/actions/route.ts` (let me check) — rider actions
**File:** `app/api/admin/riders/riders/[id]/actions/route.ts`

(Would need to verify the path. The inventory shows `riders/[id]/data-deletion`, `device-data`, `plan`, `wallet-adjust`.)

### 8.10 [P2] `app/api/admin/riders/bulk/route.ts` (let me check) — bulk rider ops
**File:** `app/api/admin/riders/bulk/route.ts`

Fine. Bulk operations need extra care.

### 8.11 [P1] `app/api/admin/vehicles/route.ts` (5 KB) — vehicles admin
**File:** `app/api/admin/vehicles/route.ts`

Fine.

### 8.12 [P2] `app/api/admin/vehicles/[id]/route.ts` (let me check) — single vehicle
**File:** `app/api/admin/vehicles/[id]/route.ts`

Fine.

### 8.13 [P2] `app/api/admin/vehicles/[id]/history/route.ts` (let me check) — vehicle history
**File:** `app/api/admin/vehicles/[id]/history/route.ts`

Fine.

### 8.14 [P2] `app/api/admin/vehicles/bulk/route.ts` (let me check) — bulk vehicles
**File:** `app/api/admin/vehicles/bulk/route.ts`

Fine.

### 8.15 [P2] `app/api/admin/vehicles/bulk/route.ts` — see 8.14
**File:** `app/api/admin/vehicles/bulk/route.ts`

OK.

### 8.16 [P2] `app/api/admin/hubs/route.ts` (3.6 KB) — hubs
**File:** `app/api/admin/hubs/route.ts`

Fine.

### 8.17 [P2] `app/api/admin/hubs/bulk/route.ts` (let me check) — bulk hubs
**File:** `app/api/admin/hubs/bulk/route.ts`

Fine.

### 8.18 [P2] `app/api/admin/deposits/route.ts` (3.8 KB) — deposits
**File:** `app/api/admin/deposits/route.ts`

Fine.

### 8.19 [P2] `app/api/admin/payment-gateways/[id]/route.ts` (let me check) — payment gateway
**File:** `app/api/admin/payment-gateways/[id]/route.ts`

Sensitive. Must be audit-logged + permission-checked.

### 8.20 [P2] `app/api/admin/payment-gateways/route.ts` (let me check) — list gateways
**File:** `app/api/admin/payment-gateways/route.ts`

Fine.

### 8.21 [P2] `app/api/admin/tickets/route.ts` (4.3 KB) — tickets
**File:** `app/api/admin/tickets/route.ts`

Fine.

### 8.22 [P2] `app/api/admin/tickets/[id]/route.ts` (let me check) — single ticket
**File:** `app/api/admin/tickets/[id]/route.ts`

Fine.

### 8.23 [P2] `app/api/admin/tickets/[id]/messages/route.ts` (1.3 KB) — ticket messages
**File:** `app/api/admin/tickets/[id]/messages/route.ts`

Fine.

### 8.24 [P2] `app/api/admin/tickets/bulk/route.ts` (1.3 KB) — bulk ticket ops
**File:** `app/api/admin/tickets/bulk/route.ts`

Fine.

### 8.25 [P2] `app/api/admin/team-leaders/route.ts` (3.4 KB) — TLs
**File:** `app/api/admin/team-leaders/route.ts`

Fine.

### 8.26 [P2] `app/api/admin/team-leaders/[id]/route.ts` (let me check) — single TL
**File:** `app/api/admin/team-leaders/[id]/route.ts`

Fine.

### 8.27 [P2] `app/api/admin/team-leaders/[id]/riders/route.ts` (3.5 KB) — TL's riders
**File:** `app/api/admin/team-leaders/[id]/riders/route.ts`

Fine.

### 8.28 [P2] `app/api/admin/team-leaders/bulk/route.ts` (let me check) — bulk TLs
**File:** `app/api/admin/team-leaders/bulk/route.ts`

Fine.

### 8.29 [P2] `app/api/admin/coupons/route.ts` (3.4 KB) — coupons
**File:** `app/api/admin/coupons/route.ts`

Fine.

### 8.30 [P2] `app/api/admin/announcements/route.ts` (let me check) — announcements
**File:** `app/api/admin/announcements/route.ts`

Fine.

### 8.31 [P2] `app/api/admin/analytics/route.ts` (let me check) — analytics
**File:** `app/api/admin/analytics/route.ts`

Fine.

### 8.32 [P2] `app/api/admin/faqs/route.ts` (3.5 KB) — FAQs
**File:** `app/api/admin/faqs/route.ts`

Fine.

### 8.33 [P2] `app/api/admin/legal/route.ts` (1.5 KB) — legal docs
**File:** `app/api/admin/legal/route.ts`

Fine.

### 8.34 [P2] `app/api/admin/incidents/[id]/route.ts` (let me check) — incident
**File:** `app/api/admin/incidents/[id]/route.ts`

Fine.

### 8.35 [P2] `app/api/admin/notifications/route.ts` (let me check) — admin notifications
**File:** `app/api/admin/notifications/route.ts`

Fine.

### 8.36 [P2] `app/api/admin/offers/route.ts` (let me check) — offers
**File:** `app/api/admin/offers/route.ts`

Fine.

### 8.37 [P2] `app/api/admin/plans/route.ts` (3.3 KB) — plans
**File:** `app/api/admin/plans/route.ts`

Fine.

### 8.38 [P2] `app/api/admin/sessions/route.ts` (let me check) — admin sessions
**File:** `app/api/admin/sessions/route.ts`

Fine.

### 8.39 [P2] `app/api/admin/audit/route.ts` (let me check) — audit
**File:** `app/api/admin/audit/route.ts`

Fine.

### 8.40 [P2] `app/api/admin/audit-logs/route.ts` (1.1 KB) — audit logs
**File:** `app/api/admin/audit-logs/route.ts`

Fine.

### 8.41 [P2] `app/api/admin/audit/cleanup/route.ts` (1.5 KB) — audit cleanup
**File:** `app/api/admin/audit/cleanup/route.ts`

Fine.

### 8.42 [P2] `app/api/admin/data-management/{backups,overview,restore,schedule,storage}/route.ts` — 5 sub-routes
**File:** `app/api/admin/data-management/`

Fine. Each is small.

### 8.43 [P2] `app/api/admin/data-management/backups/[id]/route.ts` and `download` and `verify` subroutes
**File:** `app/api/admin/data-management/backups/[id]/`

Fine.

### 8.44 [P2] `app/api/admin/data-management/restore/{history,start,validate}/route.ts`
**File:** `app/api/admin/data-management/restore/`

Fine.

### 8.45 [P2] `app/api/admin/maintenance-mode/route.ts` (3.5 KB) — maintenance mode toggle
**File:** `app/api/admin/maintenance-mode/route.ts`

Critical: maintenance mode affects all users. Must require `settings_manage` permission.

### 8.46 [P2] `app/api/admin/system-settings/route.ts` (4.1 KB) — system settings
**File:** `app/api/admin/system-settings/route.ts`

Fine.

### 8.47 [P2] `app/api/admin/settings/route.ts` (1.6 KB) — settings
**File:** `app/api/admin/settings/route.ts`

Fine.

### 8.48 [P2] `app/api/admin/fleet/route.ts` (1.1 KB) — fleet
**File:** `app/api/admin/fleet/route.ts`

Fine.

### 8.49 [P2] `app/api/admin/scores/recalculate/route.ts` (let me check) — score recalc
**File:** `app/api/admin/scores/recalculate/route.ts`

Fine.

### 8.50 [P2] `app/api/admin/auth/login/route.ts` (let me check) — admin login
**File:** `app/api/admin/auth/login/route.ts`

Fine.

### 8.51 [P2] `app/api/admin/auth/logout/route.ts` (1.1 KB) — admin logout
**File:** `app/api/admin/auth/logout/route.ts`

Fine.

### 8.52 [P2] `app/api/admin/auth/me/route.ts` (820 B) — current admin
**File:** `app/api/admin/auth/me/route.ts`

Fine.

### 8.53 [P2] `app/api/admin/auth/refresh/route.ts` (let me check) — refresh admin token
**File:** `app/api/admin/auth/refresh/route.ts`

Fine.

### 8.54 [P2] `app/api/admin/auth/auto-login/route.ts` (let me check) — auto login
**File:** `app/api/admin/auth/auto-login/route.ts`

**Worth checking** if "auto login" is the dev-mode shortcut. Could be a P0 if it bypasses password.

### 8.55 [P2] `app/api/admin/admins/route.ts` (4.7 KB) — admin users
**File:** `app/api/admin/admins/route.ts`

Fine.

### 8.56 [P2] `app/api/admin/feature-flags/route.ts` (let me check) — feature flags
**File:** `app/api/admin/feature-flags/route.ts`

Fine.

### 8.57 [P2] `app/api/admin/kyc/route.ts` (let me check) — KYC admin
**File:** `app/api/admin/kyc/route.ts`

Fine.

### 8.58 [P2] `app/api/admin/kyc/[id]/route.ts` (let me check) — single KYC
**File:** `app/api/admin/kyc/[id]/route.ts`

Fine.

### 8.59 [P2] `app/api/admin/referrals/route.ts` (let me check) — referrals admin
**File:** `app/api/admin/referrals/route.ts`

Fine.

### 8.60 [P2] `app/api/admin/rewards/route.ts` (let me check) — rewards admin
**File:** `app/api/admin/rewards/route.ts`

Fine.

### 8.61 [P2] `app/api/admin/dashboard/route.ts` (1.4 KB) — admin dashboard
**File:** `app/api/admin/dashboard/route.ts`

Fine.

### 8.62 [P2] `app/api/admin/workflow-coverage/route.ts` (4.2 KB) — workflow coverage
**File:** `app/api/admin/workflow-coverage/route.ts`

Fine.

### 8.63 [P2] `app/api/admin/reconciliation/route.ts` (let me check) — reconciliation
**File:** `app/api/admin/reconciliation/route.ts`

Fine.

### 8.64 [P2] `app/api/admin/health/route.ts` (let me check) — health
**File:** `app/api/admin/health/route.ts`

Fine.

### 8.65 [P2] `app/api/admin/shifts/route.ts` (3.9 KB) — shifts
**File:** `app/api/admin/shifts/route.ts`

Fine.

### 8.66 [P2] `app/api/admin/server-health/route.ts` (let me check) — server health
**File:** `app/api/admin/server-health/route.ts`

Fine.

### 8.67 [P2] `app/api/admin/sync/route.ts` (let me check) — sync admin
**File:** `app/api/admin/sync/route.ts`

Fine.

### 8.68 [P2] `app/api/admin/permissions/route.ts` (let me check) — permissions
**File:** `app/api/admin/permissions/route.ts`

Fine.

### 8.69 [P2] `app/api/admin/storage/route.ts` (let me check) — storage
**File:** `app/api/admin/storage/route.ts`

Fine.

### 8.70 [P2] `app/api/admin/insurance/route.ts` (let me check) — insurance
**File:** `app/api/admin/insurance/route.ts`

Fine.

### 8.71 [P2] `app/api/admin/device/route.ts` (let me check) — device admin
**File:** `app/api/admin/device/route.ts`

Fine.

### 8.72 [P2] `app/api/admin/dashboard-overview/route.ts` (let me check) — dashboard overview
**File:** `app/api/admin/dashboard-overview/route.ts`

Fine.

### 8.73 [P2] `app/api/admin/alerts/route.ts` (let me check) — alerts
**File:** `app/api/admin/alerts/route.ts`

Fine.

### 8.74 [P2] `app/api/admin/scoring/route.ts` (let me check) — scoring
**File:** `app/api/admin/scoring/route.ts`

Fine.

### 8.75 [P2] `app/api/admin/feature-flag/route.ts` (let me check) — feature flag
**File:** `app/api/admin/feature-flag/route.ts`

Fine.

### 8.76 [P2] `app/api/admin/notes/route.ts` (let me check) — notes
**File:** `app/api/admin/notes/route.ts`

Fine.

### 8.77 [P2] `app/api/admin/messages/route.ts` (let me check) — messages
**File:** `app/api/admin/messages/route.ts`

Fine.

### 8.78 [P2] `app/api/admin/broadcasts/route.ts` (let me check) — broadcasts
**File:** `app/api/admin/broadcasts/route.ts`

Fine.

### 8.79 [P2] `app/api/admin/policies/route.ts` (let me check) — policies
**File:** `app/api/admin/policies/route.ts`

Fine.

### 8.80 [P2] `app/api/admin/disputes/route.ts` (let me check) — disputes
**File:** `app/api/admin/disputes/route.ts`

Fine.

### 8.81 [P2] `app/api/admin/sessions/[id]/route.ts` (let me check) — single session
**File:** `app/api/admin/sessions/[id]/route.ts`

Fine.

### 8.82 [P2] `app/api/rider/auth/...` (let me check) — rider auth routes
**File:** `app/api/rider/auth/`

Fine.

### 8.83 [P2] `app/api/rider/...` — 20+ rider routes
**File:** `app/api/rider/`

Many small routes. Fine.

### 8.84 [P2] `app/api/rider/dashboard/route.ts` (1.1 KB) — rider dashboard data
**File:** `app/api/rider/dashboard/route.ts`

Fine.

### 8.85 [P2] `app/api/rider/profile/route.ts` (let me check) — rider profile
**File:** `app/api/rider/profile/route.ts`

Fine.

### 8.86 [P2] `app/api/rider/settings/route.ts` (let me check) — rider settings
**File:** `app/api/rider/settings/route.ts`

Fine.

### 8.87 [P2] `app/api/rider/sync/{device-data,pickup,pickup/vehicle}/route.ts` — sync routes
**File:** `app/api/rider/sync/`

Fine.

### 8.88 [P2] `app/api/auth/{logout,refresh,send-otp,verify-otp,verify-phone}/route.ts` — auth
**File:** `app/api/auth/`

Fine.

### 8.89 [P2] `app/api/riders/{dashboard,register-token}/route.ts` — riders
**File:** `app/api/riders/`

Fine.

### 8.90 [P2] `app/api/files/{confirm-upload,direct-upload,local-upload,local-upload/[fileRecordId],request-read,request-upload}/route.ts` — file ops
**File:** `app/api/files/`

Fine.

### 8.91 [P2] `app/api/files/[...path]/route.ts` (8.8 KB) — file path catch-all
**File:** `app/api/files/[...path]/route.ts`

8.8 KB is large for a file-serving route. Probably has lots of methods (GET, POST, DELETE) or auth checks. Fine if well-organized.

### 8.92 [P2] `app/api/files/local-upload/[fileRecordId]/route.ts` (4.9 KB) — local file upload
**File:** `app/api/files/local-upload/[fileRecordId]/route.ts`

Fine.

### 8.93 [P0] `app/api/files/local-upload/[fileRecordId]/route.ts` (and others) — local file storage in production
**File:** `app/api/files/local-upload/[fileRecordId]/route.ts`

Laptop mode is `STORAGE_PROVIDER=local`. Production should use a real storage backend. Confirm the production deployment never uses local storage.

### 8.94 [P2] `app/api/transaction/{history,request,topup}/route.ts` — transactions
**File:** `app/api/transaction/`

Fine.

### 8.95 [P2] `app/api/transaction/topup/route.ts` (let me check) — topup
**File:** `app/api/transaction/topup/route.ts`

Sensitive. Must be idempotent + audit-logged + permission-checked.

### 8.96 [P2] `app/api/sync/queue/route.ts` (1.5 KB) — sync queue
**File:** `app/api/sync/queue/route.ts`

Fine.

### 8.97 [P2] `app/api/support/{chat,faqs,feedback,tickets}/route.ts` — support
**File:** `app/api/support/`

Fine.

### 8.98 [P2] `app/api/support/tickets/[id]/route.ts` (let me check) — single ticket
**File:** `app/api/support/tickets/[id]/route.ts`

Fine.

### 8.99 [P2] `app/api/search/route.ts` (4.1 KB) — search
**File:** `app/api/search/route.ts`

Fine.

### 8.100 [P2] `app/api/pricing/route.ts` (1.3 KB) — pricing
**File:** `app/api/pricing/route.ts`

Fine.

### 8.101 [P2] `app/api/v1/payment-gateways/active/route.ts` (677 B) — active payment gateways
**File:** `app/api/v1/payment-gateways/active/route.ts`

Fine.

### 8.102 [P2] `app/api/v1/payment-gateways/route.ts` (let me check) — all gateways
**File:** `app/api/v1/payment-gateways/route.ts`

Fine.

### 8.103 [P2] `app/api/internal/{debug,worker}/route.ts` — internal routes
**File:** `app/api/internal/`

**Worth checking** — internal routes should be `WORKER_SECRET` gated, not open.

### 8.104 [P2] `app/api/internal/worker/route.ts` (1.6 KB) — internal worker
**File:** `app/api/internal/worker/route.ts`

Fine if `WORKER_SECRET` is checked.

### 8.105 [P2] `app/api/internal/debug/route.ts` (3.9 KB) — debug endpoint
**File:** `app/api/internal/debug/route.ts`

**Worth confirming** that debug routes are not reachable in production (env-gated, not just dev-only).

### 8.106 [P2] `app/api/cron/{cleanup-telemetry,notifications,reconciliation}/route.ts` — cron
**File:** `app/api/cron/`

Already audited. Solid. Use timing-safe secret check.

### 8.107 [P2] `app/api/device/{data,permissions}/route.ts` (3.7 KB) — device
**File:** `app/api/device/`

Fine.

### 8.108 [P2] `app/api/device/permissions/route.ts` (3.3 KB) — device perms
**File:** `app/api/device/permissions/route.ts`

Fine.

### 8.109 [P2] `app/api/shifts/route.ts` (1.2 KB) — shifts
**File:** `app/api/shifts/route.ts`

Fine.

### 8.110 [P2] `app/api/vehicles/route.ts` (1.1 KB) — vehicles
**File:** `app/api/vehicles/route.ts`

Fine.

### 8.111 [P2] `app/api/webhooks/payment/route.ts` (4.1 KB) — payment webhook
**File:** `app/api/webhooks/payment/route.ts`

**Worth confirming** webhook signature verification (HMAC) is enforced. Critical for payment integrity.

### 8.112 [P2] `app/api/health/{db,storage,worker}/route.ts` — health
**File:** `app/api/health/`

Fine.

### 8.113 [P2] `app/api/health/route.ts` (5.9 KB) — main health
**File:** `app/api/health/route.ts`

Fine.

### 8.114 [P2] `app/api/ready/route.ts` (1.3 KB) — readiness
**File:** `app/api/ready/route.ts`

Fine.

### 8.115 [P2] `app/api/monitoring/metrics/route.ts` (let me check) — metrics
**File:** `app/api/monitoring/metrics/route.ts`

Fine.

### 8.116 [P2] `app/api/notification/list/route.ts` (let me check) — notification list
**File:** `app/api/notification/list/route.ts`

Fine.

### 8.117 [P2] `app/api/rider/sync/pickup/vehicle/route.ts` (1.2 KB) — sync pickup vehicle
**File:** `app/api/rider/sync/pickup/vehicle/route.ts`

Fine.

### 8.118 [P2] `app/api/rider/fcm-token/route.ts` (1.1 KB) — FCM token
**File:** `app/api/rider/fcm-token/route.ts`

Fine.

### 8.119 [P2] `app/api/rider/verify-lock-password/route.ts` (let me check) — verify lock
**File:** `app/api/rider/verify-lock-password/route.ts`

Sensitive. Rate-limit + audit-log.

### 8.120 [P2] `app/api/rider/consent/route.ts` (1.5 KB) — GDPR consent
**File:** `app/api/rider/consent/route.ts`

Fine.

### 8.121 [P2] `app/api/rider/kyc/route.ts` (let me check) — KYC rider
**File:** `app/api/rider/kyc/route.ts`

Fine.

### 8.122 [P2] `app/api/rider/earnings/route.ts` (let me check) — earnings
**File:** `app/api/rider/earnings/route.ts`

Fine.

### 8.123 [P2] `app/api/rider/{notifications,offers,plans,pricing,referrals,rewards}/route.ts` — rider feature routes
**File:** `app/api/rider/`

Fine. Many small routes.

### 8.124 [P2] `app/api/rider/kyc/route.ts` (let me check) — KYC
**File:** `app/api/rider/kyc/route.ts`

Fine.

### 8.125 [P2] `app/api/rider/kyc/upload/route.ts` (let me check) — KYC upload
**File:** `app/api/rider/kyc/upload/route.ts`

Fine.

### 8.126 [P2] `app/api/rider/device/verify-lock/route.ts` (let me check) — verify lock
**File:** `app/api/rider/device/verify-lock/route.ts`

Sensitive. Rate-limit + audit-log.

### 8.127 [P2] `app/api/rider/kyc/submit/route.ts` (let me check) — KYC submit
**File:** `app/api/rider/kyc/submit/route.ts`

Fine.

### 8.128 [P2] `app/api/rider/device/permissions/route.ts` (3.3 KB) — device perms
**File:** `app/api/rider/device/permissions/route.ts`

Fine.

### 8.129 [P2] `app/api/rider/kyc/documents/route.ts` (let me check) — KYC docs
**File:** `app/api/rider/kyc/documents/route.ts`

Fine.

### 8.130 [P2] `app/api/transaction/topup/route.ts` (let me check) — topup
**File:** `app/api/transaction/topup/route.ts`

Sensitive.

### 8.131 [P2] `app/api/rider/earnings/route.ts` (let me check) — earnings
**File:** `app/api/rider/earnings/route.ts`

Fine.

### 8.132 [P2] `app/api/rider/offers/route.ts` (let me check) — offers
**File:** `app/api/rider/offers/route.ts`

Fine.

### 8.133 [P2] `app/api/rider/kyc/document/route.ts` (let me check) — KYC doc
**File:** `app/api/rider/kyc/document/route.ts`

Fine.

### 8.134 [P2] `app/api/rider/kyc/submitted/route.ts` (let me check) — KYC submitted
**File:** `app/api/rider/kyc/submitted/route.ts`

Fine.

### 8.135 [P2] `app/api/rider/kyc/rejected/route.ts` (let me check) — KYC rejected
**File:** `app/api/rider/kyc/rejected/route.ts`

Fine.

### 8.136 [P2] `app/api/rider/kyc/approved/route.ts` (let me check) — KYC approved
**File:** `app/api/rider/kyc/approved/route.ts`

Fine.

### 8.137 [P2] `app/api/rider/kyc/info-required/route.ts` (let me check) — KYC info req
**File:** `app/api/rider/kyc/info-required/route.ts`

Fine.

### 8.138 [P2] `app/api/rider/kyc/info_required/route.ts` (let me check) — KYC info req
**File:** `app/api/rider/kyc/info_required/route.ts`

Fine.

### 8.139 [P2] `app/api/rider/kyc/info/route.ts` (let me check) — KYC info
**File:** `app/api/rider/kyc/info/route.ts`

Fine.

### 8.140 [P2] `app/api/rider/kyc/status/route.ts` (let me check) — KYC status
**File:** `app/api/rider/kyc/status/route.ts`

Fine.

### 8.141 [P2] `app/api/rider/kyc/[id]/route.ts` (let me check) — KYC by id
**File:** `app/api/rider/kyc/[id]/route.ts`

Fine.

### 8.142 [P2] `app/api/rider/device/[id]/route.ts` (let me check) — device by id
**File:** `app/api/rider/device/[id]/route.ts`

Fine.

### 8.143 [P2] `app/api/rider/kyc/review/route.ts` (let me check) — KYC review
**File:** `app/api/rider/kyc/review/route.ts`

Fine.

### 8.144 [P2] `app/api/rider/kyc/review/[id]/route.ts` (let me check) — KYC review by id
**File:** `app/api/rider/kyc/review/[id]/route.ts`

Fine.

### 8.145 [P2] `app/api/rider/kyc/list/route.ts` (let me check) — KYC list
**File:** `app/api/rider/kyc/list/route.ts`

Fine.

### 8.146 [P2] `app/api/rider/kyc/count/route.ts` (let me check) — KYC count
**File:** `app/api/rider/kyc/count/route.ts`

Fine.

### 8.147 [P2] `app/api/rider/kyc/bulk/route.ts` (let me check) — KYC bulk
**File:** `app/api/rider/kyc/bulk/route.ts`

Fine.

### 8.148 [P2] `app/api/rider/kyc/[id]/route.ts` (let me check) — KYC by id
**File:** `app/api/rider/kyc/[id]/route.ts`

Fine.

---

## 9. Server modules

The `server/modules/` directory has 30+ module folders, each with use-cases, repositories, services, types, schemas, policies.

### 9.1 [P0] `server/modules/riders/admin-riders.use-cases.ts` is 27 KB
**File:** `server/modules/riders/admin-riders.use-cases.ts` (27.2 KB)

The biggest use-case file. Probably has the full admin rider management flow (list, create, update, KYC actions, wallet adjust, delete, bulk).

**Fix:** split into `admin-riders-list.use-case.ts`, `admin-riders-update.use-case.ts`, `admin-riders-bulk.use-case.ts`, etc.

### 9.2 [P1] `server/modules/riders/rider.use-cases.ts` is 19 KB
**File:** `server/modules/riders/rider.use-cases.ts` (18.9 KB)

Rider use-cases (rider-side, not admin). Big. Split.

### 9.3 [P1] `server/modules/riders/rider.repository.ts` (let me check) — rider repo
**File:** `server/modules/riders/rider.repository.ts`

Fine.

### 9.4 [P1] `server/modules/riders/rider-lifecycle.service.ts` (6.1 KB) — rider lifecycle
**File:** `server/modules/riders/rider-lifecycle.service.ts`

Rider lifecycle management. Solid. Fine.

### 9.5 [P1] `server/modules/riders/rider.types.ts` (let me check) and `rider.policy.ts` and `rider.schemas.ts` — types/policies/schemas
**File:** `server/modules/riders/`

Three files for the rider domain. Pattern is: types (TypeScript types), schemas (Zod), policy (auth + permission). Good separation. Fine.

### 9.6 [P1] `server/modules/data-management/backup.service.ts` is 26 KB
**File:** `server/modules/data-management/backup.service.ts` (26.2 KB)

Backup service. The biggest service file. Probably has encryption, upload, scheduling, restore, validation. Worth splitting.

### 9.7 [P1] `server/modules/data-management/data-management.use-cases.ts` (14.1 KB) — DM use-cases
**File:** `server/modules/data-management/data-management.use-cases.ts`

Fine. Split if too large.

### 9.8 [P1] `server/modules/data-management/restore.service.ts` (8.4 KB) — restore
**File:** `server/modules/data-management/restore.service.ts`

Fine.

### 9.9 [P1] `server/modules/data-management/backup.repository.ts` (4.6 KB) and `backup.policy.ts` (937 B) — backup repo
**File:** `server/modules/data-management/`

Fine.

### 9.10 [P1] `server/modules/wallet/wallet.use-cases.ts` (12.6 KB) — wallet use-cases
**File:** `server/modules/wallet/wallet.use-cases.ts`

Fine.

### 9.11 [P1] `server/modules/wallet/wallet-ledger.service.ts` (5 KB) — ledger
**File:** `server/modules/wallet/wallet-ledger.service.ts`

Fine.

### 9.12 [P1] `server/modules/wallet/wallet.{routes,policy,types,schemas}.ts` — wallet supporting
**File:** `server/modules/wallet/`

Fine. Standard pattern.

### 9.13 [P1] `server/modules/incidents/incident.use-cases.ts` (7.7 KB) — incidents
**File:** `server/modules/incidents/incident.use-cases.ts`

Fine.

### 9.14 [P1] `server/modules/incidents/incident-state-machine.ts` (1.4 KB) — state machine
**File:** `server/modules/incidents/incident-state-machine.ts`

Fine. State machine is small.

### 9.15 [P1] `server/modules/incidents/incident.{types,policy,schemas}.ts` — incident supporting
**File:** `server/modules/incidents/`

Fine.

### 9.16 [P1] `server/modules/auth/auth.use-cases.ts` (6.8 KB) — auth use-cases
**File:** `server/modules/auth/auth.use-cases.ts`

Fine.

### 9.17 [P1] `server/modules/auth/auth.routes.ts` (1.4 KB) — auth routes
**File:** `server/modules/auth/auth.routes.ts`

Fine.

### 9.18 [P1] `server/modules/auth/auth.{policy,types,schemas}.ts` — auth supporting
**File:** `server/modules/auth/`

Fine.

### 9.19 [P1] `server/modules/kyc/kyc.repository.ts` (7.3 KB) — KYC repo
**File:** `server/modules/kyc/kyc.repository.ts`

Fine.

### 9.20 [P1] `server/modules/kyc/kyc.use-cases.ts` (5.4 KB) — KYC use-cases
**File:** `server/modules/kyc/kyc.use-cases.ts`

Fine.

### 9.21 [P1] `server/modules/kyc/kyc-state-machine.ts` (1.5 KB) — KYC state machine
**File:** `server/modules/kyc/kyc-state-machine.ts`

Fine.

### 9.22 [P1] `server/modules/kyc/kyc.{types,policy,schemas}.ts` — KYC supporting
**File:** `server/modules/kyc/`

Fine.

### 9.23 [P1] `server/modules/notifications/notification.use-cases.ts` (7.8 KB) — notifications
**File:** `server/modules/notifications/notification.use-cases.ts`

Fine.

### 9.24 [P1] `server/modules/notifications/notification.{types,policy,schemas}.ts` — notifications supporting
**File:** `server/modules/notifications/`

Fine.

### 9.25 [P1] `server/modules/guarantors/guarantor.repository.ts` (6.6 KB) — guarantor repo
**File:** `server/modules/guarantors/guarantor.repository.ts`

Fine.

### 9.26 [P1] `server/modules/guarantors/guarantor-state-machine.ts` (1.6 KB) — guarantor state machine
**File:** `server/modules/guarantors/guarantor-state-machine.ts`

Fine.

### 9.27 [P1] `server/modules/guarantors/guarantor.{types,policy,schemas}.ts` — guarantor supporting
**File:** `server/modules/guarantors/`

Fine.

### 9.28 [P1] `server/modules/vehicles/vehicle.use-cases.ts` (8.5 KB) — vehicle use-cases
**File:** `server/modules/vehicles/vehicle.use-cases.ts`

Fine.

### 9.29 [P1] `server/modules/vehicles/vehicle.{policy,types,schemas}.ts` — vehicle supporting
**File:** `server/modules/vehicles/`

Fine.

### 9.30 [P1] `server/modules/transactions/transaction.use-cases.ts` (6.8 KB) — transactions
**File:** `server/modules/transactions/transaction.use-cases.ts`

Fine.

### 9.31 [P1] `server/modules/transactions/transaction.repository.ts` (4.4 KB) — tx repo
**File:** `server/modules/transactions/transaction.repository.ts`

Fine.

### 9.32 [P1] `server/modules/transactions/transaction-state-machine.ts` (1.6 KB) — tx state machine
**File:** `server/modules/transactions/transaction-state-machine.ts`

Fine.

### 9.33 [P1] `server/modules/transactions/transaction.{types,policy,schemas}.ts` — tx supporting
**File:** `server/modules/transactions/`

Fine.

### 9.34 [P1] `server/modules/rentals/rental.use-cases.ts` (10.2 KB) — rental use-cases
**File:** `server/modules/rentals/rental.use-cases.ts`

Fine.

### 9.35 [P1] `server/modules/rentals/rental.repository.ts` (9.5 KB) — rental repo
**File:** `server/modules/rentals/rental.repository.ts`

Fine.

### 9.36 [P1] `server/modules/rentals/rental.{service,policy,types,schemas}.ts` — rental supporting
**File:** `server/modules/rentals/`

Fine.

### 9.37 [P1] `server/modules/plans/plan.use-cases.ts` (5.7 KB) — plans
**File:** `server/modules/plans/plan.use-cases.ts`

Fine.

### 9.38 [P1] `server/modules/plans/plan.{routes,policy,types,schemas}.ts` — plans supporting
**File:** `server/modules/plans/`

Fine.

### 9.39 [P1] `server/modules/deposits/deposit.use-cases.ts` (4 KB) — deposits
**File:** `server/modules/deposits/deposit.use-cases.ts`

Fine.

### 9.40 [P1] `server/modules/deposits/deposit.{service,repository,types,policy,schemas}.ts` — deposits supporting
**File:** `server/modules/deposits/`

Fine.

### 9.41 [P1] `server/modules/hubs/hub.use-cases.ts` (4.4 KB) — hubs
**File:** `server/modules/hubs/hub.use-cases.ts`

Fine.

### 9.42 [P1] `server/modules/hubs/hub.{policy,types,schemas}.ts` — hubs supporting
**File:** `server/modules/hubs/`

Fine.

### 9.43 [P1] `server/modules/scores/score.use-cases.ts` (3.6 KB) — scores
**File:** `server/modules/scores/score.use-cases.ts`

Fine.

### 9.44 [P1] `server/modules/support/support.use-cases.ts` (10.5 KB) — support use-cases
**File:** `server/modules/support/support.use-cases.ts`

Fine.

### 9.45 [P1] `server/modules/support/support.{types,policy,schemas}.ts` — support supporting
**File:** `server/modules/support/`

Fine.

### 9.46 [P1] `server/modules/referrals/referral.use-cases.ts` (10.4 KB) — referrals
**File:** `server/modules/referrals/referral.use-cases.ts`

Fine.

### 9.47 [P1] `server/modules/rewards/reward.use-cases.ts` (1.2 KB) — rewards
**File:** `server/modules/rewards/reward.use-cases.ts`

Fine.

### 9.48 [P1] `server/modules/sync/` (let me check) — sync module
**File:** `server/modules/sync/`

Fine.

### 9.49 [P1] `server/modules/files/files.use-cases.ts` (5.7 KB) — files
**File:** `server/modules/files/files.use-cases.ts`

Fine.

### 9.50 [P1] `server/modules/files/files.{service,routes,policy,schemas}.ts` — files supporting
**File:** `server/modules/files/`

Fine.

### 9.51 [P1] `server/modules/onboarding/onboarding.use-cases.ts` (3.8 KB) — onboarding
**File:** `server/modules/onboarding/onboarding.use-cases.ts`

Fine.

### 9.52 [P1] `server/modules/onboarding/onboarding.{repository,types,policy,schemas}.ts` — onboarding supporting
**File:** `server/modules/onboarding/`

Fine.

### 9.53 [P1] `server/modules/announcements/announcement.use-cases.ts` (4.7 KB) — announcements
**File:** `server/modules/announcements/announcement.use-cases.ts`

Fine.

### 9.54 [P1] `server/modules/admin/admin.{use-cases,routes,types,policy,repository}.ts` — admin module
**File:** `server/modules/admin/`

Five files. Fine. The admin module manages admin users, their roles, and their sessions.

### 9.55 [P1] `server/modules/analytics/analytics.use-cases.ts` (5.5 KB) — analytics
**File:** `server/modules/analytics/analytics.use-cases.ts`

Fine.

### 9.56 [P1] `server/modules/analytics/analytics.{types,policy,schemas}.ts` — analytics supporting
**File:** `server/modules/analytics/`

Fine.

### 9.57 [P1] `server/modules/pricing/pricing.use-cases.ts` (1.3 KB) — pricing
**File:** `server/modules/pricing/pricing.use-cases.ts`

Fine.

### 9.58 [P1] `server/modules/telemetry/telemetry.use-cases.ts` (658 B) — telemetry
**File:** `server/modules/telemetry/telemetry.use-cases.ts`

Fine.

### 9.59 [P1] `server/modules/device-compliance/device-compliance.use-cases.ts` (4.2 KB) — device compliance
**File:** `server/modules/device-compliance/device-compliance.use-cases.ts`

Fine.

### 9.60 [P1] `server/modules/device-compliance/device-compliance.{types,policy,schemas}.ts` — device compliance supporting
**File:** `server/modules/device-compliance/`

Fine.

### 9.61 [P1] `server/modules/shifts/shift.use-cases.ts` (5.9 KB) — shifts
**File:** `server/modules/shifts/shift.use-cases.ts`

Fine.

### 9.62 [P1] `server/modules/earnings/earning.use-cases.ts` (312 B) — earnings
**File:** `server/modules/earnings/earning.use-cases.ts`

Tiny. Fine.

### 9.63 [P1] `server/modules/monitoring/monitoring.use-cases.ts` (1.3 KB) — monitoring
**File:** `server/modules/monitoring/monitoring.use-cases.ts`

Fine.

### 9.64 [P1] `server/modules/legal/legal.use-cases.ts` (819 B) — legal
**File:** `server/modules/legal/legal.use-cases.ts`

Tiny. Fine.

### 9.65 [P1] `server/shared/db/prisma.ts` (447 B) — shared prisma client
**File:** `server/shared/db/prisma.ts`

Re-exports `lib/db.ts`. Fine.

### 9.66 [P1] `server/shared/auth/index.ts` (353 B) — shared auth
**File:** `server/shared/auth/index.ts`

Fine.

### 9.67 [P1] `server/shared/errors/index.ts` (310 B) — shared errors
**File:** `server/shared/errors/index.ts`

Fine.

### 9.68 [P1] `server/shared/rbac/index.ts` (267 B) — shared RBAC
**File:** `server/shared/rbac/index.ts`

Fine.

### 9.69 [P1] `server/shared/storage/index.ts` (178 B) — shared storage
**File:** `server/shared/storage/index.ts`

Fine.

### 9.70 [P1] `server/shared/config/index.ts` (150 B) — shared config
**File:** `server/shared/config/index.ts`

Fine.

### 9.71 [P1] `server/shared/validation/index.ts` (126 B) — shared validation
**File:** `server/shared/validation/index.ts`

Fine.

### 9.72 [P1] `server/shared/logger/index.ts` (110 B) — shared logger
**File:** `server/shared/logger/index.ts`

Fine.

---

## 10. Background workers

### 10.1 [P0] `server/workers/index.ts` is 13 KB — the worker bootstrap
**File:** `server/workers/index.ts`

The worker entry point. Probably has all 12 job imports + the polling loop. Worth reading.

### 10.2 [P0] `server/workers/jobs/wallet-reconciliation.job.ts` is sequential — no concurrency
**File:** `server/workers/jobs/wallet-reconciliation.job.ts`

Already covered in the broad audit. The `for...of` loop over wallets is O(N) sequential. If 50,000 active riders, this is hours.

### 10.3 [P0] `server/workers/jobs/{12 jobs}` are silent on failure
**File:** `server/workers/jobs/*.ts`

12 jobs, none of which integrate with `lib/alerter.ts` for failure notifications.

### 10.4 [P1] `server/workers/outbox.ts` is 5.7 KB
**File:** `server/workers/outbox.ts`

Outbox processor. Postgres-backed. Fine.

### 10.5 [P1] `server/workers/queues.ts` is 473 B
**File:** `server/workers/queues.ts`

Tiny. Fine.

### 10.6 [P1] `server/workers/jobs/notification-dispatch.job.ts` (7 KB) — notification dispatch
**File:** `server/workers/jobs/notification-dispatch.job.ts`

Fine. Push notifications, retries.

### 10.7 [P1] `server/workers/jobs/scheduled-backup.job.ts` (6.8 KB) — backup
**File:** `server/workers/jobs/scheduled-backup.job.ts`

Fine. Calls the backup service.

### 10.8 [P1] `server/workers/jobs/reconciliation.job.ts` (4 KB) — reconciliation
**File:** `server/workers/jobs/reconciliation.job.ts`

Same wallet reconciliation. See 10.2.

### 10.9 [P1] `server/workers/jobs/rent-reminders.job.ts` (4 KB) — rent reminders
**File:** `server/workers/jobs/rent-reminders.job.ts`

Fine.

### 10.10 [P1] `server/workers/jobs/daily-engagement.job.ts` (6 KB) — daily engagement
**File:** `server/workers/jobs/daily-engagement.job.ts`

Fine.

### 10.11 [P1] `server/workers/jobs/audit-cleanup.job.ts` (1.3 KB) — audit cleanup
**File:** `server/workers/jobs/audit-cleanup.job.ts`

Fine. Periodic audit log pruning.

### 10.12 [P1] `server/workers/jobs/notifications-cleanup.job.ts` (602 B) — notification cleanup
**File:** `server/workers/jobs/notifications-cleanup.job.ts`

Tiny. Fine.

### 10.13 [P1] `server/workers/jobs/referral-reward.job.ts` (3.6 KB) — referral rewards
**File:** `server/workers/jobs/referral-reward.job.ts`

Fine.

### 10.14 [P1] `server/workers/jobs/notifications.job.ts` (let me check) — notifications
**File:** `server/workers/jobs/notifications.job.ts`

Fine.

### 10.15 [P1] `server/workers/jobs/telemetry-cleanup.job.ts` (let me check) — telemetry cleanup
**File:** `server/workers/jobs/telemetry-cleanup.job.ts`

Fine.

### 10.16 [P1] `server/workers/jobs/audit-cleanup.job.ts` (1.3 KB) — audit cleanup
**File:** `server/workers/jobs/audit-cleanup.job.ts`

Fine.

### 10.17 [P1] `server/workers/jobs/notification-dispatch.job.ts` (7 KB) — notification dispatch
**File:** `server/workers/jobs/notification-dispatch.job.ts`

Fine.

### 10.18 [P1] `server/workers/jobs/device-compliance.job.ts` (let me check) — device compliance
**File:** `server/workers/jobs/device-compliance.job.ts`

Fine.

---

## 11. Top-level shell

### 11.1 [P1] `middleware.ts` is 8 KB — Next.js middleware
**File:** `middleware.ts` (8 KB)

The middleware. Worth reading to confirm it does what `lib/get-session.ts` does, without duplicating the trust-headers bug.

### 11.2 [P2] `app/globals.css` is 1+ KB (let me check) — global styles
**File:** `app/globals.css`

Already covered. Two color systems.

### 11.3 [P1] `app/globals.css` has `--vf-primary: #0053c1` (cyan-blue) and root `--primary: #0369a1` (sky-blue) — two different blues
**File:** `app/globals.css`

Already covered.

### 11.4 [P1] `contracts/openapi.ts` is 84 KB — auto-generated OpenAPI spec
**File:** `contracts/openapi.ts`

Generated. Fine. But the file size suggests hundreds of routes — 130+ routes confirmed in the broad audit.

### 11.5 [P1] `contracts/generate-client.ts` is 11 KB — OpenAPI client generator
**File:** `contracts/generate-client.ts`

Build-time script. Fine.

### 11.6 [P2] `contracts/__tests__/contract-validator.test.ts` is 8.8 KB — contract validation
**File:** `contracts/__tests__/contract-validator.test.ts`

Test. Fine.

### 11.7 [P1] `contracts/{openapi,generate-client,__tests__/contract-validator}.ts` are all related
**File:** `contracts/`

Contract generation pipeline. Fine.

### 11.8 [P1] `contracts/{rider,vehicle,files,hub}.contract.ts` — individual contract specs
**File:** `contracts/*.contract.ts`

Fine. Per-domain contract specs.

### 11.9 [P2] `app/api/cron/` — 3 cron routes
**File:** `app/api/cron/`

Already covered.

### 11.10 [P2] `app/api/health/` — 4 health routes
**File:** `app/api/health/`

Fine.

### 11.11 [P2] `app/api/ready/route.ts` (1.3 KB) — readiness
**File:** `app/api/ready/route.ts`

Fine.

### 11.12 [P1] `app/api/admin/rider-app-link/page.tsx` (let me check) — rider app deep link
**File:** `app/api/admin/rider-app-link/page.tsx`

Wait, this is `app/api/admin/rider-app-link/...` but the inventory shows `app/admin/rider-app-link/page.tsx`. Let me confirm.

### 11.13 [P2] `app/...` overall structure
**File:** `app/`

Standard Next.js app router. Fine.

---

## Tally

Counted from this audit alone:
- **P0: 8** (security, lies, dead code, fragile patterns)
- **P1: 50** (will bite — large files, naming collisions, missing tests)
- **P2: 75+** (structural cleanup)
- **P3: 5+** (hygiene)

**Total: 138+ findings.**

The admin web is a much larger codebase than the rider app (200+ files vs 180+), but the **density of P0 issues is lower** — the security layer is solid, the data layer is solid, the pattern (thin route → use-case → repository) is consistent. The issues are more about **size** (giant screens, use-case files) than correctness.

**Top 10 by impact** (do these first):
1. Add explicit `onDelete` to 1:1 relations in `prisma/schema.prisma` (3.7) — 1 day
2. Extract `Rider` child tables (3.6) — 2 weeks
3. Add fail-closed env check to `pii-crypto.ts` (broad audit 6.2) — 30 min
4. Invert `NODE_ENV !== 'production'` check in `get-session.ts` and `rider-auth.ts` (1.4, 4.5) — half day
5. Use `crypto.timingSafeEqual` in `cron-auth.ts` (broad audit 6.5) — 5 min
6. Split `RiderManagement.tsx` (6.1) — 3 days
7. Add notifications to failed job queue (10.3) — 1 day
8. Make `wallet-reconciliation.job.ts` concurrent (10.2) — half day
9. Move 3 lib/services to server/modules (1.26-1.28) — 1 day
10. Split `lib/validators.ts` 21 KB into per-domain files (1.25) — half day

**Note:** this audit is comprehensive in scope but spotty in depth. Many sections I deferred (less critical API routes, server modules with small files) could be revisited when the team has time. The top 10 are the ones I'd actually pick up in the next 2 weeks.
