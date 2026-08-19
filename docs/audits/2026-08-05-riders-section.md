# Audit: Riders Section (Admin Panel)

**Date**: 2026-08-05
**Scope**: 6 API routes, 1 use-cases file, 22 TSX components, 1 stub types file, 1 validators file. ~3,500 lines.
**Method**: static read of every file; no live runtime checks. Type-vs-DB-vs-API cross-referenced against `prisma/schema.prisma`.
**Bottom line**: One **P0** (the two-person-rule data deletion flow is theatre — UI + validators scaffolded, endpoints missing), three **P1** (lockPassword in device-data response, getter-vs-setter wallet split, large-DEBIT second-admin guard incomplete), and a long tail of **P2/P3** duplication, type-safety gaps, and dead UI.

---

## P0 — Must fix before relying on the data-deletion flow

### P0.1 — Two-person rule for data deletion is UI-only, no server logic

**Evidence**:
- `DataDeletionApprovalCard.tsx:35` calls `POST /api/admin/riders/${riderId}/data-deletion/approve` (issue token)
- `DataDeletionApprovalCard.tsx:96` calls `POST /api/admin/riders/${riderId}/data-deletion/restore` (restore rider)
- `DataDeletionQueueTable.tsx:29` fetches `GET /api/admin/riders?deleted=true` (queue)
- `DataDeletionQueueTable.tsx:64` calls `POST /api/admin/riders/${id}/data-deletion/restore` (restore)
- `validators/admin.ts:20-46` defines `dataDeletionRequestSchema`, `dataDeletionApproveSchema`, `dataDeletionRejectSchema`, `dataDeletionRestoreSchema` — all with a comment: *"defined for forward compatibility with a future POST/PUT data-deletion flow"*
- The header comment on the schema file (lines 15-19) explicitly says: *"The current `admin/riders/[id]/data-deletion` route only has a DELETE handler that takes no body, so nothing imports these yet."*
- `tests/unit/api/data-deletion-flow.test.ts` only validates the Zod schemas parse — never calls an endpoint
- The actual route `web/src/app/api/admin/riders/[id]/data-deletion/route.ts` is a single DELETE handler that:
  - takes no body
  - accepts no approval token
  - has no soft-delete state (immediately hard-anonymizes)
  - is gated by `requirePermission('admin:write')` (NOT `riders_delete_approve`)
  - has no "second admin must differ from approver" check

**Impact**: A compliance officer using the in-app card thinks there's a two-person rule. There isn't. The DELETE endpoint runs in one call from any admin with `admin:write`. The "Approval token" field is just a number that gets discarded server-side. GDPR/DPDP audit-trail claims from the UI card are false.

**Fix shape** (one PR):
1. Add `POST /api/admin/riders/[id]/data-deletion/approve` (requires `riders_delete_approve`, mints a 1h token, stores in a new `DataDeletionRequest` table with `tokenHash`, `requestedBy`, `expiresAt`)
2. Add `POST /api/admin/riders/[id]/data-deletion/restore` (requires `riders_delete_approve`, flips `lifecycleStatus` back from `CLOSED` to `ACTIVE`, clears the `deletedAt` timestamp)
3. Add `GET /api/admin/riders?deleted=true` filter on the existing list endpoint
4. Modify DELETE to:
   - accept `{ approvalToken }` body
   - verify token exists, not expired, not used
   - require executor != requester
   - do **soft delete** first (set `lifecycleStatus=CLOSED`, `deletedAt=now()`), not hard anonymize
5. Add a worker that scans for `lifecycleStatus=CLOSED AND deletedAt < now() - interval '7 days'` and hard-anonymizes
6. Wire `DataDeletionApprovalCard` and `DataDeletionQueueTable` into `RiderManagement.tsx` (currently neither is imported)
7. Replace the existing `tests/unit/api/data-deletion-flow.test.ts` with one that hits the actual endpoints

---

## P1 — Real bugs that need fixing soon

### P1.1 — `getDeviceData` returns plaintext `lockPassword`

