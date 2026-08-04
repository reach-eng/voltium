# Voltium Admin — Focused Review of Backup/Restore Tabs (2026-08-04)

**Scope:** PR-137 (Phase 7G) — focused review of the two safety-critical
destructive-action tabs in the data-management section:
`web/src/components/admin/screens/data-management/RestoreTab.tsx` and
`web/src/components/admin/screens/data-management/DisasterRecoveryTab.tsx`.

**Method:** read-only review. No code changes. Each finding cites the
file and line(s) and proposes a recommendation. Items marked
**GREEN** are already safe; **AMBER** is "works but could be better";
**RED** is "needs a follow-up PR".

**Source plan:** `docs/AUDIT_PHASE7_PLAN_2026-08-04.md` PR-137
(AP-F-3, P3 — "safety-critical spot-check").

---

## 1. Executive summary

| Area                                | Verdict  | Notes                                            |
|-------------------------------------|----------|--------------------------------------------------|
| Server-side permission check        | **GREEN** | `data_management_restore` required at every entry point. |
| Audit log coverage                  | **GREEN** | `validate()` and `startRestore()` write `restore.*` audit entries. |
| Server re-confirm of destructive    | **AMBER** | `restoreService.start()` doesn't re-verify backup is still COMPLETED at execute time. |
| UI confirm flow (Restore)           | **AMBER** | 4-step wizard is good, but "Start Restore" is one-click after Confirm step. No typed-phrase safeguard. |
| UI confirm flow (DR)                | **AMBER** | Maintenance mode toggle + emergency backup have no in-UI double-confirm. |
| Pre-restore backup safety net       | **GREEN** | `restoreService.startRestore()` creates a `PRE_RESTORE` backup before mutating. |
| Maintenance mode coupling           | **AMBER** | Restore is supposed to enable maintenance; verify the contract is honored. |
| CSRF on destructive POSTs           | **AMBER** | `withApiHandler` doesn't appear to enforce a CSRF token. |
| Rate limit on restore endpoints     | **AMBER** | No throttling — 100 rapid clicks can't cause more than 1 restore, but they can pollute audit log. |
| Concurrency guard (single-flight)   | **RED**  | No check that another restore is already RUNNING/QUEUED. Two admins could trigger 2 concurrent restores. |

**Top recommendations (in priority order):**
1. **PR-138** is the highest-leverage follow-up: gate destructive buttons
   in `RestoreTab` and `DisasterRecoveryTab` on the
   `data_management_restore` permission. Currently the tabs render
   even for `READ_ONLY` admins.
2. Add a single-flight guard in `restoreService.startRestore()` so a
   second concurrent call returns a 409 "restore already in progress"
   rather than racing with the first. This is a P1 not in the
   current plan and should be filed as a follow-up ticket.
3. Add a typed-phrase confirm ("type RESTORE to continue") to the
   "Start Restore" button. The current Confirm step has the right
   warning copy but a low-friction click path.

---

## 2. RestoreTab.tsx — review

**File:** `web/src/components/admin/screens/data-management/RestoreTab.tsx`
**Line count:** 686
**Reachable from:** `/?view=admin&section=data-management` (tab=restore)
and `web/src/app/admin/data-management/restore/page.tsx` (PR-136).

### 2.1 State machine — **GREEN**

The component implements a 4-step wizard (`select → validate → confirm → result`)
backed by `restoreStep` state. Each step is gated by the previous one:

| Step    | Proves                                                                |
|---------|-----------------------------------------------------------------------|
| select  | User has selected a backup (sets `selectedId`).                       |
| validate | User has triggered `/api/.../restore/validate`; UI shows `valid: bool`. |
| confirm | Step 3 card shows a destructive warning (rose-tinted) and the backup metadata. |
| result  | Server has returned a job id; UI shows the result envelope. |

**Strengths**
- "Continue to Restore" is `disabled={!validationResult.valid}` —
  cannot proceed with a known-invalid backup.
- The Confirm step card uses `variant="destructive"` on the Start
  Restore button (line 577) — strong visual cue.
- The result step offers a "Restore Another Backup" reset.

**Findings**
- **AMBER** — once on the Confirm step, clicking "Start Restore" is a
  single action. The card-level warning is good copy but the click
  itself is low-friction. A typed-phrase safeguard (line 576-591) would
  add a deliberate-friction layer for an action that destroys live
  data. Recommend adding a small `<Input>` above the Start Restore
  button that requires the user to type "RESTORE" before the button
  enables.
- **GREEN** — the Start Restore button is `disabled={restoring}` so
  rapid double-clicks during the in-flight POST are blocked. This is a
  strong defense against the most common accidental re-trigger.

### 2.2 Network calls — **GREEN with one AMBER**

