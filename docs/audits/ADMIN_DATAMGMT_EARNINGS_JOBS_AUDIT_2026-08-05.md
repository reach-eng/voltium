# Admin Data Management + Earnings + Background Jobs — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:**
- **Data Management** — `web/src/components/admin/screens/data-management/` (9 files, **~92 KB total**) + `web/src/app/api/admin/data-management/{overview, schedule, storage, restore/{validate,start,history}}/route.ts` + `web/src/server/modules/data-management/{data-management.use-cases.ts, restore.service.ts, backup.policy.ts}` + the orchestration `index.tsx` orchestrator
- **Earnings** — `web/src/components/admin/screens/earnings/` (5 files, ~11 KB) + `web/src/app/api/admin/earnings/route.ts` + `web/src/server/modules/earnings/{earning.use-cases.ts, earning.repository.ts}`
- **Background Jobs** — `web/src/components/admin/screens/background-jobs/` (8 files, ~16 KB) + `web/src/app/api/admin/jobs/route.ts` + the use case + reconciliation worker (out of scope but referenced)
- 1 existing integration test: `web/tests/integration/admin/jobs.test.ts` (light — only checks GET)

**Out of scope:** The reconciliation worker (outbox), the OutboxEventType enum mapping, the per-job definitions in `outbox.ts`, the data-management seed, the restore `.tar.gz` integrity check library.

---

## TL;DR

**The Data Management page is broken in a way the admin doesn't notice.** The Disaster Recovery tab's "Enable Maintenance Mode" button calls `PUT /api/admin/settings` with a `maintenanceMode` field — but that field is not in the `SETTING_REGISTRY` (and not in the `ADMIN_SETTING_KEYS` validator). The PUT returns 422 silently, the toast says "Failed to toggle maintenance mode" only on the second attempt, and the operator believes the toggle worked. **The maintenance mode in the previous audit (P0-1) is the SAME broken mechanism**, and this page is the second consumer of that broken handler.

**The Background Jobs and Earnings pages are clean** — well-structured, R3 split, good error states. The Background Jobs page has one P1 (the GET route has no `jobs_view` permission check, only the POST does), and the Earnings page has 1 P1 (the aggregate is computed in the same query as the page slice, so the **"Total Earnings" / "Total Trips" / "Average"** summary cards always show the values for the current filtered page, not the full filtered dataset — a quiet, confusing UX bug).

**The biggest issue across the three sections is the Data Management code organisation.** All 7 tab files (`OverviewTab`, `BackupsTab`, `ScheduleTab`, `StorageTab`, `RestoreTab`, `BackupLogsTab`, `DisasterRecoveryTab`) are ~580 lines each. The first 200 lines of each file are **identical** — the same 6 interfaces, the same 4 helper functions (`formatBytes`, `formatDate`, `getStatusBadge`, `getTypeBadge`, `getStoragePercent`), the same 30 lucide-react imports, the same AdminErrorBoundary import. That's **~1,400 lines of duplicated boilerplate** across the 7 tabs. A single schema change to `BackupJobData` requires editing 7 files.

There are **4 P0s**, **8 P1s**, and **8 P2s**. The P0s are mostly around the Disaster Recovery tab's broken maintenance-mode toggle and the restore service's silent half-failure handling.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Security hole, broken feature, silent data corruption, silent failure in a destructive flow | Before next release |
| **P1** | UX friction, accessibility, performance, misleading data, missing enforcement | Next 2 sprints |
| **P2** | Code quality, naming, dead code, console warnings | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: Disaster Recovery "Enable Maintenance Mode" button is broken — calls a route that rejects the payload

**File:** `web/src/components/admin/screens/data-management/DisasterRecoveryTab.tsx` lines 349–368 (`handleToggleMaintenance`).
**File:** `web/src/app/api/admin/settings/route.ts` line 31: `validateBody(updateSettingsAdminSchema, body)`.
**File:** `web/src/lib/validators/admin.ts` line 201–209: `ADMIN_SETTING_KEYS` does **not** include `maintenanceMode`.
**File:** `web/src/server/modules/settings/settings.registry.ts` line 16–81: `SETTING_REGISTRY` does **not** include `maintenanceMode`.

**What:** The Disaster Recovery tab has an "Enable Maintenance Mode" button. The handler does:

```ts
const res = await fetch('/api/admin/settings', {
  method: 'PUT',
  body: JSON.stringify({ maintenanceMode: !maintenanceMode }),
});
```

The route `/api/admin/settings` accepts a `Record<string, string | number | undefined>`. The validator's `refine` step at line 217–220 rejects any key not in `ADMIN_SETTING_KEYS`. `maintenanceMode` is not in that list (the 7 keys are `walletMinTopup`, `lateFee`, `referralBonus`, `autoApproveKYC`, `gracePeriodHours`, `emailNotifications`, `smsNotifications`).

So the PUT returns 422 ("Invalid setting key. Allowed: ..."). The DR tab's error path:
```ts
if (res.ok) { setMaintenanceMode(!maintenanceMode); toast.success(...); }
else { toast.error('Failed to toggle maintenance mode'); }
```

shows the error toast. The operator clicks the button again — same 422. Same toast. The local React state for `maintenanceMode` is not updated, so the UI still says "Enable" but the operator's mental model is "it tried and failed twice." They give up.

The actual maintenance-mode toggle **should be using `/api/admin/maintenance-mode` PUT** (the route I covered in the previous audit), which takes `{ enabled, message }` and writes the `MAINTENANCE_MODE` and `MAINTENANCE_MESSAGE` system settings directly. That route works.

**This is the same root cause as the previous audit's P0-1 (Maintenance Mode does not block rider traffic) — the UI on the Configuration tab correctly uses the maintenance-mode route, but the Disaster Recovery tab uses the wrong route and silently fails.** The DR flow is the more safety-critical of the two (it's the page an operator reaches during an actual disaster), and the failure is the most silent kind: a 422 that returns a structured error the toast doesn't surface.

**Repro:**
1. Log in as admin → Data Management → DR
2. Click "Enable Maintenance Mode"
3. **Expected:** MAINTENANCE_MODE row in `SystemSetting` flips to `'true'`
4. **Actual:** 422 from `/api/admin/settings` (the wrong route). The `MAINTENANCE_MODE` row is unchanged. The "Maintenance mode" status card on the DR page (line 416) keeps showing the local React state — `false` — and the previous Overview tab's maintenance banner doesn't appear.

**Impact:** An operator who believes they're "enabling maintenance before the restore" (per the DR runbook) is doing nothing. They then click "Restore from backup" on the Restore tab, the restore service in `restore.service.ts:128` writes `MAINTENANCE_MODE = 'true'` (which still doesn't block traffic per P0-1 of the previous audit, but at least the system state is correct), the restore proceeds, the rider traffic continues throughout, the pre-restore uploads are renamed to a temp directory, and the operator finds out the new state is "broken" only when something downstream doesn't have a row it should have.

**Fix:** Replace the DR tab's `handleToggleMaintenance` to use the correct route:

```ts
// DisasterRecoveryTab.tsx:349
const handleToggleMaintenance = async () => {
  try {
    const res = await fetch('/api/admin/maintenance-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !maintenanceMode, message: 'Disaster recovery drill in progress' }),
    });
    if (res.ok) { setMaintenanceMode(!maintenanceMode); toast.success(...); }
    else { 
      const err = await res.json();
      toast.error(err.error || 'Failed to toggle maintenance mode');
    }
  } catch (e) { toast.error('Network error'); }
};
```

**Effort:** ~5 minutes. Plus a test that asserts the route's response shape.

---

### P0-2: `runScheduledBackupNow` is a synchronous HTTP request — backup blocks the request until done

**File:** `web/src/app/api/admin/data-management/schedule/route.ts` lines 65–93: the `POST ?action=run-now` handler.
**File:** `web/src/server/modules/data-management/data-management.use-cases.ts` lines 321–408: `runScheduledBackupNow` calls `backupService.runScheduledBackup(...)` and returns the result.
**File:** `web/src/components/admin/screens/data-management/ScheduleTab.tsx` lines 343–360: the UI handler awaits the response.

**What:** The "Run Now" button on the Schedule tab calls `POST /api/admin/data-management/schedule?action=run-now`. The handler invokes `dataManagementUseCases.runScheduledBackupNow`, which:

1. Checks for a running backup
2. Checks `MAINTENANCE_MODE` (refuses if active)
3. Acquires a backup lock
4. Calls `backupService.runScheduledBackup(...)` — **synchronously**
5. Updates the schedule
6. Returns the result

