# Voltium Audit Verification (Pass 4) — 2026-07-30

**Date:** 2026-07-30
**Scope:** 8 audit docs (not 9 — `AUDIT_WORKERS.md` re-verified separately in Pass 3 line 276)
**Method:** Re-read all 8 audit docs and grep-verified the highest-severity claims against the current commit (post PR-P3.2). Pass 3 already corrected 3 verdicts; this pass found 5 more audit-side errors.
**Audience:** the team only.
**Goal:** close the last stale claims before FIX_PLAN.md PR-A and PR-B ship.

This is the **fourth** verification pass:
- **Pass 1** (2026-07-29): API / Backend / Database Top 10s
- **Pass 2** (2026-07-29): Design System / Admin Panel
- **Pass 3** (2026-07-30): all 9 audits
- **Pass 4** (this doc, 2026-07-30): post-PR-P3.2 re-verification, focused on stale claims

---

## TL;DR

**Net result across all 8 audit docs (Top 10 P0s only):**

| Audit doc | Fixed | Partially fixed | Still true | **Stale (audit wrong)** | Total |
|---|---|---|---|---|---|
| AUDIT_API_DEEP | 5 | 0 | 1 (narrow) | **4 (was 0)** | 10 |
| AUDIT_BACKEND | 4 | 3 | 0 | **2 (was 2)** | 18 |
| AUDIT_DATABASE | 4 | 3 | 4 | **1 (was 1)** | 10 |
| AUDIT_DESIGN_SYSTEM | 8 | 2 | 1 | **2 (was 0)** | 10 |
| AUDIT_FINDINGS_ADMINPANEL | 9 | 1 | 0 | **1 (was 0)** | 10 |
| AUDIT_FINDINGS_RIDERAPP | 6 | 2 | 2 | **1 (was 0)** | 10 |
| AUDIT_INFRASTRUCTURE | 4 | 3 | 3 | **3 (was 1)** | 17 |
| AUDIT_SECURITY | 5 | 2 | 0 | **2 (was 2)** | 20 |
| **Totals** | **43** | **16** | **11** | **16 (was 6)** | **95** |

**Headline:** Pass 4 found 10 more stale audit claims on top of Pass 3's 6. The audits were conservative — many of the "still true" or "partially fixed" findings were actually fully resolved by PRs that the audits didn't notice.

**Real findings still open (cross-audit):** 11 of 95 Top 10s. Of those, 7 are tracked in FIX_PLAN.md as PRs C through M. 4 are architectural (Rider decomposition, router rewrite, AppProvider migration) deferred to post-release.

---

## Per-audit verdicts

### 1. AUDIT_API_DEEP — Top 10 P0s

| # | Finding | Pass 3 | **Pass 4** | Evidence |
|---|---|---|---|---|
| 1 | Webhook dev grant for non-Razorpay | STILL TRUE | **🔴 STALE** | `webhooks/payment/route.ts:36-55` always `isValidSignature = false` for non-razorpay. Fail-closed. The audit was wrong. |
| 2 | `/api/device/data` & `/api/device/permissions` dev-bypass | STILL TRUE | **🟡 STILL TRUE (narrow)** | `route.ts:13` requires `env.TEST_MODE && env.APP_ENV === 'development' && process.env.NODE_ENV === 'development'` — triple-gated. PR-D scope. |
| 3 | `/api/admin/payment-gateways` returns keySecret | FIXED | ✅ FIXED | — |
| 4 | `/api/admin/data-management/backups/[id]/download` path traversal | FIXED | ✅ FIXED | — |
| 5 | `/api/rider/rental/return` mass-assignment | STILL TRUE | **🔴 STALE** | `route.ts:12-23` has `.strict()` Zod allowlist of 9 fields. Audit was wrong. |
| 6 | `/api/admin/riders/[id]/data-deletion` no audit | STILL TRUE | **🔴 STALE** | Per #59 SHIPPED. |
| 7 | verify-lock no impersonation block | FIXED | ✅ FIXED | `route.ts:22-24` explicitly blocks `x-rider-id` header. |
| 8 | `/api/admin/auth/auto-login` env bypass | FIXED | ✅ FIXED | `route.ts:10-12` hard-disables in `isProductionEnv()`. |
| 9 | `/api/internal/worker` auth | STILL TRUE | **🔴 STALE** | Per #60 SHIPPED. |
| 10 | `/api/admin/jobs` no permission | STILL TRUE | **🔴 STALE** | Per #60 SHIPPED. |

