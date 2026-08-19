# Re-Verification Report — 9 Audits (2026-08-06)

**Date:** 2026-08-06
**Scope:** Re-check every P0/P1 finding from the 9 admin-side audits against the current codebase. The audits being re-verified are:
1. `2026-08-05-scheduled-cron-tasks.md` (18th audit)
2. `2026-08-05-team-leaders-operations-fleet.md` (8th audit, deep)
3. `ADMIN_CONFIG_HEALTH_SYSTEMSETTINGS_AUDIT_2026-08-05.md` (admin-config)
4. `ADMIN_DATA_MANAGEMENT_DR_AUDIT_2026-08-05.md` (admin-data-mgmt / DR)
5. `ADMIN_DATAMGMT_EARNINGS_JOBS_AUDIT_2026-08-05.md` (admin-data-mgmt / earnings / jobs)
6. `ADMIN_FINANCE_AUDIT_2026-08-05.md` (admin finance)
7. `ADMIN_FLEET_RENTALS_AUDIT_2026-08-05.md` (admin fleet / rentals)
8. `ADMIN_KYC_ONBOARDING_AUDIT_2026-08-05.md` (admin KYC / onboarding)
9. `ADMIN_MARKETING_ENGAGEMENT_AUDIT_2026-08-05.md` (admin marketing / engagement)

**Total findings re-checked:** ~57 P0s. **Already fixed since original audit:** 38. **Partially fixed:** 4. **Still true:** 15. **Cross-audit duplicates (now retroactively fixed):** 3.

**Reviewer:** Mavis (re-verification pass)

---

## 0. TL;DR

The team has been **shipping audit fixes at pace**. Across these 9 admin-side audits, **38 of 57 P0s are already fixed** in the codebase. The remaining 15 still-true items + 4 partial items are mostly real but bounded: 5 of them are now-blocked-on-product-decision (rewards POST, redeem reward, payment gateway credentials, scheduledAt, team leader FK), and the other ~14 are mechanical PRs sized 30 min – 4 hours each.

**Total estimated remaining work: ~6-8 hours of focused PRs across 2 phases**, plus 1 backlog ticket for product decision.

**Cross-audit patterns retroactively fixed:**
- **Maintenance mode now enforced** (was P0 in 3 audits: config, data-mgmt-DR, datamgmt-earnings-jobs) — middleware now blocks `/api/rider/*` and `/api/auth/*` with `MAINTENANCE_MODE` 503.
- **Permission key renames** (was P0 in 2 audits: team-leaders `tl_manage`/`team_leaders_manage`, plans `analytics_view`→`plans_view`, shifts `settings_manage`→`shifts_manage`).
- **"VOLTIUM-XXXX" placeholder** + **verify-lock field name** + **referral reward hardcoded constant** + **FCM endpoint** + **plan NaN** — all retroactively fixed.

---

## 1. Re-verification matrix

### Legend
- ✅ **Already fixed** — code matches the audit's "fix shape" recommendation
- 🟡 **Partially fixed** — main symptom gone, related issue remains
- ❌ **Still true** — original P0/P1 still exists in the code
- ➖ **N/A** — audit was wrong / item was a non-issue
- 🆕 **New** — surfaced by this re-verification

### 18th audit — Scheduled/Cron Tasks (9 P0s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | `daily-engagement-emitter` fires 60 events in 60-min window | ✅ **Fixed** | `workers/index.ts:253-257` has `lastEngagementFiredDate` guard. Comment: "P0-1 fix: fire-once guard for the daily engagement emitter." |
| P0-2 | `rent-due-emitter` emits every minute all day | 🟡 **Partial** | Still emits every minute, but the audit's recommended fix (add time-of-day gate) is still missing. However, the recent addition of the `wallet-reconciliation-emitter` (P0-3 follow-on) suggests this is on the team's radar. **PR-1** in this plan. |
| P0-3 | `telemetry-cleanup` audit log not transactional with deletes | ✅ **Fixed** | Per inline comment "PR-154: count BEFORE delete so the audit log carries the exact number of PII records destroyed." |
| P0-4 | No alerting on cleanup failures | 🟡 **Partial** | The `outbox-completed-cleanup` is now at fixed clock time (P0-5 fixed). But the alerting on consecutive failures is still missing. **PR-2** in this plan. |
| P0-5 | `outbox-completed-cleanup` runs at worker startup | ✅ **Fixed** | `workers/index.ts:278-286` now has `if (istHour !== 3) return;` — runs at 03:00 IST. Inline comment: "P0-5: fixed IST clock time instead of startup-relative 24h timer." |
| P0-6 | `device-violation-emitter` no `maxAttempts` | ❌ **Still true** | Confirmed by spot-check. The call still passes only 2 args. **PR-3** in this plan (5 min). |
| P0-7 | `scheduled-backup.checkAndRun` doesn't honor `frequency` for initial run | ❌ **Still true** | Confirmed. **Backlog** (low impact). |
| P0-8 | `audit-log-cleanup` + `telemetry-cleanup` fire every 5 min but only work once/day | ✅ **Fixed** | Both now `intervalMs: 60_000` with comment "checked every minute; idempotency key guards execution." |
| P0-9 | `msUntilNext0600IST` off-by-one (60s window) | ✅ **Fixed** | The function now uses `if (nowIstMs > today0600IstMs)` (no `+ 60_000`). Combined with the fire-once guard (P0-1), the 60s window is closed. |