```
fetch('/api/admin/data-management/backups?limit=50&status=COMPLETED')  (line 243)
fetch('/api/admin/data-management/restore/history')                    (line 259)
fetch('/api/admin/data-management/restore/validate', POST)            (line 279)
fetch('/api/admin/data-management/restore/start', POST)               (line 307)
```

- All four endpoints require `data_management_restore` (verified at
  `web/src/app/api/admin/data-management/restore/{start,validate}/route.ts:14`
  and via `dataManagementUseCases.{validateRestore,startRestore}` at
  `data-management.use-cases.ts:138-152` which throws `'Unauthorized'`
  if `backupPolicy.canRestoreBackup(adminRole)` is false).
- `credentials: 'include'` is implied (same-origin admin app).
- `restore/history` does NOT require `data_management_restore` — it
  uses the lighter `data_management_view`. This is correct: a
  read-only auditor should be able to see restore history. **GREEN.**

**Finding**
- **AMBER** — `handleStartRestore` does not display the server error
  message if the POST returns a non-2xx (line 318-320: `toast.error(json.error || 'Restore failed')`).
  The `errors.forbidden()` envelope is shown verbatim, which is fine
  for the user, but the audit log still records the `actorId`. If
  permission is later revoked, the user sees a toast but no clear
  "permission denied" visual state on the wizard. Recommend checking
  `res.status === 403` and showing the Access Denied state on the
  card. This is a follow-up ticket, not a blocker.

### 2.3 Pre-restore safety net — **GREEN**

The Confirm step card (line 538-541) explicitly tells the user: *"A
pre-restore backup will be created first."* The server-side
implementation at `restore.service.ts:startRestore` honors this by
calling `backupService.createPreRestoreBackup` (verifiable in
`web/src/server/modules/data-management/backup.service.ts`) before
mutating the database. If the pre-restore backup fails, the restore
aborts and the live database is untouched. **GREEN.**

### 2.4 Maintenance mode coupling — **AMBER**

The DR tab couples to maintenance mode (see §3.4). The Restore tab
does not. If a user is in Step 3 (Confirm) of the wizard and the
maintenance mode is OFF, the restore can still proceed. Per
`restoreService.startRestore()` the flow IS supposed to flip
maintenance mode ON as part of the restore. **Recommend verifying
this end-to-end before the 2026-08-06 staging soak** — confirm
`MAINTENANCE_MODE` is set to `'true'` before the destructive DB swap
and back to its prior value after the swap completes (or to `'false'`
on failure). If the flip is missing, riders can write into the
database mid-restore, which is the worst-case corruption scenario.

### 2.5 Accessibility — **AMBER**

- The step indicator (line 333-363) is decorative — the active step is
  styled but not exposed to screen readers as a status. **Recommend**
  adding `aria-current="step"` to the active step div.
- The "Warning: This action is destructive" block (line 544-555) is
  visually a rose-tinted banner but has no `role="alert"` /
  `aria-live="assertive"`. The user must read it; an SR user may not
  be notified.
- The destructive `Start Restore` button is a regular `<Button>` with
  `variant="destructive"`. Tailwind's `destructive` variant should
  produce a `bg-destructive` color but a screen reader would announce
  it as a button without the severity context. **Recommend** an
  `aria-label="Start destructive restore. This will replace the live
  database."` on this specific button.

---

## 3. DisasterRecoveryTab.tsx — review

**File:** `web/src/components/admin/screens/data-management/DisasterRecoveryTab.tsx`
**Line count:** 649
**Reachable from:** `/?view=admin&section=data-management` (tab=dr) and
`web/src/app/admin/data-management/dr/page.tsx` (PR-136).

### 3.1 Health checks — **GREEN**

The tab fetches `/api/admin/data-management/overview` and
`/api/health/worker` in parallel (line 271-273) and renders a per-key
status card (healthy / degraded / unhealthy). The DR checklist
(line 247-266) is a static set of invariants the operator is expected
to verify mentally. **No destructive action on the health check
itself. GREEN.**

### 3.2 Maintenance mode toggle — **AMBER**

The "Enable Maintenance Mode" button (line 430-443) calls
`PUT /api/admin/settings` with `{ maintenanceMode: !maintenanceMode }`.
**Findings:**

- **GREEN** — the endpoint requires `settings_manage` (not just
  `data_management_restore`), so a `data_management_view` admin (e.g.
  a READ_ONLY role with backup view access) cannot toggle it from
  this UI. Confirmed at `web/src/app/api/admin/settings/route.ts:21`:
  `if (!hasPermission(session.adminRole || '', 'settings_manage'))
  return adminForbidden();`.
- **AMBER** — there is no in-UI confirm. A "Disable Maintenance Mode"
  click is immediate. While not destructive per se (restoring service
  is good), it does silently flip the rider-facing experience back
  on. **Recommend** a `<AlertDialog>` for the "Enable" direction
  (going into maintenance is a one-way door until the next restore
  completes) but not necessarily for "Disable".
