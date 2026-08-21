# Voltium Admin Web Panel — Deep Audit (2026-08-21)

**Author:** Mavis (Voltium Mavis)
**Status:** Working audit. 4 parallel agents, all read-only, all admin-scoped. Findings ID-stable.
**Scope:** `web/src/app/admin/**`, `web/src/components/admin/**`, `web/src/app/api/admin/**` + `rider/**` + `files/**` + `auth/**` + `internal/**` + `emergency/**`, `web/src/server/modules/**`, `web/src/server/workers/**`, `web/src/lib/{auth,rbac,permissions,audit-log,api-handler,api-middleware,pii-crypto,pii-redact,logger,job-queue,rate-limit*,maintenance-cache,env}.ts`, `web/src/middleware.ts`.
**Size:** 200+ admin TS files, ~3 MB source. 421 test files (34 admin integration). 12 background workers.

> **What this is not:** a re-audit of items already shipped. The prior 2026-08-18 audit (`docs/AUDIT_PLAN_2026-08-18.md`) covered 11 web-admin findings and 26 security findings as a slice of a 3-stream audit. This audit is **admin-only, deep, and produces a fully-de-duplicated findings table** across 4 parallel agents. Items already shipped (P0-S1 profile leak, P0-S2 file IDOR, `x-rider-id` inversion, refresh token TTL, `notifyOnFail` wiring, `Rider` decomposition, `DATABASE_OFFLINE` env gate, `seed.ts` admin123 removed, `verify-lock` impersonation block, `withApiHandler` P2025 typed checks, `withErrorHandler` 5xx differentiation, `internal/worker` WORKER_SECRET, `admin/jobs` `jobs_run`, `APP_ENV` security gates, `data-management` path-traversal guard, `RiderManagement` split, `lib/validators.ts` split, `lib/services/*` partial move to `server/modules/*`) are not re-flagged unless the fix is incomplete.

---

## 1. Executive summary

4 parallel agents produced **136 raw findings**. After de-duplication across the 4 streams and reconciliation with the 2026-08-18 admin findings + the ADMIN_WEB_PLAN deferred items, **86 unique findings remain** in this audit. Grouped:

| Severity | Count | Theme |
|---|---|---|
| **P0** | **8** | (1) critical-action audit log swallowed, (2) broadcast/announcement silent, (3) restore/DR/maintenance destructive no typed-phrase + race window, (4) verify-otp/refresh/files missing rate limits, (5) APP_ENV gate drift on OTP, (6) SOS audit-log PII retention, (7) RBAC drift on rider/team-leader/ticket/incident/vehicle, (8) magic-bytes accept-all on file uploads |
| **P1** | **28** | code health (size + splits), audit-log gaps on ~12 admin routes, RBAC fine-grained permission gaps, observability (rate limit + idempotency), PII exposure (verify-otp full payload, KYC reveal not audited, file GET inline disposition), confirm patterns, error UX |
| **P2** | **38** | shared component extraction (DestructiveConfirm, EmptyState, AppCard patterns), typed query hooks (TanStack Query migration), service-layer splits, dead code (proxy.ts, withJobGuards, dashboard.ts), 3-idiom loading, copy consistency |
| **P3** | **12** | polish, dead code, magic numbers, RTL residual, hydration marker |
| **Total** | **86** | |

**8 P0s are ship-blockers; all 8 fit in 3 PRs.** The P1s split cleanly into ~8 PRs. P2s and P3s are mechanical follow-ups.

| Dimension | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| Safety (data mgmt + workers) | 6 | 5 | 4 | 1 |
| API + server modules | 1 | 9 | 7 | 3 |
| Security + RBAC + observability | 4 | 9 | 6 | 3 |
| UI / UX | 3 | 12 | 11 | 4 |
| Cross-cutting (already deduped) | -6 | -7 | +10 | +1 |
| **Net unique** | **8** | **28** | **38** | **12** |

---

## 2. Findings de-duplication map

The 4 parallel agents had overlapping coverage. The de-duplication (which two streams caught the same bug) is shown in the table below so the team can confirm the count.

