# Phase W4 & W5 — Detailed Implementation Plan

**Source:** `docs/REMEDIATION_PLAN_2026-08-21.md` § W4 (1.5 d, PR-D) + § W5 (4 d, PR-E) = 5.5 d total.
**Method:** in-place read of every affected file to ground the plan in real code state, not the plan's reference to "F-010..F-029" / "PR-8..PR-11" (which are aggregate pointers to `docs/AUDIT_ADMIN_2026-08-21.md` and not re-pasted here).

---

## Pre-flight inventory (current state vs. plan's intent)

| Plan claim | Current state | Action |
|---|---|---|
| "W4: extract `extractErrorMessage()` (kill 15+ raw-toast sites)" | No such helper exists. `toast.error(e.message)` patterns everywhere | **Build the helper, refactor 15+ call-sites** |
| "W4: `useCanRestore` extension to Backups/Schedule tabs" | Hook does not exist; `BackupsTab` has no `useCanRestore` consumer | **Build the hook + wire BackupsTab delete, ScheduleTab save/run** |
| "W4: `EmptyState` + loading-idiom consolidation" | `components/ui/empty-state.tsx` exists (20 lines) and is used in some places; many data-mgmt tabs still roll their own (BackgroundJobsSkeleton, FleetMapSkeleton, etc.) | **Migrate data-mgmt tabs to shared `EmptyState`** |
| "W4: data-management types/helpers dedup (~600 lines)" | 4 tabs at 14k-27k lines each, heavy duplication on `useBackups`/`useRestore`/`useSchedule` patterns | **Extract `useDataMgmtTabs` shared hook family** |
| "W4: optimistic-bulk hook" | No shared hook; each bulk action (admins/bulk, riders/bulk, etc.) has its own state mgmt | **Add `useOptimisticBulk` hook, wire 2-3 highest-value sites** |
| "W4: `aria-current="step"` on RestoreTab" | Step indicator has circles+connectors, no `aria-current` | **Add the attribute** |
| "W5: service moves (wallet/deposit-service → server/modules)" | Already moved — `server/modules/wallet/*` and `server/modules/deposits/*` exist | **Skipped (done)** |
| "W5: >25KB use-case splits" | 3 files over 25 KB: `data-management/backup.service.ts` (30 KB), `riders/admin-riders.use-cases.ts` (32 KB), `riders/rider.use-cases.ts` (28 KB) | **Split backup.service.ts first; the riders files are reachable from W7 (R-1/R-2)** |
| "W5: `api-handler` fold into `api-middleware`" | `lib/api-handler.ts` (withApiHandler) and `lib/api-middleware.ts` (withIdempotency, IS_PRODUCTION_LIKE) coexist; about 12 routes still use `withApiHandler` (used by error mapping), rest use `withIdempotency` | **Pick the smaller of the two (withApiHandler is more general) and migrate `withIdempotency` callers** |
| "W5: dead-code removal (proxy.ts, withJobGuards, dashboard.ts, SosAlertBanner)" | `src/proxy.ts` is the live Next.js middleware (NOT dead). `src/lib/services/dashboard.ts` is used by `/api/admin/dashboard/route.ts` (NOT dead). `src/components/admin/SosAlertBanner.tsx` has zero callers (DEAD). `withJobGuards` does not exist | **Delete `SosAlertBanner.tsx` only; correct the plan's "dead code" claim** |
| "W5: PII-mask rule unification" | `lib/pii-redact.ts` exists; used inconsistently | **Audit call-sites and add a linter rule banning raw `phone`/`email` in audit-log Details cells** |
| "W5: secret-collision boot check" | Not present | **Build it as a startup check in `lib/env.ts`** |
| "W5: KYC empty-string encryption guard" | `encryptPii('')` likely produces garbage ciphertext | **Guard at the crypto layer** |
| "W5: MIME deny-list" | Files accepted by `MIME` check; no deny-list at the route layer | **Add to file-upload route + test** |
| "W5: maintenance-state fail-closed" | `MaintenanceModeScreen` exists; not fail-closed at the gate layer | **Audit `middleware.ts:101`** (already noted in W2/N-10) |
| "W5: OpenAPI generation" | Not present | **Out of scope for W5 (defer to follow-up)** |
| "W5: UI consolidation (EmptyState/aria/hydration/magic numbers)" | Mixed | **Migrate 5-10 magic numbers + add `aria-label` to 87 icon-only buttons (split into 2 PRs)** |
| "W5: coverage fill for 16 untested admin screens" | 80 admin route files; 28 admin unit/integration tests | **Pick the 5 highest-risk screens and add integration tests** |

**Net new W4+W5 work** (after subtracting already-done items): **~3.5 days of focused work**, in 6 shippable PRs.

---

## PR breakdown