- **AMBER** — the button toggles between "Enable" and "Disable" with
  no confirmation of the *current* state from the server. If two
  operators race, the second click is a no-op (server wins) but the
  UI may briefly show the wrong state. The `setMaintenanceMode(!maintenanceMode)`
  on line 357 is the optimistic update path. The toast and re-render
  cover this but a `Promise.all([overview, settings])` refresh on
  mount would tighten the loop. Follow-up ticket.

### 3.3 Verify All Backups — **GREEN with AMBER**

The "Verify All Backups" button (line 444-451) loops through the
`/api/admin/data-management/backups?limit=50&status=COMPLETED` result
and POSTs `/api/admin/data-management/backups/{id}/verify` for each
(line 392-394). This is read-mostly — verify is non-destructive — but
it can run for a long time on a large backup set (up to 50
sequential HTTP calls).

- **GREEN** — there's no auth downgrade on this path; uses the same
  `data_management_view` as the Backups tab.
- **AMBER** — the loop is sequential. On a 50-backup set, a single
  failed request blocks the next. A `Promise.allSettled` with batch
  size 5 would be more responsive without overloading the server.
  Follow-up ticket.
- **AMBER** — no progress bar. The button shows a spinner but
  `verifyAllResult` is only set at the end. For 50 backups, this
  could be a multi-minute operation with no progress feedback.
  **Recommend** rendering the partial count as it goes
  (`{verified} / {total} so far`).

### 3.4 Emergency Backup — **AMBER**

The "Start Emergency Backup" button (line 601-619) POSTs
`/api/admin/data-management/backups` with `{ type: 'MANUAL' }`. This
is not destructive in the data-loss sense (it creates a backup) but:

- **AMBER** — the button has no confirm. Triggering an emergency
  backup is reasonable as a one-click action (it is, by design, the
  one-click "oh no" button), so the lack of confirm is intentional.
  But it should at least show a confirmation toast with the job id
  immediately. Currently the toast is "Emergency backup started"
  (line 611) but no job id is captured. **Recommend** parsing
  `json.data?.id` and surfacing it.
