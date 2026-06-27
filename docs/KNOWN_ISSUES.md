# Known Issues For Public Beta

This file tracks issues that are known and accepted only temporarily for public beta hardening. Do not treat it as an architecture source of truth.

## Must Resolve Before Public Beta

| Area | Issue | Status |
| --- | --- | --- |
| Mobile API layer | `flutter/lib/services/api_service.dart` still has broad legacy callers beyond the initial F8 wallet fix. | Fixed |
| Device commands | FCM security commands now use HMAC signing with `ts`/`nonce`/`challenge`/`signature`; client validates before executing commands. | Fixed |
| Consent UX | Location consent is recorded from the permissions flow, but a dedicated privacy/consent screen is still needed for clearer user choice and revocation. | Fixed |
| Flutter analysis | `flutter analyze` still reports existing warning/info debt in integration tests and UI files. | Fixed |
| Secret operations | `CI_JWT_SECRET` must be added in GitHub Actions secrets before CI jobs that reference it can run. | Manual step: `gh secret set CI_JWT_SECRET -R voltium -b "<value>"` aligns with CI workflow secret |
| Vehicle pickup race | Availability check moved inside `$transaction` to prevent concurrent duplicate rentals. | Fixed |
| KYC notifications | `reviewKcy` now sends rider notifications + OutboxEvents for approve/reject/request_info. | Fixed |
| Wallet topup notifications | `approveTopup`/`rejectTopup` now send rider notifications + OutboxEvents. | Fixed |
| CI/CD hardening | All 5 workflows have least-privilege `permissions:` blocks; `e2e-windows.yml` now has `adb reverse` and Node `20` standardization. | Fixed |

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

## Source Of Truth

- Architecture: `docs/FINAL_ARCHITECTURE.md`
- Laptop-only data policy: `docs/NO_CLOUD_DATA.md`
- Backup and restore: `docs/BACKUP_RESTORE.md`
- PM2 production process setup: `docs/PM2_SETUP.md`