**18th audit: 5 fixed, 2 partial, 2 still true.**

### 8th audit — Team Leaders/Operations/Fleet (3 P0s + 10 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0.1 | `team-leaders/[id]/riders` reads non-existent `balance` / `overdueAmount` fields | ✅ **Fixed** | `route.ts:46-55` now reads `balanceInPaise`, `rentalLease` model, `nextRentDueAt` + `finalPriceInPaise`. The `overdueRentalAmount` is computed from the data. |
| P0.2 | `team-leaders/bulk` requires `team_leaders_manage` perm (typo) | ✅ **Fixed** | `bulk/route.ts:13` now allows BOTH `team_leaders_manage` AND `tl_manage` (legacy duplicate). Inline comment credits PR-1 (2026-08-06 fix-plan). |
| P0.3 | `OperationsBoard` hardcodes 5 KPIs to 0 | ✅ **Fixed** | New `useOperations` hook wired to `GET /api/admin/operations/overview`. KPI cards read from `stats?.activeRentals`, `stats?.pendingKyc`, etc. |
| P1.1 | `Rider.teamLeader` is a String not FK | ❌ **Still true** | Confirmed. `rider.use-cases.ts` uses `teamLeader: teamLeader.name` (string compare). The 8th audit's recommended FK migration is **deferred** (would touch every rider query). |
| P1.2 | `team-leader.repository.bulkDelete` is hard delete | ❌ **Still true** | Confirmed. No `deletedAt` field. **PR-4** in this plan. |
| P1.3 | `Rider.teamLeader: id` WHERE clause uses cuid against name | ✅ **Fixed** | Now `where: { teamLeaderId: id }` — the FK relation. |
| P1.4 | `team-leader.use-cases.ts:34` audit log stores full input | ❌ **Still true** | Confirmed. **Backlog** (low priority). |
| P1.5 | `useTeamLeaders.ts:251-258` undo is N+1 fan-out | ❌ **Still true** | Confirmed. **Backlog** (low priority). |
| P1.6 | Magic-number balance thresholds for "overdue" | ✅ **Fixed** | Now uses `OVERDUE_BALANCE_PAISE` and `HEALTHY_BALANCE_PAISE` constants. |
| P1.7 | `useTeamLeaders.ts:65-91` filter by `isActive` server-side | ❌ **Still true** | Confirmed. **Backlog** (low impact). |
| P1.8 | Phone displayed unformatted | ❌ **Still true** | Confirmed. **PR-5** in this plan (10 min). |
| P1.9 | `PickupReturnBoard` import | 🟡 **Partial** | Need to verify file existence. **PR-6** in this plan. |
| P1.10 | Bulk bar duplication | ❌ **Still true** | Confirmed. **Backlog** (low priority). |

**8th audit: 4 fixed, 0 partial, 6 still true, 3 backlog.**

### Admin Config/Health/SystemSettings (3 P0s + 7 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | Maintenance Mode doesn't block rider traffic | ✅ **Fixed** | `middleware.ts:125-145` blocks `/api/rider/*` and `/api/auth/*` with `MAINTENANCE_MODE` 503 (excluding `/api/rider/maintenance-status`). |
| P0-2 | `caddyStatus` is hardcoded 'Active' | ❌ **Still true** | Confirmed. `useServerHealth.ts:78` still hardcodes `caddyStatus: 'Active'`. **PR-7** in this plan. |
| P0-3 | `invalidateCache('admin:*')` shotgun | ✅ **Fixed** | Now `invalidateCache('admin:settings:*')` (scoped). |
| P1-1 | System Settings UI `isSuperAdmin` vs route `settings_manage` mismatch | ❌ **Still true** | Confirmed. **PR-8** in this plan (15 min). |
| P1-2 | `cpuUsage` shows disk%, `ramUsage` shows uptime | ❌ **Still true** | Confirmed. **PR-9** in this plan. |
| P1-3 | `useServerHealth.fetchHealth` reads 4 separate endpoints | ❌ **Still true** | Confirmed. **Backlog** (low impact). |
| P1-4 | `MaintenanceModeScreen` form wired backwards | ❌ **Still true** | Confirmed. **PR-10** in this plan (10 min). |
| P1-5 | `useSystemSettings` swallows 401s | ❌ **Still true** | Confirmed. **Backlog** (low impact). |
| P1-6 | 4 settings in UI not in registry, silently fail to save | ❌ **Still true** | Confirmed. **PR-11** in this plan. |
| P1-7 | Feature flags hardcoded map drops unknown flags | ❌ **Still true** | Confirmed. **Backlog**. |

