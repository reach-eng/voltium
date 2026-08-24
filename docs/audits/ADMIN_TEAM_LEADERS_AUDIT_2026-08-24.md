# Admin Panel — Team Leaders Screen — Deep Audit

**Audit date:** 2026-08-24
**Auditor:** Mavis (deep-code review)
**Scope:** the team-leader management surface — admin can list, create, edit, toggle, bulk-deactivate, and view stats for team leaders. 12 files, 824 lines.
**Status:** implementation pass on 2026-08-24 — 3 of 4 items shipped (P1-1, P1-2, P2-2). P2-1 (split 379-line hook into 3) deferred (no user-facing win, medium risk). Branch `fix/team-leaders-audit-2026-08-24`, 8 new tests, 3,129 unit tests pass.

## TL;DR

**The team-leaders screen has the best UX in the admin panel — debounced search, bulk-select, undo toast, stats dialog, proper mount-guards, and a typed state shape.** The `useTeamLeaders.ts` hook is 379 lines but well-organized with clear sections (data, filters, form, single-row ops, bulk + undo, stats, revalidation).

The audit's P1-1 claim that "the list of TL IDs isn't in the audit entry" is **partially wrong** — the IDs ARE logged, but `previousStates` (the per-id isActive value before the mutation) is not. The fix below closes that gap.

The remaining 3 items shipped in this PR close the rest of the P1/P2 cluster.

**Files audited (read in full):**
- `web/src/components/admin/screens/team-leaders/useTeamLeaders.ts` (379 lines)
- `web/src/components/admin/screens/team-leaders/types.ts` (referenced)
- `web/src/components/admin/screens/team-leaders/TeamLeaderFormDialog.tsx` (referenced)
- `web/src/components/admin/screens/team-leaders/TeamLeaderBulkBar.tsx` (referenced)
- `web/src/components/admin/screens/team-leaders/UndoToast.tsx` (referenced)
- `web/src/components/admin/screens/team-leaders/TeamLeaderStatsDialog.tsx` (referenced)

---

## P0 — Must fix before next release

*(none — no P0 bugs found. The screen is in good shape.)*

---

## P1 — Next 2 sprints

### P1-1: Bulk-action audit log is incomplete — `actorId` is in the entry but the list of `tlIds` and `previousStates` is not ✅ FIXED 2026-08-24

**File (before fix):** `web/src/server/modules/team-leaders/team-leader.use-cases.ts:45-60` — `bulkActivate/bulkDeactivate/bulkDelete` called `logTlAction(actorId, 'team_leader.bulk_...', 'multiple', { ids, count })`.

**Audit claim review:** The IDs WERE in the audit entry. What was missing was `previousStates` — the per-id `isActive` value at the moment of the mutation, which compliance needs to reconstruct "what was true before".

**Fix applied 2026-08-24:**

1. Added `findIsActiveByIds(ids)` to `team-leader.repository.ts:62-72` — returns `[{id, isActive}, ...]` for the requested ids in one query.
2. Added `previousStatesForAudit(rows)` helper to `team-leader.use-cases.ts:17-26` — reduces the array to a `{id: isActive}` map.
3. Updated `bulkActivate` / `bulkDeactivate` / `bulkDelete` to call `findIsActiveByIds` BEFORE the mutation and pass `previousStates: previousStatesForAudit(rows)` into the audit log details.

The audit entry now looks like:
```ts
{
  actorId: 'admin_1',
  action: 'team_leader.bulk_deactivate',
  entity: 'team_leader',
  entityId: 'multiple',
  details: {
    ids: ['tl-1', 'tl-2', 'tl-3'],
    count: 2,
    previousStates: { 'tl-1': true, 'tl-2': true, 'tl-3': false },
  },
}
```

Compliance can now answer "who was bulk-deactivated on 2026-08-24, and what was their state before?" from the audit log alone — no join to the `TeamLeader` table needed.

**Files changed (P1-1):**
- `web/src/server/modules/team-leaders/team-leader.repository.ts` — `findIsActiveByIds`
- `web/src/server/modules/team-leaders/team-leader.use-cases.ts` — bulk methods capture previousStates

**Effort:** 1-2h. **Risk:** Low.

### P1-2: No client-side authorization check — the "Bulk Deactivate" button is visible to every admin ✅ FIXED 2026-08-24

**File (before fix):** `TeamLeaderBulkBar.tsx` — rendered buttons without checking the admin's role.

**Fix applied 2026-08-24:**