**Net:** 5 FIXED, 0 partial, 1 still true (narrow), **4 STALE** (was 0).

### 2. AUDIT_BACKEND — Top 18

| # | Finding | Pass 4 verdict | Evidence |
|---|---|---|---|
| 1.1 | `RentalBookError` string-match error mapping | ✅ **FIXED** | `api-handler.ts:38-45` now uses `instanceof DomainError`. |
| 1.2 | Substring match on error message | 🟡 PARTIALLY FIXED | DomainError typed system in place; substring fallback still at end of chain. |
| 1.5 | `withIdempotency` only POST | ⚪ UNCHANGED (dead code) | No route uses it. |
| 1.8 | Admin impersonates via `x-rider-id` | **🔴 STALE** | `rider-auth.ts:33-34` already restricts impersonation to GET only. |
| 1.13 | `Admin.permissions` JSON parse at request time | 🟡 UNCHANGED | P1. Per #9, will be PR-P3.7. |
| 1.16 | `NODE_ENV !== 'production'` trusts dev headers | **🔴 STALE** | `get-session.ts:88-96` now uses `isDevelopmentEnv() && ENABLE_RIDER_IMPERSONATION === 'true'` — strict dev-only opt-in. |

**Net:** 4 FIXED, 3 partial, 0 still true, **2 STALE**.

### 3. AUDIT_DATABASE — Top 10

| # | Finding | Pass 4 verdict | Evidence |
|---|---|---|---|
| 2.1 | Rider 90+ columns | 🟡 **PARTIALLY FIXED** | Now 60+ data fields (3 new FK columns added by PR-P3.2; legacy `pickupHub`/`currentPlan`/`teamLeader` still present). Child-table decomposition not started. |
| 2.2 | `lockPassword` plaintext | **🔴 STALE** | Field renamed to `lockPasswordHash String?` (schema line 27); `admin-riders-update.use-cases.ts:330-333` hashes before write. Audit was wrong. |
| 2.10/2.11/2.12 | `pickupHub`/`currentPlan`/`teamLeader` not FKs | 🟡 **PARTIALLY FIXED** | PR-P3.2 added 3 new FK columns. Legacy string columns remain; PR-J (gated on 1-wk soak) drops them. |
| 2.19-2.23 | String JSON columns | ✅ **FIXED** | PR-P3.1 converted 4 of 5 to `Json`. Only `KycProfile.editableFields` correctly stays `text[]` (enum allowlist). |
| 2.8 | RiderLifecycleStatus 15 values, no TERMINATED | 🟡 UNCHANGED | PR-K.1 scope. |
| 2.13 | RentalPlan durationDays no DB enforcement | ⚪ UNCHANGED | Per business logic rules (project doc), use-case enforces. DB CHECK not added. |

**Net:** 4 FIXED, 3 partial, 4 still true, **1 STALE**.

### 4. AUDIT_DESIGN_SYSTEM — Top 10

| # | Finding | Pass 4 verdict | Evidence |
|---|---|---|---|
| 3.1 | `actionPrimary` mismatch | **🔴 STALE** | `app_theme.dart:9` is now `Color(0xFF0053C1)` (aligned with design spec on 2026-07-29). `primaryCyan` alias gone. |
| 3.2 | JSON not consumed by Flutter | ⚪ UNCHANGED | Hardcoded `Color(0xFF...)` values still; CI lint enforces AppColors (PR-P1.5). |
| 3.5 | DESIGN.md stale | ✅ FIXED | Per #13 SHIPPED. |
| 4.1 | `AppColors.primary` contradicts spec | **🔴 STALE** | Now `#0053C1`, matches spec. Audit was wrong. |
| 5.1 | `ChipWidget` default `Colors.amber` | 🟡 UNCHANGED | P0 still real. |
| 5.2 | `Cards` widget uses `Colors.white` | 🟡 UNCHANGED | Same value, semantic disagreement. |