**Evidence**: `admin-riders.use-cases.ts:680-689`:
```ts
const rider = await db.rider.findUnique({
  where: { id: riderId },
  select: {
    isAdminLocked: true,
    lockPassword: true,         // ← plaintext
    isUninstallBlocked: true,
    isLocationMandatory: true,
    isAppsControlRestricted: true,
  },
});
```

The route `web/src/app/api/admin/riders/[id]/device-data/route.ts:18` returns this to the caller. The schema field name is `lockPassword` but per `actions/route.ts:128-150` the actual stored value is `lockPasswordHash` (a bcrypt/argon2 hash), and it's the **hash** that should be in `lockPassword`. This looks like a copy-paste bug: the SELECT was written against the pre-PR-99 schema where the field was plaintext.

**Risk**: If the field is the plaintext value (not the hash), the GET endpoint leaks the literal unlock code to every admin with `device_tracking_view` permission. If it's the hash, the SELECT is harmless but the field name is misleading and any future caller will treat it as plaintext.

**Fix**: change `lockPassword: true` to `lockPasswordHash: true` (or drop it from the SELECT entirely — no caller in the codebase reads it).

### P1.2 — `walletBalance` field is updated in two competing places

**Evidence**:
- `admin-riders.use-cases.ts:386-499` (the `update` use-case) accepts a `walletBalance` field and adjusts the wallet via `walletLedgerService.credit`/`debit` — uses the ledger
- `web/src/app/api/admin/riders/[id]/wallet-adjust/route.ts` does the same thing — also goes through the ledger
- `WALLET_FIELDS` in `admin-riders.use-cases.ts:65-70` includes `walletBalance`, `securityDeposit`, `balanceInPaise`, `depositStatus` — but the wallet-adjust route at line 502-504 explicitly throws if you try to set `securityDeposit` or `depositStatus` via the `update` use-case, with the comment *"Block direct securityDeposit/depositStatus mutations — must use Deposits API"*

**Inconsistency**: `walletBalance` is allowed via the `update` use-case (so `PUT /api/admin/riders` with `{ walletBalance: 5000 }` works) AND via `POST /api/admin/riders/[id]/wallet-adjust`. Two HTTP paths, two idempotency-key formats, two audit log shapes for the same business operation. The wallet-adjust route uses `idempotencyKey: 'admin-adjust:${riderDbId}:${coAdminId ?? session.adminId}:${randomUUID()}'` (always unique, dedupe-safe); the update path uses `idempotencyKey: 'admin:${id}:balance:${targetBalance}'` (deterministic — same balance twice in a row dedupes to a no-op the second time).

**Risk**: An admin can adjust a wallet to balance X via the dedicated endpoint, then accidentally retry the same call and it works once. Then they edit the rider through the generic `update` endpoint with `walletBalance: X` and it fails silently (deterministic idempotency key already used). Confusing behavior, hard-to-trace bugs.

**Fix**: remove `walletBalance` from `WALLET_FIELDS` in `admin-riders.use-cases.ts:65`. Force all wallet adjustments through `/api/admin/riders/[id]/wallet-adjust`.

### P1.3 — `actions/route.ts` SECURITY action permission check is misplaced

**Evidence**: `actions/route.ts:80-86`:
```ts
async function handleSecurityAction(rider, action, body, session) {
  if (!hasPermission(session, 'device_remote_control')) return adminForbidden();
  // ... all security actions go through here
```

`device_remote_control` is the only permission gate for ALL security actions including `ADMIN_LOCK`, `UNLOCK_DEVICE`, `PERSIST_APP`, `ENFORCE_LOCATION`, `RESTRICT_APPS_CONTROL`. The post-Action comment on the outer route (`actions/route.ts:19`) only checks `riders_update`:
```ts
if (!hasPermission(session.adminRole || '', 'riders_update')) return adminForbidden();
```

