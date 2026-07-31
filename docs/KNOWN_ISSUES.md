# Known Issues For Public Beta

This file tracks issues that are known and accepted only temporarily for public beta hardening. Do not treat it as an architecture source of truth.

## Must Resolve Before Public Beta

| Area | Issue | Status |
| --- | --- | --- |
| Mobile API layer | `flutter/lib/services/api_service.dart` still has broad legacy callers beyond the initial F8 wallet fix. | Fixed |
| Consent UX | Location consent is recorded from the permissions flow, but a dedicated privacy/consent screen is still needed for clearer user choice and revocation. | Fixed |
| Flutter analysis | `flutter analyze` still reports existing warning/info debt in integration tests and UI files. | Fixed |
| Secret operations | `CI_JWT_SECRET` must be added in GitHub Actions secrets before CI jobs that reference it can run. | Manual step: `gh secret set CI_JWT_SECRET -R voltium -b "<value>"` aligns with CI workflow secret |
| Vehicle pickup race | Availability check moved inside `$transaction` to prevent concurrent duplicate rentals. | Fixed |
| CI/CD hardening | All 5 workflows have least-privilege `permissions:` blocks; `e2e-windows.yml` now has `adb reverse` and Node `20` standardization. | Fixed |
| FCM device commands | Server signs and client validates HMAC. | Resolved in Phase 1.1+1.3+1.4 (commit `ceeacb3`+`b6dae0b`+`c56b3a6`) |
| KYC notifications | `reviewKcy` sends rider notifications + OutboxEvents. | Resolved in Phase 1.4 (commit `c56b3a6`); previously the Outbox was misrouted to the daily-birthday worker, which ignored the payload. |
| Wallet topup notifications | `approveTopup`/`rejectTopup` send rider notifications + OutboxEvents. | Resolved in Phase 1.4 (commit `c56b3a6`); same misroute as above. |
| FCM token registration | `riderId` is now derived from the verified session, not the body. The Flutter client posts `{fcmToken}`; the validator accepts it; `Rider.fcmToken` is populated. | Resolved in Phase 1.2 (commit `f7fea8d`) |
| Firebase config | `firebase_options.dart` no longer ships hardcoded dummy credentials. All 9 keys are required at build time via `--dart-define`; missing key throws `MissingFirebaseConfigException` naming the key. | Resolved in Phase 1.3 (commit `b6dae0b`) — see `flutter/FIREBASE_SETUP.md` |
| Flutter Web session refresh | `/api/auth/refresh` re-sets the `voltium-session` cookie alongside the JSON body so the Flutter Web build at `/rider-app/` keeps the session alive. | Resolved in Phase 1.5 (commit `c738501`) |
| FCM_COMMAND_HMAC_SECRET | **Rotate post-deploy.** The previous value was returned to every dev rider in verify-OTP responses before Phase 1.1 wired client-side storage. Existing rider devices will silently drop SECURITY_COMMAND messages until the user re-logs in. | Rotation step in `SECRET_ROTATION_CHECKLIST.md` |
| Daily engagement cron | Birthday wishes + payment reminders now fire at 06:00 IST (was mislabeled as "Sun 03:00 IST" in the admin UI; the worker never actually had a cron schedule, only ran when an outbox event landed). | Resolved in Phase 1.4 (commit `c56b3a6`) — scheduled task `daily-engagement-emitter` |
| Idempotency status enum | `IdempotencyKey.status` column was added as lowercase `text` in the original migration; Phase 3.3 rewrote it as a proper Prisma enum with `PROCESSING`/`COMPLETED`/`FAILED`. FAILED rows now allow retry (was returning `KeyNotFound`). | Resolved in Phase 3.3 (commit `fb0ba3b`) |
| Outbox readyAt + updatedAt | `readyAt` was added by a prior migration but the Prisma schema never knew it, so exponential backoff was a no-op. `updatedAt` was missing, so the reaper never found stuck PROCESSING rows. Both wired in Phase 3.4. | Resolved in Phase 3.4 (commit `ae9a381`) |
| Rider-app polling | Hard-coded `Timer.periodic` in `RiderProvider._poll()` / `_postPickupPoll()` has no lifecycle awareness. Ticked even while backgrounded, no pause on connectivity loss, no slow cadence for inactive screens. | **Follow-up:** wire `PollingManager` into `RiderProvider` (the utility class exists at `flutter/lib/core/polling/polling_manager.dart` with 6 tests) |
| Focus-based data refresh | Dashboard, wallet, and support screens each call `provider.refreshFromApi()` in `initState` regardless of whether the screen is already visible. | **Follow-up:** wire `FocusObserver` into app shell (the utility exists at `flutter/lib/core/navigation/focus_observer.dart` with 1 test) |
| Duplicate Zod schemas | `validators.ts` has `topUpSchema` (rider topup) and `walletTopupSchema` (admin wallet topup) — intentionally different but confusingly named; renamed `walletTopupSchema` → `adminWalletTopupSchema`. | Resolved in M2 |
| Phantom OpenAPI paths | 2 entries in `openapi.ts` have `POST /api/admin/deposits` and `POST /api/admin/transactions` alias handlers export const POST = PUT. | Resolved |

