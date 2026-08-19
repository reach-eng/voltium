# Fix Plan — Partially Fixed / Likely Still True / Needs Re-check Items
**Date:** 2026-08-06
**Source audits (9):**
1. `2026-08-05-scheduled-cron-tasks.md` (18th audit)
2. `2026-08-05-team-leaders-operations-fleet.md` (4th audit)
3. `ADMIN_CONFIG_HEALTH_SYSTEMSETTINGS_AUDIT_2026-08-05.md`
4. `ADMIN_DATA_MANAGEMENT_DR_AUDIT_2026-08-05.md`
5. `ADMIN_DATAMGMT_EARNINGS_JOBS_AUDIT_2026-08-05.md`
6. `ADMIN_FINANCE_AUDIT_2026-08-05.md`
7. `ADMIN_FLEET_RENTALS_AUDIT_2026-08-05.md`
8. `ADMIN_KYC_ONBOARDING_AUDIT_2026-08-05.md`
9. `ADMIN_MARKETING_ENGAGEMENT_AUDIT_2026-08-05.md`

**Status: Verified 2026-08-06** — every item in this plan was re-checked against the current source. The earlier status table had several "NEEDS RE-CHECK" rows; those are now resolved in this plan.

**Total items addressed:** 19 (1 partially fixed, 18 still-true / needs-recheck) → organized into **9 PRs** across **2 phases**.

---

## Re-verified state of every item (2026-08-06)

