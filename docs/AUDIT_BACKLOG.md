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

## TICKET-C-001 — chore(api): remove /api/rider/settings route + OpenAPI entry

**Status:** Pending (server-side deletion after one release soak)  
**Files:** `web/src/app/api/rider/settings/route.ts`, `contracts/openapi.ts`  
**Context:** Flutter client surface deleted 2026-08-26 (see C-plan commit). No product
requirement for server-synced rider prefs; settings screen is local-first (`SharedPreferences`).
Full server-route removal deferred to avoid OpenAPI contract churn in the same release.

## 9.5+ Hardening round (2026-08-27)

Source: `9.5-plus-hardening-plan.md` (2026-08-27 audit). Section numbers in
parentheses reference the user's plan. Branch: `fix/admin-finance-p0-2-p0-3-rowlock-bulk-2026-08-24`.

### P0 â€” release blockers (committed)

| ID | Severity | Area | Summary | Status |
|---|---|---|---|---|
| 9P0-1 | P0 | secrets | `scripts/check-release-secrets.mjs` release-archive scanner + 7-case self-test | FIXED (0a862dfa) |
| 9P0-2 | P0 | auth | Removed `?token=` from `getSession` and `getAdminSession` (Bearer + cookie only) | FIXED (0a862dfa) |
| 9P0-3 | P0 | auth | Removed `?token=` from `/api/metrics`; constant-time `safeEqualSecret` helper | FIXED (c339c6c6) |
| 9P0-4 | P0 | payments | Payment-gateway route fails closed (503 + `PAYMENT_GATEWAY_UNAVAILABLE`); no fabricated TEST gateway | FIXED (79c78026) |
| 9P0-5 | P0 | mobile | Flutter TLS default flipped to `ca` in release; `TlsPinsLoader` wired from `main()`; CI passes `--dart-define=TLS_PIN_MODE=ca`; `flutter/scripts/check-release-config.sh` gate | FIXED (9bf9b866) |
| 9P0-6 | P1 | money | Canonical money invariants pinned (21 cases); `wallet-adjust` route now uses `rupeesToPaise` | FIXED (7fa01cd6) |
| 9P0-7 | P1 | idempotency | `IdempotencyKey.requestHash` (SHA-256 of canonical JSON); same-key/different-body returns 409; legacy rows fall back to the pre-migration behavior | FIXED (d67fc218) |

### P2 â€” hardening backlog (deferred per plan)

| ID | Severity | Area | Summary | Status |
|---|---|---|---|---|
| 9P2-1 | P1 | outbox | Preserve retry history; `DEAD_LETTER` state; firstFailedAt/lastFailedAt/manualRetries on OutboxEvent | OPEN |
| 9P2-2 | P1 | payments | Payment state machine (CREATED â†’ CAPTURED â†’ REFUNDED); webhook replay rejection via unique providerEventId | OPEN |
| 9P2-3 | P1 | events | Versioned event schemas (`eventVersion`, `correlationId`, `aggregateId`, `occurredAt`); event registry | OPEN |
| 9P2-4 | P1 | security | IDOR test suite across ride / wallet / transaction / payment / KYC / file / profile / ticket / notification | OPEN |
| 9P2-5 | P2 | security | Admin direct-Prisma exception list removal; `lib/db` forbidden in `app/api/admin/**/route.ts` | OPEN |
| 9P2-6 | P2 | security | ESLint ratchet stage 1 â†’ 3 (no-explicit-any, no-unused-vars, prefer-const, etc.) | OPEN |
| 9P2-7 | P2 | security | Raw-SQL safety gate (`$queryRawUnsafe` / `$executeRawUnsafe` outside allow-list) | OPEN |
| 9P2-8 | P2 | mobile | TLS release negative tests; APK inspection; mobile session single-flight tests | OPEN |
| 9P2-9 | P2 | observability | Production dashboards (5xx / p95 / pool / DLQ / reconciliation); alerter rules | OPEN |
| 9P2-10 | P2 | workers | SIGTERM graceful shutdown handling + tests | OPEN |

### P3 â€” operational backlog (deferred per plan)

| ID | Severity | Area | Summary | Status |
|---|---|---|---|---|
| 9P3-1 | P2 | ops | Daily reconciliation jobs (wallet ledger, payment provider, payouts) | OPEN |
| 9P3-2 | P2 | ops | Load testing scenarios (login, OTP, trip, wallet, payment, admin search) | OPEN |
| 9P3-3 | P2 | ops | Failure-injection tests (Postgres / FCM / SMS / payment / storage / network) | OPEN |
| 9P3-4 | P2 | ops | Monthly restore test, quarterly DR drill (Postgres + object + config + secrets + workers) | OPEN |
| 9P3-5 | P2 | mobile | Certificate-rotation runbook (old + new CA overlap; new build shipped; old CA removed only after safe overlap) | OPEN |

### Verification

- Web unit suite: 350 -> 356 files, 3297 -> 3375 tests (+78 across 6 new
  test files), 3 skipped, 0 failed.
- Flutter analyze (changed files): no issues.
- Flutter `tls_pins_loader_test.dart`: 5/5.
- Live `/api/rider/payment-gateways/active` (dev DB, no seeded gateway):
  503 + `code: PAYMENT_GATEWAY_UNAVAILABLE`; no `default_razorpay`, no
  TEST environment, no null keyId in the response body.
- Live `npm run dev`: serves on :8081; admin login still works;
  `GET /api/admin/transactions?sortBy=amount&sortDir=desc` (T-AR-SORT
  from prior PR) still returns 220 transactions ordered correctly.

### Pre-existing failures (NOT 9.5+ related)

- 5 Flutter tests in `router_body_test`, `platform_hardening_cleanups_test`,
  `session_isolation_test` fail with `PinnedHttpClient: no production
  TLS fingerprints configured` â€” these were already failing before this
  audit and are orthogonal to T-9P0-5 (the CA-mode default unblocks a
  release build; the test failure is a test-fixture concern).
- Long-running integration suite (75 files) has 5+ pre-existing
  failures in OTP / vehicle / shift / referral / data-management
  paths. All T-9P0-* ticket tests pass; the rest is unchanged.