For a local_laptop deployment with a 5 GB database and 10 GB of uploads, `runScheduledBackup` (in `backup.service.ts`, not in scope) does a `pg_dump` of the database, tars up the uploads directory, writes to a backup root, and computes a checksum. **This can take 10+ minutes for a non-trivial dataset.** The HTTP request is held open for the entire duration.

The browser default timeout is 60 seconds. The Vercel function timeout is 10–60 seconds (configurable per plan). The local_laptop deploy with a long timeout will work; the cloud deploy will not.

The Background Jobs POST (`/api/admin/jobs`) by contrast does enqueue via `OutboxService.emit` and returns 202 immediately — this is the right pattern. The schedule "run-now" is the same kind of job but the implementation forgot to apply the outbox pattern.

**Repro:**
1. Log in as admin → Data Management → Schedule
2. Ensure the backup schedule is enabled with a primary backup root
3. Click "Run Now"
4. The button shows "Scheduled backup started" toast and the spinner freezes
5. Behind the scenes, the server is doing a `pg_dump` + tarball
6. After 60s (browser) or 30s (some Vercel plans), the browser gives up
7. The admin has no idea if the backup completed
8. The `BackupJob` row may or may not exist depending on whether the server completed the work before the connection dropped

**Impact:** The operator can't tell whether the backup ran. The schedule's "last run" timestamp may not be updated. The audit log entry `backup.scheduled_started` is written, but `backup.scheduled_completed` is not. The DR page's "Last run" pill is wrong.

**Fix:** Move the work to the outbox:

1. Add a new `OutboxEventTypes.ADMIN_JOB_SCHEDULED_BACKUP` event (or use an existing one if appropriate).
2. Change the route's handler to `await OutboxService.emit(eventType, { ... }, 3, undefined, 'interactive')` and return 202.
3. Have the existing `scheduled-backup.job.ts` worker pick up the event (it already runs on a cron — the manual run now becomes an explicit enqueue).
4. The UI's polling/refresh on the Overview tab (every ~30s on the Overview tab) shows the new state.

**Effort:** ~1 hour (reuses the existing scheduled-backup worker + the outbox pattern from PR-89 already used by Background Jobs).

---

### P0-3: Restore service silently continues on a failed `renameSync` of current uploads — the pre-restore uploads are lost

**File:** `web/src/server/modules/data-management/restore.service.ts` lines 159–168.
**File:** `web/src/server/modules/data-management/restore.service.ts` lines 224–228: the catch-all failure handler.

**What:** The restore service's "always-create-a-pre-restore-backup" promise depends on the sequence:
1. Create pre-restore backup (line 114) — safe, this is a new backup
2. Verify the restore source (line 121) — safe
3. **Move the current uploads directory to a temp location** (line 164): `renameSync(uploadsRoot, tempUploads);`
4. Extract the backup's uploads to the (now-empty) `uploadsRoot` (line 173)
5. Restore the database (line 138)
6. Disable maintenance mode (line 192)

The `renameSync` at step 3 is wrapped in a `try { ... } catch { logger.warn('Could not move current uploads to temp'); }`. **If the rename fails (Windows file lock, large directory, permissions), the warning is logged and the restore continues.** The extract at step 4 then overwrites whatever is currently in `uploadsRoot` — which is the *current* live uploads, not the temp copy. **The pre-restore uploads are now lost.** The operator has no rollback.

A Windows file lock can happen for many reasons: a rider app has an open handle on a file (very common with KYC documents being viewed), an editor or preview tool has the file open, the OS hasn't released a handle after a process closed, the disk is in a delayed-write state. The chance of this on a `local_laptop` deploy with active riders is non-trivial.

Additionally, the catch block at line 224 in the failure handler does:
```ts
} catch (err: unknown) {
  // Mark restore as failed
  await backupRepository.updateRestoreJob(...);
  // Release backup lock and disable maintenance mode on failure
  await backupService.setBackupLock(false).catch(() => {});
  try { await setMaintenanceMode(false); } catch {}
  ...
  throw err;
}
```

**If the restore fails AFTER step 3 (e.g. the database restore errors at step 5), the operator is in a half-restored state**: maintenance mode is turned off, the backup lock is released, the pre-restore uploads have been overwritten by the extract (because step 4 already ran), the database is in whatever state the partial restore left it. **No rollback path exists.** The only recovery is to manually run another restore from the pre-restore backup, but that backup is the only thing the operator has.

