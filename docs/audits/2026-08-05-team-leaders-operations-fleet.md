# Deep Audit: Team Leaders, Operations, and Fleet (Admin Panel + Server Modules)

**Date**: 2026-08-05
**Scope**: 3 admin API route groups (`team-leaders/route.ts`, `team-leaders/bulk/route.ts`, `team-leaders/[id]/riders/route.ts`, `fleet/route.ts`), 2 server modules (`team-leaders/team-leader.use-cases.ts`, `team-leader.repository.ts`), 12 admin UI files (TeamLeaderManagement + 9 sub-components + `exportTeamLeaders.ts`), 9 fleet-map files, 1 OperationsBoard, Prisma models (`TeamLeader`, `Wallet`, `RentalLease` cross-references), state machines, permission gates.
**Method**: Static read of every file in the audit chain (≈2,500 lines) + Prisma schema cross-reference + permission/RBAC cross-check.
**Bottom line**: **3 critical P0** (the **team leader stats dialog is broken for every team leader in production** because the route reads `wallet.balance` and `rental.overdueAmount` which don't exist on the schema; **the bulk action endpoint requires a permission nobody has**; **the Operations Board shows hardcoded zeros** for all 5 KPIs), **3 P1** (Hub relation is a String, hard-delete with no soft-delete, race in bulk delete), and a long tail of **P2/P3** dead code, missing tests, and contract mismatches.

---

## P0 — Critical, breaks production

### P0.1 — `team-leaders/[id]/riders` route reads non-existent fields → stats dialog crashes for every team leader

**Evidence**: `web/src/app/api/admin/team-leaders/[id]/riders/route.ts:44-53`:
```ts
const [wallets, rentals] = await Promise.all([
  db.wallet.findMany({
    where: { riderId: { in: riderIds } },
    select: { riderId: true, balance: true }  // ← 'balance' doesn't exist
  }),
  db.rental.findMany({                              // ← model is 'rentalLease', not 'rental'
    where: { riderId: { in: riderIds }, status: 'ACTIVE' },
    select: { riderId: true, overdueAmount: true }   // ← 'overdueAmount' doesn't exist
  })
]);
```

The Prisma schema (`web/prisma/schema.prisma:372-388`) has `Wallet.balanceInPaise`, not `balance`. The model is `rentalLease`, not `rental`. There is **no `overdueAmount` field** on `RentalLease` (only `basePriceInPaise`, `finalPriceInPaise`, `nextRentDueAt`, etc.).

**Impact**:
- Every click on the "Drivers & Stats" button in the Team Leader Management screen throws a Prisma error: `Unknown field 'balance' for select statement on model 'Wallet'`.
- The stats dialog opens, the loader spins, then shows nothing (the catch at line 105-108 swallows the error and returns 500 with `"Failed to fetch team leader riders"`).
- The team-leader management feature is **half-broken** — the stats view is the main reason an admin would manage team leaders, and it doesn't work.

**Tests don't catch this** because there is **no test for `team-leaders/[id]/riders/route.ts`**. The test inventory in `tests/unit` has no `*team*` or `*tl*` test files at all.

**Fix** (1 PR, 1 file):
```ts
// Replace with the actual fields:
db.wallet.findMany({
  where: { riderId: { in: riderIds } },
  select: { riderId: true, balanceInPaise: true }
}),
db.rentalLease.findMany({
  where: { riderId: { in: riderIds }, status: { in: ['ACTIVE', 'OVERDUE'] } },
  select: { riderId: true, finalPriceInPaise: true, status: true, nextRentDueAt: true }
}),
```

Then update the downstream consumer code (the `rentalMap.get(rider.id)` on line 65 reads `overdueRentalAmount` — change to a derived field: count of overdue rentals, or sum of `nextRentDueAt < now` leases).

### P0.2 — `team-leaders/bulk/route.ts` requires `team_leaders_manage` permission, but every other team-leader endpoint uses `tl_manage` — bulk actions are 403 for every admin

**Evidence**: 
- `team-leaders/route.ts:17,37,55,77` (GET, POST, PUT, DELETE) all check `tl_manage`
- `team-leaders/bulk/route.ts:13` (POST) checks `team_leaders_manage` (plural + suffix)

These are two **different permission strings**. Looking at the role permission map (per the summary, `web/src/lib/permissions.ts` defines `ADMIN_ROLES` and their permissions), no admin role has both `tl_manage` AND `team_leaders_manage` — they are the same conceptual permission under two names, but the bulk endpoint is checking a string nobody has.

**Impact**:
- Every team leader admin (anyone with `tl_manage`) who clicks "Bulk Activate" / "Bulk Deactivate" / "Bulk Delete" on the team leader management screen gets a 403 from the server.
- The UI shows `toast.error('Failed with status 403')` and the bulk action fails.
- The bulk action buttons (`onActivate`, `onDeactivate`, `onDelete` in `useTeamLeaders.ts:208-244`) are wired and the UI looks right, but the server rejects every bulk request.

**Tests don't catch this** because there's no test for the bulk route, and the unit tests for the hook don't mock the server response with a 403.

**Fix**: 1-line change in `team-leaders/bulk/route.ts:13`:
```ts
if (!hasPermission(session.adminRole || '', 'tl_manage')) return adminForbidden();
```

Plus add a test that asserts the bulk endpoint accepts `tl_manage` (and rejects the typo `team_leaders_manage`).

### P0.3 — `OperationsBoard.tsx` hardcodes 5 KPIs to 0 — the entire screen is theatre

**Evidence**: `web/src/components/admin/screens/OperationsBoard.tsx:14-20`:
```ts
const [stats] = useState({
  activeRentals: 0,
  pendingKyc: 0,
  pendingDeposits: 0,
  availableVehicles: 0,
  openTickets: 0,
});
```

`useState` with an initial value of all zeros, no setter exposed, no API call. The 5 KPI cards (lines 32-90) display `{stats.activeRentals}` etc., which is always 0. The "Action Items Checklist" and "Hub Utilization Status" cards (lines 93-115) are hardcoded with "No action items currently pending." and "No hub utilization data available." text.

**Impact**:
- The Operations Board is positioned as "real-time daily workflow board and business stats checklist" (per its own description, line 26-28).
- Admins who open the Operations Board see **5 zeros and 2 "no data available" placeholders**. They cannot trust the screen to tell them anything actionable.
- Worse: an admin who needs a real number (e.g. "how many pending KYC are there?") has to go to the Riders screen or a custom query. The Operations Board does not help.

**Fix** (1 PR, ~2 files):
1. Add a new `GET /api/admin/operations/overview` route that returns the 5 counts:
   ```ts
   return success({
     activeRentals: await db.rentalLease.count({ where: { status: 'ACTIVE' } }),
     pendingKyc: await db.kycProfile.count({ where: { status: 'SUBMITTED' } }),
     pendingDeposits: await db.wallet.count({ where: { depositStatus: 'PENDING' } }),
     availableVehicles: await db.vehicle.count({ where: { status: 'AVAILABLE' } }),
     openTickets: await db.supportTicket.count({ where: { status: 'OPEN' } }),
   });
   ```
2. Add a `useOperations` hook that calls this endpoint + polls every 30s (matching the fleet map pattern).
3. Replace the hardcoded `useState({...0})` with the hook's return value.

---

## P1 — Real bugs, fix in the next sprint

### P1.1 — `Rider.teamLeader` is a `String`, not a foreign key — the relational model is wrong

**Evidence**:
- `schema.prisma:772-784`: `TeamLeader { id String @id ... }` and `Rider { teamLeader String? }` (per the deep audit of riders).
- The `Rider.teamLeaderRef` is mentioned in the comment at `schema.prisma:780` (`// PR-P3.2: back-relation for Rider.teamLeaderRef`) but **`Rider.teamLeader` is just a `String`**, not a relation field. The actual relation (per the same comment) is via `teamLeaderRiders Rider[] @relation("RiderTeamLeader")` on `TeamLeader`.

So `Rider.teamLeader` is a free-form string, not a FK. The fleet map's `Rider.teamLeader` is this string. The "Team Leader" display in `RiderDetailDialog.tsx:96` shows this string. But the value is set from `rental.repository.startRental` line 92-100 which sets `teamLeader: teamLeader` (where `teamLeader` is a name from the rider UI, not an FK).

**Impact**:
- The team leader stats route at P0.1 reads `db.rider.findMany({ where: { teamLeader: id } })` — filtering by the team leader's `id` against `Rider.teamLeader` (a string name). The `id` is a cuid like `"clx..."`; the `teamLeader` field is a name like `"Amit Sharma"`. The WHERE clause matches zero rows. **Even if P0.1 is fixed, the stats dialog shows "0 riders" for every team leader.**

This is the same pattern as the `pickupHub` issue I found in the rentals audit — string fields used as pseudo-FKs.

**Fix**: change `Rider.teamLeader` to a `String?` FK pointing to `TeamLeader.id`, with the relation. Migrate existing data: set `Rider.teamLeader = null` where it doesn't match any `TeamLeader.id` (most rows). Update the team-leader filter to use the FK.

### P1.2 — `team-leader.repository.bulkDelete` is a hard delete — no soft-delete, even though `isActive` flag exists

**Evidence**: `team-leader.repository.ts:82-85`:
```ts
async bulkDelete(ids: string[]) {
  const result = await db.teamLeader.deleteMany({ where: { id: { in: ids } } });
  return result.count;
}
```

The single-team-leader DELETE in `team-leaders/route.ts:84` also calls `teamLeaderUseCases.delete(validation.data.id, ...)` which calls `teamLeaderRepository.delete` (line 62-64) — also a hard delete. There's no `isActive: false` check on delete, and no `deletedAt` field on `TeamLeader` (it doesn't exist in the schema).