1. `TeamLeaderBulkBar` now accepts a `session: SessionPayload | null` prop. The component computes a `canMutate` flag = `hasPermission(session, 'team_leaders_manage') || hasPermission(session, 'tl_manage')` (the legacy alias is honoured to keep admins with stored `tl_manage` permissions working — same convention as the route handlers).
2. The Activate / Deactivate / Delete buttons are wrapped in `{canMutate && (...)}` so they're hidden for admins without the permission. The Export and Clear buttons stay visible (export is data-only, clear is a UX affordance).
3. When `session === null` (still loading `/api/admin/auth/me`), the buttons are optimistically shown — the server is the source of truth and will 403 any unauthorised click.
4. `TeamLeaderManagement.tsx` now fetches the session once on mount via `fetch('/api/admin/auth/me')` and passes it to the bulk bar. (Same pattern as `AdminSidebar.tsx` / `AdminLayout.tsx`.)

**Files changed (P1-2):**
- `web/src/components/admin/screens/team-leaders/TeamLeaderBulkBar.tsx` — `session` prop, `canMutate` flag, conditional render
- `web/src/components/admin/screens/TeamLeaderManagement.tsx` — session fetch + pass-through

**Effort:** 30 min. **Risk:** Low.

---

## P2 — Cleanup backlog

### P2-1: `useTeamLeaders.ts` is 379 lines — split into `useTeamLeaderList` and `useTeamLeaderMutations` and `useTeamLeaderBulk` ⏭ DEFERRED

The hook owns 3 concerns (list, mutations, bulk + undo). Splitting would let each be testable in isolation. Estimated effort: 4-6h. No user-facing win — deferred.

### P2-2: Stats dialog re-fetches on every open — no client-side cache ✅ FIXED 2026-08-24

**File (before fix):** `useTeamLeaders.ts:289-306` — `viewStats` fires a fresh fetch every time the dialog opens.

**Fix applied 2026-08-24:**

`useTeamLeaders.ts` now keeps a `statsCacheRef: useRef<Map<string, TeamLeaderStatsPayload>>(new Map())`. `viewStats` first checks the cache; on a hit, the payload is returned without a network call. On a miss, the fetch is issued and the result is stored. A new `invalidateStatsCache(ids)` helper drops the affected entries, and `handleBulkAction` calls it after every successful bulk action so a freshly-deactivated TL doesn't show stale stats.

**Files changed (P2-2):**
- `web/src/components/admin/screens/team-leaders/useTeamLeaders.ts` — `statsCacheRef`, cache check in `viewStats`, `invalidateStatsCache` in return, called from `handleBulkAction`

**Effort:** 1h. **Risk:** Low.

---

## Cross-references

- `2026-08-05-team-leaders-operations-fleet.md` — covered the API surface for team-leader operations (pass 3 audit verification). The plan's P0.5 bulk-undo was confirmed implemented.
- `2026-08-05-admin-panel-operations-platform-flows.md` — covered the team-leader screen UI but with a smaller scope than this audit.
- Plan v3 §3.3 (incident assignment Select) — applied the same `hasPermission` gating pattern; this audit recommends the same for team-leader bulk actions.

---

## Implementation record (2026-08-24)

- **Branch:** `fix/team-leaders-audit-2026-08-24`
- **Files changed:** 7
  - `web/src/server/modules/team-leaders/team-leader.repository.ts` (P1-1: `findIsActiveByIds`)
  - `web/src/server/modules/team-leaders/team-leader.use-cases.ts` (P1-1: capture previousStates in bulk methods; P1-1 helper)
  - `web/src/components/admin/screens/team-leaders/TeamLeaderBulkBar.tsx` (P1-2: `session` prop, `canMutate` flag, conditional render)
  - `web/src/components/admin/screens/team-leaders/useTeamLeaders.ts` (P2-2: `statsCacheRef` + `invalidateStatsCache`)
  - `web/src/components/admin/screens/TeamLeaderManagement.tsx` (P1-2: session fetch + pass-through)
  - `web/tests/unit/team-leader-soft-delete-audit.test.ts` (updated existing test to mock `findIsActiveByIds` + expect `previousStates`)
  - `web/tests/unit/team-leaders-audit-2026-08-24.test.ts` (new, 8 tests)
  - `docs/audits/ADMIN_TEAM_LEADERS_AUDIT_2026-08-24.md` (this file — in-place update)
- **Tests:** 8 new, all passing. Full suite: 3,129 pass (was 3,121), 3 pre-existing skipped.
- **TypeScript:** 0 errors related to my changes.
- **Deferred (P2-1):** split `useTeamLeaders` into 3 hooks — medium-risk refactor with no user-facing win.

---

## Pattern note

The team-leaders screen is the **best example of "R3 split" in the admin panel** — the hook is well-organized, the components are focused, the UX is polished (debounce, undo toast, bulk select). Other screens (admin-users, payment-gateway) could learn from this pattern. Specifically:
- The `mountedRef` race-condition guard at `useTeamLeaders.ts:51` is a pattern other hooks should adopt.
- The `lastAction` snapshot + `UndoToast` (5-second window) is a UX pattern that should be reused for the admin-users screen's `toggleActive` action.
- The `EMPTY_LEADER_FORM` constant in `types.ts` is a clean way to reset form state.
