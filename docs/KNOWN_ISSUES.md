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

## Source Of Truth

- Architecture: `docs/FINAL_ARCHITECTURE.md`
- Laptop-only data policy: `docs/NO_CLOUD_DATA.md`
- Backup and restore: `docs/BACKUP_RESTORE.md`
- PM2 production process setup: `docs/PM2_SETUP.md`

## Phase 1 Audit

See `docs/audits/2026-06-28-phase1-blockers.md` for the per-commit audit
of the BLOCKERs (1.1-1.5) and Phase 0 pre-work.