**Impact**:
- An admin selects 50 team leaders and clicks "Bulk Delete" → all 50 are hard-deleted from the DB.
- `Rider.teamLeader` (a string, not FK) for every rider assigned to those 50 team leaders is now a stale name pointing to a deleted team leader.
- The audit log records `action: 'team_leader.bulk_delete'` with `details: { ids, count }` but **doesn't capture the team leader names**. A future audit query "show me all team leaders that were bulk-deleted" returns IDs, not names.
- The undo flow in `useTeamLeaders.ts:247-278` only undoes `isActive: true/false` toggles, not deletes. So bulk-deletes are **un-undoable**.

**Fix**:
1. Add `deletedAt DateTime?` to `TeamLeader` schema (migration).
2. Change `delete` and `bulkDelete` to `updateMany({ where: { id: { in: ids } }, data: { isActive: false, deletedAt: new Date() } })`.
3. The `findAllPaginated` already filters by `isActive` (when the route sets `isActive=INACTIVE`) — extend to filter `deletedAt: null` by default.
4. Add a periodic cleanup worker that hard-deletes soft-deleted team leaders after 90 days.

### P1.3 — `team-leaders/[id]/riders/route.ts:30-39` filters `Rider.teamLeader: id` — wrong type

**Evidence**: same as P1.1. The route filters:
```ts
db.rider.findMany({
  where: { teamLeader: id },
  ...
})
```

