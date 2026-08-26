# Phase 1 BLOCKERs Audit — 2026-06-28

## Goal
Resolve all 5 BLOCKERs in the admin->rider FCM pipeline so the
deployed app can deliver admin actions (KYC approval, topup
approval/rejection, ticket replies, device lock/unlock) to the
rider device.

## Commits (oldest -> newest, on `fix/phase1-critical-blockers`)

| # | SHA | Subject | BLOCKER |
|---|---|---|---|
| 1 | `ceeacb3` | fix(1.1): persist FCM command secret on the device after verify-OTP | 1.1 |
| 2 | `f7fea8d` | fix(1.2): FCM token registration derives riderId from session | 1.2 |
| 3 | `b6dae0b` | feat(1.3): env-driven Firebase config | 1.3 |
| 4 | `c56b3a6` | fix(1.4): split outbox NOTIFICATION_SEND worker from daily engagement | 1.4 |
| 5 | `c738501` | fix(1.5): re-set rider session cookie on token refresh | 1.5 |
| 6 | `8bb0b43` | fix(1.4): type-narrow overlay extra and hoist refresh test mocks | cleanup |

## Per-commit audit

### 1. `ceeacb3` - FCM secret persistence (BLOCKER 1.1)

**What was broken:** `_validateSecurityEnvelope` returned false for every
FCM because `secureStorage.readFcmCommandSecret()` returned null.
The HMAC infra (server side: fcm.ts:80-155; client side:
fcm_service.dart:68-135) was complete and correct, but the secret
was never persisted to the device.

**Why it slipped:** `SecureStorageService.writeFcmCommandSecret` was
defined but had zero call sites in the codebase. The verify-OTP
response includes `fcmCommandSecret` (server side, auth.use-cases.ts
line ~186) but the client silently dropped it.

**Fix:**
- `flutter/lib/core/network/generated/api_models.dart:132-148` -
  `VerifyOtpResponse.toJson()` now includes `fcmCommandSecret` (was
  being silently dropped).
- `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart:144-153` -
  `writeFcmCommandSecret` called after `setToken` in `_handleVerify`,
  gated on `!PlatformInfo.isWeb` (FCM is mobile-only).
- `flutter/lib/features/auth/data/repository_impl.dart:22-32` -
  same write call in the clean-architecture path.
- `flutter/test/secure_storage_service_test.dart` - new unit test.
- `SECRET_ROTATION_CHECKLIST.md` - FCM_COMMAND_HMAC_SECRET rotation
  entry with rationale and steps.

**Acceptance:** `grep -r writeFcmCommandSecret flutter/lib` returns
>=2 call sites. After login, `_getCommandHmacSecret()` returns the
server's value. SECURITY_COMMAND messages pass HMAC validation.

### 2. `f7fea8d` - FCM token registration body (BLOCKER 1.2)

**What was broken:** Flutter posted `{token: '<fcm_token>'}` to
`/api/riders/register-token`. The validator required
`{riderId, fcmToken}`. Every request 422'd, leaving `Rider.fcmToken`
null in the database. Every `notificationService.createAndSend`
short-circuited to `{success: true, warning: 'Rider has no FCM token'}`.

**Why it slipped:** The body field name was `token` in the Flutter
client, but `fcmToken` in the validator. Different teams touched
the two sides and never reconciled.

**Fix:**
- `web/src/lib/validators.ts:407-409` - `registerTokenSchema` is now
  just `{fcmToken: string().min(1)}`. `riderId` is no longer in the
  body schema.
- `web/src/app/api/riders/register-token/route.ts` - reads `riderDbId`
  from `getRiderId(req)` (the verified session) and passes it to
  `riderUseCases.registerFcmToken`.
- `web/src/server/modules/riders/rider.use-cases.ts:251-258` - param
  renamed to `riderDbId` to make the contract explicit.
- `flutter/lib/features/profile/data/repository_impl.dart:41-44` -
  posts `{fcmToken: '...'}` (was `{token: '...'}`).
- `web/src/contracts/openapi.{ts,json}` - schema updated to
  `{fcmToken: string}` with `required: [fcmToken]`, 401/404 responses.
- `web/tests/unit/validators.test.ts` - 4 new test cases.

**Acceptance:** Prisma `SELECT fcmToken FROM "Rider" WHERE phone='...'`
returns a non-null value after the rider's first login.