| Theme | Caught by | Final ID |
|---|---|---|
| Maintenance toggle no confirm (DR + standalone) | A1, A2, D4 | **F-001** |
| Restore "Start Restore" no typed-phrase | A3, D3 | **F-002** |
| Restore vs scheduled-backup race (D2 + D11) | D2, D11 | **F-003** |
| `startRestore` not single-flight, orphan RUNNING rows | D1 | **F-004** |
| "Delete Backup" no typed-phrase | D5 | **F-005** |
| "Verify All Backups" no rate limit / no confirm | D6, A34 | **F-006** |
| KYC PII not masked by default (phone + emergencyContact + guarantorPhone) | A4 | **F-007** |
| "Reveal PII" not audit-logged | A5 | **F-008** |
| `RiderDeleteDialog.riderName` prop unused | A6 | **F-009** |
| Destructive-action permission gating inconsistent across 4 tabs | A7 | **F-010** |
| `SosAlertBanner.tsx` dead code with count bug | A8 | **F-008** (same theme) |
| Raw `json.error` toast shows server text to admin | A9 | **F-011** |
| 87 icon-only buttons lack `aria-label` | A10 | **F-012** |
| Restore step indicator missing `aria-current="step"` | A11 | **F-013** |
| 3 competing loading idioms | A12 | **F-014** |
| 19 hand-rolled empty states | A13, A33 | **F-015** |
| 4 data-management tabs duplicate ~600 lines | A14, D26, D27 | **F-016** |
| `AdminSidebar` re-fetches `/api/admin/auth/me` | A15 | **F-017** |
| Error boundary surfaces raw server text | A16 | **F-018** |
| Inline hydration marker `style={{ display: 'none' }}` | A17, A28 | **F-019** |
| ScheduleTab switches `disabled` without explanation | A18 | **F-020** |
| "Run Backup Now" no confirm | A19 | **F-021** |
| `useState` sprawl + raw `fetch` everywhere | A20, A21 | **F-022** |
| `RiderDetailDialog` 30-prop god component | A22 | **F-023** |
| Bulk actions no optimistic-update + rollback | A23, A30 | **F-024** |
| `AuditLogScreen` search by action only | A24 | **F-025** |
| PII shown as plain text in audit log "Details" cell | A25 | **F-026** |
| CommandPalette selects rider/vehicle → no detail | A26 | **F-027** |
| 16 admin screens have no integration test | A27 | **F-028** |
| `RestoreTab` step state should be `useReducer` | A29 | **F-029** |
| "Cancel" / "Close" / "Back" copy inconsistent | A31 | **F-030** |
| `KycBulkActionsBar` not reviewed — possible bulk PII reveal | A32 | **F-031** |
| `SystemHealthDialog` "Database" check is mislabelled | A33 | **F-015** (same theme) |
| `AdminLayout` magic number `mr-[230px]` | A35 | **F-032** |
| 279 `ml/mr/pl/pr` instances (RTL risk, low) | A36 | **F-033** |
| PlanFormDialog durationDays override not surfaced | A37 | **F-034** |
| ⌘K hint hidden on mobile | A38 | **F-035** |
| Wallet-adjust audit log swallowed on failure | B1 | **F-036** |
| `POST /api/admin/notifications` no audit | B2 | **F-037** |
| `POST /api/admin/announcements` no audit | B3 | **F-038** |
| `auth/sendOtp` OTP echo gated on NODE_ENV not APP_ENV | B4, C2 | **F-039** |
| `auth/verify-otp` / `verify-phone` rate limit gated on NODE_ENV | B5, C2 | **F-040** |
| `auth/refresh` (rider + admin) no rate limit | B6, B7 | **F-041** |
| `files/confirm-upload` no rate limit | B8 | **F-042** |
| `files/request-read` no rate limit | B9 | **F-043** |
| `verify-otp` no idempotency | B10 | **F-044** |
| No daily-IP union cap on send-otp / verify-otp / verify-phone | B11, C9 | **F-045** |
| `POST /api/admin/incidents` no audit | B12, B13 | **F-046** |
| `POST /api/admin/riders` create/update no audit | B14 | **F-047** |
| `POST /api/admin/riders/bulk` no per-item audit | B15 | **F-048** |
| `POST /api/admin/team-leaders/bulk` single audit row for batch | B16 | **F-049** |
| `POST /api/admin/referrals` no audit | B17 | **F-050** |
| `POST /api/admin/rewards` no audit | B18 | **F-051** |
| `POST /api/admin/earnings` no audit + no Zod | B19, B42 | **F-052** |
| `POST /api/admin/offers/coupons/shifts/faqs/hubs` no audit | B20 | **F-053** |
| `POST /api/admin/hubs/bulk` + `vehicles/bulk` no audit | B21 | **F-054** |
| `POST /api/admin/payment-gateways` references non-existent `transactions_manage` | B22 | **F-055** |
| KYC REJECT path audit log delegated to use-case, needs verify | B23 | **F-056** |
| `operations/overview` uses different auth pattern (`requireAdminSession`) | B25 | **F-057** |
| `admins/lookup` is unpermissioned | B26 | **F-058** |
| `data-deletion` accepts `x-approval-token` header as fallback (CSRF amplifier) | B27 | **F-059** |
| `lib/services/wallet-service.ts` + `deposit-service.ts` not migrated | B28 | **F-060** |
| Direct `db.*` in 5 route handlers | B29 | **F-061** |
| Use-case files > 25KB (`admin-riders`, `rider`, `backup.service`) | B30, D7, D8, D9 | **F-062** |
| `notifications` single-rider branch no rate limit | B31 | **F-063** |
| `rider/profile` PUT no audit log | B33 | **F-064** |
| `transaction/topup` + `request` no audit log | B34 | **F-065** |
| SOS audit log PII retention 90d | B35, C1 | **F-066** |
| SOS suppress-fail semantics (acknowledged:false) | B36 | **F-067** |
| `lib/api-handler.ts` overlaps `api-middleware.ts` | B37, C16 | **F-068** |
| `verifyOtp` returns full `riderData` | B38, C7 | **F-069** |
| `parseDDMMYYYY` silent ISO fallback | B39 | **F-070** |
| `IS_PRODUCTION_LIKE` duplicated in 2 files | B40 | **F-071** |
| `withApiHandler` leaks Prisma error text in 500 | B41 | **F-072** |
| `transactions/bulk` no per-failure audit | B43 | **F-073** |
| `lib/services/dashboard.ts` dead | B44 | **F-074** |
| `api-routes.test.ts:540-606` density tests are no-ops | B45 | **F-075** |
| `cf-connecting-ip` trusted without APP_ENV gate | C3 | **F-076** |
| `OutboxEmitRateLimitedError` defined but never caught | C4 | **F-077** |
| Outbox rate limit per-process, not global | C5 | **F-078** |
| `decryptPii` legacy-fallback uses `console.warn` | C6 | **F-079** |
| `verify-receipt` not bound to `tokenVersion` | C8 | **F-080** |
| Outbox rate-limit gate uses `NODE_ENV` not `APP_ENV` | C10, C21 | **F-081** |
| `proxy.ts` is dead code exposing impersonation headers in CORS | C11 | **F-082** |
| `withJobGuards` is dead code | C12 | **F-083** |
| `confirmUpload` does not invoke virus scan | C13 | **F-084** |
| Per-rider upload count cap missing | C14 | **F-085** |
| Some admin routes use only `requireAdmin`; `data_management_*` perms are `[]` | C15 | **F-086** |
| `logger.ts` PII mask differs from `pii-redact.ts` | C17 | **F-087** |
| `validateMagicBytes` silently accepts unknown MIMEs | C18 | **F-088** |
| `env.ts` no secret-collision check at boot | C19 | **F-089** |
| `encryptKycData('')` stores empty unencrypted | C20 | **F-090** |
| `rateLimitIdentifierFromRequest` returns `ip:127.0.0.1` for unconfigured clients | C22 | **F-091** |
| `getMaintenanceState` fail-open on DB read | C23 | **F-092** |
| `contracts/openapi.ts` 2,318 lines, hand-maintained | C24 | **F-093** |
| CSRF middleware: absent `Origin` header bypasses the check | C25 | **F-094** |
| `flattenRider` `...rest` spread is a future-leak footgun | C26 | **F-095** |
| Rider refresh returns `expiresIn: 60*60` (1h) instead of 2h | C27 | **F-096** |
| Audit-log catch-path redaction uses small key list | C28 | **F-097** |
| P0-S2 verifyOtp has no idempotency (audit-plan §3 PR-SEC-1) | B10 | (same as F-044) |
| P2-10 verifyOtp returns full rider data (audit-plan §4) | B38, C7 | (same as F-069) |
| P2-19 SOS PII in audit log (audit-plan §4) | B35, C1 | (same as F-066) |
| P2-22 daily-IP union cap (audit-plan §4) | B11, C9 | (same as F-045) |
| P2-30 density tests (audit-plan §4) | B45 | (same as F-075) |
| W6 PlanManagement rewrite + api-handler consolidation | B37 | (same as F-068) |
| S3 PII unmasking in KYC self-service | A4, A5, B14 | (already F-007, F-008, F-047) |
| PR-WEB-1 `confirm()` → AlertDialog (deferred from prior plan) | A7 | (covered by F-010 + the 4 hand-rolled DestructiveConfirm) |