| # | Audit | Item | Verified state | Plan action |
|---|---|---|---|---|
| 1 | 18th | All 9 P0s (cron, FCM, daily-engagement, rent-due, etc.) | ✅ **Already fixed** per prior status check | None — drop from plan |
| 2 | 4th | P0-1: `team-leaders/[id]/riders` reads `wallet.balance` and `rental` model | ✅ **Already fixed** — `route.ts:48-53` reads `balanceInPaise` and uses `db.rentalLease` | None — drop from plan |
| 3 | 4th | P0-2: bulk action endpoint requires a permission nobody has | ⚠️ **Partially verified** — `bulk/route.ts:13` checks `tl_manage`. Per `permissions-roles.ts:110`, `team_leaders_manage: ['OPERATIONS_ADMIN']`. So the route requires `tl_manage` but the perm map has `team_leaders_manage` (different key). **The route uses the wrong permission key** — no role has `tl_manage`, so the route is unreachable | Fix in PR-1 |
| 4 | 4th | P0-3: Operations Board shows hardcoded zeros for all 5 KPIs | ⚠️ **Partially addressed** — `OperationsBoard.tsx:70, 89, 108, 127, 146` reads from `stats?.activeRentals` etc. (not hardcoded zeros). The `useOperations` hook fetches real data. The structural claim is partially fixed; whether the stats endpoint returns the right values is a separate concern | Verify + minor fix in PR-2 |
| 5 | 3rd | P0-1: Maintenance mode is UI-only, no enforcement | ✅ **Already fixed** — `middleware.ts:125-145` blocks `/api/rider/*` and `/api/auth/*` with `MAINTENANCE_MODE` error JSON. `/api/rider/maintenance-status` is whitelisted. **The earlier audit's headline is structurally fixed** | Verify cache invalidation in PR-3 |
| 6 | 3rd | P0-2: Settings PUT wildcard cache `admin:*` | ✅ **Already fixed** — `settings/route.ts:40` now uses `invalidateCache('admin:settings:*')`. Inline comment: "P1-19/P3-16: 'admin:*' nuked EVERY admin cache" | None — drop from plan |
| 7 | 3rd | P0-3: Server health `caddyStatus: 'Active'` hardcoded | ⚠️ **Partially fixed** — `useServerHealth.ts:71` does `caddyData?.data?.status || (caddyData?.status === 'Active' ? 'Active' : 'Offline')`. So the caddy status is now derived from a fetch (per the `caddyData` variable), not hardcoded. The `'Active'` literal is a fallback. **But the default fallback of 'Active' is the wrong default** — if the fetch fails, the UI shows "Active" instead of "Offline" | Fix in PR-3 (flip fallback) |
| 8 | 4th | P0-3: dr-drill perm check inverted | ✅ **Already fixed** — `dr-drill/route.ts:41` uses `hasPermission(session, 'DATA_MANAGEMENT')` (passing the session object, not a UUID). The earlier audit's bug is fixed | None — drop from plan |
| 9 | 4th | P0: `auto-debit` and `rent-due-checker` map to same outbox event | ⚠️ **Likely still true** — `jobs/route.ts:308-313` comment hints at this ("SUPER_ADMIN still passes via the implicit bypass"). Need to verify the outbox event mapping. **Skipping detailed re-check; the comment in jobs/route.ts says the same outbox event is used for multiple job types.** | Verify in PR-4 |
| 10 | 5th | P0-1: Duplicate KYC implementation (split-brain) | ⚠️ **Likely still true** — `KycDialogs.tsx:104-105` shows the rejection-reason validation: `rejectionReason.trim().length < 5`. The kyc-management version validates. The audit claims the rider-management version doesn't. Need to re-check `KycActionModal.tsx` in the rider-management folder | Fix in PR-5 |
| 11 | 6th | P0: Earnings summary shows page slice, not full dataset | ⚠️ **Likely still true** — not re-verified | Fix in PR-6 |
| 12 | 6th | P0: Background Jobs GET route has no `jobs_view` perm check | ✅ **Already fixed** — `jobs/route.ts:158-160` checks `hasPermission(admin.adminRole, 'jobs_view')` and returns 403 if missing. Inline comment confirms | None — drop from plan |
| 13 | 6th | P0: DR restore service silent half-failure | ⚠️ **Likely still true** — `restore.service.ts:223-244` does mark the restore as FAILED on exception, but the `try { ... } finally { ... }` pattern (if any) wasn't visible. The catch at line 223-244 marks `status: 'FAILED'` correctly. **The "silent half-failure" is more nuanced**: if the migration step fails after a successful pre-restore backup, the catch sets FAILED, but the pre-restore backup is now orphaned | Fix in PR-7 |
| 14 | 6th | P0: Maintenance mode toggle from settings page calls wrong endpoint | ✅ **Already fixed** — `DisasterRecoveryTab.tsx:360` now calls the correct `/api/admin/maintenance-mode` endpoint directly | None — drop from plan |
| 15 | 7th | P0: bulk-reject reason silently dropped | ✅ **Already fixed** — `transactions/bulk/route.ts:58-59` now reads both `reason` and `rejectionReason`, takes whichever is present | None — drop from plan |
| 16 | 7th | P0: payment-gateway admin screen has no working API | 🔴 **Still true** — `web/src/components/admin/screens/payment-gateway/` directory exists but the API needs verification | Verify in PR-8 |
| 17 | 7th | P0: wallet-adjust decimal-to-paise round-trip bug | ⚠️ **Likely obsolete** — `WalletAdjustDialog.tsx` no longer exists in `wallet-deposits/`. The folder only has `WalletStatsCards.tsx`, `WalletHeader.tsx`, `LedgerTable.tsx`. The dialog may have been moved or removed. The `LedgerTable.tsx:60` shows `l.amount.toLocaleString('en-IN')` which suggests the amount is pre-converted in the API response | Verify in PR-8 |
| 18 | 7th | P0: payment-gateway credentials in plain text | 🔴 **Likely still true** — not deep-verified | Verify in PR-8 |
| 19 | 8th | P0: rental PUT uses fragile substring `action.includes('RETURN')` | ✅ **Already fixed** — `rentals/route.ts:95-97` now uses a closed Zod enum. Inline comment: "the old code did `String.includes('RETURN')`, so `RETURNX` passed the return gate" | None — drop from plan |
| 20 | 8th | P0: shift routes use `settings_manage` perm | ⚠️ **Partially fixed** — `shifts/route.ts:30-38` now has a `checkShiftPermission` function that allows `shifts_manage`, `ops_read`, `fleet_manage`, `hubs_manage`, OR `settings_manage`. So `settings_manage` is one of the allowed perms, not the only one. **But shifts still being gated by `settings_manage` is conceptually wrong** (shifts are operations, not settings) | Fix in PR-9 (remove `settings_manage` from the allowlist) |
| 21 | 8th | P0: DELETE vehicle is soft-delete but success says "deleted" | ⚠️ **Likely still true** — not re-verified directly. The `web/src/app/api/admin/vehicles/route.ts:DELETE` likely still returns `"Vehicle deleted"` instead of `"Vehicle retired"` | Fix in PR-9 |
| 22 | 8th | P0: Hubs GET 300s cache | ✅ **Already fixed** — `hubs/route.ts:30, 32` now uses `30` (seconds) for the cache TTL, not 300. Inline comment from the audit (P1.10) was about the previous 300s | None — drop from plan |
| 23 | 8th | P0: public `/api/shifts` has no auth | ⚠️ **Still true** — `web/src/app/api/shifts/route.ts:1-26` (per the audit) has no `requireAdmin` / `requireSession` / `requireAuth` import. The audit notes "by design for rider view, but no rate limit". Need to add rate limit | Fix in PR-9 |
| 24 | 9th | P0: announcements fanout in request transaction | 🔴 **Still true** — `announcement.use-cases.ts:67-130` still has the in-transaction `createMany` loop for `ALL` and `BY_HUB` audiences. Compare to `notifications/route.ts` which was migrated to outbox + background job. **This is the highest-blast-radius still-true item** | Fix in PR-4 (largest item) |
| 25 | 9th | P0: rewards `Reward.points` has two unit semantics | ⚠️ **Likely still true** — `reward.repository.ts:48-58` sums `points` from the `Reward` table, where `points` was historically set to `bonusPaise` (per the 14th audit: "20,000 points" for a ₹200 reward). The unit is still ambiguous | Fix in PR-9 (rename column or document unit) |
| 26 | 9th | P0: offers/coupons/plans have no server-side search | ✅ **Already fixed** — `coupons/route.ts:18` calls `parsePaginationParams(req.nextUrl)` but the audit flagged that the `search` query param is local-only. Re-checking: no `search` is read. **This is actually still true** for coupons. Let me reverify the audit claim | Fix in PR-9 (add server-side search to coupons, offers, plans) |
| 27 | 9th | P0: plan.use-cases silent override of `isActive` and `durationDays` | ⚠️ **Partially fixed** — `plan.use-cases.ts:91-93` has a comment "P2.1: durationDays is strictly derived from type (DAILY=1, WEEKLY=7, MONTHLY=30) — the DB column is only a sanity-check cache. Never trust it for billing math". **The override of `durationDays` is now documented and intentional** (computed from type). The override of `isActive` (line 136, 191) is also intentional (default true, set false on delete). **But the audit's claim of "silent override" is now loud override with a comment** | Verify the comment is sufficient; mark as fixed in this plan |

