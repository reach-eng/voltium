# Voltium Remediation Plan

Quality-gated, dependency-sequenced. Each task has: **what · why · where · effort · deps · verify**. Effort is T-shirt sized (S ≤ 2h, M = ½-1d, L = 1-3d, XL = >3d). Decision points marked with 🔀 need your input before execution.

---

## Phase 0 — Security & Data-Integrity Blockers

Fix these before any external user touches the system. Order matters within the phase.

### 0.1 FCM command channel — fix the protocol mismatch
- **What:** Align server sender and Flutter validator on one signed-envelope format. This is the biggest integration break in the codebase.
- **Why:** Every `ADMIN_LOCK`, `UNLOCK_DEVICE`, `MANDATORY_UPDATE`, `WALLET_LOW`, `KYC_STATUS`, `SUPPORT_REPLY` FCM is silently dropped by `_validateSecurityEnvelope`. The "HMAC-signed command channel" marked "Fixed" in `KNOWN_ISSUES.md` is illusory; lock works only via 120s unauthenticated polling fallback.
- **Where:**
  - Server sender: `web/src/lib/fcm.ts:49-159` (sends `timestamp`, no `ts`/`challenge`/`nonce`/`signature`; overlay uses `type:'OVERLAY'` + `overlayType`)
  - Client validator: `flutter/lib/services/fcm_service.dart:68-135` (requires `ts`/`challenge`/`nonce`/`signature`; expects `type:'OVERLAY_TRIGGER'` + `action`)
  - Trigger: `web/src/app/api/admin/riders/actions/route.ts:121-128` (ADMIN_LOCK)