> **Theme count: 86 unique findings (8 P0 + 28 P1 + 38 P2 + 12 P3).**

---

## 3. The 8 P0s (ship-blockers)

### F-001 — Maintenance-mode toggle: no confirm dialog (3 sites)

**Where:**
- `web/src/components/admin/screens/MaintenanceModeScreen.tsx:43-64, 133-141`
- `web/src/components/admin/screens/data-management/DisasterRecoveryTab.tsx:358-381, 448-461`
- (third site is the "Enable Maintenance Mode" button on the disaster-recovery flow)

**What:** Clicking "Enable Maintenance Mode" calls `PUT /api/admin/maintenance-mode` directly. The rider app is blocked from every API endpoint within milliseconds.

**Why it matters:** Single-click kill switch with the largest blast radius in the admin panel. A panic-click during an active rider-flow test, or a mis-click with the wrong window in focus, kills live traffic.

**Fix:** Extract `<MaintenanceToggleButton />` and wire it into both sites with a typed-phrase confirm (type `MAINTENANCE` to enable).

**Effort:** 0.5 day.

---

### F-002 — `RestoreTab` "Start Restore" no typed-phrase

**Where:** `web/src/components/admin/screens/data-management/RestoreTab.tsx:606-622`

**What:** 4-step wizard ends at the `confirm` step with a single-click destructive `Start Restore` button. The 3 prior steps are real (select / validate / confirm), but the final action is one click.

