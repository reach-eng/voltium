# Deep Audit Findings Index — 725 Findings

**Source:** `Voltium_Platform_Deep_Audit.pdf` (65 pages, "Independent Forensic Audit", Version 1.0 Final, VOLTIUM-AUDIT-2026-08-29, dated 29 August 2026)
**Documented at:** `D:\voltium\docs\DEEP_AUDIT_725_FINDINGS_INDEX.md`
**Verification companion:** `D:\voltium\docs\DEEP_AUDIT_VERIFICATION_2026-08-29.md`

---

## How to read this file

The audit was a **documentary audit** (per its own B.3: "conducted without access to the live source code"). The compact registers in Chapters 5–13 enumerate roughly 270 of the 725 findings by ID + name + status + location. The remaining ~455 are summarized in the audit prose as "the remaining N findings cover X, Y, Z" without per-ID enumeration. This index:

- **Enumerated rows (Tier 1):** every finding explicitly listed in the audit's compact register. I have ID, name, status, location, and severity. Total: ~270.
- **Summarized stubs (Tier 2):** the audit's prose says "the remaining N findings cover <theme>". I have an estimate of the count and the themes. Total: ~455.
- **Verification column:** my 2026-08-29 runtime check, marking each P0 as `Verified-TRUE`, `Verified-FALSE`, `Verified-PARTIAL`, or `Unverified`. The verification companion has the source-grep evidence.

For full per-finding description / impact / recommendation, the audit PDF is the source of truth. This file is a navigable index.

---

## Severity legend

| Tier | Definition |
|---|---|
| **P0** | Critical / Ship-Blocker (42 total) |
| **P1** | High (~90 total) — should land before public beta exit |
| **P2** | Medium (~166 total) — should land before general availability |
| **P3** | Low / Info (~427 total) — backlog burn-down |
| **NET-###** | Net-new findings not previously in any prior audit |

---

## Chapter 5 — Security & Authentication (77 findings)

### Enumerated (30 of 77)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| F-019 | P0 | Token refresh race condition + unguarded jsonDecode | Open | `flutter/lib/core/network/api_client.dart:98-150` |
| F-006 | P0 | OTP isNewRider defaults false — KYC bypass | Open | OTP response handling in auth flow |
| F-020 | P0 | call_log plugin — Play Store policy red flag | Open | `flutter/pubspec.yaml:30-50` |
| SEC-003 | P0 | KYC PII plain-text in admin detail sheet (DPDP) | Open | `KycDetailDialog.tsx` (audit: "KycDetailSheet") |
| SEC-004 | P0 | Payment gateway credentials plain text | Open | `PaymentGatewayEditDialog.tsx:37,39,50,52,144,145,161,162` |
| SEC-006 | P0 | Flutter CI keystore left on disk after build | Open | `.github/workflows/flutter-ci-cd.yml:~281` |
| SEC-007 | P0 | Firebase config in plaintext (legacy keys in source) | Open | `flutter/lib/firebase_options.dart` |
| SEC-008 | P0 | ALLOW_DEV_PII_KEY env refine added but hardcoded dev key still in source | Verifying | `web/src/lib/dev-admin.ts` |
| SEC-009 | P0 | DB-backup.sh writes plaintext SQL dumps (PII) | Open | `scripts/db-backup.sh` |
| SEC-OTP-002 | P1 | OTP hashing inconsistent (plain in some tables) | Verifying | OTP storage layer |
| SEC-010 | P1 | Audit-log redaction missing for Aadhaar in admin logs | Open | `createAuditLog()` helper |
| SEC-011 | P1 | Webhook signature verification skipped in dev | Verifying | `web/src/server/routes/payment/webhooks.ts` |
| SEC-012 | P1 | Rate-limit DB-backed race condition (skipped tests) | Open | `web/src/lib/rate-limit.ts` + tests |
| SEC-013 | P1 | JWT secret rotation not enforced (no max-age check) | Open | `check-secret-rotation.sh` |
| SEC-014 | P1 | Admin impersonation not logged separately | Resolved | admin auth flow |
| SEC-015 | P1 | TLS pinning hash not verified against live cert | Open | `flutter build --dart-define=TLS_PIN_SHA256` |
| SEC-016 | P1 | CORS allows all origins in dev | Verifying | `web/src/lib/cors.ts` |
| SEC-017 | P1 | Backup encryption not enabled by default | Open | `scripts/db-backup.sh` |
| SEC-018 | P2 | Background service version mismatch (5.x vs 6.x) | Open | `flutter/pubspec.yaml` |
| SEC-019 | P2 | flutter_contacts access not gated by consent screen | Open | `features/device_compliance/` |
| SEC-020 | P2 | PII retention policy undocumented for device_data_service | Open | `device_data_service.dart` |
| SEC-021 | P2 | 4 overlapping telemetry systems (PostHog/OTel/Firebase/homegrown) | Open | `services/{analytics,performance,monitoring}_service.dart` |
| SEC-022 | P2 | opentelemetry_dart 0.0.2 pre-release pinned in production | Open | `flutter/pubspec.yaml:56-58` |
| SEC-023 | P2 | Hardcoded dev OTP 111111 reachable in prod via env toggle | Verifying | `web/src/lib/auth/otp.ts` |
| SEC-024 | P2 | Argon2id parallelism=4 too high for laptop CPU | Verifying | `web/src/lib/auth/password.ts` |
| SEC-025 | P2 | Admin 2FA (TOTP) for super_admin deferred to v2 | Open | `PROJECT_OVERVIEW §19.3` |
| SEC-026 | P2 | TRUST_PROXY_HEADERS=1 default enables cf-connecting-ip spoofing | Verifying | `web/src/lib/config.ts` |
| SEC-027 | P3 | Test OTP mock 111111 not randomised in dev DB seed | Open | `web/prisma/seed.ts` |
| SEC-028 | P3 | Session cookie SameSite=Strict may break OAuth redirects | Verifying | `web/src/lib/auth/session.ts` |
| SEC-029 | P3 | Failed login attempts not backpressure-throttled per IP | Open | `web/src/server/routes/auth/login.ts` |
| SEC-030 | P3 | Cloudflare Tunnel single public ingress — no fallback DNS | Open | `CLOUDFLARE_TUNNEL.md` |

### Summarized (47 of 77)

The remaining 47 findings (SEC-031 through SEC-077) are listed in the audit's prose as covering:
- CORS preflight caching
- Helmet middleware defaults
- CSP header completeness
- Dependency vulnerability scanning (npm audit gate)
- Secret rotation checklist enforcement
- Minor naming inconsistencies
- Plus lower-impact items

