# Changelog

All notable changes to the Voltium project will be documented in this file.

## [0.2.0-rc.1] - 2026-05-07

### 🛡️ Security (Phase 4)

- **Privilege Escalation Protection**: Implemented strict RBAC enforcement across all administrative endpoints. Verified that Rider tokens are correctly rejected by `/api/admin/*`.
- **PII Leak Prevention**: Masked Aadhaar and PAN numbers in rider profile responses (showing only last 4 digits).
- **Log Privacy**: Added recursive PII masking to backend logs to prevent accidental exposure of sensitive data in audit trails.
- **Auth Standardization**: Migrated referral APIs to use unified session extraction logic, resolving authentication inconsistencies.

### ⏱️ Monitoring & Stability (Phase 5)

- **Error Tracking**: Integrated PostHog into the Flutter application for real-time crash reporting and non-fatal error tracking. NET-003 (audit batch 20, 2026-09-02): the original changelog mentioned Sentry; this was corrected to PostHog to match `docs/NO_CLOUD_DATA.md:21` which lists Sentry as a "NOT Allowed" error-tracking vendor under the laptop-only architecture. The codebase never used Sentry — `monitoring_service.dart:2, 16, 26, 28` (PR-11, 2026-08-21) wraps PostHog as the canonical vendor.
- **Performance Metrics**: Implemented `PerformanceService` to measure screen load times and initialization durations.
- **Daily Smoke Tests**: Configured a scheduled GitHub Action to validate critical user flows (Auth, Wallet, Rental) every morning.
- **Breadcrumbs**: Instrumented `ApiService` and `OfflineStorageService` with diagnostic breadcrumbs for improved production debugging.

### 🛠️ Fixed

- Fixed an issue in `send-otp` where rate-limit events were not being logged for security auditing.
- Resolved a bug in the referrals route that caused `401 Unauthorized` errors for valid riders.
