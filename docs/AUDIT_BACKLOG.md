# Audit Backlog — Tracked Findings

Every audit finding (2026-08-21 → 2026-08-23 cycles) is tracked here. Commit
messages must reference the ticket ID. Status: OPEN / FIXED / WONTFIX(reason).

## Flutter — screens/router/network round

| ID | Severity | Area | Summary | Status |
|---|---|---|---|---|
| FL-P0-SOS | P0 | device_compliance | SOS cancel didn't cancel; dial blocked behind network; bricked in-flight flag | FIXED |
| FL-P0-EDIT | P0 | profile | `_phoneController` LateInitError; guarantor OTP gate always re-verify | FIXED |
| FL-P0-PERM | P0 | onboarding | Web crash (`_entryCtrl`); permission revoke bypassed gate | FIXED |
| FL-P1-ROUTER | P1 | app | Dual state machine desync; zombie pushed routes; suspended shield; receipt amount | FIXED (write-through + popUntil + shield exemption) |
| FL-P1-HUB | P1 | workflows | Workflow Hub unguarded side door | FIXED (lifecycle-gated sections) |
| FL-P1-TLS | P1→P0 | network | Pinning fail-open for validly-chained certs | FIXED (trust-nothing mode) |
| FL-P1-IDEM | P1 | network | Offline queue dropped caller idempotency key | FIXED (threaded + always-key) |
| FL-P1-PUTRAW | P1 | network | Bearer token sent cross-origin on putRaw | FIXED |
| FL-P1-LOGOUT | P1 | core/state | notificationProvider/photoUpload/devicePolicy survived logout | FIXED |
| FL-P2-* | P2 | widgets/screens | ~80 items: a11y Semantics/48dp, shimmer tickers, paise display, dead code, i18n | PARTIAL — see testing backlog |

## Admin API — N-series round

| ID | Severity | Summary | Status |
|---|---|---|---|
| ADMIN-N1 | P0 | Universal '111111' master OTP env gate | FIXED |
| ADMIN-N2 | P1 | DB rate-limit buckets never reset | FIXED |
| ADMIN-N3 | P1 | Backup root path containment | FIXED |
| ADMIN-N4 | P1 | BACKUP_ROOT env mutation race | FIXED |
| ADMIN-N5 | P1 | RBAC string-vs-object semantics | FIXED (101 sites) |
| ADMIN-N6 | P1 | Permission-key typos compile silently | FIXED (typed matrix) |
| ADMIN-N7 | P1 | Unvalidated bodies incl. money math | FIXED (deposits/bulk/plan) |
| ADMIN-N8 | P1 | Impersonation headers fail-open | FIXED |
| ADMIN-N9 | P1 | CORS localhost reflection all envs | FIXED |
| ADMIN-N10 | P1 | Maintenance cookie-presence bypass | FIXED (JWT verified) |
| ADMIN-N11 | P1 | Login email-enumeration timing oracle | FIXED |
| ADMIN-N12 | P1 | Rider refresh no CAS/reuse detection | FIXED |
| ADMIN-N13/14/15 | P2 | finance perm, cookie drift, timing compare | FIXED |

## Workflows/jobs round

| ID | Severity | Summary | Status |
|---|---|---|---|
| WF-P0-RENT | P0 | Overdue reminder storm (~240 pushes/day); double receipts | FIXED (T-90) |
| WF-P0-KYC | P0 | KYC_INFO_REQUESTED events acked-and-dropped | FIXED (T-91/T-95) |
| WF-P1-BACKUPLOOP | P1 | MANUAL schedules backed up every 5 min forever | FIXED (T-94 computeNextRunAt) |
| WF-P1-REFERRAL | P1 | Self-referral payout; duplicate mint on replay | FIXED (T-93) |
| WF-P1-PURGE | P1 | GDPR purge missed dob/geo/photos/files | FIXED |
| WF-P2-* | P2 | outbox FAILED purge unscheduled; rate-limit flag test-only; withJobGuards dead | OPEN — wire into scheduled cleanup task |
| WF-P2-DISPATCH | P2 | Broadcast full-resend on retry (no cursor) | OPEN |

## CI/CD round

| ID | Summary | Status |
|---|---|---|
| CI-1 | timeout-minutes missing on all long jobs | FIXED |
| CI-2 | Mutable third-party pins (dependency-audit privileged jobs) | PARTIAL (3 deferred: no SHA available in repo) |
| CI-3 | ci-cd DATABASE_URL workflow-level scope | FIXED |
| CI-4 | pr-smoke-load continue-on-error defeated gate | FIXED |
| CI-5 | Signed APK 90-day artifact retention | FIXED (14d) |
| CI-6 | Slack webhook interpolation pattern ×4 | FIXED (env-indirect) |

## Testing strategy backlog (top items)

See testing-strategy audit §Gap-backlog: Clock injection (M), files_repository
tests (M), adversarial E2E de-vacuum (S), golden failure-png purge + .gitignore
(S), runner JUnit/timeouts/quarantine (M), TEST_MODE-off E2E shard (M),
per-package coverage floors (S), offline replay E2E (L), Stryker scoped revival
(M), Playwright rider specs (M).