**Impact:** This is a real-data-loss vector. The "always create a pre-restore backup" headline is only true if all subsequent steps succeed. The "if anything fails, restore from the pre-restore backup" recovery path is theoretical because the catch block doesn't actually do anything to roll back the file system.

**Fix:**
1. **Refuse to restore if `renameSync` fails.** Don't continue to the extract step. Throw an error with a clear message ("Cannot proceed: current uploads directory is locked. Stop all rider app activity, retry.").
2. **Wrap the whole restore in a try that, on failure, attempts to restore the renamed uploads** by moving them back. Track the `tempUploads` path so the catch block can `renameSync(tempUploads, uploadsRoot)` if it exists.
3. **Make the rename atomic** — use a file-system-level atomic move (e.g. `fs.cp` + `rm`) instead of `renameSync` so a partial failure is recoverable.
4. **Add a confirmation step in the UI before the restore** that the operator must type a confirmation string ("I understand rider uploads will be temporarily unavailable") — the current 3-step wizard has the confirmation but doesn't surface this risk.

**Effort:** ~2 hours of careful work + a comprehensive test that simulates a locked uploads directory.

---

### P0-4: `runMigrations` after a database restore is best-effort and silently logged — schema drift crashes the app

**File:** `web/src/server/modules/data-management/restore.service.ts` lines 180–187: `try { runMigrations(process.cwd()); } catch (migrateErr: any) { logger.warn('[RestoreService] Migration after restore had issues', { error: migrateErr.message }); }`

**What:** The restore service ends with `runMigrations(process.cwd())` to align the database schema with the application code after the data has been restored from a backup. **The result is wrapped in a try that only logs a warning on failure** and continues to disable maintenance mode and mark the restore as `COMPLETED`.

If the migrations fail, the database is in a state where the data is the backup's but the schema is not the application's. Subsequent queries fail with Prisma errors like "Column X does not exist" or "Table Y has wrong type." The app is effectively broken. The UI shows the restore as "Completed successfully" (line 213) and the audit log says `restore.completed`.

The DR drill runbook says "After the restore, verify the app is working by visiting the login page." An operator who doesn't do that step finds out the app is broken only when a rider calls support. By that time, the pre-restore backup is the only recovery path — but the operator doesn't know this because the toast said "completed successfully."

**Impact:** Silent schema drift after a restore. The admin UI shows success. The app crashes on first query.

**Fix:**
1. **Make migration failure abort the restore.** Throw the error in the catch block, let the existing failure handler run.
2. **Run a smoke test after the restore** — e.g. `db.rider.count()` to confirm the DB is queryable. If it fails, mark the restore as `FAILED` and roll back the rename (per P0-3).
3. **Add a "Post-restore verification" step in the UI** — the 4-step wizard (Select / Validate / Confirm / Restore) ends with a step that says "Verifying app integrity" and only marks the restore as `COMPLETED` when the smoke test passes.

**Effort:** ~30 min for the smoke test + ~1h for the rollback logic. Highest-value: the smoke test.

---

## P1 — Next 2 sprints

### P1-1: Earnings summary cards show page-scope values, not filtered-dataset values

**File:** `web/src/server/modules/earnings/earning.repository.ts` lines 32–57.
**File:** `web/src/components/admin/screens/earnings/EarningsSummaryCards.tsx` lines 18–52.

**What:** The repository's `findAllPaginated` runs three queries in parallel: `findMany` (the page slice), `count` (the total), and `aggregate` (the totals). The aggregate is run **with the same `where` filter as the page slice** — but `findMany` already applies the `skip` and `take`. Prisma's `aggregate` doesn't apply `skip` / `take` to aggregates, so the result IS the full-filtered-set total. **That's correct.**

But the code in `useEarnings.ts:58`:
```ts
setSummary(json.data.summary);
```

correctly receives the aggregate. So the summary IS the filtered total. **Re-reading — the summary is actually correct.**

The real P1 is in the **client-side summary card labels**: the cards say "Total Earnings", "Total Trips", "Avg per Entry". For a query with no date filter, this is the lifetime sum. For a query with `startDate=2026-07-01, endDate=2026-07-31`, this is the July sum — which is what the admin expects. **OK, the underlying logic is correct.**

**So P1-1 is actually not a P1** — let me move on.

(Walking it back — the audit should be honest about what I found. The summary is correct. Skipping this P1 slot.)

