# Audit: Rider Section of the Admin Panel (+ fix plan)

**Date:** 2026-09-08
**Scope:** `web/src/components/admin/screens/RiderManagement.tsx` + `rider-management/` (all files) →
`web/src/app/api/admin/riders/**` (10 route files) → `web/src/server/modules/riders/`
(`admin-riders.use-cases.ts`, `rider.use-cases.ts`, `rider.repository.ts`,
`rider-lifecycle.service.ts`, schemas, types) → validators, RBAC, Prisma `Rider`
model → `web/tests` coverage.
**Method:** source-only; every finding re-verified live in code (file:line refs below).

> Context: the tree already contains earlier fix passes from today
> (`ADMIN-RIDER-AUDIT`, `NET-005` code comments) — bulk-action name mapping,
> schema null/`''` acceptance, `lifecycleStatus` allowlisting, TL-action
> removal, failure toasts on most mutations, data-deletion permission keys.
> Each was re-verified. This document reports what **remains broken now**.

---

## Findings

### P0 — broken actions that report success

#### P0-1 · Bulk Suspend is still a silent no-op
- Client fix landed: `RiderManagement.tsx:66-67` sends
  `handleBulkAction('updateStatus', 'SUSPENDED')`.
- But the route translates it to `update(id, { accountStatus: value })`
  (`web/src/app/api/admin/riders/bulk/route.ts:37-43`), and the string
  `accountStatus` occurs **zero times** in `admin-riders.use-cases.ts`
  (grep-confirmed) and has **no Prisma column** (only stale `seed.ts`
  references). The key is dropped in the allowlist loop, the per-id call
  "succeeds", `updatedCount++`, and the toast says "N updated" — rider untouched.
- Deeper problem, admitted in-code at `admin-riders.use-cases.ts:702-714`:
  even mapped to `{ lifecycleStatus: 'SUSPENDED' }`, the state machine 409s
  from most states — Suspend needs a dedicated audited override (ticket
  `revert` precedent), not the generic update path.

#### P0-2 · Clear Guarantor still 400s
- Client sends `guarantorStatus: null` (`useRiders.ts:425`); route schema is
  `.enum([...]).optional()` with no nullish (`route.ts:140-142`) → 400.
  (The prior pass fixed the text fields and added a toast, so it now fails
  *loudly* — but the action is broken.) Even past the schema, writing `null`
  into a non-null enum crashes Prisma; correct semantics is deleting the row.

#### P0-3 · "Review Photos" button is dead
- The Vehicle-Return-Pending alert renders a button with no `onClick`
  (`detail/RiderProfileTab.tsx:52-58`) — the single highest-priority alert
  in the dialog does nothing.

### P1 — wrong options, silent failures, ungated buttons

- **P1-1 · `VERIFIED` guarantor option is unselectable.**
  `RiderGuarantorTab.tsx:109` offers VERIFIED; route enum, Prisma enum
  (`schema.prisma:1521-1529`), and machine all lack it → 400/409 on save.
  Remove the option.
- **P1-2 · KYC decision has no feedback and stale badges.**
  `handleKycAction` (`useRiders.ts:322-364`): no toast on success *or*
  failure, and no `fetchRiders()` — the lifecycle badge stays stale after
  approve (server may promote rank).
- **P1-3 · Delete/Add stay silent.** `handleDeleteRider` (no toasts; 403 for
  anyone without `riders_delete`, i.e. all non-superadmins, just resets
  confirm) and `handleAddRider` (duplicate-phone 409 leaves the dialog
  hanging with no message).
- **P1-4 · List fetch fails silent.** `fetchRiders` (`useRiders.ts:71-85`):
  non-OK → nothing; catch → logger only. Result is a stale table or a
  misleading "No riders found".
- **P1-5 · Destructive buttons shown to roles that 403.** Zero
  `hasPermission`/session references in all of `rider-management/`
  (grep-confirmed); layout gates only the *section* (`riders_view`).
  TEAM_LEADER sees Delete/Suspend/Adjust/KYC-approve → 403s. Thread
  `session` down from `AdminLayout` (it already has it) and gate the buttons.
- **P1-6 · Bulk route: no Zod, no audit, no list invalidation.**
  `bulkActionSchema` exists (`validators.ts:638-642`) but the route
  hand-rolls checks; `updateStatus` writes zero audit rows (KYC-only auditing
  lives in the use-case); neither route nor use-case invalidates `admin:*`
  (only rider cache) → 5s + cross-worker staleness.

### P2 — dead code, sharp edges