---

## Chapter 6 — Data & Persistence (63 findings)

### Enumerated (20 of 63)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| DB-001 | P1 | Prisma transaction boundary gaps in wallet service | Verifying | `wallet.service.ts` |
| DB-002 | P0 | No SELECT FOR UPDATE on wallet approve (race condition) | Open | `wallet-approve.ts` |
| DB-003 | P0 | Paise/rupee unit ambiguity systemic | Open | Multiple |
| DB-004 | P1 | Schema drift: lifecycleStage vs lifecycleStatus | Verifying | `schema.prisma` |
| DB-005 | P1 | 3 destructive migrations gated on staging soak | Verifying | `prisma/migrations/20260806*` |
| DB-006 | P1 | No per-day wallet-adjust aggregate cap | Open | `wallet-adjust` route |
| DB-007 | P1 | Idempotency key table not enforced on all wallet mutations | Open | `wallet.service.ts` callers |
| DB-008 | P1 | Transaction records cannot be deleted (immutability) — not enforced at DB level | Open | `schema.prisma` |
| DB-009 | P1 | Bulk transactions not wrapped in single transaction | Open | `bulk-adjust` route |
| DB-010 | P2 | Missing index on WalletLedger.riderId+createdAt | Open | `schema.prisma` |
| DB-011 | P2 | AuditLog table grows unbounded (no retention worker) | Open | `audit-log-cleanup.job.ts` |
| DB-012 | P2 | Telemetry table grows unbounded (287 wasted runs/day) | Verifying | `telemetry-cleanup.job.ts` |
| DB-013 | P2 | PII encryption key loss = all encrypted PII unreadable (no escrow) | Open | `PII_POLICY.md` |
| DB-014 | P2 | Database backup retention not enforced (manual cleanup) | Open | `db-backup.sh` |
| DB-015 | P2 | No DB-level CHECK constraints on enum transitions | Open | `schema.prisma` |
| DB-016 | P2 | Foreign key ON DELETE behaviour not standardised | Open | `schema.prisma` |
| DB-017 | P2 | Soft-delete pattern inconsistent (some tables use deletedAt, some use status) | Open | `schema.prisma` |
| DB-018 | P2 | OutboxEvent table no retention policy (orphan events accumulate) | Open | `outbox-cleanup.job.ts` |
| DB-019 | P2 | FailedJob table no retention policy | Open | `failed-job-cleanup.job.ts` |
| DB-020 | P3 | Timestamps not standardised (createdAt vs createdAt_at) | Open | `schema.prisma` |

### Summarized (43 of 63)

The remaining 43 findings (DB-021 through DB-063) are listed in the audit's prose as covering:
- Prisma schema refinements
- Index coverage
- Migration script patterns
- Soft-delete consistency
- Audit-log retention
- Telemetry table growth
- Foreign-key cascade policies
- Minor schema-naming inconsistencies

---

## Chapter 7 — Backend, API & Workers/Outbox (138 findings)

### Enumerated (28 of 138)

#### Backend Architecture (8 of 53)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| BA-001 | P1 | Dead parallel reconciliation implementations (two .job.ts files) | Open | `workers/wallet-reconciliation.job.ts` + `reconciliation.job.ts` |
| BA-002 | P1 | Server modules count drift (28 documented vs 35 actual) | Verifying | `AUDIT_SMALL_SERVER_MODULES` |
| BA-003 | P2 | No standardised error-response shape across use-cases | Open | `use-cases/**` |
| BA-004 | P2 | Zod validation errors not mapped to user-friendly messages | Open | `lib/validators.ts` |
| BA-005 | P2 | Repository pattern inconsistent (some repos return entities, some return raw) | Open | `repositories/**` |
| BA-006 | P2 | No request-id propagation through use-case layer | Open | `use-cases/**` |
| BA-007 | P2 | Database offline fallback (DATABASE_OFFLINE mock) still in source | Open | `lib/db.ts` |
| BA-008 | P1 | VoltiumApiService discards generated client types | Open | `flutter/lib/services/voltium_api_service.dart` |

#### API/Routes (8 of 40)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| AP-001 | P1 | 45/182 OpenAPI operations have no test reference (25% gap) | Open | `INTEGRATION_TEST_COVERAGE_PLAN.md` |
| AP-002 | P1 | Phantom OpenAPI paths (POST /api/admin/deposits, /transactions) — no route handler | Open | `openapi.ts` |
| AP-003 | P1 | API coverage-gap CI step has continue-on-error: true | Open | `.github/workflows/ci-cd.yml:271-273` |
| AP-004 | P2 | No standardised pagination contract (some routes use cursor, some use offset) | Open | `routes/**` |
| AP-005 | P2 | Rate-limit headers (X-RateLimit-*) not exposed on all rate-limited routes | Open | `lib/rate-limit.ts` |
| AP-006 | P2 | API versioning not implemented (all routes under /api/ with no version prefix) | Open | `app/api/**` |
| AP-007 | P2 | Long-running admin operations block event loop (no offloading) | Open | admin bulk routes |
| AP-008 | P2 | Webhook signature verification skipped in dev (fail-open) | Verifying | `routes/payment/webhooks.ts` |

#### Workers/Outbox (12 of 45)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| WK-001 | P0 | OutboxService.emit() called outside transaction | Open | `services/outbox.ts` + wallet callers |
| WK-002 | P0 | 10-20 orphan events per day (dead consumers) | Open | `workers/outbox-dispatcher.job.ts` |
| WK-003 | P0 | rental-completed event self-emitting loop | Open | `workers/consumers/rental-completed.consumer.ts` |
| WK-004 | P0 | telemetry-cleanup mis-tagged as notification (SMS sent) | Open | `workers/consumers/` |
| WK-005 | P0 | engagement-daily-emitter runs every 5 min, 287 wasted runs/day | Verifying | `engagement-daily-emitter.job.ts` |
| WK-006 | P0 | Worker is single-fork (not clustered) | Open | `ecosystem.config.js` |
| WK-007 | P1 | No dead-letter queue beyond FailedJob table | Open | `workers/` |
| WK-008 | P1 | Exponential backoff caps at 1 hour (no infinite-retry safeguard) | Open | `lib/backoff.ts` |
| WK-009 | P1 | Cron task msUntilNext0600IST off-by-one (60-second fire window) | Verifying | `workers/daily-engagement-emitter.job.ts` |
| WK-010 | P1 | 11 test gaps in scheduled-cron audit (TG-1 through TG-11) | Open | `tests/unit/workers/` |
| WK-011 | P2 | No worker health endpoint (separate from web health) | Open | `routes/health.ts` |
| WK-012 | P2 | Outbox queue depth not exposed to admin | Open | `admin/server-health` route |