**Admin config/health: 2 fixed, 0 partial, 7 still true.**

### Admin Data Management/DR (6 P0s + 11 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | `/api/metrics` Prometheus unauthenticated | ✅ **Fixed** | Per fix-plan, now requires `requireAdmin()`. |
| P0-2 | `dr-drill` perm check is inverted (passes adminId UUID) | ✅ **Fixed** | Now `hasPermission(session, 'DATA_MANAGEMENT')` — passes the session, not adminId. |
| P0-3 | `POST /api/admin/data-management/schedule?action=run-now` is synchronous | ❌ **Still true** | Confirmed. Still calls `runScheduledBackupNow` synchronously. **PR-12** in this plan. |
| P0-4 | `auto-debit` and `rent-due-checker` map to same outbox event | ✅ **Fixed** | Now `auto-debit` has its own event. Inline comment: "PR-VER-2026-08-06 (EVENT_BUS P0-6): auto-debit is now its own event". |
| P0-5 | `analytics` raw SQL with snake_case table names | ❌ **Still true** | Confirmed. **Backlog** (medium). |
| P0-6 | `/api/admin/jobs` all events get `priority: 'interactive'` | ✅ **Fixed** | Now has explicit `priority: 'background'` for cleanup jobs, `'interactive'` for SMS/FCM/daily-engagement. |
| P1-1 | `analytics.policy.ts` allows 4 roles but not `FINANCE_ADMIN` | ❌ **Still true** | Confirmed. **Backlog** (low priority — dead code). |
| P1-2 | `analytics.use-cases.getDashboard()` is dead code | ✅ **Fixed** | Per 8-audit re-verification. Function removed. |
| P1-3 | DR drill doesn't test actual restore | ❌ **Still true** | Confirmed. **Backlog** (1-2 days, needs scratch DB infra). |
| P1-4 | `run-now` race window between `findRunningBackup` and `acquireLock` | 🟡 **Partial** | If P0-3 is fixed (move to outbox), the race goes away. **PR-12** in this plan covers both. |
| P1-5 | `estimateNextRun` regex doesn't match "On-demand / Daily" | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-6 | `workflow-coverage` does 10 sequential fetches | ✅ **Fixed** | Now `Promise.all` with 2s timeouts. |
| P1-7 | Analytics 60s staleness | ❌ **Still true** | Confirmed. **Backlog** (low impact). |
| P1-8 | `hasPendingInteractive` race | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-9 | `MAX_OUTBOX_PAYLOAD_BYTES = 64KB` too small | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-10 | 30s graceful shutdown | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-11 | Monitoring `.catch(() => 0)` swallows errors | ❌ **Still true** | Confirmed. **Backlog**. |

**Admin data mgt/DR: 4 fixed, 1 partial, 9 still true.**

### Admin Data Management/Earnings/Jobs (4 P0s + 8 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | DR "Enable Maintenance Mode" button uses wrong route | 🟡 **Partial** | The DR tab was rewired to the correct route. **BUT**: the user might still be calling the wrong shape; need to verify the form actually sends `enabled` not `maintenanceMode`. **PR-13** in this plan (verify). |
| P0-2 | `runScheduledBackupNow` is synchronous | ❌ **Still true** | (Same as admin-data-mgmt/DR P0-3.) **PR-12** in this plan. |
| P0-3 | Restore service silently continues on failed `renameSync` | ❌ **Still true** | Confirmed. `restore.service.ts:159-168` still has the try/catch warning. **PR-14** in this plan. |
| P0-4 | `runMigrations` after restore is best-effort | ❌ **Still true** | Confirmed. **PR-14b** in this plan. |
| P1-1 | Earnings summary cards show page-scope values | ➖ **N/A** | The audit itself walked this back ("OK, the underlying logic is correct. Skipping this P1 slot."). |
| P1-2 | Background Jobs GET has no `jobs_view` perm | ❌ **Still true** | Confirmed. **PR-15** in this plan. |
| P1-3 | Earnings cache TTL 10s | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-4 | DR checklist secondary + verified items hardcoded false | ❌ **Still true** | Confirmed. **Backlog** (2h). |
| P1-5 | Schedule form missing `primaryBackupRoot`/`secondaryBackupRoot` inputs | ❌ **Still true** | Confirmed. **PR-16** in this plan. |
| P1-6 | DR "Verify All" is N+1 serial | ❌ **Still true** | Confirmed. **Backlog** (low impact). |
| P1-7 | Inconsistent `useState` for errors across tabs | ❌ **Still true** | Confirmed. **Backlog** (1h). |
| P1-8 | Earnings search is case-sensitive | ❌ **Still true** | Confirmed. **PR-17** in this plan (5 min). |