### 3. `b6dae0b` - Env-driven Firebase config (BLOCKER 1.3)

**What was broken:** `flutter/lib/firebase_options.dart` shipped
hardcoded dummy credentials (e.g.
`AIzaSyDummyApiKeyForVoltiumRiderAndroidApp`). `Firebase.initializeApp`
silently fell back to a non-existent Firebase project. Even with
BLOCKER 1.1+1.2 fixed, no FCM token could ever be delivered.

**Why it slipped:** the legacy CI flow (`GOOGLE_SERVICES_JSON_BASE64`
+ `FIREBASE_OPTIONS_DART_BASE64`) was documented as the way to
inject real credentials, but the file was checked in with dummies
as a "default". The dummy default meant staging/prod also ran with
dummies unless someone manually replaced the file.

**Fix:**
- `flutter/lib/core/firebase/firebase_config.dart` (new) -
  `FirebaseConfig.android` / `.ios` getters read 9 keys via
  `String.fromEnvironment`. Throws `MissingFirebaseConfigException`
  naming the missing key. No defaults.
- `flutter/lib/firebase_options.dart` - rewritten as a thin shim
  that delegates to `FirebaseConfig`. Existing imports of
  `DefaultFirebaseOptions.currentPlatform` keep working.
- `flutter/.env.example` (new) - 9 keys documented.
- `flutter/scripts/build-web-with-env.sh` (new) - reads `flutter/.env`,
  validates all 9 keys are non-empty, invokes
  `flutter build web --release --base-href "/rider-app/"` with
  `--dart-define=KEY=VALUE` for each.
- `flutter/FIREBASE_SETUP.md` - rewritten for the env-driven flow.

**Acceptance:** Build without `.env` fails fast at app startup with
`MissingFirebaseConfigException: FIREBASE_API_KEY_ANDROID is
required`. Build with `.env` succeeds. The legacy base64 secret path
is marked deprecated.

### 4. `c56b3a6` - Outbox worker split (BLOCKER 1.4)

**What was broken:** The OutboxEventTypes.NOTIFICATION_SEND event
was wired to `notificationsJob.process` — the daily
birthday/payment/referral reminder worker. That worker:
1. Had a daily idempotency lock (`notifications:daily:<YYYY-MM-DD>`).
2. Hard-coded three sweeps (birthdays, payment reminders, referral
   leaderboard).
3. **Never read the `payload` of the event.**

KYC and topup events were enqueued, but the worker ignored their
payload and ran only once per day. The actual push only worked
because use-cases also called `notificationService.notifyXxx`
synchronously in the request handler. If that call failed (FCM
Admin SDK down, network blip), the OutboxEvent was orphaned and
never replayed.

**Fix:**
- `web/src/server/workers/jobs/notification-dispatch.job.ts` (new) -
  per-event dispatcher. Reads `payload.type` and routes to the
  matching domain notification. Unknown types are logged and acked.
  No daily idempotency lock.
- `web/src/server/workers/jobs/daily-engagement.job.ts` (new) - the
  old birthday/payment sweep, moved here. Fires at 06:00 IST per
  user decision (vs the previous misleading UI label of
  "Sun 03:00 IST"). Idempotency key is `daily_engagement:YYYY-MM-DD`
  in IST.
- `web/src/server/workers/outbox.ts:48` - added
  `OutboxEventTypes.DAILY_ENGAGEMENT`.
- `web/src/server/workers/index.ts`:
  - NOTIFICATION_SEND -> `notificationDispatchJob.process`
  - DAILY_ENGAGEMENT  -> `dailyEngagementJob.process`
  - New scheduled task `daily-engagement-emitter` that emits the
    DAILY_ENGAGEMENT event at 06:00 IST (checks every minute; only
    fires when `msUntilNext0600IST()` returns <= 60s).
  - Tombstone comment for `notifications.job.ts` (kept for one
    release; delete in next cleanup pass).
- `web/src/app/api/admin/jobs/route.ts` - `daily-engagement` listed
  and admin-triggerable for testing.
- `web/src/components/admin/screens/BackgroundJobsScreen.tsx` -
  Bell icon for the new card.
- `web/tests/unit/notification-dispatch.test.ts` (new) - 8 cases.
- `web/tests/unit/daily-engagement.test.ts` (new) - 4 cases.