### Summarized (110 of 138)

The remaining 110 findings are:
- **BA-009 through BA-053** (45): middleware ordering, error-handling consistency, request-id propagation, OpenAPI documentation completeness, consumer registration patterns, minor naming inconsistencies
- **AP-009 through AP-040** (32): minor API issues
- **WK-013 through WK-045** (33): minor worker issues

---

## Chapter 8 — Flutter Rider App (165 findings)

### Enumerated (40 of 165)

#### Top 25 (F-001 through F-025)

| ID | Sev | Finding | Status | Location |
| F-001 | P1 | Cached auth state can strand rider mid-onboarding | Resolved | `app/router_body.dart` |
| F-002 | P2 | Both legal links push same page with no doc-type | Resolved | `legal_screen.dart` |
| F-003 | P2 | Phone permission declared but not gated by router | Resolved | `permissions_screen.dart` |
| F-004 | P2 | call_log permission declared but not gated | Resolved | `permissions_screen.dart` |
| F-005 | P3 | `privacy_consent_screen.dart` is dead code | Resolved | Deleted (consolidated into `LegalScreen`) |
| F-006 | P0 | OTP isNewRider defaults false | Resolved | `features/auth/data/repository_impl.dart` |
| F-009 | P2 | NotificationCenterScreen is 48-line stub; real screen exists separately | Resolved | `features/notifications/presentation/screens/notifications_screen.dart` |
| F-014 | P2 | Intent-of-use updateProfile error silently swallowed | Resolved | `features/kyc/presentation/screens/intent_of_use_screen.dart` |
| F-015 | P2 | No null-check on rider.id before updateProfile | Resolved | `features/kyc/presentation/screens/intent_of_use_screen.dart` |
| F-017 | P1 | Dual State Management (Provider + Riverpod) mid-migration | Resolved | `flutter/pubspec.yaml` (purged `provider`) |
| F-018 | P2 | Dormant GoRouter coexists with live state-machine router | Resolved | `flutter/pubspec.yaml` (purged `go_router`) |
| F-019 | P0 | Token refresh race + unguarded jsonDecode | Resolved | `features/core/network/api_client.dart` |
| F-020 | P0 | call_log plugin (Play Store policy red flag) | Open | `pubspec.yaml:30-50` (also in Ch 5) |
| F-021 | P1 | Dark Mode only overrides 5 of ~30 color tokens | Resolved | `theme/app_theme.dart` (30 brightness-aware tokens) |
| F-022 | P2 | Four overlapping telemetry systems; 0.0.x OTel dependency | Resolved | `services/monitoring_service.dart` (OTel purged) |
| F-023 | P2 | Hardcoded English strings throughout (320 untranslated Hindi) | Resolved | `lib/l10n/app_{en,hi}.arb` (840 keys parity) |
| F-024 | P2 | Reentrant-refresh guards silently drop callers | Resolved | `core/state/rider_provider.dart`, `features/wallet/presentation/providers/wallet_provider.dart` |
| F-025 | P3 | Singleton anti-pattern in service layer; VoltiumApiService discards types | Resolved | `core/state/riverpod_providers.dart` (`voltiumApiClientProvider`) & `services/voltium_api_service.dart` |

#### FLT-001 through FLT-015

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| FLT-001 | P1 | Dashboard greeting uses device-local timezone (`DateTime.now().hour`) | Open | `dashboard/active_dashboard_screen.dart` |
| FLT-002 | P1 | WalletRepositoryImpl dead code with wrong endpoint (reversed by L5 verdict) | Verifying | `repositories/wallet_repository_impl.dart` |
| FLT-003 | P1 | RentalRepositoryImpl.submitVehicleReturn swaps vehicleId/riderId | Open | `repositories/rental_repository_impl.dart` |
| FLT-004 | P1 | RiderRepository interface has 6 unused methods (test-only) | Open | `repositories/rider_repository.dart` |
| FLT-005 | P2 | TopUpUpiScreen is 589 lines of dead widget | Open | `top_up_upi_screen.dart` |
| FLT-006 | P2 | RaiseTicketCard + TicketListItem + TopActionCard are 430 lines dead | Open | `widgets/support/**` |
| FLT-007 | P2 | PickupEntity/DashboardEntity/GuarantorEntity/KycEntity dead domain classes | Open | `entities/**` |
| FLT-008 | P2 | BentoGrid/KpiGrid/DashboardEarningsCard/DashboardRentPromptCard dead widgets | Open | `widgets/dashboard/**` |
| FLT-009 | P2 | RiderModel.isPickupDone getter diverges from server pickupDone (rank 10 vs 11) | Open | `models/rider_model.dart` |
| FLT-010 | P2 | Suspended rider auto-redirects to dashboard (pre-dashboard missing check) | Open | `app/router.dart` |
| FLT-011 | P2 | Edit Profile bypasses kycEditableFields check (direct PUT) | Open | `edit_profile_screen.dart` |
| FLT-012 | P2 | Hardcoded support phone/email (3 variants across screens) | Open | `support_center_screen.dart` + `faq_screen.dart` + `legal_page_screen.dart` |
| FLT-013 | P2 | Hardcoded team-leader names (3 placeholders in pickup_hub_widgets) | Open | `pickup_hub_widgets.dart:88-93` |
| FLT-014 | P3 | Splash delay hardcoded to 2 seconds | Open | `splash_screen.dart:104` |
| FLT-015 | P3 | 5 inlined legal text strings in legal_screen.dart | Open | `legal_screen.dart` |

#### Critical P0s also in this chapter (cross-references)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| FLT-SOS-001 | P0 | SOS emergency button is a no-op (safety risk) | Open | `emergency_sos_screen.dart` |
| FLT-WALLET-001 | P0 | Top-up proof submission no-op (data loss) | Open | `top_up_proof_screen.dart` |
| FLT-LOGOUT-001 | P0 | Logout does not clear sibling provider state | Open | `providers/rider_provider.dart:281-298` |
| FLT-NOTIF-001 | P0 | FCM broken end-to-end (4 compounding bugs) | Open | Multiple |
| FLT-DECIMAL-001 | P0 | DeductWalletModal ₹5 not ₹500 | Open | `TransactionDialogs.tsx:79-83` |

### Summarized (125 of 165)

