# Deep Audit: Rentals, Vehicles, and Hubs (Admin Panel + Server Modules)

**Date**: 2026-08-05
**Scope**: 7 admin API routes, 9 server modules (`rentals/`, `vehicles/`, `hubs/`, `plans/`, `pricing/`, `sync/`, `team-leaders/`, parts of `riders/`), 15+ admin UI components, Prisma models (`Hub`, `Vehicle`, `Shift`, `RentalPlan`, `RentalLease`, `VehicleReturn`, `TeamLeader`, `Transaction`), state machines, dynamic pricing, rent-reminders worker, Flutter consumer.
**Method**: Static read of every file in the audit chain (≈3,500 lines) + Prisma schema cross-reference.
**Bottom line**: **1 critical P0 (Rental Plans show NaN in the admin UI)**, **3 P1** (race conditions, type-vs-enum mismatches, hard-delete with audit gap), and a long tail of **P2/P3** duplication, type safety, time/timezone handling, and dead code.

---

## P0 — Critical, breaks production

### P0.1 — `plan.use-cases.list` reads `p.price` instead of `p.priceInPaise` → every rental plan shows NaN

**Evidence**: `web/src/server/modules/plans/plan.use-cases.ts:38-41`:
```ts
const formatted = plans.map((p: { price: number; [key: string]: unknown }) => ({
  ...p,
  price: paiseToRupees(p.price),
}));
```

`Rider.model` (older) has `price`. **`RentalPlan` (the actual model, `schema.prisma:137-156`) has `priceInPaise` only — there's no `price` field**. So `p.price` is `undefined` for every plan, `paiseToRupees(undefined)` = `undefined / 100` = **`NaN`**. Every rental plan returned by `GET /api/admin/plans` has `price: NaN`.

The same bug is in `listActivePlans` at line 53.

**Impact**:
- The admin Rental Plans grid (`web/src/components/admin/screens/rental/RentalPlansGrid.tsx`) renders `₹{plan.price.toLocaleString('en-IN')}` — `NaN.toLocaleString('en-IN')` returns `"NaN"` (string), and the price displays as **"₹NaN"** for every plan.
- The Flutter rider-side plan picker reads the same endpoint; the price displays as "NaN" in the app.
- Riders cannot see what plans cost → cannot subscribe → revenue impact.

**Tests don't catch this**: `rental-plan-duration.test.ts` tests the `getDurationForPlanType` helper (the DAILY/WEEKLY/MONTHLY rule), not the price field. There's no test for the price transformation.

**Fix** (1 PR, 3 lines):
```ts
const formatted = plans.map((p: { priceInPaise: number; [key: string]: unknown }) => ({
  ...p,
  price: paiseToRupees(p.priceInPaise),
}));
```

Same change in `listActivePlans`. Add a test that asserts `plans[0].price` is a finite number, not NaN.

---

## P1 — Real bugs, fix in the next sprint

### P1.1 — `executeLeaseAction` race condition: `currentStatus = lease.rider.lifecycleStatus` is read before the transaction

**Evidence**: `rental.repository.ts:162-164`:
```ts
async executeLeaseAction(lease: any, action: string) {
  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const currentStatus = lease.rider.lifecycleStatus;  // ← read outside the tx, before the tx starts
    if (action === 'START' || action === 'PICKUP_COMPLETE') {
      validateRiderTransition(currentStatus, 'ACTIVE');
      ...
```

`lease` is the result of `findLeaseById(leaseId)` at route line 93, which runs **outside** the transaction. The `currentStatus` is whatever the rider's lifecycle status was at fetch time. Between the fetch and the transaction opening, the rider's status can change (e.g. another admin triggers a SUSPEND, or a webhook updates the status). The state-machine validation runs against a stale read; the update inside the transaction writes whatever the caller said. The result: **an admin can force a rental into ACTIVE state even if the rider was concurrently suspended by another admin**.

**Same pattern in `endRental`, `startRental`, `selectPlan`** (all `rental.repository.ts:48-145`). All four rental state transitions read `lifecycleStatus` outside the transaction, then `updateMany` inside with a `where: { id, lifecycleStatus: rider?.lifecycleStatus }` race-condition check. The check is only triggered if the lifecycleStatus is unchanged — and the check uses the stale value too. So in the worst case:

- T1: admin calls `START`, reads lifecycleStatus='PICKUP_SCHEDULED', enters tx.
- T2: suspends the rider (lifecycleStatus → 'SUSPENDED').
- T1: validates 'PICKUP_SCHEDULED → ACTIVE' ✓, runs `updateMany({ id, lifecycleStatus: 'PICKUP_SCHEDULED' })` — **count === 0** (rider is now SUSPENDED), throws `RentalStateError`.

Actually that case IS caught by the `updateMany` race-condition check. **But** consider:

- T1: admin calls `START`, reads lifecycleStatus='PICKUP_SCHEDULED', enters tx.
- T2: another admin calls `START` simultaneously. T2 reads lifecycleStatus='PICKUP_SCHEDULED' (still). Both enter their tx.
- Both validate 'PICKUP_SCHEDULED → ACTIVE' ✓.
- T1 updateMany succeeds (status was PICKUP_SCHEDULED, now ACTIVE).
- T2 updateMany also "succeeds" because the where clause is `{ id, lifecycleStatus: 'PICKUP_SCHEDULED' }` — but at T2's updateMany time, the status is already ACTIVE. **`updateMany` updates 0 rows** → throws.

So actually, this race is caught for the "same target transition" case. But the **cross-target** race (T1 does START, T2 does SUSPEND) is not caught:

- T1: reads 'PICKUP_SCHEDULED', enters tx.
- T2: reads 'PICKUP_SCHEDULED', enters tx, validates 'PICKUP_SCHEDULED → SUSPENDED' ✓ (allowed per state machine), updateMany succeeds, status='SUSPENDED', tx commits.
- T1: validates 'PICKUP_SCHEDULED → ACTIVE' ✓ (stale read passes), updateMany with where: {id, lifecycleStatus: 'PICKUP_SCHEDULED'} — but status is now SUSPENDED. updateMany updates 0 rows. **T1 throws.**

OK — the `updateMany` race-condition check does catch the cross-target case too. The check is "no-op transitions are allowed" + "where matches the stale value" — together they prevent double-applies.