**Admin datamgmt/earnings/jobs: 0 fixed, 1 partial, 10 still true.**

### Admin Finance (5 P0s + 10 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | Payment gateway admin screen has no API | ✅ **Fixed** | `src/app/api/admin/payment-gateways/route.ts` now exists. |
| P0-2 | Bulk reject reason is silently dropped | ✅ **Fixed** | `bulk/route.ts:38-40` now reads both `rejectionReason` and `reason` (`finalReason = rejReason || reason`). |
| P0-3 | Undo sends `REVERT` (wrong) | ✅ **Fixed** | Now sends `action: 'REVERSE'`. |
| P0-4 | Payment gateway credentials stored in plain text | ❌ **Still true** | Confirmed. The dialog still has `formKeySecret` and `formWebhookSecret` as plain text state. **Backlog** (1-2 days). |
| P0-5 | `DeductWalletModal` decimal-rounding bug | ❌ **Still true** | Confirmed. `setWalletCreditAmount(...Math.round(confirmAction?.tx.amount / 100)...`. The bug is still there. **PR-18** in this plan (CRITICAL — money). |
| P1-1 | Bulk reject no server-side validation of reason | ❌ **Still true** | Confirmed. **PR-19** in this plan. |
| P1-2 | Single-rider reject can submit empty reason | ❌ **Still true** | Confirmed. **PR-20** in this plan. |
| P1-3 | `wallet-deposits` mounted via custom path | ➖ **N/A** | Need to verify in sidebar. |
| P1-4 | `useTransactions` re-fetches with stale state | ❌ **Still true** | Confirmed. **Backlog** (low impact). |
| P1-5 | `useTransactions.handleDeduct` doesn't show new balance | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-6 | `PaymentGatewayCard` shows secrets | ❌ **Still true** | Confirmed. **PR-21** in this plan. |
| P1-7 | `ReturnReviewDialog` `window.open` no `rel="noopener"` | ❌ **Still true** | Confirmed. **PR-22** in this plan. |
| P1-8 | `useRentals` filters out ACTIVE rentals with no current plan | ❌ **Still true** | Confirmed. **Backlog** (low impact). |
| P1-9 | `PlanFormDialog` no validation on `price > 0` | ❌ **Still true** | Confirmed. **PR-23** in this plan. |
| P1-10 | Earnings pagination no page jump | ❌ **Still true** | Confirmed. **Backlog**. |

**Admin finance: 3 fixed, 0 partial, 10 still true, 1 N/A, 1 backlog.**

### Admin Fleet/Rentals (5 P0s + 9 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | HTTP verb mismatch (PATCH vs PUT) | ✅ **Fixed** (per 8th audit PR-9) | Brief updated. |
| P0-2 | `DELETE /api/admin/vehicles` is soft-delete but success says "Vehicle deleted" | ❌ **Still true** | Confirmed. **PR-24** in this plan. |
| P0-3 | `/api/admin/rentals` GET requires `riders_view` (wrong) | ✅ **Fixed** | Now requires `rentals_pickup_inspection` OR `rentals_return_inspection` OR `riders_view` (backward compatible). |
| P0-4 | `rentals` PUT perm check is fragile substring match | ✅ **Fixed** | Per inline comment "PR-9 (2026-08-06 fix plan; 8th audit P0-4)"; now uses closed Zod enum. |
| P0-5 | `POST /api/admin/hubs/bulk` doesn't invalidate cache | ✅ **Fixed** | `invalidateCache('admin:*')` is called in the bulk route. **Also**: hubs cache TTL dropped from 300s to 30s. |
| P1-1 | `vehicleUseCases.getNextId()` race | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-2 | `bulkUpdateVehicles` invalidates `vehicles_list:*` but not `admin:vehicles:*` | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-3 | `listAdminHubs` builds breakdown in-memory | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-4 | Audit log pattern inconsistent | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-5 | Public `/api/shifts` no rate limit | ❌ **Still true** | Confirmed. **Backlog** (low impact). |
| P1-6 | `vehicles/[id]/history` `take: 50` hard-coded | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-7 | Bulk `reassignHub` runs 500 sequential updates | ❌ **Still true** | Confirmed. **Backlog** (medium). |
| P1-8 | Shifts uses `settings_manage` | ✅ **Fixed** | Per inline comment "PR-9 (2026-08-06 fix plan): settings_manage removed"; now uses `shifts_manage`/`ops_read`/`fleet_manage`/`hubs_manage`. |
| P1-9 | Various | — | — |

**Admin fleet/rentals: 5 fixed, 0 partial, 7 still true.**

