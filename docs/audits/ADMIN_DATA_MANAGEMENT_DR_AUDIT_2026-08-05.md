# Admin Panel Flows — Data Management & DR — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the admin data-management and disaster-recovery surface end-to-end (Next.js `/admin` + API routes + worker subsystem):

| Flow | Brief's endpoint | Actual endpoints | Notes |
|---|---|---|---|
| Analytics dashboard | `GET /api/admin/analytics` | `GET /api/admin/analytics` (matches) | 60s cache; **uses raw SQL with snake_case table names** (PR-1 risk); the `getDashboard()` use case is **dead** (route calls `getOverview()`) |
| Metrics | `GET /api/metrics` | `GET /api/metrics` (matches) | **Prometheus endpoint is unauthenticated by default** (no `?format`); JSON mode requires admin |
| Monitoring | `GET /api/monitoring` | `GET /api/monitoring/metrics` (brief is wrong on path) | Accepts `Bearer ${CRON_SECRET}` or admin session; returns slow queries, outbox stats, reconciliation snapshot |
| Data export / backup | `GET/POST /api/admin/data-management` | **6 separate routes** under `/api/admin/data-management/*` (overview, storage, schedule, restore/{validate,start,history}) | Brief is wrong — single endpoint is actually a 6-route resource tree |
| DR drill | `POST /api/admin/dr-drill` | `POST /api/admin/dr-drill` (matches) | **Perm check is inverted** — passes `adminId` UUID where a role string is expected; **5-step check doesn't actually test restore** |
| Background jobs (run now) | `POST /api/admin/jobs` | `POST /api/admin/jobs` (matches) | Async via outbox; **`auto-debit` and `rent-due-checker` map to the same outbox event** (duplicate label); GET is static 8-job list |
| Workflow coverage report | `GET /api/admin/workflow-coverage` | `GET /api/admin/workflow-coverage` (matches) | Dev-only screen (`process.env.APP_ENV !== 'development'` returns null); route still live in prod; **does 10 sequential fetches** |