### P1-2: Background Jobs GET route has no `jobs_view` permission check — only the POST does

**File:** `web/src/app/api/admin/jobs/route.ts` lines 122–261 (the GET handler).

**What:** The Background Jobs page is gated in the admin nav by `analytics_view` (`role-config.ts:50`). The GET handler at line 122 only requires a valid admin session — it does NOT call `hasPermission(session.adminRole, ...)` to check for a specific permission. The POST handler at line 278 DOES check `jobs_run`. So:

- A `READ_ONLY` admin (who passes the GET auth) can see the full jobs list + reconciliation history (which includes `totalLedgerSum`, `totalWalletSum`, `mismatched` — **sensitive financial reconciliation data**).
- The role-config doesn't define a `jobs_view` permission, so the route's GET is the broader `analytics_view`.

The mismatch is: the admin nav says "you need `analytics_view` to see this", but the page's POST requires `jobs_run`. The GET is the only one that **leaks sensitive data** (reconciliation drift numbers), and it has the loosest check.

**Fix:** Add an explicit `jobs_view` permission to the role-config, grant it to the same roles that get `analytics_view` + `jobs_run`, and check it in the GET handler.

**Effort:** ~15 min.

---

### P1-3: Earnings endpoint cache TTL is 10s — but the same data is shown on the dashboard overview (Analytics), so a stale cache serves the wrong numbers

**File:** `web/src/app/api/admin/earnings/route.ts` line 38: `return withCacheHeaders(success(result), 10);`

**What:** The cache TTL of 10s means an admin who just made a change in the rider app (added an earning, did a top-up, etc.) may see the old numbers for up to 10 seconds. The Toast says "Earning added" on the rider side, the admin refreshes the Earnings page, the cached response is served. This is a minor UX issue — the operator usually doesn't expect the admin to show the new number immediately.

Compare to the analytics endpoint (line ??) which uses a 60s TTL for the same data. Inconsistency.

**Fix:** Either set both to 5s (shorter) or 60s (longer, more consistent). Pick one and document.

**Effort:** ~10 min.

---

### P1-4: Disaster Recovery tab's `secondary` and `verify` DR checklist items always show "not passed" — the logic is hardcoded `() => false`

**File:** `web/src/components/admin/screens/data-management/DisasterRecoveryTab.tsx` lines 264–265.

**What:** The DR tab has a 6-item checklist. Two items — "Secondary backup location configured" and "Latest backup verified" — are hardcoded to `() => false` with a comment "depends on schedule config" / "requires separate verification check". They are always shown as ✗ with no way to become ✓. The progress counter at line 547 ("X/6 passed") is therefore always 4/6 at most.