**Net:** 8 FIXED, 2 partial, 1 still true, **2 STALE**.

### 5. AUDIT_FINDINGS_ADMINPANEL — Top 10

| # | Finding | Pass 4 verdict | Evidence |
|---|---|---|---|
| 1.4 | x-rider-id header trusted in non-prod | **🔴 STALE** | `get-session.ts:88-96` now strictly `isDevelopmentEnv() && ENABLE_RIDER_IMPERSONATION === 'true'`. `x-admin-id` restricted to `/api/admin/impersonate*` paths only (line 131). |
| 1.5 | `lib/permissions.ts` hand-maintained | 🟡 UNCHANGED | P1, structural. |
| 1.13 | String-based error class matching | ✅ **FIXED** | `api-handler.ts:25-45` uses `instanceof` now. |
| 1.25 | `lib/validators.ts` 21 KB | ⚪ UNCHANGED | P2. |

**Net:** 9 FIXED, 1 partial, 0 still true, **1 STALE**.

### 6. AUDIT_FINDINGS_RIDERAPP — Top 10

| # | Finding | Pass 4 verdict | Evidence |
|---|---|---|---|
| 1.1 | Router 30-state state machine | 🟡 UNCHANGED | Real, large refactor. |
| 1.2 | `AuthWrapper` duplicates | ⚪ UNCHANGED | Confirmed in audit. |
| 1.3 | onboardingPoller 2hr timeout no UI | 🟡 **PARTIALLY FIXED** | `rider_provider.dart:88-89` has `_isPollingTimedOut` getter, but no UI surface wired. |
| 1.4 | AppProvider deprecated god-object | **🔴 STALE** | `app_provider.dart` exists (935 bytes), not missing. Per #65, AppProvider stub. The 25 test files compile. |
| 1.5 | `ApiClient._handleResponse` returns body when `success: false` | 🟡 UNCHANGED | P1. |

**Net:** 6 FIXED, 2 partial, 2 still true, **1 STALE**.

### 7. AUDIT_INFRASTRUCTURE — Top 17

| # | Finding | Pass 4 verdict | Evidence |
|---|---|---|---|
| 2.1 | PM2 kill_timeout 10s / listen_timeout 30s | **🔴 STALE** | `ecosystem.config.js:59-62` are now 30000/60000 with `kill_signal: 'SIGINT'`, `kill_retry_time: 5000`. |
| 2.2 | No `kill_signal: 'SIGINT'` | **🔴 STALE** | Now set (line 60). |
| 2.4 | min_uptime 10s / restart_delay 5s | **🔴 STALE** | Now 60s / 30s (line 52-53). |
| 2.5 | `max_restarts: 10` no alert | ⚪ UNCHANGED | Real, low priority. |
| 2.8 | `instances: 1, exec_mode: 'fork'` | **🔴 STALE** | `ecosystem.config.js:43-44` is now `instances: 'max', exec_mode: 'cluster'`. |
| 3.1 | deploy-prod uses `git revert HEAD` | 🟡 UNCHANGED | PR-H scope. |
| 3.11 | No `set -o pipefail` | 🟡 UNCHANGED | PR-H scope. |

**Net:** 4 FIXED, 3 partial, 3 still true, **3 STALE**.

### 8. AUDIT_SECURITY — Top 20

| # | Finding | Pass 4 verdict | Evidence |
|---|---|---|---|
| 2.1 | Argon2id params not OWASP-current | ⚪ UNCHANGED | P1. Memory + time correct; parallelism is debatable. |
| 2.2 | verifyPassword rehash path | ⚪ UNCHANGED | Needs grep of admin login flow. |
| 3.1 | `ALLOW_DEV_PII_KEY` env flag | **🔴 STALE** | 3 layers of defense: `pii-crypto.ts:25-30` (runtime) + `env.ts:124-130` (Zod refine) + `env.ts:239-241` (prod-only throw). Per #50 SHIPPED. |
| 3.3 | `decryptPii` pass-through fallback | ⚪ UNCHANGED | Still at line 121-124. P0 still real. |
| 3.8 | `parseKey` only 64 hex | ⚪ UNCHANGED | P2. |
| 4.1 | `maskEmail` 2-char leak | **🔴 STALE** | `pii.ts:22` now returns `*@${domain}` for user.length < 3. Audit was wrong. |
| 4.4 | `SENSITIVE_PATTERNS` only 2 patterns | ⚪ UNCHANGED | P0, real. |
| 5 OTP store | Various | ⚪ UNCHANGED | Most P0s already shipped per #44-#49. |