### PR-1 (W4): Error & UX safety primitives (0.5 d)
**New files:**
- `web/src/lib/error-utils.ts` — `extractErrorMessage(error, fallback)` (the `extractErrorMessage` the plan calls for). Handles `ApiError`, native `Error`, `{ message: string }`, `null`/`undefined`, and `string`. Never returns `null`; always returns a user-readable string.
- `web/src/components/admin/hooks/useCanRestore.ts` — `useCanRestore(permissionKey)` that reads the admin session + permission + lifecycle, returns `{ allowed, reason }`. Wires the existing `DestructiveConfirm` primitive.
- `web/src/hooks/useOptimisticBulk.ts` — minimal `useOptimisticBulk<T>` for the two big bulk actions (admins, riders).

**Modified files:**
- `web/src/components/ErrorBoundary.tsx` — show a friendly message; the technical details are tucked behind a "Show details" disclosure (F-018).
- 15 raw `toast.error(e.message)` / `toast.error(error)` call-sites in `BackupsTab.tsx`, `ScheduleTab.tsx`, `DisasterRecoveryTab.tsx`, `OverviewTab.tsx`, `StorageTab.tsx`, `RestoreTab.tsx`, `data-management/use-destroy-permission.ts`, `referrals/*.tsx`, `rewards/*.tsx`, `wallet-deposits/*.tsx` — replace with `extractErrorMessage(e, 'Couldn\'t load backups')`.
- `BackupsTab.tsx` delete + `ScheduleTab.tsx` Save/Run buttons — wrap in `DestructiveConfirm` with a `useCanRestore('data_management_manage')` gate.

**Tests (8 cases):**
- `error-utils.test.ts` — covers every error shape, fallback, and the `null → fallback` contract.
- `useCanRestore.test.ts` — allowed / denied / no-session.
- `error-boundary.test.tsx` — default render hides the technical text; "Show details" toggles it.

---

### PR-2 (W4): Stepper a11y + ScheduleTab confirm (0.5 d)
- `RestoreTab.tsx:362-389` — add `aria-current="step"` to the active step circle; add `aria-label` to each circle (F-013). Use semantic `<ol>`/`<li>`.
- `ScheduleTab.tsx:343-361` (`handleRunNow`) — wrap the existing `fetch` in a `DestructiveConfirm` ("Run a backup now? This will lock writes for ~5s.") before the POST (F-021).
- `AuditLogScreen.tsx:72-75` — extend the search to include the JSON-decoded `details` payload, and the `entityId` field (F-025).
- `AuditLogScreen.tsx:108-110` + the row cell rendering — pipe `details` through a `redactPii(JSON.parse(details))` helper so phone/email appear as `98****1234` (F-026).

**Tests (5 cases):**
- `RestoreTab.test.tsx` (new) — `aria-current="step"` reflects `restoreStep` state changes.
- `ScheduleTab.test.tsx` (new) — `Run Backup Now` shows the confirm dialog; cancel does not POST; confirm POSTs once.
- `audit-log-pii-redaction.test.ts` (extend existing) — details cell never contains a raw phone.

---

### PR-3 (W4): EmptyState + loading-idiom consolidation (0.5 d)
- 7 data-mgmt tabs (`OverviewTab`, `BackupsTab`, `ScheduleTab`, `RestoreTab`, `BackupLogsTab`, `DisasterRecoveryTab`, `StorageTab`) — replace their hand-rolled empty states with the shared `EmptyState` (F-015). The 3 competing loading idioms are `BackgroundJobsSkeleton`, `FleetMapSkeleton`, `ServerHealthSkeleton`, `SystemSettingsSkeleton` — collapse to a single shared `Skeleton` (F-014) by promoting the existing `components/ui/skeleton.tsx`.
- `RestoreTab.tsx` step indicator — `useReducer` instead of 4 `useState`s (F-029).

**Tests (4 cases):**
- 1 per migrated tab verifying `EmptyState` renders with the expected icon/title/description.

---