- **AMBER** — there is no check that the previous emergency backup
  is still RUNNING. Rapid clicks would queue multiple jobs. The
  server-side queue handles this fine (it's FIFO) but the UI
  doesn't reflect that. Follow-up ticket.

### 3.5 Maintenance Mode Notice — **GREEN**

The amber notice banner (line 635-643) correctly appears only when
`maintenanceMode === true`. The copy is clear: "Automatic backups
are paused and restore operations may be active." **GREEN.**

---

## 4. Server re-confirm — **AMBER**

For destructive actions, the rule is: the server re-confirms. Here
is the audit trail:

| Action                  | Server-side check                                                                 | Verdict |
|-------------------------|------------------------------------------------------------------------------------|---------|
| `POST /restore/validate` | `hasPermission(adminRole, 'data_management_restore')` THEN `canRestoreBackup(adminRole)` THEN `job.status === 'COMPLETED'` (in `restoreService.validate`). | **GREEN** |
| `POST /restore/start`    | `hasPermission(...)` THEN `canRestoreBackup(...)`. **Does NOT re-verify `job.status === 'COMPLETED'` at execute time.** | **AMBER** |
| `PUT /api/admin/settings` (maintenance) | `hasPermission(..., 'settings_manage')`. Permission is the right gate. | **GREEN** |
| `POST /api/admin/data-management/backups` (manual/emergency) | (Not in scope of this review; covered separately.) | n/a |

**The one AMBER is the gap between validate and start**: a
`validate()` pass returns `{ valid: true }` for a COMPLETED backup,
and the user advances to Confirm. If a parallel job (or a manual
operator action) deletes or corrupts the backup between Validate
and Start, the restore proceeds anyway. **Recommend**: `restoreService.startRestore`
should re-call `backupRepository.getBackupJob(backupId)` and assert
`status === 'COMPLETED'` and that the on-disk file still exists
before mutating. This is a small server-side change; file a P1
follow-up.

---

## 5. Concurrency guard (single-flight) — **RED**

**This is the only RED in the review.**

`restoreService.startRestore()` does not check whether another
restore is already RUNNING or QUEUED. Two SUPER_ADMINs can both
click "Start Restore" within the same second and both POSTs land.
Both calls pass the `canRestoreBackup` permission check; both
create a `PRE_RESTORE` backup; both run migrations. The result is
two concurrent restores stomping each other.

**Severity:** low likelihood (SUPER_ADMIN is rare, the UI is rare,
the timing window is small) but high impact (full database
corruption in the worst case).

**Recommend:** at the start of `restoreService.startRestore()`, query
`db.backupJob.findFirst({ where: { type: 'RESTORE', status: { in:
['QUEUED', 'RUNNING'] } } })` and throw a 409 with a clear message
if one is found. Test: `tests/unit/restore-service-single-flight.test.ts`
should assert the second call returns 409.

This is a P1 not in the current Phase 7G plan. **Filing as a
follow-up ticket in `docs/FOLLOWUP_TICKETS.md`.**

---

## 6. CSRF on destructive POSTs — **AMBER**

`withApiHandler` (used by `restore/start` and `restore/validate`)
does not appear to enforce a CSRF token. Same-origin admin app means
the browser auto-includes cookies, so a cross-site request to
`/api/admin/data-management/restore/start` would need a CORS-allowed
origin AND a valid session cookie.

**Likelihood:** low. The admin app is gated by login at
`/api/admin/auth/me`, and there is no public CORS-allowed origin
that can hold an admin session cookie. **Recommend** a follow-up
audit on `withApiHandler` to confirm CSRF is enforced at the edge
middleware (see `web/src/middleware.ts`). Not blocking.

---

## 7. Server-side audit log coverage — **GREEN**

Confirmed at:
- `web/src/server/modules/data-management/restore.service.ts` —
  `validate()` writes `restore.validated` and `startRestore()`
  writes `restore.started` (and `restore.completed` /
  `restore.failed`) to the audit log.
- `web/src/server/modules/data-management/backup.service.ts` —
  manual backups (including the emergency one in §3.4) write
  `backup.created` to the audit log.

All destructive or recoverable actions are audited. **GREEN.**

---

## 8. PR-138 follow-up: UI gating (the most actionable item)

**PR-138** in the plan is: gate destructive buttons on the
`data_management_restore` permission. The current `RestoreTab` and
`DisasterRecoveryTab` import `useAdminSession` (via `AdminSessionContext`)
but the `restore/page.tsx` and `dr/page.tsx` route files do NOT
provide a context override. **Every** user who reaches the
`/admin/data-management/restore` URL sees the full wizard. The
AdminLayout does gate by `data_management_view` (the parent
permission), so a `READ_ONLY` admin can reach the page (they have
view) and see the destructive buttons. **The server returns 403 on
the POSTs but the UI does not communicate the constraint.**

PR-138 should:
1. Add `useAdminSession()` (or a `useCanRestore()` helper) to
   `RestoreTab.tsx` and `DisasterRecoveryTab.tsx`.
2. When the session lacks `data_management_restore`, render the
   same Access Denied card used by `AdminLayout` (line 180-191) and
   hide / disable the destructive buttons.
3. Add a test (`tests/unit/admin-destructive-gating.test.tsx`) that
   renders with `AdminSessionContext` overridden to a `READ_ONLY`
   admin and asserts the destructive buttons are `disabled` or
   absent.

This is the highest-leverage fix in the entire review. It is also
the smallest in terms of code change.

---

## 9. Summary — what to file

| Priority | Item                                                     | File / area                                    |
|----------|----------------------------------------------------------|------------------------------------------------|
| P1       | Single-flight guard on `restoreService.startRestore()`   | `restore.service.ts` + test                    |
| P1       | PR-138 (this plan) — UI gate on `data_management_restore` | `RestoreTab.tsx`, `DisasterRecoveryTab.tsx`    |
| P2       | Typed-phrase confirm for "Start Restore"                  | `RestoreTab.tsx` (line 576-591)                |
| P2       | Typed-phrase confirm for "Enable Maintenance Mode"        | `DisasterRecoveryTab.tsx` (line 430-443)       |
| P2       | Re-verify `status === 'COMPLETED'` at execute time        | `restore.service.ts:startRestore`              |
| P3       | `aria-current` + `role="alert"` on restore wizard         | `RestoreTab.tsx` (line 333-363, 544-555)       |
| P3       | Capture + display emergency-backup job id                  | `DisasterRecoveryTab.tsx` (line 601-619)       |
| P3       | Progress bar for "Verify All Backups"                     | `DisasterRecoveryTab.tsx` (line 444-451)       |
| P3       | `Promise.allSettled` batching for Verify All               | `DisasterRecoveryTab.tsx` (line 388-400)       |
| P3       | CSRF audit on `withApiHandler`                            | cross-cutting                                  |

**No items in this review are P0 or block the 2026-08-06 staging
soak.** PR-138 (UI gating) and the single-flight guard are the
two most valuable follow-ups; both are small and well-scoped.

---

**Reviewer note:** this review is deliberately narrow — it covers
only the destructive-action flow in the two tabs named in the plan
PR-137 ticket. Other tabs in `data-management/` (Overview,
Backups, Schedule, Storage, Logs) are read-mostly and were not
covered in detail. The `ScheduleTab` config-edit flow would benefit
from a separate review pass; filing as a follow-up.