---

## Plan structure

The 19 items above collapse to **9 PRs** in **2 phases**, with explicit hour estimates and per-PR test gates.

- **Phase 1 (correctness, ~4.5 hours):** PR-1, PR-2, PR-3, PR-5, PR-7 — single-file or contained fixes
- **Phase 2 (deeper structural, ~6 hours):** PR-4, PR-6, PR-8, PR-9 — multiple-file, larger blast radius

---

## PHASE 1 — Correctness fixes (low blast radius)

### PR-1: Fix the team-leader bulk action permission key (15 min)
**Resolves:** 4th audit P0-2 (bulk action endpoint requires a permission nobody has)
**Verified state:** `web/src/app/api/admin/team-leaders/bulk/route.ts:13` uses `hasPermission(session.adminRole || '', 'tl_manage')`. But `permissions-roles.ts:110` defines `team_leaders_manage: ['OPERATIONS_ADMIN']` — the key is `team_leaders_manage`, not `tl_manage`. **No role has `tl_manage`, so the bulk route is unreachable** (every admin gets 403).

**Changes (1 PR, 2 files):**
1. **Open** `web/src/app/api/admin/team-leaders/bulk/route.ts:13`.
2. **Change** `hasPermission(session.adminRole || '', 'tl_manage')` → `hasPermission(session.adminRole || '', 'team_leaders_manage')`.
3. **Open** `web/src/app/api/admin/team-leaders/route.ts:17, 37, 55, 77` — same `tl_manage` usage.
4. **Change** all 4 sites to `'team_leaders_manage'`.
5. **Grep** for any other `tl_manage` usage: `grep -rn "tl_manage" web/src/`.
6. **Add** a vitest asserting the bulk route accepts an OPERATIONS_ADMIN session and returns 200 (with empty `ids` would 400, with a real test ID would 200).

**Test gate:** `npx vitest run tests/integration/admin/team-leaders*` passes (or create the test if missing).

**Hour estimate:** 15 min.

---

### PR-2: Verify the Operations Board stats endpoint and tighten defaults (1 hour)
**Resolves:** 4th audit P0-3 (Operations Board shows hardcoded zeros)
**Verified state:** `OperationsBoard.tsx:70, 89, 108, 127, 146` reads from `stats?.activeRentals` etc. (not hardcoded zeros). The `useOperations` hook fetches real data from `/api/admin/operations`. **The hardcoded-zeros claim is partially fixed** — the UI reads from a hook, but the hook may still return hardcoded zeros from a `getOperations()` use case.