### PR-4 (W5): Code health — api-handler fold + dead code + boot check (0.75 d)
- `lib/api-handler.ts` (~50 lines, error mapping) and `lib/api-middleware.ts` (~200 lines, withIdempotency + IS_PRODUCTION_LIKE) coexist. **Keep `withApiHandler` as the public surface** (it's the more general one) and move the `withIdempotency` implementation INTO it as a `withIdempotency(handler, { keyHeader: 'x-idempotency-key' })` option. Migrate the ~3 routes that use `withIdempotency` (transactions/route, riders/bulk, others) to the unified wrapper. Delete `lib/api-middleware.ts` after migration.
- Delete `src/components/admin/SosAlertBanner.tsx` (zero callers) — confirmed via grep.
- `lib/env.ts` — add `assertNoSecretCollisions()` boot check. Runs on first import. Reads `process.env` for known secret names (`JWT_SECRET`, `WEBHOOK_SECRET`, `RDS_PASSWORD`, etc.) and asserts none collide. Logs warning (does not throw) so a misconfig is loud but doesn't break dev.
- `lib/pii-crypto.ts` — guard `encryptPii('')` and `encryptPii(null)` to return the empty value untouched (no false ciphertext).

**Tests (8 cases):**
- `api-handler.test.ts` (extend) — `withApiHandler({ withIdempotency: true })` replays a POST on the same key.
- `api-middleware.test.ts` (delete after migration).
- `secret-collision.test.ts` (new) — env with two same-name keys triggers a warning.
- `pii-crypto.test.ts` (extend) — empty string round-trips.

---

### PR-5 (W5): backup.service.ts split + MIME deny-list (0.75 d)
- `server/modules/data-management/backup.service.ts` (30 031 bytes, 5+ domains mixed: backups + restore + schedule + storage + DR) — split into:
  - `backup.service.ts` — `createBackup`, `applyRetentionPolicy`, `listBackups`, `deleteBackup` (kept).
  - `restore.service.ts` — already exists (11 225 bytes); absorb the `validateRestore` + `executeRestore` from `backup.service.ts` if any are still mixed in.
  - `schedule.service.ts` — already exists; absorb `runScheduledBackup` + `setSchedule` from `backup.service.ts` if mixed.
- `data-management/backup-path.validator.ts` (already split) — extend the deny-list to reject symlinks, junctions, and Windows-reserved device names (`CON`, `PRN`, `NUL`, etc.).
- `api/admin/files/request-upload/route.ts` (or equivalent) — add the MIME deny-list: `.exe`, `.bat`, `.cmd`, `.sh`, `.scr`, `.dll`, `.com`, `.scr`, `.cpl`, `.jar`. Reject at the API layer, not the storage layer (MIME sniffing already exists).

**Tests (6 cases):**
- `backup-service-split.test.ts` — proves the imports still resolve after the split (no behavioral change).
- `backup-path.test.ts` (extend) — `/dev/null`, `CON`, `C:\Windows\System32\evil.exe` all rejected.
- `file-upload-mime.test.ts` (new) — `.exe` upload rejected with 400.

---

### PR-6 (W5): Coverage fill for 16 untested admin screens (0.5 d)
The plan says 16 screens; only the highest-risk ones get coverage. Pick 5:
1. `KycManagement.tsx` — already has an integration suite; just extend the pending/rejected approve path with a mocked 5xx.
2. `RiderManagement.tsx` — bulk role update + suspend flow. 3 cases.
3. `BackupLogsTab.tsx` — empty state + refresh + filter. 2 cases.
4. `FaqManagement.tsx` — reorder (the source of the F-FAQ build break). 3 cases.
5. `DisasterRecoveryTab.tsx` — 4-step wizard navigation. 2 cases.

11 new cases. Files at `tests/integration/admin/{kyc-management,rider-management,data_management,faq-management,disaster-recovery}.test.ts`.

---

## Out of scope (defer to a follow-up session)

| Item | Why deferred |
|---|---|
| "W5: OpenAPI generation" | Substantial new tooling, 3-5 days on its own |
| "W5: 87 icon-only buttons lack `aria-label`" (F-012) | Sweep, 1.5 d by itself; split into its own PR-D-aria |
| "W5: secret-collision boot check" | **IN PR-4** |
| "W5: maintenance-state fail-closed" (N-10) | Belongs in W2/N-10; not W5 |
| `data-management/use-destroy-permission.ts` refactor (F-016, "split ~600 lines") | Mostly overlaps with the optimistic-bulk hook in PR-1; defer to a focused 1-d PR |
| Riders files >25 KB (`admin-riders.use-cases.ts`, `rider.use-cases.ts`) | Reachable from W7/R-1/R-2 (rider lifecycle, KYC race) — do them in the W7 PR, not here |

---

## Total estimated effort

| PR | Effort | Cumulative |
|---|---|---|
| PR-1 (error utils, useCanRestore, ErrorBoundary) | 0.5 d | 0.5 d |
| PR-2 (a11y + ScheduleTab confirm + audit log) | 0.5 d | 1.0 d |
| PR-3 (EmptyState + loading-idiom + useReducer) | 0.5 d | 1.5 d |
| PR-4 (api-handler fold + SosAlertBanner + env boot + pii-crypto guard) | 0.75 d | 2.25 d |
| PR-5 (backup.service split + path deny-list + MIME deny-list) | 0.75 d | 3.0 d |
| PR-6 (coverage fill for 5 highest-risk admin screens) | 0.5 d | 3.5 d |

**3.5 days focused work, across 6 shippable PRs.** All PRs preserve the existing 3 141 / 3 141 + 3 skipped unit-test gate; integration suite is unchanged. No dev-server config changes.

## Verification gate per PR
- `npm run typecheck && npm run lint && npm run test:unit` — green
- New tests added for every new behavior; no skipped tests merged
- Each PR is independently shippable (no cross-PR ordering dependency)

## Recommended execution order
Same as the PR list above. PR-1 unblocks PR-2 (it adds the `extractErrorMessage` helper PR-2's `AuditLogScreen` test will use), and PR-4 unblocks PR-5 (the `api-handler` refactor touches the same routes PR-5 tests import).