So `riders_update` is sufficient to reach the dispatch, then `device_remote_control` is checked. An admin with `riders_update` + `device_remote_control` can:
- Lock any rider's device and see the unlock code
- Reset the unlock password (rotates `lockPasswordHash` via `generateRandomPassword(12).toUpperCase()`)
- Force-persist the app (prevents uninstall)
- Force-mandatory location

**Risk**: Probably intended — those are "remote control" actions. But the UI in `RiderPermissionsTab.tsx` exposes these as 4 buttons with no second-admin confirmation. The `wallet-adjust` endpoint has second-admin approval for amounts > ₹10k; the security actions have no such check at all. A compromised admin account can brick a rider's device with no peer review.

**Fix**: at minimum, add a peer-confirmation log entry for `ADMIN_LOCK` and `PERSIST_APP` (the destructive ones). Or wire the existing two-person pattern from P0.1 to require a second-admin token for `ADMIN_LOCK`.

### P1.4 — `lockPassword` is stored, read, and written in 3 different fields

**Evidence** (this is sprawl, not a single bug):
- `actions/route.ts:128-138`: writes `lockPasswordHash` (new — hashed)
- `actions/route.ts:150`: writes `lockPasswordHash` again on unlock
- `admin-riders.use-cases.ts:683`: reads `lockPassword` (old — plaintext field)
- `admin-riders.use-cases.ts:719-721`: `if (updateData.lockPassword && typeof updateData.lockPassword === 'string')` — accepts BOTH `lockPassword` and `lockPasswordHash` and hashes if needed
- `web/src/lib/password` is used in some places but not all

**Fix**: pick one field name (`lockPasswordHash`), migrate any `lockPassword` reads to it, drop the dual-name support in `updateSecurityFlags`.

### P1.5 — `actions/route.ts:107` `LOCK_DEVICE` is permanently disabled

**Evidence**: `actions/route.ts:106-107`:
```ts
case 'LOCK_DEVICE':
  return errors.badRequest('LOCK_DEVICE action is disabled for security compliance.');
```

But the `LOCK_DEVICE` case is still in the `fcmRequiredActions` allowlist at line 89, and `RiderPermissionsTab.tsx` (which I read) would render a lock button if it existed. There may be a button in the code I didn't read. Either:
- The button is dead but still rendered → click → 400 error to user
- The button was removed but the action route forgot to be cleaned up

**Fix**: search for the lock-device button; either remove the dead route branch or re-enable with proper auth.

### P1.6 — `RiderEditForm` and `Rider` types are `[key: string]: any` stubs

**Evidence**: `web/src/lib/types/admin.ts:14-21, 39-52`:
```ts
export interface Rider {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  [key: string]: any;   // ← escapes to any
}

export interface RiderEditForm {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  // ... 8 more fields
  [key: string]: any;
}
```

The header comment (lines 1-13) explains: *"STUB. The proper consolidated Rider interface is part of Phase 7 Q2 follow-up (Ticket #1 in FOLLOWUP_TICKETS)."* The current 60+ field accesses across the dialogs and tabs all silently flow through `any`. The `RiderManagement.tsx:82-83` even casts with `as any` on the edit form.

**Risk**: Mass-assignment, typo'd field names, schema drift — none caught by TypeScript. Combined with the lenient Zod update schema in `riders/route.ts:25-94` (which allowlists fields but the Zod types still end up as `any` at the use-case layer), an admin client can send arbitrary fields and the use-case will silently ignore them, but a future refactor could accidentally route them to Prisma.

**Fix**: write the proper consolidated interface (this was already on the Phase 7 Q2 follow-up). 4-6 hours of work, but every screen and test will need a touch.

---

## P2 — Lifecycle / status enum mismatch across 4 layers

The 4 sources of truth disagree on what statuses exist:

| Layer | File | Values | Count |
|---|---|---|---|
| **DB enum `RiderLifecycleStatus`** | `prisma/schema.prisma:1224-1240` | NEW, PHONE_VERIFIED, PROFILE_SUBMITTED, KYC_SUBMITTED, KYC_APPROVED, GUARANTOR_SUBMITTED, GUARANTOR_APPROVED, DEPOSIT_PENDING, DEPOSIT_APPROVED, PLAN_SELECTED, PICKUP_SCHEDULED, ACTIVE, SUSPENDED, RETURN_PENDING, CLOSED | **15** |
| **TS `RiderState` type** | `rider-management/types.ts:21-30` | NEW, KYC_SUBMITTED, ACTIVE, SUSPENDED, CLOSED, APPROVED, POST_ACTIVE, PRE_ACTIVE, ONBOARDING | **9** (4 phantom: APPROVED, POST_ACTIVE, PRE_ACTIVE, ONBOARDING) |
| **`STATE_FILTERS` UI constant** | `rider-management/types.ts:34-41` | ALL, NEW, KYC_SUBMITTED, ACTIVE, SUSPENDED, CLOSED | **6** (missing 9 DB values) |
| **`KycStatus` DB enum** | `prisma/schema.prisma:1250-1258` | PENDING, DRAFT, SUBMITTED, INFO_REQUIRED, APPROVED, REJECTED, EXPIRED | **7** (DRAFT, EXPIRED not in TS or UI) |
| **API schema (KycStatus enum)** | `riders/route.ts:52` | PENDING, SUBMITTED, APPROVED, REJECTED, INFO_REQUIRED | **5** |
| **TS `KycStatus` (lib/types/admin)** | `lib/types/admin.ts:23-30` | NOT_STARTED, PENDING, SUBMITTED, INFO_REQUIRED, APPROVED, REJECTED, VERIFIED | **7** (NOT_STARTED, VERIFIED not in DB) |

**Concrete consequences**:
- A rider in DB status `PROFILE_SUBMITTED` cannot be filtered in the UI (no filter chip exists)
- The state-machine check constraints added in PR-149 (8 trigger functions in `20260808000000_add_state_machine_check_constraints/migration.sql`) can fire transitions that the UI cannot display
- A rider in status `RETURN_PENDING` (set by the device-return flow) shows up in the table with the **default style** (slate/gray) because `getStateBadge` has no case for it — invisible to admins
- The `lifecycleStatus` select in `RiderProfileTab.tsx:161` uses `STATE_FILTERS` (6 values) — so an admin trying to revert a rider from `SUSPENDED` to `KYC_APPROVED` cannot do it through the UI