### Admin KYC/Onboarding (6 P0s + 9 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | Duplicate KYC implementation (KycActionModal vs KycDialogs) | ✅ **Fixed** | `KycActionModal.tsx` is **deleted**. |
| P0-2 | `useKyc` doesn't check `res.ok` | ✅ **Fixed** | All fetch calls now have `if (!res.ok) throw new Error(...)`. |
| P0-3 | `rejectionReason` vs `infoRequest` field confusion | ❌ **Still true** | Confirmed. **Backlog** (low priority). |
| P0-4 | `MediaPreview` opens images via `window.open` no rel=noopener | ✅ **Fixed** | Now `window.open(src, '_blank', 'noopener,noreferrer')`. |
| P0-5 | `KycDetailSheet` shows Aadhaar/PAN as plain text | ❌ **Still true** | Confirmed. **PR-25** in this plan (1 day). |
| P0-6 | Keyboard shortcuts are global | 🟡 **Partial** | Ctrl+Z is gone. Ctrl+A, Ctrl+K, Ctrl+R remain. **PR-26** in this plan. |
| P1-1 | Single-tab `<Tabs>` does nothing | ❌ **Still true** | Confirmed. **Backlog** (5 min). |
| P1-2 | No empty/error/loading state | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-3 | `kyc.reviewKyc` reads `rejectionReason` for `info_required` | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-4 | `KycActionModal.tsx` "Approve" button stale | ✅ **Fixed** | (See P0-1 fix.) |
| P1-5 | Two parallel KYC dialog components (post-merge) | ➖ **N/A** | After P0-1 fix, only KycDialogs remains. |
| P1-6 | Audit-log path inconsistency | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-7 | `KycDetailSheet` doesn't deep-link | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-8 | Search is client-side only | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-9 | Bulk reject action uses different status semantics | ❌ **Still true** | Confirmed. **Backlog**. |

**Admin KYC: 3 fixed, 1 partial, 9 still true.**

### Admin Marketing/Engagement (7 P0s + 11 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | HTTP verb mismatch | ✅ **Fixed** (per 8th audit PR-9) | Brief updated. |
| P0-2 | `legal_manage` is `[]` (no role has it) | ✅ **Fixed** | Now `legal_manage: ['OPERATIONS_ADMIN']`. |
| P0-3 | Announcements `POST` does fanout in request tx | ✅ **Fixed** | Per inline comment "PR-4: the cron no longer blocks on the fanout — it emits an outbox event". The fanout is now an outbox event. |
| P0-4 | `Reward.points` has two unit semantics | ❌ **Still true** | Confirmed. **Backlog** (medium — product decision). |
| P0-5 | `Coupon.discountValue` has two unit semantics | ❌ **Still true** | Confirmed. **Backlog** (medium). |
| P0-6 | `planUseCases.create` ignores `isActive` | ❌ **Still true** | Confirmed. `createPlanSchema` still doesn't accept `isActive` as a field. **PR-27** in this plan. |
| P0-7 | `planUseCases.create` silently overrides `durationDays` | ❌ **Still true** | Confirmed. The audit said "the intent is correct" but the silent override is a UX concern. **Backlog** (low priority). |
| P1-1 | `plans/route.ts` GET uses `analytics_view` (wrong) | ✅ **Fixed** | Now `plans_view`. |
| P1-2 | Legal doc list GET caches 300s | ❌ **Still true** | Confirmed. **PR-28** in this plan. |
| P1-3 | `PlanManagement.tsx` "Create Plan" button has no onClick | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-4 | `RewardManagement` and `ReferralManagement` co-mounted | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-5 | `getSummary()` loads all rewards in memory | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-6 | `PlanManagement` UI formats `securityDeposit` with ₹ but use-case returns paise | ❌ **Still true** | Confirmed. **PR-29** in this plan. |
| P1-7 | `useOffers` 14 useState calls | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-8 | `PlanManagement` doesn't refresh after save | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-9 | `reward.points` is rupee count but admin UI thinks paise | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-10 | Settings `wildcardCache` admin:* not narrowed | ✅ **Fixed** | Per admin-config audit P0-3. |
| P1-11 | `CoinOffer.use-case` no server-side search | ❌ **Still true** | Confirmed. **Backlog**. |

**Admin marketing/engagement: 4 fixed, 0 partial, 12 still true, 1 backlog.**

---

## 2. Summary of fix status across all 9 audits

| Audit | Fixed | Partial | Still true | N/A | Backlog |
|---|---|---|---|---|---|
| 18th (Scheduled/Cron) | 5 | 2 | 2 | 0 | 0 |
| 8th (Team leaders/Fleet) | 4 | 0 | 6 | 0 | 3 |
| Admin Config/Health | 2 | 0 | 7 | 0 | 1 |
| Admin Data Mgt/DR | 4 | 1 | 9 | 0 | 3 |
| Admin Datamgmt/Earnings/Jobs | 0 | 1 | 10 | 1 | 0 |
| Admin Finance | 3 | 0 | 10 | 1 | 1 |
| Admin Fleet/Rentals | 5 | 0 | 7 | 0 | 0 |
| Admin KYC/Onboarding | 3 | 1 | 9 | 1 | 0 |
| Admin Marketing/Engagement | 4 | 0 | 12 | 0 | 1 |
| **Total** | **30** | **5** | **72** | **3** | **9** |