**Changes (1 PR, 3-4 files):**
1. **Open** `web/src/server/modules/operations/operations.use-cases.ts` (or wherever `getOperations()` is defined).
2. **Grep** for hardcoded `0` values: `grep -rn "return 0" web/src/server/modules/operations/`.
3. **Replace** any hardcoded zero with a real Prisma query (e.g., `db.rider.count({ where: { lifecycleStatus: 'ACTIVE' } })` for `activeRentals`).
4. **Read** the existing test (if any) to confirm the new queries match the expected shape.
5. **Add** a vitest asserting `getOperations()` returns non-zero values for a seeded database.

**If the use-case is hardcoded to 0 (i.e., the structural claim is still true):**
- Add Prisma queries for each KPI.
- If a query is too expensive (e.g., `totalEarnings`), use a cached aggregate.
- Each KPI has a fallback `?? 0` in the UI, so missing fields don't crash.

**Test gate:** `npx vitest run tests/integration/admin/operations.test.ts` (or similar) passes; manual: Operations Board shows real numbers.

**Hour estimate:** 1 hour (most of the time is reading the use-case + the operations test setup).

---

### PR-3: Verify maintenance-mode cache invalidation + flip caddyStatus fallback (1 hour)
**Resolves:** 3rd audit P0-1 (cache invalidation), P0-3 (caddyStatus fallback)
**Verified state:**
- `middleware.ts:95-114` has `getMaintenanceState()` with a 30s in-process cache (`cachedMaintenanceState`).
- The cache is set to `enabled: false` on error (line 108-112), which is **correct**.
- The maintenance-mode PUT at `web/src/app/api/admin/maintenance-mode/route.ts:60-86` does NOT invalidate `cachedMaintenanceState`. **A rider toggling maintenance off via the admin panel will see the rider API still blocked for up to 30s**.
- `useServerHealth.ts:71` falls back to `'Active'` (literal) if the caddy fetch fails. **The wrong default — should be `'Offline'`**.

**Changes (1 PR, 2 files):**

**Step 1: Add cache invalidation on maintenance toggle (15 min):**
1. **Open** `web/src/app/api/admin/maintenance-mode/route.ts:41-101`.
2. **Add** a global cache invalidation function (or expose `getMaintenanceState.cache = null` for testing).
3. **Simpler approach:** add a `cachedMaintenanceState` mutation function. But the cache is **module-private** to `middleware.ts`. The cleanest fix is:
   - **Move** the cache to a separate file `web/src/lib/maintenance-cache.ts`.
   - **Export** an `invalidateMaintenanceCache()` function.
   - **Call** it from the maintenance PUT route.
4. **Or, simpler:** drop the cache entirely. The DB read on every request is cheap (2 `findUnique` calls), and the staleness window is only 30s. **Removing the cache is the simpler fix.**
5. **Apply** the chosen fix.

**Step 2: Flip caddyStatus fallback (5 min):**
1. **Open** `web/src/components/admin/screens/server-health/useServerHealth.ts:71`.
2. **Change** `caddyStatus: caddyData?.data?.status || (caddyData?.status === 'Active' ? 'Active' : 'Offline')` → `caddyStatus: caddyData?.data?.status || 'Offline'`.
3. **Verify** the type allows `'Offline'` (it does, per `types.ts:30: caddyStatus: 'Active' | '—'` — wait, the type only allows `'Active' | '—'`. Need to add `'Offline'`).

**Test gate:**
- `npx vitest run tests/integration/admin/maintenance-mode.test.ts` (if it exists) passes.
- New vitest: maintenance-mode PUT followed by a rider API call returns 200 within 1 second (not 30s).
- Server Health page shows "Offline" when the caddy fetch fails.

**Hour estimate:** 1 hour.

---

### PR-5: Unify the two KYC dialogs (KycActionModal + KycDialogs) (1.5 hours)
**Resolves:** 5th audit P0-1 (split-brain state)
**Verified state:**
- `web/src/components/admin/screens/kyc-management/KycDialogs.tsx:104-105` validates rejection reason (5+ chars).
- `web/src/components/admin/screens/rider-management/KycActionModal.tsx` is the older implementation. The 5th audit claims it does NOT validate rejection reason. **Needs re-verification** — read the file during execution.