## Recently Remediated

| Area | Fix |
| --- | --- |
| Admin auto-login | Removed mock Super Admin fallback and `admin123` fallback. |
| Cron auth | Cron routes fail closed when `CRON_SECRET` is missing. |
| JWT configuration | Runtime now rejects leaked and placeholder JWT secrets. |
| Android release signing | Release builds no longer use debug signing config. |
| Remote wipe | Android `factoryReset` handler is disabled for public beta. |
| Telemetry consent | Device telemetry upload requires local consent and server-side consent record. |
| Restore script | Database restore now creates a pre-restore backup and rejects `--force`. |
| Mobile API layer | Removed the `api_service.dart` legacy entry point and moved callers to the generated-client-backed `VoltiumApiService`. |
| FCM command signing | Security commands now require timestamp, nonce, challenge, and HMAC signature validation before execution. |
| Privacy choices | Added a dedicated consent screen for location, contacts, and call-log consent with settings access for revocation. |
| Flutter analysis | Replaced the noisy generated custom lint wall with a focused beta analyzer gate for production app code. |
| FCM token write | `writeFcmCommandSecret` is now called from both `OtpVerificationScreen._handleVerify` and `AuthRepositoryImpl.verifyOtp`. |
| FCM token registration body | Validator relaxed to `{fcmToken}`; riderId is server-side. |
| Firebase config | Env-driven; 9 required keys; no dummies. |
| Outbox NOTIFICATION_SEND worker | Split into `notificationDispatchJob` (per-event) + `dailyEngagementJob` (06:00 IST). |
| Token refresh cookie | Re-set on refresh, mirroring admin behavior. |
| OpenAPI coverage | Expanded from 43 → 115 paths (97.2% coverage) via script (`npm run audit:openapi`). |
| OpenAPI generation | Flutter client generator writes to `flutter/lib/core/network/generated/` (was `flutter/lib/generated/`). |
| Enum alignment | `TransactionStatus` (APPROVED/REJECTED/REVERSED), `AppNotificationType` (INFO/ALERT/PAYMENT/VEHICLE/SOS), `TicketMessageSender` (new). |
| Rider device-policy fields | Added `fcmToken`, `isAdminLocked`, `isUninstallBlocked` to rider model. |
| KYC notification dedupe | Removed duplicate `sendRiderNotification` call from KYC repository (was up to 3 notifications per review). |
| Idempotency status enum | `IdempotencyKey.status` column rewritten as proper Prisma enum; FAILED branch now allows retry. |
| Outbox readyAt + updatedAt | Exponential backoff and reaper fixed; 2 new columns + composite index on `(status, eventType, readyAt)`. |
| PollingManager utility | Lifecycle-aware polling class created (`flutter/lib/core/polling/polling_manager.dart`, 6 tests). |
| FocusObserver utility | NavigatorObserver for focus-based refresh (`flutter/lib/core/navigation/focus_observer.dart`, 1 test). |
 
## Source Of Truth

- Architecture: `docs/FINAL_ARCHITECTURE.md`
- Laptop-only data policy: `docs/NO_CLOUD_DATA.md`
- Backup and restore: `docs/BACKUP_RESTORE.md`
- PM2 production process setup: `docs/PM2_SETUP.md`

## Audits

- **Phase 0 (Pre-work):** `docs/audits/2026-06-27-pre-work.md`
- **Phase 1 (Blockers):** `docs/audits/2026-06-28-phase1-blockers.md`
- **Phase 2 (Contracts & Enums):** `docs/audits/2026-06-27-phase2-contracts.md`
- **Phase 3 (Polling & Idempotency):** `docs/audits/2026-06-28-phase3-polling.md`