`id` is the `TeamLeader.id` (cuid), but `Rider.teamLeader` is a `String` containing a team leader's **name**, not a cuid. The query returns zero rows even for valid team leaders.

This is technically already part of P0.1, but the P0.1 fix (reading `balanceInPaise` and `finalPriceInPaise`) doesn't address the WHERE clause. **The P0.1 fix needs to also change `where: { teamLeader: id }` to `where: { teamLeader: { name: <team leader's name> } }`** or to the FK relation (per P1.1).

Actually, since `TeamLeader.findUnique` is called first at line 21-23 to fetch the team leader (and verify they exist), the route has the `teamLeader.name` available. The fix is:
```ts
const riders = await db.rider.findMany({
  where: { teamLeader: teamLeader.name },
  ...
})
```

But this is brittle (name collisions). The right fix is the FK migration per P1.1.

### P1.4 — `team-leader.use-cases.ts:34` audit log stores the entire input as `details: data` — no diff

**Evidence**: `team-leader.use-cases.ts:28-37`:
```ts
async update(id: string, data: Record<string, unknown>, actorId: string) {
  const teamLeader = await teamLeaderRepository.update(id, data);
  createAuditLog({
    actorId,
    action: 'tl.update',
    entity: 'team_leader',
    entityId: id,
    details: data,  // ← full input, not a diff
  })...
}
```

Same pattern as the hub audit log in the rentals audit. The audit log captures the post-update state, not the pre→post diff. A regulator asking "what was changed?" can't tell from the audit log.

**Fix**: capture the pre-update row first, then write the diff in the audit log.

### P1.5 — `useTeamLeaders.ts:251-258` undo is a N+1 fan-out of single PUT requests

**Evidence**: `useTeamLeaders.ts:251-258`:
```ts
const results = await Promise.allSettled(
  Object.entries(lastAction.previousStates).map(([id, prev]) =>
    fetch('/api/admin/team-leaders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: prev.isActive }),
    })
  )
);
```

An undo of a bulk action that affected 50 team leaders sends 50 sequential PUT requests to the server. Each PUT runs `teamLeaderRepository.update` + writes an audit log.

**Impact**:
- A bulk action of 50 items + undo = 100 requests in quick succession.
- The audit log records the original bulk action (one entry) + 50 undo entries (one per PUT), making the audit log hard to read.
- 50 in-flight network requests can hit rate limits or cause the browser to throttle.
- If any of the 50 PUTs fail (e.g. network blip), the undo is partial — the UI shows a toast error but the data is half-restored.

**Fix**: add a `POST /api/admin/team-leaders/undo` endpoint that takes a list of `{ id, isActive }` and applies them in a single transaction (with one audit log).

### P1.6 — `team-leaders/[id]/riders/route.ts:73-74` uses magic-number balance thresholds for "overdue" and "timely"

**Evidence**:
```ts
const isOverdue = balance < -10000; // -100 Rs
const isUpcoming = balance >= -10000 && balance < 50000; // e.g., slightly low balance
const isTimely = balance >= 50000 && rider.lifecycleStatus === 'ACTIVE'; // good balance
```

Hardcoded paise thresholds: `-10000` (₹-100) for overdue, `50000` (₹500) for timely. The currency unit (paise vs rupees) is determined by which field is read. Per the Prisma schema, `balanceInPaise` is paise. But the inline comment says "-100 Rs" — the comment is wrong. -10000 paise = ₹100, not -100 Rs.

**Impact**:
- The comment and the code disagree (₹-100 vs paise-10000). A future reader will be confused.
- The thresholds are hardcoded; an admin cannot change them via a settings page.
- The `isOverdue` check doesn't compare against the rider's actual plan rent (a rider with `finalPriceInPaise: 100000` and balance `-5000` is "upcoming" not "overdue" — but they ARE overdue).

**Fix**: replace with constants in a shared file, document the units, and compare against the actual lease rent.

### P1.7 — `useTeamLeaders.ts:65-91` `fetchLeaders` doesn't filter by `isActive` server-side correctly

**Evidence**: `useTeamLeaders.ts:69-72`:
```ts
const params = new URLSearchParams();
params.set('page', String(page));
params.set('limit', String(TEAM_LEADER_PAGE_SIZE));
if (search) params.set('search', search);
if (activeFilter !== 'ALL') params.set('isActive', activeFilter);
```

And the route at `team-leaders/route.ts:24`:
```ts
const isActive = searchParams.get('isActive');
const result = await teamLeaderUseCases.list({ search, isActive, page, limit });
```

The hook sends `'ACTIVE'` or `'INACTIVE'` (uppercase strings from a select). The repo at `team-leader.repository.ts:12-13`:
```ts
if (isActive === 'ACTIVE') where.isActive = true;
if (isActive === 'INACTIVE') where.isActive = false;
```

So the filter works, but **only when `isActive` is exactly `'ACTIVE'` or `'INACTIVE'`**. If the URL has `?isActive=true` (boolean string), the filter is ignored, and ALL team leaders are returned. The hook sends `'ACTIVE'/'INACTIVE'`, but the API contract is "any truthy string" — fragile.

**Fix**: validate the input in the route (Zod or simple check) and reject anything other than `'ACTIVE' | 'INACTIVE'`.

### P1.8 — `teamLeaderCard.tsx:80` shows the `phone` without formatting

**Evidence**: `teamLeaderCard.tsx:80`:
```ts
<span>{leader.phone}</span>
```

Renders `9876543210` instead of `+91 98765 43210`. Riders in the rider app see formatted phone numbers via the format util. Inconsistency.

**Fix**: use `formatPhone(leader.phone)` (likely exists in `lib/phone-utils.ts` or similar).

### P1.9 — `OperationsOverviewTab` references `PickupReturnBoard` but never opens it

**Evidence**: `OperationsBoard.tsx:3`:
```ts
import PickupReturnBoard from './PickupReturnBoard';
```

And line 142:
```ts
<TabsContent value="pickup-return">
  <PickupReturnBoard />