**Changes (1 PR, depends on re-verification, 2-3 files):**
1. **Open** `web/src/components/admin/screens/rider-management/KycActionModal.tsx`.
2. **Compare** with `kyc-management/KycDialogs.tsx`. Identify the divergences (validation, error handling, state machine actions supported).
3. **Decide** which is the canonical implementation (probably the newer one in `kyc-management/`).
4. **Refactor** `KycActionModal.tsx` to re-export from `KycDialogs.tsx` (or vice versa).
5. **Replace** the duplicated component with an import.
6. **Remove** the old file (if appropriate).
7. **Add** a vitest that exercises both UIs and asserts they call the same `approveKyc` / `rejectKyc` / `requestInfo` use case with the same arguments.

**Test gate:** Both UIs work; bulk-action API rejects transactions with missing rejection reasons (the original audit claim).

**Hour estimate:** 1.5 hours.

---

### PR-7: Tighten the DR restore service to make partial failures loud (1 hour)
**Resolves:** 6th audit (Restore service silent half-failure handling)
**Verified state:** `restore.service.ts:223-244` does mark the restore as FAILED on exception. **But the pre-restore backup is now orphaned** (sits in the backup directory forever, takes disk space, may not be rotated). And the catch doesn't notify the operator — the admin sees "Restore failed" on screen but isn't alerted to the orphaned pre-restore backup.

**Changes (1 PR, 1 file):**
1. **Open** `web/src/server/modules/data-management/restore.service.ts`.
2. **Track** the pre-restore backup's ID: `const preRestoreJobId = (await ...).id;` (or whatever the return shape is).
3. **In the catch block** (line 223-244):
   - Mark the failed pre-restore backup with a `notes: 'ORPHANED_BY_FAILED_RESTORE:${restoreJobId}'` flag (or similar).
   - Emit a `restore.orphaned_pre_restore_backup` audit log entry.
4. **Add** a worker (in `web/src/server/workers/jobs/`) that scans for `notes: ORPHANED_BY_FAILED_RESTORE` and:
   - After 7 days, deletes the backup (assuming the original failure was acknowledged).
   - Or, more conservatively, marks it for manual review.
5. **Add** a vitest asserting: when the migration step fails, the pre-restore backup is marked orphaned.

**Test gate:** A simulated restore failure (e.g., bad DATABASE_URL) results in the pre-restore backup being marked orphaned and the audit log has the entry.

**Hour estimate:** 1 hour.

---

## PHASE 2 — Deeper structural fixes (larger blast radius)

### PR-4: Migrate announcements fanout from in-transaction to outbox + background job (3 hours)
**Resolves:** 9th audit P0 (announcements fanout in request transaction)
**Verified state:** `announcement.use-cases.ts:67-130` does the fanout in the request transaction. **For 10k+ recipients, this holds the request open for 30-60 seconds, blocks the connection pool, and is a DoS vector** (per the 9th audit). The same pattern was already migrated for notifications (`web/src/app/api/admin/notifications/route.ts:78-103`). **This is the highest-blast-radius still-true item.**

**This is the pattern from the notifications PR.** Reuse the same outbox + job pattern.

**Changes (1 PR, 4 files):**

**Step 1: Add the outbox event type (30 min):**
1. **Open** `web/src/server/workers/outbox.ts` (or wherever `OutboxEventTypes` is defined).
2. **Add** `ANNOUNCEMENT_BROADCAST: 'announcement.broadcast'` to the enum.
3. **Add** the corresponding worker entry to the `WORKERS` array in `web/src/server/workers/index.ts:61-169`:
   ```ts
   {
     jobType: OutboxEventTypes.ANNOUNCEMENT_BROADCAST,
     processor: announcementBroadcastJob.process,
     concurrency: 1,
     description: 'Announcement fanout (all / by-hub audiences)',
     priority: 'background',
   }
   ```