**Files read in full:**
- `web/src/app/api/admin/analytics/route.ts` (20 lines — GET with `analytics_view` perm, 60s cache)
- `web/src/app/api/metrics/route.ts` (54 lines — dual-mode: Prometheus text by default, JSON for `?format=json` or `?type=slow`)
- `web/src/app/api/monitoring/metrics/route.ts` (65 lines — accepts `CRON_SECRET` or admin session; returns APM + slow queries + outbox + reconciliation)
- `web/src/app/api/admin/data-management/overview/route.ts` (49 lines — withApiHandler, `getOverview`)
- `web/src/app/api/admin/data-management/storage/route.ts` (27 lines — `getStorage` + DB size + file categories)
- `web/src/app/api/admin/data-management/schedule/route.ts` (94 lines — GET/PUT/POST; POST handles `?action=test` and `?action=run-now`)
- `web/src/app/api/admin/data-management/restore/validate/route.ts` (26 lines — `data_management_restore` perm)
- `web/src/app/api/admin/data-management/restore/start/route.ts` (26 lines — same perm; requires `confirmation: 'RESTORE VOLTIUM'`)
- `web/src/app/api/admin/data-management/restore/history/route.ts` (27 lines — `getRestoreHistory`)
- `web/src/app/api/admin/dr-drill/route.ts` (221 lines — 5-step drill, `DATA_MANAGEMENT` perm, audit log)
- `web/src/app/api/admin/jobs/route.ts` (342 lines — GET static job list + `estimateNextRun`; POST enqueues outbox event with `priority: 'interactive'`)
- `web/src/app/api/admin/workflow-coverage/route.ts` (149 lines — 10 sequential fetches, SSRF fix in PR-152, 5000ms timeout per check)
- `web/src/server/modules/analytics/analytics.use-cases.ts` (207 lines — `getDashboard()` is dead, `getOverview()` has 8 sub-queries)
- `web/src/server/modules/analytics/analytics.policy.ts` (21 lines — 4 allowed roles)
- `web/src/server/modules/analytics/analytics.schemas.ts` (10 lines — unused; route doesn't use it)
- `web/src/server/modules/monitoring/monitoring.use-cases.ts` (43 lines — 10 parallel counts in `getSystemMetrics`)
- `web/src/server/modules/data-management/data-management.use-cases.ts` (458 lines — orchestrator for 13 use cases; real `backup.service` and `backup.repository` are 26KB + 4.6KB at top-level)
- `web/src/server/modules/data-management/backup/backup-lock.service.ts` (114 lines — separate from `backup.service.acquireLock`)
- `web/src/server/workers/index.ts` (524 lines — 9 event-driven workers + 6 scheduled tasks + reaper + 30s graceful shutdown)
- `web/src/server/workers/outbox.ts` (340 lines — `OutboxService` with `emit`, `emitWithCommit`, `getStats`, `retryFailed`, `cleanupCompleted`; `MAX_OUTBOX_PAYLOAD_BYTES = 64KB`)
- `web/src/server/workers/queues.ts` (14 lines — re-exports `OutboxEventTypes` as `JOB_TYPES`)
- `web/src/components/admin/screens/BackgroundJobsScreen.tsx` (51 lines — R3 split: header + skeleton + JobsGrid + ReconciliationTable + ReportInspector)
- `web/src/components/admin/screens/WorkflowCoverageScreen.tsx` (259 lines — 5 admin groups + 8 rider groups, dev-only)
- `web/src/components/admin/screens/data-management/OverviewTab.tsx` (80+ lines — multi-section layout)
- `web/src/components/admin/screens/background-jobs/useBackgroundJobs.tsx` (the data hook for the jobs screen)
- `web/src/components/admin/screens/analytics/useAnalytics.ts` (the data hook for analytics)

**Out of scope:** Worker file:line internals for each of the 12 jobs (not the focus of this audit). Backup encryption internals (covered by `lib/shell.ts`). Outbox event-type constant maintenance (covered in audit #4).

---

## TL;DR

**The admin data-management/DR surface has 6 P0 bugs. The headline: the DR drill is a "configuration check", not a "DR test"** — and the perm check that gates it is broken in a way that may let everyone in or everyone out. `POST /api/admin/dr-drill` calls `hasPermission(adminId, 'DATA_MANAGEMENT')` where the first arg is supposed to be a role string, not an adminId UUID. Depending on the `hasPermission` implementation, this either always returns false (no one can run drills) or always returns true (anyone can). Either way: **the DR drill, which is the closest thing the project has to a "do we survive a disaster" check, is broken.**

The other 5 P0s are all real:

1. **`GET /api/metrics` (Prometheus endpoint) is unauthenticated by default.** When no `?format` param is sent, the route returns `register.metrics()` with `Content-Type: text/plain` and **no auth check** (line 15-19: `if (format === 'json' || type === 'slow')` requires admin; else fall through). An attacker can scrape `eventLoopLag`, `nodejs_heap_size_used`, default Node metrics, etc. for fingerprinting or to time attacks. The route comment acknowledges this: "to protect internal metrics we could enforce a basic auth or IP whitelist" — but doesn't fix it.

2. **`POST /api/admin/data-management/schedule?action=run-now` is synchronous and runs a full database backup inside the request.** The use case (`runScheduledBackupNow`) calls `backupService.runScheduledBackup(...)` which dumps the database, archives uploads, computes checksums, applies retention. **For a 5GB database, this is a 10+ minute request that holds the admin UI.** Should be async via the outbox, like the `/api/admin/jobs` route.

3. **`POST /api/admin/jobs` `auto-debit` and `rent-due-checker` map to the same outbox event** (`ADMIN_JOB_RENT_DUE_CHECK`). Two job labels trigger the same job. The admin sees 8 jobs in the list but the "Run now" button on the second one is a duplicate. **The 8 jobs aren't 8 jobs — they're 7 unique jobs with one duplicate label.**

4. **`GET /api/admin/analytics` uses raw SQL with snake_case table names** (`FROM "riders"`, `FROM "vehicles"`, `FROM "transactions"`). The Prisma schema `@map`s the tables to snake_case, so this works — but if a future schema change drops the `@map` (or a new table is added without it), the analytics dashboard silently returns wrong counts. **PR-1 fixed this once already (commit 34c8b55); it's a known fragile area.**

5. **`/api/admin/analytics` route caches for 60s but `getOverview` does an 8-sub-query batch including a full year of `transactions.findMany` for the trend** (line 156-165 of analytics.use-cases.ts: `db.transaction.findMany({ where: { createdAt: { gte: startDate } } })`). For 100K+ transactions, this loads 100K rows into memory per cache miss. **The 60s cache masks the perf issue but doesn't fix it.** A refactor of one transaction's enum would invalidate 100K rows of monthly trend aggregation.

6. **`/api/admin/jobs` POST enqueues ALL admin jobs with `priority: 'interactive'`** (line 307 of jobs/route.ts). The `notifications-cleanup`, `telemetry-cleanup`, `daily-engagement` jobs are BACKGROUND work — pushing them as interactive **starves real interactive work** (rent-due SMS, FCM dispatch) per the PR-75 priority split.

There are also P1s: `analytics.policy.ts` allows 4 roles to view the dashboard but doesn't include `FINANCE_ADMIN` (who probably wants MRR); the `getDashboard()` method in analytics is dead (route uses `getOverview()`); the DR drill's 5 steps are config-checks not data-integrity checks; the workflow-coverage route does 10 sequential fetches; the `estimateNextRun` regex parser doesn't match all schedule labels (e.g. "On-demand / Daily" returns null); the workers' `hasPendingInteractive` check is a single `findFirst` which races with new event creation; the outbox `MAX_OUTBOX_PAYLOAD_BYTES = 64KB` is too small for some use cases (a list of 10K rider IDs won't fit); the `workers/index.ts` graceful shutdown has a 30s timeout that may cut off long-running jobs.

The headline architectural issue: **the "DR" surface is fake** — the `dr-drill` route, the `data-management/schedule?action=run-now` synchronous backup, the dead analytics `getDashboard`, and the duplicated backup-lock service in `backup/backup-lock.service.ts` (which is overridden by the real `backup.service.acquireLock`) all suggest the data-management surface was scaffolded quickly with stubs and never finished.

There are **6 P0s**, **11 P1s**, and **6 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, security gap, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code, contract drift | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: `GET /api/metrics` Prometheus endpoint is unauthenticated by default — leaks server fingerprinting + resource usage

**Repro:** `curl https://voltium.example/api/metrics` returns `text/plain; version=0.0.4` with all the `prom-client` default metrics. No auth required. The response includes:
- `nodejs_eventloop_lag_seconds`
- `nodejs_heap_size_used_bytes`
- `nodejs_heap_size_total_bytes`
- `nodejs_active_handles_total`
- `nodejs_active_requests_total`
- `process_cpu_seconds_total`
- `process_resident_memory_bytes`
- `process_start_time_seconds`

**Code:** `web/src/app/api/metrics/route.ts:15-53`

```typescript
export async function GET(req: NextRequest) {
  // ...
  if (format === 'json' || type === 'slow') {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    // ...
  }
  // Default to Prometheus text format — NO AUTH CHECK
  try {
    const metrics = await register.metrics();
    return new NextResponse(metrics, { ... });
  }
}
```

The auth check only runs in the `?format=json` or `?type=slow` branches. The default (no params) path is unauthenticated.

**Impact:**
- **Reconnaissance**: an attacker can fingerprint the Node.js version, the `prom-client` library version, server uptime, and resource usage.
- **Timing oracle**: `nodejs_eventloop_lag_seconds` reveals when the server is under load. An attacker can time their attack to coincide with high load.
- **Capacity planning leaked**: knowing the heap size lets an attacker estimate how many riders are in-memory.
- **The route comment acknowledges the bug**: "to protect internal metrics we could enforce a basic auth or IP whitelist" (line 16-18). **The comment is from the author. They knew and didn't fix it.**

**Fix:**
1. Add an auth/IP check on the Prometheus path: require either `INTERNAL_METRICS_TOKEN` header or an IP allowlist for known Prometheus scrapers.
2. Or: move the route to `/api/internal/metrics` and proxy through Caddy to block external access.
3. Or: drop the default Prometheus export and require `?format=prometheus` (auth) for any access.

**Effort:** 1-2h.

---

### P0-2: `POST /api/admin/dr-drill` perm check is inverted — passes adminId UUID where role string is expected

**Repro:** Call `POST /api/admin/dr-drill` as any role. The perm check at line 39:
```typescript
const canRunDrill = await hasPermission(adminId, 'DATA_MANAGEMENT');
if (!canRunDrill) {
  return errors.forbidden('Permission DATA_MANAGEMENT required to run DR drills');
}
```

The signature of `hasPermission` (permissions.ts:67):
```typescript
export function hasPermission(
  roleOrSession: string | SessionPayload,
  permission: Permission
): boolean
```

The first arg is `roleOrSession` — a role string (e.g. `'SUPER_ADMIN'`, `'OPERATIONS_ADMIN'`) or a `SessionPayload` object. The function returns `true` if `roleOrSession === 'SUPER_ADMIN'` and the permission is in the SUPER_ADMIN's permission set. For an adminId (a UUID like `'cm123abc...'`), the role check `roleOrSession === 'SUPER_ADMIN'` is false, so it falls through to the role-permission map. **The adminId UUID is not in the role-permission map, so the check returns false** — **no one can run the DR drill**.

**Wait** — but the function is `async` and may have a different behavior with the session case. Let me look:

```typescript
if (typeof roleOrSession === 'object' && roleOrSession !== null) {
  const session = roleOrSession;
  // session-handling code
}
```

The adminId is a string (UUID), not an object. So this branch doesn't apply. The function then does `const role = roleOrSession;` and checks `if (role === 'SUPER_ADMIN') return permission in PERMISSIONS;`. UUID is not SUPER_ADMIN, so falls to the lookup `PERMISSIONS[role]`. UUID is not in PERMISSIONS either, so the lookup returns undefined, then `perms?.includes('DATA_MANAGEMENT')` is false. **The check returns false.**

**So no one can run the DR drill.** The endpoint always returns 403.

But the comment at line 39 says "Permission DATA_MANAGEMENT required" — the developer thought this would check. The check is wrong.

**Impact:** The DR drill (the only "do we survive a disaster" check the project has) is unreachable. The audit log never writes `DR_DRILL_COMPLETED`. **In a real incident, an operator who tries to validate the backup story gets 403 and assumes the system is on fire.**

**Fix:**
- Either: change the call to `hasPermission(adminRole, 'DATA_MANAGEMENT')` and pass the role from the session (not the adminId).
- Or: extract the role from the adminId: `const session = await getAdminSession(req); if (!hasPermission(session.adminRole, 'DATA_MANAGEMENT')) return errors.forbidden();`

**Effort:** 5min.

---

### P0-3: `POST /api/admin/data-management/schedule?action=run-now` is synchronous — runs a full DB backup inside the request

**Repro:** Admin opens the Data Management → Schedule tab → clicks "Run Now". The POST request takes **5-15 minutes** depending on DB size. The browser shows a spinner. During the entire time:
- The route holds the HTTP connection
- The database is being read by `pg_dump` (via `dumpDatabase` in `lib/shell.ts`)
- The uploads folder is being archived
- The checksums are being computed
- The retention policy is being applied (deletes old backups)
- Other admin actions time out

**Code:** `web/src/server/modules/data-management/data-management.use-cases.ts:321-409`

```typescript
async runScheduledBackupNow(adminId, adminRole) {
  // ... checks ...
  try {
    const result = await backupService.runScheduledBackup({
      id: schedule.id, frequency: schedule.frequency, includeDatabase: true,
      includeUploads: true, includeLogs: true, primaryBackupRoot: ...,
      // ...
    });
    // ... nextRunAt calculation, audit log ...
    return result;
  }
}
```

`backupService.runScheduledBackup` (backup.service.ts:236-286) calls `createBackup(...)` which does:
1. `getFreeDiskBytes` pre-flight check
2. `acquireLock('BACKUP_RUNNING')`
3. `dumpDatabase` (full pg_dump)
4. `createArchive` (tar.gz the uploads folder)
5. Compute SHA256 checksums
6. Optional: `encryptFile` (AES-256-GCM)
7. Copy to secondary root
8. `releaseLock`

For a 5GB database + 2GB uploads: 10+ minutes easily.

**Impact:**
- **Admin UI hang**: the request holds the connection for 10+ min. Other admin actions time out.
- **No cancel**: once the request starts, the admin can't cancel.
- **No progress feedback**: the admin sees a spinner.
- **No idempotency**: if the admin double-clicks, two parallel backups run. The lock check at line 332 catches the second one ("A backup is already in progress"), but only if the first one has already called `acquireLock`. **There's a race window** between the first backup starting `dumpDatabase` and the `acquireLock` call.
- **No worker observability**: unlike `/api/admin/jobs` (which uses outbox), the result of the backup is not visible in the Background Jobs screen. The admin has to refresh the Data Management page to see the new backup in the list.

**Fix:**
1. **Make it async via outbox** (same pattern as `/api/admin/jobs`). The route enqueues a `BACKUP_RUN_NOW` event. A new worker (`scheduled-backup.job.ts` already exists at workers/jobs/scheduled-backup.job.ts; the use case just needs to call `OutboxService.emit(...)` instead of `backupService.runScheduledBackup(...)`).
2. Return 202 with an outboxId so the admin can poll.

**Effort:** 1-2h. The `scheduled-backup.job.ts` worker already exists; just need to wire the route through the outbox.

---

### P0-4: `POST /api/admin/jobs` `auto-debit` and `rent-due-checker` map to the same outbox event — duplicate label

**Repro:** Open the Background Jobs screen. The list shows:
- `rent-due-checker` (Daily 00:00 IST) — purpose: "Detect and notify overdue rentals"
- `auto-debit` (Daily 01:00 IST) — purpose: "Attempt wallet debit for due rent"

Click "Run Now" on either. The route POSTs `{"jobId": "rent-due-checker"}` or `{"jobId": "auto-debit"}`. The route maps:

```typescript
// jobs/route.ts:24-33
const JOB_TO_OUTBOX_EVENT: Record<string, OutboxEventType> = {
  'wallet-reconciliation': OutboxEventTypes.ADMIN_JOB_WALLET_RECONCILIATION,
  'rent-due-checker': OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,
  'auto-debit': OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,  // ← same as rent-due-checker
  // ...
};
```

Both `rent-due-checker` and `auto-debit` map to `ADMIN_JOB_RENT_DUE_CHECK`. The worker (which is the same `rentRemindersJob`) runs the same code for both labels.

**Impact:**
- **The "8 jobs" list is actually 7 unique jobs** with a duplicate.
- **The purpose text in the UI is misleading**: "Detect and notify overdue rentals" vs "Attempt wallet debit for due rent" suggests different behavior, but they're the same code path.
- **The schedules are different** (00:00 IST vs 01:00 IST) which the operator might expect produces different behavior, but the worker ignores the schedule and just runs.
- **Future confusion**: a developer adding a real `auto-debit` job will find that mapping is taken.

**Fix:**
- Either: differentiate the two jobs. The `auto-debit` should run after `rent-due-checker` and process the debits the first one flagged. Currently `rentRemindersJob` does both in one pass.
- Or: remove the `auto-debit` entry from the static list. The cron at 01:00 IST doesn't exist; the worker runs at 00:00 IST and does everything.

**Effort:** 1h to investigate; 1-2 days to actually differentiate (requires changes to the worker and the daily schedule).

---

### P0-5: `GET /api/admin/analytics` uses raw SQL with hardcoded snake_case table names — same fragile pattern that broke in PR-1

**Repro:** A developer adds a new Prisma model. They forget to add `@map("snake_case_name")` to it. The analytics dashboard counts return wrong numbers for any query that touches that table. No runtime error.

**Code:** `web/src/server/modules/analytics/analytics.use-cases.ts:20-27` and `76-111`

```typescript
const [counts] = await db.$queryRaw<...>`
  SELECT
    (SELECT COUNT(*) FROM "riders") AS total_riders,
    (SELECT COUNT(*) FROM "riders" WHERE "lifecycleStatus" = 'ACTIVE') AS active_riders,
    (SELECT COUNT(*) FROM "vehicles") AS total_vehicles
`;
```

The raw SQL uses `"riders"`, `"vehicles"`, `"transactions"`. These are the `@map` names. PR-1 (commit 34c8b55) fixed a prior instance of this; the comment notes it as a "prior fix" but **the same pattern is now spread across 6 separate raw queries in this file**.

**Impact:**
- **A schema change that drops a `@map` (or adds a new table without one) silently breaks the analytics dashboard.** The route returns 200 with the data the query happened to return (e.g. `total_riders: 0`).
- **The same pattern in 6 places** means a single bug propagates to 6 different metrics.
- **No type-safety**: the raw SQL isn't checked against the schema. A typo like `"rider"` instead of `"riders"` returns 0 silently.

**Fix:**
1. **Replace raw SQL with Prisma `count()` / `aggregate()` calls** (which are schema-aware). The trade-off is a few extra round-trips, but analytics is cached for 60s anyway.
2. Or: extract the table names to a constant module and add a comment "must match @map in prisma/schema.prisma".
3. Or: add a Prisma schema check at startup that fails if any `@map` is missing.

**Effort:** 4-6h to refactor to Prisma calls. 1h to extract the table names to constants.

---

### P0-6: `POST /api/admin/jobs` enqueues ALL admin jobs with `priority: 'interactive'`, starving real interactive work

**Repro:** An admin triggers `notifications-cleanup` via Run Now. The route emits the outbox event with `priority: 'interactive'` (line 307 of jobs/route.ts). The notifications-cleanup job is background work (it purges old notifications, no user impact). The PR-75 priority split was designed to prevent exactly this: "background workers yield to interactive work."

The interactive workers (per workers/index.ts:60-130) are: `notificationDispatch`, `dailyEngagement`, `rentReminders`, `referralReward`, `smsSend`, `orphanEventConsumer` (RENT_PAID, RENT_OVERDUE), and the scheduled emitters.

The background workers are: `reconciliation`, `deviceCompliance`, `notificationsCleanup`, `orphanEventConsumer` (DEVICE_VIOLATION, ADMIN_ACTION).

When an admin triggers `notifications-cleanup` interactively, the worker index.ts:341 check `hasPendingInteractive()` returns false (no interactive events pending), so the background notification-cleanup worker picks it up. So far so good.

But: **the same outbox event with `priority: 'interactive'` is now in the queue**. Other background workers (`reconciliation`, `deviceCompliance`) see this event as PENDING with `priority: 'interactive'`. The `hasPendingInteractive()` check returns true → **they yield**. The interactive worker pool is now blocked processing a cleanup job that has nothing to do with user latency.

**Worse**: the admin-triggered `daily-engagement` job (line 32) is also `priority: 'interactive'`. The `dailyEngagementJob` itself is wired as `priority: 'interactive'` in the workers array (line 84-88). So a daily-engagement event goes through interactive path either way. But if a SuperAdmin triggers it 3 times in a row, the interactive queue gets 3x daily-engagement events that the single `concurrency: 1` worker processes serially, while the other interactive workers (notification, SMS, referral) compete for the same slot.

**Impact:**
- **Interactive workers are starved** by admin-triggered background work.
- **The PR-75 priority split is partially defeated** because admin triggers bypass the priority on the producer side.
- **A SuperAdmin clicking Run Now on 5 background jobs can DoS the interactive queue.**

**Fix:**
- Map each `jobId` to its correct `priority` (matching the worker's priority):
  ```typescript
  const JOB_TO_OUTBOX: Record<string, { eventType, priority }> = {
    'wallet-reconciliation': { eventType: ADMIN_JOB_WALLET_RECONCILIATION, priority: 'background' },
    'rent-due-checker':      { eventType: ADMIN_JOB_RENT_DUE_CHECK,       priority: 'interactive' },
    'device-compliance':     { eventType: ADMIN_JOB_DEVICE_COMPLIANCE,    priority: 'background' },
    'referral-reward':       { eventType: ADMIN_JOB_REFERRAL_REWARD,      priority: 'interactive' },
    'notifications-cleanup': { eventType: ADMIN_JOB_NOTIFICATIONS_CLEANUP, priority: 'background' },
    'telemetry-cleanup':     { eventType: ADMIN_JOB_TELEMETRY_CLEANUP,    priority: 'background' },
    'daily-engagement':      { eventType: ADMIN_JOB_DAILY_ENGAGEMENT,     priority: 'interactive' },
  };
  ```
- Same for the auto-debit fix (P0-4): if the two labels are merged, set the right priority.

**Effort:** 30min.

---

## P1 — Fix in next 2 sprints

### P1-1: `analytics.policy.ts` allows 4 roles but not `FINANCE_ADMIN` — finance team can't see MRR

**Code:** `permissions-roles.ts:113` shows `analytics_view: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'FLEET_MANAGER', 'HUB_MANAGER']` — but `analytics.policy.ts:11-16` has a separate `analyticsPolicy.canViewDashboard` that allows only `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `HUB_MANAGER`, `FLEET_MANAGER` — **not `FINANCE_ADMIN`**.

**Two competing permission definitions.** The `permissions-roles.ts` matrix says FINANCE_ADMIN has `analytics_view`. The `analyticsPolicy.canViewDashboard` says no. Which one wins depends on which check the route uses.

**The route at analytics/route.ts:11 uses `hasPermission(session.adminRole, 'analytics_view')`** — which uses the matrix (so FINANCE_ADMIN can view). So in practice FINANCE_ADMIN can view. But the `analyticsPolicy` is dead code that disagrees with the matrix.

**Impact:** Dead code with a different (and wrong) policy. Future refactor that switches the route to use `analyticsPolicy` will lock FINANCE_ADMIN out.

**Fix:** Delete `analyticsPolicy` (the route uses the matrix). Or align the two.

**Effort:** 10min.

---

### P1-2: `analytics.use-cases.getDashboard()` is dead code

**Code:** `analytics.use-cases.ts:11-58` defines `getDashboard(period: string)` which returns `mrr: 0` for revenue fields and a "matches original logic" comment. **The route never calls it** (route.ts:14 calls `getOverview()`). The schema (`analyticsQuerySchema`) is also unused.

**Impact:** Dead code. Maintenance burden. The "matches original logic" comment suggests this was the original implementation, then `getOverview()` was added with a single raw query as a perf improvement, and the old one wasn't deleted.

**Fix:** Delete `getDashboard` and `analyticsQuerySchema`. ~50 lines removed.

**Effort:** 5min.

---

### P1-3: DR drill doesn't test the actual restore flow — only configuration

**Code:** `dr-drill/route.ts:50-180`

The 5 steps:
1. `db_health` — `SELECT 1` from DB (5ms, doesn't test anything meaningful)
2. `storage_health` — `fs.existsSync(backupDir)` (checks dir exists, not that a backup can be written/read)
3. `worker_health` — outbox pending count < 1000 (magic threshold)
4. `checksum_health` — `db.backupRecord.findFirst()` returns a row with status 'COMPLETED' (checks DB has a record, not that the backup file is valid)
5. `secrets_health` — env vars present (checks env, not that they're correct)

**None of the steps actually attempt a restore.** A real DR test would:
1. Pick the latest backup
2. Spin up a separate DB instance
3. `pg_restore` the dump
4. Compare row counts against the live DB
5. Verify a known rider can be looked up

**Impact:** **The DR drill passes when nothing works** — if `pg_restore` is broken, if the encryption key is wrong, if the dumps are corrupt, the drill still says PASSED. The audit log says "DR_DRILL_COMPLETED" with status: "PASSED" but nothing was actually tested.

**Fix:**
1. Add a real restore test step: pick the latest backup, dump + restore to a scratch DB, verify checksum.
2. Reduce the magic threshold (1000) to a configurable env var with a comment.
3. Add a step that tries to read a sample backup file (e.g. read 1KB and check it doesn't throw).

**Effort:** 1-2 days (requires scratch DB infra).

---

### P1-4: `POST /api/admin/data-management/schedule?action=run-now` race window between `findRunningBackup` and `acquireLock`

**Code:** `data-management.use-cases.ts:331-348`

```typescript
// Check if backup is already running
const running = await backupRepository.findRunningBackup();
if (running) {
  throw new Error('A backup is already in progress');
}

// ... maintenance mode check ...

const lock = await backupService.getLockStatus();
if (lock.status !== 'NONE') {
  throw new Error(`Cannot run backup while lock is active`);
}

await createAuditLog({ ... });

try {
  const result = await backupService.runScheduledBackup({ ... });
```

**Between the `findRunningBackup` check (line 332) and the `runScheduledBackup` call (line 359)**, the `acquireLock` inside `runScheduledBackup` runs. The lock acquisition is the actual mutex. But the outer check uses a different code path (just `findFirst` on `BackupJob` status).

**Two race windows:**
1. Between line 332 and line 359, a different request could also pass the `findRunningBackup` check.
2. The `BackupJob` status and the `BACKUP_LOCK_STATUS` setting are two separate locks. The check uses one; the actual lock uses the other. **They can disagree.**

**Impact:** Two concurrent "Run Now" calls can both pass the `findRunningBackup` check, both call `runScheduledBackup`, both fail at `acquireLock` (or worse, both succeed and corrupt the backup dir).

**Fix:**
- Skip the pre-check; let `acquireLock` be the only source of truth. If the lock can't be acquired, throw a clean error from there.
- Or: wrap the entire pre-check + run in a `db.$transaction` with `SELECT ... FOR UPDATE` semantics.

**Effort:** 1h.

---

### P1-5: `POST /api/admin/jobs` GET does an `estimateNextRun` regex parse that returns `null` for "On-demand / Daily"

**Code:** `jobs/route.ts:213` — `nextRun: estimateNextRun('On-demand / Daily', now)` returns `null` (the regex `daily\s*\(?(\d{1,2}):(\d{2})` requires a time-of-day; "On-demand / Daily" doesn't have one). The UI then shows "—" for next run. **For a job that runs daily at unspecified time, the user can't see when it'll next run.**

Same problem for any job that doesn't have a parseable label.

**Fix:**
- Store the actual next-run time in SystemSetting (when the cron emits, also write `job:next_run:<id>`).
- Or: drop the label-based estimate and query the cron schedule from SystemSetting.
- Or: improve the regex to handle "On-demand / Daily" as a special case (next midnight).

**Effort:** 1-2h.

---

### P1-6: `/api/admin/workflow-coverage` does 10 sequential `fetch()` calls — slow page load

**Code:** `workflow-coverage/route.ts:51-112`

10 `checkApi` calls, each `await`-ed. Each has a 5s timeout. **If 5 endpoints are slow, the request takes 25s+.**

**Impact:** In dev, the page takes forever to load. In prod, the route is still live (the screen is dev-only but the route is not) — a SuperAdmin who hits it via curl blocks the admin session for 25s+.

**Fix:**
- Wrap in `Promise.all(...)` so the 10 fetches run in parallel. 5s total instead of 50s.
- Or: cache the result for 30s (the screen shows "Updated: <time>" so it doesn't need to be live).

**Effort:** 5min.

---

### P1-7: The `analytics` route response has no `Cache-Control: no-store` — admins see stale data for up to 60s

**Code:** `analytics/route.ts:15` — `withCacheHeaders(success(result), 60)`. The cache TTL is 60s. An admin who changes a rider's status and refreshes the dashboard sees the old count for up to 60s.

**Fix:** Either accept the 60s staleness (it's documented) or add a manual invalidate on rider mutations.

**Effort:** 1h if doing the invalidate; 0 if accepting.

---

### P1-8: `workers/index.ts` `hasPendingInteractive` race with new event creation

**Code:** `workers/index.ts:430-440`

```typescript
async function hasPendingInteractive(): Promise<boolean> {
  const found = await db.outboxEvent.findFirst({
    where: { priority: 'interactive', status: 'PENDING' },
    select: { id: true },
  });
  return found !== null;
}
```

**A background worker calls this check, sees no interactive work, then claims a background event. Meanwhile, an interactive event is emitted.** The interactive event waits until the background worker's poll cycle completes (up to 15s idle backoff). The check happens at the start of each poll cycle, not continuously.

**Impact:** Latency-sensitive interactive work can be delayed by up to 15s by a background worker that just claimed a slow event. Per PR-75's design, background yields to interactive — but the yield happens at poll boundaries, not per-event.

**Fix:**
- Use a Postgres LISTEN/NOTIFY for new interactive events.
- Or: shorter idle backoff for background workers (1s instead of 15s) when there are events in the queue.

**Effort:** 1-2 days for LISTEN/NOTIFY.

---

### P1-9: `outbox.MAX_OUTBOX_PAYLOAD_BYTES = 64KB` is too small for batch operations

**Code:** `outbox.ts:150` — 64KB cap on payload size. A single event with 10K rider IDs (for an admin broadcast) would exceed this. The `announcement.use-cases.create` for `ALL` audience (audit #21 P0-3) already has this problem.

**Impact:** The outbox throws `OutboxPayloadTooLargeError` and the route returns 500. The event is never enqueued. **The producer (e.g. announcement use case) has no fallback** — it just fails.

**Fix:**
- Increase the cap to 1MB (Postgres `jsonb` handles this easily).
- Or: split into sub-events (one per recipient) at the producer.
- Or: store the bulk payload in storage and reference it by URL in the outbox event (as the error message itself suggests).

**Effort:** 1h to bump the cap. 1 day to do the split.

---

### P1-10: The workers graceful shutdown has a 30s timeout — long jobs get cut

**Code:** `workers/index.ts:488-503` — `await Promise.race([Promise.all(...), shutdownTimeout])` where `shutdownTimeout` is 30s. If a `wallet-reconciliation` job (which walks every rider) is in flight at SIGTERM, it gets cut after 30s. The job status becomes PROCESSING and the reaper (every 5 min) eventually re-claims it.

**Impact:** On graceful shutdown, in-flight jobs may be cut. The reaper recovers them but the visible state is "PROCESSING" for 5 min.

**Fix:** Increase to 5 min, or use a graceful cancel signal that lets the job checkpoint.

**Effort:** 30min.

---

### P1-11: `monitoring.use-cases.getSystemMetrics` uses `.catch(() => 0)` for missing tables — silent failure

**Code:** `monitoring.use-cuses.ts:25-27`

```typescript
db.outboxEvent?.count({ where: { status: 'FAILED' } }).catch(() => 0),
db.outboxEvent?.count({ where: { status: 'PENDING' } }).catch(() => 0),
db.deviceViolation.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
```

**The optional chaining `db.outboxEvent?.` and the `.catch(() => 0)` swallow the error.** If `outboxEvent` is undefined (the model is missing from the schema), the count returns 0 silently. **The monitoring endpoint reports "0 failed outbox events" when the table doesn't exist — the operator doesn't know to investigate.**

Same for `deviceViolation`.

**Fix:** Throw on missing tables. If the table is genuinely optional, log the absence.

**Effort:** 30min.

---

## P2 — Cleanup backlog

### P2-1: `monitoring.use-cases` makes 10 separate `db.count()` calls in parallel — could be 1 raw query

10 sequential `count` calls. A single raw query with subselects (like the analytics use case) is 1 round-trip.

---

### P2-2: `data-management` subfolder has stub files (`backup/backup.service.ts`, `backup/backup.repository.ts`, `restore/restore.service.ts`) that are dead code

These are the older, incomplete implementations. The real ones are at the top-level of `data-management/`. **Confusing for new developers** — `import { backupService } from './backup.service'` works, but `from './backup/backup.service'` doesn't (the stub has 3 methods only).

**Fix:** Delete the stub files. Add a re-export comment in the real files.

---

### P2-3: `jobs/route.ts:278-280` has the wrong perm name `jobs_run` for non-SUPER_ADMIN

`permissions-roles.ts:110` — `jobs_run: ['OPERATIONS_ADMIN']`. But the route at line 278 uses `hasPermission(admin.adminRole, 'jobs_run')` which is correct. **However, the comment at line 273-277 says "PR-58" which means this was added in a previous PR.** OK no bug, just dead.

---

### P2-4: `dr-drill/route.ts:39` audit log uses `actorType: 'ADMIN'` hardcoded

If the actor is a system-triggered DR drill (e.g. from a cron), the actor type is wrong. But the route is admin-only, so not a real issue.

---

### P2-5: `workers/index.ts:472-482` has 8 different path string variations for detecting direct run

The `isDirectRun` check tests `process.argv[1]` against 8 string patterns (with `\\` and `\\\\` for cross-platform). This is fragile and would break with a different entry-point path.

**Fix:** Use `import.meta.url === pathToFileURL(process.argv[1]).href` for cross-platform direct-run detection.

---

### P2-6: `analytics.use-cases.getCohortData` filters by `"deletedAt" IS NULL` — assumes rider has `deletedAt`

If the `Rider` model doesn't have a `deletedAt` column, this query fails. The audit can't tell from here.

---

## Recommended fix order

| # | Item | Effort | Risk if shipped | Why this order |
|---|---|---|---|---|
| 1 | P0-2 (DR drill perm) | 5min | Low | One-line fix; the DR drill is the most critical "did we break" check |
| 2 | P0-1 (metrics auth) | 1-2h | Medium | Stop leaking internal metrics |
| 3 | P0-6 (jobs priority mapping) | 30min | Low | Stop starving interactive work |
| 4 | P0-4 (auto-debit dup) | 1h | Low | Decide: differentiate or remove |
| 5 | P1-1 (analytics policy dup) | 10min | None | Dead code with wrong policy |
| 6 | P1-2 (dead getDashboard) | 5min | None | Cleanup |
| 7 | P1-5 (estimateNextRun) | 1-2h | Low | Better UI |
| 8 | P1-6 (workflow-coverage parallel) | 5min | None | 10x faster |
| 9 | P1-4 (run-now race) | 1h | Medium | Real concurrency bug |
| 10 | P0-3 (run-now async) | 1-2h | Medium | Architectural fix; admin UI responsiveness |
| 11 | P0-5 (analytics raw SQL) | 4-6h | Low | Type-safety |
| 12 | P1-3 (real DR test) | 1-2 days | Low | Real restore validation |
| 13 | P1-7, P1-8, P1-9, P1-10, P1-11 | 4-5h | Mixed | Various perf and observability |
| 14 | P2-1, P2-2, P2-5, P2-6 (cleanup) | 2-3h | None | Code quality |

**Total: ~5-7 days** for a focused sprint to close all 6 P0s and most P1s.

---

## Tests gap analysis

| Route | Existing test | Coverage | Gap |
|---|---|---|---|
| `/api/admin/analytics` | None | — | No test for `analyticsView` perm; no test for snake_case table assumption |
| `/api/metrics` | None | — | **No test for the unauthenticated default path (P0-1)** |
| `/api/monitoring/metrics` | None | — | No test for CRON_SECRET vs admin session auth |
| `/api/admin/data-management/*` | None | — | No test for the stub-vs-real path confusion; no test for `run-now` async behavior |
| `/api/admin/dr-drill` | None | — | **No test for the inverted perm check (P0-2)**; no test for the 5 steps |
| `/api/admin/jobs` | None | — | **No test for `auto-debit`/`rent-due-checker` mapping dup (P0-4)**; no test for `priority: 'interactive'` for background work (P0-6) |
| `/api/admin/workflow-coverage` | None | — | No test for the dev-only check; no test for parallel fetch |

**The most critical missing tests:**
1. **DR drill perm check (P0-2)** — table-driven test for all 4 roles + perm check returns expected bool.
2. **Metrics auth (P0-1)** — `GET /api/metrics` with no auth header returns 401 or restricted output.
3. **`auto-debit` mapping (P0-4)** — both labels map to the same outbox event.
4. **Outbox priority for background admin jobs (P0-6)** — the emitted event has `priority: 'background'` for notifications-cleanup, etc.

---

## Architecture observations

**1. The data-management surface is split across two competing module trees.** `data-management/backup.service.ts` (real, 26KB) and `data-management/backup/backup.service.ts` (stub, 350B) both exist. New developers will pick the wrong one. The deeper folder is dead and should be removed.

**2. The "DR" surface is half-built.** The `dr-drill` is a configuration check, not a data-integrity test. The `data-management/schedule?action=run-now` is synchronous when it should be async. The `data-management/restore/start` is wired correctly (sets maintenance mode, takes pre-restore backup, restores, runs migrations) but its `confirmation: 'RESTORE VOLTIUM'` literal has no comment explaining why. **The restore flow is the most dangerous code in the codebase and the least tested.**

**3. The outbox/priority system is well-designed but has a hole in the admin-triggered path.** PR-75's `hasPendingInteractive` is a great pattern, but the admin `/api/admin/jobs` POST doesn't respect the priority on the producer side — it always emits as `interactive`. This single-line bug partially defeats the priority split.

**4. The metrics endpoint is split between `/api/metrics` (Prometheus, unauthenticated) and `/api/monitoring/metrics` (JSON, auth required).** Two endpoints, two formats, two security postures. The comment in the Prometheus route acknowledges the issue but doesn't fix it. **A single endpoint with proper auth (e.g. `INTERNAL_METRICS_TOKEN` header) would be cleaner.**

**5. The `workers/index.ts` is 524 lines and growing.** It has 9 event-driven workers + 6 scheduled tasks + reaper + graceful shutdown, all in one file. The PR-151 comment about 4 orphan event types and PR-115 about notifications cleanup show the file is being added to incrementally. **A per-job module file + a thin orchestrator would scale better.**

**6. The analytics dead code (getDashboard + analyticsQuerySchema) is a sign of an in-flight refactor.** The original `getDashboard` was a multi-call implementation; `getOverview` is the single-raw-query perf improvement. **The old one should have been deleted.** The two `analyticsPolicy` files are a similar story.

**7. The "best-effort" .catch(() => 0) pattern in monitoring is anti-observability.** When `db.outboxEvent` is undefined (model missing), the count returns 0 and the dashboard says "0 failed events." The operator's mental model is "the system is healthy" when the reality is "the table doesn't exist." **Always throw on missing schema; let the route return 500 and the operator see the error.**

---

## Out-of-scope notes

- **The backup encryption key (BACKUP_ENCRYPTION_KEY) and rotation strategy** — referenced in `backup.service.ts:41-53` (`encryptFile` with AES-256-GCM). Not in scope; mentioned for the record.
- **The outbox event-type deprecation list** (outbox.ts:38-127) — 9 event types are marked `@deprecated Unused — never emitted, never consumed. Scheduled for removal in v0.4`. They should be cleaned up. Not in scope here.
- **The scheduled-backup.job.ts worker** (workers/jobs/scheduled-backup.job.ts) — already exists; the `data-management/schedule?action=run-now` use case should be wired to it via the outbox. Not in scope.
- **The orphan-event-consumer.job.ts worker** (PR-151) — handles 4 orphan event types that had no consumer. Implies prior to PR-151 these events piled up in the outbox forever. Mentioned for the record; the audit #4 covers the broader notification system.
- **The notifications.job.ts tombstone** (workers/index.ts:33-37) — file is kept for one release as a tombstone. Can be deleted in the next cleanup pass.
- **The per-job `*_use_case.ts` files** — there are 12+ jobs, each with its own file. The actual job logic wasn't audited in detail. The wrapper pattern (`job-wrapper.ts`) is referenced in workers/index.ts:15 but not read in this audit.

---

**End of audit. 6 P0s · 11 P1s · 6 P2s.**
