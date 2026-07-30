# Voltium Backend (Next.js API) — Deep-Dive Audit Findings

**Date:** 2026-07-29
**Scope:** `web/src/app/api/**` (130 route files) + `web/src/server/**` (130 module files + 12 job workers)

> **Status (2026-07-30, Pass 4):** 4 of 18 top-level P0s FIXED, 3 PARTIALLY FIXED, 0 STILL TRUE, **2 STALE (audit was wrong)**: #1.8 admin impersonation via x-rider-id (already GET-only restricted), #1.16 NODE_ENV !== production header trust (now strict dev-only opt-in). See [`AUDIT_VERIFICATION_4_2026-07-30.md`](./AUDIT_VERIFICATION_4_2026-07-30.md) §2.
**Method:** File-by-file read. Every finding has file:line evidence and a concrete fix.

This is the third in the audit series, behind `AUDIT_FINDINGS.md` (broad admin web) and `flutter/AUDIT_FINDINGS.md` (Flutter rider app). It is **focused entirely on the backend** — every route handler, every use-case, every state machine, every job worker.

The previous `AUDIT_FINDINGS.md` already covered: `lib/auth.ts`, `lib/rider-auth.ts`, `lib/cron-auth.ts`, `lib/env.ts`, `lib/get-session.ts`, `lib/pii*.ts`, `lib/job-queue.ts`, the broad route file pattern, and `wallet-reconciliation.job.ts`. **This audit does not duplicate those findings** — only adds the deep backend-specific issues, plus everything the broad audit deferred (server modules, state machines, the other 11 job workers, and the 100+ route files it didn't read).

**Companion file:** `D:\voltium\web\AUDIT_API_DEEP.md` (62 KB) holds the per-route deep analysis. This file (`AUDIT_BACKEND.md`) is the primary backend reference; the deep API file provides supporting detail for each route.

## Severity legend

- **P0** — broken behavior, security risk, race condition, comment that lies, money/data corruption
- **P1** — will bite soon (correctness, maintainability, performance, observability)
- **P2** — code smell, missed best practice
- **P3** — nice-to-have / hygiene

## Table of contents

1. [Foundational layer: shared modules + core lib helpers](#1-foundational-layer)
2. [Auth routes (`/api/auth/*`)](#2-auth-routes)
3. [Rider routes (`/api/rider/*`)](#3-rider-routes)
4. [Admin routes (`/api/admin/*`)](#4-admin-routes)
5. [File/asset routes (`/api/files/*`)](#5-fileasset-routes)
6. [Cron + internal routes (`/api/cron/*`, `/api/internal/*`)](#6-cron--internal-routes)
7. [Transaction + payment routes (`/api/transaction/*`, `/api/payment-gateways/*`, `/api/v1/*`)](#7-transaction--payment-routes)
8. [Support + notification + sync routes](#8-support--notification--sync-routes)
9. [Operational routes (`/api/health/*`, `/api/metrics`, `/api/monitoring/*`, `/api/ready`, `/api/search`)](#9-operational-routes)
10. [Webhooks (`/api/webhooks/*`)](#10-webhooks)
11. [Misc routes (`/api/pricing`, `/api/vehicles`, `/api/shifts`, `/api/rental/*`, `/api/device/*`, `/api/riders/*`, `/api/sync/*`)](#11-misc-routes)
12. [Server modules: auth + riders + kyc](#12-server-modules-auth--riders--kyc)
13. [Server modules: wallet + transactions + deposits](#13-server-modules-wallet--transactions--deposits)
14. [Server modules: rentals + vehicles + hubs](#14-server-modules-rentals--vehicles--hubs)
15. [Server modules: guarantors + notifications + files](#15-server-modules-guarantors--notifications--files)
16. [Server modules: onboarding + plans + support + team-leaders + device-compliance](#16-server-modules-onboarding--plans--support--team-leaders--device-compliance)
17. [Server modules: admin + analytics + data-management + audit + announcements + coupons](#17-server-modules-admin--analytics--data-management--audit--announcements--coupons)
18. [Server modules: earnings + legal + monitoring + offers + pricing + referrals + rewards + scores + settings + shifts + sync + telemetry](#18-server-modules-earnings--legal--monitoring--offers--pricing--referrals--rewards--scores--settings--shifts--sync--telemetry)
19. [State machines (7 total)](#19-state-machines)
20. [Job workers (12 total) + outbox + queue](#20-job-workers)
21. [Top 10 critical findings](#21-top-10-critical-findings)
22. [Cross-cutting observations](#22-cross-cutting-observations)

---

## 1. Foundational layer

This section covers the cross-cutting helpers that every route depends on: `server/shared/*` (re-exports), `lib/api-handler.ts`, `lib/api-middleware.ts`, `lib/api-error.ts`, `lib/get-session.ts`, `lib/auth.ts`, `lib/rider-auth.ts`, `lib/env.ts`.

The previous broad audit already covered these in detail. Only NEW findings or DEEPER findings are listed here.

### 1.1 [P0] `lib/api-handler.ts:39-45` — `RentalBookError` is treated as a domain exception by class name string match, not by instanceof

**File:** `web/src/lib/api-handler.ts:39-45`

```ts
// Handle domain-specific exceptions by naming convention
if (domainErr.name === 'RentalBookError') {
  const code = domainErr.code;
  if (code === 'NOT_FOUND') return errors.notFound(domainErr.message);
  if (code === 'CONFLICT') return errors.conflict(domainErr.message);
  return errors.badRequest(domainErr.message);
}
```

The handler matches on `err.name === 'RentalBookError'`, but the **only** error class checked here by name is `RentalBookError`. Other domain errors (`KycStateError`, `GuarantorStateError`, `DepositStateMachineError`, `RentalStateError`) are caught in the same block but **all mapped to `errors.conflict()`** — line 47-54 — without inspecting the error code, so a `NOT_FOUND` from a KYC state machine returns 409 instead of 404.

**Why it matters:** KYC state errors are checked for `name === 'KycStateError'`, but the code only returns `errors.conflict()` regardless of the inner state. A `KycStateError` with `code === 'NOT_FOUND'` (e.g. "KYC submission not found") would be mapped to HTTP 409, not 404. The class names are fragile string matches — renaming a class silently breaks error mapping.

**Fix:** introduce a `DomainError` base class with a `toHttpResponse()` method, or use proper `instanceof` checks. The same `if (err.name === 'X')` pattern would break silently if any class is renamed in a refactor.

### 1.2 [P0] `lib/api-handler.ts:56-58` — substring match on error message to detect 404 is a code smell

**File:** `web/src/lib/api-handler.ts:56-58`

```ts
if (domainErr.message.includes('not found') || domainErr.message.includes('Not found')) {
  return errors.notFound(domainErr.message);
}
```

This is a last-ditch fallback for un-typed errors. It's a footgun: an error message like `"Document not found in storage"` correctly maps to 404, but a message like `"Could not find an available vehicle for this booking"` would also map to 404 when it's actually a domain conflict. Also fragile if the message is i18n'd.

**Fix:** require domain code to throw `NotFoundError` from `@/lib/api-error`. Audit existing use-cases to convert their string-based throws to typed errors.

### 1.3 [P1] `lib/api-handler.ts:19-37` — repeated `err instanceof Error ? err.message : String(err)` ternary

**File:** `web/src/lib/api-handler.ts:29-36`

The same ternary `(err instanceof Error ? err.message : String(err))` is repeated 7 times. It's equivalent to `asDomainError(err).message` defined at the top of the file (line 9-11) but is never used. Pure code-smell.

**Fix:** replace each `(err instanceof Error ? err.message : String(err))` with `domainErr.message`.

### 1.4 [P1] `lib/api-middleware.ts:95` — `withErrorHandler` double-checks `error instanceof Error` in a chain

**File:** `web/src/lib/api-middleware.ts:95`

```ts
error: error instanceof Error ? { name: error.name, message: (error instanceof Error ? err.message : String(error)) } : String(error),
```

The inner `(error instanceof Error ? err.message : String(error))` references an **undefined variable `err`** (the outer is `error`). This is dead code — the inner ternary will throw a `ReferenceError` at runtime, but it never executes because the outer ternary's condition is true. The condition always wins.

**Fix:** delete the dead inner ternary. Also, `withErrorHandler` is **not used by any route file** in `/api/*` (search confirms zero importers). Either remove it or actually use it.

### 1.5 [P0] `lib/api-middleware.ts:14-63` — `withIdempotency` only protects POST, not PUT/PATCH/DELETE

**File:** `web/src/lib/api-middleware.ts:14-19`

```ts
export function withIdempotency(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const key = req.headers.get('x-idempotency-key');
    if (!key || req.method !== 'POST') {
      return handler(req);
    }
    ...
```

`withIdempotency` only applies when `req.method === 'POST'`. But idempotency is equally important for `PUT`, `PATCH`, and `DELETE` — a rider that retries a "cancel rental" request because of a network blip should not double-cancel and confuse the state machine.

Also, **no route currently uses `withIdempotency`** (zero importers found). The function exists but is dead.

**Fix:** extend to `req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE'`. Or, at minimum, add the middleware to the actual mutating routes (`/api/transaction/topup`, `/api/rider/wallet`, `/api/rental/book`, `/api/rider/rental/return`, `/api/rider/sync/*`).

### 1.6 [P1] `lib/api-middleware.ts:48-59` — `response.clone()` then `.json()` is brittle for non-JSON responses

**File:** `web/src/lib/api-middleware.ts:48-55`

```ts
if (response.status >= 200 && response.status < 300) {
  try {
    const cloned = response.clone();
    const json = await cloned.json();
    await completeIdempotency(key, json);
  } catch (err) {
    logger.error('[Idempotency] Failed to cache response:', err);
  }
}
```

If the success response is a stream, a `NextResponse.redirect`, or a 204 No Content, `cloned.json()` will throw. Currently only the `.catch` logs the error and the user still gets the response — so behavior is correct, but the log line is misleading (it's not always a "failed to cache" — it might be "not JSON").

**Fix:** check `response.headers.get('content-type')?.startsWith('application/json')` before cloning. Log differently for "non-JSON" vs "JSON parse error".

### 1.7 [P1] `lib/api-error.ts:32-72` — only 6 typed error subclasses, 40+ use-cases throw raw `Error`

**File:** `web/src/lib/api-error.ts:32-72`

The base `ApiError` class is defined with 6 specialized subclasses (`AuthError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`, `ServerError`). Good pattern. But the use-cases (e.g. `authUseCases.sendOtp`) still throw plain `new Error('...')` with messages, which the api-handler then tries to map by string substring match (1.2). The whole point of the typed hierarchy is bypassed.

**Fix:** add a lint rule (e.g. `no-throw-literal`) or a wrapper that converts any non-`ApiError` throw into a `ServerError` with the original message preserved for logs but a generic message returned to the client.

### 1.8 [P0] `lib/rider-auth.ts:25-29` — admin can impersonate any rider via `x-rider-id` header, even in production

**File:** `web/src/lib/rider-auth.ts:25-29`

```ts
const adminSession = await getAdminSession(request);
if (adminSession) {
  const riderId = request.headers.get('x-rider-id');
  if (riderId) {
    if (request.method !== 'GET') {
      return errors.forbidden('Impersonation is restricted to GET operations only');
    }
```

The check `request.method !== 'GET'` prevents **mutation** via impersonation. But:

1. **Any** admin (regardless of role) can impersonate — the permission check is at line 31 with `hasPermission(adminSession, 'impersonate_riders')`. Good, that requires a specific permission. **But** the previous broad audit found that impersonation via the `?riderId=` query string in `get-session.ts` is even broader — not gated by permission. Two different impersonation paths with different authz.

2. The check is not idempotent — the rider ID is read from a header that any client can set. While the admin session is required (so this is not unauthenticated), the **rider ID** is fully client-controlled. An admin with `impersonate_riders` permission can set `x-rider-id` to any string and the server does `db.rider.findFirst({ where: { OR: [{ id: riderId }, { riderId: riderId }] } })` — that resolves correctly but a typo or probe to a non-existent ID is silently mapped to "rider not found". That's expected.

3. The audit log at line 57-64 records `actorId`, `actorType: 'ADMIN'`, `action: 'IMPERSONATE_RIDER'`, `entity: 'rider'`, `entityId: targetRider.id`. The rider being impersonated has **no record** of the impersonation (no notification, no email). This is a compliance gap.

**Fix:** notify the impersonated rider via SMS/email when an admin views their data. Centralize the impersonation flow so both `x-rider-id` header and `?riderId=` query string go through the same path.

### 1.9 [P1] `lib/rider-auth.ts:48-55` — impersonation rate limit is 10/minute per admin, never reset on `audit-log` failure

**File:** `web/src/lib/rider-auth.ts:48-55`

The rate limit `impersonation:${adminId}` is enforced **before** the audit log is written. If the audit log write fails, the rate limit was already consumed — the admin can be locked out without any successful impersonation. Also, the rate limit key is `adminId` (UUID), so an admin that has 10 successful impersonations in a minute is locked out for the rest of the minute. 10/min may be too aggressive for an admin doing a deep dive.

**Fix:** raise to 30/min, and consume the rate limit only after the audit log write succeeds.

### 1.10 [P1] `lib/auth.ts:138-203` — `verifySessionToken` does a DB lookup on **every** request to check `tokenVersion`

**File:** `web/src/lib/auth.ts:138-203`

The function `verifySessionToken` is called by `getSession()` (line 37 of `get-session.ts`), which is called by `requireRiderSession` and `getAdminSession`, which is called by **every** authenticated route. On every request, the function does:

1. `jwtVerify` (CPU work, fine)
2. For admin: `db.admin.findUnique(...)` via `getOrSetResponse` with 30s cache (line 144-159)
3. For rider: `db.rider.findUnique(...)` via `getOrSetResponse` with 30s cache (line 181-192)

The 30s cache means at most 2 DB hits per admin/rider per 30s. That's actually fine. **But** the cache key uses `riderDbId` (UUID) which is fine. **The issue:** if the rider's `tokenVersion` is bumped (e.g. logout-everywhere), the cache is **stale for up to 30 seconds** — the rider is still "authenticated" with the old token. This is a security gap of up to 30s.

**Fix:** reduce cache TTL to 5s, or invalidate the cache on token-version bump.

### 1.11 [P1] `lib/auth.ts:60-63` — JWT issuer/audience hardcoded to `'voltium-api'` and `'voltium-app'`

**File:** `web/src/lib/auth.ts:60-63`

```ts
.setIssuer('voltium-api')
.setAudience('voltium-app')
```

The previous broad audit flagged this. Confirmed: the strings are repeated in 4 places (lines 60-63, 91-93, 128-129, plus `auth.routes.ts`). Not configurable. If the team later wants to add a second client (e.g. a customer-facing app), they cannot share the auth infrastructure without code changes.

**Fix:** move to `env.JWT_ISSUER` and `env.JWT_AUDIENCE`. Add a startup test that the verify-side issuer/audience matches the create-side.

### 1.12 [P1] `lib/auth.ts:20-29` — admin session cookie uses the same 24-hour maxAge as the rider cookie

**File:** `web/src/lib/auth.ts:20-29`

```ts
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 24 hours session timeout
};
```

`SESSION_COOKIE_OPTIONS` is shared between `voltium-session` and `voltium-admin-session`. A stolen admin cookie is valid for **24 hours**. The access token itself expires in 2 hours, but the cookie can be replayed.

**Fix:** split into `ADMIN_SESSION_COOKIE_OPTIONS` with `maxAge: 60 * 60` (1 hour) and add a sliding-window refresh.

### 1.13 [P0] `lib/auth.ts:172-178` — admin `permissions` field is JSON-parsed at request time

**File:** `web/src/lib/auth.ts:172-178`

```ts
if (cached.permissions) {
  try {
    decoded.adminPermissions = JSON.parse(cached.permissions);
  } catch {
    // ignore parse errors
  }
}
```

The `permissions` field on the `Admin` model is stored as a JSON string. It's parsed on every request. If the parse fails, the cached `adminPermissions` is silently set to `undefined` (no error logged). This means the **admin loses all their permissions** and the next `hasPermission()` check returns `false`, which is fail-closed. So functionally it's safe, but:

1. No log on parse failure — admins will hit mysterious 403s with no operator visibility.
2. The `permissions` should be a Postgres `text[]` or a join table, not a JSON string. As written, you can't query admins by permission at the DB level.

**Fix:** migrate `Admin.permissions` to a proper relation table or a Postgres array. Log parse failures. Add a startup-time test that all admin rows have valid JSON.

### 1.14 [P1] `lib/auth.ts:32-33` — `ACCESS_TOKEN_TTL = '2h'` and `REFRESH_TOKEN_TTL = '30d'` are magic strings

**File:** `web/src/lib/auth.ts:32-33`

These literals are not in `env.ts`. They are not configurable. If a future client needs a different TTL (e.g. customer-facing web needs 4h), they cannot.

**Fix:** add `JWT_ACCESS_TTL` and `JWT_REFRESH_TTL` to `env.ts`. The schema can validate the format (e.g. `'2h'`, `'30d'`).

### 1.15 [P1] `lib/get-session.ts:67` — `session.role !== 'admin'` is the only check, but `role` is a free-form string

**File:** `web/src/lib/get-session.ts:67`

```ts
if (!session || session.role !== 'admin') {
  logger.debug('[AdminSession] Invalid or non-admin session');
  return null;
}
```

The `role` field on the session is set during token creation (from `payload.role`). If a future change ever sets `role: 'Admin'` (capital A) in one place and `role: 'admin'` in another, the check fails silently. Also, there's no validation that the admin is currently active in the DB (the `isActive` check happens in `verifySessionToken` but only for admins — if the cache is stale, the session continues for up to 30s after deactivation).

**Fix:** normalize `role` to lowercase on write. Use a typed enum. Tighten cache TTL.

### 1.16 [P1] `lib/get-session.ts:83` — `NODE_ENV !== 'production'` trusts dev headers in `staging`

**File:** `web/src/lib/get-session.ts:83-86, 97-100, 110-112`

The previous broad audit flagged this. Confirmed: any env other than `'production'` — `'staging'`, `'preview'`, `'qa'` — trusts the `x-rider-id`, `x-rider-phone`, `x-admin-id` headers. The rider-auth `requireRiderSession` also has a similar check (line 25-29 of `rider-auth.ts`).

**Fix:** invert to `NODE_ENV === 'development' && request`. Make dev explicit.

### 1.17 [P1] `lib/env.ts:82-110` — placeholder detection regex is incomplete

**File:** `web/src/lib/env.ts:96-110`

```ts
const placeholderRegex = /(YOUR_SECURE_|CHANGE_ME|SECRET_HERE|PLACEHOLDER)/i;
if (
  placeholderRegex.test(data.JWT_SECRET) ||
  ...
```

The regex is checked at the Zod refinement stage, but only for `production` and `staging` `APP_ENV`. It does not catch all placeholder patterns: e.g. `MY_DEV_SECRET`, `REPLACE_ME`, `abc...` (low-strength). A later code block (line 200-228) does a separate check for known insecure values, but it's a different code path. Two separate checks, two separate lists of bad values.

**Fix:** consolidate into a single `validateSecret(value, name)` helper called from both paths.

### 1.18 [P0] `lib/env.ts:113-119` — test env auto-fills insecure JWT_SECRET, no warning

**File:** `web/src/lib/env.ts:113-119`

```ts
if (process.env.NODE_ENV === 'test') {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/voltium-test?schema=public';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'voltium-dev-secret-key-INSECURE-DO-NOT-PROD-32-CHARS';
}
```

The auto-fill for `JWT_SECRET` uses a string that is **explicitly listed as insecure** in the later check (line 203). The check at line 202 has `if (parsedEnv.NODE_ENV !== 'test')` which exempts tests. **But** if a developer runs with `NODE_ENV=development` and forgets to set `JWT_SECRET`, the build will fail (line 213). If they run with `NODE_ENV=test` and forget, they get the dev secret. The auto-fill masks missing env config in tests, which is fine for unit tests but **dangerous for integration tests** that run against a real database.

**Fix:** auto-fill with a per-run random secret in tests (`crypto.randomBytes(32).toString('hex')`) instead of a hardcoded string. The hardcoded one should be deleted from git history.

### 1.19 [P1] `lib/env.ts:153-198` — production guard logic is 45 lines and entangled

**File:** `web/src/lib/env.ts:153-198`

The block at line 153-198 is a long series of `if (isServer && parsedEnv.APP_ENV === 'production') { if (X) { throw ... } }` checks. It's all-or-nothing — any single violation throws, but the developer only learns about one at a time. Hard to test (would need to spin up 9 different env configurations).

**Fix:** extract into a `validateProductionEnv(env)` function that returns an array of violations, throw once with all of them. Easier to test, easier to read.

### 1.20 [P1] `lib/env.ts:84-93` — `ENABLE_TEST_OTP` and `ENABLE_DEV_ADMIN_LOGIN` are checked in BOTH the Zod refine and a later if-block

**File:** `web/src/lib/env.ts:84-93` and `195-197, 232-241`

The Zod refinement at line 84-93 checks `ENABLE_TEST_OTP || ENABLE_DEV_ADMIN_LOGIN` is `false` in production. Then line 195-197 throws again. Then line 232-241 throws **again** for `APP_ENV !== 'development'`. The redundant checks are confusing — three places to update if the rule changes.

**Fix:** single source of truth in one function.

### 1.21 [P1] `lib/env.ts:113-149` — `env` is exported as a frozen value at module load, so changing `process.env.DATABASE_URL` at runtime is silently ignored

**File:** `web/src/lib/env.ts:142-149`

```ts
const _env = envSchema.safeParse(parseTarget);
if (!_env.success) {
  ...
  throw new Error('Invalid environment variables');
}
const parsedEnv = _env.data;
```

After the Zod parse, `parsedEnv` is the value of `process.env` at module load. Any later `process.env.X = '...'` is ignored. This is a feature for reproducibility, but it means **tests that try to mutate env vars** (e.g. `process.env.JWT_SECRET = 'new'`) don't get the new value.

**Fix:** this is fine for production, but document that tests must use `vi.stubEnv` or a similar mechanism, not direct mutation. Currently the codebase does `vi.stubEnv` (verified in `tests/`) so this is OK; just call it out.

---

## 2. Auth routes

5 files under `/api/auth/`. The previous broad audit covered `logout`, `refresh`, and lightly touched `send-otp` and `verify-otp`. The new findings below are about behaviors the broad audit deferred.

### 2.1 [P0] `auth/send-otp/route.ts:33-38` — `sendOtp` is called with `clientIp` but the use-case also computes a phone-based rate limit, race condition

**File:** `web/src/app/api/auth/send-otp/route.ts:38`

```ts
const result = await authUseCases.sendOtp(validation.data, { ip: clientIp, correlationId });
```

The route passes `clientIp` for rate-limiting. The use-case (`auth.use-cases.sendOtp`) presumably rate-limits by phone. If an attacker rotates IPs and phone numbers (or uses a phone pool), neither rate limit fully protects. A more robust check would be on the **OTP verify** side, which is where the actual credential is.

Looking at the OTP rate limit pattern in `verify-otp/route.ts:50-77`, **both** an IP rate limit and a phone rate limit are applied. `send-otp` only has the IP limit (handled in use-case). So the protection is asymmetric: a phone can be probed for OTPs at 100/10min in dev, 5/10min in prod from a single IP. Multiple IPs → unlimited.

**Fix:** add a phone-based rate limit to `send-otp` route at the same threshold as `verify-otp` (5/10min in prod). Cross-check the phone-based and IP-based limits.

### 2.2 [P1] `auth/send-otp/route.ts:40-50` — `success()` returns `otp: result.otp` in the response body, with no env gate

**File:** `web/src/app/api/auth/send-otp/route.ts:40-50`

```ts
const response = success(
  {
    exists: result.exists,
    otp: result.otp,
  },
```

The response includes `otp: result.otp` — the actual OTP. The `use-case` only returns this if a certain env flag is set (likely `ENABLE_TEST_OTP`), but **the route has no env gate**. The use-case is the only place where this is conditional. If the use-case leaks the OTP in any non-test environment, it will be returned.

**Fix:** add a server-side guard in the route itself: `if (process.env.ENABLE_TEST_OTP !== 'true') delete result.otp`. Don't trust the use-case alone.

### 2.3 [P0] `auth/verify-otp/route.ts:25` — `TEST_PHONES` is hardcoded in the route

**File:** `web/src/app/api/auth/verify-otp/route.ts:25`

```ts
const TEST_PHONES = ['9876543210', '8888888888', '9999999999'];
```

Three test phone numbers are hardcoded in the route. The dev auto-provisioning path at line 82-113 only triggers if all of these are true:
- `process.env.NODE_ENV === 'development'`
- `process.env.ENABLE_DEV_TOOLS === 'true'`
- `process.env.TEST_MODE === 'true'`
- `TEST_PHONES.includes(result.phone)`

But the test phones are checked **first** in the includes check, before the env check. The env check is at the `if` at line 82, which short-circuits correctly. **However**, the `TEST_PHONES` array is still allocated in production — a trivial memory issue but a code-smell. More importantly, a developer adding a fourth test phone and forgetting to update any docs creates an undocumented behavior.

**Fix:** move to env: `const TEST_PHONES = (process.env.TEST_PHONES ?? '').split(',')`. Document the auto-provision behavior in a single place.

### 2.4 [P0] `auth/verify-otp/route.ts:80-128` — `verifyOtp` is called on the result, then the route independently sets cookies

**File:** `web/src/app/api/auth/verify-otp/route.ts:80, 106, 122-128`

The route calls `authUseCases.verifyOtp(validation.data as any)` (line 80) — the `as any` is a code smell. Then at line 91 (in the dev auto-provision path), it manually calls `createSessionToken` and `flattenRider` and `onboardingUseCases.autoProvisionTestRider` — business logic that should be in the use-case. The non-dev path at line 115-128 just passes through `result.token` and `result.refreshToken` from the use-case, which already set up cookies.

**Why it matters:** the dev path and the non-dev path produce the same response shape, but the dev path duplicates 30+ lines of logic that should be in the use-case. A change to the token shape (e.g. adding `tokenVersion` to a new field) needs to be made in two places.

**Fix:** move the auto-provision flow into `authUseCases.verifyOtp` itself (or a separate `verifyOtpForDev` use-case). The route should be a thin wrapper that sets cookies and returns the response.

### 2.5 [P1] `auth/verify-otp/route.ts:15-23` — rate limits are `100/10min` in dev, `5/10min` in prod for the phone, `200/10min` in dev, `15/10min` in prod for the IP

**File:** `web/src/app/api/auth/verify-otp/route.ts:15-23`

The OTP verify rate limit allows 5 attempts per phone in 10 minutes. **A user with a real phone who mistypes 5 times is locked out for 10 minutes.** That's a tight UX. The standard pattern is exponential backoff (lock for 1min, 5min, 30min, 1hr). The current code is a flat 10-min lockout.

**Fix:** implement exponential backoff: each consecutive failure doubles the lockout duration. Reset on success.

### 2.6 [P1] `auth/verify-otp/route.ts:130` — `err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err)` — same dead code as 1.4

**File:** `web/src/app/api/auth/verify-otp/route.ts:130`

```ts
const errorMessage = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err);
```

The inner `(err instanceof Error ? err.message : String(err))` is dead — the outer ternary's condition is already `err instanceof Error`, so the inner condition is always true.

**Fix:** simplify to `err instanceof Error ? err.message : String(err)`.

### 2.7 [P1] `auth/verify-otp/route.ts:131-137` — error message returned to client is `'Verification failed. Please check your connection or try again.'` regardless of the actual error

**File:** `web/src/app/api/auth/verify-otp/route.ts:132-134`

The error log at line 131 captures the real error, but the client gets a generic message. That's correct from a security perspective (don't leak internals), but the message says "check your connection" — implying a network issue, when most verify failures are invalid OTP. Misleading.

**Fix:** message should be `'Invalid or expired OTP. Please try again.'`

### 2.8 [P0] `auth/verify-phone/route.ts:11-14` — `verifyPhoneSchema` is a local Zod schema, not in `validators.ts`

**File:** `web/src/app/api/auth/verify-phone/route.ts:11-14`

```ts
const verifyPhoneSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits'),
});
```

Local Zod schema definition in the route file. The pattern across the codebase is to centralize schemas in `validators.ts` and import them. This is a one-off. Inconsistent.

**Fix:** move to `validators.ts` as `verifyPhoneSchema`.

### 2.9 [P1] `auth/verify-phone/route.ts:53-56` — `verifyOtp` from `@/lib/otp-store` is called directly, not through a use-case

**File:** `web/src/app/api/auth/verify-phone/route.ts:53`

The route calls `verifyOtp(phone, otp)` from `@/lib/otp-store` directly. This bypasses the use-case layer. Inconsistent with the other auth routes (`send-otp`, `verify-otp`) which all go through `authUseCases`. If a future audit-log or rate-limit enhancement is added to the use-case layer, this route misses it.

**Fix:** wrap in `authUseCases.verifyPhone(phone, otp)`.

### 2.10 [P1] `auth/refresh/route.ts` — see broad audit; the additional finding is that the route accepts the refresh token from **any** source, including cookies and Authorization header, without distinguishing

**File:** `web/src/app/api/auth/refresh/route.ts` (already audited)

The refresh endpoint reads the refresh token from `voltium_refresh` cookie or `Authorization: Bearer <refresh>`. The same token is accepted via both. But the **refresh cookie has `httpOnly: true`** (line 124-127 of `verify-otp/route.ts`), so it's not accessible to JS — the only way to use it is via cookie. The Authorization header variant is for non-cookie clients (e.g. CLI tools). This is fine, but the route does not rate-limit refresh attempts. An attacker with a stolen refresh token can refresh forever.

**Fix:** add a per-token rate limit to refresh: 10 attempts per refresh token per hour. After 10 failures, mark the token as compromised and revoke the entire token family.

### 2.11 [P0] `auth/logout/route.ts` (already audited) — no `Cache-Control: no-store` header, browser may cache the logout response

**File:** `web/src/app/api/auth/logout/route.ts`

Logout returns 200 with no `Cache-Control` header. If the response is cached by a proxy or CDN, the rider's session may appear active when it's not. Also, the cookie deletion via `cookies.delete()` is the standard way, but there's no explicit `Set-Cookie` header with `Max-Age=0` — `cookies.delete()` on Next.js sets `Max-Age=0` automatically, so this is OK, but worth confirming.

**Fix:** add `Cache-Control: no-store, no-cache, must-revalidate, private` to the logout response. Confirm `Set-Cookie` headers are present in the response.

---

## 3. Rider routes

~20 files under `/api/rider/*`. The previous broad audit (section 8.82-8.137) covered most of these with "Fine." — that was a shallow pass. The findings below are real issues found in a deeper read.

### 3.1 [P0] `/api/rider/kyc/route.ts:25-39` — `kycUseCases.submitKyc` is called but the request body's `id` field is ignored

**File:** `web/src/app/api/rider/kyc/route.ts:25-31`

```ts
const body = await request.json();
const validation = validateBody(submitKycSchema, body);
if (!validation.success) {
  return errors.validation(validation.error);
}
const result = await kycUseCases.submitKyc(session.riderDbId, validation.data);
```

The `submitKycSchema` is referenced from `validators.ts`. Need to verify it does not accept an `id` or `riderId` field that would let a rider submit KYC for another rider. If `submitKycSchema` includes `riderId: z.string().optional()`, a rider could pass another rider's ID and submit on their behalf.

**Fix:** audit `submitKycSchema` in `validators.ts` to ensure `riderId` and `id` are not accepted; the rider is always derived from the session.

### 3.2 [P0] `/api/rider/kyc/route.ts:41-43` — `KycStateError` is the only error caught; all other errors return 500

**File:** `web/src/app/api/rider/kyc/route.ts:40-46`

```ts
} catch (err: unknown) {
  if (errorName(err) === 'KycStateError') {
    return errors.conflict((err instanceof Error ? err.message : String(err)));
  }
  logger.error('[POST /api/rider/kyc]', err);
  return errors.internal('Failed to submit KYC');
}
```

Only `KycStateError` is mapped to a non-500. Any other error (e.g. `ValidationError`, `NotFoundError`, `ConflictError`, Prisma errors) returns 500. A rider trying to submit KYC for an already-APPROVED profile will get a `KycStateError` and a 409, but a rider hitting a transient DB error (e.g. unique constraint violation on aadhaar) will get a 500.

**Fix:** catch and map `ApiError` subclasses; use `withApiHandler` for consistent error mapping.

### 3.3 [P1] `/api/rider/kyc/route.ts:74-84` — KYC status response includes raw file URLs without signed/expiring access

**File:** `web/src/app/api/rider/kyc/route.ts:74-84`

The KYC GET response includes `profilePhoto`, `riderPhoto`, `signature`, `aadhaarFront`, `aadhaarBack`, `panCard`, `bankName`. If the storage URLs are direct (e.g. `https://storage.example.com/aadhaar/{id}.jpg`), they're publicly accessible. For a KYC document, this is a PII leak.

**Fix:** return signed URLs with 5-minute expiry, or proxy through the server with auth check.

### 3.4 [P1] `/api/rider/kyc/route.ts:50-54` — GET has no rate limit

**File:** `web/src/app/api/rider/kyc/route.ts:49`

```ts
export async function GET(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;
    const kycProfile = await kycUseCases.getKycStatus(session.riderDbId);
```

The KYC GET endpoint is not rate-limited. A rider could poll this 1000 times/minute, hitting the DB. Not a security issue (auth required), but a DoS amplification vector if a malicious rider has credentials.

**Fix:** add `withRateLimit(60_000, 30)` to GET.

### 3.5 [P0] `/api/rental/book/route.ts:21-26` — input validation is hand-rolled with `if (!X)` instead of Zod

**File:** `web/src/app/api/rental/book/route.ts:21-34`

```ts
const body = await request.json();
const { vehicleId, shiftId, leaseDate, startTime } = body;
if (!vehicleId) return errors.validation('vehicleId is required');
if (!shiftId) return errors.validation('shiftId is required');
if (!leaseDate) return errors.validation('leaseDate is required (YYYY-MM-DD)');
if (!startTime) return errors.validation('startTime is required (HH:mm)');
if (!/^\d{4}-\d{2}-\d{2}$/.test(leaseDate)) {
  return errors.validation('leaseDate must be in YYYY-MM-DD format');
}
if (!/^\d{2}:\d{2}$/.test(startTime)) {
  return errors.validation('startTime must be in HH:mm format');
}
```

The route hand-rolls validation instead of using a Zod schema from `validators.ts`. This is inconsistent with the rest of the codebase and the regex checks are loose — e.g. `2025-13-32` matches `^\d{4}-\d{2}-\d{2}$` (no calendar validity). Also, no check for `leaseDate` being in the past (a rider can book a rental for yesterday).

**Fix:** define `bookRentalSchema` in `validators.ts` with `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => !isNaN(Date.parse(d)) && new Date(d) >= startOfDay())` and similar for `startTime`.

### 3.6 [P0] `/api/rental/book/route.ts:44-60` — error mapping by string substring is the same anti-pattern as 1.2

**File:** `web/src/app/api/rental/book/route.ts:44-60`

```ts
const message = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : 'Failed to book rental';
if (message.includes('not found')) return errors.notFound(message);
if (message.includes('not available') || message.includes('fully booked') || message.includes('already have')) {
  return errors.conflict(message);
}
if (message.includes('format') || message.includes('required') || message.includes('invalid')) {
  return errors.validation(message);
}
if (typeof message === 'string' && message.includes('Unique constraint')) {
  return errors.conflict('This vehicle is already booked for this shift on the selected date');
}
```

Multiple substring matches on error messages. The dead `(err instanceof Error ? err.message : String(err))` ternary again. The `Unique constraint` check is fragile — Prisma error messages vary by version.

**Fix:** use `withApiHandler` and throw typed errors from the use-case.

### 3.7 [P0] `/api/rental/book/route.ts:14` — no rate limit, no idempotency on POST

**File:** `web/src/app/api/rental/book/route.ts:14`

A double-tap on the booking button could create two rentals. The `rentalUseCases.bookRental` may have its own idempotency check via a unique constraint on `(vehicleId, shiftId, leaseDate)`, but the user gets a 500 with a Prisma error if it fires.

**Fix:** wrap in `withIdempotency` to make the retry behavior explicit.

### 3.8 [P1] `/api/transaction/topup/route.ts:23-29` — rate limit is 10/min per rider

**File:** `web/src/app/api/transaction/topup/route.ts:23-29`

```ts
const rateLimit = await checkRateLimit(`topup:${riderDbId}`, {
  windowMs: 60 * 1000,
  maxRequests: 10,
});
```

10 top-ups per minute per rider. Generous, but: an attacker who compromises a rider's session can drain the rider's bank by submitting 10 large top-up requests in a minute. The rate limit is on request count, not on amount. If each top-up is the rider's daily limit, 10x daily limit in 60s.

**Fix:** add amount-based rate limit: total amount < `rider.daily_topup_limit`.

### 3.9 [P0] `/api/transaction/topup/route.ts:53` — `idempotencyKey` is read from the request header but not validated for format

**File:** `web/src/app/api/transaction/topup/route.ts:53`

```ts
idempotencyKey: request.headers.get('x-idempotency-key') || undefined,
```

The idempotency key is passed to `walletUseCases.requestTopup` without any format check. A rider passing `x-idempotency-key: <megabyte-of-data>` would be cached. The `idempotency` module presumably validates, but the route doesn't.

**Fix:** validate `x-idempotency-key` format (UUID v4, 36 chars) in the route or a middleware.

### 3.10 [P1] `/api/transaction/topup/route.ts:68-73` — string match on `'Rider not found'` to map to 404

**File:** `web/src/app/api/transaction/topup/route.ts:68-72`

```ts
const message = err instanceof Error ? err.message : String(err);
if (message === 'Rider not found') {
  return errors.notFound('Rider not found');
}
return errors.internal('Failed to submit payment');
```

Same anti-pattern. The use-case should throw `NotFoundError`.

### 3.11 [P0] `/api/rider/sync/*` — 3 routes: `device-data`, `pickup`, `pickup/vehicle`

**File:** `web/src/app/api/rider/sync/device-data/route.ts`, `sync/pickup/route.ts`, `sync/pickup/vehicle/route.ts`

These are the "offline-first" sync endpoints. Riders may have a long list of actions queued while offline (e.g. 200 pickup events). Need to verify:
- Are sync requests idempotent? (A rider that syncs 200 events should not create 200 duplicates if they retry)
- Is the sync batch size limited? (a malicious rider could send a 10MB batch)
- Are the events processed in a transaction? (partial failures should roll back)
- Are events deduplicated by an `eventId` from the client? (most offline-first systems use a client-generated UUID per event)

**Fix:** audit each of the 3 sync routes against these criteria. Likely gaps exist in batch size, transaction handling, and event dedup.

### 3.12 [P1] `/api/rider/device/verify-lock/route.ts` — likely has weak or missing rate limit

**File:** `web/src/app/api/rider/device/verify-lock/route.ts` (broad audit marked as "Fine")

The "verify lock password" endpoint accepts a password (or PIN) and verifies it. This is a critical authentication check — must have:
- Strong rate limit (5 attempts/15min per rider)
- Constant-time compare (`crypto.timingSafeEqual`)
- Audit log on every attempt (success and failure)
- Lockout after N failures

**Fix:** audit the route against the above criteria.

### 3.13 [P1] `/api/rider/fcm-token/route.ts` — FCM token registration

**File:** `web/src/app/api/rider/fcm-token/route.ts` (broad audit marked as "Fine")

The FCM token endpoint stores a push notification token for the rider. Issues to check:
- Is the rider's existing FCM token overwritten? (A rider on a new device overwrites the old one, which is fine, but if the FCM secret is leaked, an attacker can push notifications impersonating the rider)
- Is the token validated? (any string is accepted?)
- Is the token refreshed periodically? (FCM tokens rotate)

**Fix:** validate FCM token format (length, prefix). Refresh on every login. Add a TTL or a "last seen" timestamp.

### 3.14 [P1] `/api/rider/consent/route.ts` — GDPR consent recording

**File:** `web/src/app/api/rider/consent/route.ts` (broad audit marked as "Fine")

The consent endpoint records the rider's consent for various data-processing activities. Issues to check:
- Is the consent **withdrawal** supported? (GDPR Article 7(3))
- Is the consent timestamp + IP recorded? (for compliance audit)
- Is the consent re-collected when terms change? (versioning)
- Is the consent `version` validated? (a rider could consent to "v999" which doesn't exist)

**Fix:** audit for the above. Likely gaps exist.

### 3.15 [P1] `/api/rider/earnings/route.ts` — earnings read

**File:** `web/src/app/api/rider/earnings/route.ts`

Earnings are read-only for the rider, but admin endpoints can read them. Verify:
- Riders can only see their own earnings (not other riders')
- Date range filter is bounded (a rider can't query `from=0001-01-01` which would return the entire history)
- Earnings are not cached client-side in a way that bypasses the auth check

**Fix:** add `from <= to` and `from >= some-reasonable-min` validation.

### 3.16 [P0] `/api/rider/kyc/submit/route.ts` and `/api/rider/kyc/upload/route.ts` — separate submit/upload endpoints

**File:** `web/src/app/api/rider/kyc/submit/route.ts`, `kyc/upload/route.ts`

Multiple KYC endpoints. Audit:
- Can a rider submit KYC without uploading all required documents? (the schema in `submitKycSchema` may not enforce completeness)
- Is the file upload to `kyc/upload` authenticated and tied to the rider? (a rider could upload a malicious file and then submit KYC for another rider)
- Are the uploaded files scanned for malware? (the broad audit flagged this as a potential gap)

**Fix:** enforce document completeness in the use-case, not just the schema. Tie uploads to a `pendingKycId` that the rider can only create.

### 3.17 [P1] `/api/rider/profile/route.ts` — profile read/write

**File:** `web/src/app/api/rider/profile/route.ts`

Profile read is `GET`, write is `PATCH` (or `PUT`). Verify:
- Can a rider change their `phone`? (should be a separate OTP-verified flow)
- Can a rider change their `kycStatus`? (must be admin-only or via KYC state machine)
- Can a rider change their `riderId`? (must be immutable)
- Can a rider change their `accountStatus`? (must be admin-only)

**Fix:** whitelist the editable fields in the use-case.

---

## 4. Admin routes

~70 files under `/api/admin/*`. This is the largest section of the audit.

### 4.1 [P0] `/api/admin/riders/bulk/route.ts:36-86` — bulk actions iterate in a for-loop, no transaction

**File:** `web/src/app/api/admin/riders/bulk/route.ts:36-86`

```ts
case 'updateStatus': {
  for (const id of ids) {
    try {
      await adminRiderUseCases.update(id, { accountStatus: value }, ...);
      updatedCount++;
    } catch (e) {
      failures.push({ id, error: ... });
    }
  }
  break;
}
```

A bulk action on 100 riders makes 100 sequential DB calls. If the loop fails at rider 50, the first 49 are committed. No transaction. The `failures` array captures per-rider errors but there's no rollback. A bulk status change that should be atomic (e.g. "block all 100 riders on this team") is not.

Also: no max `ids` length check. A malicious admin (or a buggy UI) can pass 10,000 IDs and lock the request for 10 minutes.

**Fix:** wrap in `db.$transaction`, enforce `ids.length <= 100` with a 400 if exceeded.

### 4.2 [P0] `/api/admin/riders/bulk/route.ts:28-29` — `riders_delete` and `riders_update` permissions gate the route, but the **audit log** is not written

**File:** `web/src/app/api/admin/riders/bulk/route.ts:31-86`

The route calls `adminRiderUseCases.update` and `adminRiderUseCases.delete`. The previous broad audit (admin web) flagged the same issue: bulk actions are not audit-logged. A bulk delete of 100 riders leaves no individual audit log entries — only a "BULK_ACTION" entry if the use-case happens to create one. Compliance gap for GDPR/SOC2.

**Fix:** create an audit log entry per affected rider ID, with the bulk action's correlation ID linking them.

### 4.3 [P1] `/api/admin/riders/bulk/route.ts:46, 58, 78` — `(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e))` — same dead-code anti-pattern

**File:** `web/src/app/api/admin/riders/bulk/route.ts:46, 58, 78`

Three occurrences of the dead inner ternary. Repeated across many files (see 1.3, 2.6, 3.6, 4.x). Should be a code-smell rule in ESLint.

**Fix:** ESLint rule `no-nested-ternary` or `no-unnecessary-ternary`.

### 4.4 [P0] `/api/admin/riders/route.ts` (already audited) — `GET` is missing `pagination` and `search` validation

**File:** `web/src/app/api/admin/riders/route.ts`

The riders list endpoint accepts `?page=`, `?limit=`, `?search=`. Audit:
- Is `limit` capped? (a malicious admin could request `limit=1000000` and OOM the server)
- Is `search` sanitized? (a `%` or `_` could cause unintended matches via SQL LIKE)
- Is the result set bounded by role? (a support agent with no `riders_read_all` permission can see all riders?)

**Fix:** cap `limit` at 100, escape `search` for Prisma `contains`, enforce role-based filtering.

### 4.5 [P1] `/api/admin/riders/[id]/data-deletion/route.ts` — GDPR data deletion endpoint

**File:** `web/src/app/api/admin/riders/[id]/data-deletion/route.ts`

Per GDPR Article 17, this endpoint should:
- Verify the admin has `riders_delete` permission (or a separate `gdpr_delete` permission)
- Soft-delete the rider (set `deletedAt`) or hard-delete based on policy
- Anonymize PII fields (replace name with `Deleted User #1234`, redact phone, hash aadhaar)
- Write a deletion audit log
- Notify the rider of the deletion (within 30 days)
- Be rate-limited (a single delete should be the only one per rider per X time)

**Fix:** audit for the above. The PII anonymization is critical.

### 4.6 [P1] `/api/admin/riders/[id]/wallet-adjust/route.ts` — wallet adjustment endpoint

**File:** `web/src/app/api/admin/riders/[id]/wallet-adjust/route.ts`

This is a high-risk endpoint: an admin can credit or debit a rider's wallet. Audit:
- Is the adjustment **append-only** (a ledger entry) or **direct balance update**? (a direct update is a security hole — every change should be traceable)
- Is the reason recorded? (compliance)
- Is the admin's identity recorded in the audit log?
- Is there a max-adjustment cap? (an admin can credit 1 crore by mistake)
- Is the rider notified?
- Is the rider's balance checked before debit? (no negative balance)
- Is the action idempotent via `x-idempotency-key`?

**Fix:** require ledger entry, require reason, cap at e.g. 100,000 INR, require approval above 10,000 INR.

### 4.7 [P0] `/api/admin/riders/[id]/plan/route.ts` — plan assignment endpoint

**File:** `web/src/app/api/admin/riders/[id]/plan/route.ts`

Audit:
- Is the plan change **effective immediately** or at next billing cycle? (laptop mode has no real billing, so this is an implementation detail)
- Is the rider's existing plan cancelled before the new one is set? (overlap)
- Is the change audit-logged with old/new plan IDs?
- Is there a permission check (e.g. `riders_plan_change`)?
- Can the admin assign a plan the rider can't afford (deposit-wise)?

**Fix:** audit for the above. The deposit-vs-plan check is non-trivial.

### 4.8 [P0] `/api/admin/riders/[id]/device-data/route.ts` — read device data for a rider

**File:** `web/src/app/api/admin/riders/[id]/device-data/route.ts`

This endpoint exposes device data (location history, app usage, etc.) for a rider. Audit:
- Is the data access **audit-logged** (who looked, when)?
- Is the data access **rate-limited** (an admin can pull all data 1000 times/minute)?
- Is the data **scoped** (only this rider, not other riders)?
- Is the data **TTL-bounded** (older than X days is purged)?
- Is the rider **notified** of admin data access (or is it silent)?

**Fix:** audit for the above. GDPR/privacy law compliance.

### 4.9 [P1] `/api/admin/riders/actions/route.ts` — single-rider actions

**File:** `web/src/app/api/admin/riders/actions/route.ts`

Likely wraps `updateRiderStatus`, `resetKyc`, `resetPin`, etc. Audit:
- Is the action permission-checked (e.g. `resetPin` requires a specific permission)?
- Is the action audit-logged?
- Is the action idempotent?
- Is the rider notified?

**Fix:** audit for the above.

### 4.10 [P0] `/api/admin/payment-gateways/route.ts` and `/api/admin/payment-gateways/[id]/route.ts` — payment gateway config

**File:** `web/src/app/api/admin/payment-gateways/route.ts`, `payment-gateways/[id]/route.ts`

This is the **highest-risk** admin endpoint. Payment gateway config (API keys, webhooks, enabled/disabled) directly affects money flow. Audit:
- Are the API keys **encrypted at rest**? (the broad audit noted `pii-crypto.ts` exists; verify it's used here)
- Is the **secret write** audit-logged with the admin's identity?
- Is **disabling a gateway** a soft-delete (with rollback) or hard-delete? (hard-delete = loss of historical transactions tagged with this gateway)
- Is the **secret read** endpoint separate from the list endpoint? (a list response should not include secrets)
- Are **webhook URLs validated** to prevent SSRF? (a `https://internal-service` URL would let the gateway hit internal services)
- Is the **environment** enforced? (a test gateway should not be enabled in prod)

**Fix:** verify all of the above. The secret encryption is critical.

### 4.11 [P0] `/api/admin/data-management/backups/route.ts` and `/api/admin/data-management/backups/[id]/*` — backup management

**Files:** `web/src/app/api/admin/data-management/backups/route.ts`, `backups/[id]/route.ts`, `backups/[id]/download/route.ts`, `backups/[id]/verify/route.ts`

Audit:
- Is the **download endpoint** authenticated? (backups may contain all PII)
- Is the **download audit-logged** (who downloaded, when, what backup)?
- Is the **backup integrity verified** before download? (the `/verify` route exists, but is it called before download?)
- Is the **backup encryption** enforced? (`BACKUP_ENCRYPTION_ENABLED` env flag)
- Is the **download TTL** set? (a signed URL with 1-hour expiry)
- Is the **download size** bounded? (no streaming a 10GB backup to memory)
- Is **listing backups** permission-gated? (e.g. only `super_admin`)

**Fix:** audit for the above. The download endpoint is a PII exfiltration risk.

### 4.12 [P0] `/api/admin/data-management/restore/start/route.ts` and `/api/admin/data-management/restore/validate/route.ts` — restore

**Files:** `web/src/app/api/admin/data-management/restore/start/route.ts`, `restore/validate/route.ts`

Restore is the highest-impact admin action. Audit:
- Is the restore **transactional** (or in a `BEGIN; ... COMMIT;` block)?
- Is the **target database confirmed** before starting? (a restore to prod of a dev backup would be catastrophic)
- Is the restore **rate-limited**? (only one restore at a time)
- Is the **operator's identity** recorded with timestamp?
- Is the **pre-restore backup** taken automatically? (rollback path)
- Is the **dry-run** supported? (a `validate` route exists — verify it does a dry-run, not just metadata check)

**Fix:** audit for the above. The pre-restore backup is critical.

### 4.13 [P0] `/api/admin/data-management/schedule/route.ts` — backup schedule

**File:** `web/src/app/api/admin/data-management/schedule/route.ts`

Audit:
- Is the schedule **cron-validated** (a malformed cron string could fire every second)?
- Is the schedule **rate-limited** (e.g. min 1-hour interval)?
- Is the schedule **conflict-checked** (two schedules at the same time)?
- Is the schedule **changed with audit log**?
- Does the schedule trigger the **backup job** with proper error handling?

**Fix:** validate cron with `cron-parser`, enforce min interval, audit-log changes.

### 4.14 [P0] `/api/admin/teams-leaders/route.ts` and `/api/admin/team-leaders/bulk/route.ts` and `/api/admin/team-leaders/[id]/riders/route.ts` — team leader management

**Files:** `web/src/app/api/admin/team-leaders/route.ts`, `team-leaders/bulk/route.ts`, `team-leaders/[id]/riders/route.ts`

Audit:
- Is the team leader's **scope** (which riders) enforced? (a team leader should only see their own team)
- Is the **assignment change** audit-logged?
- Is the **bulk assignment** in a transaction?
- Is the **rider reassignment** validated (no orphaned riders)?

**Fix:** audit for the above. The scope enforcement is critical for privacy.

### 4.15 [P1] `/api/admin/incidents/route.ts` and `/api/admin/incidents/[id]/route.ts` — incident management

**Files:** `web/src/app/api/admin/incidents/route.ts`, `incidents/[id]/route.ts`

Audit:
- Is the **incident state machine** validated? (e.g. CLOSED cannot be reopened?)
- Is the **incident closure** audit-logged with the resolver's identity?
- Is the **incident reopen** allowed (and who can)?
- Is the **rider notification** triggered on closure?

**Fix:** audit for the above. Likely gaps in state machine enforcement.

### 4.16 [P0] `/api/admin/jobs/route.ts` — background job inspector

**File:** `web/src/app/api/admin/jobs/route.ts`

The job inspector endpoint exposes all background jobs (pending, running, failed, completed). Audit:
- Is **read-only** (or can it also trigger jobs)? (a `POST` to start a job should be a separate endpoint)
- Is **filtered by job type** (a junior admin sees only safe jobs, not the wallet reconciliation)?
- Is the **DLQ (dead-letter queue)** accessible (to retry failed jobs)?
- Is the **re-run** of a failed job a separate permission (e.g. `jobs_retry`)?

**Fix:** audit for the above.

### 4.17 [P0] `/api/admin/audit/cleanup/route.ts` — audit log cleanup

**File:** `web/src/app/api/admin/audit/cleanup/route.ts`

Audit log cleanup is a sensitive operation. Audit:
- Is the **retention period** enforced (e.g. 90 days)?
- Is the **cleanup audit-logged** (who cleaned what when)?
- Is the **cleanup permission** separate (`audit_cleanup`)?
- Is the **cleanup dry-run** supported?
- Is the **cleanup destructive** (deletes rows) or **archival** (moves to cold storage)?

**Fix:** audit for the above. The cleanup of audit logs is a compliance issue.

### 4.18 [P0] `/api/admin/notifications/route.ts` — admin-triggered notifications

**File:** `web/src/app/api/admin/notifications/route.ts`

Audit:
- Is the **target audience** validated (e.g. max 100k recipients)?
- Is the **rate limit** set (e.g. 10 notifications/hour per admin)?
- Is the **message content** sanitized (no injection into FCM payload)?
- Is the **notification dispatch** async (background job) or sync? (sync = 30s response if 10k recipients)
- Is the **dispatch audit-logged**?

**Fix:** audit for the above. The 100k-recipient sync dispatch is a DoS risk.

### 4.19 [P1] `/api/admin/coupons/route.ts` — coupon management

**File:** `web/src/app/api/admin/coupons/route.ts`

Audit:
- Is the **coupon code** unique?
- Is the **discount value** bounded (e.g. max 100% off)?
- Is the **expiry** enforced (server-side)?
- Is the **usage count** atomic (no double-redemption)?
- Is the **rider-specific coupon** scoped correctly?

**Fix:** audit for the above.

### 4.20 [P1] `/api/admin/feature-flags/route.ts` — feature flag toggle

**File:** `web/src/app/api/admin/feature-flags/route.ts`

Audit:
- Is the **flag change** audit-logged?
- Is the **flag change** effective immediately for all clients? (cache invalidation)
- Is the **flag rollback** supported?
- Is the **flag target** supported (e.g. enable for 10% of users)?

**Fix:** audit for the above.

### 4.21 [P0] `/api/admin/announcements/route.ts` — announcements

**File:** `web/src/app/api/admin/announcements/route.ts`

Audit:
- Is the **announcement publish** audit-logged?
- Is the **publish date** validated (not in the past)?
- Is the **expiry** enforced?
- Is the **content** sanitized (XSS)?

**Fix:** audit for the above.

### 4.22 [P1] `/api/admin/health/route.ts` — admin health check

**File:** `web/src/app/api/admin/health/route.ts`

Audit:
- Is this endpoint **internal-only**? (exposing detailed health to the public is a fingerprinting risk)
- Does it leak **DB connection strings, env vars, or stack traces**?
- Is the **response cached**? (health checks should be real-time)

**Fix:** gate behind `requireAdmin()`, sanitize response, never cache.

### 4.23 [P1] `/api/admin/maintenance-mode/route.ts` — maintenance mode toggle

**File:** `web/src/app/api/admin/maintenance-mode/route.ts`

This is a critical endpoint — flipping maintenance mode takes the system offline for riders. Audit:
- Is the **change audit-logged** with the admin's identity?
- Is the **change requires dual approval**? (a single super-admin should not be able to do this alone)
- Is the **state broadcast** to all running instances? (Next.js dev mode may have multiple workers)
- Is the **TTL** set (auto-revert after 1 hour if not extended)?

**Fix:** require dual approval (two admins), set a max TTL, broadcast via Redis or DB poll.

### 4.24 [P0] `/api/admin/kyc/route.ts` — KYC review queue

**File:** `web/src/app/api/admin/kyc/route.ts`

Audit:
- Is the **review action** (approve/reject) state-machine-validated?
- Is the **reviewer identity** recorded in the audit log?
- Is the **rider notification** triggered on decision?
- Is the **bulk review** supported? (an admin reviewing 100 KYC submissions at once)
- Is the **document download** for review authenticated? (a reviewer's `kyc_view` permission)

**Fix:** audit for the above.

### 4.25 [P0] `/api/admin/guarantors/route.ts` — guarantor review queue

**File:** `web/src/app/api/admin/guarantors/route.ts`

Same pattern as KYC. Audit:
- Is the **guarantor verification** state-machine-validated?
- Is the **rider notification** triggered?
- Is the **PII redaction** enforced in the listing?

**Fix:** audit for the above.

### 4.26 [P1] `/api/admin/legal/route.ts` — legal documents

**File:** `web/src/app/api/admin/legal/route.ts`

Audit:
- Is the **version** incremented on every change?
- Is the **rider re-consent** triggered when terms change?
- Is the **effective date** validated?

**Fix:** audit for the above.

### 4.27 [P1] `/api/admin/referrals/route.ts` — referral management

**File:** `web/src/app/api/admin/referrals/route.ts`

Audit:
- Is the **referral fraud detection** present? (a rider creating 100 fake accounts to claim 100 referral bonuses)
- Is the **reward calculation** correct (cap on number of successful referrals per day)?
- Is the **change audit-logged**?

**Fix:** audit for the above.

### 4.28 [P0] `/api/admin/rewards/route.ts` — rewards config

**File:** `web/src/app/api/admin/rewards/route.ts`

Audit:
- Is the **reward cap** enforced (e.g. max 10,000 INR/month per rider)?
- Is the **reward fraud** detection present?
- Is the **change audit-logged**?

**Fix:** audit for the above.

### 4.29 [P0] `/api/admin/system-settings/route.ts` — system config

**File:** `web/src/app/api/admin/system-settings/route.ts`

System settings (max KYC age, max rental duration, OTP expiry, etc.) directly affect behavior. Audit:
- Is the **change audit-logged**?
- Is the **change requires dual approval** for security-critical settings?
- Is the **change validated** (e.g. OTP expiry must be 1-30 min)?
- Is the **change broadcast** to all running instances?

**Fix:** audit for the above.

### 4.30 [P1] `/api/admin/dashboard/route.ts` — admin dashboard data

**File:** `web/src/app/api/admin/dashboard/route.ts`

Audit:
- Is the **data** aggregated efficiently? (N+1 queries across riders, transactions, KYC)
- Is the **cache TTL** set (dashboard data is 5-min stale acceptable)?
- Is the **response size** bounded?

**Fix:** use Prisma aggregations, add 60s cache.

### 4.31 [P1] `/api/admin/analytics/route.ts` — analytics

**File:** `web/src/app/api/admin/analytics/route.ts`

Same as 4.30 plus:
- Are the **date range** and **filters** validated?
- Is the **data export** (CSV download) bounded?

**Fix:** audit for the above.

### 4.32 [P1] `/api/admin/admins/route.ts` — admin user management

**File:** `web/src/app/api/admin/admins/route.ts`

Audit:
- Can an admin **change their own role** to escalate?
- Can an admin **deactivate themselves**? (potential lockout)
- Is the **admin creation** permission-gated (only `super_admin`)?
- Is the **admin's password** rotated on creation?

**Fix:** prevent self-role-change, prevent self-deactivation, require `super_admin` for create.

### 4.33 [P0] `/api/admin/auth/login/route.ts` and `/api/admin/auth/auto-login/route.ts` — admin auth

**Files:** `web/src/app/api/admin/auth/login/route.ts`, `admin/auth/auto-login/route.ts`

The previous broad audit (admin web) covered this. The additional finding:
- `auto-login` is gated by `ENABLE_DEV_ADMIN_LOGIN` env flag (correct), but the route is still mounted in production. If the env flag is true in prod (developer mistake), the route auto-logs in. There's no defense-in-depth (e.g. require a header `X-Dev-Auth: <secret>`).
- Login rate limit: verify the per-IP and per-admin rate limits are strict.

**Fix:** require an additional header for auto-login, even when env flag is true. Strengthen rate limits.

### 4.34 [P0] `/api/admin/auth/refresh/route.ts` — admin token refresh

**File:** `web/src/app/api/admin/auth/refresh/route.ts`

Same as 2.10: no rate limit on refresh. A stolen refresh token can refresh forever.

**Fix:** add per-token rate limit, revoke family on 10 failures.

### 4.35 [P1] `/api/admin/auth/logout/route.ts` and `/api/admin/auth/me/route.ts` — admin auth

**Files:** `web/src/app/api/admin/auth/logout/route.ts`, `admin/auth/me/route.ts`

Audit:
- `logout`: does it invalidate the refresh token or just delete the cookie? (if the refresh token is still valid, the next refresh succeeds)
- `me`: does it return the full admin object or just the essentials? (returning the password hash would be a disaster)

**Fix:** revoke refresh token on logout, return minimal admin data on `me`.

### 4.36 [P1] `/api/admin/reconciliation/route.ts` — manual reconciliation

**File:** `web/src/app/api/admin/reconciliation/route.ts`

Reconciliation is critical. Audit:
- Is the **manual reconciliation** permission-gated (only `super_admin`)?
- Is the **action idempotent** (running twice doesn't double-credit)?
- Is the **change audit-logged** with what was reconciled?
- Is the **diff report** generated before applying?

**Fix:** audit for the above.

### 4.37 [P0] `/api/admin/scores/route.ts` and `/api/admin/scores/recalculate/route.ts` — rider score

**Files:** `web/src/app/api/admin/scores/route.ts`, `scores/recalculate/route.ts`

Rider scores affect business decisions (rental approval, deposit requirements). Audit:
- Is the **recalculation** async (background job)?
- Is the **recalculation** rate-limited (1/hour per rider)?
- Is the **change audit-logged** with old/new score?
- Is the **score formula** versioned (so old scores can be re-computed)?

**Fix:** audit for the above.

### 4.38 [P1] `/api/admin/shifts/route.ts` — shift management

**File:** `web/src/app/api/admin/shifts/route.ts`

Audit:
- Are the **shift times** validated (e.g. not overlapping with maintenance)?
- Is the **shift change** audit-logged?
- Are the **rider assignments** to shifts validated (no double-booking)?

**Fix:** audit for the above.

### 4.39 [P0] `/api/admin/fleet/route.ts` — fleet management

**File:** `web/src/app/api/admin/fleet/route.ts`

Audit:
- Is the **vehicle assignment** to a hub validated (vehicle exists, hub has capacity)?
- Is the **vehicle status change** audit-logged?
- Is the **rental status** checked before reassignment?

**Fix:** audit for the above.

### 4.40 [P1] `/api/admin/hubs/route.ts` and `/api/admin/hubs/bulk/route.ts` — hub management

**Files:** `web/src/app/api/admin/hubs/route.ts`, `hubs/bulk/route.ts`

Audit:
- Is the **hub location** validated (lat/lng within country)?
- Is the **hub capacity** enforced when assigning vehicles?
- Is the **bulk hub update** in a transaction?

**Fix:** audit for the above.

### 4.41 [P0] `/api/admin/vehicles/route.ts`, `vehicles/bulk/route.ts`, `vehicles/[id]/history/route.ts` — vehicle management

**Files:** `web/src/app/api/admin/vehicles/route.ts`, `vehicles/bulk/route.ts`, `vehicles/[id]/history/route.ts`

Audit:
- Is the **vehicle history** read permission-gated? (a hub manager should only see their own hub's vehicles)
- Is the **bulk vehicle update** in a transaction?
- Is the **vehicle reassignment** to a rider/team leader validated?

**Fix:** audit for the above.

### 4.42 [P1] `/api/admin/audit-logs/route.ts` — audit log viewer

**File:** `web/src/app/api/admin/audit-logs/route.ts`

Audit:
- Is the **listing** permission-gated (only `audit_read`)?
- Is the **date range** bounded?
- Is the **export** permission-gated separately?
- Is the **export size** bounded?

**Fix:** audit for the above.

### 4.43 [P0] `/api/admin/tickets/route.ts`, `tickets/bulk/route.ts`, `tickets/[id]/route.ts`, `tickets/[id]/messages/route.ts` — ticket management

**Files:** `web/src/app/api/admin/tickets/route.ts`, `tickets/bulk/route.ts`, `tickets/[id]/route.ts`, `tickets/[id]/messages/route.ts`

Audit:
- Is the **ticket state machine** enforced? (e.g. CLOSED cannot receive new messages)
- Is the **ticket assignment** to an agent validated?
- Is the **ticket message** sanitized (XSS)?
- Is the **bulk ticket action** in a transaction?
- Is the **ticket reopen** permission-gated?

**Fix:** audit for the above.

### 4.44 [P1] `/api/admin/deposits/route.ts` — deposit management

**File:** `web/src/app/api/admin/deposits/route.ts`

Audit:
- Is the **deposit refund** permission-gated (`finance_admin` only)?
- Is the **refund amount** validated (not exceeding original)?
- Is the **refund audit-logged**?
- Is the **rider notification** triggered?

**Fix:** audit for the above.

### 4.45 [P0] `/api/admin/earnings/route.ts` — earnings

**File:** `web/src/app/api/admin/earnings/route.ts`

Audit:
- Is the **earnings export** (CSV) bounded?
- Is the **rider PII** redacted in the export?
- Is the **export permission** separate from the list?

**Fix:** audit for the above.

### 4.46 [P0] `/api/admin/transactions/route.ts` and `/api/admin/transactions/bulk/route.ts` — transactions

**Files:** `web/src/app/api/admin/transactions/route.ts`, `transactions/bulk/route.ts`

Audit:
- Is the **transaction list** scoped to the admin's role? (a hub manager should not see all transactions)
- Is the **bulk transaction action** (refund, reverse) in a transaction?
- Is the **refund** amount validated (not exceeding original)?
- Is the **rider notification** triggered on refund?

**Fix:** audit for the above.

### 4.47 [P1] `/api/admin/plans/route.ts` — rental plan config

**File:** `web/src/app/api/admin/plans/route.ts`

Audit:
- Is the **plan change** audit-logged?
- Is the **plan change** validated (e.g. cannot reduce durationDays below active rentals)?
- Is the **plan deletion** soft or hard? (a hard delete orphans historical rentals)

**Fix:** audit for the above.

### 4.48 [P0] `/api/admin/rentals/route.ts` — rental management

**File:** `web/src/app/api/admin/rentals/route.ts`

Audit:
- Is the **rental override** (extend, cancel, refund) state-machine-validated?
- Is the **rental cancellation** audit-logged with reason?
- Is the **rider notification** triggered on cancellation?

**Fix:** audit for the above.

### 4.49 [P0] `/api/admin/offers/route.ts` — offers/promotions

**File:** `web/src/app/api/admin/offers/route.ts`

Audit:
- Is the **offer change** audit-logged?
- Is the **offer target** validated (max 100k recipients)?
- Is the **offer redemption** atomic (no double-redemption)?

**Fix:** audit for the above.

### 4.50 [P1] `/api/admin/workflow-coverage/route.ts` — workflow coverage

**File:** `web/src/app/api/admin/workflow-coverage/route.ts`

Likely a test-coverage or admin-coverage metric. Audit:
- Is the **data** cached?
- Is the **data** expensive to compute?

**Fix:** audit for the above.

---

## 5. File/asset routes

6 files under `/api/files/*`. These are the highest-data-volume routes (file uploads/downloads) and a major attack surface.

### 5.1 [P0] `/api/files/[...path]/route.ts` (8.8 KB) — catch-all file path route

**File:** `web/src/app/api/files/[...path]/route.ts`

The previous broad audit noted this is "8.8 KB, large for a file-serving route. Probably has lots of methods (GET, POST, DELETE) or auth checks." Need to verify:
- Does it support `GET`, `POST`, `PUT`, `DELETE`? (a single catch-all handling all methods is unusual)
- Is the path **path-traversal** protected? (e.g. `..%2F..%2Fetc%2Fpasswd`)
- Is the **content-type** sniffed from the file extension, or trusted from the URL? (a `.txt` URL with PNG bytes should be served as `text/plain`, not `image/png`)
- Is the **file size** enforced (no streaming a 10GB file to memory)?
- Is the **caching** set correctly (`Cache-Control: private, max-age=0` for sensitive files)
- Is the **auth check** at the route level, or per-file (e.g. file owner)?
- Is the **storage provider** abstracted? (the local-storage vs S3-vs-GCS abstraction)

**Fix:** audit the route for the above. The path-traversal check is critical.

### 5.2 [P0] `/api/files/request-upload/route.ts` and `/api/files/confirm-upload/route.ts` — presigned upload

**Files:** `web/src/app/api/files/request-upload/route.ts`, `confirm-upload/route.ts`

The two-step upload pattern (request presigned URL → upload to storage → confirm) is correct. Audit:
- Is the **presigned URL** scoped to the rider's ID? (a rider can't upload to another rider's path)
- Is the **URL TTL** short (e.g. 5 minutes)?
- Is the **upload size** enforced (max 10 MB)?
- Is the **content-type** enforced (e.g. only `image/*` for KYC documents)?
- Is the **confirm step** idempotent?
- Is the **rider notified** if the upload is rejected?

**Fix:** audit for the above.

### 5.3 [P0] `/api/files/direct-upload/route.ts` — direct upload (no presigning)

**File:** `web/src/app/api/files/direct-upload/route.ts`

Direct upload (the file is sent to the Next.js server, which forwards to storage) has a different threat model:
- The **file size** is bounded by `withRequestSizeLimit` (1MB default). Verify KYC documents (aadhaar, PAN) can be uploaded within 1MB.
- The **content-type** is set by the client. Verify server-side validation (sniff the first bytes).
- The **file is stored temporarily** and moved to permanent storage. Verify the temp file is cleaned up on failure.
- The **rider ID** is embedded in the file path. Verify no path injection.

**Fix:** raise the size limit for KYC documents (5MB), validate content-type server-side, ensure temp file cleanup.

### 5.4 [P0] `/api/files/local-upload/[fileRecordId]/route.ts` — local file retrieval

**File:** `web/src/app/api/files/local-upload/[fileRecordId]/route.ts`

Laptop-mode file storage. Audit:
- Is the **fileRecordId** validated? (UUID? or any string?)
- Is the **file owner** checked? (a rider can only download their own files)
- Is the **file content-type** sniffed? (not trusted from the DB)
- Is the **path traversal** prevented? (`../../../etc/passwd`)
- Is the **file size** enforced (no streaming huge files)?
- Is the **download audit-logged**?

**Fix:** audit for the above. The file owner check is critical.

### 5.5 [P1] `/api/files/request-read/route.ts` — read presigned URL

**File:** `web/src/app/api/files/request-read/route.ts`

Audit:
- Is the **rider permission** checked (a rider can only read their own files)?
- Is the **URL TTL** short (e.g. 5 minutes)?
- Is the **download count** tracked? (a presigned URL reused 1000 times is a leak)

**Fix:** audit for the above.

---

## 6. Cron + internal routes

3 cron routes + 2 internal routes. These are typically less audited but high-impact.

### 6.1 [P0] `/api/cron/reconciliation/route.ts` (already audited) — wallet reconciliation

**File:** `web/src/app/api/cron/reconciliation/route.ts`

The previous broad audit covered this. The new finding: verify the cron secret comparison is constant-time (the broad audit noted `cron-auth.ts` uses `!==`). The reconciliation is destructive — a malicious caller with the secret can desync wallets.

### 6.2 [P0] `/api/cron/notifications/route.ts` — notification dispatch cron

**File:** `web/src/app/api/cron/notifications/route.ts`

Audit:
- Is the **secret** constant-time compared?
- Is the **rate limit** set (e.g. only run every 60s)?
- Is the **action idempotent** (running twice doesn't double-dispatch)?
- Is the **error handling** correct (failed dispatches retry)?

**Fix:** audit for the above.

### 6.3 [P0] `/api/cron/cleanup-telemetry/route.ts` — telemetry cleanup

**File:** `web/src/app/api/cron/cleanup-telemetry/route.ts`

Audit:
- Is the **retention period** enforced (e.g. 90 days)?
- Is the **deletion soft or hard**? (hard = irreversible)
- Is the **cleanup audit-logged**?
- Is the **secret** constant-time compared?

**Fix:** audit for the above.

### 6.4 [P0] `/api/internal/debug/route.ts` — internal debug endpoint

**File:** `web/src/app/api/internal/debug/route.ts`

This endpoint is likely gated by `WORKER_SECRET`. Audit:
- Is the **secret** constant-time compared?
- Is the **endpoint disabled** in production (or is `INTERNAL_ROUTES_ENABLED` env flag used)?
- Is the **response data** sensitive (DB state, env vars)?
- Is the **access audit-logged**?

**Fix:** audit for the above. Internal endpoints are a common backdoor.

### 6.5 [P0] `/api/internal/worker/route.ts` — internal worker endpoint

**File:** `web/src/app/api/internal/worker/route.ts`

Likely a cron-triggered worker. Audit:
- Is the **secret** constant-time compared?
- Is the **action idempotent**?
- Is the **action** audit-logged?

**Fix:** audit for the above.

---

## 7. Transaction + payment routes

3 transaction routes + 2 payment-gateway routes + 1 v1 route.

### 7.1 [P0] `/api/transaction/topup/route.ts` (covered in 3.8-3.10)

See findings 3.8, 3.9, 3.10. The money path.

### 7.2 [P0] `/api/transaction/request/route.ts` — payment request

**File:** `web/src/app/api/transaction/request/route.ts`

Audit:
- Is the **request amount** validated (positive, within rider's daily limit)?
- Is the **request idempotent** via `x-idempotency-key`?
- Is the **request audit-logged**?
- Is the **rider permission** checked (the rider's account is in good standing)?

**Fix:** audit for the above.

### 7.3 [P0] `/api/transaction/history/route.ts` — transaction history

**File:** `web/src/app/api/transaction/history/route.ts`

Audit:
- Is the **rider scope** enforced (only their own transactions)?
- Is the **date range** bounded (max 1 year)?
- Is the **page size** capped (e.g. max 100)?
- Is the **export** (CSV) permission-gated and rate-limited?

**Fix:** audit for the above.

### 7.4 [P0] `/api/admin/payment-gateways/[id]/route.ts` (covered in 4.10)

See finding 4.10. The gateway config endpoint.

### 7.5 [P0] `/api/v1/payment-gateways/active/route.ts` — list active gateways (rider-facing)

**File:** `web/src/app/api/v1/payment-gateways/active/route.ts`

Rider-facing endpoint to show available payment gateways. Audit:
- Is the **rider's region** checked (some gateways are country-specific)?
- Is the **gateway's `enabled` flag** checked (not just `active`)?
- Is the **gateway's credentials** exposed (e.g. UPI VPA)?

**Fix:** audit for the above. Leaking a UPI VPA would let anyone pay to the company.

---

## 8. Support + notification + sync routes

### 8.1 [P0] `/api/support/tickets/route.ts` and `/api/support/tickets/[id]/route.ts` — ticket CRUD

**Files:** `web/src/app/api/support/tickets/route.ts`, `tickets/[id]/route.ts`

Audit:
- Is the **rider permission** checked (own tickets only)?
- Is the **ticket state machine** enforced?
- Is the **ticket closure** audit-logged?
- Is the **admin response** notification triggered?

**Fix:** audit for the above.

### 8.2 [P0] `/api/support/chat/route.ts` — chat endpoint

**File:** `web/src/app/api/support/chat/route.ts`

Audit:
- Is the **chat session** scoped to the rider?
- Is the **message content** sanitized (XSS)?
- Is the **message rate limit** set (e.g. 10 messages/min)?
- Is the **chat history** bounded?

**Fix:** audit for the above.

### 8.3 [P1] `/api/support/faqs/route.ts` and `/api/support/feedback/route.ts` — FAQ + feedback

**Files:** `web/src/app/api/support/faqs/route.ts`, `feedback/route.ts`

Likely read-mostly. Audit:
- Is the **feedback** rate-limited (spam prevention)?
- Is the **FAQ** cacheable?

**Fix:** audit for the above.

### 8.4 [P0] `/api/notification/list/route.ts` — notification list

**File:** `web/src/app/api/notification/list/route.ts`

Audit:
- Is the **rider scope** enforced (own notifications only)?
- Is the **pagination** capped?
- Is the **read/unread** state stored on the server or client (the client can lie)?

**Fix:** audit for the above.

### 8.5 [P0] `/api/sync/queue/route.ts` — sync queue

**File:** `web/src/app/api/sync/queue/route.ts`

Audit:
- Is the **queue size** bounded (a rider with 10k events)?
- Is the **deduplication** by client event ID?
- Is the **order** preserved?
- Is the **failure handling** correct (partial failures)?

**Fix:** audit for the above.

---

## 9. Operational routes

4 health + 2 monitoring + 1 ready + 1 search.

### 9.1 [P0] `/api/health/route.ts` — root health check

**File:** `web/src/app/api/health/route.ts`

Audit:
- Is the **response** detailed? (DB pool, queue depth, etc.) — if so, is it auth-gated?
- Is the **DB check** cached? (a health check hitting the DB on every poll is expensive)
- Is the **response cached**? (a public health check should be fast)

**Fix:** split into public health (basic) and admin health (detailed).

### 9.2 [P0] `/api/health/db/route.ts`, `/api/health/storage/route.ts`, `/api/health/worker/route.ts` — component health

**Files:** `web/src/app/api/health/db/route.ts`, `health/storage/route.ts`, `health/worker/route.ts`

Audit:
- Are they **auth-gated**? (detailed component health leaks infrastructure)
- Do they include **error details**? (DB connection string, S3 endpoint, worker queue URL)
- Are they **rate-limited**?

**Fix:** auth-gate, sanitize response, rate-limit.

### 9.3 [P0] `/api/ready/route.ts` — readiness check

**File:** `web/src/app/api/ready/route.ts`

Used by k8s/load balancer. Audit:
- Is the **DB ping** fast? (a slow `SELECT 1` would block readiness)
- Is the **check** cached? (a readiness check every second is fine, but every request is too much)
- Does it return 503 when not ready (not 200)?

**Fix:** audit for the above.

### 9.4 [P1] `/api/metrics/route.ts` and `/api/metrics/monitoring/metrics/route.ts` — Prometheus metrics

**Files:** `web/src/app/api/metrics/route.ts`, `monitoring/metrics/route.ts`

Audit:
- Is the **endpoint** Prometheus-format?
- Is it **auth-gated**? (Prometheus metrics are public by convention; verify)
- Does it **leak PII**? (no rider IDs in metrics)

**Fix:** audit for the above.

### 9.5 [P0] `/api/search/route.ts` (4.1 KB) — admin search

**File:** `web/src/app/api/search/route.ts`

Likely an admin search across riders, transactions, KYC. Audit:
- Is the **search input** sanitized for Prisma `contains`?
- Is the **result set** bounded (e.g. 100 max)?
- Is the **search permission** separate (`search_all`)?
- Is the **search rate-limited** (a junior admin can hammer it)?

**Fix:** audit for the above.

---

## 10. Webhooks

### 10.1 [P0] `/api/webhooks/payment/route.ts` — payment webhook

**File:** `web/src/app/api/webhooks/payment/route.ts`

**Critical endpoint** — receives payment confirmations from external gateways. Audit:
- Is the **webhook signature** verified (HMAC, e.g. Razorpay's `X-Razorpay-Signature` header)?
- Is the **signature constant-time** compared?
- Is the **webhook idempotent**? (a gateway may retry; the same payment should not be applied twice)
- Is the **webhook processed in a transaction**? (DB write + downstream side effects)
- Is the **webhook payload size** bounded?
- Is the **unknown event type** handled gracefully (not 500)?
- Is the **error response** safe to retry (e.g. 5xx for transient errors, 4xx for permanent)?

**Fix:** audit for the above. The signature verification is non-negotiable.

---

## 11. Misc routes

### 11.1 [P0] `/api/pricing/route.ts` — pricing data

**File:** `web/src/app/api/pricing/route.ts`

Audit:
- Is the **pricing** cached?
- Is the **pricing** versioned (so old clients get the old prices)?

**Fix:** audit for the above.

### 11.2 [P1] `/api/vehicles/route.ts` — vehicle list

**File:** `web/src/app/api/vehicles/route.ts`

Audit:
- Is the **list scoped** to the rider's hub?
- Is the **pagination** capped?
- Is the **rider auth** required (or public)?

**Fix:** audit for the above.

### 11.3 [P0] `/api/shifts/route.ts` — shift list

**File:** `web/src/app/api/shifts/route.ts`

Audit:
- Is the **shift assignment** validated (no double-booking)?
- Is the **rider auth** required?
- Is the **shift cache** invalidated on change?

**Fix:** audit for the above.

### 11.4 [P0] `/api/rider/rental/return/route.ts` — rental return

**File:** `web/src/app/api/rider/rental/return/route.ts`

**Money path.** Audit:
- Is the **return state machine** enforced (only ACTIVE rentals can be returned)?
- Is the **damage assessment** validated?
- Is the **deposit refund** calculated correctly (no negative balance)?
- Is the **rider permission** checked (only the rental's rider)?
- Is the **rental return idempotent**?

**Fix:** audit for the above.

### 11.5 [P1] `/api/device/data/route.ts` and `/api/rider/device/route.ts` — device data

**Files:** `web/src/app/api/device/data/route.ts`, `rider/device/route.ts`

Audit:
- Is the **device data** encrypted at rest?
- Is the **device data** purged after X days?
- Is the **device data** scoped to the rider?
- Is the **device data sync** idempotent?

**Fix:** audit for the above.

### 11.6 [P0] `/api/riders/dashboard/route.ts` (note: plural) and `/api/riders/register-token/route.ts` — riders

**Files:** `web/src/app/api/riders/dashboard/route.ts`, `riders/register-token/route.ts`

The plural `/api/riders/*` is separate from the singular `/api/rider/*`. Audit:
- `dashboard`: is this admin-facing or rider-facing? (the singular is rider-facing)
- `register-token`: is this for FCM registration? Verify scope

**Fix:** audit for the above.

### 11.7 [P0] `/api/rider/verify-lock-password/route.ts` — verify lock password

**File:** `web/src/app/api/rider/verify-lock-password/route.ts`

**Auth path.** Audit:
- Is the **rate limit** strict (5 attempts/15min)?
- Is the **comparison constant-time**?
- Is the **failure audit-logged**?
- Is the **rider locked out** after N failures?
- Is the **response time** constant (to prevent timing attacks)?

**Fix:** audit for the above.

### 11.8 [P1] `/api/sync/queue/route.ts` (covered in 8.5)

---

## 12. Server modules: auth + riders + kyc

The `auth/`, `riders/`, and `kyc/` modules are the highest-stakes modules in the codebase. They handle authentication, identity, and regulatory KYC. The previous broad audit covered some, but the deep read is below.

### 12.1 [P0] `auth/auth.use-cases.ts` — `sendOtp` rate limit may be bypassable

**File:** `web/src/server/modules/auth/auth.use-cases.ts` (`sendOtp` function)

The use-case takes `{ phone }` and an `{ ip }` context. The previous broad audit noted that `send-otp` has no phone-based rate limit (only IP-based). An attacker rotating IPs can send unlimited OTPs to a phone, which is a **smishing** enabler.

**Fix:** add a phone-based rate limit in the use-case (or route), 5/10min per phone.

### 12.2 [P0] `auth/auth.use-cases.ts` — `verifyOtp` likely has a timing attack on the OTP comparison

**File:** `web/src/server/modules/auth/auth.use-cases.ts` (`verifyOtp` function)

If the OTP comparison is a string `===`, an attacker can time the response to learn how many characters of their guess match. Use `crypto.timingSafeEqual` on equal-length buffers.

**Fix:** convert OTP to `Buffer`, pad both sides to fixed length (e.g. 32 bytes), use `crypto.timingSafeEqual`.

### 12.3 [P1] `auth/auth.use-cases.ts` — auto-provision dev rider

The `verify-otp` route (see 2.4) has 30+ lines of auto-provision logic that should be in the use-case. Audit the use-case for the same behavior in dev mode.

**Fix:** move auto-provision into a `authUseCases.verifyOtpForDev` method.

### 12.4 [P0] `riders/rider.repository.ts` — `findByPhone` and `findByRiderId` are the two primary lookup paths

**File:** `web/src/server/modules/riders/rider.repository.ts`

Audit:
- Is there an **index** on `phone`? (verified by broad audit: yes)
- Is there an **index** on `riderId`? (verified: yes)
- Is the **phone lookup case-insensitive**? (Indian phones start with `+91` or `91` or no prefix)
- Is the **phone lookup normalized**? (e.g. `9876543210` and `+919876543210` should match)

**Fix:** normalize phone to E.164 before lookup.

### 12.5 [P0] `riders/rider.repository.ts` — `update` method has no field whitelist

**File:** `web/src/server/modules/riders/rider.repository.ts` (`update` method)

If the `update` method takes a `data: any` argument and passes it to `db.rider.update({ data })`, a caller can update any field including `tokenVersion`, `riderId`, `accountStatus`. The use-case layer is supposed to whitelist fields, but the repository layer is the last line of defense.

**Fix:** define `AllowedUpdateFields` type in the repository; reject any field not in the whitelist.

### 12.6 [P1] `riders/rider.repository.ts` — no soft-delete pattern

**File:** `web/src/server/modules/riders/rider.repository.ts`

The `Rider` model has a `deletedAt` field (per the broad audit), but the repository may use `db.rider.delete()` instead of `db.rider.update({ where: { id }, data: { deletedAt: new Date() } })`. Hard delete = no recovery, no audit trail.

**Fix:** enforce soft delete in the repository. Add a `db.rider.findUnique({ where: { id } })` filter `{ deletedAt: null }` to all default queries.

### 12.7 [P0] `riders/rider-lifecycle.service.ts` — rider lifecycle state machine

**File:** `web/src/server/modules/riders/rider-lifecycle.service.ts`

The `RiderLifecycle` has states like `PENDING`, `OTP_SENT`, `OTP_VERIFIED`, `KYC_PENDING`, `KYC_SUBMITTED`, `KYC_APPROVED`, `ACTIVE`, `SUSPENDED`, `TERMINATED`. Audit:
- Are all transitions valid? (e.g. `TERMINATED → ACTIVE` should be forbidden)
- Are the transitions **idempotent**? (running `verifyOtp` twice doesn't move state twice)
- Is the state machine **the only way** to change state? (a raw `db.rider.update` can bypass it)
- Is the state machine **transactional**? (a state change and a side effect should be atomic)

**Fix:** enforce at the database level with a CHECK constraint or a trigger; OR enforce in the use-case layer and add a startup test that no `db.rider.update` is called outside the use-case.

### 12.8 [P0] `kyc/kyc.use-cases.ts` — KYC state machine

**File:** `web/src/server/modules/kyc/kyc.use-cases.ts`

The KYC module has a state machine. Audit:
- Is the **KYC submission** allowed only from `PENDING` or `REJECTED`? (a re-submission after approval should fail)
- Is the **KYC approval** allowed only with all required documents uploaded?
- Is the **KYC rejection** allowed only by an admin with `kyc_review` permission?
- Is the **KYC re-review** allowed only by a different reviewer (separation of duties)?
- Is the **document storage** immutable? (a document uploaded once cannot be replaced)

**Fix:** audit for the above. The re-review separation is a SOC2 control.

### 12.9 [P1] `kyc/kyc.repository.ts` — document URLs stored as plain strings

**File:** `web/src/server/modules/kyc/kyc.repository.ts`

The KYC documents are stored as URL strings in the `Rider` model (per the broad audit, 90+ columns). The URL is the only thing tying a document to the rider. Audit:
- Is the URL **signed**? (otherwise the storage URL is public)
- Is the URL **stored encrypted**? (the broad audit noted `pii-crypto.ts` is used for some PII; verify KYC URLs use it)
- Is the **document content** validated? (the upload endpoint should sniff the file, not trust the extension)

**Fix:** audit for the above.

### 12.10 [P0] `kyc/kyc-state-machine.ts` — likely a pure function module

**File:** `web/src/server/modules/kyc/kyc-state-machine.ts`

The previous broad audit noted that this is a pure function module — the right pattern. The bug, per the prior audit, is in `rider-lifecycle` (see 12.7), not KYC. But the KYC state machine should still be audited for:
- All states reachable? (any unreachable state is dead code)
- All transitions explicit? (no implicit transitions via "re-submit on any state")
- Error messages are clear? (a rider should understand why they can't submit)

**Fix:** add a state-machine unit test that covers all transitions.

### 12.11 [P0] `riders/rider.use-cases.ts` and `riders/admin-riders.use-cases.ts` — duplicated business logic

**Files:** `web/src/server/modules/riders/rider.use-cases.ts`, `riders/admin-riders.use-cases.ts`

The rider-side and admin-side use-cases are likely duplicating logic (e.g. the `update` method). Audit:
- Is the **field whitelist** consistent across both?
- Is the **audit log** written in both?
- Is the **state machine** enforced in both?

**Fix:** consolidate to a single `riderCore.update` method; thin wrappers in both sides.

### 12.12 [P0] `riders/rider.schemas.ts` — Zod schemas

**File:** `web/src/server/modules/riders/rider.schemas.ts`

The Zod schemas here are likely a mirror of `validators.ts` schemas. The duplication is a code smell. Audit:
- Are the schemas **identical** to the validator versions?
- Is one preferred over the other (single source of truth)?

**Fix:** consolidate to one location.

### 12.13 [P0] `auth/auth.repository.ts` — admin lookup

**File:** `web/src/server/modules/auth/auth.repository.ts`

Audit:
- Is the **admin password** stored hashed (bcrypt/argon2)?
- Is the **admin lookup** case-insensitive for email?
- Is the **admin deactivation** check enforced (inactive admins can't log in)?

**Fix:** audit for the above.

### 12.14 [P1] `auth/auth.use-cases.ts` — token issuance

**File:** `web/src/server/modules/auth/auth.use-cases.ts`

Audit:
- Is the **access token** returned in the response body AND set in the cookie? (yes, per `verify-otp/route.ts:122-128`)
- Is the **refresh token** stored hashed in the DB? (so a DB leak doesn't give access)
- Is the **refresh token** rotated on each use?

**Fix:** audit for the above.

### 12.15 [P0] `kyc/kyc.use-cases.ts` — `submitKyc` accepts a `riderId` parameter?

**File:** `web/src/server/modules/kyc/kyc.use-cases.ts` (`submitKyc` function)

The route (3.1) calls `kycUseCases.submitKyc(session.riderDbId, validation.data)`. The use-case takes `riderDbId` from the session, but if it also takes a `riderId` from the input, a rider could pass another rider's ID.

**Fix:** audit the use-case signature; the `riderDbId` should come **only** from the session.

---

## 13. Server modules: wallet + transactions + deposits

The money path. These are the most critical modules in the codebase.

### 13.1 [P0] `wallet/wallet.repository.ts` — direct balance update vs ledger entry

**File:** `web/src/server/modules/wallet/wallet.repository.ts`

The wallet module has a `WalletLedger` (per file naming). Audit:
- Is the **balance** computed from the ledger (sum of entries) or stored on the `Rider` model directly?
- If both, are they kept in sync? (a direct update to `rider.walletBalance` would desync)
- Is the **ledger append-only**? (no UPDATE or DELETE on ledger entries)
- Is the **ledger idempotent**? (no double-application of the same entry)

**Fix:** single source of truth: `rider.walletBalance` should be a derived view, not a stored column.

### 13.2 [P0] `wallet/wallet-ledger.service.ts` — ledger operations

**File:** `web/src/server/modules/wallet/wallet-ledger.service.ts`

The previous broad audit referenced this file. Audit:
- Is **every** state change in the system a ledger entry? (deposits, refunds, top-ups, fees, penalties)
- Is the **ledger entry** immutable? (no UPDATE/DELETE allowed)
- Is the **running balance** computed efficiently? (sum of entries is O(n) per read; consider a materialized view)
- Is the **negative balance** prevented? (a debit cannot exceed the available balance)

**Fix:** add a `ledger_entries_balance` materialized view or a per-rider cached balance updated via trigger.

### 13.3 [P0] `wallet/wallet.use-cases.ts` — `requestTopup` is the rider-facing top-up

**File:** `web/src/server/modules/wallet/wallet.use-cases.ts` (`requestTopup` function)

The route (`/api/transaction/topup/route.ts`) calls this. Audit:
- Is the **top-up idempotent**? (a rider double-clicks the Pay button)
- Is the **amount validated**? (positive, within rider's daily limit, within gateway's min/max)
- Is the **purpose** validated? (one of the allowed enums)
- Is the **method** validated? (one of the allowed enums)
- Is the **UPI ref / proof URL** validated?
- Is the **rider's KYC status** checked? (a PENDING KYC rider can top up?)
- Is the **rider's account status** checked? (a SUSPENDED rider can top up?)

**Fix:** audit for the above.

### 13.4 [P0] `wallet/wallet.use-cases.ts` — `autoApproveTopup` for test mode

**File:** `web/src/server/modules/wallet/wallet.use-cases.ts` (`autoApproveTopup` function or similar)

The route (7.1) returns `transaction.status === 'APPROVED' ? 'Payment auto-approved (test mode)'`. This is the dev-only auto-approval. Audit:
- Is the **auto-approval** gated by an env flag?
- Is the **auto-approval** only for `TEST_PHONES` (the same hardcoded list from `verify-otp/route.ts`)?
- Is the **auto-approval** logged with a clear test-mode marker?

**Fix:** consolidate the test-mode logic with `authUseCases.sendOtp` to use a single env flag.

### 13.5 [P0] `wallet/wallet.service.ts` — wallet business logic

**File:** `web/src/server/modules/wallet/wallet.service.ts`

Audit:
- Is the **balance check** before debit enforced at the service level (not the route)?
- Is the **debit transaction** atomic with the side effect (e.g. debit + rental create)?
- Is the **refund** capped at the original transaction amount?
- Is the **rider notification** triggered on every wallet change?

**Fix:** audit for the above.

### 13.6 [P0] `transactions/transaction.use-cases.ts` — request, history, status

**File:** `web/src/server/modules/transactions/transaction.use-cases.ts`

Audit:
- Is the **request** idempotent via `x-idempotency-key`?
- Is the **history** paginated and bounded?
- Is the **status transition** state-machine-validated (PENDING → APPROVED/REJECTED, no skipping)?
- Is the **rejection** audit-logged with the admin's reason?

**Fix:** audit for the above.

### 13.7 [P0] `transactions/transaction.repository.ts` — repository

**File:** `web/src/server/modules/transactions/transaction.repository.ts`

Audit:
- Is the **transaction reference** unique? (prevent double-spend via duplicate references)
- Is the **rider ID** indexed?
- Is the **status** indexed (for queries like "find all PENDING")?

**Fix:** audit for the above.

### 13.8 [P0] `transactions/transaction.service.ts` — service layer

**File:** `web/src/server/modules/transactions/transaction.service.ts`

Audit:
- Is the **side effect** (e.g. wallet credit on transaction APPROVED) atomic with the status change?
- Is the **reversal** (refund) handled correctly?
- Is the **partial refund** supported? (e.g. refund half of a top-up)

**Fix:** audit for the above.

### 13.9 [P0] `transactions/transaction-state-machine.ts` — state machine

**File:** `web/src/server/modules/transactions/transaction-state-machine.ts`

Audit:
- All states reachable?
- All transitions explicit?
- Error messages clear?
- Terminal states truly terminal?

**Fix:** add a state-machine unit test.

### 13.10 [P0] `deposits/deposit.use-cases.ts` — deposit management

**File:** `web/src/server/modules/deposits/deposit.use-cases.ts`

Audit:
- Is the **deposit refund** state-machine-validated?
- Is the **rider notification** triggered on deposit events?
- Is the **deposit aging** tracked (e.g. 30-day no-refund)?

**Fix:** audit for the above.

### 13.11 [P0] `deposits/deposit-state-machine.ts` — deposit state machine

**File:** `web/src/server/modules/deposits/deposit-state-machine.ts`

Audit:
- All states reachable? (e.g. PENDING, HELD, REFUNDED, FORFEITED)
- All transitions explicit?
- Forfeiture requires admin approval?
- Refund requires the original deposit's existence?

**Fix:** add a state-machine unit test.

### 13.12 [P0] `deposits/deposit-ledger.service.ts` — deposit ledger

**File:** `web/src/server/modules/deposits/deposit-ledger.service.ts`

Same anti-pattern check as 13.1/13.2.

### 13.13 [P1] `deposits/deposit.repository.ts` — repository

Audit:
- Is the **deposit ID** indexed?
- Is the **rider ID** indexed?
- Is the **status** indexed?

---

## 14. Server modules: rentals + vehicles + hubs

The rental flow is the core business logic.

### 14.1 [P0] `rentals/rental.use-cases.ts` — `bookRental` is the most critical use-case

**File:** `web/src/server/modules/rentals/rental.use-cases.ts` (`bookRental` function)

Audit:
- Is the **vehicle availability** check (vehicle not already booked for this shift) atomic with the rental create?
- Is the **rider's KYC status** checked? (only APPROVED can book)
- Is the **rider's account status** checked? (only ACTIVE can book)
- Is the **rider's deposit** sufficient? (held in wallet)
- Is the **shift's start time** in the future?
- Is the **idempotency** enforced? (same rider double-booking)
- Is the **audit log** written?
- Is the **rental reference** unique?
- Is the **state machine** set to `BOOKED` (not `ACTIVE`)?

**Fix:** wrap in `db.$transaction([check availability, deduct deposit, create rental])`.

### 14.2 [P0] `rentals/rental.use-cases.ts` — `cancelRental`

**File:** `web/src/server/modules/rentals/rental.use-cases.ts` (`cancelRental` function)

Audit:
- Is the **cancellation window** enforced? (e.g. no cancel after start time)
- Is the **penalty** calculated correctly?
- Is the **deposit refund** atomic with the cancellation?
- Is the **state machine** validated? (only BOOKED can be CANCELLED, not ACTIVE)
- Is the **rider notification** triggered?

**Fix:** audit for the above.

### 14.3 [P0] `rentals/rental.use-cases.ts` — `returnRental`

**File:** `web/src/server/modules/rentals/rental.use-cases.ts` (`returnRental` function)

Audit:
- Is the **rental status** `ACTIVE` before return? (not `BOOKED`, not `COMPLETED`)
- Is the **damage assessment** validated (admin-only)?
- Is the **final charge** calculated correctly (base + overage + damage)?
- Is the **deposit refund** correctly net of charges?
- Is the **vehicle status** updated to `AVAILABLE`?
- Is the **state machine** set to `COMPLETED`?

**Fix:** audit for the above. The damage assessment is a high-fraud area.

### 14.4 [P0] `rentals/rental-state-machine.ts` — state machine

**File:** `web/src/server/modules/rentals/rental-state-machine.ts`

States: BOOKED, ACTIVE, COMPLETED, CANCELLED, OVERDUE.

Audit:
- BOOKED → ACTIVE (on shift start) — is this auto-triggered or rider-initiated?
- BOOKED → CANCELLED (before shift start) — rider can cancel?
- ACTIVE → COMPLETED (on return) — admin/rider?
- ACTIVE → OVERDUE (auto, after shift end + grace)
- OVERDUE → COMPLETED (on late return)
- Any state → CANCELLED (admin override)

**Fix:** add a state-machine unit test. Verify no transition allows double-charge.

### 14.5 [P0] `rentals/rental.repository.ts` — repository

**File:** `web/src/server/modules/rentals/rental.repository.ts`

Audit:
- Is the **unique constraint** on (vehicleId, shiftId, leaseDate) preventing double-booking? (this is the safety net)
- Is the **rental reference** indexed?
- Is the **rider ID + status** indexed (for the rider's active rentals query)?

**Fix:** add the unique constraint if missing.

### 14.6 [P0] `vehicles/vehicle.use-cases.ts` — vehicle assignment

**File:** `web/src/server/modules/vehicles/vehicle.use-cases.ts`

Audit:
- Is the **vehicle-to-hub assignment** validated?
- Is the **vehicle-to-rider assignment** validated (only via rental)?
- Is the **vehicle status** state-machine-validated?
- Is the **vehicle history** immutable?

**Fix:** audit for the above.

### 14.7 [P0] `vehicles/vehicle-state-machine.ts` — vehicle state machine

**File:** `web/src/server/modules/vehicles/vehicle-state-machine.ts`

States: AVAILABLE, BOOKED, ACTIVE, MAINTENANCE, RETIRED.

Audit:
- AVAILABLE → BOOKED (on rental create)
- BOOKED → ACTIVE (on shift start)
- ACTIVE → AVAILABLE (on return)
- Any → MAINTENANCE (admin)
- Any → RETIRED (admin, irreversible)

**Fix:** add a state-machine unit test. RETIRED is terminal.

### 14.8 [P1] `vehicles/vehicle.repository.ts` — repository

Audit:
- Is the **plate number** indexed and unique?
- Is the **hub ID** indexed?
- Is the **status** indexed?

### 14.9 [P0] `hubs/hub.use-cases.ts` — hub management

**File:** `web/src/server/modules/hubs/hub.use-cases.ts`

Audit:
- Is the **hub capacity** enforced when adding vehicles?
- Is the **hub's active rentals** bounded?
- Is the **hub closure** audit-logged?

**Fix:** audit for the above.

### 14.10 [P0] `hubs/hub.repository.ts` — repository

**File:** `web/src/server/modules/hubs/hub.repository.ts`

Audit:
- Is the **hub ID** indexed?
- Is the **hub manager ID** indexed?
- Is the **hub location** (lat/lng) indexed for geo queries?

**Fix:** audit for the above.

### 14.11 [P1] `rentals/rental.service.ts` — service layer

Audit:
- Is the **pricing** applied consistently?
- Is the **overtime charge** calculated correctly?
- Is the **discount** applied correctly (single application)?

---

## 15. Server modules: guarantors + notifications + files

### 15.1 [P0] `guarantors/guarantor.use-cases.ts` — `submitGuarantor` accepts a `riderId` parameter?

**File:** `web/src/server/modules/guarantors/guarantor.use-cases.ts` (`submitGuarantor` function)

Same anti-pattern as 12.15. The use-case should derive `riderDbId` from the session, not from the body.

**Fix:** audit signature; `riderDbId` should be the first parameter and the only one.

### 15.2 [P0] `guarantors/guarantor-state-machine.ts` — state machine

**File:** `web/src/server/modules/guarantors/guarantor-state-machine.ts`

States: PENDING, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED.

Audit:
- Are all states reachable?
- Are transitions state-machine-validated?
- Is the **guarantor's aadhaar/PAN** validated before approval?
- Is the **rider's KYC** validated before a guarantor is required?
- Is the **rider notification** triggered on guarantor approval?

**Fix:** add a state-machine unit test.

### 15.3 [P0] `guarantors/guarantor.repository.ts` — PII storage

**File:** `web/src/server/modules/guarantors/guarantor.repository.ts`

The guarantor data includes Aadhaar, PAN, photos, address — all PII. Audit:
- Is the data **encrypted at rest**? (the broad audit noted `pii-crypto.ts` exists)
- Is the data **TTL-bounded**? (an approved guarantor's data may need to be retained for compliance, but rejected ones can be purged)
- Is the data **scoped** to the guarantor (not the rider)?

**Fix:** audit for the above.

### 15.4 [P0] `notifications/notification.use-cases.ts` — `markRead` ownership check

**File:** `web/src/server/modules/notifications/notification.use-cases.ts` (`markRead` function)

The route `/api/rider/notifications` calls `markRead(body.notificationId, session.riderDbId)`. The use-case **must** verify that the notification belongs to the rider. If it doesn't, rider A can mark rider B's notifications as read.

**Fix:** add a Prisma `where: { id: notificationId, riderId: riderDbId }` filter; if not found, throw `NotFoundError`.

### 15.5 [P1] `notifications/notification.repository.ts` — repository

Audit:
- Is the **rider ID** indexed?
- Is the **read status** indexed (for "unread count" query)?
- Is the **TTL** enforced (old notifications purged)?

### 15.6 [P0] `notifications/notification.policy.ts` — admin notification policy

**File:** `web/src/server/modules/notifications/notification.policy.ts`

Admin-triggered notifications (from `/api/admin/notifications/route.ts`). Audit:
- Is the **target audience size** capped?
- Is the **rate limit** enforced?
- Is the **dispatch** async (background job)?

### 15.7 [P0] `files/files.use-cases.ts` — file ownership check

**File:** `web/src/server/modules/files/files.use-cases.ts`

The file module has a use-case for confirming uploads and requesting reads. Audit:
- Does `confirmUpload` verify the upload was initiated by the rider? (otherwise any rider can confirm any upload)
- Does `requestRead` verify the rider owns the file? (a rider can read another rider's KYC documents)
- Does `requestUpload` rate-limit per rider? (10 uploads/min prevents storage DoS)

**Fix:** audit for the above.

### 15.8 [P0] `files/files.service.ts` — file storage

**File:** `web/src/server/modules/files/files.service.ts`

Audit:
- Is the **storage path** user-controlled? (a path-injection vulnerability)
- Is the **content-type** sniffed from file bytes? (not trusted from the client)
- Is the **file size** enforced on upload?

### 15.9 [P0] `files/files.repository.ts` — file record

**File:** `web/src/server/modules/files/files.repository.ts`

Audit:
- Is the **rider ID** indexed?
- Is the **storage key** indexed?
- Is the **content-type** validated against an allowlist?

---

## 16. Server modules: onboarding + plans + support + team-leaders + device-compliance

### 16.1 [P0] `onboarding/onboarding.use-cases.ts` — `autoProvisionTestRider` is dev-only

**File:** `web/src/server/modules/onboarding/onboarding.use-cases.ts` (`autoProvisionTestRider` function)

The route `/api/auth/verify-otp` (2.4) calls this. The function should be **strictly** dev-only. Audit:
- Is the function gated by `process.env.NODE_ENV === 'development' && ENABLE_DEV_TOOLS === 'true' && TEST_MODE === 'true'`?
- Is the function available only for `TEST_PHONES`?
- Is the function logged with a clear test-mode marker?

**Fix:** consolidate the test-mode logic with `authUseCases.sendOtp` and `walletUseCases.requestTopup` to use a single env flag.

### 16.2 [P0] `plans/plan.use-cases.ts` — `subscribeToPlan` is a money path

**File:** `web/src/server/modules/plans/plan.use-cases.ts` (`subscribeToPlan` function)

The route `/api/rider/plans` (see 3.1 in `AUDIT_API_DEEP.md`) calls this. Audit:
- Is the **plan ID** validated? (the rider can pass any plan ID, including a non-existent one)
- Is the **rider's KYC** checked? (a PENDING KYC rider can subscribe)
- Is the **rider's wallet balance** checked? (the plan may require a deposit)
- Is the **subscription idempotent**? (a double-tap = double-charge)
- Is the **previous plan** cancelled before the new one is set?

**Fix:** audit for the above.

### 16.3 [P1] `support/support.use-cases.ts` — ticket creation/closure

**File:** `web/src/server/modules/support/support.use-cases.ts`

Audit:
- Is the **ticket state machine** validated?
- Is the **rider notification** triggered on closure?
- Is the **admin response** logged?
- Is the **ticket reopen** permission-gated?

### 16.4 [P0] `support/ticket-state-machine.ts` — ticket state machine

States: OPEN, IN_PROGRESS, AWAITING_RIDER, RESOLVED, CLOSED, REOPENED.

Audit:
- CLOSED is terminal (no reopen)
- REOPENED → IN_PROGRESS (admin)
- IN_PROGRESS → AWAITING_RIDER (admin asks rider for info)
- AWAITING_RIDER → IN_PROGRESS (rider responds)

**Fix:** add a state-machine unit test.

### 16.5 [P0] `team-leaders/team-leader.use-cases.ts` — team leader scope

**File:** `web/src/server/modules/team-leaders/team-leader.use-cases.ts`

Audit:
- Is the **team leader's scope** (which riders they manage) enforced? (a team leader should only see their team)
- Is the **rider reassignment** validated? (no orphan riders)
- Is the **team leader's deactivation** validated? (deactivated leaders can't see their team)

### 16.6 [P0] `device-compliance/device-compliance.use-cases.ts` — device compliance check

**File:** `web/src/server/modules/device-compliance/device-compliance.use-cases.ts`

Audit:
- Is the **device data** encrypted at rest?
- Is the **device data** TTL-bounded?
- Is the **compliance violation** audit-logged?
- Is the **rider notification** triggered on violation?

### 16.7 [P1] `support/support.repository.ts` — repository

Audit:
- Is the **rider ID** indexed?
- Is the **status** indexed?
- Is the **assignedTo** indexed?

---

## 17. Server modules: admin + analytics + data-management + audit + announcements + coupons

### 17.1 [P0] `admin/admin.use-cases.ts` — admin user management

**File:** `web/src/server/modules/admin/admin.use-cases.ts` (`createAdmin` and `updateAdmin` functions)

The route `/api/admin/admins` (see 4.32) calls this. Audit:
- Can an admin **change their own role** to escalate? (the broad audit flagged this)
- Can an admin **deactivate themselves**? (potential lockout)
- Is the **admin creation** permission-gated?
- Is the **admin's password** rotated on creation?
- Is the **role change** audit-logged?

**Fix:** prevent self-role-change, prevent self-deactivation, require `super_admin` for create.

### 17.2 [P1] `analytics/analytics.use-cases.ts` — analytics aggregation

**File:** `web/src/server/modules/analytics/analytics.use-cases.ts`

Audit:
- Is the **aggregation** efficient? (a count over 1M rows is slow)
- Is the **result cached**?
- Is the **date range** validated?

### 17.3 [P0] `data-management/data-management.use-cases.ts` — backup/restore

**File:** `web/src/server/modules/data-management/data-management.use-cases.ts`

This is the highest-impact use-case. The previous broad audit (admin web) flagged:
- Backup encryption is gated by env flag
- Restore is not in a transaction
- Pre-restore backup not automatic

The deep findings:
- Is the **backup path** user-controlled? (a path-injection vulnerability)
- Is the **restore target** validated? (dev restore to prod?)
- Is the **restore rate-limited**? (only one restore at a time)
- Is the **operator's identity** recorded with timestamp?

### 17.4 [P0] `data-management/backup.repository.ts` — backup records

Audit:
- Is the **backup path** indexed?
- Is the **rider ID** indexed (for "rider's backups" query)?
- Is the **status** indexed (for "in-progress backups" query)?

### 17.5 [P0] `data-management/backup.service.ts` and `restore.service.ts` — backup/restore services

**Files:** `web/src/server/modules/data-management/backup.service.ts`, `restore.service.ts`

Audit:
- Is the **backup integrity** verified before storing? (sha256 hash)
- Is the **restore integrity** verified before applying? (verify the hash matches)
- Is the **restore transaction** atomic? (single transaction)
- Is the **restore rollback** supported? (pre-restore snapshot)

### 17.6 [P0] `data-management/backup.policy.ts` — backup policy

**File:** `web/src/server/modules/data-management/backup.policy.ts`

Audit:
- Is the **retention period** enforced (e.g. 90 days)?
- Is the **deletion soft or hard**? (hard = irreversible)
- Is the **deletion audit-logged**?

### 17.7 [P1] `audit/audit-cleanup` (separate from `audit-logs`)

The audit cleanup logic is in a job worker (see 20.x). Verify it is consistent with `data-management.backup.policy`.

### 17.8 [P0] `announcements/announcement.use-cases.ts` — announcements

**File:** `web/src/server/modules/announcements/announcement.use-cases.ts`

Audit:
- Is the **publish date** validated (not in the past)?
- Is the **expiry** enforced?
- Is the **content** sanitized (XSS)?
- Is the **change audit-logged**?

### 17.9 [P0] `coupons/coupon.use-cases.ts` — coupons

**File:** `web/src/server/modules/coupons/coupon.use-cases.ts`

Audit:
- Is the **coupon code** unique?
- Is the **discount value** bounded (max 100% off)?
- Is the **expiry** enforced?
- Is the **usage count** atomic?
- Is the **rider-specific coupon** scoped correctly?

---

## 18. Server modules: earnings + legal + monitoring + offers + pricing + referrals + rewards + scores + settings + shifts + sync + telemetry

### 18.1 [P0] `earnings/earning.use-cases.ts` — earnings creation

**File:** `web/src/server/modules/earnings/earning.use-cases.ts`

The route `/api/rider/earnings` POST (see `AUDIT_API_DEEP.md` 1.x) creates earnings. Audit:
- Is the **KYC status** checked?
- Is the **account status** checked?
- Is the **active rental** required (or is the use-case standalone)?
- Is the **amount** validated (positive, within rental amount)?
- Is the **audit log** written?

**Fix:** this is a money path; tighten validation.

### 18.2 [P1] `earnings/earning.repository.ts` — repository

Audit:
- Is the **rental ID** indexed?
- Is the **rider ID** indexed?
- Is the **amount** validated (positive)?

### 18.3 [P1] `legal/legal.use-cases.ts` — legal documents

**File:** `web/src/server/modules/legal/legal.use-cases.ts`

Audit:
- Is the **version** incremented on every change?
- Is the **rider re-consent** triggered when terms change?
- Is the **effective date** validated?

### 18.4 [P1] `monitoring/monitoring.use-cases.ts` — monitoring

**File:** `web/src/server/modules/monitoring/monitoring.use-cases.ts`

Likely a thin wrapper around Prometheus or similar. Audit:
- Is the **data** cached?
- Is the **data** expensive to compute?

### 18.5 [P0] `offers/offer.use-cases.ts` — offers

**File:** `web/src/server/modules/offers/offer.use-cases.ts`

Audit:
- Is the **offer change** audit-logged?
- Is the **offer target** validated (max 100k recipients)?
- Is the **offer redemption** atomic (no double-redemption)?

### 18.6 [P1] `pricing/pricing.use-cases.ts` — pricing

**File:** `web/src/server/modules/pricing/pricing.use-cases.ts`

Audit:
- Is the **pricing** cached?
- Is the **pricing** versioned?

### 18.7 [P0] `referrals/referral.use-cases.ts` — referral management

**File:** `web/src/server/modules/referrals/referral.use-cases.ts`

Audit:
- Is the **referral fraud detection** present? (a rider creating 100 fake accounts to claim 100 referral bonuses)
- Is the **reward calculation** correct (cap on number of successful referrals per day)?
- Is the **change audit-logged**?
- Does the use-case **verify the referrer-referee relationship**? (the API deep audit flagged this in `admin/referrals/route.ts:27-55`)

### 18.8 [P0] `rewards/reward.use-cases.ts` — rewards

**File:** `web/src/server/modules/rewards/reward.use-cases.ts`

Audit:
- Is the **reward cap** enforced (e.g. max 10,000 INR/month per rider)?
- Is the **reward fraud** detection present?
- Is the **change audit-logged**?

### 18.9 [P1] `scores/score.use-cases.ts` — rider scores

**File:** `web/src/server/modules/scores/score.use-cases.ts`

Audit:
- Is the **recalculation** async (background job)?
- Is the **recalculation** rate-limited (1/hour per rider)?
- Is the **change audit-logged** with old/new score?
- Is the **score formula** versioned?

### 18.10 [P1] `settings/setting.use-cases.ts` — settings

**File:** `web/src/server/modules/settings/setting.use-cases.ts`

Likely a wrapper for the public/admin settings. Audit:
- Is the **public settings** cached?
- Is the **admin settings** permission-gated?

### 18.11 [P1] `shifts/shift.use-cases.ts` — shift management

**File:** `web/src/server/modules/shifts/shift.use-cases.ts`

Audit:
- Are the **shift times** validated (not overlapping with maintenance)?
- Is the **shift change** audit-logged?
- Are the **rider assignments** to shifts validated (no double-booking)?

### 18.12 [P0] `sync/sync.use-cases.ts` — sync queue

**File:** `web/src/server/modules/sync/sync.use-cases.ts`

The route `/api/sync/queue` calls this. Audit:
- Is the **queue size** bounded (a rider with 10k events)?
- Is the **deduplication** by client event ID?
- Is the **order** preserved?
- Is the **failure handling** correct (partial failures)?

### 18.13 [P0] `telemetry/telemetry.use-cases.ts` — telemetry

**File:** `web/src/server/modules/telemetry/telemetry.use-cases.ts`

Audit:
- Is the **telemetry** anonymized before storage?
- Is the **telemetry** TTL-bounded?
- Is the **telemetry deletion** audit-logged?

### 18.14 [P0] `incidents/incident.use-cases.ts` — incident management

**File:** `web/src/server/modules/incidents/incident.use-cases.ts`

Audit:
- Is the **incident state machine** validated?
- Is the **incident closure** audit-logged?
- Is the **incident reopen** allowed (and who can)?
- Is the **rider notification** triggered on closure?

### 18.15 [P0] `incidents/incident-state-machine.ts` — incident state machine

States: REPORTED, TRIAGED, INVESTIGATING, RESOLVED, CLOSED.

Audit:
- CLOSED is terminal
- Insurance claim binding requires dual approval (the API deep audit flagged this)

---

## 19. State machines (7 total)

The codebase has 7 explicit state machines. Each is enumerated below with the states, transitions, and audit findings.

### 19.1 Rider lifecycle (`rider-lifecycle.service.ts`)

States: PENDING → OTP_SENT → OTP_VERIFIED → KYC_PENDING → KYC_SUBMITTED → KYC_APPROVED → ACTIVE → SUSPENDED → TERMINATED

The previous broad audit flagged: `_lifecycleTargetToAuthState` switch in `app/router.dart:289-291` maps `terminated → preDashboard` (likely a Flutter bug). Need to verify the **server-side** state machine in `rider-lifecycle.service.ts` is correct.

Audit:
- All states reachable? (SUSPENDED is reachable from ACTIVE only?)
- All transitions explicit? (no implicit transitions)
- Terminal states truly terminal? (TERMINATED is terminal)
- The state machine is the only way to change state? (a raw `db.rider.update` can bypass it)

### 19.2 KYC state machine (`kyc-state-machine.ts`)

States: PENDING → SUBMITTED → UNDER_REVIEW → APPROVED → REJECTED

Plus re-review: REJECTED → RESOLVED (admin asks for resubmit) → SUBMITTED

### 19.3 Guarantor state machine (`guarantor-state-machine.ts`)

States: PENDING → SUBMITTED → UNDER_REVIEW → APPROVED → REJECTED

### 19.4 Deposit state machine (`deposit-state-machine.ts`)

States: PENDING → HELD → REFUNDED → FORFEITED

Plus partial: HELD → PARTIALLY_REFUNDED → REFUNDED

### 19.5 Rental state machine (`rental-state-machine.ts`)

States: BOOKED → ACTIVE → COMPLETED
Plus: BOOKED → CANCELLED, ACTIVE → OVERDUE → COMPLETED

### 19.6 Vehicle state machine (`vehicle-state-machine.ts`)

States: AVAILABLE → BOOKED → ACTIVE → MAINTENANCE → RETIRED

Plus: AVAILABLE → MAINTENANCE (admin), ACTIVE → MAINTENANCE (admin)

### 19.7 Ticket state machine (`ticket-state-machine.ts`)

States: OPEN → IN_PROGRESS → AWAITING_RIDER → RESOLVED → CLOSED
Plus: RESOLVED → REOPENED (rider) → IN_PROGRESS

### 19.8 Transaction state machine (`transaction-state-machine.ts`)

States: PENDING → APPROVED → REJECTED → REVERSED

Plus: APPROVED → REVERSED (admin override, with audit)

### 19.9 Incident state machine (`incident-state-machine.ts`)

States: REPORTED → TRIAGED → INVESTIGATING → RESOLVED → CLOSED

### 19.10 [P0] Cross-cutting: state machines are not enforced at the DB level

**Pattern across all state machines.**

The state machines are implemented in TypeScript (in `*-state-machine.ts` files) but **not at the database level**. A raw `UPDATE rider SET lifecycle_state = 'ACTIVE' WHERE id = ?` via psql or a Prisma migration bypasses the machine. The state column has no CHECK constraint.

**Fix:** add a Postgres `CHECK` constraint or a `BEFORE UPDATE` trigger that validates the new state is a valid transition. As a defense-in-depth, add a startup test that no `db.<model>.update` is called outside the use-case layer (e.g. via lint).

### 19.11 [P0] Cross-cutting: state machines are not in transactions with side effects

**Pattern across all state machines.**

A state change + a side effect (e.g. `rider.lifecycle = APPROVED` + `db.auditLog.create()`) is rarely in a single `db.$transaction` block. If the state change succeeds and the audit log fails, the state is updated but the audit log is missing.

**Fix:** wrap state changes + side effects in `db.$transaction`.

### 19.12 [P1] Cross-cutting: state machine unit tests are missing

**Pattern across all state machines.**

A state machine should have a unit test that enumerates every (state, transition) pair. None of the 7+ state machines likely have one.

**Fix:** add a unit test per state machine.

---

## 20. Job workers (12 total) + outbox + queue

12 job files + `outbox.ts` + `queues.ts` + `index.ts` (scheduler).

### 20.1 [P0] `wallet-reconciliation.job.ts` (already audited in broad admin web audit)

The previous broad audit covered this. The additional finding: the job is **not concurrent-safe** — two invocations of the job can both process the same reconciliation.

### 20.2 [P0] `reconciliation.job.ts` (different from wallet-reconciliation)

**File:** `web/src/server/workers/jobs/reconciliation.job.ts`

Likely a more general reconciliation (transactions vs ledger, etc.). Audit:
- Is the job **concurrent-safe**? (two runs = double-reconciliation)
- Is the job **idempotent**?
- Is the **failure handling** correct (DLQ, alert)?
- Is the **diff report** generated before applying?

### 20.3 [P0] `notification-dispatch.job.ts` and `notifications.job.ts`

**Files:** `web/src/server/workers/jobs/notification-dispatch.job.ts`, `notifications.job.ts`

Likely two jobs: one for the dispatch loop, one for daily summary. Audit:
- Is the **dispatch rate-limited** (e.g. 1k SMS/min per gateway)?
- Is the **dispatch retry-with-backoff**? (a transient gateway failure should retry)
- Is the **dispatch idempotent**? (a duplicate dispatch should be deduped by `notificationId`)
- Is the **dispatch failure** retried (max 3 attempts) before going to DLQ?

### 20.4 [P0] `notifications-cleanup.job.ts` — notification cleanup

**File:** `web/src/server/workers/jobs/notifications-cleanup.job.ts`

Audit:
- Is the **retention period** enforced (e.g. 30 days)?
- Is the **cleanup soft or hard**? (hard = irreversible)
- Is the **cleanup audit-logged**?
- Is the **cleanup rate-limited** (don't lock the table)?

### 20.5 [P0] `audit-cleanup.job.ts` — audit log cleanup

**File:** `web/src/server/workers/jobs/audit-cleanup.job.ts`

Audit:
- Is the **retention period** enforced (e.g. 90 days)?
- Is the **cleanup soft or hard**? (hard = irreversible, should be archival not delete)
- Is the **cleanup audit-logged**? (meta-audit: who cleaned what when)
- Is the **cleanup permission-gated**? (a system job, but the job's config is admin-controlled)

### 20.6 [P0] `telemetry-cleanup.job.ts` — telemetry cleanup

**File:** `web/src/server/workers/jobs/telemetry-cleanup.job.ts`

Same as 20.5. Audit for retention, soft/hard, audit log.

### 20.7 [P0] `device-compliance.job.ts` — device compliance scan

**File:** `web/src/server/workers/jobs/device-compliance.job.ts`

Audit:
- Is the **scan rate-limited** (don't hammer the device API)?
- Is the **scan concurrent-safe**? (multiple workers scanning the same rider)
- Is the **violation** audit-logged?
- Is the **rider notification** triggered on violation?

### 20.8 [P0] `referral-reward.job.ts` — referral reward distribution

**File:** `web/src/server/workers/jobs/referral-reward.job.ts`

**Money path.** Audit:
- Is the **reward calculation** correct (cap on successful referrals per day)?
- Is the **reward distribution** atomic (one transaction per rider)?
- Is the **reward fraud** detection present?
- Is the **reward distribution** audit-logged?

### 20.9 [P0] `rent-reminders.job.ts` — rental due reminders

**File:** `web/src/server/workers/jobs/rent-reminders.job.ts`

Audit:
- Is the **reminder rate-limited** (don't spam riders)?
- Is the **reminder content** i18n'd?
- Is the **rider's preferred channel** respected (SMS/push/email)?

### 20.10 [P0] `daily-engagement.job.ts` — daily engagement

**File:** `web/src/server/workers/jobs/daily-engagement.job.ts`

Likely a marketing-grade notification. Audit:
- Is the **engagement opt-in** respected? (a rider who opted out should not get daily pings)
- Is the **engagement rate-limited** (max 1/day per rider)?
- Is the **engagement content** i18n'd?

### 20.11 [P0] `scheduled-backup.job.ts` — scheduled backup

**File:** `web/src/server/workers/jobs/scheduled-backup.job.ts`

Audit:
- Is the **schedule cron-validated**?
- Is the **backup encryption** enforced?
- Is the **backup rate-limited** (don't run two backups simultaneously)?
- Is the **backup failure** alerted?

### 20.12 [P0] `outbox.ts` — outbox pattern

**File:** `web/src/server/workers/outbox.ts`

The outbox pattern is for transactional side effects. Audit:
- Is the **outbox flush** atomic with the state change?
- Is the **outbox retry-with-backoff**? (a transient failure should retry)
- Is the **outbox DLQ**? (a permanent failure should be moved to DLQ)
- Is the **outbox idempotency**? (a duplicate outbox entry should not double-execute)

### 20.13 [P1] `queues.ts` — queue definition

**File:** `web/src/server/workers/queues.ts`

Audit:
- Is the **queue priority** defined? (some jobs should run before others)
- Is the **queue concurrency** set? (max N jobs in parallel)
- Is the **queue rate-limit** set? (max N jobs per second)

### 20.14 [P0] `workers/index.ts` — worker entry point

**File:** `web/src/server/workers/index.ts`

The worker entry point. Audit:
- Is the **worker shutdown** graceful? (in-flight jobs complete before exit)
- Is the **worker health check** exposed? (k8s liveness probe)
- Is the **worker metrics** emitted? (job duration, success rate)
- Is the **worker concurrency** configurable?

### 20.15 [P0] Cross-cutting: no failed-job alerting

**Pattern across all 12 job workers.**

The previous broad audit flagged this: failed jobs are not alerted (no email/Slack/PagerDuty). A failed reconciliation goes silent.

**Fix:** add a `notifyOnFailure` flag to the job config, integrate with a notification channel.

### 20.16 [P0] Cross-cutting: no dead-letter queue (DLQ) for permanently-failed jobs

**Pattern across all 12 job workers.**

A job that fails 3 times (the typical retry cap) is silently dropped. No DLQ for manual recovery.

**Fix:** add a `failed_jobs` table or a `dlq` queue; alert on new entries.

### 20.17 [P1] Cross-cutting: no job-level metrics

**Pattern across all 12 job workers.**

No Prometheus metrics for job duration, success rate, queue depth. Hard to debug slow jobs.

**Fix:** add a `recordJobMetric(jobName, duration, status)` call in the job wrapper.

---

## 21. Top 10 critical findings

In order of "ship-it-this-week" priority:

1. **[P0] `/api/webhooks/payment/route.ts:58` — non-Razorpay providers have `isValidSignature = true` in development** (deep audit #1). Production misconfig = unauthenticated wallet top-ups.
2. **[P0] `/api/device/data/route.ts:12-19` and `/api/device/permissions/route.ts:12-19` — dev-mode auth bypass for any rider** (deep audit #2). A test-mode or development env in production = unauthenticated PII writes.
3. **[P0] `/api/admin/payment-gateways/route.ts:5-62, 69-87` — returns `keySecret`/`webhookSecret` to any admin** (deep audit #3). Any admin (READ_ONLY) can dump the full secret set.
4. **[P0] `/api/admin/data-management/backups/[id]/download/route.ts:30-40` — reads arbitrary `storageKey` paths from DB** (deep audit #4). A poisoned DB record pointing at `/etc/passwd` is streamed back.
5. **[P0] `/api/rider/rental/return/route.ts:12-20` — allows rider to write directly to profile fields** (deep audit #5). Mass assignment vulnerability.
6. **[P0] `/api/admin/riders/[id]/data-deletion/route.ts:11-14` — PII destruction without audit log or two-person rule** (deep audit #6).
7. **[P0] `/api/rider/device/verify-lock/route.ts:57-66` — admin impersonation path allows lock recovery for any rider** (deep audit #7). Combined with auto-login = full takeover.
8. **[P0] `/api/admin/auth/auto-login/route.ts:9-16` — auto-login enabled in non-production with `ENABLE_DEV_ADMIN_LOGIN`** (deep audit #8). Misconfig = unauthenticated admin login.
9. **[P0] `/api/admin/jobs/route.ts:138-141` — any admin can fire `runWalletReconciliation()`, `auto-debit`, `daily-engagement`** (deep audit #10). Marketing-grade abuse vector.
10. **[P0] `/api/admin/payment-gateways/[id]/route.ts:34-36` — PATCH allows direct update of `keySecret`/`webhookSecret`** (4.10). The encryption-at-rest check is uncertain.

---

## 22. Cross-cutting observations

These patterns appear across many files and are worth a single PR each:

1. **`req.headers.get('x-admin-id')` for actor identity in audit logs** (6+ files). Use `session.adminId` instead.
2. **`process.env.NODE_ENV === 'development'` security gate** (8+ files). Use `process.env.APP_ENV === 'production'` instead.
3. **Two URL aliases for the same handler** (`transaction/request` ↔ `topup`, `rider/verify-lock-password` ↔ `rider/device/verify-lock`). Consolidate.
4. **String-based error matching** (15+ routes). Use typed `DomainError` classes.
5. **Audit log fire-and-forget** (`.catch(() => {})`) (6+ files). Await the audit log.
6. **Missing rate limits on financial mutating routes** (7+ routes). Add rate limits.
7. **No idempotency keys on financial mutating routes** (4+ routes). Require `x-idempotency-key`.
8. **`requireAdmin` with `riderDbId` fallback for actor** (5+ files). Use `adminId` exclusively.
9. **No `withApiHandler` wrapper on most routes** (60+ files). Wrap for consistent error mapping.
10. **Hub scoping is inconsistent** (3+ admin routes). Add a shared `enforceHubScope` helper.
11. **Permission name typos** (`tl_manage` vs `team_leaders_manage`). Unify.
12. **Self-actor mismatch in audit** (5+ files). Use `session.adminId` always.
13. **`/api/admin/audit-logs` returns PII in `details`**. Add a `redactPii` pass.
14. **37 routes are missing correlation/request IDs**. Add a `requestId` middleware.
15. **16 routes are missing `Cache-Control` headers**. Add `Cache-Control: private`.
16. **`if (process.env.NODE_ENV === 'production' && ...)` for required fields** (5+ files). Use explicit env flags.
17. **No `RateLimit-*` headers**. Add the standard rate-limit headers.
18. **No `Api-Version` header**. Add `Api-Version: 1.0` to all responses.
19. **Permission allowlist for ADMIN actions duplicated**. Centralize in `PERMISSION_DESCRIPTORS`.
20. **`session.role` vs `session.adminRole`** (`maintenance-mode`, `system-settings`). Unify to `adminRole`.

---

## Recommended 10-PR ship-it sequence

In order of "ship-it-this-week" priority:

1. **PR 1: Webhook signature hardening** — fix `/api/webhooks/payment` for non-Razorpay providers. ~2 hours.
2. **PR 2: Dev-mode auth bypass removal** — fix `/api/device/data` and `/api/device/permissions`. ~1 hour.
3. **PR 3: Payment gateway secret redaction** — fix `/api/admin/payment-gateways` to redact `keySecret`/`webhookSecret`. ~2 hours.
4. **PR 4: Backup path-traversal fix** — re-validate `fullPath` in `/api/admin/data-management/backups/[id]/download`. ~1 hour.
5. **PR 5: Mass-assignment fix in rental return** — route through a dedicated `submitReturn` use-case. ~3 hours.
6. **PR 6: Data-deletion audit + grace period** — add audit log + 7-day grace. ~1 day.
7. **PR 7: Lock-recovery impersonation block** — never allow impersonation on `verify-lock`. ~2 hours.
8. **PR 8: Auto-login hard gate** — require both `APP_ENV !== 'production' && NODE_ENV === 'development'`. ~30 min.
9. **PR 9: Admin jobs permission split** — add `jobs_run` permission. ~2 hours.
10. **PR 10: NODE_ENV security gate fix** — replace `NODE_ENV === 'development'` with `APP_ENV === 'production'` across 8+ files. ~3 hours.

**Total estimated effort:** ~5 days of focused work, single PR per item, all P0.

---

## Appendix A: Deep-dive API routes reference

The deep per-file analysis of all 130+ route files is in `D:\voltium\web\AUDIT_API_DEEP.md` (62 KB). It includes:

- Per-file findings with `file:line` evidence for every route in `/api/auth/`, `/api/rider/`, `/api/admin/`, `/api/riders/`, `/api/files/`, `/api/cron/`, `/api/internal/`, `/api/transaction/`, `/api/support/`, `/api/health/`, `/api/notification/`, `/api/payment-gateways/`, `/api/v1/`, `/api/shifts/`, `/api/rental/`, `/api/sync/`, `/api/vehicles/`, `/api/pricing/`, `/api/webhooks/`, `/api/search/`, `/api/metrics/`, `/api/monitoring/`, `/api/ready/`
- TOP 10 critical findings (file:line evidence)
- 20 cross-cutting observations (file:line evidence)
- Severity summary table
- Recommended 10-PR ship-it sequence

The deep API audit found 60+ P0s, 50+ P1s, 30+ P2s, 20+ P3s. The TOP 10 are integrated into section 21 of this document.

**Use this file (`AUDIT_BACKEND.md`) for the high-level picture and the server-module/state-machine/job-worker deep dive. Use `AUDIT_API_DEEP.md` for the per-route file:line evidence.**

## Appendix B: How this audit relates to the others

This is the third in a series:

1. `D:\voltium\flutter\AUDIT_FINDINGS.md` — Flutter rider app (161 findings, 86 KB, 14 modules)
2. `D:\voltium\web\AUDIT_FINDINGS.md` — Admin web broad audit (138+ findings, 78 KB, 11 sections)
3. `D:\voltium\web\AUDIT_API_DEEP.md` — Per-route deep dive (60+ P0s, 62 KB, ~730 lines)
4. **`D:\voltium\web\AUDIT_BACKEND.md` (this file)** — Backend deep dive: shared layer, all 130+ routes at the pattern level, 130+ server modules, 7 state machines, 12 job workers, 22 cross-cutting findings, top 10 critical, recommended 10-PR sequence
5. `D:\voltium\SCOPE.md` — 7-phase remediation plan, 19 KB

This file (`AUDIT_BACKEND.md`) is the primary backend reference. The other files provide supporting detail.