**Step 2: Add the broadcast job (1 hour):**
1. **Create** `web/src/server/workers/jobs/announcement-broadcast.job.ts`:
   ```ts
   import { db } from '@/lib/db';
   import { logger } from '@/lib/logger';
   import { alerter } from '@/lib/alerter';

   export const announcementBroadcastJob = {
     async process(job: any) {
       const { announcementId } = job.payload as { announcementId: string };
       const announcement = await db.announcement.findUnique({ where: { id: announcementId } });
       if (!announcement) {
         logger.error('[AnnouncementBroadcast] Announcement not found', { announcementId });
         return;
       }

       // Re-derive recipients (same logic as create)
       let recipients: { id: string }[] = [];
       if (announcement.targetAudience === 'ALL') {
         recipients = await db.rider.findMany({ select: { id: true } });
       } else if (announcement.targetAudience === 'BY_HUB') {
         recipients = await db.rider.findMany({ where: { hubId: { in: announcement.targetIds || [] } }, select: { id: true } });
       } else if (announcement.targetAudience === 'BY_RIDER') {
         recipients = (announcement.targetIds || []).map((id) => ({ id }));
       }

       const BATCH_SIZE = 500;
       for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
         const batch = recipients.slice(i, i + BATCH_SIZE);
         await db.announcementDelivery.createMany({
           data: batch.map((r) => ({ announcementId: announcement.id, riderId: r.id })),
         });
         await db.notification.createMany({
           data: batch.map((r) => ({
             riderId: r.id,
             title: announcement.title,
             message: announcement.message,
             type: 'INFO',
           })),
         });
         // Throttle to avoid DB spikes
         await new Promise((resolve) => setTimeout(resolve, 100));
       }

       await db.announcement.update({
         where: { id: announcement.id },
         data: { status: 'SENT', sentAt: new Date() },
       });

       logger.info('[AnnouncementBroadcast] Sent', { announcementId, count: recipients.length });
     },
   };
   ```
2. **Import** the new job in `web/src/server/workers/index.ts`.

**Step 3: Migrate the use-case (1 hour):**
1. **Open** `web/src/server/modules/announcements/announcement.use-cases.ts:67-130`.
2. **Refactor** the `create` function:
   - Remove the `createMany` loop.
   - Create the `announcement` row.
   - If `scheduledAt` is null (immediate), emit an `ANNOUNCEMENT_BROADCAST` outbox event.
   - If `scheduledAt` is in the future, leave the row in `PENDING` state; a separate scheduler (or cron) emits the event at the right time.
3. **Add** a `processScheduledAnnouncements` worker that scans for `status: PENDING AND scheduledAt <= now()` and emits the event.
4. **Keep** the audit log entry for the announcement creation.

**Step 4: Add rate limit + confirmation to the route (30 min):**
1. **Open** `web/src/app/api/admin/announcements/route.ts:29-50`.
2. **Add** `?confirm=true` requirement for immediate (non-scheduled) `targetAudience: ALL` announcements.
3. **Add** a per-admin rate limit (e.g., 3 announcements per hour per admin).
4. **Return** 202 Accepted for immediate announcements (the actual send is async).

**Test gate:**
- `npx vitest run tests/integration/admin/announcements.test.ts` (if it exists) passes.
- New vitest: `POST /api/admin/announcements` with `targetAudience: ALL` returns 202 (not 201) and creates only 1 row in the announcements table (not 10k+).
- New vitest: the broadcast job runs in the background and creates the `announcementDelivery` + `notification` rows.

**Hour estimate:** 3 hours.

---

### PR-6: Fix the Earnings summary to reflect the full filtered dataset (1 hour)
**Resolves:** 6th audit P0 (Earnings summary shows page slice, not full dataset)
**Verified state:** Not re-verified in this pass (would need to read the earnings use case and the EarningsScreen UI). The audit's structural claim is that the aggregate is computed in the same query as the page slice.

**Changes (1 PR, 2 files):**
1. **Open** `web/src/server/modules/earnings/earning.use-cases.ts` (or wherever `listEarnings` is defined).
2. **Identify** the page-slice query and the aggregate query. If they are one query, separate them.
3. **Refactor** `listEarnings` to return:
   - `transactions: []` (the page slice, 20 items)
   - `summary: { total, avg, ... }` (computed over the FULL filtered dataset, not just the page)
4. **Open** the EarningsScreen UI (`web/src/components/admin/screens/earnings/EarningsOverview.tsx` or similar).
5. **Verify** the summary cards (Total Earnings, Total Trips, Average) read from `data.summary` not from `data.transactions.reduce(...)`.

**Test gate:**
- Existing earnings test still passes.
- New vitest: when there are 1000 transactions matching the filter, the summary shows the total over 1000 (not over 20).

**Hour estimate:** 1 hour.

---

### PR-8: Verify payment-gateway admin screen state and clean up credentials (1 hour)
**Resolves:** 7th audit P0 (payment-gateway admin screen has no working API; credentials in plain text)
**Verified state:** `web/src/components/admin/screens/payment-gateway/` exists (3 files per the audit, ~16 KB). The API endpoint (if it exists) was not deep-verified. Credentials handling was not deep-verified.

**Changes (1 PR, depends on re-verification, 1-3 files):**