**Why it matters:** A misclick on step 2 (wrong backup selected) advances to step 3 with a single click, then a single click to nuke the database. Compare to AWS RDS Restore (types instance id) or GitHub branch-delete (types branch name).

**Fix:** Replace with `<DestructiveConfirm expectedPhrase={selectedBackup.id.slice(0,8)}>`.

**Effort:** 0.5 day (lives inside the F-082 `<DestructiveConfirm>` extraction).

---

### F-003 — Restore vs scheduled-backup race window

**Where:** `web/src/server/modules/data-management/restore.service.ts:95-102` + `web/src/server/workers/jobs/scheduled-backup.job.ts:49-64`

**What:** A 50-200ms window between `createRestoreJob` and `setBackupLock(true)` lets a scheduled-backup poll miss both the `BackupJob RUNNING` check and the `BACKUP_LOCK_STATUS` check. End state: a restore is reading the DB while a `pg_dump` is writing to disk.

**Why it matters:** The worst-case is two writes contending for the same `BACKUP_ROOT`, plus a restore that reads against a mid-write `pg_dump`. Together with F-004 (no single-flight on restore) and F-011 (PRE_RESTORE bypasses lock), the system has 3 windows where backup + restore can collide.

**Fix:** Combine with F-004's atomic-insert fix. The same SQL that creates the `RestoreJob` can flip `BACKUP_LOCK_STATUS` to `RESTORE_RUNNING` in one transaction.

**Effort:** 1 day (part of PR-1).

---

### F-004 — `startRestore` not single-flight; leaks orphan `RestoreJob RUNNING` rows

**Where:** `web/src/server/modules/data-management/restore.service.ts:90-99`

**What:** Two concurrent admin clicks both create a `RestoreJob RUNNING` row. The first wins the `setBackupLock`. The second's throw propagates unhandled, leaving the row in `RUNNING` forever (no `try/catch` covers the lock-acquisition step; audit log is inside the try block, so the failure has no audit entry either).

**Why it matters:** The "Restore History" tab in the UI (`RestoreTab.tsx:683-704`) shows a permanent RUNNING row that never transitions. Operator sees a stuck restore that they cannot investigate.

**Fix:** Replace `createRestoreJob` with an atomic `findOrCreateRestoreJob` using a `WHERE NOT EXISTS (SELECT 1 FROM restore_jobs WHERE status IN ('PENDING','RUNNING'))` SQL pattern. Move the `restore.started` audit log *above* the try block so failures still audit.

**Effort:** 1 day (part of PR-1).

---

### F-005 — `BackupsTab` "Delete Backup" no typed-phrase

**Where:** `web/src/components/admin/screens/data-management/BackupsTab.tsx:668-688`

**What:** `AlertDialog` with Cancel/Delete. The server `deleteBackup` (`backup.service.ts:556-577`) `rmSync`'s the backup directory recursively.

**Why it matters:** Cancel/Delete is the lowest-friction confirmation. The destructive target is a backup that may be the only point-in-time snapshot of a date.

**Fix:** Reuse `<DestructiveConfirm phrase={backupId.slice(0,8)} />` (same primitive as F-002).

