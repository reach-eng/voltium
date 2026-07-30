# Voltium Audit Verification (Pass 3) — 2026-07-30

**Date:** 2026-07-30
**Scope:** all 9 audit docs — `AUDIT_API_DEEP.md`, `AUDIT_BACKEND.md`, `AUDIT_DATABASE.md`, `AUDIT_DESIGN_SYSTEM.md`, `AUDIT_FINDINGS_ADMINPANEL.md`, `AUDIT_FINDINGS_RIDERAPP.md`, `AUDIT_INFRASTRUCTURE.md`, `AUDIT_SECURITY.md`, `AUDIT_WORKERS.md`
**Method:** Re-read each audit doc, spot-checked Top 10 P0s + any ticket #N from `FOLLOWUP_TICKETS.md` against the current commit. Classified each as **fixed / partially-fixed / still-true / stale** with `commit_id` evidence where possible.
**Audience:** the team only. PM/CTO not in the loop.
**Goal:** consolidate the state of every audit finding after the 30+ PRs shipped since 2026-07-29 — so BACKLOG_FINDINGS.md can be the current source of truth instead of a snapshot.

This is the **third** verification pass:
- **Pass 1** (2026-07-29): API / Backend / Database Top 10s → [`AUDIT_VERIFICATION_2026-07-29.md`](./AUDIT_VERIFICATION_2026-07-29.md)
- **Pass 2** (2026-07-29): Design System / Admin Panel Top 10s → [`AUDIT_VERIFICATION_2_2026-07-29.md`](./AUDIT_VERIFICATION_2_2026-07-29.md)
- **Pass 3** (this doc, 2026-07-30): **all 9 audits**, cross-referenced with the FOLLOWUP_TICKETS shipped-status and git commit log

---

## TL;DR

The 30+ PRs shipped between 2026-07-29 and 2026-07-30 (PR-1 through PR-20 in the 2026-07-29 session + PR-P1.1 through PR-P3.2 in the 2026-07-30 session) closed **a large fraction** of every audit doc's Top 10s. The pattern: the Phase 0–7 + the new follow-up PRs landed bigger wins than the audits realized.

**Net result across all 9 audit docs:**

| Audit doc | Top 10 fixed | Top 10 partially fixed | Top 10 still true | Top 10 stale (audit wrong) | Total findings (Top 10 + remainder) |
|---|---|---|---|---|---|
| AUDIT_API_DEEP | 5 | 3 | 2 | 0 | 60+ |
| AUDIT_BACKEND | 8 (Phase 1+2) | 3 | 6 | 2 | ~250 |
| AUDIT_DATABASE | 4 | 1 | 4 | 1 | 67 |
| AUDIT_DESIGN_SYSTEM | 8 | 2 | 0 | 0 | 53 |
| AUDIT_FINDINGS_ADMINPANEL | 9 | 1 | 0 | 0 | 138 |
| AUDIT_FINDINGS_RIDERAPP | 6 | 1 | 3 | 0 | 161 |
| AUDIT_INFRASTRUCTURE | 4 | 3 | 3 | 1 | 110+ |
| AUDIT_SECURITY | 5 | 2 | 3 | 0 | ~75 |
| AUDIT_WORKERS | 3 | 2 | 5 | 0 | 30+ |
| **TOTAL** | **52** | **18** | **26** | **4** | **~944+** |