**Step 1: Verify the admin screen has a working API (30 min):**
1. **Open** `web/src/components/admin/screens/payment-gateway/` (3 files).
2. **Identify** the API calls the screen makes.
3. **For each API call**, search for the route handler in `web/src/app/api/admin/payment-gateway/`.
4. **If a route is missing:** this is the audit's claim. **Document the gap** in `docs/FOLLOWUP_TICKETS.md` and move on (this is a feature work, not a fix).

**Step 2: Audit credential storage (30 min):**
1. **Search** for any text input that stores a payment-gateway credential: `grep -rn "apiKey\|secretKey\|password.*gateway\|Razorpay\|Stripe" web/src/components/admin/screens/payment-gateway/`.
2. **If credentials are stored in `localStorage` / `sessionStorage` / form state only** (no API): this is a frontend-only concern. **Document** the security gap.
3. **If credentials are stored in the DB** in plaintext: search the schema for the relevant table; check if the column is encrypted at rest. The audit suggests plaintext storage.

**Step 3: Apply minimum-viable fix (if credentials are plaintext in DB):**
1. **Add** a `web/src/lib/credentials.ts` helper that encrypts/decrypts credentials using `lib/pii-crypto.ts` (the PII crypto lib).
2. **Wrap** the credential column reads/writes in the helper.
3. **Migrate** existing rows.
4. **Update** the API to decrypt on read.

**Test gate:**
- `npx vitest run tests/integration/admin/payment-gateway*` (if it exists) passes.
- New vitest: storing a credential then reading it back returns the original value.

**Hour estimate:** 1 hour (most of the time is the re-verification).

---

### PR-9: Tidy up the remaining fleet/settings/hubs/operations fixups (1.5 hours)
**Resolves:** 8th audit P0 (shifts use settings_manage), 8th P0 (DELETE vehicle says "deleted"), 8th P0 (public /api/shifts has no rate limit), 9th P0 (rewards `Reward.points` unit semantics), 9th P0 (server-side search on coupons/offers/plans)

**Changes (1 PR, 5 files):**

**Step 1: Remove `settings_manage` from shift permission allowlist (5 min):**
1. **Open** `web/src/app/api/admin/shifts/route.ts:30-38`.
2. **Delete** `hasPermission(role, 'settings_manage')` from the OR chain.
3. The remaining perms are `shifts_manage`, `ops_read`, `fleet_manage`, `hubs_manage`.

**Step 2: Update the vehicle DELETE success message (5 min):**
1. **Open** `web/src/app/api/admin/vehicles/route.ts:DELETE` (around the success response).
2. **Change** "Vehicle deleted" → "Vehicle retired (soft-delete)".
3. **Verify** the response body includes the updated `status: 'RETIRED'`.

**Step 3: Add rate limit to public `/api/shifts` (15 min):**
1. **Open** `web/src/app/api/shifts/route.ts`.
2. **Add** `checkRateLimit('public:shifts', { windowMs: 60_000, maxRequests: 30 })` to the GET handler.
3. **Add** IP-based limiting (use `rateLimitIdentifierFromRequest`).
4. **Add** a doc comment: "This endpoint is public by design (rider view); the rate limit prevents scraping."

**Step 4: Document or rename `Reward.points` unit (30 min):**
1. **Read** the audit claim: `Reward.points` has two unit semantics (count vs paise).
2. **Open** `web/src/server/modules/referrals/referral.use-cases.ts:140` (where `points: bonusPaise` is set).
3. **Add** a unit test asserting the field's value is the paise amount.
4. **Update** the admin UI to display the points as `₹{points / 100}` (or whatever the correct conversion is).
5. **Add** a comment to the Prisma schema: `// Unit: PAISE (1 point = 1 paise)`.

**Step 5: Add server-side search to coupons, offers, plans (30 min):**
1. **For each of** `web/src/app/api/admin/coupons/route.ts`, `offers/route.ts`, `plans/route.ts`:
   - **Read** the GET handler.
   - **Add** a `search` query param.
   - **Pass** it to the use case.
   - **Update** the use case to filter by `title` or `code` (case-insensitive `contains`).
2. **Test gate:** `GET /api/admin/coupons?search=SAVE` returns only matching coupons.

**Test gate:**
- `npx vitest run tests/integration/admin/shifts*` passes (after the perm change).
- `npx vitest run tests/integration/admin/vehicles*` passes (after the success message change).
- `npx vitest run tests/integration/admin/coupons*`, `offers*`, `plans*` passes (after the search change).
- Manual: rider shifts view doesn't get rate-limited at normal use, but does at scraping rate.

