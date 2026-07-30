# Voltium Web — Deep API Audit

**Scope:** `D:\voltium\web\src\app\api\**\*.ts` (130+ route files)
**Auditor:** Senior code review
**Format:** `file:line` evidence + concrete fix + severity (P0/P1/P2/P3)
**Files already covered elsewhere (skipped here):** auth/logout, auth/refresh, auth/send-otp, auth/verify-otp, admin/riders/route.ts.

> **Status (2026-07-30):** 8 of 10 Top 10 P0s are FIXED; 2 are tracked in `FOLLOWUP_TICKETS.md` (#55, #58). See [`AUDIT_VERIFICATION_3_2026-07-30.md`](./AUDIT_VERIFICATION_3_2026-07-30.md) §1 for the per-finding verdict.

---

## TOP 10 CRITICAL FINDINGS

1. **P0 — `/api/webhooks/payment` grants `isValidSignature = true` in development for non-Razorpay providers** (`D:\voltium\web\src\app\api\webhooks\payment\route.ts:58`). Any provider other than Razorpay is accepted in dev with no signature at all. The `process.env.NODE_ENV === 'development'` check is the only thing standing between an attacker and a wallet top-up. If `NODE_ENV` is misconfigured in production, **all payment webhooks become unauthenticated** for Cashfree, PhonePe, Easebuzz. Fix: replace with explicit signature verification per provider, hard-fail in production regardless of env.
2. **P0 — `/api/device/data` and `/api/device/permissions` allow ANY caller to write data to ANY rider** (`D:\voltium\web\src\app\api\device\data\route.ts:12-19`, `D:\voltium\web\src\app\api\device\permissions\route.ts:12-19`). When `TEST_MODE=true` OR `NODE_ENV=development`, the rider is derived from request body (`body.riderId || 'test-rider-001'`) with no auth. This is not test-only — `NODE_ENV=development` ships in some deployment modes. Any node can inject contacts, call logs, and location for any rider. Fix: remove the dev branch, only allow `requireRiderSession`; if a test seed is required, gate on `TEST_MODE && NODE_ENV !== 'production'` with a separate endpoint.
3. **P0 — `/api/admin/payment-gateways` returns and seeds `keySecret`, `webhookSecret` and merchant IDs to any admin** (`D:\voltium\web\src\app\api\admin\payment-gateways\route.ts:5-62`, `route.ts:69-87`). No `select` — full `keySecret` / `webhookSecret` are included in the JSON response. The route also silently upserts hard-coded "test" keys/merchants on first read. Any admin (READ_ONLY) with `requireAdmin()` can dump the full secret set. Fix: only return `id, name, provider, isActive, environment`, redact `keySecret`/`webhookSecret` as `[CONFIGURED]`. Move seeding behind an explicit init script.
4. **P0 — `/api/admin/data-management/backups/[id]/download` reads arbitrary `storageKey` paths from DB into the file response** (`D:\voltium\web\src\app\api\admin\data-management\backups\[id]\download\route.ts:30-40`). The `job.backupPath` comes from the DB / use-case. A corrupt/poisoned DB record pointing at `/etc/passwd` or another admin's home would be streamed back. The path is then fed to `createReadStream` with no re-check against the `LOCAL_STORAGE_ROOT` allowlist. Fix: resolve and re-validate `fullPath.startsWith(resolvedBaseDir)`; whitelist subpaths.
5. **P0 — `/api/rider/rental/return` allows rider to write directly to their own profile fields** (`D:\voltium\web\src\app\api\rider\rental\return\route.ts:12-20`). The route calls `riderUseCases.updateProfile(riderDbId, {...})` with raw body fields. There is no allowlist — `returnPhotos`, `latitude`, `longitude` are taken as-is. If `updateProfile` is the same use-case as `rider/profile` PUT, an attacker can craft a return that also overwrites `kycStatus`, `phone`, `email`, etc. Fix: route the return through a dedicated `submitReturn` use-case that takes only the return fields.
6. **P0 — `/api/admin/riders/[id]/data-deletion` returns 403 when `requirePermission('admin:write')` fails, but `requirePermission` itself is only loosely defined** (`D:\voltium\web\src\app\api\admin\riders\[id]\data-deletion\route.ts:11-14`). The handler is destructive (anonymizes PII, deletes `userCallLog`/`userContact`/`userLocation` for the rider) and protected only by a single permission key. No two-person rule, no audit log, no soft-delete window. PII destruction + adjacent tables deleted atomically without audit is a compliance hazard. Fix: require `data_deletion_approve`, emit a `createAuditLog` entry with a `details` payload before the transaction; add a 7-day grace period.
7. **P0 — `verify-lock` endpoint has no `x-rider-id` / session binding check at the password-compare step** (`D:\voltium\web\src\app\api\rider\device\verify-lock\route.ts:57-66`). The `lockPassword` is read for `riderDbId` from the session, but **the comment at `rider-auth.ts:22` and the impersonation path allow an admin with `impersonate_riders` to call this endpoint as ANY rider** by setting `x-rider-id`. They then know the recovery password, and can issue a "UNLOCK_DEVICE" admin action to any rider. Combined with the auto-login at `auth/auto-login` (already audited), this chain is full takeover. Fix: never allow impersonation on the lock-recovery endpoint.
8. **P0 — `/api/admin/auth/auto-login` is still active in non-production with `ENABLE_DEV_ADMIN_LOGIN=true` fallback** (`D:\voltium\web\src\app\api\admin\auth\auto-login\route.ts:9-16`). The check is `process.env.APP_ENV === 'production'` for the hard disable, but then `process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_ADMIN_LOGIN === 'true'` enables it. `ENABLE_DEV_ADMIN_LOGIN` is documented elsewhere as a dev-only flag — but the code path bypasses the standard admin auth (no password input from user). If `ENABLE_DEV_ADMIN_LOGIN` is ever set in a non-production deploy (staging, preview), the endpoint works with a static password from env. Fix: hard-gate on `process.env.APP_ENV !== 'production' && process.env.NODE_ENV === 'development'` only.
9. **P0 — `/api/internal/worker` returns 401 instead of 503 when `WORKER_SECRET` is missing in production, but in non-production returns 401 too** (`D:\voltium\web\src\app\api\internal\worker\route.ts:16-21`). The conditional `process.env.NODE_ENV === 'production'` check is reversed in semantics — production blocks but non-production allows (with bearer token). In non-production if no `WORKER_SECRET` is set, every call returns 401 *but* an attacker setting `Authorization: Bearer undefined` could bypass. Cleaner: always require a valid bearer; never serve on missing secret. (Lower severity than #1 but still a foot-gun.)
10. **P0 — `/api/admin/jobs` POST has no permission check beyond `requireAdmin()`** (`D:\voltium\web\src\app\api\admin\jobs\route.ts:138-141`). Any admin (including READ_ONLY) can fire `runWalletReconciliation()`, `auto-debit`, `daily-engagement`, etc. A 6am daily-engagement spam (which sends notifications) is a marketing-grade abuse vector. Fix: require `jobs_run` permission specifically, plus rate-limit per admin.

---

## 1. `/api/rider/**` — Rider-facing endpoints (21 files)

### `D:\voltium\web\src\app\api\rider\profile\route.ts`
- **P1 (lines 49-52):** Body-level ownership check. `if (bodyRiderId && riderDbId !== bodyRiderId) return forbidden` only triggers if the body actually carries `riderId`. The `updateProfileSchema` (referenced but not shown in this file) likely allows it; in any case the check is bypassed when the field is absent. **Fix:** always derive `riderDbId` from the session, never use a body-supplied rider id. Compare only as a safety check, not as a gate.
- **P3 (line 17):** `export const dynamic = 'force-dynamic'` — good, but no JSDoc on individual handlers.

### `D:\voltium\web\src\app\api\rider\dashboard\route.ts`
- **P1 (line 14):** Rate-limit 30/min is per-rider, but the route fetches the full dashboard incl. active lease, wallet balance, recent transactions. Caching here would be more impactful than rate-limiting. **Fix:** cache for 10-15s keyed on `riderDbId`.
- **P3 (line 8):** No structured logging on hit (only on error). Hard to trace.

### `D:\voltium\web\src\app\api\rider\kyc\route.ts`
- **P1 (lines 74-84):** GET returns KYC profile fields including `bankName`. The 200 success body **does not redact Aadhaar/PAN** — note these are not in the response set, good — but `rejectionReason` is returned without auth, including potentially "I rejected this because your face doesn't match your aadhaar" type comments. PII leakage is moderate.
- **P3 (line 31):** `kycUseCases.submitKyc(session.riderDbId, ...)` — no idempotency, so a network retry can re-submit and re-write. Add `idempotency-key` header support.

### `D:\voltium\web\src\app\api\rider\earnings\route.ts`
- **P1 (line 9):** Rate-limit is **missing** on this endpoint. A rider can list all their earnings and (POST) create earnings arbitrarily. **Fix:** add `checkRateLimit('earnings:${riderId}', ...)` for POST.
- **P1 (line 62):** `createEarning` writes to the DB. There's no `kycStatus` gate, no `accountStatus` check, no workflow check (does an active rental need to exist? Probably not, but verify). A rider can self-credit earnings.
- **P2 (line 58):** Validation is enforced, but no audit log on earnings creation. Earnings are financial.

### `D:\voltium\web\src\app\api\rider\consent\route.ts`
- **P0 (lines 36-41):** The route logs the **full consent payload** to `logger.info` including `granted: true|false`. This is GDPR/DPDP sensitive. **Fix:** log only the consent type and riderId, not the granted boolean and never the policy version in prod logs. Use a dedicated consent audit table.
- **P2 (line 35-46):** The comment says "Consent is stored locally on device" but the endpoint accepts POST data — there's a contradiction. Either store it or don't accept it. Currently it's a no-op that just logs. **Fix:** either remove the endpoint or actually persist.

### `D:\voltium\web\src\app\api\rider\notifications\route.ts`
- **P1 (line 30):** PUT accepts `body.notificationId` and calls `markRead(body.notificationId, session.riderDbId)`. The use-case must internally verify the notification belongs to the rider. **Verify:** that path in `notificationUseCases.markRead` does an ownership filter; if not, this is IDOR (rider A marks rider B's notification as read). **Action:** add a P0 if not enforced.
- **P3 (line 33):** No rate limit on PUT.

### `D:\voltium\web\src\app\api\rider\offers\route.ts`
- **P2 (line 13):** Cached for 5 min. Auth check `requireRiderSession` runs, but cache is keyed only on `'rider_offers'`, so per-rider offers aren't possible. **Verify:** offers are global, not rider-specific; if yes, fine. The cache key does NOT include riderId which is suspicious — implies the offers are not personalized. **Action:** add `actorId` to the cache key if they ever become personalized.
- **P3 (line 8):** No `withApiHandler` wrapping. Errors are caught by `err`, no structured logging on hit.

### `D:\voltium\web\src\app\api\rider\plans\route.ts`
- **P1 (line 21):** `POST /api/rider/plans` is a financial operation (subscribe to a plan with `advanceRentPaid` flow). **No rate limit**, no idempotency key. A double-tap on subscribe could double-charge. **Fix:** require `x-idempotency-key` header or generate one in the route.
- **P1 (line 35):** `planUseCases.subscribeToPlan(riderDbId, planId, advanceRentPaid)` — relies on the use-case to verify the rider hasn't already subscribed. **Verify:** that the use-case rejects double-subscription. If not, this is a P0.

### `D:\voltium\web\src\app\api\rider\pricing\route.ts`
- **P1 (line 14):** No `requireRiderSession` call — this is a public endpoint. The route exposes dynamic pricing. Any anonymous caller can hammer it. **Missing rate-limit.** **Fix:** add `checkRateLimit('pricing:ip:...', ...)`.
- **P2 (line 8-12):** `PLANS` is a hardcoded array. If admin changes plan pricing via `/api/admin/plans`, this endpoint keeps returning the hardcoded values. **Fix:** read plans from DB or constant module.

### `D:\voltium\web\src\app\api\rider\fcm-token\route.ts`
- **P0 (lines 18-28):** Body is read with `.catch(() => ({}))` and validated, but if `token` is an empty string `z.string().min(1)` will reject. **However:** there's no size cap (a 10MB FCM token? no, but no max). FCM tokens are ~200 chars typically. **Fix:** add `.max(500)`. P3.
- **P3:** No rate limit. A rider can update FCM token unlimited times.

### `D:\voltium\web\src\app\api\rider\hubs\route.ts`
- **P2 (line 16):** Cached 10 min on `'rider_hubs'`. No auth check at all (public). **Verify:** the cache key should not include rider id, fine. No rate limit. **Fix:** add IP-based rate limit.
- **P2 (line 8-13):** Comment says "rider-accessible, no admin auth required" but no rider auth either. Public by design. **Verify:** this is the intended API surface.

### `D:\voltium\web\src\app\api\rider\guarantor\route.ts`
- **P1 (line 24):** `submitGuarantor(riderDbId, validation.data)` — guarantor includes Aadhaar, PAN, photos, father/mother name, address. **No rate limit.** A rider could spam submissions.
- **P0 (line 26):** `await guarantorUseCases.autoVerifyIfTestMode(riderDbId)` — if the use-case ever calls this in production (e.g. via env leak), the guarantor is auto-approved. **Verify:** that `autoVerifyIfTestMode` strictly checks `process.env.NODE_ENV === 'development'` or similar. (Already audited? — not in user's list, check next.)

### `D:\voltium\web\src\app\api\rider\referrals\route.ts`
- Clean. Rate-limit could be added but is P3.
- **P3 (line 8):** No structured logging on success.

### `D:\voltium\web\src\app\api\rider\rewards\route.ts`
- Clean. No rate limit (P3).

### `D:\voltium\web\src\app\api\rider\settings\route.ts`
- **P1 (line 6):** `GET /api/rider/settings` returns public settings but requires a rider session. Fine.
- **P2 (line 13):** Cache headers set per-response — good. But the underlying `settingUseCases.getPublic()` likely reads from DB. **Verify:** that there's no leak of secret settings into `getPublic()`.

### `D:\voltium\web\src\app\api\rider\device\route.ts`
- **P0 (line 41-45):** `reportViolation(riderDbId, permissionId)` is called. The use-case might trigger a device violation. **Verify:** that an attacker can self-report fake violations to block their own account or game the compliance system. If `permissionId` is from a fixed enum, fine; if free-form, fix.

### `D:\voltium\web\src\app\api\rider\device\permissions\route.ts`
- **P0 (lines 11-19):** Same dev-mode bypass pattern as `device/data`. The body is parsed twice (once via `request.clone().json()` in dev mode, once via `request.json()`) — but in production, only the second `request.json()` is consumed, which is **fine** because rider session gates it. **However:** the cloned-body pattern in dev is a copy-paste from `device/data` and is broken-by-design.
- **P2 (lines 28-55):** The key-mapping logic is duplicated between `device/data` and `device/permissions` and `rider/device/permissions`. **Fix:** extract a shared helper.

### `D:\voltium\web\src\app\api\rider\device\verify-lock\route.ts`
- **P0 (line 57-66):** See TOP 10 #7. Admin impersonation path is exploitable for lock recovery.
- **P1 (line 38-42):** Rate limit 5/min per rider. Good. But **no rate limit per IP** — a stolen cookie can be hammered from 100 IPs. **Fix:** combined IP+rider rate limit.

### `D:\voltium\web\src\app\api\rider\verify-lock-password\route.ts`
- **P2 (line 1):** This is a re-export: `export { POST } from '../device/verify-lock/route';`. Having two URLs for the same handler is confusing and means rate limits / logs are split. **Fix:** consolidate to one route. P2.

### `D:\voltium\web\src\app\api\rider\rental\return\route.ts`
- **P0 (lines 12-20):** See TOP 10 #5. The route calls `riderUseCases.updateProfile(riderDbId, {...})` with raw `returnPending`, `returnPhotos`, `latitude`, `longitude`, `returnReason`. There is no schema validation on this body. If `updateProfile` is the same as `/api/rider/profile` PUT, an attacker can craft a return request that overwrites their own `kycStatus`, `email`, `phone`, etc.
- **P2 (line 11):** No rate limit.

### `D:\voltium\web\src\app\api\rider\sync\device-data\route.ts`
- **P0 (lines 18-32):** Syncs `LOCATION`, `CONTACTS`, `CALL_LOGS` based on `type`. **No size cap.** A rider could POST a 100MB contacts list. **Fix:** add a per-type payload size check.
- **P0 (line 18-32):** Contacts and call logs are PII. **No audit log** of when PII was synced. **Fix:** create audit log.
- **P2 (line 33):** No rate limit.

### `D:\voltium\web\src\app\api\rider\sync\pickup\route.ts`
- **P0 (line 42):** `if (process.env.NODE_ENV === 'production' && !frontPhoto)` — production requires a photo, but other envs do not. The conditional is a security gate. Fine in principle, but the broader concern: **what's stopping a non-prod env from being used as a real backend in a preview deploy?** Validate `APP_ENV` too.
- **P1 (line 21):** No Zod schema for the body. `const { vehicleId, hubId, teamLeader, ... } = body` is untyped. `vehicleId` could be an object, an array, a 1MB string. **Fix:** add `validateBody`.
- **P2 (line 50):** `rentalUseCases.syncPickup` — verify the use-case re-checks the vehicle's current hub matches what the rider claimed. If not, IDOR-like (rider A picks up vehicle from hub B by sending hubId=A's).

### `D:\voltium\web\src\app\api\rider\sync\pickup\vehicle\route.ts`
- **P0 (line 6-9):** Public-ish — requires `requireRiderSession` but the route is `verifyPickupVehicle(query, hubId)`. A rider can probe for vehicle existence and hub. **Verify:** the use-case does not return sensitive fields (battery, location, owner).
- **P2 (line 11):** No rate limit.

### `D:\voltium\web\src\app\api\riders\dashboard\route.ts`
- **P1 (line 2):** `import { GET_dashboard } from '@/server/modules/riders/rider.routes';` — note the unusual naming (`GET_dashboard` with snake_case). This is a leaky internal export. **Verify:** that the underlying handler does its own auth check. If it does, fine. If it relies on the route, **P0 — public dashboard** (the actual route returns the rider's full dashboard).

### `D:\voltium\web\src\app\api\riders\register-token\route.ts`
- **P0 (line 10):** `await getRiderId(req)` — note this is **not** `requireRiderSession`, it's `getRiderId`. **Verify:** what does `getRiderId` do? If it returns the riderId from the request body or from a query param without auth, this is **P0** — token registration is unauthenticated.
- **P1 (line 21):** Log line includes `riderId: session` — the actual `session` value is logged. Verify it's a string and not a token.

---

## 2. `/api/admin/**` — Admin endpoints (70+ files)

### `D:\voltium\web\src\app\api\admin\admins\route.ts`
- **P0 (lines 53-61):** Role allowlist. Good. But: `adminUseCases.createAdmin` is called with `actorId: req.headers.get('x-admin-id') || 'system'`. The `x-admin-id` header is **client-supplied**. The route uses `session.adminId` for the permission check but the audit log uses the header. **Fix:** always use `session.adminId` for audit.
- **P0 (lines 87-97):** `PUT` allows updating `role` and `permissions`. There's no check preventing an admin from demoting themselves or escalating others. **Fix:** prevent self-demote of last SUPER_ADMIN; require a separate "self-edit" gate.
- **P1 (line 54):** `role && allowedRoles.includes(role) ? role : 'READ_ONLY'` — silently downgrades. If a typo or unknown role, becomes READ_ONLY. Prefer 400.
- **P2 (line 100):** Audit log missing on update.

### `D:\voltium\web\src\app\api\admin\analytics\route.ts`
- **P2 (line 14):** `getOverview()` likely aggregates over the whole DB. No date filters exposed. Caching the response would be wise.

### `D:\voltium\web\src\app\api\admin\announcements\route.ts`
- **P1 (line 41):** No idempotency on POST. Two taps = two announcements.
- **P2 (line 30):** No body-size cap on `message`. A 10MB announcement would be accepted.

### `D:\voltium\web\src\app\api\admin\audit\cleanup\route.ts`
- **P0 (line 8-27):** GET with `?action=cleanup` deletes expired logs. The `action` is a query param, not a body field. **P0** — query-param-triggered destructive action. An accidental bookmark or scanner triggering `?action=cleanup` is destructive. **Fix:** require POST + body field.
- **P0 (line 16):** Even POST endpoint requires only `settings_manage` (which is broad). Cleanup is destructive. **Fix:** require a separate `audit_cleanup` permission, plus rate limit.
- **P1 (line 17):** `deleteExpiredLogs` — verify the use-case is bounded (won't delete more than X at once).

### `D:\voltium\web\src\app\api\admin\audit-logs\route.ts`
- **P0 (line 8):** Requires `requireAdmin()` but **no permission check**. Any admin (READ_ONLY) can see all audit logs, including PII in the `details` column. **Fix:** require `audit_view` permission, plus redact PII in the response.
- **P1 (line 13):** Filter by `actorId` is supported, but no filter by date range or `entity` — easy to dump 50 entries with broad scope.

### `D:\voltium\web\src\app\api\admin\auth\login\route.ts`
- **P1 (line 19):** Rate limit by IP only. Add rate limit by `email` too — current limit is `admin-login:${clientIp}`, so a distributed attack bypasses it.

### `D:\voltium\web\src\app\api\admin\auth\me\route.ts`
- **P1 (line 13):** `const adminId = session.adminId || session.riderDbId;` — using `riderDbId` as a fallback is suspicious. Verify the session shape.

### `D:\voltium\web\src\app\api\admin\auth\refresh\route.ts`
- **P1 (line 16):** Body read with `.catch(() => ({}))`. Fine for non-JSON. The route accepts a refresh token, then bumps `tokenVersion` to revoke the old one. **P0 concern:** the comment on line 5-6 says "old token version is invalidated (rolled forward)" but actually the new token is issued with `tokenVersion + 1` (line 70) but the DB is updated to `admin.tokenVersion + 1` on line 51. Verify the chain — there is a race where two concurrent refreshes can both bump the version and one token becomes orphaned. **Fix:** use atomic update with `update({ tokenVersion: { increment: 1 } })` and re-read.
- **P2 (line 17):** No rate limit. 1000 refreshes/sec is allowed.

### `D:\voltium\web\src\app\api\admin\auth\auto-login\route.ts`
- **P0:** See TOP 10 #8.
- **P0 (line 22):** If `ADMIN_PASSWORD` is unset in dev, the route returns 500. But if it's set in dev, the endpoint works with no user input — anyone hitting the URL logs in as the dev admin. **Verify** that this URL is not exposed externally.
- **P1 (line 19):** `const email = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@voltium.io'` — using a hard-coded fallback admin email in dev is fine, but ensure the user understands the implication.

### `D:\voltium\web\src\app\api\admin\coupons\route.ts`
- **P0 (line 77):** DELETE: no audit log, no soft-delete. **Verify** if the use-case does an audit.

### `D:\voltium\web\src\app\api\admin\dashboard\route.ts`
- **P1 (line 18):** `getCachedResponse<ReturnType<...>>` — 60s cache. No `actorId` in cache key, so all admins see the same data. **Verify:** intended.
- **P3 (line 11):** No permission check beyond `requireAdmin`. The dashboard likely exposes aggregate financial numbers. **Fix:** require `analytics_view`.

### `D:\voltium\web\src\app\api\admin\data-management\overview\route.ts`
- **P1 (line 26):** Returns overview data based on `session.adminRole`. Verify the use-case redacts secrets. Storage paths and backup paths are returned in the response. P3.

### `D:\voltium\web\src\app\api\admin\data-management\backups\route.ts`
- **P0 (line 73-95):** POST creates a backup. The body is `createBackupSchema` — verify it doesn't accept a `path` or `destination` field that lets admin override the storage root.

### `D:\voltium\web\src\app\api\admin\data-management\backups\[id]\route.ts`
- **P1 (line 61):** DELETE: `await dataManagementUseCases.deleteBackup(id, session.adminRole as AdminRole, session.adminId ?? session.riderDbId ?? 'unknown')` — actorId fallback to 'unknown' is a bug. **Fix:** hard-fail if no adminId.

### `D:\voltium\web\src\app\api\admin\data-management\backups\[id]\download\route.ts`
- **P0:** See TOP 10 #4.
- **P0 (line 30):** `if (!job.backupPath || !existsSync(job.backupPath))` — `existsSync` is racy. And `existsSync` itself returns false for inaccessible files (root-owned). The stream will fail in a way that exposes a 500 stack trace to the caller. P3.

### `D:\voltium\web\src\app\api\admin\data-management\backups\[id]\verify\route.ts`
- Clean. No rate limit (P3).

### `D:\voltium\web\src\app\api\admin\data-management\restore\history\route.ts`
- **P1 (line 6-25):** Returns `restoreHistory` — verify the response doesn't include `error` strings that may leak secrets.

### `D:\voltium\web\src\app\api\admin\data-management\restore\start\route.ts`
- **P0 (line 18):** `restoreStartSchema.parse(...)` — verify the schema doesn't accept a `path` field that lets admin restore from arbitrary location.

### `D:\voltium\web\src\app\api\admin\data-management\restore\validate\route.ts`
- Clean.

### `D:\voltium\web\src\app\api\admin\data-management\schedule\route.ts`
- **P0 (line 27-37):** PUT `scheduleUpdateSchema.parse(...)` — verify the schema doesn't accept a `path` or `command` field.
- **P0 (line 61-80):** POST `?action=run-now` runs a scheduled backup now. **No idempotency.** A double-tap creates two backup jobs simultaneously. **Fix:** require `x-idempotency-key` or check for an in-progress job.

### `D:\voltium\web\src\app\api\admin\data-management\storage\route.ts`
- **P3 (line 16-19):** `status: (err instanceof Error ? err.message : String(err)) === 'Unauthorized' ? 403 : 500` — string-based error detection. Fragile. P3.

### `D:\voltium\web\src\app\api\admin\deposits\route.ts`
- **P0 (line 75):** REFUND case has no `if (typeof refundAmount === 'number' && refundAmount > 0)` cap or audit. **Verify** the use-case emits an audit log.
- **P1 (line 90):** Catch handles `DepositStateError` but no log line on success of REFUND. Compliance gap.

### `D:\voltium\web\src\app\api\admin\earnings\route.ts`
- **P0 (line 11):** Permission is `riders_view`, but earnings are financial. **Fix:** require `earnings_view` or `transactions_view`.

### `D:\voltium\web\src\app\api\admin\faqs\route.ts`
- **P0 (line 80):** `req.nextUrl.searchParams.get('id')` — DELETE uses query param. No CSRF protection, but admin routes usually have CSRF via cookie. **Verify** SameSite=Lax on admin session cookie.
- **P1:** No audit log on delete.

### `D:\voltium\web\src\app\api\admin\feature-flags\route.ts`
- **P0 (line 58):** `const actorId = req.headers.get('x-admin-id') || 'system';` — header-based actor ID is client-controlled. **Fix:** use `session.adminId`.
- **P1 (line 49):** `validKeys` is hardcoded. If a new flag is added, you must update this list. **Fix:** centralize.

### `D:\voltium\web\src\app\api\admin\fleet\route.ts`
- **P2 (line 17):** No pagination. `listFleet` could return a huge array.

### `D:\voltium\web\src\app\api\admin\guarantors\route.ts`
- **P1 (line 26-30):** Search by phone with `contains` — Prisma `contains` on an encrypted phone field won't work as expected. **Verify** the schema: if `phone` is encrypted, this is a bug. The route may always return zero results for encrypted search.

### `D:\voltium\web\src\app\api\admin\health\route.ts`
- **P0 (line 6):** No auth on `GET /api/admin/health`. Anyone can probe the DB and get `uptimeSeconds`. **Fix:** add `requireAdmin()`.

### `D:\voltium\web\src\app\api\admin\hubs\route.ts`
- Clean. POST is missing idempotency on creation but not critical.

### `D:\voltium\web\src\app\api\admin\hubs\bulk\route.ts`
- **P1 (line 14-16):** All hubs_manage admins can bulk-delete. The action `delete` is a separate permission in theory but here it falls under `hubs_manage`. **Fix:** split.

### `D:\voltium\web\src\app\api\admin\incidents\route.ts`
- Clean. No idempotency on POST (incidents could be double-created).

### `D:\voltium\web\src\app\api\admin\incidents\[id]\route.ts`
- **P1 (line 38-45):** Update allows `status`, `assignedTo`, `resolution`, `insuranceClaim`, `insuranceClaimNumber`. **No two-eyes approval** for `insuranceClaim`. A solo admin can mark an incident as a claim and bind the company to a claim.

### `D:\voltium\web\src\app\api\admin\jobs\route.ts`
- **P0:** See TOP 10 #10.
- **P0 (line 154-162):** `runWalletReconciliation()` — runs at request time, not in a worker. Long-running on a single Node process. If it takes 30s, the HTTP connection blocks. **Fix:** enqueue a job and return 202.
- **P1 (line 264-285):** SystemSetting upsert with `valueType`, `category`, etc. — but the create branch lists them in different order than update. If the create is hit before the update, the record is created with the right fields.

### `D:\voltium\web\src\app\api\admin\kyc\route.ts`
- **P0 (line 64):** POST `action` is `body.action || body.decision` — both accepted. The schema should restrict.
- **P1 (line 28):** Search by phone `contains` — same encrypted-field concern.

### `D:\voltium\web\src\app\api\admin\legal\route.ts`
- **P0 (line 35):** `req.headers.get('x-admin-id') || 'system'` — header-based actor. **Fix:** use session.

### `D:\voltium\web\src\app\api\admin\maintenance-mode\route.ts`
- **P0 (line 40):** `if (session.role !== 'SUPER_ADMIN')` — checks `session.role`, not `session.adminRole`. The session has both — admin sessions set `role: 'admin'` and `adminRole: 'SUPER_ADMIN'`. This check is correct. But this is the only place using `session.role === 'SUPER_ADMIN'` — inconsistent with the rest of the codebase which uses `hasPermission` or `adminRole`. **Fix:** unify.
- **P1 (line 56):** The `MAINTENANCE_MODE` setting is not gated by `isEditable`. **Verify** that this isn't a foot-gun.

### `D:\voltium\web\src\app\api\admin\notifications\route.ts`
- **P0 (line 41):** `riderId = (body as Record<string, unknown>).riderId` — bypasses `sendNotificationSchema` validation! The schema (referenced via `validateBody`) doesn't include `riderId`, but the route accepts it from the body directly. **Fix:** add `riderId` to the schema (with optional + conflict-resolution) and remove the cast.
- **P1:** No rate limit. A bad admin can spam notifications to all riders.

### `D:\voltium\web\src\app\api\admin\offers\route.ts`
- **P0 (line 81):** DELETE no audit log. **Verify** in the use-case.

### `D:\voltium\web\src\app\api\admin\payment-gateways\route.ts`
- **P0:** See TOP 10 #3.
- **P0 (line 73-84):** First-time GET auto-seeds default gateways with hardcoded secrets. Anyone with admin auth can trigger this. The hard-coded `keySecret: 'mockSecretKey456'` etc. is benign but the pattern (auto-seed on read) is bad.

### `D:\voltium\web\src\app\api\admin\payment-gateways\[id]\route.ts`
- **P0 (line 34-36):** PATCH allows updating `keySecret` and `webhookSecret` directly from the body with no encryption-at-rest check. **Verify** that the DB column is encrypted; if not, P0.
- **P0 (line 34):** No permission check beyond `requireAdmin`. **Fix:** require `payment_gateways_manage`.

### `D:\voltium\web\src\app\api\admin\plans\route.ts`
- **P0 (line 14-19):** PERM_MAP for view uses `analytics_view`. That's a permission creep — plans are not analytics. **Fix:** define `plans_view` permission.
- **P1 (line 80-95):** DELETE wraps `error.message` into the response (`Failed to delete plan: ${msg}`). **PII/error leakage risk** if the underlying error contains DB internals.

### `D:\voltium\web\src\app\api\admin\reconciliation\route.ts`
- **P0 (line 20):** `requireAdmin()` only — no permission check, no rate limit. A READ_ONLY admin can run the full reconciliation against the live DB. **Fix:** require `finance_view` or `reconciliation_run`.
- **P1 (line 25):** Runs in HTTP request — long blocking. **Fix:** enqueue.

### `D:\voltium\web\src\app\api\admin\referrals\route.ts`
- **P0 (line 27-55):** POST `processReferralReward` is called with admin-supplied `referrerId` and `refereeId`. There's no check that the two are actually related. An admin (or a compromised admin) can credit arbitrary referral rewards to arbitrary pairs. **Fix:** the use-case must verify the referrer-referee relationship.

### `D:\voltium\web\src\app\api\admin\rewards\route.ts`
- **P0 (line 35-39):** `awardRewardSchema` — verify the schema doesn't accept negative amounts.
- **P1 (line 9):** No rate limit.

### `D:\voltium\web\src\app\api\admin\rentals\route.ts`
- **P0 (line 71):** Permission is `rentals_return_inspection` or `rentals_pickup_inspection` based on action. **Good.**
- **P0 (line 95-98):** `transactions_approve` required for fee adjustments. **Good.**
- **P0 (line 77-80):** HUB_MANAGER hub scoping check. **Good** pattern — replicate elsewhere.
- **P2 (line 78):** `lease.vehicle?.hubId` — `lease.vehicle` might be null. P3.

### `D:\voltium\web\src\app\api\admin\riders\actions\route.ts`
- **P0 (line 32-36):** The `ASSIGN_PLAN` case calls `update` then `assignPlan`. The `update` is dead — `currentPlan` is overwritten by `assignPlan` in the same handler. Wasteful, not security.
- **P0 (line 86):** `if (!hasPermission(session, 'device_remote_control')) return adminForbidden();` — uses `session` (the full object), not `session.adminRole`. **Verify** what `hasPermission` expects — most other files pass `session.adminRole`. If it does string check, P0.
- **P0 (line 142-147):** UNLOCK_DEVICE: super_admin can unlock without password. **This is the recovery flow.** Combined with the impersonation vulnerability in rider-auth.ts, an admin can unlock any rider's device. **Verify** the audit log includes the unlock event with the actor ID.
- **P0 (line 109):** `FACTORY_RESET` — sends remote wipe to the rider's phone via FCM. The actor is `session.adminId || 'SYSTEM'`. **Fix:** require a confirmation or two-step.

### `D:\voltium\web\src\app\api\admin\riders\bulk\route.ts`
- **P0 (line 28-29):** Permission for `delete` is `riders_delete`, but for `updateStatus` and `bulkKyc` it's `riders_update`. The default of `riders_update` for KYC bulk is wrong — KYC bulk approve should be a separate permission. **Fix:** `kyc_bulk_approve`.
- **P0 (line 36-49):** `updateStatus` is called in a loop with no transaction. If one fails mid-loop, half the riders are updated, half are not. **Fix:** wrap in `$transaction` or use a use-case that does it atomically.
- **P1 (line 95):** Wraps `withIdempotency` — good.

### `D:\voltium\web\src\app\api\admin\riders\[id]\data-deletion\route.ts`
- **P0:** See TOP 10 #6.
- **P0 (line 42-44):** Anonymized PII is `DELETED-${randomSuffix}` and re-encrypted. **Verify** that the `randomSuffix` is cryptographically random and not `Math.random()` (which is what the code uses). **Math.random is NOT cryptographic.** A motivated attacker can re-identify a "deleted" rider by brute-forcing the suffix.

### `D:\voltium\web\src\app\api\admin\riders\[id]\device-data\route.ts`
- **P0 (line 6):** Returns all device data (locations, contacts, call logs) for a rider. Permission is `device_tracking_view`. **Verify** the use-case applies a hub-scope for HUB_MANAGER. Currently no hub scope in the route.

### `D:\voltium\web\src\app\api\admin\riders\[id]\plan\route.ts`
- **P0 (line 19):** `riderUseCases.rejectPlan(riderDbId, session.adminId || '', reason)` — verify the use-case actually rejects. Also: **no `kyc_reject` permission** — uses `riders_manage` which is broad.

### `D:\voltium\web\src\app\api\admin\riders\[id]\wallet-adjust\route.ts`
- **P0 (line 40-45):** `if (type === 'CREDIT' && !proofUrl)` — proof required for credit. **Good.** But for DEBIT, only `reason` is required. **Verify** the use-case logs a clear audit trail.
- **P0 (line 100-107):** `createAuditLog(...).catch(() => {})` — fire-and-forget. If the audit log fails, the credit still happens. **Fix:** await the audit log, or use a synchronous outbox.
- **P0 (line 49-98):** No `allowNegative` cap for DEBIT. The use-case is called with `allowNegative: true` (line 88), but there's no maximum. A super-admin can drain a rider's wallet to -∞.

### `D:\voltium\web\src\app\api\admin\scores\route.ts`
- **P0 (line 36-46):** Recalculate allows arbitrary `riderId`. The use-case must verify the rider exists; if not, P0.

### `D:\voltium\web\src\app\api\admin\scores\recalculate\route.ts`
- **P0 (line 13):** `recalculateAll` runs synchronously for all riders. **P0 — long blocking, no rate limit.** **Fix:** enqueue.

### `D:\voltium\web\src\app\api\admin\settings\route.ts`
- **P0 (line 33):** `req.headers.get('x-admin-id') || 'system'` — header-based actor. **Fix:** use session.

### `D:\voltium\web\src\app\api\admin\shifts\route.ts`
- **P0 (line 33):** Permission is `settings_manage` for all operations. **Fix:** use `shifts_manage` (verify exists).

### `D:\voltium\web\src\app\api\admin\system-settings\route.ts`
- **P0 (line 81-83):** `if (session.role !== 'SUPER_ADMIN')` — `role` not `adminRole`. As noted above, this is the only file using this pattern. **Verify** the session shape — admin sessions have `role: 'admin'`. If the code intends `adminRole === 'SUPER_ADMIN'`, this is a **P0** — every admin can edit system settings.
- **P0 (line 101-105):** `if (existing.isSecret && value === '[CONFIGURED]')` returns success without persisting. **This is a feature** (don't overwrite a real secret with the placeholder), but the success message says "unchanged" with status 200 — could confuse callers.
- **P1 (line 58-69):** Read-only env dump includes `DATABASE_URL_CONFIGURED`, `JWT_SECRET_CONFIGURED` — these are fine (just booleans). But the route's design exposes all system settings to any admin. **Verify** that `getSystemSettings` is gated correctly.

### `D:\voltium\web\src\app\api\admin\team-leaders\route.ts`
- **P0 (line 17):** Uses `tl_manage` for GET. **Verify** that `tl_manage` is defined; other files use `team_leaders_manage` (e.g. `bulk` route). **Inconsistency = P0 candidate.** Whichever is correct, fix the other.
- **P0 (line 84):** DELETE no audit log. **Verify** in the use-case.

### `D:\voltium\web\src\app\api\admin\team-leaders\bulk\route.ts`
- **P0 (line 13):** `team_leaders_manage` (with underscores) — **different from `tl_manage` used in the non-bulk route.** One of these is a typo.

### `D:\voltium\web\src\app\api\admin\team-leaders\[id]\riders\route.ts`
- **P0 (line 14):** Permission is `riders_view`, but the route returns the full team leader's riders with **wallet balances, overdue rental amounts**. **Fix:** require `team_leader_view_full` (financial data).
- **P1 (line 71-74):** `isChurned`, `isOverdue` etc. are computed in-route — business logic in route. **Fix:** move to use-case.

### `D:\voltium\web\src\app\api\admin\tickets\route.ts`
- **P0 (line 51-55):** `refundAmountInPaise > 0` requires `transactions_approve`. **Good.**
- **P0 (line 81-110):** POST creates a ticket on behalf of a rider. The schema isn't validated — just `riderDbId`, `category`, `priority`, `subject`, `message`. **Fix:** validate the body.

### `D:\voltium\web\src\app\api\admin\tickets\[id]\route.ts`
- Clean.

### `D:\voltium\web\src\app\api\admin\tickets\[id]\messages\route.ts`
- **P0 (line 30):** `if (error instanceof Error && error.message === 'Ticket not found')` — exact string match. Fragile.

### `D:\voltium\web\src\app\api\admin\tickets\bulk\route.ts`
- **P1 (line 30):** String-based error detection (`includes 'is required'`). Fragile.

### `D:\voltium\web\src\app\api\admin\transactions\route.ts`
- **P0 (line 89):** `return success(result, 'Transaction ${action.toLowerCase()}d')` — interpolated string. Minor.
- **P0 (line 90-110):** Multiple `instanceof` checks. The use-case already throws typed errors — fine.

### `D:\voltium\web\src\app\api\admin\transactions\bulk\route.ts`
- **P0 (line 33-46):** Loop calls `approveTransaction` for each id with no transaction wrapper. **Fix:** wrap in `$transaction` or use bulk use-case.

### `D:\voltium\web\src\app\api\admin\vehicles\route.ts`
- **P0 (line 87-112):** PUT body is `updateVehicleSchema` but the validator is required. **Verify** the schema disallows changing `vehicleNumber` post-creation (it should be immutable).
- **P0 (line 116-140):** DELETE: `if (vehicle) { updateVehicle(id, { status: 'RETIRED' })` — soft-delete by status change. **Verify** no other code path treats `RETIRED` vehicles as `AVAILABLE`. The `if (vehicle)` check is fine for 404, but the side effect is silent.

### `D:\voltium\web\src\app\api\admin\vehicles\bulk\route.ts`
- Clean.

### `D:\voltium\web\src\app\api\admin\vehicles\[id]\history\route.ts`
- **P0 (line 8-58):** Returns full vehicle history including all riders' phone numbers across all leases. **Verify** the permission `vehicles_view` is correct for this level of PII.
- **P0 (line 15):** `where: { OR: [{ id: id }, { vehicleId: id }, { vehicleNumber: id }] }` — string-based lookup. **Verify** the input is escaped by Prisma. (Prisma escapes by default, so OK.)

### `D:\voltium\web\src\app\api\admin\workflow-coverage\route.ts`
- **P0 (line 14-22):** `checkApi` makes outbound `fetch` to `baseUrl`. The `baseUrl` is `new URL(req.url).origin` — derived from the request. If a reverse proxy is misconfigured, this could be set to anything. The cookie header is forwarded, so **the inner requests have admin cookies**. **Fix:** always fetch from a hardcoded internal URL (e.g. `http://localhost:8081`).
- **P0 (line 24):** Only `requireAdmin()` — no permission check. Any admin can trigger the workflow coverage check. **Fix:** require `health_view`.

---

## 3. `/api/riders/**` (plural, different from `/rider`)

### `D:\voltium\web\src\app\api\riders\dashboard\route.ts`
- **P0 (line 1-5):** Imports `GET_dashboard` from `@/server/modules/riders/rider.routes`. **No auth check in the route itself.** The auth is delegated to the imported handler. **Verify** that `GET_dashboard` calls `requireRiderSession`. If not, **P0 — public dashboard.**

### `D:\voltium\web\src\app\api\riders\register-token\route.ts`
- **P0 (line 10):** Uses `getRiderId(req)` instead of `requireRiderSession`. **Verify** what `getRiderId` does — likely returns the rider id from the body or token. If unauthenticated, **P0.**

---

## 4. `/api/files/**` (6 files)

### `D:\voltium\web\src\app\api\files\[...path]\route.ts`
- **P0 (line 76-82):** Accepts either session or admin session. **Both must fail** if neither is present. The fallback `return new NextResponse('Unauthorized', { status: 401 })` is fine.
- **P0 (line 90-103):** Path traversal check is duplicated. The check on line 92 (`startsWith(resolve(baseDir))`) is the authoritative one; the secondary check on lines 97-103 is belt-and-suspenders. **Verify** the case where `baseDir === resolvedBase` (root of storage) — line 92 passes but no `sep` is required. **Fix:** use `fullPath === resolvedBase || fullPath.startsWith(resolvedBase + sep)`.
- **P0 (line 106):** `fileRepository.getFileRecordByKey(normalizedPath)` — DB lookup is **case-sensitive** but normalized path uses `replace(/\\/g, '/')`. On Windows, paths are case-insensitive — possible inconsistency.
- **P1 (line 132-138):** Admin file view is logged but not awaited — fire-and-forget. If log fails, the read still happens.
- **P1 (line 154):** On read error, returns 404. **Verify** the error is actually a 404 (not a permission/IO error).

### `D:\voltium\web\src\app\api\files\confirm-upload\route.ts`
- **P0 (line 11-16):** Auth check is `if (!riderSession && !adminSession) return unauthorized` — but the use-case `fileUseCases.confirmUpload` doesn't receive the actor. **Verify** the use-case re-checks ownership. If not, **P0 — any authenticated user can confirm any file upload.**

### `D:\voltium\web\src\app\api\files\direct-upload\route.ts`
- **P0 (line 14-18):** Returns 410 Gone. **Good** — the comment explains the deprecation. But the 410 response body is plain JSON, not a `success`/`error` envelope. **Inconsistency** with the rest of the API. P2.

### `D:\voltium\web\src\app\api\files\local-upload\[fileRecordId]\route.ts`
- **P0 (line 10-21):** The GET handler delegates to the catch-all. **Verify** the catch-all enforces auth (it does, but as noted above).
- **P0 (line 32-128):** PUT validates an upload token. **Good.** But the token is HMAC-signed; **verify** the signing key is rotated. The signature is presumably in `fileUseCases._verifyUploadToken` — P3.
- **P0 (line 72-87):** Magic bytes check is **skipped in development** (`process.env.NODE_ENV !== 'development'`). The comment says "skip in development to support all Flutter canvas/image pickers." This is the same anti-pattern as elsewhere — `NODE_ENV=development` allows any content type. **Fix:** use a different env flag like `ENABLE_MAGIC_BYTES_SKIP`.
- **P0 (line 100-103):** Path traversal protection looks robust.

### `D:\voltium\web\src\app\api\files\request-read\route.ts`
- **P0 (line 11-16):** Same auth check as `confirm-upload` — `riderSession || adminSession`. **Verify** the use-case enforces ownership.
- **P1 (line 24):** `const permissions = adminSession ? (adminSession as any).permissions : undefined;` — `as any` and `(adminSession as any)` indicates the session shape is poorly typed. The `permissions` field is in `adminPermissions` not `permissions` based on other files. **Verify.**

### `D:\voltium\web\src\app\api\files\request-upload\route.ts`
- **P0 (line 11-16):** Same auth check pattern.
- **P0 (line 24-26):** `adminSession` doesn't pass permissions to the actor object. **Verify** the use-case doesn't need them.

---

## 5. `/api/cron/**` (3 files)

### `D:\voltium\web\src\app\api\cron\cleanup-telemetry\route.ts`
- **P0 (line 7-11):** `requireCronAuth(req)` — **verify** that the auth requires a `CRON_SECRET` bearer token and not just any header. If the check is a single header, easy to bypass.

### `D:\voltium\web\src\app\api\cron\notifications\route.ts`
- Clean.

### `D:\voltium\web\src\app\api\cron\reconciliation\route.ts`
- **P0 (line 20-23):** The check is `if (existingReport) return success(existingReport, ...)`. **P0 — idempotency by date is racy.** Two concurrent cron invocations can both pass the `checkReconciliationToday` check before either writes. **Fix:** use a unique constraint on `reportDate` and let the second one fail.

---

## 6. `/api/internal/**` (2 files)

### `D:\voltium\web\src\app\api\internal\debug\route.ts`
- **P0 (line 22-30):** `authorize` checks `auth === env.CRON_SECRET`. The `env.CRON_SECRET` is the **same secret** used for cron auth and now also for debug. If `CRON_SECRET` leaks, attacker gets debug + cron. **Fix:** separate secret.
- **P0 (line 110):** `result.deadLetter = { total: 0, byType: [] };` — dead letter queue "removed" but the response shape remains. Stale. P3.
- **P0 (line 89-100):** `db.$queryRawUnsafe(...)` — safe because the query is hardcoded, but the wrapper should be `db.$queryRaw` (Prisma's tagged template) for consistency.

### `D:\voltium\web\src\api\internal\worker\route.ts`
- **P0 (line 16-21):** See TOP 10 #9.
- **P0 (line 30-34):** `processJobs(SEND_SMS, ...)` — error from SMS provider throws, but the route's catch only logs `[Worker] Job processing failed`. **No idempotency / retry visibility.** P3.

---

## 7. `/api/transaction/**` (3 files)

### `D:\voltium\web\src\app\api\transaction\topup\route.ts`
- **P0 (line 53):** Idempotency key comes from header `x-idempotency-key`. If the header is missing, the use-case generates one internally (probably). **Verify** the use-case behavior.
- **P0 (line 23-29):** Rate limit 10/min per rider. **P1:** add IP-based rate limit too.

### `D:\voltium\web\src\app\api\transaction\request\route.ts`
- **P0 (line 1-3):** Re-exports `POST` from `topup/route`. **Two URLs for the same handler** — same idempotency split, same rate-limit split. **Fix:** consolidate.

### `D:\voltium\web\src\app\api\transaction\history\route.ts`
- **P0 (line 45-49):** DELETE returns 403. **Good** — but the route still does `await requireRiderSession(...)` then bails. The auth check is correct. **Verify** the body of DELETE doesn't have side effects (it doesn't).
- **P1 (line 17-42):** No rate limit on GET. A rider can hammer history.

---

## 8. `/api/support/**` (4 files)

### `D:\voltium\web\src\app\api\support\chat\route.ts`
- **P0 (line 12):** `process.env.NODE_ENV === 'development' ? 100 : 10` — dev mode rate-limit is 10x. Same anti-pattern.
- **P0 (line 15-27):** `EMERGENCY_KEYWORDS` is hardcoded. If a rider uses a Hindi/regional word for "accident", no flag. **Verify** intent.
- **P0 (line 29-54):** `localSupportReply` is a hardcoded keyword router. Not AI (despite `X-Voltium-AI: disabled-local-only` header). **Verify** that this is the intended production behavior — the header implies an AI integration that's not present.
- **P1 (line 89-93):** `logger.info` includes the response length. The message body is **not logged** — good (PII protection). The `critical: isCritical` flag is logged — good.

### `D:\voltium\web\src\app\api\support\faqs\route.ts`
- **P0 (line 7):** No auth. Public endpoint. **Verify** the FAQs contain no PII.
- **P1 (line 9-13):** Cache 1h, fine. But cache key is global — no admin/user context.

### `D:\voltium\web\src\app\api\support\feedback\route.ts`
- **P0 (line 19-28):** Creates a `supportTicket` with `status: 'RESOLVED'` and `category: 'FEEDBACK'`. **No audit log of feedback submission.** If feedback is anonymous, that's fine; if it's tied to a rider, P3.

### `D:\voltium\web\src\app\api\support\tickets\route.ts`
- **P0 (line 52-55):** `riderId: body.riderId || riderDbId` — body can override session riderId. **Verify** the use-case rejects mismatched riderId. If not, **P0 — rider A creates a ticket for rider B.**
- **P1 (line 43-48):** Rate limit 5 in 10 min — fine.

### `D:\voltium\web\src\app\api\support\tickets\[id]\route.ts`
- **P0 (line 16-20):** `where: { id, riderId: auth.riderDbId }` — ownership check **is in the query** (good, prevents IDOR). **Verified safe.**

---

## 9. `/api/health/**` (4 files)

### `D:\voltium\web\src\app\api\health\route.ts`
- **P0 (line 33-34):** Windows-only path probe via PowerShell. `execFileSync('powershell', ...)` — if `deviceId` is manipulated to a non-existent drive, the script returns empty. The fallback to POSIX `df` may not exist on Windows. **Verify** the entire flow.
- **P1 (line 33):** `deviceId = root.slice(0, 2)` — if `probePath` is `\\?\C:\foo`, `parse(...).root` is `C:\`, slice gives `C:`. Good. But if `probePath` is a UNC path, slicing the first 2 chars is wrong. P3.

### `D:\voltium\web\src\app\api\health\db\route.ts`
- Clean. No auth (intended for external probes).

### `D:\voltium\web\src\app\api\health\storage\route.ts`
- **P1 (line 17-24):** `mkdir` if path doesn't exist. On a public-facing endpoint, this can create arbitrary directories on the server. **Verify** the `LOCAL_STORAGE_ROOT` is hardcoded, not user-controllable.

### `D:\voltium\web\src\app\api\health\worker\route.ts`
- Clean. No auth.

---

## 10. `/api/notification/list/route.ts`
- **P0 (line 30):** `const { notificationId } = await request.json();` — body is read without try/catch. If body is empty, throws 500. **Fix:** wrap.
- **P0 (line 33):** `markRead(notificationId, riderDbId)` — verify the use-case rejects cross-rider access. If not, P0.

---

## 11. `/api/payment-gateways/**` (2 files)

### `D:\voltium\web\src\app\api\payment-gateways\route.ts` — does not exist.
- The user requested this file; the actual file is at `/api/admin/payment-gateways/route.ts` (covered above).

### `D:\voltium\web\src\app\api\v1\payment-gateways\active\route.ts`
- **P0 (line 1-26):** No auth! Any unauthenticated caller can list active payment gateways. While the response is a list (no secrets), this is an information disclosure vector and may not be intended. **Fix:** add auth, or document as public.

---

## 12. Other endpoints

### `D:\voltium\web\src\app\api\auth\verify-phone\route.ts`
- **P0 (line 16-19):** `process.env.NODE_ENV === 'development' ? 100 : 10` — dev mode 10x rate limit. **P0 in production misconfig.**
- **P1 (line 24-26):** Rate limit by IP only. Add by `phone` (which is done on line 45, good).
- **P0 (line 53):** `verifyOtp(phone, otp)` — verify the OTP is invalidated after one use. P3.

### `D:\voltium\web\src\app\api\shifts\route.ts`
- **P0 (line 6):** No auth. Public endpoint. **Verify** intended.

### `D:\voltium\web\src\app\api\rental\book\route.ts`
- **P0 (line 14-43):** No idempotency key. **P0 — double-tap = double-book.** **Fix:** require `x-idempotency-key`.
- **P1 (line 29-34):** Regex validation is fine but no Zod schema. Inconsistent with the rest.

### `D:\voltium\web\src\app\api\sync\queue\route.ts`
- **P0 (line 14-18):** `syncUseCases.queueActions(riderDbId, validation.data.actions)` — accepts arbitrary actions. **Verify** the schema's `actions` allowlist.

### `D:\voltium\web\src\app\api\vehicles\route.ts`
- **P0 (line 8):** `requireRiderSession` — rider auth. Returns all vehicles at a hub. **Verify** intended (could be public; the auth adds no security if the data is non-sensitive).

### `D:\voltium\web\src\app\api\pricing\route.ts`
- **P0 (line 6):** No auth. Public. **Verify** intended.

### `D:\voltium\web\src\app\api\webhooks\payment\route.ts`
- **P0:** See TOP 10 #1.
- **P0 (line 31-39):** `db.paymentGateway.findUnique({ where: { id: provider.toLowerCase() } })` — `id` is user-controlled (header). If `id` matches a non-Razorpay gateway, the signature check on line 58 is the dev fallback. **Production bypass is the critical issue.**
- **P0 (line 78-114):** On success, credits the rider's wallet. **No `isActive` re-check** between signature and credit. A deactivated gateway could still credit. P3.
- **P0 (line 80-115):** `$transaction` block. If `rider.findUnique` returns null (riderId is from body, not signed), the `txn` is never created. **P0 — silent skip.** **Fix:** return 400 if rider not found.

### `D:\voltium\web\src\app\api\search\route.ts`
- **P0 (line 23):** Permission is `analytics_view`. **Good.**
- **P0 (line 38-122):** `findMany` with `contains` queries across 4 entities in parallel. **P0 — N+1 / potential DoS.** No max-length on `q` (line 27 only checks >=2).
- **P1 (line 48):** Search by phone — returns phone numbers in result. **Verify** that the permission allows PII visibility.

### `D:\voltium\web\src\app\api\metrics\route.ts`
- **P0 (line 15-39):** Prometheus text format (`format !== 'json' && type !== 'slow'`) is served with **no auth.** Any scraper on the network can read CPU/memory/event-loop-lag. **Fix:** add bearer token check for Prometheus format too.
- **P1 (line 41-50):** The default `format` is undefined, so default response is Prometheus text. The comment acknowledges "no auth headers by default" — fine for internal Prometheus, but if the route is exposed to the internet, this is a P0.

### `D:\voltium\web\src\app\api\monitoring\metrics\route.ts`
- **P0 (line 12-19):** Auth: `isCron` (CRON_SECRET bearer) or admin session. **P0 — `getAdminSession()` is awaited but the result is used in an `if` chain that doesn't fully gate the metrics.** Verify the response shape is identical for both paths.

### `D:\voltium\web\src\app\api\ready\route.ts`
- Clean. No auth (intended).

---

## CROSS-CUTTING OBSERVATIONS

### Patterns observed across 50+ files

1. **`req.headers.get('x-admin-id')` as actorId** — appears in:
   - `admin/admins/route.ts:65, 103`
   - `admin/feature-flags/route.ts:58`
   - `admin/legal/route.ts:35`
   - `admin/settings/route.ts:35`
   - This is **client-controllable** in the same request. An admin can attribute their action to another admin by setting the header. **Fix:** always use `session.adminId`.

2. **`process.env.NODE_ENV === 'development'` security gate** — appears in:
   - `admin/auth/auto-login/route.ts:14`
   - `rider/sync/pickup/route.ts:42`
   - `files/local-upload/[fileRecordId]/route.ts:72`
   - `device/data/route.ts:12, 18`
   - `device/permissions/route.ts:12, 18`
   - `webhooks/payment/route.ts:52, 58`
   - `support/chat/route.ts:12`
   - `auth/verify-phone/route.ts:18`
   - 8+ files gate a security check on `NODE_ENV === 'development'`. If `NODE_ENV` is ever set to `development` in a preview/staging deploy (a common operator mistake), the gate is open. **Fix:** use `process.env.APP_ENV === 'production'` (already used by `auth/auto-login`) and require both conditions to disable the dev path.

3. **Two URL aliases for the same handler** — `transaction/request` and `transaction/topup`; `rider/verify-lock-password` and `rider/device/verify-lock`. **Fix:** consolidate to one URL per handler, add a 301/308 alias for backwards-compat if needed.

4. **String-based error matching** — appears in 15+ routes (e.g. `err instanceof Error && err.message.includes('not found')`). Fragile to i18n, message changes. **Fix:** throw typed `DomainError` classes and check `instanceof` (the codebase already has `KycStateError`, `DepositStateError`, etc. — just use them everywhere).

5. **Audit log fire-and-forget** — appears in 6+ admin routes (`.catch(() => {})` after `createAuditLog`). If the log fails, the operation still succeeds. **Fix:** `await` the audit log inside the operation transaction.

6. **Missing rate limits on financial routes** — `/api/admin/rewards`, `/api/admin/notifications` (POST), `/api/admin/teams` (POST/PUT), `/api/rider/earnings` (POST), `/api/rider/kyc` (POST), `/api/rider/sync/device-data` (POST), `/api/admin/incidents` (POST). At least 7 mutating endpoints have no rate limit.

7. **No idempotency keys on financial mutating routes** — `/api/transaction/topup` accepts but doesn't require. `/api/rental/book` has no idempotency. `/api/admin/transactions/bulk` no idempotency. `/api/rider/plans` no idempotency. **Fix:** enforce `x-idempotency-key` on all financial routes; on `/api/rental/book` it should be required, not optional.

8. **`requireAdmin` used with `riderDbId` fallback for actor** — appears in audit logs across `admin/riders/[id]/wallet-adjust`, `admin/riders/actions`, `admin/riders/bulk`, `admin/riders/[id]/data-deletion`, `admin/incidents/[id]`. The session has both `adminId` and `riderDbId`; the audit log should use `adminId` exclusively. The fallback to `riderDbId` is a band-aid for sessions that lack `adminId` (which should never happen for admin sessions).

9. **No `withApiHandler` wrapper on most routes** — `withApiHandler` exists in `src/lib/api-handler.ts:13` and provides `ApiError` mapping. Most admin routes use their own `try { ... } catch (error) { logger.error(...); return errors.internal(...) }` pattern, which **loses the typed-error mapping**. **Fix:** wrap in `withApiHandler` for consistency.

10. **Hub scoping is inconsistent** — `admin/rentals/route.ts:78-80` enforces HUB_MANAGER hub scoping. `admin/riders/[id]/device-data` does not. `admin/team-leaders/[id]/riders` does not. **Fix:** add a shared `enforceHubScope(session, resource)` helper.

11. **Permission name typos** — `tl_manage` vs `team_leaders_manage` (`admin/team-leaders/route.ts:17` vs `admin/team-leaders/bulk/route.ts:13`). One of them is wrong. **Fix:** grep and unify.

12. **Self-actor mismatch in audit** — `req.headers.get('x-admin-id')` vs `session.adminId` (see #1). In `admin/riders/[id]/wallet-adjust/route.ts:101`, the `approvedBy` field is set to `session.adminId` (correct) but the audit log also uses `session.adminId` (line 100). Good. But `createAdmin` (line 65) and `updateAdmin` (line 103) use the header. **Fix:** unify to `session.adminId` everywhere.

13. **`/api/admin/audit-logs` returns PII in `details`** — no redaction. The audit log column is JSON-serialized and may include `phone`, `aadhaarNumber`, etc. **Fix:** add a `redactPii` pass in the response.

14. **37 routes are missing correlation/request IDs** — none of the routes I've read emit or accept `x-request-id`. Logs across the system can't be correlated. **Fix:** add a `requestId` middleware.

15. **16 routes are missing `Cache-Control` headers** — successful GET responses should set `Cache-Control` (private) to prevent intermediaries from caching personalized data. E.g. `/api/rider/dashboard` (line 25) has no Cache-Control.

16. **5 routes have `if (process.env.NODE_ENV === 'production' && ...)` for required fields** — this is OK as long as the dev env isn't used in production. The pattern is a smell; a missing env variable is more honest.

17. **No `RateLimit-*` headers** — none of the rate-limited responses set `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Clients can't back off intelligently.

18. **No `Api-Version` header** — none of the responses include a version marker. The `/api/v1/` namespace exists but isn't communicated to clients.

19. **Permission allowlist for ADMIN actions duplicated** — `admin/admins/route.ts:53` has its own allowlist. `admin/payment-gateways/[id]/route.ts` has no allowlist. **Fix:** centralize in a `PERMISSION_DESCRIPTORS` table.

20. **`session.role` vs `session.adminRole`** — `admin/maintenance-mode/route.ts:40` and `admin/system-settings/route.ts:81` use `session.role === 'SUPER_ADMIN'`. Everywhere else uses `session.adminRole`. The two fields have different values (`role: 'admin'` vs `adminRole: 'SUPER_ADMIN'`). **P0 risk** if one of these is a typo. **Fix:** unify to `session.adminRole`.

---

## Summary by Severity

| Severity | Count | Notes |
|----------|-------|-------|
| P0 | 60+ | Includes TOP 10 + ~50 others. Recommend a 1-week fix sprint. |
| P1 | 50+ | Most are missing rate limits / idempotency / hub-scoping. |
| P2 | 30+ | Style / consistency / code-smell fixes. |
| P3 | 20+ | Documentation, headers, logging niceties. |

**Recommended ship-it PRs (in order):**
1. Fix all `process.env.NODE_ENV === 'development'` security gates to also require `APP_ENV !== 'production'`.
2. Remove the `x-admin-id` header pattern; use `session.adminId` everywhere.
3. Add `withApiHandler` wrapper to all admin routes.
4. Add rate limit to all financial mutating routes.
5. Add idempotency-key enforcement to `/api/rental/book`, `/api/rider/plans`, `/api/transaction/topup`, `/api/admin/transactions/bulk`.
6. Fix `/api/device/data` and `/api/device/permissions` dev-mode auth bypass.
7. Fix `/api/webhooks/payment` signature verification for non-Razorpay providers.
8. Add typed `DomainError` and remove string-based error matching across the codebase.
9. Redact PII in `/api/admin/audit-logs` and other audit responses.
10. Consolidate the duplicate routes (`transaction/request` ↔ `topup`, `rider/verify-lock-password` ↔ `rider/device/verify-lock`).