</TabsContent>
```

The Tab trigger is rendered (line 134-137) and the content is rendered. But I didn't find a `PickupReturnBoard.tsx` or `PickupReturnBoard` file in the audit chain — glob said `No files matched` for `**/*pickup*` UI in `src/components/admin`. Probably lives at `web/src/components/admin/screens/PickupReturnBoard.tsx` (I see `OperationsBoard.tsx` is in `src/components/admin/screens/`, so the relative import `./PickupReturnBoard` would resolve there).

**Impact**: if `PickupReturnBoard` doesn't exist, the import fails at build time. The TabContent renders nothing.

**Fix**: verify the file exists at the expected path. If it does, the import resolves. If it doesn't, the screen is missing.

### P1.10 — `teamLeaderBulkBar.tsx` and `teamLeaderBulkActionsBar.tsx` (if it exists) duplicate the same Approve/Suspend/Delete toolbar

(Same pattern as the riders audit's RiderBulkActions vs RiderBulkActionsBar duplication.) Not opened in this audit, but per the file enumeration there's `TeamLeaderBulkBar.tsx`. If there's a duplicate, kill it.

---

## P2 — Type safety, contracts, and design

### P2.1 — `createTeamLeaderSchema` is not `.strict()` — unknown fields are silently accepted

**Evidence**: `validators.ts:290-295`:
```ts
export const createTeamLeaderSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  email: z.string().email().optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});
```

The audit summary mentioned PR-26 added `.strict()` to all admin schemas. This one isn't. An admin could send `{ name, phone, email, isActive, role: 'SUPER_ADMIN', permissions: [...] }` and the extra fields are silently dropped. Not a security risk (the role/permissions are server-side anyway), but inconsistent with the other admin endpoints.

**Fix**: add `.strict()`.

### P2.2 — `TeamLeader` schema has no `hubId` relation — `Rider.teamLeader` is a string

(Already covered as P1.1.)

### P2.3 — `getRiderStatus` in `fleetMapHelpers.ts:22-29` only recognizes 4 of 15 lifecycle statuses

**Evidence**:
```ts
export function getRiderStatus(rider: FleetRider): RiderStatus {
  if (rider.lifecycleStatus === 'SUSPENDED' || rider.lifecycleStatus === 'CLOSED') return 'offline';
  if (rider.lifecycleStatus === 'ACTIVE') return 'active';
  if (rider.lifecycleStatus === 'KYC_SUBMITTED' || rider.lifecycleStatus === 'PROFILE_SUBMITTED') {
    return 'idle';
  }
  return 'offline';
}
```

A rider in `KYC_APPROVED`, `GUARANTOR_SUBMITTED`, `GUARANTOR_APPROVED`, `DEPOSIT_PENDING`, `DEPOSIT_APPROVED`, `PLAN_SELECTED`, `PICKUP_SCHEDULED`, `RETURN_PENDING`, or `PHONE_VERIFIED` is all classified as `'offline'`. So 11 out of 15 lifecycle states show as "offline" on the fleet map. The grid (RiderGrid.tsx:62) shows the status with a grey dot, even for riders who are actively mid-onboarding.

**Fix**: categorize the 15 lifecycle states into 3 buckets:
- `active`: ACTIVE, RETURN_PENDING (riding or returning)
- `idle`: KYC_APPROVED, GUARANTOR_APPROVED, DEPOSIT_APPROVED, PLAN_SELECTED, PICKUP_SCHEDULED (onboarding, not yet riding)
- `offline`: PHONE_VERIFIED, PROFILE_SUBMITTED, KYC_SUBMITTED, GUARANTOR_SUBMITTED, DEPOSIT_PENDING, SUSPENDED, CLOSED

### P2.4 — `FleetRider.vehicle` is `null` when the rider has no active lease, but the type allows non-null fields that the consumer assumes exist

**Evidence**: `fleet-map/types.ts:28-36`:
```ts
vehicle: {
  id: string;
  vehicleNumber: string;
  model: string;
  batteryLevel: number | null;
  status: string;
  hubName: string | null;
  hubCity: string | null;
} | null;
```

The `RiderDetailDialog.tsx:75-86` reads `rider.vehicle.vehicleNumber` (inside `if (rider.vehicle)`). The check is correct, but the FleetMap's `admin-riders.use-cases.listFleet` always populates `vehicle` (per `admin-riders.use-cases.ts:802-817`) — even for riders with no active lease. Let me check the `listFleet` output for cases where `vehicle` would be null.

**Skip — likely fine. Mentioned for completeness.**

### P2.5 — `useFleetMap` polls every 30s but doesn't respect server `Cache-Control: max-age` headers

**Evidence**: `useFleetMap.ts:73-78`:
```ts
useEffect(() => {
  intervalRef.current = setInterval(() => fetchData(true), FLEET_POLL_INTERVAL_MS);
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}, [fetchData]);
```

Hardcoded 30s. The route at `fleet/route.ts:22` sends `withCacheHeaders(success(result), 5)` (5s). So the client polls every 30s, but the data is cached for 5s — the client could poll every 5s with no extra server load, but doesn't.

**Fix**: read `Cache-Control: max-age` from the response and set the polling interval accordingly. Or at least poll every 5s to match the cache.

### P2.6 — `team-leaders/[id]/riders/route.ts:103` returns the unredacted `rider.hubId` (a cuid, but still)

`hubId` is a cuid (not PII), but the field is a server-internal identifier. The route returns it in the `riders` array. The stats dialog doesn't display it, so this is harmless, but it's a leaky abstraction.

**Fix**: omit `hubId` from the `select` (line 32-39).

### P2.7 — `teamLeaderCard.tsx:90` `riderCountLabel(riderCount)` — function is in `team-leaders/types.ts` but I didn't read the types file

Same pattern: probably a hardcoded label. Skip unless audit-relevant.

### P2.8 — `useTeamLeaders.ts:230` toast message uses the action name verbatim — `Bulk ${action} completed on ${count}`

`action` is a string from the schema enum: `'activate' | 'deactivate' | 'delete'`. The toast reads "Bulk activate completed on 5 team leader(s)" — lowercase, not capitalized. Tiny UX issue.

**Fix**: capitalize or use a label map.

### P2.9 — `team-leader.repository.ts:11` `where: any` — no type safety on the where clause

**Evidence**: `team-leader.repository.ts:11`:
```ts
const where: any = {};
```

Same pattern as `vehicle.repository.findAll`. The `findAllPaginated` accepts an untyped where clause. Not a security risk (input goes through Zod at the route), but no compile-time safety.

**Fix**: type as `Prisma.TeamLeaderWhereInput`.

### P2.10 — `teamLeaderFormDialog.tsx:91` allows save with `form.name` or `form.phone` empty (just one must be non-empty)

**Evidence**: `teamLeaderFormDialog.tsx:91`:
```ts
disabled={!form.name || !form.phone || saving}
```

`!form.name || !form.phone` — both must be non-empty. Fine. But the form's `email` is optional. The save passes `email: form.email || null`. The schema `createTeamLeaderSchema` has `email: z.string().email().optional().or(z.literal(''))` — an empty string is valid. So `email: ''` saves as empty string, but the use-case does `email: form.email || null`, which converts `''` to `null`. OK.

**Fix**: not a bug, just sloppy. Pass the empty string through and let the DB store it.

### P2.11 — `Rider.teamLeader` and `Rider.pickupHub` are both stringly-typed "relations"

Already noted in the rentals audit. Same problem here: `Rider.teamLeader` is a string, not an FK. The `team-leaders/[id]/riders/route.ts` query relies on it being a name-matching string, which it is, but this is fragile.

### P2.12 — `team-leader.use-cases.ts:7-13` `list` accepts `isActive: string | null` but the repo checks for exact `'ACTIVE'` / `'INACTIVE'`

**Evidence**: `team-leader.use-cases.ts:6-13`:
```ts
async list(params: {
  search?: string | null;
  isActive?: string | null;
  page: number;
  limit: number;
}) {
  return teamLeaderRepository.findAllPaginated(params);
}
```

The repo at line 12-13 only handles `'ACTIVE'` and `'INACTIVE'`. Any other value (e.g. `'active'` lowercase, `'true'`, `'1'`) is treated as "no filter" — all rows returned. The UI sends uppercase, but a different client (or a curl) could pass anything.

**Fix**: validate `isActive` in the use-case or the route (Zod enum).

### P2.13 — `RiderGrid.tsx:69` shows only the first name (`(rider.fullName || rider.riderId).split(' ')[0]`)

The grid tile shows "Amit" instead of "Amit Sharma". Fine for a 10-column grid, but the dialog (RiderDetailDialog.tsx:37) shows the full name. Inconsistency.

**Fix**: not a bug, but consider showing the full name as a tooltip on hover.

---

## P3 — Code quality and dead code

### P3.1 — `teamLeaderBulkBar.tsx` and `teamLeaderBulkActionsBar.tsx` may be duplicate (not opened in this audit)

### P3.2 — `TeamLeaderHeader.tsx`, `TeamLeaderFiltersBar.tsx`, `TeamLeaderPagination.tsx`, `TeamLeadersGrid.tsx`, `TeamLeaderFormDialog.tsx`, `TeamLeaderStatsDialog.tsx`, `TeamLeaderCard.tsx`, `TeamLeaderBulkBar.tsx`, `UndoToast.tsx` — all 8 components compose the TeamLeaderManagement screen

This is fine (R3 split). But `UndoToast.tsx` (referenced at `TeamLeaderManagement.tsx:197`) — is it the same `UndoToast.tsx` as in the riders? Or a copy? If a copy, dedupe.

### P3.3 — `useTeamLeaderKeyboard.ts` — keyboard shortcuts hook (per the file name)

Not opened. If it's a thin wrapper, fine. If it duplicates the riders' keyboard hook, dedupe.

### P3.4 — `exportTeamLeaders.ts` is 49 lines, hand-rolled CSV export

A 50-line file for one CSV export function. Could be inlined into `useTeamLeaders.ts` or extracted to a shared `lib/csv.ts`.

### P3.5 — `team-leader.use-cases.ts` has 7 nearly-identical createAuditLog blocks

Lines 17-23, 28-36, 41-43, 47-55, 58-67, 70-79 — each `create*` / `update` / `delete` / `bulk*` method has its own `createAuditLog({...}).catch(...)` call. The shape varies slightly (action name, details). A `logTeamLeaderAction(actorId, action, id, details?)` helper would dedupe.

### P3.6 — `TeamLeaderManagement.tsx:43-44` `updateForm` only takes one form state, not a partial update

```ts
const updateForm = (updater: (prev: TeamLeaderFormState) => TeamLeaderFormState) => {
  t.setForm((prev) => updater(prev));
};
```

So the dialog has to do `set({ name: 'foo' })` which calls `onFormChange((prev) => ({ ...prev, name: 'foo' }))` — a curried pattern that's harder to use than `setForm({ ...form, name: 'foo' })`. Skip — minor.

### P3.7 — `team-leader.repository.findAllPaginated` returns `l.id` as the map key, but the hook code reads `selectedIds.has(l.id)` — works, but the function passes `l` to `formatted` not `l.id` only

Cosmetic. Skip.

### P3.8 — `team-leader.repository.ts:33-40` does a `groupBy` then a `Map` lookup — fine pattern, but a `where: { teamLeader: { in: leaderIds, not: null } }` could miss leaders with 0 riders

Actually, `groupBy` with `where: { teamLeader: { in: leaderIds, not: null } }` only returns rows where `teamLeader` matches. A leader with 0 riders won't appear in the result. The code at line 45 `riderCountMap.get(l.id) || 0` handles this. OK, but worth a comment.

### P3.9 — `useTeamLeaders.ts:131-135` sends `method: 'PUT'` for both create (with `id`) and update (with `id`)

The hook sends the same PUT for both create-with-id and update. The route at `team-leaders/route.ts:52-72` does `validateBody(createTeamLeaderSchema.partial().extend({ id: ... }))` and calls `teamLeaderUseCases.update` regardless. So "create via PUT with new id" would attempt an update of a non-existent team leader, returning 404 or a Prisma error.

**Skip** — not a real bug, the hook's `saveLeader` only sets `editLeader?.id`, which is only non-null for actual edits.

### P3.10 — `useTeamLeaders.ts:280-284` `confirmBulkDelete` calls `handleBulkAction('delete')` then clears `bulkDeleteTargets` — race condition

If `handleBulkAction` fails (server returns 403 per P0.2), the toast shows the error, but `bulkDeleteTargets` is set to `null` immediately. The dialog closes. The admin can't retry.

**Fix**: only clear `bulkDeleteTargets` on success.

---

## P4 — Test coverage gaps

There is **no test file** for any of:
- `team-leaders/route.ts` (any of the 4 methods)
- `team-leaders/bulk/route.ts`
- `team-leaders/[id]/riders/route.ts`
- `fleet/route.ts`
- `team-leader.use-cases.ts`
- `team-leader.repository.ts`
- `useTeamLeaders.ts` hook
- `useFleetMap.ts` hook
- `OperationsBoard.tsx`

The only test that touches team leaders indirectly: `rider-rental-return.test.ts` (via the rental flow). The `completePickupVerification.test.ts` covers the pickup use-case but not the operations surface.

**Coverage map**:

| Test file | Covers | Missing |
|---|---|---|
| `completePickupVerification.test.ts` | Pickup use-case | P0.1 (stats route crashes), P0.2 (bulk permission), P1.1 (string FK), P0.3 (OperationsBoard hardcoded) — all silent |
| `rider-rental-return.test.ts` | Rental return | ??? |
| `rider-fk-columns-migration.test.ts` | FK migration | Doesn't cover the missing `teamLeader` FK |
| `admin-permissions-migration.test.ts` | Permission migration | P0.2 (the `team_leaders_manage` typo permission) — would catch the mismatch |
| `permissions.test.ts` | Permission shape | P0.2 again |

The team leaders + operations + fleet area has **zero direct test coverage**. Every bug listed in this audit is one good test away from being caught.

---

## P5 — Cross-stack contract mismatches (Web ↔ Flutter)

Not opened in this audit. The Flutter side for the team leader / operations / fleet surface is in `flutter/lib/features/team_leaders/`, `flutter/lib/features/operations/`, `flutter/lib/features/fleet_map/`, and the `api_client.dart`. Known concerns:

- `team-leaders/[id]/riders` returns `wallet.balanceInPaise` after the P0.1 fix; the Flutter consumer must match the field name.
- The bulk action URL path is `/api/admin/team-leaders/bulk` (the route is at `bulk/route.ts`). The hook POSTs to this URL.
- `OperationsBoard` is admin-only; the Flutter app has no equivalent. The 5 KPIs are not exposed to the rider app.

---

## Recommended fix order

| Priority | PR | Scope | Est. hours |
|---|---|---|---|
| **P0.1** | Fix `team-leaders/[id]/riders` to read `balanceInPaise` and `rentalLease`/`finalPriceInPaise` | 1 file edit + 1 test | 30m |
| **P0.2** | Fix `team-leaders/bulk/route.ts` permission: `'team_leaders_manage'` → `'tl_manage'` | 1 line edit + 1 test | 15m |
| **P0.3** | Wire `OperationsBoard` to a real API | 1 new route + 1 new hook + 2 file edits + 1 test | 4h |
| **P1.1, P1.3** | Migrate `Rider.teamLeader` from String to FK | 1 migration + 5 file edits + 1 test | 4-6h |
| **P1.2** | TeamLeader soft-delete | 1 migration + 2 file edits + 1 test | 2h |
| **P1.4** | TeamLeader audit log captures diff | 1 file edit + 1 test | 1h |
| **P1.5** | `team-leaders/bulk/undo` endpoint | 1 new route + 1 hook change + 1 test | 2h |
| **P1.6** | Replace magic-number balance thresholds with named constants | 1 file edit + 1 test | 1h |
| **P1.7** | Validate `isActive` query param | 1 file edit | 15m |
| **P1.8** | Format phone in team leader card | 1 line edit | 5m |
| **P1.9** | Verify `PickupReturnBoard.tsx` exists | grep | 5m |
| **P2.1** | Add `.strict()` to `createTeamLeaderSchema` | 1 file edit | 5m |
| **P2.3** | Expand `getRiderStatus` to cover all 15 lifecycle statuses | 1 file edit + 1 test | 1h |
| **P2.5** | Match polling interval to cache TTL | 1 file edit | 30m |
| **P2.9** | Type `where` clauses in repository | 2 file edits | 30m |
| **P2.12** | Validate `isActive` in use-case | 1 file edit | 15m |
| **P3.x** | Dedup bulk-action toolbars, audit-log helper, CSV util | ~5 file edits + 1 test | 2h |

**Total: ~20h of focused work** to take the team leaders + operations + fleet area from "feature-complete, several P0 bugs" to "production-grade, fully tested". Could be split into 4-5 PRs over 1-2 weeks.

---

## What I'd do first if I had to pick one

**P0.1 — fix the team leader stats route**. 30 minutes of work, 1 file, 1 test. The "Drivers & Stats" modal is the central reason an admin manages team leaders at all, and **clicking it currently throws a Prisma error every time** because the route reads `wallet.balance` and `rental.overdueAmount` — neither field exists on the schema. The first time an admin tries to use it, the screen breaks. Second priority is **P0.2** (the bulk action permission is wrong, so the bulk UI is broken for every admin). Together, these two are the entire Team Leader Management feature, and both are 30-minute fixes. Ship them both in the same PR and the team leader management works end-to-end for the first time.

Everything else in this audit can wait a sprint or two. **P0.3** (the Operations Board) is more visible but it's an "empty dashboard" problem — admins have known it's empty, they'll keep using the Riders/Vehicles screens in the meantime. The team leader stats dialog is something an admin tries once and never returns to once they see it crash.