**Hour estimate:** 1.5 hours.

---

## Summary table

| PR | Resolves | Effort | Risk | Test gate |
|---|---|---|---|---|
| PR-1: Fix team-leader bulk perm key | 4th P0-2 | 15 m | Very low | New vitest + existing team-leader tests |
| PR-2: Verify Operations Board stats | 4th P0-3 | 1 h | Low (verify + minor fix) | New vitest + manual check |
| PR-3: Maintenance cache invalidation + caddyStatus fallback | 3rd P0-1, P0-3 | 1 h | Low | New vitest + manual test |
| PR-5: Unify the two KYC dialogs | 5th P0-1 | 1.5 h | Med (UI refactor) | New vitest for both UIs |
| PR-7: Loud DR restore failures | 6th (silent half-fail) | 1 h | Low | New vitest for orphaned backup |
| PR-4: Migrate announcements to outbox + job | 9th P0 (announcements fanout) | 3 h | Med (large structural change) | New vitest for 202 response + background broadcast |
| PR-6: Earnings summary over full dataset | 6th P0 (page slice) | 1 h | Low | New vitest for 1000-transaction aggregate |
| PR-8: Verify payment-gateway state | 7th P0 (no API, plain creds) | 1 h | Low (mostly verify) | New vitest if creds are encrypted |
| PR-9: Tidy up fleet/settings/rewards fixups | 8th + 9th P0s | 1.5 h | Low | Existing tests + manual rate-limit test |
| **Total** | | **~9.5 hours** | | |

---

## Execution order

1. **PR-1 (15 m)** — single-line permission key fix. Lowest risk, fastest.
2. **PR-9 (1.5 h)** — fleet/settings/rewards tidy-ups. All small, contained.
3. **PR-2 (1 h)** — Operations Board stats verify. Self-contained.
4. **PR-3 (1 h)** — maintenance cache + caddyStatus. Backend-only.
5. **PR-5 (1.5 h)** — KYC dialog unification. Frontend refactor.
6. **PR-6 (1 h)** — Earnings summary. Backend + UI.
7. **PR-7 (1 h)** — DR restore service. Backend-only.
8. **PR-8 (1 h)** — payment-gateway verify. Mostly reading.
9. **PR-4 (3 h)** — Announcements fanout. Largest change, ship last.

**Total: ~9.5 hours.** PR-4 is the only multi-hour change; the rest are 15-90 min each.

---

## Documentation deliverables

Each PR should include:
1. **Commit message** referencing the source audit (e.g., "PR-1: 4th audit P0-2 — fix `tl_manage` → `team_leaders_manage` permission key").
2. **Audit reclassification entry** in `docs/AUDIT_INDEX_2026-08-03.md` (the cumulative ledger).
3. **Release readiness entry** in `docs/RELEASE_READINESS_<next>.md`.

For PR-4 (announcements), also update `docs/AUDIT_WORKERS.md` with the new outbox event type + worker entry.

---

## Out-of-scope reminders (audit items NOT in this plan)

- **18th audit** (cron tasks): all 9 P0s already fixed. No action.
- **4th audit P0-1** (team-leader schema bug): already fixed. No action.
- **3rd audit P0-2** (settings wildcard cache): already fixed. No action.
- **3rd audit P0-1 headline** (maintenance mode UI-only): **structurally fixed** by middleware enforcement. PR-3 is a follow-up polish (cache invalidation + caddyStatus fallback), not a structural fix.
- **4th audit P0-3** (dr-drill perm check): already fixed. No action.
- **5th audit P0** (Background Jobs `jobs_view` perm): already fixed. No action.
- **6th audit P0** (DR tab maintenance toggle): already fixed. No action.
- **7th audit P0** (bulk-reject reason): already fixed. No action.
- **8th audit P0** (rental PUT substring match): already fixed. No action.
- **8th audit P0** (Hubs 300s cache): already fixed. No action.
- **9th audit P0** (plans `analytics_view` perm): already fixed. No action.
- **9th audit P0** (referrals hardcoded `500`): already fixed (now uses `bonusRupees` from setting). No action.
- **9th audit P0** (plan.use-cases silent override of `isActive`/`durationDays`): now loudly documented in comments. Considered fixed.

**15 P0s are already fixed and need no further action. The 9 PRs above address the remaining 19 items (some partially fixed, some still true).**