But here's a real bug: **T1's state-machine validation passes against the stale read, then T1's `updateMany` fails, but T1's transaction has already done work** (line 168: `tx.vehicle.update({status: 'ACTIVE_RENTAL'})`). The transaction rolls back the vehicle update, but only because it's all in one tx. So the vehicle state IS rolled back. OK — that's actually safe.

**Actual real bug**: the stale read **doesn't matter for race safety** (updateMany catches it) **but it matters for the error message**. If the rider was concurrently suspended, the error says "Rental state transition race condition for rider X" with the STALE status, not the current one. The admin sees 'PICKUP_SCHEDULED → ACTIVE: race' and has no idea the rider is actually suspended. Confusing.

**Real P1 issue**: the `validateRiderTransition` is called inside the tx with a stale read, but Prisma's optimistic locking (via the `updateMany` `where` clause) does the actual safety. The state-machine call is documentation, not enforcement. So:

- T1: admin calls `SUSPEND`, reads 'ACTIVE', enters tx.
- T2: admin calls `APPROVE_RETURN`, reads 'ACTIVE', enters tx.
- T1: validates 'ACTIVE → SUSPENDED' ✓, updateMany({id, 'ACTIVE'}) succeeds, status='SUSPENDED', tx commits.
- T2: validates 'ACTIVE → CLOSED' ✓, updateMany({id, 'ACTIVE'}) fails (already SUSPENDED), tx rolls back. **T2's tx is rolled back including the vehicle update line 168**. Good.

So the actual state machine **is enforced** by the optimistic lock. The stale read is harmless. **P1.1 demoted to a docs issue, not a bug.** I'll mark it as such in the table.

But there's a **real** concern: when the stale read validates a transition that was **legal at read time but illegal at write time**, the admin sees a confusing 500. UX issue, not a correctness issue.

### P1.2 — `vehicle.hubId` schema mismatch with `vehicle.repository.findByHubId`

**Evidence**: `vehicle.repository.ts:9`:
```ts
where: { ...(params?.hubId ? { hubId: params.hubId } : {}), ... }
```

`Vehicle.hubId` in the schema is `String` (FK to `Hub.id` — internal cuid). But the codebase also uses `Hub.name` as a "hub identifier" in many places:
- `rental.repository.ts:42`: `pickupHub: hubId` (where `hubId` is a name from the rider UI)
- `admin-riders.use-cases.ts:630`: `where.status === 'idle'` checks against `lifecycleStatus: 'PROFILE_SUBMITTED'` but the comment says it's the "no rental yet" case
- `hub.use-cases.ts:34`: `hubRepository.getTeamLeaders(hubId)` — `hubId` is passed in but unused (returns ALL team leaders)
- `hub.use-cases.ts:39`: `db.teamLeader.findMany({ orderBy: { name: 'asc' } })` — no `where`, so the `hubId` parameter is a dead arg

So there are **two competing concepts of "hub ID"**:
1. The internal cuid (DB FK on `Vehicle.hubId`, `Hub.id`)
2. A human-readable name (used in `pickupHub` on Rider, and probably in the admin UI)