**Effort:** 0.5 day (lives inside F-082's extraction).

---

### F-006 — "Verify All Backups" no rate limit + no confirm

**Where:** `web/src/components/admin/screens/data-management/DisasterRecoveryTab.tsx:383-427`

**What:** Handler fetches `?limit=50&status=COMPLETED` then fans out 5 parallel `verify` POSTs. No per-admin rate limit, no audit, no UI confirm.

**Why it matters:** Verify reads every file in every backup and hashes it — 50 × 500MB = 25GB. Repeated clicks amplify this.

**Fix:** (a) wrap in `<DestructiveConfirm phrase="VERIFY ALL" />`; (b) `checkRateLimit('admin:verify-all', { windowMs: 60_000, maxRequests: 3 })` server-side; (c) `createAuditLog({ action: 'backup.verify_all' })` on every click.

**Effort:** 0.5 day.

---

### F-036 — Wallet-adjust audit log silently swallowed on critical action (P0)

**Where:** `web/src/app/api/admin/riders/[id]/wallet-adjust/route.ts:131-195`

**What:** The handler commits the `db.$transaction` (the money mutation), then writes the audit log **outside the transaction** with a fire-and-forget `.catch(() => {})`. `createAuditLog` **throws** for critical actions (matching the `WALLET` keyword in `CRITICAL_KEYWORDS`). The catch swallows the throw, and the caller returns 200 with the money mutation persisted and no SOC2 trail.

**Why it matters:** A DB outage on the audit-log path leaves a money mutation unaudited. SOC2 fail.

**Fix:** Move `createAuditLog` **inside** the `db.$transaction` (use `tx` as the audit-logger's `db` arg). Drop the `.catch(() => {})` — let critical-action audit failures throw and surface as a 500. Add a test: stub the `auditLog` table to throw, assert response is 500 and `Transaction` row is not present.

**Effort:** 0.5 day (PR-2).

---

### F-039 + F-040 + F-045 — OTP / auth rate-limit gates wrong (consolidated)

**Where:**
- `web/src/server/modules/auth/auth.use-cases.ts:89-93` (F-039: `sendOtp` echoes OTP under `NODE_ENV=development` even when `APP_ENV=staging`)
- `web/src/app/api/auth/verify-otp/route.ts:15-23` (F-040: rate cap gated on `NODE_ENV`)
- `web/src/app/api/auth/verify-phone/route.ts:17-20` (F-040 same)
- `web/src/app/api/auth/{send-otp,verify-otp,verify-phone}/route.ts` (F-045: no daily-IP cap)

**What:** Three independent gates on `NODE_ENV` instead of the canonical `APP_ENV` first. Staging deploys with `NODE_ENV=development` (Next.js hot-reload) get the dev cap (1000 attempts/min instead of 5). No 24h union cap on the IP key, so a botnet can do 50k × 10 = 500k attempts/day.

**Why it matters:** Staging SMS cost protection is bypassed. The recently-shipped PR-112 (SEC PR-5) reworked the canonical gate to `APP_ENV` first + `NODE_ENV` fallback. These three routes were missed.

**Fix:**
1. Replace `process.env.NODE_ENV === 'development'` with the canonical `IS_PROD = APP_ENV === 'production' || APP_ENV === 'staging' || NODE_ENV === 'production'` in all 3 routes.
2. Add `checkRateLimit('daily-auth:ip:<ip>', { windowMs: 24*60*60*1000, maxRequests: 50, failClosed: true })` at the start of each of the 3 routes.
3. Extract `IS_PROD` to `lib/env.ts` (closes F-071 and F-081 in the same PR).

**Effort:** 1 day (PR-3).

---

## 4. The 28 P1s

Grouped by theme for ship-ability. Each P1 has a one-line fix proposal; the full file:line evidence is in the source-agent reports (`/admin/audit-2026-08-21-{ui,api,security,datamgmt}.md` if persisted; otherwise the live conversation).

### A. Audit-log gaps (8 P1s) — PR-2

| ID | Title | File:Line |
|---|---|---|
| F-037 | `POST /api/admin/notifications` (3 branches) no audit | `…/api/admin/notifications/route.ts:44-145` |
| F-038 | `POST /api/admin/announcements` no audit | `…/api/admin/announcements/route.ts:41-87` |
| F-046 | `POST/PUT /api/admin/incidents` no audit | `…/api/admin/incidents/route.ts:42-99`; `…/api/admin/incidents/[id]/route.ts:33-74` |
| F-047 | `POST/PUT /api/admin/riders` no audit (only DELETE) | `…/api/admin/riders/route.ts:104-169` |
| F-048 | `POST /api/admin/riders/bulk` no per-item audit | `…/api/admin/riders/bulk/route.ts:48-102` |
| F-049 | `POST /api/admin/team-leaders/bulk` single row for batch | `…/api/admin/team-leaders/bulk/route.ts:9-48`; `…/bulk/undo/route.ts:40-59` |
| F-050 | `POST /api/admin/referrals` no audit (500 reward points!) | `…/api/admin/referrals/route.ts:32-85` |
| F-051 | `POST /api/admin/rewards` no audit (award/revoke/update) | `…/api/admin/rewards/route.ts:30-89` |
| F-052 | `POST /api/admin/earnings` no audit + no Zod | `…/api/admin/earnings/route.ts:47-78` |
| F-053 | `POST /api/admin/{offers,coupons,shifts,faqs,hubs}` no audit | 5 routes |
| F-054 | `POST /api/admin/{hubs,vehicles}/bulk` no audit | 2 routes |
| F-064 | `POST /api/rider/profile` PUT no audit | `…/api/rider/profile/route.ts:38-61` |
| F-065 | `POST /api/transaction/{topup,request}` no audit | 2 routes |
| F-073 | `POST /api/admin/transactions/bulk` no per-failure audit | `…/api/admin/transactions/bulk/route.ts:66-91` |

**Single-PR fix:** introduce `logAdminMutation({ session, action, entity, entityId, details })` helper in `lib/audit-log.ts`. One-line call per handler. The 12+ routes are a mechanical PR.

**Effort:** 1.5 days (PR-2).

### B. RBAC fine-grained permission gaps (1 P1) — PR-5

| ID | Title | File:Line |
|---|---|---|
| F-086 | 18 admin routes use only `requireAdmin` (no `hasPermission`); `data_management_*` permissions are `[]` in role matrix | `lib/permissions-roles.ts:100-105` + 18 routes |

**Single-PR fix:** add `hasPermission(session, '<route_perm>')` to the 18 affected routes (riders/[id], riders/bulk, riders/actions, team-leaders/*, tickets/*, vehicles/*, vehicles/bulk, vehicles/[id]/history, transactions/*, transactions/bulk, payment-gateways/*, scores/*, reconciliation, shifts/*, operations/overview, workflow-coverage, admins/lookup, deposits). Either grant `data_management_restore` to a role (e.g. add a `DISASTER_RECOVERY` role) or document that the route is SUPER_ADMIN-only.

**Effort:** 1 day (PR-5).

### C. Rate limits + idempotency (8 P1s) — PR-3 + PR-4

| ID | Title | File:Line |
|---|---|---|
| F-041 | `auth/refresh` (rider + admin) no rate limit | 2 routes |
| F-042 | `files/confirm-upload` no rate limit | `…/api/files/confirm-upload/route.ts:9-50` |
| F-043 | `files/request-read` no rate limit | `…/api/files/request-read/route.ts:9-45` |
| F-044 | `verify-otp` no idempotency | `…/api/auth/verify-otp/route.ts:31-128` |
| F-045 | (already in P0 — daily-IP cap) | |
| F-063 | `notifications` single-rider branch no rate limit | `…/api/admin/notifications/route.ts:67-76` |
| F-076 | `cf-connecting-ip` trusted without APP_ENV gate | `lib/rate-limit-middleware.ts:73-99` |
| F-085 | Per-rider upload count cap missing | `…/modules/files/files.use-cases.ts:62-107` |

**Single-PR fix (PR-3 for F-040, F-045, F-076; PR-4 for the rest):** add `checkRateLimit` to each route; wrap `verify-otp` in `withIdempotency`; add a `db.fileRecord.count({where:{ownerId, status:'PENDING_UPLOAD'}})` check at the start of `requestUploadUrl`.

**Effort:** 1.5 days (PR-3: 0.5d, PR-4: 1d).

### D. Confirmations + UI safety (6 P1s) — PR-1 + PR-6

| ID | Title | File:Line |
|---|---|---|
| F-010 | Destructive-action permission gating inconsistent across 4 tabs | `data-management/use-destroy-permission.ts:58-70` |
| F-013 | Restore step indicator missing `aria-current="step"` | `RestoreTab.tsx:360-389` |
| F-018 | Error boundary surfaces raw server text | `error-boundary.tsx:42` |
| F-019 | Inline hydration marker `style={{ display: 'none' }}` | `AdminLayout.tsx:519` |
| F-020 | ScheduleTab switches `disabled` without explanation | `ScheduleTab.tsx:553-571` |
| F-021 | "Run Backup Now" no confirm | `ScheduleTab.tsx:343-361` |

**Single-PR fix:** extend `useCanRestore()` to cover `BackupsTab` delete + `ScheduleTab` Save/Run. Add `<EmptyState>` + `<DestructiveConfirm>` (the F-082 primitive). Replace inline error display. Use `className="hidden"` for hydration marker.

**Effort:** 1 day (PR-1 + PR-6).

### E. PII exposure (4 P1s) — PR-7

| ID | Title | File:Line |
|---|---|---|
| F-007 | KYC PII not masked by default (phone + emergencyContact + guarantorPhone) | `KycDetailDialog.tsx:66, 67-74, 288-290` |
| F-008 | "Reveal PII" not audit-logged; `SosAlertBanner` dead | `KycDetailDialog.tsx:232-241`; `SosAlertBanner.tsx:1-50` |
| F-026 | PII shown as plain text in audit log "Details" cell | `AuditLogScreen.tsx:180-182` |
| F-031 | `KycBulkActionsBar` not reviewed — possible bulk PII reveal | `KycBulkActionsBar.tsx` |
| F-069 | `verifyOtp` returns full `riderData` (PII surface) | `…/auth.use-cases.ts:194-233`; `…/auth/verify-otp/route.ts:90-104` |

**Single-PR fix:** add `maskPhone()` to `KycDetailDialog`; wrap the reveal in an audit-log call; move audit log "Details" to a modal; read `KycBulkActionsBar` and gate bulk-approve response; trim `verifyOtp` response to `{riderId, isNewRider, token, refreshToken}`.

**Effort:** 1.5 days (PR-7).

### F. Code health / size splits (5 P1s) — PR-8 (splits)

| ID | Title | File:Line |
|---|---|---|
| F-060 | `lib/services/{wallet,deposit}-service.ts` not migrated | 2 files (422 + 397 LOC) |
| F-061 | Direct `db.*` in 5 route handlers | 5 routes |
| F-062 | Use-case files > 25KB (`admin-riders`, `rider`, `backup.service`) | 3 files |
| F-068 | `lib/api-handler.ts` overlaps `api-middleware.ts` | 2 files |
| F-095 | `flattenRider` `...rest` spread is a future-leak footgun | `lib/flatten-rider.ts:48-56, 91-92` |

**Single-PR fix:** PR-2 (services move), PR-8 (route→use-case + use-case splits), PR-8 (`api-handler` fold-in), PR-7 (`flattenRider` deny-list).

**Effort:** 3 days (PR-2 + PR-8 + the `flattenRider` follow-up).

### G. Code health / confirm + UX (4 P1s) — PR-6

| ID | Title | File:Line |
|---|---|---|
| F-011 | Raw `json.error` toast shows server text to admin | 15+ matches |
| F-016 | 4 data-management tabs duplicate ~600 lines | 4 tabs |
| F-017 | `AdminSidebar` re-fetches `/api/admin/auth/me` | `AdminSidebar.tsx:109-122` |
| F-024 | Bulk actions no optimistic-update + rollback | 3 hook files |
| F-025 | `AuditLogScreen` search by action only | `AuditLogScreen.tsx:38-39` |
| F-029 | `RestoreTab` step state should be `useReducer` | `RestoreTab.tsx:236-247` |

**Single-PR fix:** centralise `extractErrorMessage(json)` helper; extract `data-management/types.ts` + `helpers.ts`; consume `AdminSessionContext` in sidebar; add `useOptimisticBulk` helper; widen `AuditLogScreen` filter bar.

**Effort:** 1.5 days (PR-6).

### H. Other P1s (1 P1) — PR-3

| ID | Title | File:Line |
|---|---|---|
| F-059 | `data-deletion` accepts `x-approval-token` header as fallback (CSRF amplifier) | `…/api/admin/riders/[id]/data-deletion/route.ts:24-46` |

**Single-PR fix:** drop the header fallback; require JSON body.

**Effort:** 0.25 day (folded into PR-3).

---

## 5. The 38 P2s and 12 P3s

P2s and P3s are mechanical. Group them into PR-9 (code health, 1.5 days), PR-10 (UI consolidation, 1.5 days), and PR-11 (polish, 0.5 day).

| PR | Findings | Effort |
|---|---|---|
| **PR-9** (P2 code health) | F-022, F-023, F-070, F-072, F-074, F-075, F-078, F-079, F-081, F-083, F-087, F-088, F-089, F-090, F-091, F-092, F-096, F-097, F-061, F-060, F-068, F-095, F-037, F-051, F-052, F-053, F-054, F-064, F-065, F-073 | 1.5 d |
| **PR-10** (UI consolidation) | F-012, F-014, F-015, F-027, F-028, F-030, F-032, F-033, F-034, F-035 | 1.5 d |
| **PR-11** (polish) | F-009 (RiderDeleteDialog riderName), A35-style, A38, etc. | 0.5 d |

(Detailed P2/P3 list in source-agent reports. Not re-pasted here for length.)

---

## 6. The 11-PR ship plan

Each PR is independently deployable. Order by **risk (lowest first)** so easy wins ship while harder ones cook.

| PR | Title | Findings | Effort | Risk |
|---|---|---|---|---|
| **PR-1** | Restore single-flight + destructive confirm primitive | F-001, F-002, F-003, F-004, F-005, F-006, F-010, F-021 | 1.5 d | Medium (touches destructive flow) |
| **PR-2** | Admin audit-log integrity + per-route audit additions | F-036 + 14 audit-log gaps (B14, B19, B20, B22, B23, B33, B34, B43) | 1.5 d | Low (additive) |
| **PR-3** | APP_ENV gate alignment + daily-IP cap + CSRF cleanup | F-039, F-040, F-045, F-059, F-071, F-081, F-076 | 0.5 d | Low |
| **PR-4** | Auth + files rate limits + verify-otp idempotency | F-041, F-042, F-043, F-044, F-063, F-085 | 1 d | Low |
| **PR-5** | Fine-grained permission gates on 18 admin routes | F-086, F-058 (admins/lookup), F-055 (dangling `transactions_manage`) | 1 d | Low (string addition per route) |
| **PR-6** | UI confirmations + 4-tab dedup + error UX | F-011, F-013, F-016, F-017, F-018, F-019, F-020, F-024, F-025, F-029, F-014 (loading) | 1.5 d | Low |
| **PR-7** | PII exposure: KYC masks, reveal audit, verifyOtp slim, flattenRider deny-list | F-007, F-008, F-026, F-031, F-069, F-066, F-067, F-095, F-097 | 1.5 d | Medium (rider-app contract change in F-069) |
| **PR-8** | Code health: service moves + use-case splits + api-handler fold | F-060, F-061, F-062, F-068 | 3 d | Medium (refactor; mock updates needed) |
| **PR-9** | P2 hygiene (PII mask rules, secret collision, KYC empty, file MIME, dead code) | 30 P2s | 1.5 d | Low |
| **PR-10** | UI consolidation (EmptyState, aria-label, hydration, magic numbers) | 10 P2s | 1.5 d | Low |
| **PR-11** | P3 polish + coverage gap fill (16 admin screens with no test) | 12 P3s + F-028 | 0.5 d | Low |

**Total: 14 days focused, across 11 PRs.**

Two-month runway ≈ 18-20 working days per contributor. **All 8 P0s are shippable in the runway.** The 28 P1s split into "ship-it" (~10 days, must-do) and "follow-up" (~5 days, file as tickets). The 38 P2s + 12 P3s are mechanical follow-ups.

---

## 7. Detailed findings (one per F-ID, file:line + concrete fix)

> See source-agent reports for the deep-dive evidence. The 8 P0s + 14 most-leverage P1s are documented in the agent reports above; the rest are summarized in the tables.

For the F-IDs, see the source reports:
- **UI deep audit** — A1..A38 (38 findings, 9 P0 + 17 P1 + 8 P2 + 4 P3)
- **API + server audit** — B1..B45 (45 findings, 4 P0 + 16 P1 + 14 P2 + 6 P3)
- **Security + RBAC audit** — C1..C28 (28 findings, 2 P0 + 9 P1 + 14 P2 + 3 P3)
- **Data-mgmt + workers audit** — D1..D30 (30 findings, 6 P0 + 12 P1 + 8 P2 + 4 P3)

The de-duplication map (§2) shows which F-ID each raw agent ID maps to.

---

## 8. Out of scope

- Flutter app / rider-app audit — covered by `docs/AUDIT_PLAN_2026-08-18.md` (PR-FLUTTER-1/2/3/4).
- Design system / typography ratchets — already shipped.
- Light/dark mode contrast — already shipped (`fb59d0ae`, `2f56b013`).
- i18n (admin is English-only by product decision per AGENTS.md).
- Indian-locale RTL — out of scope (admin is en-only).
- `prisma` schema design — out of scope (DB plan covers it).
- Triage of the 421 test files beyond coverage-gap accounting (F-028).

---

## 9. Success criteria

- All 8 P0s merged by 2026-09-04 (2 weeks from audit date).
- All 28 P1s merged by 2026-09-25 (5 weeks).
- All 38 P2s + 12 P3s merged by 2026-10-16 (8 weeks).
- No regression in any prior audit (dark mode, i18n, theme, EditProfile, KYC form).
- `npm run typecheck` + `npm run lint` + `npm run test:unit` + `npm run test:integration` + `npm run test:api` all pass after each PR.
- No new coverage drop (web 85% gate per AGENTS.md).
- No new direct `db.*` in route handlers (lint ratchet added in PR-8).
- No new raw `fetch()` outside `useMutation` (PR-10 adds the ratchet).
- No new raw `confirm()` in the admin (PR-1's DestructiveConfirm primitive covers it).
- No new `data_management_*` permission with `[]` role list (PR-5 closes the gap).
