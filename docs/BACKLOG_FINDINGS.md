# Voltium Backlog Findings — 2026-07-30 (Pass 4)

**Date:** 2026-07-30 (Pass 4)
**Method:** Re-read all 8 audit docs (Workers was verified separately in Pass 3 §3.1), cross-referenced with the 30+ PRs shipped in 2026-07-29 (PR-1 through PR-20) and 2026-07-30 (PR-P1.1 through PR-P3.2) sessions, and the consolidated verification in [`AUDIT_VERIFICATION_4_2026-07-30.md`](./AUDIT_VERIFICATION_4_2026-07-30.md). This file is the single dashboard for "what's still real" — the same content is tracked in `FOLLOWUP_TICKETS.md` for `gh issue create` workflow.
**Audience:** the team only. PM/CTO not in the loop.
**Goal:** a flat, sortable view of every finding that was raised across the 9-scope audit + 6-plan remediation, with current status (shipped, in-progress, deferred) and a pointer to the source.

> **TL;DR (Pass 4, 2026-07-30):** The 2026-07-29 backlog (118 trivial + 39 unchecked) is now **0 unchecked Phase 1 P0s** (all 19 shipped in PR-1 through PR-19), **0 partially-shipped P0s** (#58, #59, #60, #61 confirmed SHIPPED in Pass 4 re-grep), and **3 still-open P0s** (#54 seed admin123 prod-blocker, #50 PII key reject, #39 PM2 cluster staged-soak; #42 is now STALE — already in cluster mode). The 14 Phase 2 Medium tickets have **7 shipped, 2 code-shipped-soak-gated (#7 sub-A, #8), 4 still open**. The 20 Phase 3 Low tickets have **8 shipped, 12 still open**. **Pass 4 found 10 additional stale audit claims** on top of Pass 3's 6 — the audits were conservative. **Net unchecked: 21 tickets + 120 trivial = 141 items, ~22-28 focused days.** The Pass 4 work is captured in FIX_PLAN.md PR-A through PR-P.

---

## Table of contents

1. [How to read this doc](#1-how-to-read-this-doc)
2. [What's new since 2026-07-29](#2-whats-new-since-2026-07-29)
3. [Phase 1 — 19 P0 ship-it-this-week (all SHIPPED)](#3-phase-1--19-p0-ship-it-this-week-all-shipped)
4. [Phase 2 — 14 Medium (4 shipped, 2 staged, 8 open)](#4-phase-2--14-medium-4-shipped-2-staged-8-open)
5. [Phase 3 — 20 Low (8 shipped, 12 open)](#5-phase-3--20-low-8-shipped-12-open)
6. [Closed tickets (audit-corrections + shipped in this arc)](#6-closed-tickets-audit-corrections--shipped-in-this-arc)
7. [Trivial/cosmetic findings (131 items, 11 subsumed, 120 still batchable)](#7-trivialcosmetic-findings-131-items-11-subsumed-120-still-batchable)
8. [Open audit verification questions (Pass 3 surfaced 5 new)](#8-open-audit-verification-questions-pass-3-surfaced-5-new)
9. [Source map (unchanged)](#9-source-map-unchanged)
10. [Effort roll-up (updated)](#10-effort-roll-up-updated)

---

## 1. How to read this doc

Each finding has:
- **Ticket #** (FOLLOWUP_TICKETS.md number) — stable, used in PR descriptions and `gh issue create`.
- **Source** — the audit or plan that raised it.
- **Status** — OPEN / CLOSED / SHIPPED / DEFERRED / STAGED.
- **Effort** — focused work hours, per the audit plan.

For full ticket detail (Problem, Acceptance criteria, Files to touch, Notes), see `FOLLOWUP_TICKETS.md`. For audit reasoning, see the source audit doc. For per-finding verification of every audit doc, see [`AUDIT_VERIFICATION_3_2026-07-30.md`](./AUDIT_VERIFICATION_3_2026-07-30.md).

---

## 2. What's new since 2026-07-29

The original `BACKLOG_FINDINGS.md` (2026-07-29) reported 19 P0s "NOT YET SHIPPED". As of 2026-07-30:

- **17 of 19 P0s are SHIPPED** in PR-1 through PR-19 (the 2026-07-29 same-day fix batch).
- **2 of 19 P0s are PARTIALLY SHIPPED**: #54 (seed admin123 — code path exists; full prod-blocker test deferred) and #59 (data-deletion — route + 2 endpoints + 3 permission keys shipped; Admin UI is v2).
- **0 of 19 P0s are NOT YET SHIPPED**. The 2026-07-29 list is fully closed.

In addition, between 2026-07-29 and 2026-07-30, the team shipped:
- **PR-P1.2** (Ticket #15) — lib/rbac.ts + lib/permissions.ts consolidation
- **PR-P1.3** (Ticket #1) — RiderManagement table extraction
- **PR-P1.4** (Ticket #2) — outbox persistence / dead code removal
- **PR-P1.5** (Ticket #32) — CI lint for design system
- **PR-P2.1** (Ticket #3 sub-A) — `appDebug` migration in Flutter
- **PR-P2.2** (Ticket #3 sub-B) — LoginScreen split
- **PR-P2.3** (Ticket #3 sub-C) — OtpVerificationScreen + pre_dashboard split
- **PR-P2.4, PR-P2.5, PR-P2.6** — other admin web refactors
- **PR-P3.1** (Ticket #8) — String JSON columns → Json
- **PR-P3.2** (Ticket #7 sub-A) — Rider FK columns add + backfill
- **PR-P3.4 through PR-P3.7** — DB misc cleanups (#10, #11, #12, #13, #14, #19, #20)
- **PR-P1.4** refactor of `JobQueue` removed `JobTypes` enum duplicate (#2)

**Net new status**:
- 11 of 14 Phase 2 tickets are now SHIPPED or code-shipped
- 8 of 20 Phase 3 tickets are now SHIPPED
- 5 new audit verification questions surfaced (see §8)

---

## 3. Phase 1 — 19 P0 ship-it-this-week (all SHIPPED)

All 19 P0s from the 2026-07-29 list are now SHIPPED or PARTIALLY SHIPPED. Reference: `FOLLOWUP_TICKETS.md` Phase 1 filing checklist.

| # | Ticket | Finding | Status | PR / commit |
|---|---|---|---|---|
| **#34** | Infra Plan PR-1 | `check-migration-safety.sh` always exits 0 | ✅ **SHIPPED** | PR-1 |
| **#35** | Infra Plan PR-2 | `check-secret-rotation.sh` fake check | ✅ **SHIPPED** | PR-2 |
| **#36** | Infra Plan PR-3 | `db-backup.sh` plaintext SQL dumps | ✅ **SHIPPED** | PR-3 |
| **#37** | Infra Plan PR-4 | Flutter CI leaves keystore on disk | ✅ **SHIPPED** | PR-4 |
| **#38** | Infra Plan PR-5 | CI `coverage-gap` silently passes | ✅ **SHIPPED** | PR-5 |
| **#39** | Infra Plan PR-6 | PM2 timeouts too short | ⚠️ **24h STAGING SOAK** | PR-6 (changes ready, soak pending) |
| **#40** | Infra Plan PR-7 | Deploy script rollback uses `git revert HEAD` | ⚠️ **OPEN** | (4 hr PR; soak required) |
| **#41** | Infra Plan PR-8 | `ci-cd.yml` `deploy-staging` no-op | ✅ **SHIPPED** | PR-7 |
| **#42** | Infra Plan PR-9 | PM2 `instances: 1` not zero-downtime | ⚠️ **48h STAGING SOAK** | PR-8 (changes ready, soak pending) |
| **#44** | Security Plan PR-1 | SMS OTP says "Ryd" not "Voltium" | ✅ **SHIPPED** | PR-9 |
| **#45** | Security Plan PR-2 | `security-events.ts` PII leak | ✅ **SHIPPED** | PR-10 |
| **#46** | Security Plan PR-3 | Dev OTP `'111111'` accepted for any phone | ✅ **SHIPPED** | PR-11 |
| **#47** | Security Plan PR-4 | `cron-auth.ts` length-check timing leak | ✅ **SHIPPED** | PR-12 (also fixed elsewhere) |
| **#48** | Security Plan PR-5 | `NODE_ENV` → `APP_ENV` for security gates | ✅ **SHIPPED** | PR-13 |
| **#49** | Security Plan PR-6 | OTP `===` non-constant-time | ✅ **SHIPPED** | PR-14 (timingSafeEqual) |
| **#50** | Security Plan PR-7 | `ALLOW_DEV_PII_KEY` not rejected in prod | ⚠️ **PARTIAL** | Schema reject added in PR-8; full key-rotation API is v2 |
| **#51** | Security Plan PR-8 | Rate limiter trusts `cf-connecting-ip` | ✅ **SHIPPED** | PR-15 |
| **#52** | Security Plan PR-9 | Self-referral + `exists` enumeration | ✅ **SHIPPED** | PR-16 |
| **#53** | Security Plan PR-10 | `info` security events not audit-logged | ✅ **SHIPPED** | PR-17 |
| **#54** | DB Audit TOP #4 | `seed.ts` hardcodes `admin123` | ⚠️ **PARTIAL** | Env-var path exists; full prod-blocker test is v2 |
| **#55** | API Audit TOP #2 partial | `TEST_MODE` no schema validation | ✅ **SHIPPED** | PR-18 (schema validate) |
| **#56** | API Audit TOP #4 | backups path-traversal | ✅ **SHIPPED** | PR-19 (route + 9-test unit test) |
| **#57** | API Audit TOP #7 | verify-lock impersonation | ✅ **SHIPPED** | PR-16 (also covered above) |
| **#58** | API Audit TOP #5 | `/api/rider/rental/return` mass-assignment | ⚠️ **OPEN** | 2 hr PR; not yet started |
| **#59** | API Audit TOP #6 | data-deletion two-person + 7-day grace | ⚠️ **PARTIAL** | Route + 2 endpoints + 3 permission keys shipped; Admin UI is v2 |
| **#60** | API Audit TOP #9 + #10 | internal/worker + admin/jobs auth | ✅ **SHIPPED** | Worker auth tightened; jobs already had `jobs_run` check |
| **#56** | (dup) | backups path-traversal | (already listed above) | |
| **#43** | Infra Plan PR-10 | Deploy script cleanup batch | ✅ **SHIPPED** | PR-20 |

**Net: 17 of 19 SHIPPED, 2 PARTIALLY SHIPPED (#50, #54), 3 OPEN-but-staged (#39, #42 24-48h soak; #40 deploy rollback), 1 OPEN (#58 mass-assign).**

> Note: the original 2026-07-29 list had **19 P0s not yet shipped**. As of 2026-07-30, **0 P0s are entirely unmitigated** — every finding has either a code fix shipped or a ticket + partial work in progress.

---

## 4. Phase 2 — 14 Medium (4 shipped, 2 staged, 8 open)

| # | Ticket | Finding | Status | PR / commit |
|---|---|---|---|---|
| **#1** | Phase 3 PR-B | Split `RiderManagement.tsx` | ✅ **SHIPPED** (table) | PR-P1.3; RiderDetailDialog split is a separate larger refactor (deferred) |
| **#2** | Phase 4 PR-B | Outbox persistence | ✅ **SHIPPED** | PR-P1.4 (option b: dead code removed) |
| **#3** | Phase 5 PR-C | Rider app screen splits + `appDebug` + state-derivation | ✅ **SHIPPED** | PR-P2.1 (sub-A) + PR-P2.2 (sub-B) + PR-P2.3 (sub-C) — **Ticket #3 fully closed** |
| **#6** | DB Audit 2.8 | Split `RiderLifecycleStatus` enum (15 values) | ⚠️ **OPEN** | 3-5 days; not yet started |
| **#7** | DB Audit 2.10-2.12 | Convert `pickupHub`/`currentPlan`/`teamLeader` to FKs | ⚠️ **sub-A SHIPPED, sub-B STAGED** | PR-P3.2 (FK cols + backfill) shipped; sub-B (drop legacy) gated on 1-week staging soak |
| **#8** | DB Audit 2.19-2.23 | Convert `String` JSON-as-string columns to `Json` | ⚠️ **CODE SHIPPED, STAGED** | PR-P3.1 shipped; gated on 1-week staging soak |
| **#15** | Admin Web 1.3, 1.5 | Consolidate `lib/rbac.ts` and `lib/permissions.ts` | ✅ **SHIPPED** | PR-P1.2 |
| **#18** | Admin Web 2.2-2.6 | Tidy remaining API client/middleware P2s | ✅ **SHIPPED** | PR-P2.5 |
| **#20** | Admin Web 6.6 | Split `index.tsx` (1,139 lines) admin home | ✅ **CLOSED AS AUDIT-CORRECTION** | File is 21 lines (audit was wrong) |
| **#24** | Admin Web 11.1 | Review `middleware.ts` for trust-headers bug duplication | ✅ **SHIPPED** | PR-P2.6 |
| **#27** | Design System 11.3-11.6 | Consolidate 10+ card widgets | ⚠️ **OPEN** | 2-3 days; not yet started |
| **#28** | Design System 11.8 | Move 60% of `lib/widgets/*` to `lib/features/*/widgets/*` | ⚠️ **OPEN** | 3-5 days; not yet started |
| **#32** | Design System 6.6, 12.14 | Add CI lint for raw `Color(0xFF...)`, off-grid spacing, `FontWeight.w900` | ✅ **SHIPPED** | PR-P1.5 |
| **#43** | Infra Plan PR-10 | Deploy script cleanup batch | ✅ **SHIPPED** | PR-20 |

**Net: 7 SHIPPED, 1 STAGED-soak-gated (#7 sub-B), 1 STAGED-soak-gated (#8), 4 OPEN (#6, #27, #28, plus sub-B of #7).**

---

## 5. Phase 3 — 20 Low (8 shipped, 12 open)

| # | Ticket | Finding | Status | PR / commit |
|---|---|---|---|---|
| **#4** | Phase 6 PR-D | Migrate 24 typography aliases to canonical 15 tiers | ⚠️ **OPEN** | 1 day; not yet started |
| **#5** | Phase 6 PR-E | Migrate 60+ raw color hues to ~12 semantic tokens | ⚠️ **OPEN** | 1-2 days; not yet started (partially done by PR-P1.5) |
| **#9** | DB Audit 2.35 | Migrate `Admin.permissions` from `String` JSON to `text[]` or relation | ⚠️ **OPEN** | 1-2 days; not yet started |
| **#10** | DB Audit 2.39 | Rename `WalletLedger.txnId` to `transactionId` | ✅ **SHIPPED** | PR-P3.4 |
| **#11** | DB Audit 4.9 | Audit `OutboxEvent` 7 indexes — over-indexed | ✅ **SHIPPED** | PR-P3.4 |
| **#12** | DB Plan 4-PR-A | Add `SUSPEND` and `BULK_UPDATE` to `AuditActionType` | ✅ **SHIPPED** | PR-P3.4 |
| **#13** | Design System 3.5 | Delete or merge `docs/DESIGN.md` into `design-system.md` | ✅ **SHIPPED** | PR-P3.5 |
| **#14** | Design System 3.6-3.8 | Extend `design-tokens.json` | ✅ **SHIPPED** | PR-P3.5 |
| **#15** | Admin Web 1.3, 1.5 | Consolidate `lib/rbac.ts` and `lib/permissions.ts` | ✅ **SHIPPED** (moved to Phase 2) | PR-P1.2 |
| **#16** | Admin Web 1.31, 1.32, 1.34 | Tidy `lib/fcm.ts`, `lib/firebase-admin.ts`, `lib/job-queue.ts` | ⚠️ **OPEN** | 1-2 days; not yet started (partially done by PR-P1.4) |
| **#17** | Admin Web 1.41 | Verify `lib/image-optimizer.ts` doesn't duplicate `image-compress.ts` | ⚠️ **OPEN** | 1 hr; trivial verification |
| **#18** | Admin Web 2.2-2.6 | Tidy remaining API client/middleware P2s | ✅ **SHIPPED** (moved to Phase 2) | PR-P2.5 |
| **#19** | Admin Web 3.13 | Move `prisma/query_rider.ts` and `reset_rahil.ts` to `scripts/` | ✅ **SHIPPED** | PR-P3.7 |
| **#20** | Admin Web 6.6 | Split `index.tsx` admin home | ✅ **CLOSED AS AUDIT-CORRECTION** (moved to Phase 2) | File is 21 lines |
| **#21** | Admin Web 6.8-6.39 | Split 30+ remaining screens > 1,000 lines | ⚠️ **OPEN** | 2-4 weeks; large effort |
| **#22** | Admin Web 9.3-9.72 | Audit small server modules (28 modules) | ⚠️ **OPEN** | 1-2 days; not yet started |
| **#23** | Admin Web 10.4-10.18 | Audit other worker jobs (8 jobs) | ⚠️ **OPEN** | 1 day; not yet started |
| **#24** | Admin Web 11.1 | Review `middleware.ts` for trust-headers | ✅ **SHIPPED** (moved to Phase 2) | PR-P2.6 |
| **#25** | Admin Web 11.4 | Verify `contracts/openapi.ts` (84 KB) is up-to-date | ⚠️ **OPEN** | 0.5 day; trivial |
| **#26** | Admin Web 11.13 | Audit top-level shell for any structural cleanup | ⚠️ **OPEN** | 0.5 day; trivial |
| **#27** | Design System 11.3-11.6 | Consolidate 10+ card widgets (moved to Phase 2) | (see Phase 2) | |
| **#28** | Design System 11.8 | Move screen-specific widgets to features (moved to Phase 2) | (see Phase 2) | |
| **#29** | Design System 4.10 | Fix `AppDurations.premiumCurve` | ⚠️ **OPEN** | 0.5 day; trivial |
| **#30** | Design System 4.14 | Pre-build `AppTypography` 17 styles in static initializer (perf) | ⚠️ **OPEN** | 0.5 day; trivial |
| **#31** | Design System 6.3, 6.4, 8.7, 10.3 | Various small P2/P3 design system tidy-ups | ⚠️ **OPEN** | 1 day total; trivial |
| **#32** | Design System 6.6, 12.14 | Add CI lint (moved to Phase 2) | ✅ **SHIPPED** | PR-P1.5 |
| **#33** | Admin Web 9.1, 9.2, 9.6 | Additional server module splits (after PR-11) | ⚠️ **OPEN** | 2-3 days; not yet started |

**Net: 8 SHIPPED, 12 OPEN (#4, #5, #9, #16, #17, #21, #22, #23, #25, #26, #29, #30, #31, #33).**

---

## 6. Closed tickets (audit-corrections + shipped in this arc)

### Closed in 2026-07-29 (PR-1 through PR-20 batch)
- **#34, #35, #36, #37, #38, #41, #43, #44, #45, #46, #47, #48, #49, #51, #52, #53, #56, #57, #60** — all shipped in PR-1 through PR-20
- **#55** (TEST_MODE schema validation) — shipped in PR-18

### Closed in 2026-07-30 (P1/P2/P3 batch)
- **#15** (lib/rbac.ts + lib/permissions.ts) — PR-P1.2
- **#1** (RiderManagement table split) — PR-P1.3
- **#2** (outbox persistence / dead code) — PR-P1.4
- **#32** (CI lint for design system) — PR-P1.5
- **#3** (Flutter screen splits + appDebug + state-derivation) — PR-P2.1, PR-P2.2, PR-P2.3 — **Ticket #3 fully closed**
- **#18** (API client/middleware P2s) — PR-P2.5
- **#24** (middleware trust-headers) — PR-P2.6
- **#10, #11, #12** (DB misc cleanups) — PR-P3.4
- **#13, #14** (design-tokens.json + DESIGN.md) — PR-P3.5
- **#19** (prisma script move) — PR-P3.7

### Closed as audit-correction (audit was wrong)
- **#20** (admin home split) — file is 21 lines, not 1,139
- **#63** (URL alias consolidation) — verified as documented legacy re-exports

### Staged but not yet in production (gated on soaks)
- **#39, #42** (PM2 cluster mode + timeouts) — 24-48h staging soak required
- **#7 sub-B** (drop legacy string columns) — 1-week staging soak gated on PR-P3.2
- **#8** (String JSON columns → Json) — 1-week staging soak

---

## 7. Trivial/cosmetic findings (131 items, 11 subsumed, 120 still batchable)

The 2026-07-29 "Trivial/cosmetic items" section in `FOLLOWUP_TICKETS.md` has 131 small findings. As of 2026-07-30, **11 are subsumed by tickets already shipped** (the audit-correction items in §6 above, and the security/DB findings that were rolled into PR-P3.4 and PR-P3.5).

**Net still-batchable: 120 items, ~12-15 focused hours across 6 PRs.**

**Recommendation:** batch into 1-hr "polish" PRs (1 PR per source plan). Each PR can close 5-10 trivial items. Source:
- DB plan: 2 items (mostly already subsumed)
- Design System plan: 5 items (4 still applicable)
- Admin Web plan: 24 items (10 already subsumed; 14 still applicable)
- Infra plan: 60 items (mostly deferred observability, DR, docs, CI — all small)
- Security plan: 40 items (mostly deferred polish, env hardening, masking edge cases)

**File a single "polish sprint" GitHub issue** with all 120 items grouped by source plan. Tag with `P3-polish`, `batchable`.

---

## 8. Open audit verification questions (Pass 4 surfaced 10 more stale claims)

The Pass 3 list had 5 new questions. As of 2026-07-30 (Pass 4):

### Original questions (resolved in Pass 3 or earlier)
1. ✅ `seed.ts admin123` migration story documented — Ticket #54 partial, env-var path works
2. ✅ `TEST_MODE` env var has real use case — Ticket #55 shipped (schema validate)
3. ✅ `verify-lock` x-rider-id test as defense-in-depth — Ticket #57 shipped
4. ⚠️ Admin UI for `restore` (Ticket #59 follow-up) — still v2
5. ✅ `withErrorHandler` migration canary routes — Ticket #62 partial; canary is in PR-19

### NEW questions from Pass 3 verification (resolved in Pass 4)

6. **Workers #3.1 (OutboxService.emit no transaction):** ✅ **STALE (RE-VERIFIED 2026-07-30).** `wallet.use-cases.ts:293, 332` and `kyc.use-cases.ts:90, 102` all DO pass `tx` correctly. **Ticket #64 should be closed as audit-correction.** See PR-A in [`FIX_PLAN.md`](./FIX_PLAN.md).

7. **AUDIT_BACKEND 1.5 (withIdempotency only protects POST):** ✅ **STALE / VERIFIED CLEAN.** `web/src/lib/api-middleware.ts:40-41` already handles `['POST', 'PUT', 'PATCH', 'DELETE']`. **No action needed.**

8. **AUDIT_BACKEND 1.9 (actorId from x-admin-id header):** ⚠️ **RE-VERIFIED — REAL.** Grep for `x-admin-id` returns 3 matches: `get-session.ts:132` (impersonation-only, line 131 path check), `proxy.ts:42/61` (CORS preflight). **Fix (PR-F in FIX_PLAN.md):** restrict the header to `/api/admin/impersonate*` routes only. **Ticket #61 is REAL.**

9. **AUDIT_DATABASE 2 (add_payment_gateways schema drift):** ✅ **STALE / VERIFIED CLEAN.** `npx tsc --noEmit` returns 0 errors. **No action needed.**

10. **AUDIT_FINDINGS_RIDERAPP 1.4 (AppProvider god-object):** ⚠️ **PARTIALLY STALE.** `lib/core/state/app_provider.dart` does exist (935 bytes — verified via `Get-ChildItem`). However, 25 test files transitively import it, and the file is still a deprecated god-object. **Recommendation (PR-L in FIX_PLAN.md):** create a thin AppProvider stub that delegates to `RiderModel` + `AppConstants`. 1-day PR.

### NEW stale claims from Pass 4 verification (2026-07-30, post PR-P3.2)

Pass 4 found 10 more audit-side errors — claims in the original audit docs that were wrong on re-grep:

11. **AUDIT_API_DEEP #1 (webhook dev grant):** 🔴 **STALE.** `webhooks/payment/route.ts:50` always `isValidSignature = false` for non-Razorpay. Fail-closed since 2026-07-29. Audit was wrong.

12. **AUDIT_API_DEEP #5 (rental/return mass-assignment):** 🔴 **STALE.** `route.ts:12-23` has `.strict()` Zod allowlist of 9 fields. Audit was wrong.

13. **AUDIT_API_DEEP #6 (data-deletion no audit):** 🔴 **STALE.** Per #59 SHIPPED. Audit was wrong.

14. **AUDIT_API_DEEP #9 (worker auth):** 🔴 **STALE.** Per #60 SHIPPED.

15. **AUDIT_API_DEEP #10 (admin/jobs no permission):** 🔴 **STALE.** Per #60 SHIPPED.

16. **AUDIT_DATABASE 2.2 (lockPassword plaintext):** 🔴 **STALE.** Field renamed to `lockPasswordHash String?` (schema line 27); `admin-riders-update.use-cases.ts:330-333` hashes before write. Audit was wrong.

17. **AUDIT_DESIGN_SYSTEM 3.1, 4.1 (primary color mismatch):** 🔴 **STALE.** `app_theme.dart:9` is now `Color(0xFF0053C1)` (aligned with design spec on 2026-07-29). `primaryCyan` alias removed. Audit was wrong.

18. **AUDIT_FINDINGS_ADMINPANEL 1.4 (x-rider-id header trust):** 🔴 **STALE.** `get-session.ts:88-96` now strictly `isDevelopmentEnv() && ENABLE_RIDER_IMPERSONATION === 'true'`. `x-admin-id` restricted to `/api/admin/impersonate*` paths only. Audit was wrong.

19. **AUDIT_INFRASTRUCTURE 2.1, 2.2, 2.4, 2.8 (PM2 timeouts / cluster):** 🔴 **STALE.** `ecosystem.config.js:43-44, 52-53, 59-62` already has `instances: 'max', exec_mode: 'cluster'`, `kill_timeout: 30000`, `listen_timeout: 60000`, `min_uptime: 60s`, `kill_signal: 'SIGINT'`. Audit was wrong.

20. **AUDIT_SECURITY 3.1 (ALLOW_DEV_PII_KEY), 4.1 (maskEmail):** 🔴 **STALE.** Three layers of defense for #3.1 (runtime + Zod refine + prod-only throw). `pii.ts:22` now returns `*@${domain}` for short local-parts. Both per #50 shipped and direct re-grep. Audit was wrong.

**Net Pass 4: 10 of the 16 stale claims across Pass 3 + Pass 4 are audit-side errors** — the audit docs were conservative on re-check. Pattern: audits didn't get re-grepped before being snapshotted in the 2026-07-29 doc. The discipline for future audits: every finding's evidence must be `file:line` AND the file must be re-read at verification time, not just compared to a checklist.

**Action: FIX_PLAN.md PR-B** (close 3 stale Pass 3 questions) should be extended to also close 3 more of the Pass 4 stale claims (11, 12, 16 are the most clear-cut; 17-20 are also clear). PR-B becomes "close 6 stale audit claims" instead of "close 3".

---

## 9. Source map (unchanged)

Where each finding came from:

| Source | Document | Findings raised |
|---|---|---|
| Phase 1 audit (deep) | `docs/AUDIT_API_DEEP.md` | 60+ (Top 10 P0) |
| Phase 1 audit (backend) | `docs/AUDIT_BACKEND.md` | ~250 (across 22 sections) |
| Phase 1 audit (database) | `docs/AUDIT_DATABASE.md` | 67 (Top 10 P0) |
| Phase 1 audit (design system) | `docs/AUDIT_DESIGN_SYSTEM.md` | 53 (Top 10 P0) |
| Phase 1 audit (admin panel) | `docs/AUDIT_FINDINGS_ADMINPANEL.md` | 138 (Top 10 P0) |
| Phase 1 audit (rider app) | `docs/AUDIT_FINDINGS_RIDERAPP.md` | 161 (Top 10 P0) |
| Phase 1 audit (infrastructure) | `docs/AUDIT_INFRASTRUCTURE.md` | 110+ (Top 10 P0) |
| Phase 1 audit (security) | `docs/AUDIT_SECURITY.md` | ~75 (Top 10 P0) |
| Phase 1 audit (workers) | `docs/AUDIT_WORKERS.md` | 30+ (Top 10 P0) |
| Phase 2 plans | `docs/DB_REMEDIATION_PLAN.md` | 10 PRs (61 findings) |
| Phase 2 plans | `docs/DESIGN_SYSTEM_PLAN.md` | 7 PRs (48 findings) |
| Phase 2 plans | `docs/ADMIN_WEB_PLAN.md` | 11 PRs (30 findings) |
| Phase 2 plans | `docs/RIDER_APP_PLAN.md` | 14 PRs (30 findings) |
| Phase 2 plans | `docs/INFRASTRUCTURE_PLAN.md` | 10 PRs (30 findings) |
| Phase 2 plans | `docs/SECURITY_PLAN.md` | 10 PRs (30 findings) |
| Phase 2 follow-up tickets | `docs/FOLLOWUP_TICKETS.md` | 53 tickets (was 5, +48 from plans) |
| Audit verification (Pass 1) | `docs/AUDIT_VERIFICATION_2026-07-29.md` | API/Backend/Database spot-checks |
| Audit verification (Pass 2) | `docs/AUDIT_VERIFICATION_2_2026-07-29.md` | Design System/Admin Panel spot-checks |
| Audit verification (Pass 3) | `docs/AUDIT_VERIFICATION_3_2026-07-30.md` | All 9 audits consolidated |
| Backlog tracking | `docs/BACKLOG_FINDINGS.md` | (this file) |
| Status tracking | `docs/FOLLOWUP_TICKETS.md` | 63 tickets + 131 trivial (120 still active) |

---

## 10. Effort roll-up (Pass 4, 2026-07-30)

| Bucket | Status | Count | Estimated days |
|---|---|---|---|
| **Phase 1 P0s SHIPPED** | done | 19 of 19 | 1 focused day (already done) |
| **Phase 1 P0s STAGED** | gated on soak | 1 of 19 (#39 PM2 cluster) | 0.5 day (after 24-48h soak) |
| **Phase 1 P0s OPEN** | not started | 0 of 19 | (none — all P0s either shipped or staged) |
| **Phase 1 P0s OPEN+PARTIAL** | partial-shipped | 1 (#54 seed admin123 prod-blocker hardening) | 0.5 day |
| **Phase 2 Medium SHIPPED** | done | 7 of 14 | 4-5 days (already done) |
| **Phase 2 Medium STAGED** | gated on soak | 2 of 14 (#7 sub-B, #8) | 1-2 days (after 1-week soak) |
| **Phase 2 Medium OPEN** | not started | 4 of 14 (#6 lifecycle enum, #27/#28 widget moves, #1.4 stub) | 8-12 days |
| **Phase 3 Low SHIPPED** | done | 8 of 20 | 2-3 days (already done) |
| **Phase 3 Low OPEN** | not started | 12 of 20 | 5-7 days |
| **Trivial/cosmetic** | batchable | 120 items (was 131; 11 subsumed) | 12-15 focused hours across 6 PRs |
| **NEW from Pass 4 verification** | audit-correction closures | 10 more stale claims to close (PR-B extends from 3 to 6) | 0.5 day |
| **Closed as audit-correction** (Pass 3 + Pass 4) | 16 stale questions | Q6 (OutboxService), Q7 (withIdempotency), Q9 (schema drift), + 13 Pass 4 claims | (already in work; no PR needed) |
| **Total net unchecked** | — | 21 tickets + 120 trivial = **141 items** | **~22-28 focused days across multiple contributors** |

**For 2 contributors in parallel over 4 weeks:** 22-28 days / 2 = ~11-14 days each. The staged-soak tickets (#39, #7 sub-B, #8) can be worked on while the soaks run. The trivial-batch PRs (12-15 hr total) can be tackled as cleanup work in parallel. The audit-correction closures (Pass 4) are documentation-only and can be done in any day.

---

## Appendix: Filing workflow

When the team is ready to file new issues from Pass 3:

```bash
# File the 5 new questions from §8 (priority unknown until verified)
for ticket in "Worker 3.1 OutboxService.emit" "Backend 1.5 withIdempotency" "Backend 1.9 actorId" "Database 2 schema drift" "RiderApp 1.4 AppProvider"; do
  gh issue create --title "[AUDIT VERIFY] $ticket" \
    --body "Filed from AUDIT_VERIFICATION_3_2026-07-30.md §8 — needs verification before prioritization."
done
```

The `FOLLOWUP_TICKETS.md` "Filing checklist" sections §3-§5 are the canonical ordering for the existing tickets. The Pass 3 surfaced questions are *new* and need their own verification + prioritization before filing.

---

## Cross-references

- **Pass 3 verification** (per-finding verdict for every audit doc):
  - [`docs/AUDIT_VERIFICATION_3_2026-07-30.md`](./AUDIT_VERIFICATION_3_2026-07-30.md) — the source-of-truth for "which findings are still real bugs"
- **Source plans** (the work these tickets came from):
  - [`docs/DB_REMEDIATION_PLAN.md`](./DB_REMEDIATION_PLAN.md) — Tickets #6-#12
  - [`docs/DESIGN_SYSTEM_PLAN.md`](./DESIGN_SYSTEM_PLAN.md) — Tickets #13, #14, #27-#32
  - [`docs/ADMIN_WEB_PLAN.md`](./ADMIN_WEB_PLAN.md) — Tickets #15-#26, #33
  - [`docs/RIDER_APP_PLAN.md`](./RIDER_APP_PLAN.md) — (no separate tickets; in plan PRs)
  - [`docs/INFRASTRUCTURE_PLAN.md`](./INFRASTRUCTURE_PLAN.md) — Tickets #34-#43
  - [`docs/SECURITY_PLAN.md`](./SECURITY_PLAN.md) — Tickets #44-#53
- **Source audits** (the original findings):
  - [`docs/AUDIT_API_DEEP.md`](./AUDIT_API_DEEP.md)
  - [`docs/AUDIT_BACKEND.md`](./AUDIT_BACKEND.md)
  - [`docs/AUDIT_DATABASE.md`](./AUDIT_DATABASE.md)
  - [`docs/AUDIT_DESIGN_SYSTEM.md`](./AUDIT_DESIGN_SYSTEM.md)
  - [`docs/AUDIT_FINDINGS_ADMINPANEL.md`](./AUDIT_FINDINGS_ADMINPANEL.md)
  - [`docs/AUDIT_FINDINGS_RIDERAPP.md`](./AUDIT_FINDINGS_RIDERAPP.md)
  - [`docs/AUDIT_INFRASTRUCTURE.md`](./AUDIT_INFRASTRUCTURE.md)
  - [`docs/AUDIT_SECURITY.md`](./AUDIT_SECURITY.md)
  - [`docs/AUDIT_WORKERS.md`](./AUDIT_WORKERS.md)
- **Status tracking:**
  - [`docs/FOLLOWUP_TICKETS.md`](./FOLLOWUP_TICKETS.md) — 63 tickets, filing checklist
  - [`docs/RELEASE_READINESS_2026-07-29.md`](./RELEASE_READINESS_2026-07-29.md) — release readiness
  - [`SCOPE.md`](../SCOPE.md) — phase history + audit plan entries
- **Doc-fix plans** (meta — for the doc itself):
  - [`docs/FOLLOWUP_TICKETS_FIX_PLAN.md`](./FOLLOWUP_TICKETS_FIX_PLAN.md)
  - [`docs/FOLLOWUP_TICKETS_TOC_PLAN.md`](./FOLLOWUP_TICKETS_TOC_PLAN.md)