- **Barrel exports stale duplicates.** `index.ts:5-6` re-exports
  `DetailGroup`/`MediaPreview` from the orphan files while every tab imports
  the `helpers` versions (different props — `value:string`-only, extra
  hover/checkbox behavior). External importers silently get the wrong API.
  Point the barrel at `helpers`; delete `DetailGroup.tsx`, `MediaPreview.tsx`,
  `UndoToast.tsx`, one-line `RiderFilters.tsx`/`RiderBulkActions.tsx.
  (Heavier orphans `DeleteDocModal`/`ClearGuarantorModal`/`ConfirmDeleteModal`/
  `BulkDeleteModal`/`DataDeletion*.tsx` are already gone — prior cleanup.)
- **Non-strict route schema strips silently** (`updateRiderSchema` ends
  `});`, no `.strict()`), which is why no-op writes "succeed". Cannot flip
  to strict alone — `editForm` spreads the whole rider (`walletBalance`,
  `state`, …) and would start 400ing legit saves. Either client-side `pick()`
  of allowlisted keys (clean) or server warn-log on stripped keys (safe).
- **Bulk-bar `canUndo`/`selectedCount` never passed** by the shell (undo lives
  only in the toast) — dead prop path; wire or remove.
- Minor: export CSV is 5-col in the bulk bar vs 12-col in filters;
  `intent` enum (`deliver`/`personal`) is narrower than the rider-side free
  string.

### Verified good (no action)

Bulk action-name mapping + failure toasts, undo-via-`lifecycleStatus` +
partial-failure toast, schema null/`''` acceptance, MoneyTab read-only
deposit badge, TL-action removal, data-deletion permission keys + two-person
rule, KYC rank guards + machine-validated transitions + expiry/editableFields
promotion, wallet/direct-mutation blocks with API redirects,
`lockPasswordHash` never selected, device-data caps, duplicate-phone race
handling, CAS lifecycle transitions, shared-guarantor surfacing, soft-delete
financial guard.

---

## Fix plan

Conventions: `web/` root unless noted. Run `npm run typecheck && npm run lint`
in `web/` after every phase. Vitest files live in `web/tests/unit/...`.

### Phase 0 — Safety baseline (15 min)

1. `git checkout -b fix/rider-admin-audit-2026-09-08` (tree is dirty with
   other passes — branch first).
2. Baseline: `npx vitest --run tests/unit/admin-rider-security.test.ts
   tests/unit/api/admin-wallet-adjust-caps.test.ts
   tests/unit/server/use-cases/completePickupVerification.test.ts` — record
   green before touching anything.
3. No migrations required for any item below (verified — no schema change needed).

### Phase 1 — P0-1: Bulk Suspend real path (1–2h)

1. `web/src/app/api/admin/riders/bulk/route.ts`
   - `updateStatus` case: translate value → `{ lifecycleStatus: value }`
     instead of `{ accountStatus: value }`.
   - Add `case 'suspend'`: call new `adminRiderUseCases.suspend(id, …)`;
     collect per-id failures like siblings.
   - Accept legacy `updateStatus`+`SUSPENDED` by routing it to `suspend`
     (backward compat with in-flight clients).
2. `web/src/server/modules/riders/admin-riders.use-cases.ts` — new
   `suspend(id, ctx)`:
   - `getCachedRider`, throw `Rider not found` if missing.
   - Direct `tx.rider.update({ data: { lifecycleStatus: 'SUSPENDED' } })`
     (deliberate machine bypass — admin override, ticket-`revert` precedent).
   - `invalidateRiderCache(id)` + `invalidateCache('admin:*')`.
   - `createAuditLog({ action: 'rider.suspend', details: { previousStatus } })`.
3. `useRiders.ts` — no client change needed (already sends
   `('updateStatus','SUSPENDED')`); verify with test below.
4. `lib/validators.ts` — extend `bulkActionSchema` action enum with
   `'suspend'` and **wire it into the bulk route** (replaces hand-rolled
   `ids` check; fixes P1-6 schema half too).
5. Tests (`web/tests/unit/admin-riders-bulk-suspend.test.ts`, new):
   - suspend NEW→SUSPENDED succeeds + audit row exists;
   - suspend already-SUSPENDED is idempotent success;
   - `updateStatus`+bogus value → per-id failure entry, not throw;
   - non-OPS/FLEET role → 403.
6. Grep existing bulk tests for the old `{accountStatus}` shape and update.

**Risk:** suspend-from-anywhere bypasses the machine — that *is* the
requirement (admin override); the audit row is the control.
**Verify:** bulk-suspend a NEW test rider in dev; confirm status + audit +
rider-app gate reacts.

### Phase 2 — P0-2: Clear Guarantor null + row delete (45 min)

1. `route.ts` — `guarantorStatus: z.enum([...]).nullish()`.
2. `admin-riders.use-cases.ts` `update()`, guarantor branch: if **all**
   guarantor keys are null/`''`, `deleteMany({ where: { riderId: id } })`
   instead of upsert; skip the status machine check on that path.
3. Pre-check `flattenRider` + list `sharedGuarantorWith` + `RiderGuarantorTab`
   against a missing guarantor row (all use `?.` — confirm with a test).
4. Tests: full-null PUT → 200, row gone, GET shows blank tab; phone-only
   partial still upserts. Keep the loud toast; confirm success toast fires.

**Risk:** low. **Verify:** clear guarantor on a dev rider, reload dialog,
confirm blank + no console errors.

### Phase 3 — P0-3 + P1-1 + P1-2/3/4 (one client pass, ~1h)

1. **Review Photos** (`RiderProfileTab.tsx:52-58`): add `onClick` switching
   the detail dialog to the inspection tab — lift an `activeTab` state in
   `RiderDetailDialog` (convert Tabs to controlled if needed). Test: click →
   inspection tab visible.
2. **Remove `VERIFIED`** from `RiderGuarantorTab.tsx:109`. Update any test
   asserting the option list.
3. **KYC feedback** (`useRiders.ts:322-364`): `toast.success`/`toast.error`
   mirroring `handleUpdateRider`, plus `await fetchRiders()` after success.
4. **Delete/Add feedback**: success toast on delete; error toast with server
   message on `!res.ok` (409 duplicate case included); keep Add dialog open
   on failure so input isn't lost.
5. **List errors** (`useRiders.ts:57-86`): `fetchError` state; `RiderTable`
   renders an error row with Retry (`fetchRiders`) instead of "No riders
   found". Distinguish empty-search vs failed-load copy.

### Phase 4 — P1-5 role-gated buttons + P1-6 bulk hygiene (1.5h)

1. **Role gating:** thread `session` (already in `AdminLayout`) through
   `RiderManagement` → bulk bar (`onApprove/onSuspend/onDelete`), `RiderRow`
   (Eye stays, Trash2 gated on `riders_delete`), `RiderDetailDialog`
   (Save/KYC-approve/Adjust), Add trigger (`riders_create`). Hidden → don't
   render; near-miss roles get `title="Requires X"` disabled state. UX only —
   server already enforces; say so in a code comment.
2. **Bulk route:** validate with extended `bulkActionSchema`, audit
   `updateStatus`/`suspend` per batch (`rider.bulk_<action>`, ticket-`bulk_*`
   pattern), `invalidateCache('admin:*')` after the switch.
3. Tests: 403 matrix (TEAM_LEADER × delete/suspend/adjust-approve), bulk
   audit-row test, schema-rejects-unknown-action test.

### Phase 5 — P2 batch (~1.5h)

1. Barrel: re-export `DetailGroup`/`MediaPreview` from `./helpers`; delete
   the 5 orphan files; full `tsc` + test run to catch external importers.
2. Schema strictness: **do not** flip `.strict()` (would 400 legit saves —
   `editForm` spreads the whole rider). Add server `logger.warn` on stripped
   keys instead; one test asserting warn on `{tlAction}`.
3. Bulk-bar dead props: wire `canUndo={!!lastAction}` + `selectedCount` or
   delete the props.
4. Export CSV: unify on the 12-col builder (or keep 5-col as explicit
   "quick" option).

**Explicitly out of scope** (decisions, not code): guarantor-reject-suspends-
rider default (ops playbook), `intent` enum breadth, slate-badge dark tweak
(owned by dark-mode pass).

### Verification matrix

| Gate | Command / check |
|---|---|
| Types + lint | `npm run typecheck && npm run lint` in `web/` |
| Unit | new bulk-suspend, clear-guarantor null, bulk schema/audit tests + existing `admin-rider-security`, wallet-adjust caps, pickup verification suites |
| Manual (dev) | bulk-suspend NEW rider → SUSPENDED + audit; undo → restored; clear guarantor → blank tab; Review Photos → inspection tab; TEAM_LEADER login → no Delete/Suspend buttons; failed fetch → error + retry |
| Coverage | no drop vs baseline |

**Total: ~6–7h across 5 phases**, each independently shippable (Phase 1+2 are the P0s).