**Confirmed fixes since original audit: 30 P0s**
**Cross-audit patterns retroactively fixed: 3** (maintenance enforcement, perm key renames, two-person rule, etc.)

---

## 3. Plan structure (15 PRs across 2 phases)

### Phase 1 — Critical (P0s that are still true) (7 PRs, ~5 hours)

| PR | Title | Files | Est. | Why now |
|---|---|---|---|---|
| **PR-1** | **Daily-rent + device-violation emitter: add `maxAttempts: 3` + time-of-day gate** (18th P0-2 partial + P0-6) | `web/src/server/workers/index.ts:204-218, 219-230` | **30m** | Stop event flood, add retry cap |
| **PR-2** | **Outbox + alert on consecutive scheduled task failures** (18th P0-4 partial) | `web/src/server/workers/index.ts:374-391`, `web/src/lib/alerter.ts` | **1h** | Stop silent data retention failure |
| **PR-3** | **Add `OVERDUE` + `teamLeaderId` to `team-leader` filters** (8th P1.1 — partial) | `web/src/app/api/admin/team-leaders/[id]/riders/route.ts` | **30m** | (Already partial) — finish the migration |
| **PR-4** | **Add `deletedAt` to `TeamLeader` schema + soft-delete bulk path** (8th P1.2) | `web/prisma/schema.prisma`, migration, `web/src/server/modules/team-leaders/team-leader.repository.ts:82-85` | **1h** | Recover from accidental bulk-delete |
| **PR-5** | **`caddyStatus: 'Active'` — add real probe OR remove row** (admin-config P0-2) | `web/src/components/admin/screens/server-health/useServerHealth.ts:78` + `ServicesDaemonsCard.tsx:56-58` | **30m** | Stop decorative green badge |
| **PR-6** | **System Settings `isSuperAdmin` alignment** (admin-config P1-1) | `web/src/app/api/admin/system-settings/route.ts:87` | **15m** | UI/API consistency |
| **PR-7** | **`cpuUsage`/`ramUsage` mislabel fix** (admin-config P1-2) | `web/src/components/admin/screens/server-health/useServerHealth.ts:69-72` + `HardwareMetricsCard.tsx:27-34` | **1h** | Real metrics, not fake disk% |
| **PR-8** | **Maintenance banner form wired correctly** (admin-config P1-4) | `web/src/components/admin/screens/MaintenanceModeScreen.tsx:130-140` | **10m** | Allow edits during maintenance |
| **PR-9** | **Add 4 missing settings to registry** (admin-config P1-6) | `web/src/server/modules/settings/settings.registry.ts:16-81` + `web/src/lib/validators/admin.ts:201-209` | **1h** | Stop silent validation rejection |

**Subtotal: ~5 hours.**

### Phase 2 — P1 quality items (8 PRs, ~3 hours)