**Acceptance:** Admin approves KYC -> NOTIFICATION_SEND event
emitted. OutboxEventType=NOTIFICATION_SEND row in PENDING -> picked
up by `notificationDispatchJob` (was picked up by `notificationsJob`
which ignored the payload). At 06:00 IST: DAILY_ENGAGEMENT row
appears, processed by `dailyEngagementJob`.

### 5. `c738501` - Token refresh cookie re-set (BLOCKER 1.5)

**What was broken:** `/api/auth/refresh` incremented `tokenVersion`
and returned a new access token in the JSON body, but did not
re-set the `voltium-session` cookie. On Flutter Web served at
`/rider-app/`, the next browser request sent the now-revoked
cookie and got 401. Mobile apps were unaffected because they use
the `Authorization: Bearer` header from the body.

The `/api/admin/auth/refresh` route already did this correctly.
This change brings the rider refresh route to parity.

**Fix:**
- `web/src/app/api/auth/refresh/route.ts` - capture the `success()`
  return as a NextResponse, call
  `response.cookies.set(SESSION_COOKIE_NAME, newToken, SESSION_COOKIE_OPTIONS)`,
  and return that.
- `web/tests/unit/auth-refresh.test.ts` (new) - 4 cases.

**Acceptance:** Flutter Web rider, refresh, next page navigation
succeeds without 401. `curl -i -X POST /api/auth/refresh` returns
`Set-Cookie: voltium-session=...; HttpOnly` in addition to the JSON
body.

### 6. `8bb0b43` - Cleanup: type narrowing and hoisted mocks

**What was fixed:**
- `web/src/server/workers/jobs/notification-dispatch.job.ts`:
  the `extra` Record<string, string> passed to
  `fcmService.sendOverlayTrigger` was inferred as a union with
  optional `url?` / `balance?` keys, which did not match the
  parameter's type. Annotated the local to narrow correctly. No
  behavior change.
- `web/tests/unit/auth-refresh.test.ts`: replaced top-level
  `const mockX = vi.fn()` declarations with a `vi.hoisted(() => ...)`
  block. Vitest hoists `vi.mock(...)` factories above top-level
  imports, so any top-level const referenced inside the factory
  was accessed before initialization, throwing
  `ReferenceError: Cannot access 'mockRider' before initialization`.
  All 4 auth-refresh tests now pass reliably.

## Phase 1 Exit Gate

- [x] All 5 BLOCKERs (1.1-1.5) green
- [x] `npm run typecheck` passes
- [x] New unit tests pass (4 + 8 + 4 = 16 new tests)
- [x] No new test regressions vs `43a6354` baseline
- [x] `KNOWN_ISSUES.md` updated with Phase 1 resolutions
- [x] `SECRET_ROTATION_CHECKLIST.md` updated with FCM rotation
- [ ] **Post-deploy: rotate FCM_COMMAND_HMAC_SECRET** (per checklist)
- [ ] **Post-deploy: provide real Firebase env values to CI**

## Open items that block Phase 2

1. The 5 hand-written additions to `flutter/lib/core/network/generated/api_*.dart`
   (`postAuthRefresh`, `getRiderHubs`, `postRiderDevicePermissions`,
   `postRiderRentalReturn`, `getRiderDevice`, `deleteTransactionHistoryEndpoint`)
   were committed in Phase 0. They will be erased by the next OpenAPI
   regen unless Phase 2.2 (expand OpenAPI to 123 routes) lands first.
2. `flutter/lib/core/network/pinned_http_client.dart` is a TODO stub
   (TLS pinning not actually implemented). Plan deferred to a
   separate security ticket.
3. `flutter/lib/router/app_router.dart` and `flutter/lib/app/app_shell.dart`
   are unused alternate implementations (GoRouter + rich AppShell).
   Plan deferred to a follow-up.
4. `.husky/pre-commit` runs `npx lint-staged` but `lint-staged` is
   not installed in `web/package.json`. Would fail in any future
   commit that triggers the hook. Flagged for follow-up.

## Next Phase

Phase 2 - HIGH: Contracts, Enums, and Contract Drift (2.1 OpenAPI
audit tool, 2.2 expand to 123 routes manual, 2.3 generator path fix,
2.4 regen, 2.5 enum fixes, 2.6 missing Rider fields, 2.7 KYC
notification dedupe).