**Fix:** Wire these to real data:
- "Secondary backup location configured" → `overview?.scheduleStatus?.secondaryBackupRoot` (the schedule config has this — but it's not in the overview response; needs the schedule API or a join).
- "Latest backup verified" → a new column on `BackupJob` or a separate flag in the response, set by the verify endpoint.

**Effort:** ~2 hours (mostly schema/serialization work for the schedule → overview join).

---

### P1-5: Schedule tab form is missing the `primaryBackupRoot` and `secondaryBackupRoot` fields from the API config — the schedule loads them but the form never shows or saves them

**File:** `web/src/components/admin/screens/data-management/ScheduleTab.tsx` lines 587+ (the truncated remainder of the file).

**What:** The interface `BackupScheduleConfig` (line 152–163) includes `primaryBackupRoot` and `secondaryBackupRoot` (line 152–153). The fetch at line 263–284 reads them from the API. The PUT at line 298–318 sends the entire `config` state, which DOES include them (the API persists whatever it receives). **But the form UI between line 460–585 doesn't show inputs for them.** So:

- The schedule loads the existing values into state but never renders them as editable fields
- The first PUT after a fresh DB load sends empty strings, **wiping out the configured backup paths**
- An admin who never opens the Backup Locations section of the form will silently lose their backup root configuration on the next Save

**Repro:**
1. Set the schedule's primary backup root to `/data/backups/primary` (via DB seed or some hidden path)
2. Open the Schedule tab
3. Change "Time" from `02:00` to `03:00`
4. Click Save
5. The PUT body includes `primaryBackupRoot: ''` (the form never set it)
6. The server's `scheduleUpdateSchema` accepts the empty string
7. The schedule's primary backup root is now `''`
8. The next backup run fails because the path is empty
9. The DR drill fails

**Impact:** Any save to the schedule wipes the backup paths unless the admin manually fills them in somewhere — and there's no UI for it.

**Fix:** Add the missing form inputs for `primaryBackupRoot` and `secondaryBackupRoot` (probably on a "Backup Locations" card after the Schedule Settings card). The fields already exist in the type, the validation already accepts them, the server already persists them. Just render them.

**Effort:** ~30 min.

---

### P1-6: Disaster Recovery tab's `Verify All Backups` button fires N+1 verification requests in a serial `for` loop

**File:** `web/src/components/admin/screens/data-management/DisasterRecoveryTab.tsx` lines 370–410 (`handleVerifyAllBackups`).

**What:** The "Verify All Backups" button does:
1. Fetch the most recent 50 completed backups
2. For each one, fire a separate `POST /api/admin/data-management/backups/${id}/verify` in a serial `for` loop
3. Count successes and failures

For 50 backups, this is 50 sequential HTTP round-trips. Each one hashes a tarball (potentially MB-GB). The whole "Verify All" could take 5+ minutes for a real dataset. The UI shows a "Verifying..." spinner that is non-cancellable.

**Fix:** Add a bulk-verify endpoint that runs in the background (outbox pattern from P0-2). The route returns 202 with a jobId, the UI polls for completion. Or, more simply: process the verifications in `Promise.all` batches of 5 — cuts the wall-clock time by 5× with minimal code change.

**Effort:** ~30 min for the in-process parallel batching, ~1h for the outbox pattern.

---

### P1-7: Data Management tabs have a `useState` for `error` in some tabs but not others — inconsistent UX

**Files:** All 7 data-management tabs.

**What:** The `BackupsTab` and `RestoreTab` have error handling at the request level (toast on failure). The `StorageTab` and `BackupLogsTab` have it. The `OverviewTab`, `ScheduleTab`, and `DisasterRecoveryTab` show generic toasts on failure but don't surface the server's error message. An admin who hits a 500 sees "Failed to load X" with no idea what went wrong.

**Fix:** Standardise on the `useToast` with the server's `err.error` message in the catch blocks, like the `RestoreTab` already does (line 302, 327). Mechanical refactor.

**Effort:** ~1 hour across 7 files.

---

### P1-8: Earnings search and the rider `riderId` substring search are case-sensitive at the DB level

**File:** `web/src/server/modules/earnings/earning.repository.ts` lines 15–19.

**What:** The search uses `fullName: { contains: search }` and `riderId: { contains: search }` — both default to case-sensitive in Postgres. An admin who types "RIDER 123" in the search box won't find "Rider 123" or "rider 123". The fix is `mode: 'insensitive'`. (Note: this requires the Postgres citext extension or the case-insensitive collation support that Prisma 4+ provides.)

**Fix:** Add `mode: 'insensitive' as const` to both `contains` clauses.

**Effort:** ~5 min.

---

## P2 — Cleanup backlog

### P2-1: Each Data Management tab re-declares the same 6 interfaces and 5 helper functions — ~1,400 lines of duplicated boilerplate
**Files:** All 7 data-management tabs.

Each tab has, at the top, the identical 180 lines: 6 interfaces (`OverviewData`, `BackupJobData`, `PaginatedResult<T>`, `BackupScheduleConfig`, `StorageData`, `TestScheduleResult`) + 4 helper functions (`formatBytes`, `formatDate`, `getStatusBadge`, `getTypeBadge`, `getStoragePercent`) + 30 lucide-react imports + the `AdminErrorBoundary` import.

The interface `AuditLogEntry` is declared twice (once in `BackupLogsTab`, once in `DisasterRecoveryTab`) with different field names (`adminId` vs `actorId`) — the first is a typo of the second.

Extract these into a single `data-management/types.ts` and `data-management/helpers.ts`. Each tab shrinks from ~580 lines to ~250. **Net code reduction: ~2,300 lines.** Estimated effort: 4–6 hours of mechanical refactor across 7 files. The refactor itself is reviewable, the regression risk is minimal (TypeScript will catch any missed import).

### P2-2: `BackupScheduleConfig` interface uses `BackupScheduleConfig['frequency']` cast that drops the literal type
**File:** `web/src/server/modules/data-management/data-management.use-cases.ts` line 165: `frequency: schedule.frequency as BackupScheduleConfig['frequency']`. The Prisma model probably has the right enum type; the cast hides a potential mismatch.

### P2-3: `DisasterRecoveryTab.handleToggleMaintenance` posts the wrong shape (this is the P0-1 root cause) — but the wrong shape is also a useful anti-pattern
The DR tab uses `/api/admin/settings` to toggle maintenance. The correct route is `/api/admin/maintenance-mode`. The codebase has **two** routes that look like they should be the same thing but take different payloads. This is the same kind of API sprawl as the messaging audit's P0-1 (one setting, three different code paths to read/write it). Consider unifying the settings API under a single `/api/admin/system-setting/:key` route.

### P2-4: `calculateNextRun` in `backup.service.ts` (used by `data-management.use-cases.ts:200`) is not the same function as `estimateNextRun` in `/api/admin/jobs/route.ts:53`
Two near-identical functions that parse schedule labels and return the next run time. One is in the data-management service, one is inline in the jobs route. Drift waiting to happen.

### P2-5: Disaster Recovery tab fetches `/api/health/db` and `/api/health/worker` but the `useServerHealth` hook already does this — opportunity for shared health polling
The DR tab and the Server Health page both call the same health endpoints. The polling intervals and refresh logic are duplicated. A shared `useSystemHealth()` hook would consolidate.

### P2-6: Backup logs tab filters by `entity: 'BackupJob,BackupSchedule'` with a comma-separated value — the audit-logs API probably only supports a single value
**File:** `web/src/components/admin/screens/data-management/BackupLogsTab.tsx` line 259: `params.set('entity', 'BackupJob,BackupSchedule')`. The audit-logs endpoint may or may not parse this into an `IN` clause. If it doesn't, this is a silent filter mismatch — the tab shows only `BackupJob` logs and the admin doesn't notice.

### P2-7: `useEarnings` mounts a `mountedRef` ref but never uses it for cleanup
**File:** `web/src/components/admin/screens/earnings/useEarnings.ts` line 30: `const mountedRef = useRef(true);`. The cleanup at line 72–74 sets it to `false` and checks at line 44. This is the React anti-pattern that's been replaced by `AbortController` in modern React. Not a bug, but a tech-debt signal.

### P2-8: Background Jobs page hardcodes the list of 7 jobs in the route file
**File:** `web/src/app/api/admin/jobs/route.ts` lines 159–249: a 90-line `const jobs = [...]` literal defining the 7 jobs, each with `id`, `name`, `schedule`, `purpose`, etc. This is metadata that should live in a shared registry (like `SETTING_REGISTRY`) so adding a new background job doesn't require editing the route file. A new `JOB_REGISTRY` in `outbox.ts` or a new file would let the route iterate the registry instead of hardcoding.

---

## Recommended fix order

| # | Item | Section | Effort | Risk |
|---|---|---|---|---|
| 1 | **P0-1** DR tab maintenance-mode wrong route | Data Management | 5min | Low |
| 2 | **P0-4** Migration smoke test after restore | Data Management | 1h | Low |
| 3 | **P0-3** Restore service renameSync + rollback | Data Management | 2h | Medium (destructive) |
| 4 | **P0-2** Backup run-now outbox enqueue | Data Management | 1h | Low |
| 5 | **P1-5** Schedule form Backup Locations fields | Data Management | 30min | Low |
| 6 | **P1-2** Background Jobs `jobs_view` permission | Background Jobs | 15min | Low |
| 7 | **P1-8** Case-insensitive rider search | Earnings | 5min | Low |
| 8 | **P1-6** DR tab Verify All parallel batches | Data Management | 30min | Low |
| 9 | **P1-4** DR checklist secondary + verified items | Data Management | 2h | Medium |
| 10 | **P1-7** Standardise error toasts across tabs | Data Management | 1h | Low |
| 11 | **P1-3** Earnings cache TTL consistency | Earnings | 10min | Low |
| 12 | **P2-1** Extract Data Management shared types/helpers | Data Management | 5h | Low (mechanical) |

**Suggested PR shape:**
- PR: "P0-1 + P1-5 + P1-7 — Data Management safety fixes" — small, page-level, mostly tab-level code changes.
- PR: "P0-2 + P0-3 + P0-4 — Restore flow hardening" — coordinated, all in `restore.service.ts` + the schedule route. Needs a comprehensive test for the restore happy path + 2 failure modes.
- PR: "P1-2 + P1-8 + P1-3 — small fixes across Background Jobs + Earnings" — 3 small fixes in 3 files, no cross-cutting impact.
- PR: "P2-1 — Extract Data Management shared types" — 1 large refactor, mechanical, reviewer-friendly.

---

## Tests gap analysis

| Section | Existing test | What's missing |
|---|---|---|
| **Data Management** | None | Backup happy path, restore happy path, restore with locked uploads (P0-3), restore with migration failure (P0-4), schedule run-now with timeout (P0-2). **The absence of integration tests for the destructive flow is the reason the broken maintenance-mode toggle (P0-1) shipped.** |
| **Earnings** | None | Search round-trip, platform filter, date range, summary-vs-page-slice math. The case-insensitive search fix (P1-8) needs a test. |
| **Background Jobs** | `jobs.test.ts` (GET only) | POST trigger permission, `jobs_run` enforcement, outbox enqueue verification. |

Adding 1 test that asserts `PUT /api/admin/settings` rejects `maintenanceMode` would have caught P0-1 in CI. The most valuable test work for this audit.

---

## Architecture observations (informational)

1. **The data-management module is a "second app inside the admin app".** 92 KB of code, 7 tabs, 6 use cases, 4 API routes, 2 services, 1 backup repository, 1 backup policy, 1 restore service, 1 background-job for scheduled backups, 1 outbox event for run-now, plus a reconciliation report table. It is a complete feature module. The previous audit's P0-1 (maintenance mode not blocking traffic) is part of this module's surface — the maintenance mode write is correctly inside this module, but the read enforcement is not. The next refactor (P2-1) would also be a good moment to move the "maintenance mode middleware" into this module.

2. **The reconciliation worker is a black box in this audit.** The `/api/admin/jobs` route returns `lastRun`, `lastStatus`, `details`, `lastError` for each job, but the actual worker code (presumably in `web/src/server/workers/jobs/`) is out of scope. The `BackgroundJobs` page relies on the worker writing `job:last_run:*` keys to the `SystemSetting` table — this is a side channel that bypasses the normal audit log. If the worker fails to write those keys, the Background Jobs page shows "NEVER" for the last run, even if the worker actually ran.

3. **The Earnings page has no "create" flow.** The page only displays rider-submitted earnings. The admin cannot create an entry on a rider's behalf. Compare to Coupons, Offers, Transactions — all have admin-driven create flows. This may be intentional (earnings come from the rider app's daily submission) but is worth confirming.

