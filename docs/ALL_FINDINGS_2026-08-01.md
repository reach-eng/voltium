# Voltium — Consolidated Findings / Issues / Bugs

**Snapshot date:** 2026-08-01
**Authoritative sources:** `docs/BACKLOG_FINDINGS.md` (Pass 4, 2026-07-30), `docs/REMEDIATION_PLAN_2026-07-31.md` (11 tracks), `docs/FAILED_TESTS_2026-08-01.md` (v2, today), `docs/KNOWN_ISSUES.md`, plus 9 audit docs and 6 remediation plans.
**Branch:** `fix/phase1-critical-blockers` (working tree clean except untracked helper scripts)

> **How to read this:** Statuses are taken from the most recent dated doc that mentions the item. The docs claim a large amount of work as SHIPPED across 40+ PRs (PR-1..PR-20, PR-P1.1..PR-P3.7). Items marked SHIPPED/PARTIAL/STAGED are listed for completeness; the actionable list is §2 (OPEN) + §3 (staging soak) + §5 (failing tests).

---

## 0. Executive summary

| Bucket | Count | Effort |
|---|---|---|
| P0 OPEN (immediate risk) | 1 (#58 mass-assignment... but see note) | ~2 hr |
| P0 PARTIAL (incomplete) | 3 (#50 PII rotation, #54 seed admin123, #59 admin UI v2) | ~1.5 days |
| Staging-soak gated | 3 (#39 PM2 timeouts, #42 PM2 cluster, #40 rollback) + R1.7/R1.8/R1.9 + R6.x | 0 until 2026-08-06 |
| Phase 2 Medium OPEN | 4 | ~8–12 days |
| Phase 3 Low OPEN | 12 | ~5–7 days |
| Trivial/cosmetic batchable | ~120 | ~12–15 hrs |
| **Failing unit tests** | **35 (12 files)** | **~3–4 hr** |
| **Net remaining** | **~21 tickets + 120 trivial + 35 tests** | **~25–30 focused days** |

---

## 1. P0 — Highest severity

### 1.1 OPEN (needs code)

| # | Ticket | Finding | Effort | Notes |
|---|---|---|---|---|
| #58 | `/api/rider/rental/return` mass-assignment | Zod schema lacked `.strict()` allowlist — arbitrary client-supplied fields could be written to the RentalLease record | ~2 hr | **Status conflict:** BACKLOG §3 says OPEN, but Pass 4 §8 re-verified it as STALE ("`.strict()` of 9 fields is present at route.ts:12-23 — audit was wrong"). **Verify before doing work.** |

### 1.2 PARTIAL (code shipped but not complete / needs v2)

| # | Ticket | Finding | What's done | What's missing | Effort |
|---|---|---|---|---|---|
| #50 | `ALLOW_DEV_PII_KEY` not rejected in prod | Zod refine + runtime throw added (PR-8) | ✅ | Full PII key-rotation API is v2 | ~1 day |
| #54 | `seed.ts` hardcodes `admin123` | Replaced with `SEED_ADMIN_PASSWORD` env var + `APP_ENV === 'production'` throw guard at top of file | ✅ | Full prod-blocker integration test is v2 | ~0.5 day |
| #59 | Data-deletion two-person rule + 7-day grace | Route + 2 endpoints (`/approve`, `/restore`) + 3 permission keys + full `createAuditLog` + fail-closed abort shipped | ✅ | Admin UI (`DataDeletionApprovalCard.tsx`) **was shipped in R9 (2026-07-31)** — backlog predates this. Verify. | (done) |

### 1.3 STAGED (code ready, blocked on human/infrastructure steps)

| # | Ticket | Finding | Why staged | Unblocks when |
|---|---|---|---|---|
| #39 | PM2 `kill_timeout` too short | Code written (PR-6): `kill_timeout: 30000`, `listen_timeout: 60000`, `min_uptime: 60s`, `kill_signal: 'SIGINT'` | Needs 24h staging soak | 24h soak passes |
| #42 | PM2 `instances: 1` — not zero-downtime | Code written (PR-8): `instances: 'max', exec_mode: 'cluster'` | **Pass 4 says STALE** — already in cluster mode | Close ticket |
| #40 | Deploy script rollback uses `git revert HEAD` | 4-hr PR; not yet started; soak required | Not started | PR opened + soak |

---

## 2. OPEN — actionable, not blocked

### 2.1 Phase 2 Medium (4 tickets)

| # | Ticket | Finding | Effort |
|---|---|---|---|
| #6 | DB Audit 2.8 — split `RiderLifecycleStatus` enum (15 values) | 15-value enum is a state explosion; R1.8 PR-K.3 adds a 5-value `RiderLifecycleStage`. Migration `20260730150000_add_rider_lifecycle_stage` is in the staging soak. | 3–5 days |
| #27 | Design System 11.3–11.6 — consolidate 10+ card widgets | Duplicated card widget pattern across features | 2–3 days |
| #28 | Design System 11.8 — move 60% of `lib/widgets/*` to `lib/features/*/widgets/*` | Screen-specific widgets sitting in shared lib | 3–5 days |
| (#7 sub-B) | Drop legacy `pickupHub`/`currentPlan`/`teamLeader` string columns on Rider | Schema added FK columns (R1.7 PR-J, staged). Drops after 1-week soak. | gated (see §3) |

### 2.2 Phase 3 Low (12 tickets)

| # | Ticket | Finding | Effort |
|---|---|---|---|
| #4 | Migrate 24 typography aliases → canonical 15 tiers | `flutter/lib/theme/app_typography.dart` | 1 day |
| #5 | Migrate 60+ raw color hues → ~12 semantic tokens | `flutter/lib/theme/app_theme.dart` (partially done by PR-P1.5) | 1–2 days |
| #9 | `Admin.permissions` → `text[]` or relation | DB Audit 2.35; supplanted by R1.9 + `AdminHasPermission` (staged) | 1–2 days |
| #16 | Tidy `lib/fcm.ts`, `lib/firebase-admin.ts`, `lib/job-queue.ts` | Admin Web 1.31/1.32/1.34 (partially done by PR-P1.4) | 1–2 days |
| #17 | Verify `lib/image-optimizer.ts` vs `image-compress.ts` duplication | Trivial verification | 1 hr |
| #21 | Split 30+ admin screens >1,000 lines | Admin Web 6.8–6.39; **largest single piece of remaining work** | 2–4 weeks |
| #22 | Audit 28 small server modules | Admin Web 9.3–9.72 | 1–2 days |
| #23 | Audit 8 worker jobs | Admin Web 10.4–10.18 | 1 day |
| #25 | Verify `contracts/openapi.ts` (84 KB) is up-to-date | Trivial | 0.5 day |
| #26 | Audit top-level shell for structural cleanup | Trivial | 0.5 day |
| #29 | Fix `AppDurations.premiumCurve` | Trivial | 0.5 day |
| #30 | Pre-build `AppTypography` 17 styles in static initializer (perf) | Trivial | 0.5 day |
| #31 | Design system small tidy-ups (6.3, 6.4, 8.7, 10.3) | Trivial batch | 1 day |
| #33 | Additional server module splits (after PR-11) | Admin Web 9.1/9.2/9.6 | 2–3 days |

*(#17, #25, #26, #29, #30, #31 are the only "quick win" items — total ~4 days.)*

---

## 3. Staging-soak-gated work (unlock **2026-08-06**)

5 DB migrations are deployed to staging and aging for 1 week:

| Migration | What it does | Risk if dropped early |
|---|---|---|
| `20260730131814_convert_json_columns` | `String` → `Json` for 5 columns | parse-fail warnings if stale data |
| `20260730140000_add_rider_fk_columns` | Adds `pickupHubId`/`currentPlanId`/`teamLeaderId` | FK violation on cascade |
| `20260730150000_add_rider_lifecycle_stage` | Adds 5-value `RiderLifecycleStage` enum | new enum consumers break |
| `20260730000000_alter_admin_permissions_type` | `String` → `text[]` | array-vs-string confusion |
| `20260730180000_add_admin_has_permissions` | Adds `AdminHasPermission` relation | backfill mismatch |

**Unlocked on 2026-08-06 (provided the soak shows no drift):**

| Track | PR | What it ships |
|---|---|---|
| R1.7 | PR-J | Drop legacy string columns (`pickupHub`/`currentPlan`/`teamLeader` on Rider) |
| R1.8 | PR-K.3 | Drop legacy `RiderLifecycleStatus` enum (15 values → 5-value `RiderLifecycleStage` consumers) |
| R1.9 | PR-D.2 | Drop legacy `Admin.permissions: String[]` (now lives in `AdminHasPermission` relation) |
| R6.1–R6.5 | (5 PRs) | Admin use-cases migration to write to the new relation |
| #7 sub-B | PR-P3.2 follow-up | Drop legacy FK-pair strings |

**Daily until 2026-08-06:** query staging DB for drift in changed columns; watch app logs for FK violations; re-grep integration tests. (~5 min/day)

---

## 4. SHIPPED / CLOSED / STALE — for the record

**All 19 Phase 1 P0s are SHIPPED** (17 fully, #50/#54 partially, #58 disputed):

| # | Ticket | Status |
|---|---|---|
| #34 | `check-migration-safety.sh` exits 0 | SHIPPED (PR-1) |
| #35 | `check-secret-rotation.sh` fake check | SHIPPED (PR-2) |
| #36 | `db-backup.sh` plaintext dumps | SHIPPED (PR-3) |
| #37 | Flutter CI keystore on disk | SHIPPED (PR-4) |
| #38 | CI coverage-gap silently passes | SHIPPED (PR-5) |
| #41 | `ci-cd.yml` deploy-staging no-op | SHIPPED (PR-7) |
| #43 | Deploy script cleanup batch | SHIPPED (PR-20) |
| #44 | SMS OTP says "Ryd" not "Voltium" | SHIPPED (PR-9) |
| #45 | `security-events.ts` PII leak | SHIPPED (PR-10) |
| #46 | Dev OTP `'111111'` accepted for any phone | SHIPPED (PR-11) |
| #47 | `cron-auth.ts` length-check timing leak | SHIPPED (PR-12) |
| #48 | `NODE_ENV` → `APP_ENV` for security gates | SHIPPED (PR-13) |
| #49 | OTP `===` non-constant-time | SHIPPED (PR-14) |
| #51 | Rate limiter trusts `cf-connecting-ip` | SHIPPED (PR-15) |
| #52 | Self-referral + `exists` enumeration | SHIPPED (PR-16) |
| #53 | `info` security events not audit-logged | SHIPPED (PR-17) |
| #55 | `TEST_MODE` no schema validation | SHIPPED (PR-18) |
| #56 | backups path-traversal | SHIPPED (PR-19) |
| #57 | verify-lock impersonation | SHIPPED (PR-16) |
| #60 | internal/worker + admin/jobs auth | SHIPPED |

**Closed as audit-correction:** #20 (admin `index.tsx` is 21 lines, not 1,139), #63 (URL alias consolidation — verified as documented legacy re-exports).

**Pass 4 stale audit claims (10 of 16 re-checks):** AUDIT_API_DEEP #1 (webhook fail-closed), #5 (rental/return `.strict()` present), #6/#9/#10 (all SHIPPED); AUDIT_DATABASE 2.2 (`lockPasswordHash` hashed); AUDIT_DESIGN_SYSTEM 3.1/4.1 (primary color = `#0053C1`); AUDIT_FINDINGS_ADMINPANEL 1.4 (impersonation env-gated); AUDIT_INFRASTRUCTURE 2.1/2.2/2.4/2.8 (PM2 already cluster); AUDIT_SECURITY 3.1/4.1 (PII key 3-layer defense + `maskEmail` fixed).

---

## 5. Currently failing tests — 35 failed / 1830 passing / 3 skipped (`v2`, today)

Root-cause patterns: stub mismatches (#1), features not yet implemented (#2), missing module imports (#3), schema drift (#4), too-lenient stubs (#5), too-strict stubs (#6), stubs not delegating (#7), test-env issues (#8).

### By file

| File | Failed | Pattern | Fix |
|---|---|---|---|
| `tests/unit/rate-limit.test.ts` | **9** | #2 | **Design decision needed:** implement DB-backed token bucket (~1–2 hr) **OR** rewrite tests for in-memory path (~30 min). Tests mock `db.rateLimitBucket.*` but `rate-limit.ts` is in-memory. |
| `tests/unit/use-cases.test.ts` | **9** | #1 | `bookRental`, `syncPickup`, support, wallet use-case stubs too minimal. Fixtures expect rental/faq/wallet repository behavior not yet stubbed. ~30 min each. |
| `tests/unit/restore-safety.test.ts` | **5** | #1 | Extend `restore.service.ts` stub — test expects `startRestore` to call `backupService.createPreRestoreBackup()` + `restoreService.lockDatabase()`. |
| `tests/unit/cache.test.ts` | **2** | #2 | `cache.ts` needs LRU semantics (`promotes accessed keys under LRU`, `getCacheStats empty`). |
| `tests/unit/job-queue.test.ts` | **2** | #2/#1 | Reaper per-type thresholds — SQL has `CASE WHEN JobType` but fixture may be misaligned. |
| `tests/unit/device-data-bypass.test.ts` | **1** | #2 | Add `APP_ENV` check to `api/device/data/route.ts` (Ticket #55 follow-up) — reject dev-bypass in staging even if `TEST_MODE` is true. |
| `tests/unit/api-routes-rider-vs-riders.test.ts` | **1** | #2 | Grep `web/src` for `/api/riders/`; update to `/api/admin/riders/`. |
| `tests/unit/rate-limit-trust-headers.test.ts` | **1** | #2 | Add `TRUST_PROXY_HEADERS` env var to `rate-limit-middleware.ts` (Ticket #51). |
| `tests/unit/support-service.test.ts` | **1** | #1 | Stub delegates to `db.supportTicket.findMany` but test mocks `supportRepository.findByRiderId`. |
| `tests/unit/thin-modules-smoke-batch2.test.ts` | **1** | #2 | `coupons.use-cases.ts` `create()` must uppercase `code` and convert dates. |
| `tests/unit/wallet-audit-fixes.test.ts` | **1** | #2 | DELETE `/api/transaction/history` must return 403. |
| `tests/unit/workers/scheduled-backup.job.test.ts` | **1** | #8 | Fails on Windows — `/tmp/backup` doesn't exist; make backup dir configurable. |

### Recommended batch order
1. **Quick 5-min fixes** (4 tests): device-data-bypass APP_ENV, rider-vs-riders grep, support-service stub, wallet-audit 403, scheduled-backup dir.
2. **Stub extensions** (~1.5 hr): use-cases (9) + restore-safety (5) + support-service (1).
3. **Real fixes** (~2 hr): cache LRU, reaper, rate-limit trust-headers, cookies.
4. **Biggest decision:** rate-limit DB bucket vs. test rewrite.

### Design decisions pending in the test tail
- Implement DB-backed rate limiter, or document that in-memory is the intended single-process behavior?
- Implement real restore-safety pattern (pre-restore backup + lock), or keep the current route + stub the test?
- Build out real use-case behavior for bookRental/syncPickup, or keep tests as stub-contract tests?

---

## 6. Test infrastructure / CI collateral issues (from this session)

From `docs/FAILED_TESTS_2026-08-01.md` recent commits:

- 4 broken "R3" admin screen splits were **reverted** (`ee60417 revert(admin): revert 4 broken R3 screen splits`, `02facf1 revert TransactionManagement R3 split`)
- 12 module **stubs** created to satisfy test imports (`4dc76dd`)
- Data-management backup route files deemed broken and **trashed**
- `instrumentation.ts` reverted; `RiderDetailDialog startEditing` type fixed
- `amountInPaise` field-name corrections in `transaction.create`
- `types/admin.ts` and `lib/admin-ui.ts` created (canonical admin types + `getKycBadge`)
- `send-otp/route.ts` response shape (no `exists` field) — Ticket #52
- `internal/worker/route.ts` + `workers/index.ts` now use `OutboxEventTypes` — Ticket #2
- `PUT_updateTicket` id validation guard
- `wallet-reconciliation.job.ts` AlertPayload shape
- `ALLOW_DEV_PII_KEY` rejection wired in `env.ts`

---

## 7. Source map (where each finding class lives)

| Source doc | What it tracks | Volume |
|---|---|---|
| `docs/AUDIT_API_DEEP.md` | API deep review | 60+ |
| `docs/AUDIT_BACKEND.md` | Backend review | ~250 |
| `docs/AUDIT_DATABASE.md` | Database review | 67 |
| `docs/AUDIT_DESIGN_SYSTEM.md` | Design system | 53 |
| `docs/AUDIT_FINDINGS_ADMINPANEL.md` | Admin panel | 138 |
| `docs/AUDIT_FINDINGS_RIDERAPP.md` | Rider app | 161 |
| `docs/AUDIT_INFRASTRUCTURE.md` | Infrastructure | 110+ |
| `docs/AUDIT_SECURITY.md` | Security | ~75 |
| `docs/AUDIT_WORKERS.md` | Workers | 30+ |
| `docs/DB_REMEDIATION_PLAN.md` | DB plan | 10 PRs / 61 findings |
| `docs/DESIGN_SYSTEM_PLAN.md` | Design plan | 7 PRs / 48 findings |
| `docs/ADMIN_WEB_PLAN.md` | Admin plan | 11 PRs / 30 findings |
| `docs/RIDER_APP_PLAN.md` | Rider plan | 14 PRs / 30 findings |
| `docs/INFRASTRUCTURE_PLAN.md` | Infra plan | 10 PRs / 30 findings |
| `docs/SECURITY_PLAN.md` | Security plan | 10 PRs / 30 findings |
| `docs/FOLLOWUP_TICKETS.md` | Master backlog | 63 tickets + 131 trivial |
| `docs/BACKLOG_FINDINGS.md` | Pass 4 dashboard | this file supersedes the ticket list |
| `docs/FAILED_TESTS_2026-08-01.md` | Today's test failures | 35 |
| `docs/KNOWN_ISSUES.md` | Public-beta accept-with-fix list | 6 open follow-ups |

---

## 8. Bottom line (what's actually "real" work left)

1. **Today's 35 failing tests** (~3–4 hr, mostly quick stubs; rate-limit is the only design decision).
2. **One P0 that may already be fixed (#58)** — verify before working.
3. **Three P0 partials (#50, #54, #59)** — ~1.5 days of v2 polish.
4. **Three staging-soak items (#39, #42*, #40)** — #42 is likely already done (Pass 4 says stale).
5. **2026-08-06 unlock:** 5 DB drop migrations + R6 admin-side migration series.
6. **4 Medium + 12 Low + ~120 trivial** — the "polish sprint" backlog.
7. **Biggest single open chunk:** #21 — split 30+ admin screens >1,000 lines (2–4 weeks).