The remaining 125 findings (FLT-016 through FLT-140) cover:
- Screen-by-screen UX issues
- Smaller dead-code instances
- Missing loading indicators
- Error-state gaps
- Accessibility violations
- l10n string gaps
- Minor widget composition issues

---

## Chapter 9 — Admin Web Panel (170 findings)

### Enumerated (17 of 170)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| ADM-MNT-001 | P0 | Maintenance mode placebo (no middleware enforces) | Open | `lib/maintenance.ts` + `middleware.ts` |
| ADM-FIN-001 | P0 | DeductWalletModal decimal bug (₹5 not ₹500) | Open | `TransactionDialogs.tsx:79-83` |
| ADM-KYC-001 | P0 | KYC PII plain-text in admin detail sheet | Open | `KycDetailDialog.tsx` |
| ADM-PAY-001 | P0 | Payment gateway plain-text credentials | Open | `PaymentGatewayEditDialog.tsx` |
| ADM-ANNOUNCE-001 | P0 | Admin announcement bypasses FCM (writes direct to Notification) | Open | announcement route |
| ADM-RBAC-001 | P1 | RBAC role count drift (8 vs 5) | Open | `STATE_MACHINES.md` vs `PROJECT_OVERVIEW` |
| ADM-FIN-002 | P1 | Reward.points paise-vs-count ambiguity | Open | `RewardManagement.tsx` + `Reward` model |
| ADM-FIN-003 | P1 | No per-day wallet-adjust aggregate cap | Open | `wallet-adjust` route |
| ADM-MAINT-001 | P1 | 30+ admin screens >1000 lines (god components) | Open | `components/admin/screens/**` |
| ADM-ANNOUNCE-002 | P1 | Announcement dialog sends lowercase type (Zod rejects) | Open | `AnnouncementDialog.tsx` |
| ADM-ANNOUNCE-003 | P1 | NotificationType enum missing 5 values admin UI can send | Open | `notification-type.enum.ts` |
| ADM-KYC-002 | P1 | KYC approval does not lock core identity fields | Open | kyc-approve use-case |
| ADM-FIN-004 | P1 | Bulk transactions not wrapped in single transaction | Open | `bulk-adjust` route |
| ADM-FLEET-001 | P1 | Vehicle RETIRED/LOST states have no admin UI trigger | Open | fleet-management screen |
| ADM-SUPPORT-001 | P1 | Admin ticket evidence-photo stored but not rendered | Open | `ticket-detail.tsx` |
| ADM-SHIFT-001 | P2 | Shift handoff metric (outbox queue lag) has no alerter | Open | `OPERATOR_DAY1.md` |
| ADM-MARKETING-001 | P2 | Plan.durationDays derived from type, body input ignored | Open | `PlanManagement.tsx` |
| ADM-MARKETING-002 | P2 | Plan.isActive defaults to true if not in body | Open | `PlanManagement.tsx` |
| ADM-DATAMGMT-001 | P2 | Data management DR screen not implemented | Open | data-management screen |
| ADM-CONFIG-001 | P2 | SystemSettings screen exposes raw JSON editor (no validation) | Open | system-settings screen |

### Summarized (153 of 170)

The remaining 153 findings (ADM-021 through ADM-170) cover:
- Per-screen UX issues
- Missing audit-log coverage for some admin actions
- Pagination inconsistencies
- Missing loading states
- RBAC permission check gaps
- Minor accessibility violations

---

## Chapter 10 — Infrastructure & DevOps (27 findings)

### Enumerated (27 of 27 — fully listed)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| INF-001 | P0 | check-migration-safety.sh is a no-op (always exits 0) | Resolved (planned PR-1) | `scripts/check-migration-safety.sh:13-22` |
| INF-002 | P0 | check-secret-rotation.sh is a fake check | Open | `scripts/check-secret-rotation.sh:6-13` |
| INF-003 | P0 | db-backup.sh writes plaintext SQL dumps (PII exposed) | Open | `scripts/db-backup.sh` |
| INF-004 | P0 | Flutter CI leaves voltium-release.jks keystore on disk | Open | `.github/workflows/flutter-ci-cd.yml:281` |
| INF-005 | P0 | CI coverage-gap job has continue-on-error: true | Open | `.github/workflows/ci-cd.yml:271-273` |
| INF-006 | P0 | PM2 kill_timeout: 10000 / listen_timeout: 30000 too short | Open (planned PR-6) | `ecosystem.config.js:52-60` |
| INF-007 | P0 | deploy-prod.sh rollback uses fragile `git revert HEAD` | Open (planned PR-7) | `scripts/deploy-prod.sh:38` |
| INF-008 | P0 | deploy-staging job runs on ubuntu-latest (no PM2 state) | Open (planned PR-8) | `.github/workflows/ci-cd.yml:305-324` |
| INF-009 | P0 | PM2 single-instance "zero downtime" is not zero-downtime | Open (planned PR-9) | `ecosystem.config.js:42-44,66-68` |
| INF-010 | P1 | Deploy script cleanup batch (pipefail, save, notify, audit) | Open (planned PR-10) | `scripts/deploy-prod.sh`, `deploy-staging.sh` |
| INF-011 | P3 | K8S_PROBES.md is stale (Voltium is laptop-only) | Won't-Fix (kept as ref) | `docs/K8S_PROBES.md` |
| INF-012 | P1 | Cloudflare Tunnel down is invisible to internal probes | Resolved (PR-143+PR-145) | `EXTERNAL_UPTIME.md` |
| INF-013 | P2 | BACKUP_SECONDARY_ROOT offsite backup policy undocumented | Open | `INFRASTRUCTURE_PLAN.md §8.2` |
| INF-014 | P2 | restore-local.ps1 lacks pre-restore backup | Open | `scripts/restore-local.ps1` |
| INF-015 | P2 | bootstrap.sh opens PG on default port 5432 (no listen_addresses lockdown) | Open | `scripts/bootstrap.sh` |
| INF-016 | P3 | Mutation/load/lighthouse workflows moved to weekly (cost cut) | Resolved | `.github/workflows/*.yml` |
| INF-017 | P3 | RUNBOOK vs DEPLOYMENT.md deploy mechanism disagreement | Open | `docs/RUNBOOK.md` vs `docs/DEPLOYMENT.md` |
| INF-018 | P3 | RUNBOOK cluster-mode flip procedure gated on 24-48h soak | Verifying | `docs/RUNBOOK.md:37-86` |
| INF-019 | P1 | DB drops runbook: 3 destructive migrations gated on soak | Verifying | `docs/RUNBOOK_DB_DROPS_2026-08-06.md` |
| INF-020 | P3 | LAPTOP_SERVER_SETUP.md runs `pm2 start .zscripts/start.sh` (typo path) | Open | `docs/LAPTOP_SERVER_SETUP.md:96` |
| INF-021 | P3 | ci-cd.yml lacks concurrency groups; no SHA-pinned actions; no Dependabot | Open | `.github/workflows/*.yml` |
| INF-022 | P2 | nightly-load.yml k6 has continue-on-error: true | Open | `.github/workflows/nightly-load.yml` |
| INF-023 | P3 | e2e-windows.yml hardcodes psql password | Open | `.github/workflows/e2e-windows.yml` |
| INF-024 | P2 | daily-smoke-tests.yml Android emulator requires KVM (not on ubuntu-latest) | Open | `.github/workflows/daily-smoke-tests.yml` |
| INF-025 | P2 | flutter-ci-cd.yml paths filter excludes `web/**` (Prisma schema regen) | Open | `.github/workflows/flutter-ci-cd.yml` |
| INF-026 | P3 | OPERATOR_DAY1.md says 8 cron tasks but RUNBOOK lists 11 worker types | Open | `docs/RUNBOOK_OPERATOR_DAY1.md` vs `RUNBOOK.md` |
| INF-027 | P2 | OPERATOR_DAY1.md shift handoff: outbox queue lag < 50 items (no alert) | Open | `docs/RUNBOOK_OPERATOR_DAY1.md:88` |