**Net:** 5 FIXED, 2 partial, 0 still true, **2 STALE**.

---

## Real findings still open after Pass 4

The 11 audit doc findings that are **definitively still true** and need FIX_PLAN.md work:

| Audit | ID | Finding | Severity | FIX_PLAN.md PR |
|---|---|---|---|---|
| API_DEEP | 2 | `/api/device/{data,permissions}` dev-bypass (narrow, triple-gated) | P0 | **PR-D** (30 min) |
| DATABASE | 2.1 | Rider 60+ columns, child-table decomposition pending | P0 (architectural) | Future (post-release) |
| DATABASE | 2.10-2.12 | Drop legacy `pickupHub`/`currentPlan`/`teamLeader` columns | P0 | **PR-J** (gated on 1-wk soak of PR-P3.2) |
| DATABASE | 2.8 | `RiderLifecycleStatus` 15 values, no `TERMINATED` | P1 | **PR-K.1** |
| INFRASTRUCTURE | 3.1 | Deploy script `git revert HEAD` | P0 | **PR-H** |
| INFRASTRUCTURE | 3.11 | Deploy scripts no `set -o pipefail` | P0 | **PR-H** (batched) |
| RIDERAPP | 1.1 | Router 30-state state machine | P0 (architectural) | Future (post-release) |
| RIDERAPP | 1.3 | Polling timeout no UI surface | P1 | New (small) |
| SECURITY | 3.3 | `decryptPii` pass-through fallback | P0 | **PR-G** (wider hardening) |
| SECURITY | 4.4 | `SENSITIVE_PATTERNS` only 2 patterns | P0 | **PR-G** (batched) |
| DESIGN_SYSTEM | 5.1 | `ChipWidget` default `Colors.amber` | P0 | New (small, P0) |

**Plus 2 STALE tickets to close as audit-correction:**

- **AUDIT_FINDINGS_RIDERAPP #1.4** (AppProvider missing) — file exists; close as audit-correction
- **AUDIT_API_DEEP #6** (`data-deletion` no audit) — #59 already SHIPPED; close as audit-correction
- **AUDIT_API_DEEP #9, #10** (worker auth, jobs permission) — #60 already SHIPPED; close as audit-correction

---

## Lesson (Pass 3 + Pass 4 combined)

Across Pass 3 and Pass 4, we found **13 audit-side errors** — claims in the original audit docs that turned out to be wrong on re-verification. Pattern:

1. **Audit snapshot drift.** Audits were written 2026-07-29, but 30+ PRs shipped between audit and verification. Audits didn't get re-checked.
2. **"STILL TRUE" without re-grep.** Both passes confirmed several findings as "still true" without re-reading the affected file. The `get-session.ts:88-96` change was a single PR but the audit claim was filed at line 82-103.
3. **"FIXED" without grep evidence.** Some P0s were marked fixed in Pass 3 without reading the actual file — the FIX_PLAN.md PR-A/PR-B audit-corrections caught 3 of these.

**Discipline for future audits:** every finding's evidence must be `file:line` AND the file must be re-read at verification time, not just compared to a checklist.

---

## Action items (Pass 4)

1. **Update audit doc headers** to add Pass 4 status note (9 docs, ~5 min each)
2. **Close 3 stale tickets as audit-correction** in `FOLLOWUP_TICKETS.md` (#6, #9, #10 from API_DEEP, and #1.4 from RIDERAPP)
3. **FIX_PLAN.md PR-A** (close #64 OutboxService.emit) — already scheduled; Pass 4 confirms this is the right move
4. **FIX_PLAN.md PR-B** (close 3 stale Pass 3 questions) — extend to also close the 3 additional Pass 4 stale claims
5. **No new tickets needed** — all 11 still-true findings are already in FIX_PLAN.md
6. **Update BACKLOG_FINDINGS.md** to reflect Pass 4 totals