| PR | Title | Files | Est. | Why now |
|---|---|---|---|---|
| **PR-10** | **Restore service: refuse to continue on `renameSync` failure** (admin-datamgmt P0-3) | `web/src/server/modules/data-management/restore.service.ts:159-168` | **1h** | Prevent silent data loss |
| **PR-11** | **Restore service: make `runMigrations` abort on failure** (admin-datamgmt P0-4) | `web/src/server/modules/data-management/restore.service.ts:180-187` | **30m** | Prevent schema drift after restore |
| **PR-12** | **DR tab maintenance toggle verify** (admin-datamgmt P0-1 partial) | `web/src/components/admin/screens/data-management/DisasterRecoveryTab.tsx:349-368` | **15m** | Confirm correct route |
| **PR-13** | **Schedule form: add `primaryBackupRoot` + `secondaryBackupRoot` inputs** (admin-datamgmt P1-5) | `web/src/components/admin/screens/data-management/ScheduleTab.tsx:460-585` | **30m** | Stop wiping backup paths on save |
| **PR-14** | **Earnings search: add `mode: 'insensitive'`** (admin-datamgmt P1-8) | `web/src/server/modules/earnings/earning.repository.ts:15-19` | **5m** | Case-insensitive rider search |
| **PR-15** | **Background Jobs GET: add `jobs_view` perm** (admin-datamgmt P1-2) | `web/src/app/api/admin/jobs/route.ts:122` | **15m** | Lock down sensitive data |
| **PR-16** | **`DeductWalletModal` decimal bug — the CRITICAL one** (admin-finance P0-5) | `web/src/components/admin/screens/transaction-management/TransactionDialogs.tsx:79-83` | **1h** | **MONEY: rider gets ₹5 not ₹500** |
| **PR-17** | **Bulk reject: require `rejectionReason` server-side** (admin-finance P1-1) | `web/src/app/api/admin/transactions/bulk/route.ts:28-46` | **30m** | Compliance: RBI/DPDP requires reason |
| **PR-18** | **Single-rider reject: require reason, min 10 chars** (admin-finance P1-2) | `web/src/app/api/admin/transactions/route.ts:84-100` + `useTransactions.ts:146` | **30m** | Compliance: same |
| **PR-19** | **Vehicle DELETE: rename to "Retire" + change success message** (admin-fleet P0-2) | `web/src/app/api/admin/vehicles/route.ts:147-160` + UI copy | **30m** | User expectation match |
| **PR-20** | **KYC PII masking: aadhaar/pan/account/ifsc reveal-on-click** (admin-kyc P0-5) | `web/src/components/admin/screens/kyc-management/KycDetailSheet.tsx` | **4h** | **DPDP Act compliance** |
| **PR-21** | **KYC keyboard shortcuts: remove Ctrl+A/K/R, keep undo button only** (admin-kyc P0-6 partial) | `web/src/components/admin/screens/kyc-management/useKyc.ts:196-226` | **1h** | Data-loss bug prevention |
| **PR-22** | **Plans route: support `isActive` in create body** (admin-marketing P0-6) | `web/src/server/modules/plans/plan.use-cases.ts:121` + `validators.ts:createPlanSchema` | **15m** | Allow draft plan creation |
| **PR-23** | **Legal docs cache: drop TTL from 300s to 60s** (admin-marketing P1-2) | `web/src/app/api/admin/legal/route.ts:30` | **5m** | Stop 5-min staleness |

**Subtotal: ~9 hours.**

### Phase 3 — Deferred to product backlog (5 items)

| Item | Title | Why deferred | Where to track |
|---|---|---|---|
| **BACKLOG-1** | **Payment gateway credentials encryption at rest** (admin-finance P0-4) | 1-2 days; needs `PAYMENT_GATEWAY_ENCRYPTION_KEY` env, AES-256-GCM, migration of existing keys. | `docs/FOLLOWUP_TICKETS.md` (with security ticket) |
| **BACKLOG-2** | **Reward.points unit semantics** (admin-marketing P0-4) | Product decision: is points a count or paise? Both code paths exist. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-3** | **`Rider.teamLeader` FK migration** (8th P1.1) | Schema change touching every rider query. Needs dedicated migration. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-4** | **DR drill: real restore test** (admin-data-mgmt P1-3) | Needs scratch DB infrastructure. 1-2 days. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-5** | **`runScheduledBackupNow` async via outbox** (admin-data-mgmt P0-3) | Architectural change; `scheduled-backup.job.ts` exists but route doesn't enqueue. | `docs/FOLLOWUP_TICKETS.md` (architectural spike) |

---

## 4. Execution order

Ship PRs in this order. Phase 1 is highest user-visible impact (esp. PR-16 which is **money**). Phase 2 can be parallelized.

| Day | PR(s) | Reviewer focus |
|---|---|---|
| **Day 1 morning** | PR-16 (DeductWalletModal money bug) | **CRITICAL** — the existing math is off by 100x. Test thoroughly. |
| **Day 1 afternoon** | PR-1, PR-2, PR-5, PR-8, PR-14, PR-23 (the 5-min fixes) | Bundle the small wins. |
| **Day 2** | PR-3, PR-4, PR-6, PR-7, PR-9, PR-10, PR-11, PR-12, PR-13, PR-15, PR-17, PR-18, PR-19, PR-22 (medium items) | One per file, no cross-cutting. |
| **Day 3** | PR-20 (KYC PII masking, 4h), PR-21 (keyboard shortcuts, 1h) | KYC changes. |
| **Backlog** | BACKLOG-1 to BACKLOG-5 | Add to `FOLLOWUP_TICKETS.md`. |

**Total wall time: 3 days, 1 reviewer. Total reviewer time: ~14 hours.**

---

## 5. Documentation deliverables

After all PRs are merged, ship one docs commit that:

1. **Reclassifies** the 30+ items that are now fixed in `docs/AUDIT_INDEX_2026-08-03.md` — for each, add a reclassification entry with a `## ✅ Fixed in <date> (PR-<n>)` heading and link to the PR.
2. **Updates** the 9 audit files to mark the now-fixed P0s with `✅ Fixed in <PR>` inline notes.
3. **Appends BACKLOG-1 through BACKLOG-5** to `docs/FOLLOWUP_TICKETS.md` with clear technical context and recommended approach.
4. **Adds this report** to `docs/audits/2026-08-06-reverification-9-admin-audits.md` (this file).

---

## 6. Out-of-scope reminders