**Fix**: pick ONE source of truth (the DB enum is the right one — it's enforced). Generate TS types via `prisma generate` and import them. The 4 phantom TS values (`APPROVED`, `POST_ACTIVE`, `PRE_ACTIVE`, `ONBOARDING`) likely come from a previous schema version and need to be deleted.

---

## P3 — Code duplication

### P3.1 — Two parallel bulk-actions toolbars

`RiderBulkActions.tsx` (135 lines) and `RiderBulkActionsBar.tsx` (121 lines) implement the same Approve/Suspend/Delete/Export/Undo/Clear toolbar with near-identical markup. The diff is the `handleBulkAction` prop signature (string + value vs 3 separate callbacks) and the export implementation (inline CSV vs `downloadSelectedRiderCsv`). Only `RiderBulkActionsBar.tsx` is used by `RiderManagement.tsx:51-60`. `RiderBulkActions.tsx` is dead code.

**Fix**: delete `RiderBulkActions.tsx` and the CSV-download helper imports only it.

### P3.2 — `RiderFilters.tsx` and `RiderFiltersBar.tsx` overlap

Both files (93 lines and 154 lines) define search input + state tabs + KYC pill row. `RiderFiltersBar.tsx` adds the Add Rider button and Export button. `RiderFilters.tsx` is not used in `RiderManagement.tsx` — it's dead code.

**Fix**: delete `RiderFilters.tsx`.

### P3.3 — `RiderManagementDialogs.tsx` (304 lines) vs inline dialogs in `RiderDetailDialog.tsx`

`RiderDetailDialog.tsx` defines its own KYC-action confirm, delete-doc confirm, and clear-guarantor confirm `AlertDialog` components inline. `RiderManagementDialogs.tsx` exports the same 3 components (`RiderKycActionDialog`, `RiderDeleteDocDialog`, `RiderClearGuarantorDialog`) with identical markup. The parent `RiderManagement.tsx:124-143` uses the `RiderManagementDialogs` versions; `RiderDetailDialog.tsx`'s inline versions are never triggered because the parent passes `setConfirmKycAction={setConfirmKycAction}` (state lives in `useRiders`).

**Fix**: delete the inline AlertDialog blocks from `RiderDetailDialog.tsx:381-497` (~115 lines).

### P3.4 — `BulkDeleteModal.tsx` and `ConfirmDeleteModal.tsx` are deprecated duplicates

Both files (66 and 61 lines) import a wall of UI primitives they don't use (`Tabs`, `Select`, `Camera`, `Bike`, `Zap`, `Key`, etc.) and export single AlertDialog wrappers that exactly duplicate `RiderBulkDeleteDialog` and `RiderDeleteDialog` from `RiderManagementDialogs.tsx`. Neither is used by `RiderManagement.tsx`.

**Fix**: delete both files.

### P3.5 — `RiderProfileTab.tsx` inline `DetailGroup` calls for 9 fields

Lines 95-164 are 9 near-identical `DetailGroup` calls. Each differs only in label, value, editForm key, and onEdit handler. Could be data-driven from an array of `{label, field, type?, options?}` records.

**Fix (optional)**: extract to a `RIDER_PROFILE_FIELDS` config array and `.map()`.

---

## P3 — Other UI / code issues

### P3.6 — `DataDeletionApprovalCard` and `DataDeletionQueueTable` are orphan components

Neither is imported by `RiderManagement.tsx` or any other file in the codebase. They reference endpoints that don't exist. They render useless UI on whatever page the future implementer mounts them on.

**Fix**: see P0.1 — wire them up, or delete until the endpoints ship.

### P3.7 — `RiderDetailDialog.tsx:498` — `void ({} as Rider)` at file bottom

`RiderManagementDialogs.tsx:304` has `void ({} as Rider);` to silence an unused-import warning. This is a code smell — if `Rider` is imported but not used, just drop the import.

### P3.8 — `RiderRow.tsx:42-59` IntersectionObserver pattern

`rowRef` + `useState(actionsVisible)` + `useEffect` to defer rendering of the action buttons. The `rootMargin: '200px'` is a nice touch but this whole pattern would be cleaner with React's `useInView` hook from `react-intersection-observer` if it's available, or just render the buttons always. For 20-50 rows visible at a time, the perf saving is negligible.

### P3.9 — `RiderBulkActions.tsx:85-103` inline CSV export

The inline `csv` blob + `URL.createObjectURL` + `<a download>` pattern is duplicated in `exportSelectedRiders.ts` (referenced by `RiderBulkActionsBar.tsx:6`). Two implementations of the same export.

### P3.10 — `admin-riders.use-cases.ts:288-293` `getStorageProvider` per request

```ts
const { getStorageProvider } = await import('@/lib/storage');
const storage = await getStorageProvider();
```

`@/lib/storage` is dynamically imported inside `list()` (called on every page-load). One-time dynamic import = fine. But the provider is re-fetched per request, no caching.

### P3.11 — `admin-riders.use-cases.ts:271-275` N+1 shared-guarantor query

After fetching the rider list, a second `db.rider.findMany` runs to find riders sharing a guarantor phone. For 20 riders, this adds 1 round-trip. Fine at current scale; flag if list size grows past 100.

### P3.12 — `RiderDetailDialog.tsx:157` `DialogContent` is `!max-w-[90vw] !w-[90vw] h-[95vh]`

Hard-coded `90vw` width and `95vh` height means the rider dialog dominates the viewport on small screens. No mobile-aware layout pass. Mobile admins (or admins using the dev mode at <768px) get a hostile UX.

### P3.13 — `RiderRow.tsx:111-113` hard-codes `₹{rider.walletBalance}`

The wallet balance display uses raw locale string. Doesn't use the same `formatRupees` helper (if it exists) as the rest of the app. Inconsistency.

### P3.14 — `RiderJourneyTab.tsx:108` hardcodes `['NEW', 'KYC_SUBMITTED', 'ACTIVE', 'SUSPENDED', 'CLOSED']`

Should use `STATE_FILTERS` from the types module (with `'ALL'` filtered out).

### P3.15 — `RiderGuarantorTab.tsx:109` hardcodes `['PENDING', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED']`

Should be the guarantor status enum. The DB has different values per Prisma schema — check `web/prisma/schema.prisma:Guarantor` enum for the truth.

### P3.16 — `actions/route.ts:150` `UNLOCK_DEVICE` rotates the password on every unlock

```ts
dbUpdate.lockPasswordHash = await hashPassword(generateRandomPassword(12).toUpperCase());
```

The new password is generated and hashed but never sent to the rider. Result: rider's old unlock code is invalidated, and the admin who triggered unlock doesn't know the new code. A second admin with SUPER_ADMIN role can re-unlock; everyone else is locked out. Looks like a bug — the password should be passed to the rider via FCM (like `sendUnlockDevice` is called right after).

---

## Test coverage gaps

- **No test** for the `data-deletion` DELETE endpoint (the only test is schema-shape)
- **No test** for the wallet-adjust idempotency key (the two competing paths have different keys)
- **No test** for the `lockPassword` field in `getDeviceData` (P1.1) — would have caught the plaintext leak
- **No test** for the state-machine triggers firing on `lifecycleStatus` updates from the admin update path
- **No test** for shared-guarantor detection (the N+1 path)
- **No test** for `RiderRow` IntersectionObserver deferral
- **No test** for `RiderKycDocsTab` bulk-delete flow (the `selectedKycDocs` + `handleBulkDeleteKycDocs` pair)
- **No test** for the orphan UI components (DataDeletion*) — they have no callers, no tests; both will rot silently

---

## Recommended fix order

| Priority | PR | Scope | Est. hours |
|---|---|---|---|
| **P0.1** | Two-person rule for data deletion | 1 new migration, 3 new routes, 1 new worker, wire 2 orphan components, replace 1 test | 6-8h |
| **P1.1** | Drop/fix `lockPassword` in `getDeviceData` | 1 line + 1 test | 30m |
| **P1.2** | Remove `walletBalance` from `WALLET_FIELDS` | 1 line + 1 regression test | 1h |
| **P1.6** | Replace stub `Rider` and `RiderEditForm` types | Type extraction + 60+ touch-ups + tests | 4-6h |
| **P2** | Unify lifecycle status enums | Replace TS types with `Prisma.*` imports, fix 4 phantom values, update `STATE_FILTERS` | 3-4h |
| **P3.1-P3.4** | Delete 4 dead/duplicate files | `RiderBulkActions.tsx`, `RiderFilters.tsx`, `BulkDeleteModal.tsx`, `ConfirmDeleteModal.tsx` | 30m |
| **P3.3** | Remove inline dialogs from `RiderDetailDialog` | 1 file edit | 15m |
| **P1.3** | Audit security action permissions | Add 1 test for each action, document threat model | 2-3h |
| **P1.4** | Collapse `lockPassword` / `lockPasswordHash` field duplication | 1 migration + 2 file edits + 1 test | 2h |
| **P1.5** | Dead `LOCK_DEVICE` branch | 1 file edit or re-enable | 30m |
| **P3.x** | Remaining P3 cleanup | Variable | 2-3h |

**Total: ~25-30h of focused work** to take the riders section from "feature-complete, several sharp edges" to "production-grade". Could be split into 4-5 PRs over a week.

---

## What I'd do first if I had to pick one

**P0.1** — the data-deletion two-person rule. The UI is already shipping to admin users who believe they have a GDPR/DPDP compliance control, and they don't. The gap between the rendered card and the actual API is the worst kind of bug: it gives a false sense of safety. Fix that, then everything else can wait for a calmer sprint.