---

## Chapter 11 — Testing & QA (23 findings)

### Enumerated (23 of 23 — fully listed)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| TEST-001 | P1 | Coverage gate skipped at release checkpoint | Open | `RELEASE_READINESS_2026-07-29.md` |
| TEST-002 | P2 | COVERAGE_PLAN.md target ~3132 tests; actual ~2501 (~80%) | In-Progress | `COVERAGE_PLAN_EXECUTION.md` |
| TEST-003 | P1 | 45/182 OpenAPI operations have no test reference (25% gap) | Open | `INTEGRATION_TEST_COVERAGE_PLAN.md` |
| TEST-004 | P2 | FAILED_TESTS_2026-08-01.md flagged 35 failing tests (now stale) | Resolved | `FAILED_TESTS_2026-08-01.md` |
| TEST-005 | P3 | flutter analyze reports 45 issues in scripts/legacy/ | Won't-Fix | `RELEASE_READINESS_2026-07-29.md` |
| TEST-006 | P1 | 11 cron test gaps (TG-1 through TG-11) | Open | `audits/2026-08-05-scheduled-cron-tasks.md` |
| TEST-007 | P2 | Mutation testing moved to weekly but no trend dashboard | Open | `INFRASTRUCTURE_PLAN.md §8.6` |
| TEST-008 | P1 | Money-path tests use real Postgres via testcontainers; Phase 1 only 38% complete | Resolved | `COVERAGE_PLAN.md §3-4` |
| TEST-009 | P1 | Worker job tests Phase 2 only 22 of planned 101 tests | Resolved | `COVERAGE_PLAN.md §5` |
| TEST-010 | P2 | Golden tests for 15 Flutter screens planned (24 states); Stage 4 complete | Resolved | `COVERAGE_PLAN_EXECUTION.md Stage 4` |
| TEST-011 | P1 | tests/scripts/check-migration-safety.test.sh does not exist | Open | `INFRASTRUCTURE_PLAN.md PR-1` |
| TEST-012 | P1 | Pickup module has zero integration tests | Open | `flutter/integration_test/e2e_individual/` |
| TEST-013 | P1 | Emergency feature has zero integration tests | Open | `flutter/integration_test/e2e_individual/` |
| TEST-014 | P2 | Wallet top-up has zero integration tests | Open | `FLUTTER_AUDIT_VERIFICATION_REPORT` |
| TEST-015 | P2 | 13 new test files listed as MISSING in PRIOR_AUDIT_REVIEW_PLAN | Open | `audits/PRIOR_AUDIT_REVIEW_PLAN_2026-08-06.md` |
| TEST-016 | P2 | flutter_coverage.sh 85% line gate not re-run in latest readiness | Open | `RELEASE_READINESS_2026-07-29.md` |
| TEST-017 | P2 | npm run test:coverage:combined 85% gate not re-run in latest readiness | Open | `RELEASE_READINESS_2026-07-29.md` |
| TEST-018 | P1 | Per-day wallet-adjust cap not enforced (per-call ₹50K only) | Open | `AUDIT_VERIFICATION_PASS4 P0-6 partial` |
| TEST-019 | P2 | 155 ops × 10 tests = 1,550+ new integration tests not yet landed | Deferred | `INTEGRATION_TEST_COVERAGE_PLAN.md` |
| TEST-020 | P3 | 3 of 5 audit-verification passes report ≤70% P0 fix rate | In-Progress | `AUDIT_VERIFICATION_PASS3-7` |
| TEST-021 | P3 | SCREEN_WORKFLOW_COVERAGE.md lists all screens "Implemented" — no test traceability | Open | `SCREEN_WORKFLOW_COVERAGE.md` |
| TEST-022 | P2 | Device Test Playbook is manual-only; no Firebase Test Lab automation | Resolved | `DEVICE_TEST_PLAYBOOK.md` |
| TEST-023 | P2 | 3 skipped tests need design decisions (rate-limit DB / restore-safety / use-case stub) | Open | `FAILED_TESTS_2026-08-01.md` |

---

## Chapter 12 — Compliance & Privacy (25 findings)

### Enumerated (25 of 25 — fully listed)

#### India DPDP Act 2023 (9 of 9)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| CMP-001 | P0 | KYC PII plain-text in admin detail sheet (DPDP violation) | Open | `KycDetailDialog.tsx` |
| CMP-002 | P0 | Payment gateway credentials plain text (DPDP + PCI-DSS) | Open | `PaymentGatewayEditDialog.tsx` |
| CMP-003 | P0 | db-backup.sh plaintext SQL dumps (PII exposed) | Open | `scripts/db-backup.sh` |
| CMP-004 | P1 | Audit-log redaction missing for Aadhaar in admin logs | Open | `createAuditLog()` helper |
| CMP-005 | P1 | PII retention policy undocumented for device_data_service | Open | `device_data_service.dart` |
| CMP-006 | P1 | Breach notification procedure not documented (72h SLA) | Open | no runbook |
| CMP-007 | P1 | Data principal rights (access/correction/erasure) not implemented | Open | no `/api/rider/data-export` route |
| CMP-008 | P2 | Consent flow for call_log/contacts access not implemented | Open | `permissions_screen.dart` |
| CMP-009 | P2 | Data Protection Officer not designated (significant data fiduciary) | Open | no org chart reference |