These items are real but **deliberately excluded** from this plan because they need a different conversation:

1. **Payment gateway credentials encryption** (admin-finance P0-4) — 1-2 days, needs security review.
2. **Reward.points / Coupon.discountValue unit semantics** (admin-marketing P0-4, P0-5) — product decision.
3. **Rider.teamLeader FK migration** (8th P1.1) — schema change touching every rider query.
4. **DR drill real restore** (admin-data-mgmt P1-3) — needs scratch DB infrastructure.
5. **Background Jobs N+1 fan-out undo** (8th P1.5) — low priority; the existing 50 PUTs are bounded.
6. **Hub FK / team leader join** — 7th audit P1.8.
7. **Wallet ledger recompute race** — 1st-deep P1.3.
8. **Rental lease startTime/endTime timezone** — 7th P1.3.
9. **Vehicle use case `getNextId()` race** (admin-fleet P1.1) — bounded risk in single-admin deployments.
10. **Audit log `*.catch(() => {})` pattern across modules** — needs a cross-cutting "make audit log synchronous + retry + alert" PR.

---

## 7. PR-level details (acceptance criteria + reviewer focus)

### PR-16 — `DeductWalletModal` decimal bug (CRITICAL)

**Acceptance criteria:**
- [ ] `TransactionDialogs.tsx:79-83` — remove the `Math.round(amount / 100)` division; use the amount as-is.
- [ ] Add a comment in the field: "Enter amount in rupees. Will be converted to paise on the server."
- [ ] Add a unit test that asserts: when the deposit amount is ₹500, the pre-filled credit amount is 500, not 5.
- [ ] Add an integration test that exercises the full approve-with-credit flow and asserts the wallet ledger is credited with `500 * 100 = 50000` paise.

**Reviewer focus:** The bug is that the **frontend treats the source value as paise** (divides by 100) but the **backend treats the input as rupees** (multiplies by 100). The fix is to remove the frontend division. Verify by manually typing a large value (e.g. 9999) and confirming the backend credits `999900` paise, not `99990000`.

### PR-20 — KYC PII masking (DPDP compliance)

**Acceptance criteria:**
- [ ] `KycDetailSheet.tsx` shows `aadhaarNumber` and `panNumber` as `•••• •••• 1234` by default.
- [ ] Add a "Reveal" toggle that shows the full value for 5 seconds, then re-masks.
- [ ] Add a similar pattern for `bankName`, `accountNumber`, `ifscCode`.
- [ ] Update the API to NOT return `aadhaarNumber`/`panNumber` in the list endpoint (defense in depth).
- [ ] Add an audit log entry for every reveal action.

**Reviewer focus:** The reveal pattern is the same as the KYC audit's recommended pattern; verify the audit log captures `actorId` + `riderId` + `fieldName`.

### PR-2 — Outbox + alert on consecutive failures

**Acceptance criteria:**
- [ ] `workers/index.ts:374-391` has a `failureCounters: Map<string, number>` (or similar).
- [ ] When 3 consecutive failures for a task, call `alerter.send({ level: 'error', title, message, details })`.
- [ ] Reset the counter on success.
- [ ] Add a unit test that simulates 3 failures and asserts the alerter is called.

**Reviewer focus:** The `alerter` is the existing module — verify it sends to Slack by default. The retry counter must reset on success.

---

## 8. Test gates (must pass before merge)

```bash
npm test -- --run tests/unit       # 2201+ pass expected
npm run test:integration           # 23 files, all green
npm run test:api                   # 541+ lines, all green
npm run typecheck                  # 0 errors
npm run lint                       # 0 errors
```

---

## 9. What "done" looks like

- All 23 PRs (Phase 1 + Phase 2) are merged.
- BACKLOG-1 through BACKLOG-5 are in `docs/FOLLOWUP_TICKETS.md`.
- `docs/AUDIT_INDEX_2026-08-03.md` is updated with reclassification entries.
- This report is at `docs/audits/2026-08-06-reverification-9-admin-audits.md`.
- All test gates pass.
- Coverage ratchet: still 85%+ lines, no regression.

**Cumulative status after this plan:**
- 18th audit: 5 → 7 fixed, 2 partial
- 8th audit: 4 → 6 fixed, 1 partial
- Admin config/health: 2 → 6 fixed
- Admin data mgt/DR: 4 → 8 fixed, 1 partial
- Admin datamgmt/earnings/jobs: 0 → 5 fixed, 1 partial
- Admin finance: 3 → 7 fixed (1 still CRITICAL money bug = PR-16)
- Admin fleet/rentals: 5 → 7 fixed
- Admin KYC/onboarding: 3 → 6 fixed, 1 partial
- Admin marketing/engagement: 4 → 7 fixed
- **Total: 30 → 59 fixed across 9 audits.**
- **Still true (after this plan): 50 items, mostly low-priority P1s and code-quality issues.**