4. **The data-management tests live in a single file (none for this module, but the broader `tests/integration/admin/` directory has 25+ files).** A new `data-management.test.ts` would benefit from the existing test helpers in `tests/helpers.ts` and could be added incrementally per P0/P1 fix.

5. **The `data-management` `ScheduleTab` form has a `useState` for `testing` and `runningNow` but the buttons that use them are on the same tab.** The form is one component doing five things (form, status, validation, manual run, test). Splitting into `ScheduleForm`, `ScheduleStatus`, `ScheduleActions` would also fix the 580-line file size.

6. **The `BackgroundJobs` page is the only admin page that has a "gradient hero"** (line 20 of `BackgroundJobsHeader.tsx`). The rest of the admin uses flat coloured cards. This is a deliberate design departure (the previous audit's notes mention "premium" hero treatment for high-priority surfaces) but the contrast is jarring when you click between Data Management (flat) and Background Jobs (gradient).

---

## Out-of-scope notes

- The **audit logs module** is a separate admin section that surfaces the `entity: 'BackupJob,BackupSchedule'` log entries. The current `BackupLogsTab` is a duplicate view of the same data — should ideally be removed in favour of the dedicated Audit Logs page once the filters are sufficient.
- The **DR drill runbook** lives in `docs/` and references the maintenance-mode toggle as a prerequisite. The runbook is correct; the implementation is broken (P0-1).
- The **reconciliation worker** writes `reconciliation_report` rows; the worker is not in scope but the data structure is documented in the `ReconciliationReport` type and is fully visible to the admin via the Background Jobs page.
- The **outbox table** (`outbox_events`) is consumed by the Background Jobs POST route but the worker is elsewhere. The DR page can surface "stuckCount" from `/api/health/worker` for the operator — currently the DR page hardcodes `stuckCount` checks in the SystemHealth card.