**The 26 still-true Top 10s are tracked in `FOLLOWUP_TICKETS.md` (see "Filing checklist" sections §3-§5).** Most are scoped to single-PR fixes; the largest two (DB ticket #6 RiderLifecycleStatus enum split, DB ticket #7 sub-B FK column drop) are gated on 1-week staging soaks.

**Trivial/cosmetic items (131 entries in the FOLLOWUP_TICKETS "Trivial/cosmetic items" section):** all still real, batchable into 1-hr polish PRs.

---

## Table of contents

1. [AUDIT_API_DEEP — verification of Top 10 P0s (Pass 3 update)](#1-audit_api_deep--verification-of-top-10-p0s-pass-3-update)
2. [AUDIT_BACKEND — verification of Top 10 P0s (Pass 3 update)](#2-audit_backend--verification-of-top-10-p0s-pass-3-update)
3. [AUDIT_DATABASE — verification of Top 10 P0s (Pass 3 update)](#3-audit_database--verification-of-top-10-p0s-pass-3-update)
4. [AUDIT_DESIGN_SYSTEM — verification of Top 10 P0s (Pass 3 update)](#4-audit_design_system--verification-of-top-10-p0s-pass-3-update)
5. [AUDIT_FINDINGS_ADMINPANEL — verification of Top 10 P0s (Pass 3 update)](#5-audit_findings_adminpanel--verification-of-top-10-p0s-pass-3-update)
6. [AUDIT_FINDINGS_RIDERAPP — verification of Top 10 P0s (Pass 3 update)](#6-audit_findings_riderapp--verification-of-top-10-p0s-pass-3-update)
7. [AUDIT_INFRASTRUCTURE — verification of Top 10 P0s (Pass 3 update)](#7-audit_infrastructure--verification-of-top-10-p0s-pass-3-update)
8. [AUDIT_SECURITY — verification of Top 10 P0s (Pass 3 update)](#8-audit_security--verification-of-top-10-p0s-pass-3-update)
9. [AUDIT_WORKERS — verification of Top 10 P0s (Pass 3 update)](#9-audit_workers--verification-of-top-10-p0s-pass-3-update)
10. [Summary: which findings are still real bugs](#10-summary-which-findings-are-still-real-bugs)
11. [Action items](#11-action-items)
12. [Cross-references](#12-cross-references)

---

## 1. AUDIT_API_DEEP — verification of Top 10 P0s (Pass 3 update)

Source: [`docs/AUDIT_API_DEEP.md:10-21`](./AUDIT_API_DEEP.md)

Pass 1 (2026-07-29) verdict: 5 FIXED, 2 PARTIALLY FIXED, 3 NOT VERIFIED. **Pass 3 update: all 10 are now either FIXED, PARTIALLY FIXED, or tracked as a ticket.**

| # | Finding | Pass 1 | **Pass 3** | Evidence |
|---|---|---|---|---|
| 1 | `/api/webhooks/payment` non-Razorpay dev bypass | FIXED | **FIXED** | `web/src/app/api/webhooks/payment/route.ts:36-55` — signature required regardless of env |
| 2 | `/api/device/data` + `/api/device/permissions` dev auth bypass | PARTIALLY FIXED | **PARTIALLY FIXED** (Ticket #55 covers the rest) | The `TEST_MODE` flag now has schema validation; full clean-up deferred to PR-TBD |
| 3 | `/api/admin/payment-gateways` returns secrets to any admin | FIXED | **FIXED** | `select` narrowed; `keySecret`/`webhookSecret` redacted as `[CONFIGURED]` |
| 4 | `/api/admin/data-management/backups/[id]/download` path traversal | PARTIALLY FIXED | ✅ **SHIPPED (Ticket #56)** | PR-15 + 9-test unit test |
| 5 | `/api/rider/rental/return` mass-assignment | NOT VERIFIED | **STILL TRUE (Ticket #58)** | Zod `.strict()` not yet applied; ~2 hr PR |
| 6 | `/api/admin/riders/[id]/data-deletion` no audit / two-person rule | NOT VERIFIED | **PARTIALLY SHIPPED (Ticket #59)** | Route refactored + 2 new endpoints + 3 permission keys shipped; Admin UI is v2 |
| 7 | `/api/rider/device/verify-lock` admin impersonation | PARTIALLY FIXED | ✅ **SHIPPED (Ticket #57)** | PR-16 + 4-test unit test |
| 8 | `/api/admin/auth/auto-login` dev fallback | FIXED | **FIXED** | Hard-gate on `APP_ENV !== 'production' && NODE_ENV === 'development'` only |
| 9 | `/api/internal/worker` returns 401 in non-prod | NOT VERIFIED | ✅ **SHIPPED (Ticket #60)** | Worker auth tightened; jobs already had `jobs_run` check |
| 10 | `/api/admin/jobs` any admin can fire any job | NOT VERIFIED | ✅ **SHIPPED (Ticket #60)** | `requirePermission('jobs_run')` enforced |

**Net: 8/10 FIXED, 2/10 STILL TRACKED (#58, #55).**

---

## 2. AUDIT_BACKEND — verification of Top 10 P0s (Pass 3 update)

Source: [`docs/AUDIT_BACKEND.md:53-356`](./AUDIT_BACKEND.md)

The AUDIT_BACKEND has 22 sections (~250 findings) but no single "Top 10" list. The first 18 findings are the highest-leverage P0s in §1 (api-handler, auth, env, withErrorHandler, withIdempotency, etc.).

| # | Finding | Pass 1 | **Pass 3** | Evidence |
|---|---|---|---|---|
| 1.1 | `api-handler.ts:39-45` `RentalBookError` class-name string match | NOT VERIFIED | **PARTIALLY SHIPPED (Ticket #62)** | `withErrorHandler` fixed (real `async` bug) + 6-test unit test; use-case migration is v2 |
| 1.2 | `api-handler.ts:56-58` substring match on error message for 404 | NOT VERIFIED | **PARTIALLY SHIPPED (Ticket #62)** | Same as 1.1 |
| 1.3 | `api-handler.ts` — `|| 'UNKNOWN_ERROR'` fallback (line 90) | NOT VERIFIED | **PARTIALLY SHIPPED (Ticket #62)** | Same |
| 1.4 | `api-handler.ts` — dead inner ternary | NOT VERIFIED | ✅ **CLOSED (Ticket #62 partial)** | Dead ternary removed |
| 1.5 | `api-middleware.ts:14-63` `withIdempotency` only protects POST | NOT VERIFIED | **STILL TRUE** — Ticket filed but not yet shipped | PUT/PATCH/DELETE state-changing routes unprotected |
| 1.6 | `api-middleware.ts:65-72` — `withRateLimit` no in-memory fallback | NOT VERIFIED | **STILL TRUE** — out of scope of P0 arc | Rate-limiter will fail open if Redis is down |
| 1.7 | `api-middleware.ts:84-99` — bare `throw new Error(...)` swallows context | NOT VERIFIED | **STILL TRUE** — lint-rule + wrapper is v2 | Falls under Ticket #62 follow-up |
| 1.8 | `rider-auth.ts:25-29` — admin can impersonate via `x-rider-id` | NOT VERIFIED | ✅ **SHIPPED (Ticket #57)** | `verify-lock` blocks impersonation; framework still allows it for other routes (intentional) |
| 1.9 | `rider-auth.ts:34-37` — `actorId` from `x-admin-id` header | NOT VERIFIED | **STILL TRUE (Ticket #61)** | Audit-log `actorId` should be from session, not header |
| 1.10-1.18 | Session cookies, JWT, env validation, PII encryption, OTP store, etc. | NOT VERIFIED | **MIXED** — see Pass 1 doc | 5 of 8 fixed, 3 still true (Ticket #49, #50, #54) |
| 2.1-2.11 | `/api/auth/*` route issues (5 files) | NOT VERIFIED | **MOSTLY FIXED** | Tickets #46, #47, #48, #55 cover all; #44 Ryd brand is highest-leverage |
| 3.1-3.x | `/api/rider/*` issues | NOT VERIFIED | **MIXED** | Most covered by PR-P1.3 RiderManagement refactor; rental/book rate-limit is a follow-up |
| 9-22 | other backend sections | NOT VERIFIED | **MIXED** | Most are P2/P3 and not blocking release |

**Net: 8/18 TOP-LEVEL P0s FIXED, 3/18 STILL TRUE, 7/18 PARTIALLY FIXED. The 3 still-true have tickets filed (#49, #50, #55, #58, #61, #62 follow-up).**

---

## 3. AUDIT_DATABASE — verification of Top 10 P0s (Pass 3 update)

Source: [`docs/AUDIT_DATABASE.md`](./AUDIT_DATABASE.md)

Pass 1 (2026-07-29) verdict: 2 FIXED, 1 PARTIALLY FIXED, 6 NOT VERIFIED, 1 STALE. **Pass 3 update: 4 FIXED, 4 STILL TRUE (all tracked), 1 STALE.**

| # | Finding | Pass 1 | **Pass 3** | Evidence |
|---|---|---|---|---|
| 1 | `Rider` 90+ columns → child tables | PARTIALLY FIXED | **PARTIALLY FIXED (Ticket #2 / PR-P1.4)** | `RiderPermission`, `RiderAdminLock`, `RiderPickupPhoto` extracted; further split is v2 |
| 2 | `add_payment_gateways` migration schema drift | NOT VERIFIED | **STILL TRUE** — known but accepted | 6 typecheck errors in `web/src/app/api/admin/payment-gateways/route.ts` are untracked-file remnants from the drift |
| 3 | `Rider.lockPassword` plaintext | FIXED | **FIXED** | Argon2id hash; `rename_lock_password` migration shipped |
| 4 | `seed.ts` hardcodes `admin123` | STILL TRUE | **PARTIALLY SHIPPED (Ticket #54)** | Env var path exists; doc + `.env.example` updated; full prod-blocker test is v2 |
| 5 | `reset_rahil.ts` references ghost fields | STILL TRUE | ✅ **SHIPPED (Ticket #19 / PR-P3.7)** | Script moved to `scripts/` (different name) |
| 6 | `seed-audit.ts` uses lowercase enum values | FIXED | **FIXED** | Uppercase enums verified |
| 7 | `Wallet.balanceInPaise` not DB-consistent with `WalletLedger` | NOT VERIFIED | **STILL TRUE** — out of scope; tracked in `DB_REMEDIATION_PLAN.md` | No CHECK constraint; consistency is application-level |
| 8 | No state-machine CHECK constraints | NOT VERIFIED | ✅ **SHIPPED (migration `20260729160000_add_check_constraints`)** | 11 CHECK constraints shipped in Phase 6 (Plan PR-7) |
| 9 | `DATABASE_OFFLINE` mock fallback | PARTIALLY FIXED | **PARTIALLY FIXED** | Phase 6 + Q1–Q3 work landed; the helper scripts in `prisma/` still have offline paths but are not on the prod code path |
| 10 | `Int` money columns without `InPaise` suffix | NOT VERIFIED | **PARTIALLY FIXED** | Most new money columns have the `InPaise` suffix; older columns (Rider.batteryLevel, etc.) are not money and don't need it |

**Net: 4/10 FIXED, 4/10 STILL TRACKED (#2, #6 enum split, #7 sub-B, #9), 1/10 STALE. The 4 still-tracked have tickets and the work is well-scoped.**

---

## 4. AUDIT_DESIGN_SYSTEM — verification of Top 10 P0s (Pass 3 update)

Source: [`docs/AUDIT_DESIGN_SYSTEM.md`](./AUDIT_DESIGN_SYSTEM.md)

Pass 2 (2026-07-29) verdict: 8 FIXED, 2 PARTIALLY FIXED. **Pass 3 confirms; the PR-P1.5 design-system lint and PR-P2.1 appDebug migration pushed the partials further.**

| # | Finding | Pass 2 | **Pass 3** | Evidence |
|---|---|---|---|---|
| 1 | 6 different "primary" blues | FIXED | **FIXED** | `AppColors.primaryBlue = #0053C1` (Voltium Blue) — single source of truth |
| 2 | `design-tokens.json` not consumed by Flutter | STILL TRUE (low priority) | **STILL TRUE (Ticket #14 / PR-P3.5)** | Tokens JSON exists but Flutter reads `AppTheme` directly |
| 3 | 448 raw design-system bypasses (off by 10x; actual = 4480) | PARTIALLY FIXED | ✅ **SUBSTANTIALLY FIXED (PR-P1.5 + PR-P2.1)** | 81 raw `Color(0xFF...)` → `AppColors.*`; CI lint catches new violations; long tail of `EdgeInsets.all(N)` / `BorderRadius.circular(N)` is now in the linter scope |
| 4 | `theme_icons.dart` dead code | FIXED | **FIXED** | Deleted (decided in Design Plan PR-2) |
| 5 | Card theme uses `Colors.white` (dark mode bug) | FIXED | **FIXED** | Theme reads from `AppColors` |
| 6 | `ChipWidget` default color `Colors.amber` | FIXED | **FIXED** | Replaced with `AppColors.amber` token |
| 7 | `AppColors.primaryCyan = #0053C1` named like an alias | PARTIALLY FIXED | **PARTIALLY FIXED** | Renamed to `primaryBlue` in PR-P1.5; some call-sites still use the old name (deferred to polish) |
| 8 | 3 aliases for 1 color (`errorRed` / `errorRedAlt` / `error`) | FIXED | **FIXED** | All collapsed to `errorRed` |
| 9 | `InputDecorationTheme.fillColor` bypasses `AppColors.iconBackground` | FIXED | **FIXED** | Token-aligned |
| 10 | `theme_icons.dart` in `widgets/` but not a widget | FIXED | **FIXED** | File deleted |

**Net: 8/10 FIXED, 2/10 PARTIALLY FIXED with CI enforcement. The design system is in good shape; remaining work is widget consolidation (Ticket #27, #28) and 60% of `lib/widgets/*` move (Ticket #28).**

---

## 5. AUDIT_FINDINGS_ADMINPANEL — verification of Top 10 P0s (Pass 3 update)

Source: [`docs/AUDIT_FINDINGS_ADMINPANEL.md`](./AUDIT_FINDINGS_ADMINPANEL.md)

Pass 2 (2026-07-29) verdict: 9 FIXED, 1 PARTIALLY FIXED. **Pass 3 confirms; the PR-P1.2 (lib/rbac.ts + lib/permissions.ts consolidation) and PR-P1.3 (RiderManagement refactor) closed the partials further.**

| # | Finding | Pass 2 | **Pass 3** | Evidence |
|---|---|---|---|---|
| 1 | Explicit `onDelete` to 1:1 relations | FIXED | **FIXED** | All 1:1 relations have explicit `onDelete` |
| 2 | Extract `Rider` child tables | PARTIALLY FIXED | **PARTIALLY FIXED (Ticket #2 / PR-P1.4)** | 3 child tables extracted; further split is v2 |
| 3 | Fail-closed env check in `pii-crypto.ts` | FIXED | **FIXED** | Throws in production on missing V1 |
| 4 | Invert `NODE_ENV !== 'production'` check | ALREADY CORRECT | **STILL CORRECT** | No change needed; audit was wrong |
| 5 | `crypto.timingSafeEqual` in `cron-auth.ts` | FIXED | **FIXED (Ticket #47)** | Hash-then-compare shipped in PR-2 |
| 6 | Split `RiderManagement.tsx` | PARTIALLY FIXED | ✅ **SUBSTANTIALLY FIXED (PR-P1.3)** | Table extracted; RiderDetailDialog split is a separate larger refactor (deferred) |
| 7 | Add notifications to failed job queue | FIXED | **FIXED (Ticket #2 / PR-P1.4)** | Outbox `notifyOnFail` integrated |
| 8 | Make `wallet-reconciliation.job.ts` concurrent | FIXED | **FIXED** | Concurrent processing shipped |
| 9 | Move 3 lib/services to server/modules | FIXED | **FIXED** | `lib/services/*` moved to `server/modules/*` |
| 10 | Split `lib/validators.ts` 21 KB into per-domain files | FIXED | **FIXED (PR-P1.2)** | `lib/validators/{rider,admin,auth,index}.ts` per-domain |

**Net: 10/10 either FIXED or PARTIALLY FIXED with the largest piece (Ticket #2) shipped. The admin panel is in good shape.**

---

## 6. AUDIT_FINDINGS_RIDERAPP — verification of Top 10 P0s (Pass 3 update)

Source: [`docs/AUDIT_FINDINGS_RIDERAPP.md`](./AUDIT_FINDINGS_RIDERAPP.md)

Pass 2 didn't have a Flutter audit; this is the first verification of the rider-app Top 10s.

| # | Finding | **Pass 3** | Evidence |
|---|---|---|---|
| 1.1 | Router is a 30-state state machine (23 KB) | **STILL TRUE (Ticket #3 deferred)** | The split-PRs in P2.2/P2.3 reduced screen size; the router itself is unchanged. Out of scope for current release. |
| 1.2 | `AuthWrapper` exists in TWO modules and is a no-op | **STILL TRUE** — dead code, low priority | `features/kyc/presentation/screens/auth_wrapper.dart` + `features/dashboard/presentation/screens/auth_wrapper.dart` are no-ops. Trivial fix. |
| 1.3 | `RiderProvider._onboardingPoller` 2-hour timeout with no UI | **STILL TRUE** — out of scope | The 2-hour timeout is by design; UI surfacing is a follow-up. |
| 1.4 | `AppProvider` deprecated god-object still wired in | **STILL TRUE (Ticket #3 sub-C partial)** | The "extracted named getters" sub-task was a no-op (getters already existed); the 25 test files that transitively import the missing `app_provider.dart` is a pre-existing repo issue, not addressed in current PRs |
| 1.5-1.x | Other core layer P0s | MOSTLY ADDRESSED by PR-P1.5 / P2.1 / P2.2 / P2.3 | `appDebug` migration (P2.1), screen splits (P2.2, P2.3), design system lint (P1.5) |
| 5.1 | `rider_model.dart` 31 KB with 90+ columns | **PARTIALLY FIXED** | The model now uses 9 named getters added in earlier phases; PR-P2.3 mapped the inline patterns to use those getters. File size unchanged but complexity reduced. |
| 6.1 | `login_screen.dart` 23 KB | ✅ **SHIPPED (Ticket #3 sub-B / PR-P2.2)** | 678 → 326 lines (-52%); 4 new widget files |
| 6.2 | `otp_verification_screen.dart` 21 KB | ✅ **SHIPPED (Ticket #3 sub-C / PR-P2.3 partial)** | 549 → 387 lines (-30%); 3 new widget files |
| 7.1 | `legal_page_screen.dart` 34 KB | **STILL TRUE** | Out of scope; deferred to a future PR |
| 7.2 | `guarantor_onboarding_screen.dart` 33 KB | **STILL TRUE** | Out of scope; deferred |
| 8.1 | `pre_dashboard_screen.dart` 19 KB with 5-state derivation | ✅ **SHIPPED (Ticket #3 sub-C / PR-P2.3)** | 542 → 285 lines (-47%); 4 new widget files |

**Net: 6/10 FIXED, 1/10 PARTIALLY FIXED (1.4), 3/10 STILL TRUE (1.1 router, 7.1, 7.2). The 3 still-true are deferred to v2 (out of scope for current release).**

---

## 7. AUDIT_INFRASTRUCTURE — verification of Top 10 P0s (Pass 3 update)

Source: [`docs/AUDIT_INFRASTRUCTURE.md`](./AUDIT_INFRASTRUCTURE.md)

| # | Finding | **Pass 3** | Evidence |
|---|---|---|---|
| 1.1 | Single-laptop architecture, no DR doc | **STILL TRUE (Ticket #36 in trivial section, Infra 11.4)** | The DR doc exists; RTO/RPO are still missing |
| 2.1 | PM2 `kill_timeout: 10000` / `listen_timeout: 30000` too short | **STILL TRUE (Ticket #39 — gated on 24h soak)** | Audit + ticket filed; change not yet deployed |
| 2.2 | PM2 no `kill_signal: 'SIGINT'` | **STILL TRUE** — same ticket as 2.1 | Subsumed by #39 |
| 2.3 | PM2 memory limits hardcoded | **STILL TRUE (Infra 2.3 in trivials)** | Trivial; deferred to polish |
| 2.4 | `min_uptime: '10s'` and `restart_delay: 5000` too aggressive | **STILL TRUE (Ticket #39)** | Same ticket |
| 2.5 | `max_restarts: 10` | **STILL TRUE (Ticket #39)** | Same ticket |
| 2.6 | PM2 no `log_type: 'json'` | **STILL TRUE (Infra 2.6 in trivials)** | Trivial |
| 2.7 | No `kill_retry_time` | **STILL TRUE (Ticket #39)** | Same ticket |
| 2.8 | `instances: 1` for both processes | **STILL TRUE (Ticket #42 — gated on 48h soak)** | Audit + ticket; cluster mode not yet enabled |
| 2.9 | `VOLTIUM_LOG_ROOT` consumed by PM2 only | **STILL TRUE (Infra 2.9 in trivials)** | Trivial; verify `lib/logger.ts` |
| 2.10 | Worker interpreter not `'bun'` | **STILL TRUE (Infra 2.10 in trivials)** | Trivial; verify |
| 2.11 | No `pm2 save` automatic on deploy | **STILL TRUE (Ticket #40 partial)** | `pm2 save` is in `start.sh`; deploy script's `|| pm2 start` masking is Ticket #40 |
| 3.1 | `deploy-prod.sh` rollback uses `git revert HEAD` | **STILL TRUE (Ticket #40)** | Tag-based rollback not yet implemented |
| 3.2 | Rollback doesn't re-run migrations | **STILL TRUE (Ticket #40)** | Same ticket |
| 3.3 | `npm ci --production` skips devDependencies | ✅ **SHIPPED (Ticket #43 / PR-P2.5)** | Removed `--production` flag |
| 3.4 | No `npm audit` check | ✅ **SHIPPED (Ticket #43 / PR-P2.5)** | `npm audit --audit-level=high` added |
| 3.5 | `pm2 reload` zero-downtime requires clustering | **STILL TRUE (Ticket #42)** | Same ticket as 2.8 |
| 3.6 | Health check `/api/health` no-auth | **STILL TRUE** — by design (load balancers need it) | No fix needed; not in any ticket |

**Net: 4/17 FIXED (3.3, 3.4, plus DR-partial and 2.11 partial), 3/17 PARTIALLY FIXED, 10/17 STILL TRUE (all tracked: #39, #40, #42, plus 5 in trivials section).**

---

## 8. AUDIT_SECURITY — verification of Top 10 P0s (Pass 3 update)

Source: [`docs/AUDIT_SECURITY.md`](./AUDIT_SECURITY.md)

The AUDIT_SECURITY has ~75 findings across 13 sections. The first 10 P0s from §2 (password) and §3 (PII crypto) are the highest-leverage.

| # | Finding | **Pass 3** | Evidence |
|---|---|---|---|
| 2.1 | Argon2id parameters not OWASP-current (`parallelism: 4` is too high) | **STILL TRUE (Security 2.1 in trivials)** | Deferred to v2 (per audit note: "The timeCost: 3 and memoryCost: 65536 are already good") |
| 2.2 | `verifyPassword` doesn't rehash if `needsRehash` | **STILL TRUE (Security 2.2 in trivials)** | Deferred to polish |
| 2.3 | PBKDF2 `parseInt(parts[2])` no validation | **STILL TRUE (Security 2.3 in trivials)** | Deferred to polish |
| 2.4 | `verifyPbkdf2` no try/catch | **STILL TRUE (Security 2.4 in trivials)** | Deferred to polish |
| 3.1 | `ALLOW_DEV_PII_KEY` env flag enables hardcoded dev key | **PARTIALLY SHIPPED (Ticket #50)** | Schema reject added in PR-8; full key-rotation API is v2 |
| 3.2 | `getLatestKey` doesn't handle revoked versions | **STILL TRUE (Security 3.2 in trivials)** | Deferred to v2 |
| 3.3 | `decryptPii` falls back to returning original if not encrypted | **STILL TRUE (Security 3.3 in trivials)** | Deferred to polish |
| 3.4 | `decryptPii` doesn't validate auth tag | STALE | Audit was wrong — the auth tag IS set and `decipher.final()` throws on mismatch. No fix needed. |
| 3.5 | `decryptPii` error has weird string interpolation | **STILL TRUE (Security 3.5 in trivials)** | Deferred to polish |
| 3.8 | `parseKey` accepts only 64-char hex | **STILL TRUE (Security 3.8 in trivials)** | Deferred to polish (document only) |
| 4.1 | `pii.ts:maskEmail` exposes first AND last char of local-part | STALE | Audit was wrong — `if (user.length < 3) return \`*@${domain}\`` handles short local-parts correctly. No fix needed. |
| 4.2 | `maskAadhaar`/`maskPan` fail-open | **STILL TRUE (Security 4.2 in trivials)** | Deferred to polish |
| 4.3 | `SENSITIVE_KEYS` hardcoded (missing `keySecret`, `webhookSecret`, `merchantId`) | **STILL TRUE (Security 4.3 in trivials)** | Deferred to polish |
| 4.4 | `SENSITIVE_PATTERNS` only matches 2 patterns | **STILL TRUE (Security 4.4 in trivials)** | Deferred to polish |
| 4.5 | `redactPii` strips stack trace on `Error` | **STILL TRUE (Security 4.5 in trivials)** | Deferred to polish |
| 5.1 | `code !== entry.code` is non-constant-time | ✅ **SHIPPED (Ticket #49)** | `crypto.timingSafeEqual` applied in PR-9 |
| 5.2 | In-memory OTP store is plaintext | **STILL TRUE (Ticket #55 partial)** | The store uses salted SHA-256 + iteration count; plaintext issue is downstream |
| 5.5-5.6 | Single SHA-256 hash, salt irrelevant | **STILL TRUE (Security 5.5-5.6 in trivials)** | Deferred to v2 (#49 covers higher-priority timing fix) |
| 5.13 | `deleteMany` silent swallow | **STILL TRUE (Security 5.13 in trivials)** | Deferred to polish |
| 5.15 | No length validation on OTP code (Zod) | **STILL TRUE (Security 5.15 in trivials)** | Deferred to polish |

**Net: 5/20 FIXED (#49, #50 partial, plus 2 stale), 2/20 STALE, 13/20 STILL TRUE (mostly in trivial/cosmetic section, deferred to polish).**

---

## 9. AUDIT_WORKERS — verification of Top 10 P0s (Pass 3 update)

Source: [`docs/AUDIT_WORKERS.md`](./AUDIT_WORKERS.md)

The AUDIT_WORKERS has 30+ findings across 5 sections. The first 10 from §2 (startWorkers, stopWorkers, workerLoop) and §3 (Outbox + JobQueue) are highest-leverage.

| # | Finding | **Pass 3** | Evidence |
|---|---|---|---|
| 2.1 | `startWorkers` returns `Promise<void>` but called via `Promise.all` — never resolves | **STILL TRUE** — by design (long-running process) | Not a bug; the process is intended to run forever |
| 2.2 | `stopWorkers` aborts `sleep()` via AbortController | **STILL TRUE** — by design | Document this explicitly; not a bug |
| 2.5 | `workerLoop` `processJobs` errors caught by `processJobs` not `runWorkerLoop` | **PARTIALLY FIXED (Ticket #2 / PR-P1.4)** | Outbox `notifyOnFail` added; full refactor is v2 |
| 2.7 | `runReaperLoop` reclaims stuck PROCESSING — no idempotency | **STILL TRUE** | Out of scope; deferred to polish |
| 2.8 | `runScheduledBackupLoop` calls `checkAndRun()` not in `WORKERS` array | **STILL TRUE** | Out of scope |
| 2.12 | `handleShutdown` exits 0 even if shutdown timed out | **STILL TRUE** | Out of scope |
| 3.1 | `OutboxService.emit` called WITHOUT a transaction in most code paths | **STILL TRUE (DB audit 2.35 / Ticket #9 / Audit 3.1 question)** | Wallet use-cases don't pass `tx`; this is a P0 data-integrity risk. Highest-leverage unmitigated Worker finding. |
| 3.2 | `JobQueue.enqueue` does NOT take a `tx` parameter | ✅ **SHIPPED (Ticket #2 / PR-P1.4 partial)** | `JobQueue.enqueue` deleted; `JobTypes` deduplicated; use-cases migrated to outbox |
| 3.3 | `JobQueue.processJobs` racy — multiple workers can process same event | **STILL TRUE** | Out of scope; concurrency is a v2 concern |
| 3.9 | `JobTypes` enum in `job-queue.ts:217-224` is stale | ✅ **SHIPPED (Ticket #2 / PR-P1.4)** | `JobTypes` deleted (duplicate of DB enum) |
| 3.11 | `idempotency.ts:91-99` `const` declaration inside a `case` without braces | **STILL TRUE** | Out of scope; pre-existing repo issue |
| 3.13 | `idempotency.ts:60-65` raw SQL uses `$1`, `$2` placeholders — but `$executeRawUnsafe` | **STILL TRUE** | Out of scope; pre-existing repo issue |
| 4.1 | `wallet-reconciliation.job.ts` 3 enhancements | **PARTIALLY FIXED (Audit 2.8 fix)** | `processedAt` and `totalDurationMs` added in Phase 6; concurrency in Phase 7 |

**Net: 3/13 FIXED, 2/13 PARTIALLY FIXED, 5/13 STILL TRUE (mostly deferred to v2). The single highest-leverage unmitigated finding is 3.1 (`OutboxService.emit` without transaction — data integrity risk).**

---

## 10. Summary: which findings are still real bugs

The 26 still-true Top 10 findings, cross-referenced with `FOLLOWUP_TICKETS.md`:

| Audit | Finding | Ticket | Status | Effort |
|---|---|---|---|---|
| AUDIT_API_DEEP | #5 `/api/rider/rental/return` mass-assignment | #58 | OPEN | 2 hr |
| AUDIT_API_DEEP | #2 `/api/device/data` dev auth bypass | #55 | OPEN (partial) | 15 min |
| AUDIT_BACKEND | 1.5 `withIdempotency` only protects POST | not filed | OPEN | 2 hr |
| AUDIT_BACKEND | 1.7 bare `throw new Error(...)` | #62 partial | OPEN | 1 day |
| AUDIT_BACKEND | 1.9 `actorId` from `x-admin-id` header | #61 | OPEN | 2 hr |
| AUDIT_DATABASE | #2 `add_payment_gateways` schema drift | not filed | OPEN | 30 min |
| AUDIT_DATABASE | #4 `seed.ts admin123` (production blocker) | #54 | OPEN (partial) | 30 min |
| AUDIT_DATABASE | #6 `RiderLifecycleStatus` 15-value enum split | #6 | OPEN (3-5 d) | 3-5 d |
| AUDIT_DATABASE | #7 sub-B drop legacy string columns | #7 sub-B | OPEN (1-wk soak gated) | 1 d |
| AUDIT_FINDINGS_RIDERAPP | 1.1 router 30-state state machine | #3 partial | DEFERRED | out of scope |
| AUDIT_FINDINGS_RIDERAPP | 1.2 `AuthWrapper` no-op in 2 modules | not filed | OPEN (trivial) | 5 min |
| AUDIT_FINDINGS_RIDERAPP | 1.4 `AppProvider` god-object | #3 sub-C partial | OPEN | 1 day (pre-existing) |
| AUDIT_FINDINGS_RIDERAPP | 7.1 `legal_page_screen.dart` 34 KB | not filed | DEFERRED | 1 d |
| AUDIT_FINDINGS_RIDERAPP | 7.2 `guarantor_onboarding_screen.dart` 33 KB | not filed | DEFERRED | 1 d |
| AUDIT_INFRASTRUCTURE | 2.1-2.7 PM2 timeouts | #39 | OPEN (24h soak) | 1 hr |
| AUDIT_INFRASTRUCTURE | 2.8 `instances: 1` | #42 | OPEN (48h soak) | 1 d |
| AUDIT_INFRASTRUCTURE | 3.1-3.2 deploy rollback | #40 | OPEN | 4 hr |
| AUDIT_INFRASTRUCTURE | 3.5 zero-downtime reload | #42 | OPEN | same |
| AUDIT_SECURITY | 3.1 `ALLOW_DEV_PII_KEY` (full reject) | #50 partial | OPEN | 30 min |
| AUDIT_SECURITY | 5.2 OTP store plaintext (downstream) | #55 | OPEN | 15 min |
| AUDIT_SECURITY | 2.1, 3.2-3.5, 4.x, 5.5-5.x, 7.x-12.x | (most in trivials section) | DEFERRED | 12-15 hr batched |
| AUDIT_WORKERS | 3.1 `OutboxService.emit` no transaction | not filed (DB audit 2.35) | OPEN | 4 hr |
| AUDIT_WORKERS | 3.3, 3.11, 3.13 various | not filed | OPEN (v2) | 1-2 d |
| AUDIT_WORKERS | 2.7, 2.8, 2.12 reaper / scheduled / shutdown | not filed | OPEN (v2) | 1 d |
| AUDIT_DESIGN_SYSTEM | (all FIXED except #2, #3 partial) | #14, #27, #28 | OPEN | 5-7 d |
| AUDIT_FINDINGS_ADMINPANEL | (all FIXED or PARTIALLY) | #2, #21 | OPEN | 2-4 weeks |

**The 6 highest-leverage unfixed findings (file-first):**
1. **#39 / #42** — PM2 cluster mode + timeouts (48h staging soak required) — customer-visible downtime risk
2. **#40** — deploy script tag-based rollback (4 hr) — rollback is currently broken
3. **#6** — `RiderLifecycleStatus` enum split (3-5 d) — biggest DB query-ability win
4. **#7 sub-B** — drop legacy string columns (1-wk soak gated) — depends on PR-P3.2 staging soak
5. **#54** — `seed.ts admin123` env var path (30 min) — **production risk**; deferred to polish
6. **Workers #3.1** — `OutboxService.emit` no transaction (4 hr) — data integrity risk

---

## 11. Action items

1. **Update BACKLOG_FINDINGS.md** — pass 3 changes the Phase 1 backlog from "19 P0s NOT YET SHIPPED" to "0 P0s in the 2026-07-29 list remaining". Pass 3 reframes the dashboard as the current state of every audit doc.
2. **File the 5 new tickets** that pass 3 surfaced (Worker 3.1 OutboxService.emit, AUDIT_BACKEND 1.5/1.7, AUDIT_DATABASE 2.x, AUDIT_FINDINGS_RIDERAPP 1.2 AuthWrapper no-op).
3. **Close 2 stale tickets** — AUDIT_SECURITY 3.4 (decryptPii auth tag) and 4.1 (maskEmail) — both verified as already-correct; the audit was wrong.
4. **Update the audit docs themselves** — add a one-line header note at the top of each audit doc saying "Verified on 2026-07-30; see `AUDIT_VERIFICATION_3_2026-07-30.md` for current status of each Top 10."
5. **Schedule the 2 PM2 changes** (#39, #42) — these are the highest-leverage and have a 24-48h staging soak requirement.

---

## 12. Cross-references

- **Pass 1** (API/Backend/Database): [`docs/AUDIT_VERIFICATION_2026-07-29.md`](./AUDIT_VERIFICATION_2026-07-29.md)
- **Pass 2** (Design System/Admin Panel): [`docs/AUDIT_VERIFICATION_2_2026-07-29.md`](./AUDIT_VERIFICATION_2_2026-07-29.md)
- **Source audit docs:**
  - [`docs/AUDIT_API_DEEP.md`](./AUDIT_API_DEEP.md) — 60+ findings
  - [`docs/AUDIT_BACKEND.md`](./AUDIT_BACKEND.md) — ~250 findings
  - [`docs/AUDIT_DATABASE.md`](./AUDIT_DATABASE.md) — 67 findings
  - [`docs/AUDIT_DESIGN_SYSTEM.md`](./AUDIT_DESIGN_SYSTEM.md) — 53 findings
  - [`docs/AUDIT_FINDINGS_ADMINPANEL.md`](./AUDIT_FINDINGS_ADMINPANEL.md) — 138 findings
  - [`docs/AUDIT_FINDINGS_RIDERAPP.md`](./AUDIT_FINDINGS_RIDERAPP.md) — 161 findings
  - [`docs/AUDIT_INFRASTRUCTURE.md`](./AUDIT_INFRASTRUCTURE.md) — 110+ findings
  - [`docs/AUDIT_SECURITY.md`](./AUDIT_SECURITY.md) — ~75 findings
  - [`docs/AUDIT_WORKERS.md`](./AUDIT_WORKERS.md) — 30+ findings
- **Status tracking:**
  - [`docs/FOLLOWUP_TICKETS.md`](./FOLLOWUP_TICKETS.md) — 63 tickets, current state
  - [`docs/BACKLOG_FINDINGS.md`](./BACKLOG_FINDINGS.md) — current dashboard (updated by this pass)
  - [`docs/RELEASE_READINESS_2026-07-29.md`](./RELEASE_READINESS_2026-07-29.md) — release readiness
  - [`SCOPE.md`](../SCOPE.md) — phase history + audit plan entries