- **How:**
  1. Pick one canonical envelope (recommend the client's stricter version): `{type, action, ts, nonce, challenge, signature}` where `signature = HMAC-SHA256(secret, "$action.$ts.$nonce.$challenge")`.
  2. Update `fcm.ts:49-59` `sendSecurityCommand` to generate `ts`, `nonce` (crypto.randomUUID), `challenge` (random 16 bytes hex), compute the HMAC with `FCM_COMMAND_HMAC_SECRET`, and include all fields.
  3. Update `fcm.ts:148-159` `sendOverlayTrigger`: change `type:'OVERLAY'` → `'OVERLAY_TRIGGER'`, `overlayType` → `action`, and sign the same envelope.
  4. Add server-side nonce tracking (Redis-backed or Postgres `UsedNonce` table with TTL) to prevent replay — the client already has a 5-min window + nonce set (`fcm_service.dart:116-120`); mirror it server-side.
  5. Remove the cleartext `pin` from `sendAdminLock` payload (`fcm.ts:89-91`) — the client already verifies via `/api/rider/device/verify-lock` (`locked_overlay.dart:71-74`).
- **Effort:** L
- **Deps:** None
- **Verify:** Send `ADMIN_LOCK` from admin panel → Flutter device shows lock overlay within seconds (not 120s). Send `MANDATORY_UPDATE` overlay → overlay renders. Unit test the HMAC round-trip on both sides.

### 0.2 RBAC revocation — bump `tokenVersion` on role/permission/isActive changes
- **What:** Demoted/deactivated admins currently keep full access for up to 7 days.
- **Why:** `verifySessionToken` reads role/permissions from the JWT, never the DB (`auth.ts:159-161`). `adminRepository.update` updates role/permissions/isActive but never bumps `tokenVersion` (`admin.repository.ts:65-75`). `isActive` is only checked at login and `/auth/me`, not on other admin routes.
- **Where:** `web/src/server/modules/admin/admin.repository.ts:65-75`, `web/src/lib/auth.ts:159-161`, `web/src/lib/get-session.ts:53-90`
- **How:**
  1. In `adminRepository.update`, when `role`/`adminRole`/`permissions`/`isActive` are in the patch, increment `tokenVersion` on the admin row.
  2. In `getAdminSession` (`get-session.ts:53-90`), after the `tokenVersion` cache check, also re-fetch `isActive`, `role`, `adminPermissions` from DB (extend the 30s cache to cover the full record, not just `tokenVersion`).
  3. Reject if `isActive === false`.
- **Effort:** M
- **Deps:** None
- **Verify:** Demote an admin → their next API call returns 401. Deactivate an admin → next call returns 401 within 30s (cache TTL).

### 0.3 Audit-log credential leaks — strip secrets before logging
- **What:** Hashed passwords and OTPs are being written into the audit log and INFO logs.
- **Why:** `admin.use-cases.ts:63-69` logs `details: { changes: params }` including hashed password on reset (retained 365 days). `verify-otp/route.ts:36` logs the full body including `otp` and `idToken` on every request.
- **Where:**
  - `web/src/server/modules/admin/admin.use-cases.ts:63-69` — strip `password` from `params` before `createAuditLog`
  - `web/src/app/api/admin/admins/route.ts:78` — don't put hashed password into `params.password`
  - `web/src/app/api/auth/verify-otp/route.ts:36,43` — remove body log; log only `{ phone: last4, success, correlationId }`
  - `web/src/server/modules/admin/admin-riders.use-cases.ts:661-675` (`updateSecurityFlags`) — strip `lockPassword` from audit `details`
- **Effort:** S
- **Deps:** None
- **Verify:** Reset an admin password → grep audit log for the hash → not present. Hit verify-otp → logs show redacted phone only.

### 0.4 Admin-create validation + dev-admin fallback hard-disable
- **What:** `/api/admin/admins` POST/PUT has no Zod schema and defaults `role` to `SUPER_ADMIN`. Dev-admin auto-login and mock-SUPER_ADMIN fallback are gated by a single env flag that could leak to prod.
- **Where:**
  - `web/src/app/api/admin/admins/route.ts:44,51,71,75` — add `createAdminSchema`/`updateAdminSchema` (Zod); default `role: 'READ_ONLY'` (never SUPER_ADMIN); validate `email`, `role` against `ADMIN_ROLES`, `permissions` against valid keys
  - `web/src/app/api/admin/auth/auto-login/route.ts:8-12` — hard-disable when `APP_ENV === 'production'` (throw, not just skip)
  - `web/src/app/api/admin/auth/me/route.ts:22-41` — remove the mock SUPER_ADMIN fallback entirely
- **Effort:** M
- **Deps:** None
- **Verify:** Create admin without `role` → defaults to READ_ONLY. Set `ENABLE_DEV_ADMIN_LOGIN=true` in prod env → auto-login throws 403.

### 0.5 Next.js config conflict + image SSRF + CORS
- **What:** Two tracked configs diverge; image optimizer allows fetching any URL; CORS is `*` + credentials.
- **Where:**
  - `web/next.config.mjs` + `web/next.config.ts` — delete `.mjs`, consolidate into `.ts`
  - `web/next.config.ts:5-15` — replace `hostname: '**'` with explicit allowlist (your storage host, Firebase storage bucket, known CDN). For user-uploaded local files, serve via signed-URL endpoint, not the image optimizer.
  - `web/next.config.ts:50-58` — remove static `Access-Control-Allow-Origin: *`; implement origin reflection against `ALLOWED_ORIGINS` (already in `.env.example:74`) in `web/src/middleware.ts`. Never combine `*` with credentials.
  - Remove `cacheComponents: true` from `.ts` (Next 15 experimental on Next 14).
- **Effort:** M
- **Deps:** None
- **Verify:** `curl '/_next/image?url=http://169.254.169.254/&w=1&q=1'` → 400. Cross-origin credentialed request from an allowed origin → works; from disallowed → blocked.

### 0.6 Vehicle pickup race — atomic claim
- **What:** Two riders can claim the same vehicle concurrently.
- **Where:** `web/src/server/modules/rentals/rental.use-cases.ts:173-271` (`syncPickup`), `:26-160` (`bookRental`)
- **How:**
  1. Move the availability check **inside** the transaction.
  2. Use a conditional update: `tx.vehicle.updateMany({ where: { id: vehicleId, status: 'AVAILABLE' }, data: { status: 'ACTIVE_RENTAL' }})` and check `count === 1`; if `0`, throw `VehicleNotAvailable`.
  3. Same pattern for `bookRental` shift-capacity check.
  4. Optional: add a unique partial index on `Vehicle.assignedRiderId WHERE status = 'ACTIVE_RENTAL'` as defense-in-depth.
- **Effort:** M
- **Deps:** None
- **Verify:** Load test: 2 concurrent `syncPickup` requests for the same vehicle → exactly one succeeds, the other gets `VehicleNotAvailable`.

### 0.7 Flutter security blockers
- **What:** Cert pinning dead code, global cleartext, `print()` in prod, dummy Firebase config.
- **Where:**
  - `flutter/lib/core/network/pinned_http_client.dart:27-59` — wire `PinnedHttpInterceptor.createDio()` into `ApiClient._buildDio()` (`api_client.dart:96-101`). 🔀 **Decision:** pin to your production TLS cert SHA-256 fingerprints; for dev, disable pinning behind `kDebugMode`.
  - `flutter/android/app/src/main/AndroidManifest.xml:16` — replace `usesCleartextTraffic="true"` with a `network_security_config.xml` that allows cleartext only for the `dev` flavor (`flutter/android/app/src/dev/...`).
  - `flutter/lib/features/auth/presentation/screens/login_screen.dart:118-120` — remove `print()` calls or wrap in `if (kDebugMode) debugPrint(...)`.
  - `flutter/lib/firebase_options.dart:53-67` + `flutter/android/app/google-services.json` — 🔀 **Decision:** either (a) CI-inject real Firebase config via secrets at build time, or (b) document that FCM is non-functional until configured. Verify the CI job (`flutter-ci-cd.yml:264-281` signing) can also inject `google-services.json`.
  - `flutter/lib/core/network/api_client.dart:76-81` — confirm `LogInterceptor` is truly stripped in release (verify via `flutter build apk --release` + decompile).
- **Effort:** L (cert pinning is the long pole)
- **Deps:** 0.1 (FCM fix) — verify FCM end-to-end after Firebase config is real
- **Verify:** Release APK → no `print` output. HTTP to non-pinned cert → fails. Dev build → cleartext works to localhost; release build → blocked.

### 0.8 Rate-limit fail-open + race + per-phone keying
- **What:** Rate limiting fails open on DB outage; check-then-increment race; auth is IP-only (rotating-IP bypass).
- **Where:** `web/src/lib/rate-limit.ts:65-82`, `web/src/lib/rate-limit-middleware.ts:73`
- **How:**
  1. Atomic conditional update: `UPDATE "RateLimitBucket" SET points = points + 1 WHERE id = $key AND points < $max RETURNING points`. If 0 rows returned → rate limited.
  2. Fail closed on DB outage for auth endpoints (deny); fail open for non-auth (allow).
  3. Add per-phone keying for OTP: key = `otp:${phone}:${ip}` in addition to IP-only. Brute-force requires both IP rotation AND phone knowledge.
  4. Prefer `CF-Connecting-IP` over `x-forwarded-for` when behind Cloudflare; add trusted-proxy allowlist.
- **Effort:** M
- **Deps:** None
- **Verify:** DB killed → auth endpoints return 429 (not allowed). 1000 concurrent OTP requests from one phone → exactly 5 succeed. `x-forwarded-for: 1.2.3.4` spoofed → ignored in favor of `CF-Connecting-IP`.

### 0.9 PII crypto hardening
- **What:** Weak key derivation, silent decryption failure, no rotation path, partial field coverage.
- **Where:** `web/src/lib/pii-crypto.ts:13,22-28,76-79`
- **How:**
  1. Require 64-char hex key (32 bytes); reject otherwise (`pii-crypto.ts:22-28`).
  2. Throw on auth-tag failure instead of returning ciphertext (`:76-79`).
  3. Embed a 1-byte key-version prefix in ciphertext (`v1:iv:authTag:ciphertext`); support multiple keys via `PII_ENCRYPTION_KEY_V1`, `_V2` env vars.
  4. Build a re-encryption migration script (`scripts/reencrypt-pii.ts`) that reads V1 rows, decrypts, re-encrypts with V2.
  5. 🔀 **Decision:** expand encrypted fields to include phone, email, address, DOB, emergencyContact? (Currently only aadhaar/pan/accountNumber/ifsc/guarantor-pan.) This is a schema + migration impact — decide scope.
- **Effort:** L (especially if expanding fields)
- **Deps:** None
- **Verify:** Short key → rejected at startup. Tamper with one byte of ciphertext → decrypt throws. Rotate key → re-encryption script runs → all rows decrypt with V2.

### 0.10 `fetchHubs` auth bug + admin methods in generated client
- **What:** Flutter calls an admin endpoint from rider code; generated client ships admin write methods.
- **Where:**
  - `flutter/lib/services/voltium_api_service.dart:156` — `fetchHubs()` calls `GET /api/admin/hubs`. Either (a) move hubs to `/api/rider/hubs` or `/api/hubs` (public-ish), or (b) add a rider-accessible hub list endpoint. Verify whether `fetchHubs` is actually invoked in the pickup flow.
  - `flutter/lib/core/network/generated/api_client.dart:128-148` — strip `postAdminKyc`, `postAdminDeposits`, `postAdminTransactions`, `getAdminRiders`, `getAdminReconciliation` from the generated client (regenerate from a trimmed OpenAPI spec, or filter in `generate-client.ts`).
- **Effort:** S
- **Deps:** None
- **Verify:** Rider-authenticated `fetchHubs()` → 200 (not 401). Grep release APK for `admin/kyc` → not present.

### 0.11 Admin token as rider session — close the boundary
- **What:** `getSession` doesn't check `role`; admin bearer token is accepted by rider endpoints.
- **Where:** `web/src/lib/get-session.ts:21-39`, `web/src/lib/rider-auth.ts:8-14`
- **How:** In `requireRiderSession`, reject tokens where `role !== 'rider'` (except the explicit, audited impersonation path in `rider-auth.ts:16-50`).
- **Effort:** S
- **Deps:** None
- **Verify:** Admin bearer token → `GET /api/rider/profile` → 403. Impersonation header path still works.

---

## Phase 1 — Reliability & Integration

Before scale, after Phase 0. These prevent silent data loss and stuck-state bugs.

### 1.1 Outbox namespace unification + reaper + backoff
- **What:** 7 worker loops poll for events no producer emits; stuck PROCESSING rows never reclaimed; no backoff; `maxAttempts` ignored.
- **Where:** `web/src/server/workers/index.ts:39-80`, `web/src/lib/job-queue.ts:49-127`, `web/src/lib/outbox.ts:30-57`
- **How:**
  1. 🔀 **Decision:** either (a) unify `JOB_TYPES` and `OutboxEventTypes` into one enum and wire producers to emit the events workers poll for, or (b) delete the 7 dead worker loops and document that cron-direct invocation is the pattern. Recommend (a) — the outbox pattern is worth keeping.
  2. Add a `readyAt` column to `OutboxEvent`; claim query: `WHERE status='PENDING' AND readyAt <= now() AND attempts < maxAttempts`.
  3. On failure: `attempts++, readyAt = now() + (2^attempts × 5s), status = (attempts >= maxAttempts ? FAILED : PENDING)`.
  4. Use `attempts < "maxAttempts"` (column) not hardcoded `3` (`job-queue.ts:73`).
  5. Process batches in parallel with `Promise.allSettled` + a concurrency limiter.
  6. Add a reaper: every 5 min, `UPDATE OutboxEvent SET status='PENDING', readyAt=now() WHERE status='PROCESSING' AND updatedAt < now() - 5min`.
  7. Surface stuck-PROCESSING count in `/api/health/worker`.
  8. Wrap business write + `OutboxService.emit` in `prisma.$transaction` for transactional outbox guarantee.
- **Effort:** XL
- **Deps:** None
- **Verify:** Emit a `wallet.topup_requested` event → worker picks it up within 5s. Kill worker mid-processing → row requeued after 5 min. Health check shows stuck-PROCESSING count.

### 1.2 Real-time rider state propagation (post-pickup)
- **What:** After pickup, no polling of `lifecycleStatus`; wallet balance stale after admin deposit approval; admin suspension not reflected.
- **Where:** `flutter/lib/providers/rider_provider.dart:231-254` (poll stops at pickupDone), `flutter/lib/providers/wallet_provider.dart` (no polling), `flutter/lib/app/router.dart:118-139` (no foreground refetch)
- **How:**
  1. Extend the `rider_provider` poll to continue post-pickup at a slower rate (e.g. 60s) and read `lifecycleStatus`; stop only when `CLOSED`.
  2. Add app-lifecycle refetch: on `resumed`, call `riderProvider.refreshFromApi()` + `walletProvider.refreshTransactions()`.
  3. Wire FCM `NOTIFICATION` type handling in `fcm_service.dart:181-187` → on KYC/wallet/support FCM, call the relevant provider's `refresh()`. (Depends on 0.1 fixing FCM delivery.)
  4. In `deposit-service.ts:85-158` after crediting, call `notificationService.notifyDepositApproved(riderId)` → triggers FCM → rider wallet refetches.
- **Effort:** L
- **Deps:** 0.1 (FCM fix)
- **Verify:** Admin approves deposit → rider wallet updates within seconds (FCM) or 60s (poll). Admin suspends rider → rider app shows suspended state within 60s.

### 1.3 KYC push consistency
- **What:** KYC review route doesn't push; rider-profile edit route does. Even when pushed, FCM type `NOTIFICATION` doesn't trigger refresh.
- **Where:** `web/src/app/api/admin/kyc/route.ts:53-71`, `web/src/server/modules/kyc/kyc.repository.ts:99-120`, `web/src/server/modules/riders/admin-riders.use-cases.ts:498-500`
- **How:** In `kycRepository.approveKyc`/`rejectKyc`, call `notificationService.notifyKycStatusChange` (move the call from `admin-riders.use-cases.ts:498-500` into the repository so both surfaces push). Combined with 1.2's FCM `NOTIFICATION` handler, the rider app auto-refreshes.
- **Effort:** S
- **Deps:** 0.1, 1.2
- **Verify:** Approve KYC via the KYC review screen → rider gets FCM → rider app refetches profile → shows KYC_APPROVED.

### 1.4 Offline write queue wiring
- **What:** `pending_operations` table exists but has zero production callers; offline writes are lost.
- **Where:** `flutter/lib/services/offline_storage_service.dart:149-160`, `flutter/lib/providers/connectivity_provider.dart:28-32`
- **How:**
  1. In `ApiClient` (`api_client.dart`), on request failure due to `SocketException`/timeout, call `offlineStorage.addPendingOperation(endpoint, method, body)` instead of throwing.
  2. In `connectivity_provider.dart` on reconnect, flush `getPendingOperations()` sequentially (with idempotency keys — server-side dedup is the backstop), remove on success.
  3. Update `setPendingSyncCount` to reflect real queue depth; the shell banner (`shell_banners.dart:16`) will then show "N pending syncs".
- **Effort:** L
- **Deps:** None
- **Verify:** Rider offline → submit top-up → queued → reconnect → top-up submits automatically → balance updates. Kill app mid-flush → no duplicate (idempotency key).

### 1.5 Worker processor idempotency
- **What:** Several processors have no dedup guard; at-least-once delivery + non-idempotent = double-execution.
- **Where:** `notifications.job.ts`, `reconciliation.job.ts`, `audit-cleanup.job.ts`, `telemetry-cleanup.job.ts` (contrast with `rent-reminders.job.ts:62`, `referral-reward.job.ts:46` which do derive keys).
- **How:** Add deterministic idempotency keys to all processors (e.g. `notification:${riderId}:${eventId}`, `reconciliation:${date}`).
- **Effort:** M
- **Deps:** 1.1
- **Verify:** Inject a duplicate event → processor runs once.

### 1.6 Idempotency response-cache in-flight lock
- **What:** `checkIdempotency` then `saveIdempotency` is non-atomic; concurrent identical requests both execute.
- **Where:** `web/src/lib/idempotency.ts:28-38,66-77`
- **How:** Insert a row with `status='processing'` atomically (`INSERT ... ON CONFLICT DO NOTHING`); concurrent requests that see `processing` return 409 or poll. Update to `completed` with the response on finish. Add a TTL purge job for the DB table (expired rows only deleted lazily today).
- **Effort:** M
- **Deps:** None
- **Verify:** 2 concurrent identical `POST /api/transaction/topup` → one executes, one returns 409 or cached response.

---

## Phase 2 — CI/CD & Workflow Tooling

### 2.1 Workflow hardening (all 5 files)
- **What:** Permissions, SHA pinning, Node version, `--legacy-peer-deps`, missing `adb reverse`, smoke notification, phased tests in CI.
- **Where:** all 5 `.github/workflows/*.yml`
- **How:**
  1. Add `permissions: { contents: read }` to every workflow; escalate per-job.
  2. Pin all third-party actions to SHAs: `gitleaks/gitleaks-action@<sha>`, `subosito/flutter-action@<sha>`, `reactivecircus/android-emulator-runner@<sha>`.
  3. Standardize Node version (pick 20 or 22 — 🔀 decide) across all workflows; pin in `web/package.json` `engines`.
  4. Fix root cause of `--legacy-peer-deps` (the `eslint-config-next 16` vs `next 14` mismatch — see 4.1) and remove the flag everywhere; or add it to `ci-cd.yml` too for consistency.
  5. Add `adb reverse tcp:8081 tcp:8081` to `e2e-windows.yml:148-149` script (currently missing → Flutter E2E on Windows is broken).
  6. Remove `--with-deps` from `npx playwright install` on Windows (`e2e-windows.yml:56`).
  7. Wire the daily smoke failure notification (`daily-smoke-tests.yml:90-93`) to a real Slack/email webhook secret.
  8. Run the phased E2E suite in CI (`flutter-ci-cd.yml:217`) instead of only `app_test.dart` — use `run_phased_tests.sh`.
  9. Verify `CI_JWT_SECRET` exists in GitHub secrets (KNOWN_ISSUES says open); if not, add it or update KNOWN_ISSUES.
- **Effort:** M
- **Deps:** 4.1 (for `--legacy-peer-deps` root cause)
- **Verify:** All workflows pass on a PR. Daily smoke failure → Slack notification. Flutter CI runs the full phased suite.

### 2.2 CODEOWNERS + dependabot + branch protection
- **What:** No code ownership, no automated dep updates, no required status checks.
- **How:**
  1. Add `.github/CODEOWNERS` for `web/`, `flutter/`, `.github/`, `scripts/`, `prisma/`.
  2. Add `.github/dependabot.yml` for npm, pub, github-actions ecosystems (weekly).
  3. Enable branch protection on `main` requiring: `test`, `lint-and-typecheck`, `secret-scan`, `prisma-check`, `openapi-check`, `flutter analyze` (GitHub repo settings — not a file).
- **Effort:** S
- **Deps:** 2.1
- **Verify:** PR to main → required checks block merge until green. Dependabot opens a PR bumping a dep.

### 2.3 Workflow-coverage gates in CI + fix broken backend gate
- **What:** Gate scripts aren't in CI; backend gate references a non-existent migration; screen gate checks file existence only.
- **Where:** `scripts/check-backend-workflows.sh:12`, `scripts/check-screen-workflow-coverage.sh:90,94`, `.github/workflows/ci-cd.yml`
- **How:**
  1. Fix `check-backend-workflows.sh:12` — remove the `20260616000002_add_local_auth_rate_limit` reference or create that migration.
  2. Strengthen `check-screen-workflow-coverage.sh`: beyond `[[ -f ]]`, verify each screen is either in `AdminLayout.tsx` `sectionMap` or imported by another screen. A screen that exists but is unreachable should fail.
  3. Add both gates as jobs in `ci-cd.yml` (parallel with the other gates).
- **Effort:** M
- **Deps:** None
- **Verify:** Create an orphan screen file → gate fails. Remove the broken migration ref → `npm run check:backend-workflows` passes.

### 2.4 Orphan screens + command palette dead ends
- **What:** `EarningsManagement.tsx` unreachable; `PlanManagement.tsx` is a mock; command palette `referrals`/`faqs` dead-end.
- **Where:** `web/src/components/admin/screens/EarningsManagement.tsx`, `PlanManagement.tsx`, `web/src/components/admin/CommandPalette.tsx:57,60`, `web/src/components/admin/AdminLayout.tsx` `sectionMap`
- **How:**
  1. `EarningsManagement` → add to `sectionMap` + `role-config.ts` nav, OR delete if not needed for beta.
  2. `PlanManagement` → either wire to `/api/admin/plans` + nav, OR delete (real plan CRUD lives in `RentalManagement`). Remove from `check-screen-workflow-coverage.sh:14` required list if deleting.
  3. `CommandPalette.tsx:57` `referrals` → add `referrals` to `sectionMap`, OR change to `rewards` (where the referrals tab lives).
  4. `CommandPalette.tsx:60` `faqs` → change to `faq` (singular, to match `sectionMap` + `role-config.ts:67`).
- **Effort:** S
- **Deps:** 2.3 (so the gate catches future orphans)
- **Verify:** Command palette → "Referrals" → opens a real screen, not "coming soon". `EarningsManagement` reachable from nav.

### 2.5 Make WorkflowCoverageScreen real
- **What:** Hardcoded green checks; no backend; no tracking.
- **Where:** `web/src/components/admin/screens/WorkflowCoverageScreen.tsx:9-77,117,139`
- **How:**
  1. Add `GET /api/admin/workflow-coverage` route that checks API liveness per workflow (e.g. `GET /api/admin/kyc` returns 200 → green; route missing → red).
  2. Replace the hardcoded `adminGroups`/`riderGroups` arrays with a fetch from that route.
  3. Replace unconditional `<CheckCircle2>` with computed status (green/red/yellow).
  4. Optional: track operator visits in the Zustand store (or DB) — show "visited / not visited".
- **Effort:** M
- **Deps:** 2.4
- **Verify:** Stop the worker → WorkflowCoverageScreen shows "Background Jobs" red instead of green.

### 2.6 Automate the acceptance test
- **What:** `BACKEND_WORKFLOW_READY.md:46-62` lists a 14-step OTP→KYC→guarantor→deposit→plan→pickup→active→return→backup→restore→verify flow as a manual checklist.
- **How:** Implement as a Playwright E2E spec (`web/e2e/acceptance-flow.spec.ts`) using the admin API + rider API directly (not the Flutter app — that's covered by Flutter E2E). This is the single most valuable test to automate for beta readiness.
- **Effort:** L
- **Deps:** 0.2, 0.4, 0.6 (RBAC, validation, race fixes must land first)
- **Verify:** `npx playwright test e2e/acceptance-flow.spec.ts` → green.

### 2.7 Background Jobs admin screen
- **What:** Workflow 21 (7 scheduled jobs) has no UI; `/api/admin/reconciliation` is orphaned.
- **How:** Build a read-only `BackgroundJobsScreen.tsx` showing `OutboxEvent` status counts (PENDING/PROCESSING/FAILED), last-run timestamps, stuck-PROCESSING count. Surface `/api/admin/monitoring/dead-letter` (already exists) for retries. Add to `sectionMap` + `role-config.ts`.
- **Effort:** M
- **Deps:** 1.1 (outbox fixes)
- **Verify:** Admin opens screen → sees 7 job types with real status.

---

## Phase 3 — Architecture Migrations

Quality-gated, no calendar pressure. These reduce maintenance burden and unblock future feature work.

### 3.1 State management consolidation
- **What:** Triple state mgmt (Provider + Riverpod + dead GetIt).
- **Where:** `flutter/pubspec.yaml:19,50-51,54`, `flutter/lib/core/di/service_locator.dart` (dead), `flutter/lib/main.dart:175-199`, `flutter/lib/providers/app_provider.dart:36-251` (god composite)
- **🔀 Decision needed:** Provider (current dominant) or Riverpod (modern)? Recommend **Riverpod** — `AppProvider` god composite exists only to bridge Provider→Riverpod; migrating screens to Riverpod directly lets you delete `AppProvider`.
- **How (if Riverpod):**
  1. Delete `core/di/service_locator.dart` (dead GetIt).
  2. Migrate the 8 `ChangeNotifierProvider`s in `main.dart:176-199` to Riverpod `NotifierProvider`s.
  3. Migrate screens from `context.read<AppProvider>().rider` to `ref.watch(riderProvider)`.
  4. Delete `AppProvider` once no screens reference it.
  5. Remove `provider` from `pubspec.yaml`.
- **Effort:** XL
- **Deps:** None
- **Verify:** `grep -r "context.read<AppProvider>" flutter/lib` → 0 matches. `flutter analyze` clean.

### 3.2 Finish VoltiumApiService migration
- **What:** ~10 methods bypass the generated client and use raw string paths returning untyped Maps.
- **Where:** `flutter/lib/services/voltium_api_service.dart:45,123,189,201,205,212,222`
- **How:** For each raw method (`verifyOtp`, `deleteTransactionHistory`, `submitVehicleReturn`, `fetchRewards`, `fetchReferrals`, `syncPermissionState`, `syncDeviceData`), either (a) add the endpoint to the OpenAPI spec + regenerate the client, or (b) document why it can't be typed. Route screen→API calls through providers (17 screens currently call `VoltiumApiService()` directly).
- **Effort:** L
- **Deps:** 0.10 (strip admin methods from generated client)
- **Verify:** `grep -r "_client.post\|_client.get\|_client.delete" flutter/lib/services/voltium_api_service.dart` → 0 matches.

### 3.3 Custom router → go_router
- **What:** 28-state custom router with flow state on `State<>` fields; lost on process death; not deep-linkable.
- **Where:** `flutter/lib/app/router.dart:51-255`, `router_body.dart:1-340`, `app_state.dart:1-31`
- **How:** Migrate to `go_router` with URL state. Pickup flow fields (`_pickupHubId`, photos, etc.) move to a `PickupState` class persisted to `SecureStorage`. Delete deprecated `AuthState` values (`legal`, `privacyConsent`, `permissions`).
- **Effort:** XL
- **Deps:** 3.1 (state mgmt) — cleaner to do after Riverpod migration
- **Verify:** Deep link to `/pickup/hub/123` → opens correct screen. Kill app mid-pickup → resume at same step.

### 3.4 Hand-rolled JWT → `jose` + refresh-token rotation
- **What:** Manual HS256 JWT, no `iss`/`aud`, 7-day fixed expiry, no refresh-token flow (despite dead storage methods).
- **Where:** `web/src/lib/auth.ts:30-61`, `flutter/lib/services/secure_storage_service.dart:42-48`, `flutter/lib/core/network/api_client.dart:246-265`
- **How:**
  1. Replace `auth.ts:30-61` with `jose` library. Add `iss`/`aud` claims. Shorten access token to 1-2h; add refresh token (7d) with rotation.
  2. Wire `SecureStorageService.setRefreshToken`/`getRefreshToken` (currently dead) into `ApiClient._AuthInterceptor`: on 401, use refresh token to get a new access token, retry.
  3. Add a `/api/auth/refresh` endpoint (route exists at `api_client.dart:103` — verify it's implemented server-side).
- **Effort:** L
- **Deps:** 0.2 (RBAC revocation) — keep the `tokenVersion` mechanism
- **Verify:** 7-day session works with refresh rotation. Stolen access token expires in 1h. Stolen refresh token → one-time use, detected on reuse.

### 3.5 PBKDF2 → Argon2id
- **What:** PBKDF2-SHA256 is GPU-friendly; Argon2id is OWASP's first recommendation.
- **Where:** `web/src/lib/password.ts:8,45`
- **How:** Add `argon2` npm dep. Re-hash on next login (store both hashes during migration window; once all admins have logged in, drop PBKDF2).
- **Effort:** M
- **Deps:** None
- **Verify:** New admin → Argon2id hash. Existing admin login → migrates to Argon2id.

### 3.6 DOMPurify wiring
- **What:** `sanitizeHtml` defined but never called; rich-text fields (legal, FAQ, tickets, announcements) stored raw.
- **Where:** `web/src/lib/sanitize.ts:12`
- **How:** Apply `sanitizeHtml` to rich-text fields before storage in `legal.use-cases.ts:12-13`, FAQ, ticket, announcement use-cases. OR document that these fields must render as plain text only (current admin UI does `whitespace-pre-wrap`, which is safe).
- **Effort:** S
- **Deps:** None
- **Verify:** Submit legal content with `<script>` → stored sanitized.

---

## Phase 4 — Code Quality & Polish

### 4.1 Dependency hygiene
- **What:** Version mismatches, dead deps, unused lints.
- **Where:** `web/package.json`, `flutter/pubspec.yaml`
- **How:**
  1. Pin `eslint-config-next` to `^14.x` (currently `^16` vs `next ^14`).
  2. Remove dead deps: `@mdxeditor/editor`, `react-syntax-highlighter`, `next-auth` (if unused — verify), `react-hook-form` (if not migrating to it — see 4.3).
  3. Flutter: remove `flutter_contacts`, `call_log` (runtime-disabled stubs), `saropa_lints` (unused). Document `sqflite_android` override.
  4. Change `react`/`react-dom` to `^18.2.0` (currently pinned exact).
- **Effort:** S
- **Deps:** 4.3 (decide react-hook-form fate first)
- **Verify:** `npm ls` no warnings. `flutter pub deps` clean.

### 4.2 God-component decomposition
- **What:** 8 screens > 800 lines (DataManagement 2889, RiderManagement 2394, VehicleManagement 1263, KycManagement 1155, TicketManagement 1022, TransactionManagement 996, IncidentManagement 880, OfferManagement 808).
- **How:** Split by tab/section into sub-components. Target <500 lines per file. This is where missing-loading-state / hardcoded-data bugs hide.
- **Effort:** XL
- **Deps:** None (can do incrementally)
- **Verify:** Largest screen < 500 lines. `npm run lint --max-warnings` drops.

### 4.3 Admin UI consistency — TanStack Query + forms
- **What:** Only 5/39 screens use TanStack Query; `react-hook-form` unused; `window.queryClient` exposed in prod.
- **🔀 Decision:** adopt TanStack Query + react-hook-form across admin, OR remove the unused deps and standardize on raw `fetch` + `useState`.
- **How (if adopting):**
  1. Migrate the 34 raw-`fetch` screens to `useQuery`/`useMutation`.
  2. Migrate forms to `react-hook-form` + `zodResolver`.
  3. Gate `window.queryClient` to non-production (`providers.tsx:29-31`).
- **Effort:** XL
- **Deps:** 4.2 (easier to migrate during decomposition)
- **Verify:** `grep -r "useState.*loading" web/src/components/admin` → 0 matches. `window.queryClient` undefined in prod build.

### 4.4 Dead code sweep
- **What:** Significant dead code across both apps.
- **Where (web):** `contract-consistency.test.ts` (tautological), orphan API routes (`/api/admin/cache/invalidate`, `/api/admin/events` if unused), `next-auth` (if unused)
- **Where (flutter):** `service_locator.dart`, `crash_reporter.dart`, `pinned_http_client.dart` (after 0.7 wires it), `RiderProvider.routeAfterLogin`, `lib/screens/` shims, `notifyMandatoryUpdate`/`notifyWalletBalanceLow` (no callers)
- **How:** Delete or wire up. Replace `contract-consistency.test.ts` with real Zod `.safeParse()` assertions.
- **Effort:** M
- **Deps:** 0.7, 3.1, 3.2
- **Verify:** `flutter analyze` dead-code warnings clear. Bundle size drops.

### 4.5 Crash reporting + observability
- **What:** No Sentry/Crashlytics; APM is in-process avg-only; correlation IDs use `Math.random`.
- **Where:** `flutter/lib/services/crash_reporter.dart:55,73`, `flutter/lib/services/monitoring_service.dart`, `web/src/lib/apm.ts`, `web/src/lib/correlation-id.ts:24-26`
- **How:**
  1. 🔀 **Decision:** Sentry or Firebase Crashlytics? (Crashlytics aligns with the Firebase dep already present.)
  2. Wire `CrashReporter`/`MonitoringService` to the chosen service.
  3. Add p50/p95/p99 percentiles to `apm.ts`; export Prometheus textfile format for laptop mode.
  4. Replace `Math.random` correlation IDs with `crypto.randomUUID()`.
- **Effort:** L
- **Deps:** 0.7 (Firebase config)
- **Verify:** Trigger a crash in release build → appears in Crashlytics/Sentry dashboard.

### 4.6 Accessibility
- **What:** No skip-link; `userScalable: false`; no contrast audit.
- **Where:** `web/src/app/layout.tsx:40`, `web/src/components/admin/AdminLayout.tsx`
- **How:** Add skip-to-content link. Remove `userScalable: false`. Audit color contrast (WCAG 2.2 AA). Ensure every `DialogContent` has a `DialogTitle`.
- **Effort:** M
- **Deps:** None
- **Verify:** axe-core scan → 0 violations. Keyboard-only nav reaches all content.

### 4.7 Lint ratchet
- **What:** `--max-warnings 800` is extremely high; Flutter `analysis_options.yaml` excludes test code.
- **Where:** `web/package.json:10`, `flutter/analysis_options.yaml:8-9`
- **How:** Capture current warning count, set threshold just below it, ratchet down weekly (-50). Remove `test/**` / `integration_test/**` excludes in Flutter; fix violations incrementally.
- **Effort:** Ongoing M
- **Deps:** 4.4 (dead code removal drops count)
- **Verify:** Lint threshold enforces downward trend.

---

## Phase 5 — Documentation & Drift

### 5.1 Fix documentation drift
- **What:** AGENTS.md wrong test counts, wrong duplicate IDs, references non-existent `.zscripts/`; README references `.env.local.example` (doesn't exist); KNOWN_ISSUES marks FCM as "Fixed" but it's broken.
- **Where:** `AGENTS.md`, `README.md`, `docs/KNOWN_ISSUES.md`
- **How:** Re-run suites, update counts. Remove `.zscripts/` section from AGENTS.md. Fix README env filename reference. Update KNOWN_ISSUES FCM row to reflect 0.1's fix once landed.
- **Effort:** S
- **Deps:** 0.1 (FCM fix), 4.4 (dead code changes counts)
- **Verify:** AGENTS.md test count matches actual file count.

### 5.2 Migration policy
- **What:** Only 2 migrations for 49 tables; no expand/contract convention; no rollback policy.
- **How:** Write `docs/MIGRATION_POLICY.md` covering expand/contract, rollback, review checklist, "never `db push` in prod". Start using `prisma migrate dev --create-only` for schema changes. Add a CI gate that rejects migrations with `DROP COLUMN`/`DROP TABLE` without a prior expand migration.
- **Effort:** M
- **Deps:** None
- **Verify:** First post-policy migration follows expand/contract.

### 5.3 Track `.env.example` + onboarding fixes
- **What:** `.env.example` not tracked; README references non-existent `.env.local.example`.
- **Where:** `web/.env.example` (exists, untracked), `README.md:166`
- **How:** `git add web/.env.example`. Fix README to reference `.env.example`.
- **Effort:** S
- **Deps:** None
- **Verify:** Fresh clone → `cp web/.env.example web/.env` works.

### 5.4 Repo hygiene sweep
- **What:** Tracked junk (`scratch-probe.ts`, `check_web_errors.js`), untracked junk (`nul`, `*.zip`, debug screenshots), duplicate `graphify-out/`.
- **How:** `git rm web/scratch-probe.ts check_web_errors.js`. Delete working-tree junk. Pick one `graphify-out/` (root). Remove `nul`.
- **Effort:** S
- **Deps:** None
- **Verify:** `git status` clean. `git ls-files | grep -E "scratch|probe|nul"` → empty.

---

## Dependency Graph

```
Phase 0 (security blockers) — all independent except:
  0.7 (Flutter security) depends on 0.1 (FCM) for verification
  0.10 (fetchHubs) — independent

Phase 1 (reliability):
  1.1 (outbox) — independent
  1.2 (rider state) depends on 0.1 (FCM fix)
  1.3 (KYC push) depends on 0.1, 1.2
  1.5 (processor idempotency) depends on 1.1

Phase 2 (CI/CD):
  2.1 (workflow hardening) depends on 4.1 (dep hygiene) for --legacy-peer-deps
  2.2 (CODEOWNERS) depends on 2.1
  2.4 (orphans) depends on 2.3 (gates)
  2.6 (acceptance test) depends on 0.2, 0.4, 0.6

Phase 3 (architecture):
  3.1 (state mgmt) — independent
  3.2 (api service) depends on 0.10
  3.3 (router) depends on 3.1
  3.4 (JWT) depends on 0.2

Phase 4 (polish):
  4.1 (deps) depends on 4.3 (forms decision)
  4.2 (god components) — independent, incremental
  4.3 (admin UI) depends on 4.2
  4.4 (dead code) depends on 0.7, 3.1, 3.2
  4.5 (crash reporting) depends on 0.7

Phase 5 (docs):
  5.1 (drift) depends on 0.1, 4.4
  5.2, 5.3, 5.4 — independent
```

---

## Decision Points Requiring Your Input

| # | Decision | Context | Recommendation |
|---|---|---|---|
| 🔀 A | Cert pinning scope | Pin to prod TLS fingerprints? Dev disable? | Pin prod only; dev behind `kDebugMode` |
| 🔀 B | Firebase config injection | CI-inject real `google-services.json`? | Yes — add as base64 secret like the keystore |
| 🔀 C | PII field expansion | Encrypt phone/email/address/DOB too? | Yes for beta — phone+email+address minimum |
| 🔀 D | Outbox strategy | Unify namespaces (keep outbox) or delete dead workers? | Unify — the pattern is worth keeping |
| 🔀 E | State management | Provider or Riverpod? | Riverpod (lets you delete `AppProvider`) |
| 🔀 F | Admin UI strategy | Adopt TanStack Query + react-hook-form, or remove deps? | Adopt (infra is there, just unused) |
| 🔀 G | Crash reporting | Sentry or Firebase Crashlytics? | Crashlytics (aligns with existing Firebase dep) |
| 🔀 H | Node version | 20 or 22? | 20 LTS (until 22 LTS is validated with Next 14) |

---

## Suggested Execution Order

If I were sequencing this work, I'd batch by dependency, not strictly by phase:

1. **Sprint 1 — Phase 0 security blockers:** 0.1 (FCM), 0.2 (RBAC), 0.3 (audit logs), 0.4 (admin validation), 0.5 (next.config), 0.6 (race), 0.8 (rate limit), 0.9 (PII), 0.10 (fetchHubs), 0.11 (admin token). All independent except 0.7 depends on 0.1 for verification.
2. **Sprint 2 — Phase 0.7 (Flutter security) + Phase 1 reliability:** 0.7, then 1.1 (outbox), 1.2 (rider state), 1.3 (KYC push), 1.4 (offline queue), 1.5 (idempotency), 1.6 (idempotency lock).
3. **Sprint 3 — Phase 2 CI/CD:** 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, then 2.6 (acceptance test — needs 0.x fixes landed).
4. **Sprint 4+ — Phase 3 architecture (incremental):** 3.1 (state mgmt), 3.2 (api service), 3.4 (JWT), 3.5 (Argon2), 3.6 (DOMPurify). 3.3 (router) last.
5. **Sprint 5+ — Phase 4 polish + Phase 5 docs:** 4.1, 4.4, 5.1, 5.3, 5.4 (quick wins), then 4.2/4.3 (god components + UI consistency — incremental), 4.5/4.6/4.7, 5.2.