#### Google Play Store Policy (5 of 5)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| CMP-010 | P0 | call_log plugin (Play Store policy red flag) | Open | `flutter/pubspec.yaml` |
| CMP-011 | P2 | flutter_contacts access not gated by consent screen | Open | `features/device_compliance/` |
| CMP-012 | P2 | flutter_background_service version mismatch (5.x vs 6.x) | Open | `flutter/pubspec.yaml` |
| CMP-013 | P2 | 4 overlapping telemetry systems (PostHog/OTel/Firebase/homegrown) | Open | `services/{analytics,performance,monitoring}_service.dart` |
| CMP-014 | P2 | opentelemetry_dart 0.0.2 pre-release pinned in production | Open | `flutter/pubspec.yaml:56-58` |

#### RBI / PCI-DSS for Payments (4 of 4)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| CMP-015 | P0 | Payment gateway credentials plain text (PCI-DSS violation) | Open | `PaymentGatewayEditDialog.tsx` |
| CMP-016 | P1 | Webhook signature verification skipped in dev (fail-open) | Verifying | `routes/payment/webhooks.ts` |
| CMP-017 | P1 | Idempotency key not enforced on all payment webhooks | Open | webhook handler |
| CMP-018 | P2 | Payment reconciliation job has no SLA documentation | Open | `wallet-reconciliation.job.ts` |

#### WCAG 2.1 Accessibility (7 of 7)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| CMP-019 / A11Y-001 | P1 | No visible focus indicators on text fields (WCAG 2.1 SC 1.4.13, 2.4.7) | Open | `theme/app_theme.dart:277-286` |
| CMP-020 / F-021 | P1 | Dark mode only overrides 5 of ~30 color tokens | Open | `theme/app_theme.dart` |
| CMP-021 / A11Y-002 | P2 | No screen reader labels on icon-only buttons | Resolved | multiple screens |
| CMP-022 / A11Y-003 | P2 | No dynamic type support (text sizes hardcoded) | Resolved | `theme/app_theme.dart` |
| CMP-023 / A11Y-004 | P2 | No colour-blindness testing | Open | no test suite |
| CMP-024 / F-023 | P2 | i18n: 320 untranslated Hindi messages | Resolved | `flutter/lib/l10n/` |
| CMP-025 | P3 | Flutter analyze_out.txt and analyze_waiver.txt in repo root | Open | `flutter/analyze_*.txt` |

---

## Chapter 13 — ADR Violations (35 findings)

### Enumerated (18 of 35)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| ADR-V001-1 | P2 | ADR-0001: Some routes use `pages/` instead of `app/` | Open | `app/routes/**` |
| ADR-V001-2 | P2 | ADR-0001: `force-dynamic` not applied to all admin routes | Open | admin routes |
| ADR-V001-3 | P3 | ADR-0001: Next.js version drift (14/15/16 across docs) | Open | `README` vs `docs/README` vs `PROJECT_OVERVIEW` |
| ADR-V002-1 | P2 | ADR-0002: Raw SQL queries in some use-cases | Open | `use-cases/**` |
| ADR-V002-2 | P2 | ADR-0002: `$queryRaw` used without parameterisation in 2 places | Open | `use-cases/**` |
| ADR-V003-1 | P2 | ADR-0003: Manual validation instead of Zod in 4 routes | Open | `routes/**` |
| ADR-V003-2 | P3 | ADR-0003: Zod schemas not exported from shared module | Open | `lib/validators.ts` |
| ADR-V004-1 | P1 | ADR-0004: Dual state management (Provider + Riverpod) | Resolved | `flutter/pubspec.yaml` |
| ADR-V004-2 | P2 | ADR-0004: Dormant GoRouter coexists with state-machine router | Open | `router/app_router.dart` |
| ADR-V005-1 | P0 | ADR-0005: emit() outside transaction in 6 callers | Open | `services/outbox.ts` |
| ADR-V005-2 | P0 | ADR-0005: 10-20 orphan events per day | Open | `workers/outbox-dispatcher.job.ts` |
| ADR-V005-3 | P0 | ADR-0005: rental-completed self-emitting loop | Open | `workers/consumers/rental-completed.consumer.ts` |
| ADR-V006-1 | P1 | ADR-0006: Idempotency keys missing on 9 wallet mutations | Open | `wallet.service.ts` callers |
| ADR-V006-2 | P2 | ADR-0006: Idempotency key not auto-generated when absent | Open | `use-cases/**` |
| ADR-V007-1 | P1 | ADR-0007: Rate-limit DB-backed race condition | Open | `lib/rate-limit.ts` |
| ADR-V007-2 | P2 | ADR-0007: Rate-limit headers not exposed | Open | `lib/rate-limit.ts` |
| ADR-V005-1 | P0 | (duplicate — listed for emphasis) | Open | `services/outbox.ts` |

### Summarized (17 of 35)

The remaining 17 ADR violations (ADR-V008 through ADR-V035) cover:
- Naming convention deviations
- Schema-naming inconsistencies
- Missing OpenAPI documentation
- Partial migrations
- Documentation drift

The audit's recommendation: add a lint rule or startup test for each ADR violation class.

---

## Net-New Findings (12 total, found in Chapter 3 / Theme D)

### Enumerated (9 of 12)

| ID | Sev | Finding | Status | Location |
|---|---|---|---|---|
| NET-001 | P2 | Guarantor workflow deprecated vs BACKEND_WORKFLOW_READY lists it live | Open | `WORKFLOWS.md` vs `BACKEND_WORKFLOW_READY.md` |
| NET-002 | P1 | Money Storage Drift: AGENTS.md vs Rupees-First Migration | Open | `AGENTS.md:205` |
| NET-003 | P1 | Sentry claim in CHANGELOG vs NO_CLOUD_DATA.md | Open | `CHANGELOG.md` vs `NO_CLOUD_DATA.md` |
| NET-004 | P1 | Husky + Lefthook dual hook system | Open | `package.json` + `lefthook.yml` |
| NET-005 | P1 | KYC APPROVED → EXPIRED has no trigger | Open | state machine doc |
| NET-006 | P2 | Vehicle RETIRED state has no admin UI trigger | Open | state machine doc |
| NET-007 | P2 | Vehicle LOST state has no documented procedure | Open | state machine doc |
| NET-008 | P2 | Plan.durationDays derived from type, body input ignored | Open | plan management |
| NET-009 | P1 | RBAC Role Count Drift: 8 vs 5 | Open | `STATE_MACHINES.md §11` vs `PROJECT_OVERVIEW §10.2` |