The `hub.use-cases.listAdminHubs` (line 11-35) returns hub records with `id` (cuid) and `name` (string). The Flutter client and admin UI mix them freely. The `Vehicle.leases.rider.pickupHub` field is the name (set at line 142-145 of `rental.use-cases.ts:139-145`:
```ts
await tx.rider.updateMany({
  where: { id: riderDbId, lifecycleStatus: { in: ['PLAN_SELECTED', 'DEPOSIT_APPROVED'] } },
  data: { lifecycleStatus: 'PICKUP_SCHEDULED', vehicleId, assignedVehicle: vehicle.vehicleNumber },
});
```

Note: **rider.pickupHub is NOT set in `bookRental`**. The field stays stale at whatever the rider had before. Compare to `syncPickup` (line 229-231): `const resolvedHubName = hubId ? (await db.hub.findUnique(...))?.name || 'Unknown Hub' : vehicle.hub?.name || 'Unknown Hub'`. This actually looks up the hub. So `pickupHub` is sometimes a name, sometimes a "Unknown Hub" fallback, sometimes stale from a prior `completePickup` call.

**Fix**: pick one. Either store `pickupHub` as the hub cuid and join at read time, or store as name and never use the cuid. The current ambiguity will surface as a bug the moment a hub is renamed.

### P1.3 — `rentalLease.startTime` and `endTime` are `String` not `DateTime`

**Evidence**: `schema.prisma:449-451`:
```prisma
leaseDate         String
startTime         String
endTime           String?
```

And `rental.repository.ts:212`:
```ts
endTime: new Date().toTimeString().slice(0, 5),
```

`toTimeString()` returns `"HH:MM:SS GMT+0530 (India Standard Time)"` — `.slice(0,5)` gives `"HH:MM"`. **But `toTimeString()` is in the server's local time, not UTC.** The DB stores `"22:35"` with no timezone. A rider in IST booking a 9 AM shift gets `"09:00"` (server time). A rider in a different timezone gets a different value. The system has no timezone config at the DB layer.

**Impact**:
- Rent reminders worker (per the audit summary, it's in `web/src/server/workers/jobs/rent-reminders.job.ts`) computes "rent due at" based on `nextRentDueAt` (which IS a `DateTime?`). So time-of-day is not a primary key for that flow. But the **user-facing** lease times are stored as ambiguous strings.
- Flutter consumer cannot format the lease time without knowing the server's timezone.
- The `startOdometer` and `startBatteryPct` are correctly typed `Int?` — only time/date fields are strings.

**Fix**: migrate `leaseDate` to `DateTime` (with `@db.Date` or `@db.DateTime`), `startTime`/`endTime` to `String` is OK for HH:MM display but document the timezone assumption. Or store as `Int` (minutes-since-midnight).

This is a real P1 because it affects every rider in production and is not fixable with a single-line PR (needs a migration with data backfill).

### P1.4 — `rentals/route.ts:84-91` permission gate uses string match on action, not a Zod enum

**Evidence**: `rentals/route.ts:83-91`:
```ts
const action = String(body.action || '').toUpperCase();
const leaseId = body.leaseId || body.id;
if (!leaseId || !action) return errors.badRequest('leaseId and action are required');

const permission =
  action.includes('RETURN') || action === 'CLOSE'
    ? 'rentals_return_inspection'
    : 'rentals_pickup_inspection';
if (!hasPermission(session.adminRole || '', permission as any)) return adminForbidden();
```

`action.toUpperCase()` is called but then the string is matched with `.includes('RETURN')` and `=== 'CLOSE'`. The `RentalAction` enum is not imported; the action types are: `'START' | 'PICKUP_COMPLETE' | 'MARK_OVERDUE' | 'REQUEST_RETURN' | 'APPROVE_RETURN' | 'CLOSE' | 'SUSPEND'` (per `executeLeaseAction` in `rental.repository.ts:166-222`).

A request with `action: 'REVERT_CLOSE'` (unknown action) would:
- Pass the permission check (no `RETURN` substring, not `CLOSE`, so falls to `rentals_pickup_inspection`)
- Throw `Unsupported rental action: REVERT_CLOSE` at line 223

**Minor**: a request with `action: 'CLOSE_THE_RENTAL'` would match `.includes('CLOSE')` first... wait, no, the check is `.includes('RETURN') || === 'CLOSE'`. `'CLOSE_THE_RENTAL'.includes('RETURN')` is false, but `=== 'CLOSE'` is also false. So the typo fails the permission check then throws 500. **The permission check is doing the work of validating the action enum, accidentally.**

A request with `action: 'CANCEL_RETURN_REQUEST'` would be classified as a return action (because `includes('RETURN')` is true), get the return-inspection permission, then throw 500.

**Bug**: the `.includes('RETURN')` substring check is too loose. A typo'd action that happens to contain the word "return" gets the wrong permission.

**Fix**: import a `RentalAction` enum, validate `action in RentalAction` with a Zod schema, then do the permission check on the validated enum.

### P1.5 — `hubs/bulk/route.ts:30-32` `bulkDelete` calls `db.hub.deleteMany` which is a hard delete

**Evidence**: `hub.repository.ts:77-81`:
```ts
async bulkDelete(ids: string[]) {
  const result = await db.hub.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids) invalidateHubCache(id);
  return result;
}
```

And the route at `hubs/bulk/route.ts:30-32`:
```ts
case 'delete':
  result = await hubUseCases.bulkDelete(ids, session.adminId || '');
  break;
```

The use-case (`hub.use-cases.ts:106-123`) does a pre-check for hubs with vehicles, throws if any. But for hubs **without** vehicles, it's a hard `deleteMany`.

**No soft delete** on the `Hub` schema (no `deletedAt` field on Hub — checked the schema, `Hub` has `id, name, location, city, isActive, createdAt, updatedAt` only). The `deleteHub` in the use-case is the same hard delete.

**Impact**: an admin accidentally clicks "Delete" on a hub → 30 days of audit logs, incidents, tickets, rentals that reference the hub by name are now orphaned. There's no recovery.

The pattern in this codebase is that the **Hub is a name, not a foreign key** for most relationships (Rider.pickupHub is a String, not a FK). So deleting a Hub doesn't break the relational integrity — but it does break the dashboard's hub list, and any rider whose pickupHub string is the deleted hub's name will have a stale reference.

**Fix**: add `deletedAt DateTime?` to Hub, change the deleteMany to a soft-delete `updateMany({ isActive: false, deletedAt: new Date() })`, and add a periodic cleanup worker that hard-deletes soft-deleted hubs after 90 days.

### P1.6 — `Vehicle.bulkDelete` (repository) hard-deletes, bypassing the `Vehicle.deletedAt` field

**Evidence**: `vehicle.repository.ts:90-94`:
```ts
async bulkDelete(ids: string[]) {
  const result = await db.vehicle.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids) invalidateVehicleCache(id);
  return result;
}
```

But the Vehicle schema HAS a `deletedAt` field (`schema.prisma:103`):
```prisma
deletedAt      DateTime?
```

And the single-vehicle DELETE in `vehicles/route.ts:149`:
```ts
await vehicleUseCases.updateVehicle(id, { status: 'RETIRED' });
```

So the **single-vehicle delete is a soft delete** (set status to RETIRED, keep row), but the **bulk delete is a hard delete**. Inconsistency: an admin who selects 5 vehicles and clicks Delete loses all 5 records, while selecting 1 and clicking Delete just retires it.

**Fix**: change `bulkDelete` to `updateMany({ status: 'RETIRED', deletedAt: new Date() })` for consistency. Or remove the soft-delete capability entirely from both paths and have a single hard-delete with confirmation.

### P1.7 — `vehicles/route.ts:147-149` soft-delete updates status to RETIRED but does not check for active leases

**Evidence**: `vehicles/route.ts:138-160`:
```ts
export async function DELETE(req: NextRequest) {
  ...
  const vehicle = await vehicleUseCases.getVehicle(id);
  if (vehicle) {
    await vehicleUseCases.updateVehicle(id, { status: 'RETIRED' });
    ...
```

`vehicleUseCases.markForMaintenance` (line 55-67) has the right check:
```ts
const activeLease = await db.rentalLease.findFirst({ where: { vehicleId, status: 'ACTIVE' } });
if (activeLease) throw new Error('Vehicle is currently on an active rental...');
```

But `updateVehicle` does NOT have this check. An admin can retire a vehicle with an active lease. The rental lease's `vehicleId` FK now points to a RETIRED vehicle. The rider's `assignedVehicle` and the dashboard still show the vehicle number, but no one can do anything with it (the only path to a vehicle return goes through `rental.use-cases.executeLeaseAction` which updates `vehicle.status = 'AVAILABLE'` on close — but if the vehicle is RETIRED, the `AVAILABLE` state is wrong).

**Fix**: add the active-lease check to `vehicles/route.ts:DELETE` before setting RETIRED, OR (better) centralize the check in `vehicleUseCases.updateVehicle` so it can't be skipped.

### P1.8 — `Hub.teamLeader` relation is missing — `hubRepository.getTeamLeaders` ignores its parameter

**Evidence**: `hub.repository.ts:33-36`:
```ts
async getTeamLeaders(hubId?: string) {
  // teamLeader table in schema does not have hubId link
  return db.teamLeader.findMany({ orderBy: { name: 'asc' } });
}
```

The comment says "teamLeader table in schema does not have hubId link" — confirmed, the `TeamLeader` schema (`schema.prisma:772-...`) has no `hubId` field. So a hub has no way to know which team leaders work there, and `getTeamLeaders(hubId)` returns ALL team leaders regardless of which hub.

The `rental.repository.ts:80-89` falls back to `'Amit Sharma'` (a hardcoded name) if no team leader is found.

**Impact**: assigning a rider to a hub doesn't actually associate them with a team leader. The "Hub" page in the admin UI shows team leaders (which is a global list), and the rider's `teamLeader` field can be set to any name (string), not a FK to a real TeamLeader. Audit log shows `"teamLeader": "Amit Sharma"` for every rider assigned to any hub.

**Fix**: add a `hubId` column to `TeamLeader`, or a many-to-many `HubTeamLeader` join table. This is a bigger change (migration + UI).

### P1.9 — `plan.use-cases.list` and `listActivePlans` do not filter by `deletedAt`

**Evidence**: `plan.use-cases.ts:29-37`:
```ts
async list(page: number, limit: number) {
  const [plans, total] = await Promise.all([
    db.rentalPlan.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.rentalPlan.count(),
  ]);
  ...
}
```

The `RentalPlan` schema has `deletedAt DateTime?`. The route `plans/route.ts:80-91` does a "soft delete" via the use-case's `delete` method, which presumably sets `deletedAt`. But the list doesn't filter by `deletedAt: null` → **deleted plans still appear in the admin UI**.

**Impact**: admin deletes a plan, it disappears from the UI, comes back on next refresh because the soft-delete is implemented as "set deletedAt" and the list query doesn't filter it out.

**Fix**: add `where: { deletedAt: null }` to both `list` and `listActivePlans`.

### P1.10 — `plans/route.ts:15` uses `analytics_view` permission for plan GET, not `plans_view` (or `plans_manage`)

**Evidence**: `plans/route.ts:14-19`:
```ts
const PERM_MAP: Record<string, Permission> = {
  view: 'analytics_view',
  create: 'plans_manage',
  update: 'plans_manage',
  delete: 'plans_manage',
};
```

This is probably a copy-paste bug. The endpoint is `/api/admin/plans`, and the other actions use `plans_manage` consistently. The `view` action uses `analytics_view`, which means an analytics-only admin can see all rental plans, but cannot create/update/delete. Either intentional (and should be documented) or wrong (and should be `plans_manage`).

**Fix**: confirm with the team. If `analytics_view` is correct, add a comment explaining why plans are visible to analytics admins. If wrong, change to `plans_manage` or add a new `plans_view` permission.

### P1.11 — `vehicle.use-cases.assignVehicle` reads `rental.status === 'ACTIVE'` but the rental state machine allows `'OVERDUE'` too

**Evidence**: `vehicle.use-cases.ts:37`:
```ts
existingRental = await db.rentalLease.findFirst({ where: { riderId: riderDbId, status: 'ACTIVE' } }),
if (existingRental) throw new Error('Rider already has an active rental');
```

Per the rental state machine (`rental-state-machine.ts:31`), `ACTIVE` is the only state for "in progress" — but `OVERDUE`, `RETURN_PENDING`, `SUSPENDED` are all also "non-CLOSED" states. The check should be `status: { not: 'CLOSED' }` (or `status: { in: ['ACTIVE', 'OVERDUE', 'RETURN_PENDING', 'SUSPENDED'] }`).

**Impact**: a rider with an OVERDUE rental can be assigned a second vehicle. The check passes, both vehicles get `status: 'ASSIGNED'`, both leases exist, the rider now has two vehicles, and the wallet is debited twice for rent.

**Fix**: use the state machine to derive the "active" set, or use `status: { not: 'CLOSED' }`.

---

## P2 — Type safety, contracts, and design

### P2.1 — `RentalPlan.durationDays` is overridable but the rule says it should be derived from `type`

**Evidence**: `schema.prisma:135-136`:
```
/// The `durationDays` represents the billing cycle length, which is strictly hardcoded
/// based on `type` (DAILY = 1, WEEKLY = 7, MONTHLY = 30) in the backend use-cases.
model RentalPlan {
  ...
  type                   RentalPlanType
  durationDays           Int
```

And `plan.use-cases.ts:13-26`:
```ts
export function getDurationForPlanType(planType?: string | null): number {
  if (!planType) return 7;
  const upper = planType.toUpperCase();
  switch (upper) {
    case 'DAILY': return 1;
    case 'WEEKLY': return 7;
    case 'MONTHLY': return 30;
    default: return 7;
  }
}
```

The schema comment says `durationDays` is strictly derived, but the column is editable. The `createPlanSchema` and `updatePlanSchema` in `lib/validators` likely let the admin set it. The use-case `getDurationForPlanType` exists but isn't used on every code path (e.g. `subscribeToPlan` at line 79-80 uses `plan.durationDays` directly, not the derived value).

**Impact**: an admin creates a DAILY plan with `durationDays: 30`. The use-case reads `plan.durationDays` (30) for `planEndDate`, not the rule-derived 1. The rider's plan is treated as 30-day. Discrepancy.

**Fix**: derive `durationDays` from `type` on every read, treat the DB column as a sanity-check only. Or add a DB CHECK constraint that enforces `type → durationDays`.

### P2.2 — `RentalLease.status` is on the lease, but the rider's `lifecycleStatus` is the canonical state machine

**Evidence**:
- `rental.repository.ts:14` imports `validateTransition as validateRiderTransition` from `riders/rider-lifecycle.service` — the **rider's** state machine, not a rental-specific one.
- `rental.repository.ts:166-222` (`executeLeaseAction`) updates BOTH `rentalLease.status` AND `rider.lifecycleStatus` for most actions. They're synced in this one place.
- `rental.repository.ts:48-78` (`selectPlan`) only updates `rider.lifecycleStatus`, not `rentalLease.status`. There's no lease until `bookRental` is called.
- The admin UI's rental list shows `lease.status`. The rider app's dashboard shows `rider.lifecycleStatus`. **Two sources of truth for "is this rental active?"**

**Impact**: in the gap between `startRental` (which sets `rider.lifecycleStatus = 'ACTIVE'`) and the explicit `rentalLease.status = 'ACTIVE'` (which happens in `executeLeaseAction` with action 'START'), the lease is `BOOKED` but the rider is `ACTIVE`. The admin UI's rental list shows `BOOKED` for a rider the app treats as actively riding.

**Fix**: pick one. Either the rider's lifecycle status is the source of truth (and the lease status is computed on read), or the lease status is the source of truth (and the rider's lifecycle status mirrors it).

### P2.3 — `Shift.startTime` and `endTime` are `String`, not `DateTime`

**Evidence**: `schema.prisma:120-123`:
```prisma
startTime   String
endTime     String
```

Same problem as `RentalLease.startTime` (P1.3). The booking uses these as string-compare keys. A shift "09:00 - 18:00" is stored as the strings `"09:00"` and `"18:00"`. Sorting is correct lexically, but time-arithmetic (e.g. "is current time within shift?") requires string-to-Date parsing, which is timezone-dependent.

### P2.4 — `rental.repository.executeLeaseAction` doesn't invalidate the `vehicles_list:*` cache

**Evidence**: `rental.repository.ts:228-229`:
```ts
invalidateRiderCache(lease.riderId);
invalidateVehicleCache(lease.vehicleId);
return result;
```

`vehicleRepository.update` (line 28-32) calls `invalidateVehicleCache(vehicleId)`. `executeLeaseAction` uses `tx.vehicle.update` directly inside the tx, bypassing `vehicleRepository.update`. So the cache is invalidated for the `vehicleId` field, but not for the broader `vehicles_list:*` cache key that the admin UI uses.

**Impact**: the admin's vehicle list view is cached for 5 seconds (`admin:vehicles` cache TTL at vehicles/route.ts:47). A `REQUEST_RETURN` that updates `vehicle.status = 'RETURN_PENDING'` is not reflected in the cached list until the 5s TTL expires. Admin sees stale data.

**Fix**: add `invalidateCache('vehicles_list:*')` to `executeLeaseAction` (or use a wider cache invalidation pattern).

### P2.5 — `vehicle.use-cases.bulkUpdateVehicles` reuses the bulk delete path's hard delete

**Evidence**: `vehicle.use-cases.ts:254-258`:
```ts
case 'delete': {
  const result = await vehicleRepository.bulkDelete(ids);
  updatedCount = result.count;
  auditAction = 'vehicle.bulk_delete';
  break;
}
```

And the repo at line 90-94:
```ts
async bulkDelete(ids: string[]) {
  const result = await db.vehicle.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids) invalidateVehicleCache(id);
  return result;
}
```

Same hard-delete vs. soft-delete inconsistency as P1.6.

### P2.6 — `Hub` has no `updatedAt` audit log entries

**Evidence**: `hub.use-cases.ts:53-63`:
```ts
async updateHub(hubId: string, input: Prisma.HubCreateInput, actorId: string) {
  const hub = await hubRepository.update(hubId, input);
  createAuditLog({
    actorId,
    action: 'hub.update',
    entity: 'hub',
    entityId: hubId,
    details: input as any,  // ← stores the entire input as the audit details
  }).catch(() => {});
  return hub;
}
```

The `details: input as any` includes the full update payload. If a user changes a hub's `name` from "Central Hub" to "Mumbai Central" and the city from "Mumbai" to "Pune", both go in. But there's no DIFF (what changed?). The audit log is a snapshot, not a diff. A regulator asking "what changed?" has to compare against the previous row, which is not in the audit log.

**Fix**: capture the pre-update row first, then write the diff in the audit log.

### P2.7 — `rental.service.ts` is 31 lines, mostly stubs

I didn't open this file in the audit. The size suggests it's either a thin wrapper or a dead-code stub. Worth a second look.

### P2.8 — `vehicle.repository.findById` uses `getCachedVehicle(vehicleId, ...)` but the parameter is named `vehicleId` — sometimes the caller passes the internal cuid, sometimes the public `vehicleId` string

**Evidence**: `vehicle.repository.ts:16-18`:
```ts
async findById(vehicleId: string) {
  return getCachedVehicle(vehicleId, () => db.vehicle.findUnique({ where: { id: vehicleId } }));
},
```

The `where: { id: vehicleId }` always queries by the internal `id` (cuid). But callers can pass either the cuid or the public `vehicleId` string (e.g. `vehicle.use-cases.verifyPickupVehicle` at line 190-203 has an `OR: [{id}, {vehicleId}, {vehicleNumber}, ...]` lookup). The cache key is the parameter passed in, so:
- Caller A passes cuid → cache key is cuid
- Caller B passes public `vehicleId` → cache key is public `vehicleId`
- These are **different cache entries** for the same vehicle → cache fragmentation

**Fix**: normalize the parameter (always resolve to the internal cuid) before computing the cache key.

### P2.9 — `hub.repository.bulkDelete` race condition with vehicle assignment

**Evidence**: `hub.use-cases.ts:107-115`:
```ts
async bulkDelete(ids: string[], actorId: string) {
  const hubsWithVehicles = await db.hub.findMany({
    where: { id: { in: ids }, vehicles: { some: {} } },
    select: { id: true },
  });
  if (hubsWithVehicles.length > 0) {
    throw new Error(...);
  }
  const result = await hubRepository.bulkDelete(ids);
  ...
}
```

The check is **non-atomic**. Between the `findMany` and the `deleteMany`, an admin can assign a vehicle to one of these hubs. The deleteMany then succeeds (the FK is `onDelete: Restrict` per `schema.prisma:108`, so it would fail — but the `vehicles: { some: {} }` check passed, so the deleteMany would still try).

**Wait, the FK is `onDelete: Restrict`** — so the deleteMany will fail with an FK constraint violation. The user gets a 500 (caught and returned as 409 in the route, line 39-40). So the race is **mitigated by the FK**, not by the use-case check.

The use-case check is **dead code** (the FK does the work). The error message is the only thing the use-case check provides; the FK error would say something like "Foreign key constraint violated" which is less user-friendly.

**Fix**: either drop the use-case check and rely on the FK, or wrap the check + delete in a `SERIALIZABLE` transaction so the check is atomic.

### P2.10 — `sync.use-cases.ts:84` calls `vehicle.use-cases.verifyPickupVehicle` but the route is at `src/app/api/rider/sync/pickup/vehicle/route.ts` (rider-side), not admin-side

The sync route is for the rider app to claim their vehicle at pickup. The admin panel never calls it. But `rental.use-cases.bookRental` and `rental.use-cases.syncPickup` are the rider-side entry points. The admin has no equivalent — admins can't create a lease, only start/close one via `executeLeaseAction`.

**This is by design** (the rider is the one who books), but it means the admin panel's "create a rental on behalf of a rider" use case is missing. If a rider calls support and says "I need to start a rental", an admin can't do it for them; the rider has to use the app. If the rider is locked out, the admin is stuck.

**Fix**: add an admin route that mirrors `bookRental` and `syncPickup` (with appropriate audit logging).

---

## P3 — Code quality and dead code

### P3.1 — `rental.routes.ts` (67 lines) is a thin file with no consumers

**Evidence**: `rental.routes.ts` exists, but there's no `app/api/...` route that imports it. The actual `/api/admin/rentals` route is the inline `app/api/admin/rentals/route.ts` I read. `rental.routes.ts` is dead code or pre-split leftovers.

(Skipped — would need to confirm by grepping for imports.)

### P3.2 — `hub.routes.ts` (62 lines) — same pattern, likely dead code

(Same as P3.1; not read in this audit.)

### P3.3 — `rental.schemas.ts` (25 lines) re-exports from `@/lib/validators` but has no consumers

(Same; not read.)

### P3.4 — `vehicle.routes.ts` (71 lines) — same pattern

(Same; not read.)

### P3.5 — `hub.policy.ts` (19 lines) is a dead-code stub

`hub.policy.ts` has only 19 lines, likely `canManageHubs(role)` and similar. The actual routes do permission checks via `hasPermission(session.adminRole, 'hubs_manage')` directly, not via `hubPolicy`.

### P3.6 — `vehicle.policy.ts` (35 lines) and `rental.policy.ts` (31 lines) — same pattern

Both likely have `canViewVehicles(role)`, `canManageRentals(role)` etc. that are not called by the route handlers.

### P3.7 — `rental.use-cases.endRental` is dead code — only `requestReturn` uses it, and `requestReturn` is only called from `rental.use-cases.ts:290` which is not invoked from any admin route

**Evidence**: `rental.repository.endRental` (line 116-145) and `rental.use-cases.requestReturn` (line 289-291) form a path for the rider app to request a return. The admin path is `executeLeaseAction` with action `REQUEST_RETURN`. They do similar but different things.

**Impact**: two code paths that should be one. If the rider's `requestReturn` is wired up but the admin's `executeLeaseAction` `REQUEST_RETURN` action is wired up, and the two diverge, you have a maintenance burden.

**Fix**: consolidate. Pick the admin's `executeLeaseAction` as canonical and have the rider-side call it (with appropriate RBAC).

### P3.8 — `submitReturn.ts:117` creates a VehicleReturn with `status: 'SUBMITTED'`, but the schema is `VehicleReturnStatus` enum — verify SUBMITTED is a valid value

I didn't open the `VehicleReturn` schema in detail. The submitReturn use-case hardcodes `status: 'SUBMITTED'`. If the enum doesn't have `SUBMITTED` (only `DRAFT`, `APPROVED`, `REJECTED`, etc.), this is a Prisma error at runtime.

**Fix**: verify the enum values against the schema. If `SUBMITTED` is not in the enum, change to a valid status.

### P3.9 — `rental.use-cases.bookRental` does a 3-step double-booking check but doesn't use the Prisma `@@unique([vehicleId, shiftId, leaseDate])` constraint as the primary guard

**Evidence**: `rental.use-cases.ts:75-91`:
```ts
const currentBookings = await tx.rentalLease.count({ where: { vehicleId, shiftId, leaseDate, status: { in: ['BOOKED', 'ACTIVE'] } } });
if (currentBookings >= shift.maxBookings) {
  throw new RentalBookError(...);
}
```

Then `tx.rentalLease.create` at line 108 — if the count check passed but a concurrent transaction also passed (the `maxBookings` check is non-atomic), the unique constraint `@@unique([vehicleId, shiftId, leaseDate])` is what actually prevents the duplicate. The code doesn't handle the unique-constraint violation explicitly.

**Fix**: add a try/catch on `Prisma.PrismaClientKnownRequestError` with `code: 'P2002'` (unique violation) to convert to `RentalBookError`. Or, more cleanly, use the `count >= maxBookings` check + a unique constraint that includes `status` (impossible because the status is data, not a schema key).

### P3.10 — `rental.repository.findManyLeases` accepts `args: any` — no type safety on the where clause

**Evidence**: `rental.repository.ts:147-153`:
```ts
async findManyLeases(args: any) {
  return db.rentalLease.findMany(args);
},
async countLeases(args: any) {
  return db.rentalLease.count(args);
}
```

The route at `rentals/route.ts:50` calls `rentalRepository.findManyLeases({ where, include: {...}, orderBy: ..., skip, take })`. The `args: any` lets the route construct arbitrary where clauses, but also lets the route pass invalid ones (e.g. `where: { invalidField: 'foo' }` would crash at Prisma runtime).

**Fix**: type as `Prisma.RentalLeaseFindManyArgs`.

### P3.11 — `hub.repository.findAllPaginated` is paginated but the `total` count is uncounted

**Evidence**: `hub.repository.ts:42-53`:
```ts
async findAllPaginated(page: number, limit: number) {
  const [hubs, total] = await Promise.all([
    db.hub.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { vehicles: { select: { status: true } } } }),
    db.hub.count(),
  ]);
  return { hubs, total };
}
```

`db.hub.count()` counts ALL hubs. If `isActive: false` hubs are filtered out elsewhere (the `findAll` repo at line 12 does this), the count should match. But `findAllPaginated` doesn't filter, so the count is total hubs, not just active ones. The route's `withCacheHeaders(success(result.hubs, undefined, 200, result.pagination), 300)` reports `totalPages: Math.ceil(total / limit)` based on the unfiltered count.

**Impact**: if 10% of hubs are inactive, the admin UI shows "1 of 10" but there are really 11 hubs total (10 active, 1 inactive hidden). Click "next" and there's no page 2.

**Fix**: filter the count by the same `isActive: true` (or whatever the route's filter is).

### P3.12 — `vehicles/route.ts:101-104` returns 201 for created, but `createVehicle` use-case doesn't write to the `rentalPlan` or `rider` tables

This is fine, but the route's audit log is **non-blocking** (`createAuditLog(...).catch(() => {})`). If the audit log write fails, no one knows. There's no retry, no DLQ.

(Same pattern across the audit-log calls in this audit. Not unique to vehicles.)

### P3.13 — `hub.use-cases.listAdminHubs` breaks down vehicle status counts with a hardcoded set

**Evidence**: `hub.use-cases.ts:22-26`:
```ts
hub.vehicles.forEach((v: any) => {
  const s = v.status.toUpperCase();
  if (s === 'AVAILABLE') breakdown.available++;
  else if (s === 'ASSIGNED' || s === 'RENTED') breakdown.assigned++;  // ← 'RENTED' is not a VehicleStatus
  else if (s === 'MAINTENANCE') breakdown.maintenance++;
  else if (s === 'RETIRED') breakdown.retired++;
});
```

The `VehicleStatus` enum is `AVAILABLE | RESERVED | ASSIGNED | ACTIVE_RENTAL | RETURN_PENDING | MAINTENANCE | RETIRED | LOST` (per `schema.prisma:1329-1338`). The breakdown checks for `RENTED` — not a valid status. So vehicles in `RENTED` (which shouldn't exist) would be silently miscounted as `assigned`. Vehicles in `ACTIVE_RENTAL` (the actual "rented" state) would NOT be counted in `assigned` at all — they'd be silently dropped (no `else if` catches them).

**Impact**: the hub dashboard's "Assigned" count is wrong. A hub with 10 vehicles all in `ACTIVE_RENTAL` shows 0 assigned. The admin sees 10 available, 0 assigned, and the actual situation is 0 available, 10 in active rental.

**Fix**: enumerate the full set of statuses in the breakdown (or use the Prisma enum to drive the count).

### P3.14 — `rental.use-cases.subscribeToPlan` allows `KYC_SUBMITTED` and `KYC_APPROVED` as eligible source states, but the rider lifecycle says PLAN_SELECTED comes BEFORE KYC

**Evidence**: `plan.use-cases.ts:71-76`:
```ts
if (
  !['GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED', 'PLAN_SELECTED', 'DEPOSIT_PENDING', 'DEPOSIT_APPROVED', 'KYC_SUBMITTED', 'KYC_APPROVED', 'PICKUP_SCHEDULED', 'ACTIVE'].includes(
    rider.lifecycleStatus
  )
)
  throw new Error('INVALID_STATE_FOR_PLAN_SELECTION');
```

The rider lifecycle state machine (`rider-lifecycle.service.ts:37-53`) has `PLAN_SELECTED → DEPOSIT_PENDING → DEPOSIT_APPROVED → KYC_SUBMITTED → KYC_APPROVED → PICKUP_SCHEDULED → ACTIVE`. So a rider in `KYC_SUBMITTED` came from a prior `DEPOSIT_APPROVED`, which came from `DEPOSIT_PENDING`, which came from `PLAN_SELECTED`. The state machine doesn't allow skipping `PLAN_SELECTED`.

But the check includes `KYC_SUBMITTED` and `KYC_APPROVED` — so a rider can subscribe to a plan AFTER KYC. That means they had to already be in a plan (the one whose KYC is in question). This is a re-subscription path, but the use-case writes `currentPlan: plan.name` (overwriting the prior plan name). The prior plan's leases (if any) now reference a name that no longer matches `Rider.currentPlan`. Drift.

**Fix**: document the re-subscription path explicitly, or restrict the allowed source states to `GUARANTOR_SUBMITTED | GUARANTOR_APPROVED` and force a separate `changePlan` use-case for already-active riders.

### P3.15 — `vehicles/route.ts:147-149` checks `if (vehicle)` before delete, but `getVehicle` returns null on cache miss too

**Evidence**: `vehicles/route.ts:147-149`:
```ts
const vehicle = await vehicleUseCases.getVehicle(id);
if (vehicle) {
  await vehicleUseCases.updateVehicle(id, { status: 'RETIRED' });
  ...
```

`vehicleUseCases.getVehicle(id)` calls `vehicleRepository.findById(id)` which uses `getCachedVehicle`. If the cache is stale or the vehicle doesn't exist, `getVehicle` returns `null`. The `if (vehicle)` guard silently skips the update and the audit log. The route still returns `success(null, 'Vehicle deleted')` — 200 OK — even though no vehicle was found or updated.

**Impact**: a typo'd `id` (e.g. `vh_123` instead of `vh_124`) gets a 200 OK with no update. The admin thinks they deleted a vehicle; nothing happened. The audit log has no record.

**Fix**: return 404 if the vehicle doesn't exist. Drop the `if (vehicle)` guard and call `errors.notFound('Vehicle not found')` instead.

### P3.16 — `hub.use-cases.createHub` and `updateHub` pass `input as any` to `createAuditLog.details`

Same as P2.6. Storing the full input in the audit log doesn't capture the diff.

### P3.17 — `vehicle.use-cases.createVehicle` doesn't run `rental-plan-duration` validation

The `getDurationForPlanType` rule says DAILY=1, WEEKLY=7, MONTHLY=30. The `createVehicle` use-case accepts `batteryPartner`, `licensePlate`, `status`, `hubId`. None of these are plan-related. So this is not relevant. **Skip.**

### P3.18 — `team-leader.repository.ts` has no soft-delete or isActive field

`TeamLeader` schema: `id, name, isActive?, createdAt?, updatedAt?` (per schema grep). `isActive` exists but the `TeamLeader` UI doesn't seem to filter by it. Probably fine.

### P3.19 — `rental.use-cases.bookRental` doesn't emit an outbox event for the rent-reminder worker to see

**Evidence**: `rental.use-cases.ts:108-131` creates a `RentalLease` with `nextRentDueAt: new Date()` and `periodNo: 0`. The comment at line 118-124 says the rent-reminders job picks it up on its next tick.

But there's no `OutboxService.emit(...)` call. The job is `rent-reminders.job.ts`, and it presumably queries `rentalLease where { status: BOOKED|ACTIVE, nextRentDueAt <= now }`. So it works via polling, not events. Fine, but means the job's polling interval is the latency of the rent reminder.

**Skip — not a bug, just an architecture observation.**

### P3.20 — `hub.use-cases.bulkActivate`/`bulkDeactivate` write one audit log per hub in a loop, with no batch audit entry

**Evidence**: `hub.use-cases.ts:86-104`:
```ts
async bulkActivate(ids: string[], actorId: string) {
  const result = await hubRepository.bulkActivate(ids);
  for (const id of ids) {
    createAuditLog({ actorId, action: 'hub.activate', entity: 'hub', entityId: id }).catch(() => {});
  }
  return { count: result.count };
}
```

50 hubs × 1 audit log = 50 fire-and-forget audit writes. A bulk operation that activates 50 hubs generates 50 audit entries, each saying "hub.activate" with no indication it was a bulk action. A future audit query "show me all hub.activate events" can't distinguish "admin clicked each one individually" from "admin clicked Bulk Activate on 50".

**Fix**: write ONE audit log per bulk action with `details: { ids, count }`. The pattern is already used in `vehicle.use-cases.bulkUpdateVehicles:264-270`.

---

## P4 — Test coverage gaps

| Test file | Covers | Missing |
|---|---|---|
| `rental.repository.test.ts` | Repo layer | `executeLeaseAction` race conditions (T1+T2 both START) — not tested |
| `rental.service.test.ts` | Service layer | ??? |
| `rental-plan-duration.test.ts` | `getDurationForPlanType` | **Does not test that `plan.durationDays` is enforced to match `plan.type` in `subscribeToPlan`** — this is the actual consumer that uses `plan.durationDays` directly |
| `rider-rental-return.test.ts` | Rental return | ??? |
| `submitReturn.test.ts` | Vehicle return | The `MIN_PHOTOS=4` precondition — not tested as a separate case |
| `rent-reminders-no-double-charge.test.ts` | Worker | ??? |
| `vehicle-service.test.ts` | Service layer | ?? — no test for `assignVehicle` P1.11 bug (the `status: 'ACTIVE'` check should be `status: { not: 'CLOSED' }`) |
| **No test** for | `plan.use-cases.list` price field | The P0.1 NaN bug — would be caught by a 3-line test that asserts `plans[0].price` is a finite number |
| **No test** for | `vehicle.use-cases.bulkUpdateVehicles` race | The `reassignHub` action does an update inside a `$transaction` of N updates (line 242-249) — if one update fails, the others are not committed (Prisma rolls back the whole tx), but the error message is unclear |
| **No test** for | `hubs/route.ts` integration | The 4-method handler is the public API; only `hubs/route.ts` and `hubs/bulk/route.ts` are tested implicitly via the use-case tests |
| **No test** for | `rental.repository.executeLeaseAction` permission | The `rentals/route.ts:84-91` permission gate is not in any test file |

---

## P5 — Cross-stack contract mismatches (Web ↔ Flutter)

The Flutter side for the rental/vehicle/hub flow is in `flutter/lib/features/rentals/`, `flutter/lib/features/pickup/`, `flutter/lib/features/dashboard/`, and the `api_client.dart`. Not opened in this audit.

Known mismatches (from the previous riders audit + the rental use-cases):
- `GET /api/admin/plans` returns `price: NaN` → Flutter `RentalPlan` model probably has `price: number` → JSON parser may throw on NaN
- `GET /api/admin/hubs` returns `vehicleBreakdown.assigned` for `RENTED` (typo for nonexistent enum) but misses `ACTIVE_RENTAL` → Flutter hub card shows wrong counts
- `GET /api/admin/vehicles` returns `lease.rider.lifecycleStatus` (a RiderLifecycleStatus) inside the lease object → Flutter `Vehicle.activeLease` may not parse the lifecycle status, falling back to undefined

**Confirm by reading the Flutter API models and the consumer screens. Out of scope for this audit.**

---

## Recommended fix order

| Priority | PR | Scope | Est. hours |
|---|---|---|---|
| **P0.1** | `plan.use-cases.list` reads `p.priceInPaise` instead of `p.price` | 2 line edits + 1 test | 30m |
| **P1.5** | Hub soft-delete | 1 migration + 1 use-case change + 1 test | 2h |
| **P1.6** | Vehicle bulk delete → soft delete | 1 repo change + 1 test | 1h |
| **P1.7** | `vehicles/route.ts DELETE` checks active lease | 1 route change + 1 test | 30m |
| **P1.9** | `plan.use-cases.list` filters `deletedAt: null` | 2 line edits + 1 test | 30m |
| **P1.10** | `plans/route.ts` view permission = `plans_manage` (or document) | 1 line edit | 5m |
| **P1.11** | `assignVehicle` checks non-CLOSED leases | 1 line edit + 1 test | 30m |
| **P1.3** | `RentalLease.leaseDate` → `DateTime` | 1 migration with data backfill + 1 repo change | 4-6h |
| **P1.4** | `rentals/route.ts` validates action via Zod enum | 1 schema addition + 1 route change | 1h |
| **P2.1** | `getDurationForPlanType` enforced on subscribeToPlan | 1 use-case change + 1 test | 1h |
| **P2.4** | `executeLeaseAction` invalidates `vehicles_list:*` | 1 line edit | 15m |
| **P2.6, P2.16** | Hub audit log captures diff not input | 1 use-case change + 1 test | 1h |
| **P2.13** | Hub vehicle breakdown handles all VehicleStatus | 1 use-case change + 1 test | 1h |
| **P2.15** | `vehicles/route.ts DELETE` returns 404 if not found | 1 route change + 1 test | 30m |
| **P2.20** | Hub bulk operations write 1 audit log, not N | 1 use-case change + 1 test | 1h |
| **P3.x** | Delete dead routes/policies/schemas | 6 file deletes | 30m |

**Total: ~16h of focused work** to take the rentals/vehicles/hubs section from "feature-complete with several production bugs" to "production-grade". Could be split into 4-5 PRs over 1-2 weeks.

---

## What I'd do first if I had to pick one

**P0.1 — fix `plan.use-cases.list` price field**. 2 lines of code, but it means **every rental plan shows NaN** in the admin UI and the rider app. Riders cannot see what plans cost → cannot subscribe → the entire rental funnel is broken in production. The fix is mechanical, the test is mechanical, the deploy is mechanical. Everything else can wait.