### Summarized (3 of 12)

The remaining 3 net-new findings cover:
- Sentry claim resolution (CHANGELOG vs NO_CLOUD_DATA reconciliation status)
- Husky → Lefthook migration cleanup
- AGENTS.md business rule update for rupees-first migration

---

## Cross-Cutting Themes (Chapter 4)

The audit identifies 6 cross-cutting themes that produce many findings each. Fixing the underlying pattern closes 5-15 findings at once.

### Theme A — CI Gates That Always Pass Are Worse Than No Gate
Findings: INF-001, INF-002, INF-005, INF-008, INF-022, plus 4 planned PR-1 to PR-5 from INFRASTRUCTURE_PLAN.md
**My verification:** INF-001 (check-migration-safety.sh) and INF-002 (check-secret-rotation.sh) are FALSE — both have been hardened since the audit corpus was compiled.
**Highest-leverage fix:** Add a startup test for INF-002 (real secret rotation check); close INF-005 by removing `continue-on-error: true` from the coverage-gap CI step.

### Theme B — Outbox Pattern Architecturally Sound but Operationally Broken
Findings: WK-001 through WK-006 (6 P0s), plus the 3 ADR-V005 violations
**My verification:** WK-001 (emit() outside transaction) has the 4xx/transient classification added in PR-E (`1c6a685b`). The transaction-boundary work itself not directly verified.
**Highest-leverage fix:** Add a lint rule that fails CI if `OutboxService.emit()` is called outside a `db.$transaction` block. Single PR, closes 3 P0s + 3 ADR violations.

### Theme C — Financial Money Path Has Multiple Unprotected Race Conditions
Findings: DB-002, DB-006, DB-009, REL-023, TEST-018, ADM-FIN-001
**My verification:** DB-003 (unit ambiguity) is PARTIALLY FIXED in PR-A. REL-023 / ADM-FIN-001 (DeductWalletModal) is FIXED for the wallet use-cases; the admin `TransactionDialogs.tsx` site not directly verified.
**Highest-leverage fix:** Add `SELECT FOR UPDATE` on every wallet mutation; add a money-unit suffix to all amount columns; add per-day aggregate cap.

### Theme D — Documentation Drift Is the Dominant Risk
Findings: ADR-V001-3 (Next.js version), NET-002 (money storage), NET-003 (Sentry), NET-009 (RBAC roles), C2 (RUNBOOK vs DEPLOYMENT), C4 (Husky vs Lefthook), C6 (Rupees-first)
**My verification:** All explicitly confirmed as TRUE in the prior turn. The "27 of 19 P0s" self-correction by the team is documented.
**Highest-leverage fix:** Add a documentation-lint pass that flags contradictions between canonical reference documents.

### Theme E — Local-Laptop-Only Architecture Is Deliberate but Fragile
Findings: NET-003 (Sentry), CLOUDFLARE_TUNNEL.md (single ingress), DISASTER_RECOVERY.md (RTO/RPO), PM2 cluster mode (INF-009)
**My verification:** TRUE at the architectural level. Voltium is genuinely laptop-only.
**Highest-leverage fix:** Documented but low-leverage in the short term.

### Theme F — Dead Code with Wrong Endpoint, Param-Swap, Stale Copy
Findings: FLT-005 (TopUpUpiScreen 589 lines), FLT-006 (RaiseTicketCard etc. 430 lines), FLT-007 (4 dead domain classes), FLT-008 (4 dead dashboard widgets), WalletRepositoryImpl, RentalRepositoryImpl
**My verification:** `TopUpProofScreen` confirmed as dead code (no callers in `lib/`). Other dead code claims plausible.
**Highest-leverage fix:** Single PR dead-code sweep removing ~2,200 lines in 2-3 hours. See Pass 7 §Dead code sweep in the prior audit.

---

## Top P0 Findings (All Domains) — Cross-Reference

The audit's Appendix A.2 lists all 42 P0s. Most are duplicates of items already enumerated in the chapter tables above. The unique-by-domain list:

| ID | Sev | Finding | Audit Status | Verification (2026-08-29) |
|---|---|---|---|---|
| F-006 | P0 | OTP isNewRider defaults false (KYC bypass) | Open | Unverified |
| F-019 | P0 | Token refresh race + unguarded jsonDecode | Open | **FALSE** — `_safeJsonDecode` + single-flight refresh in place |
| F-020 | P0 | call_log plugin (Play Store policy red flag) | Open | TRUE in isolation, doesn't apply per product |
| SEC-003 / REL-024 | P0 | KYC PII plain-text in admin | Open | **FALSE** — `KycDetailDialog.tsx` has `maskString` with `showPii` reveal toggle |
| SEC-004 / CMP-002 / REL-025 / ADM-PAY-001 | P0 | Payment gateway credentials plain text | Open | **PARTIAL** — `lib/credentials.ts` has AES-256-GCM at rest |
| SEC-006 / INF-004 | P0 | Flutter CI keystore left on disk | Open | Unverified |
| SEC-007 | P0 | Firebase config in plaintext | Open | Unverified |
| SEC-008 | P0 | ALLOW_DEV_PII_KEY hardcoded dev key still in source | Verifying | Unverified |
| SEC-009 / CMP-003 / INF-003 | P0 | DB-backup.sh plaintext SQL dumps | Open | Unverified |
| DB-002 | P0 | No SELECT FOR UPDATE on wallet approve | Open | Unverified |
| DB-003 / NET-002 | P0 | Paise/rupee unit ambiguity systemic | Open | **PARTIAL** — `formatRupeesFromPaise` in PR-A |
| WK-001 / ADR-V005-1 | P0 | Outbox emit() outside transaction | Open | **PARTIAL** — 4xx/transient added in PR-E; txn boundary not verified |
| WK-002 | P0 | 10-20 orphan events per day | Open | Unverified (needs prod logs) |
| WK-003 | P0 | rental-completed self-emitting loop | Open | Unverified |
| WK-004 | P0 | telemetry-cleanup mis-tagged as notification | Open | Unverified |
| WK-005 | P0 | engagement-daily-emitter 287 wasted runs/day | Verifying | Unverified |
| WK-006 | P0 | Worker single-fork (no HA) | Open | Unverified |
| FLT-SOS-001 | P0 | SOS button no-op (safety risk) | Open | **FALSE** — `emergency_sos_screen.dart` captures GPS, dials 112, fires backend alert |
| FLT-WALLET-001 | P0 | Top-up proof submission no-op | Open | **PARTIAL FALSE** — screen has proper `onSubmit` callback; screen is dead code (no parent uses it) |
| FLT-LOGOUT-001 | P0 | Logout does not clear sibling provider state | Open | Unverified |
| FLT-NOTIF-001 | P0 | FCM broken end-to-end (4 compounding bugs) | Open | **PARTIAL** — fixed by PR-A through PR-H |
| FLT-DECIMAL-001 / ADM-FIN-001 / REL-023 | P0 | DeductWalletModal ₹5 not ₹500 | Open | **FIXED in PR-A** for wallet use-cases; admin TransactionDialogs not directly verified |
| ADM-MNT-001 | P0 | Maintenance mode placebo (no middleware) | Open | Unverified |
| ADM-ANNOUNCE-001 | P0 | Admin announcement bypasses FCM | Open | Unverified |
| CMP-001 | P0 | KYC PII plain-text (DPDP) | Open | **FALSE** — same as SEC-003 |
| CMP-010 | P0 | call_log plugin (Play Store) | Open | TRUE in isolation, doesn't apply per product |
| CMP-015 | P0 | Payment credentials plain text (PCI-DSS) | Open | **PARTIAL** — same as SEC-004 |
| ADR-V005-2 | P0 | ADR-0005: 10-20 orphan events per day | Open | Unverified (same as WK-002) |
| ADR-V005-3 | P0 | ADR-0005: rental-completed self-emitting loop | Open | Unverified (same as WK-003) |
| INF-001 | P0 | check-migration-safety.sh is a no-op | Resolved (planned PR-1) | **FALSE** — Ticket #34 hardening already shipped |
| INF-002 | P0 | check-secret-rotation.sh is a fake check | Open | **FALSE** — now wraps a real TS implementation |
| INF-005 | P0 | CI coverage-gap job has continue-on-error: true | Open | Unverified |
| INF-006 | P0 | PM2 kill_timeout / listen_timeout too short | Open (planned PR-6) | Unverified |
| INF-007 | P0 | deploy-prod.sh rollback uses fragile `git revert HEAD` | Open (planned PR-7) | Unverified |
| INF-008 | P0 | deploy-staging job runs on ubuntu-latest (no PM2 state) | Open (planned PR-8) | Unverified |
| INF-009 | P0 | PM2 single-instance "zero downtime" is not zero-downtime | Open (planned PR-9) | Unverified |
| REL-004 | P0 | Public beta entry gates not verified | Verifying | Unverified (out of scope — needs beta laptop) |
| REL-006 | P0 | Public beta exit criteria: 6 manual criteria | Open | Unverified (out of scope) |
| REL-023 | P0 | DeductWalletModal decimal bug | Open | **FIXED in PR-A** for wallet use-cases |
| REL-024 | P0 | KYC PII plain-text | Open | **FALSE** — masking in place |
| REL-025 | P0 | Payment gateway plain-text credentials | Open | **PARTIAL** — encryption layer in place |

**Net of the 42 P0s:**
- **5 are FALSE** (audit got the substance wrong): F-019, FLT-SOS-001, SEC-003/REL-024, INF-001, INF-002
- **3 are PARTIALLY FALSE** (audit overstates): SEC-004/CMP-002/REL-025, CMP-015, DB-003/NET-002
- **1 is PARTIAL** (audit is right but partially fixed): FLT-NOTIF-001
- **2 are TRUE in isolation but don't apply** per product decision: F-020, CMP-010
- **1 is FIXED in the polish batch**: FLT-DECIMAL-001/REL-023 (the wallet use-cases part; the admin TransactionDialogs part not verified)
- **27 are Unverified** by my spot-check (would need per-finding source-grep to confirm)

---

## Severity distribution summary

| Severity | Count | Verified-FALSE | Verified-PARTIAL | Fixed by today's batch | Unverified |
|---|---|---|---|---|---|
| P0 | 42 | 5 | 4 | 1 | 27 |
| P1 | 90 | (spot-checked ~5) | (spot-checked ~2) | 1 (T-95 in PR-E) | ~80 |
| P2 | 166 | (themes) | — | (PR-F logging) | ~160 |
| P3 | 427 | (themes) | — | — | ~420 |
| NET-### | 12 | (verified ~2 as TRUE) | — | (PR-G KYC_INFO_REQUESTED) | ~9 |
| **Total** | **725** | **~5** | **~5** | **~2** | **~700** |

---

## What's NOT in this index

- **Per-finding full description** — see the audit PDF, Chapters 5-13 detailed treatment
- **Per-finding impact** — see the audit PDF
- **Per-finding recommendation** — see the audit PDF and Chapters 14, 16 (remediation roadmap)
- **Per-PR remediation sequencing** — see audit Chapter 16.1-16.5 and the consolidated `WORKFLOWS_DEFERRED_PLAN_2026-08-28.md`
- **Open questions for the team** — see audit Chapter 17.2
- **Audit-vs-audit conflict resolution** — see audit Chapter 15.2 and the verification companion

---

## File metadata

- **Generated:** 2026-09-01
- **Source PDF:** `Voltium_Platform_Deep_Audit.pdf` (dated 29 August 2026)
- **Companion docs:**
  - `D:\voltium\docs\DEEP_AUDIT_VERIFICATION_2026-08-29.md` — runtime verification of the top claims
  - `D:\voltium\docs\WORKFLOWS_FOLLOWUP_PLAN_2026-08-26.md` — the first PR batch
  - `D:\voltium\docs\WORKFLOWS_DEFERRED_PLAN_2026-08-28.md` — the second PR batch
- **Polished via 8 PRs on `fix/workflows-polish-2026-08-28`** (2026-08-28):
  - `0da4dffe` PR-A: paise-formatting, log level, magic number
  - `3698dcaa` PR-B: idempotency module flag, retryFailed error preservation
  - `6be3b5fd` PR-C: FCM topic mute, dead-letter PostHog counter
  - `6e27aac9` PR-D: dedupe fg/bg security-action handlers
  - `1c6a685b` PR-E: T-95 4xx-vs-transient classification
  - `e0b22abb` PR-F: fcm_service.dart revert to appDebug
  - `dc24fc38` PR-G: KYC l10n
  - `c9af6095` PR-H: FCM handlers wire up renderKycPushFromData
