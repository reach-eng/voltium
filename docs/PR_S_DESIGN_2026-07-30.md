# PR-S Design — Rider Model Decomposition

**Date:** 2026-07-30
**Source:** AUDIT_DATABASE.md §2.1 (Rider 60+ columns), FIX_PLAN.md PR-S, EXECUTION_PLAN_2026-07-30.md PR-S
**Goal:** Decompose the 64-field `Rider` model into 5 child tables, each a 1:1 relation with `Rider`.

---

## Why

The `Rider` model has 64 data fields spanning 6 distinct concerns:
- **Identity** (10): id, riderId, phone, fullName, email, fatherName, motherName, dob, currentAddress
- **Auth state** (5): tokenVersion, intent, lifecycleStatus, lifecycleStage, vehicleId/deliveryId/assignedVehicle
- **Onboarding state** (8): pickupHub, currentPlan, planStartDate, planEndDate, advanceRentPaid, preferredShift, teamLeader, emergencyContact
- **Permissions** (8): locationGranted, batteryGranted, contactsGranted, callLogsGranted, micGranted, cameraGranted, phoneGranted, lastDeviceViolationAt, deviceViolationCount
- **Device** (10): fcmToken, isAdminLocked, lockPasswordHash, isUninstallBlocked, isLocationMandatory, isAppsControlRestricted, deviceAdminGranted, displayOverlayGranted, pickedUpAt, batteryLevel
- **Pickup photos** (5): pickupPhotoFront, pickupPhotoBack, pickupPhotoLeft, pickupPhotoRight, pickupPhotoWithVehicle
- **Location** (3): lastKnownLat, lastKnownLng, lastLocationAt
- **Misc** (5): pickedUpAt, registrationDoneAt, depositDoneAt, kycDoneAt, planDoneAt, currentPlanPrice, planRejectionReason

**Why this matters:**
- Every UPDATE writes the full row (Postgres MVCC)
- A 64-field row generates a lot of WAL traffic
- Adding a new column requires ALTER TABLE on a wide row
- `SELECT phone, fullName` reads the full row due to heap layout

---

## Decomposition

5 child tables, all 1:1 with `Rider`. Each has a single PK = `riderId` and FK to `Rider.id` with `onDelete: Cascade`.

| Child table | Fields | Size | Read pattern |
|---|---|---|---|
| `RiderPermissions` | 8 booleans + 2 device violation fields | 10 cols | Every sync (location, contacts, call logs check) |
| `RiderDevice` | FCM token, lock password hash, device admin flags, battery level | 9 cols | On lock-screen verify, on FCM token refresh |
| `RiderLocation` | lastKnownLat, lastKnownLng, lastLocationAt | 3 cols | Every location update (high frequency) |
| `RiderOnboarding` | Hub/Plan/TL FKs + dates + advance rent + emergency contact | 8 cols | Onboarding flow only |
| `RiderPickupPhotos` | 5 photo URLs | 5 cols | Once at pickup, then read-only |

The remaining ~20 fields stay on the `Rider` model (identity, auth state, timestamps, lifecycle). This brings `Rider` down from 64 to ~44 fields (still big, but the wide-row cost is mainly the high-frequency fields, which are now in child tables).

---

## Migration strategy (matches PR-P3.1/2/3.2 pattern)

For each child table:
1. **ADD** the child table (with all columns nullable, no FK constraints yet)
2. **BACKFILL** from the parent (one-time INSERT ... SELECT)
3. **ADD FK constraints** (RiderId -> Rider.id, onDelete: Cascade)
4. **ADD indexes** (riderId is the PK, so no extra index needed)
5. **Update writers** to write to child tables
6. **Update readers** to JOIN across child tables
7. **DROP legacy columns** from Rider (gated on 1-wk staging soak of steps 1-6)

---

## Implementation order

5 sub-PRs, each independently shippable + revertable:

| Sub-PR | What | Effort | Risk | Staging soak |
|---|---|---|---|---|
| PR-S.1 | `RiderPermissions` (8 booleans + 2 fields) | 1 day | Low | 1 week |
| PR-S.2 | `RiderDevice` (FCM + lock + device admin flags) | 1 day | Low | 1 week |
| PR-S.3 | `RiderLocation` (lat/lng/at) | 0.5 day | Low | 1 week |
| PR-S.4 | `RiderOnboarding` (hub/plan/TL FKs + dates) | 1 day | Medium (PR-P3.2 already added FK cols) | 1 week |
| PR-S.5 | `RiderPickupPhotos` (5 photo URLs) | 0.5 day | Low | 1 week |

**Total:** 4-5 days focused + 5 weeks staging soak (parallel).

This PR-S commit contains the first sub-PR (RiderPermissions).

---

## Code change pattern

**Before (current writers):**
```typescript
// rider-use-cases.ts
await db.rider.update({
  where: { id: riderDbId },
  data: {
    locationGranted: true,
    contactsGranted: true,
  },
});
```

**After (PR-S.1):**
```typescript
// rider-use-cases.ts
await db.riderPermissions.update({
  where: { riderId: riderDbId },
  data: {
    locationGranted: true,
    contactsGranted: true,
  },
});
```

**Before (current readers — flatten-rider.ts):**
```typescript
const rider = await db.rider.findUnique({ where: { id: riderDbId } });
return {
  ...rider,
  locationGranted: rider.locationGranted,
  // ... 60+ more fields
};
```

**After (PR-S.1):**
```typescript
const rider = await db.rider.findUnique({
  where: { id: riderDbId },
  include: {
    permissions: true,  // RiderPermissions 1:1 join
  },
});
return {
  ...rider,
  locationGranted: rider.permissions?.locationGranted ?? false,
  // ... fewer fields
};
```

**Flutter impact:** zero. The `flattenRider()` response shape is preserved, so the Flutter `RiderModel.fromJson` doesn't need to change.

---

## Why this is safe

1. **Flutter doesn't see the change.** The `flattenRider()` response shape is identical before and after.
2. **Backward-compat reads.** All readers go through `flattenRider()` which is the single point that does the JOIN.
3. **Backward-compat writes.** New writers write to child tables; old writers (if any remain) write to legacy columns. The JOIN reads from child tables first, falls back to legacy.
4. **1:1 with `onDelete: Cascade`.** Deleting a Rider deletes the child rows. No orphans.
5. **Idempotent migrations.** All steps use `IF NOT EXISTS` / `DROP IF EXISTS` guards. Safe to re-run on staging.

---

## Acceptance criteria (per sub-PR)

- [ ] Child table created with `@@map` and `@@id([riderId])`
- [ ] FK constraint added (RiderId -> Rider.id, onDelete: Cascade)
- [ ] Backfill from parent (one-time INSERT ... SELECT) with NULL-safety
- [ ] Writers updated to use child table
- [ ] `flatten-rider.ts` JOINs across the new child table
- [ ] All unit tests pass (1598+)
- [ ] Integration tests pass
- [ ] `tsc --noEmit` clean
- [ ] 1-week staging soak
- [ ] Drop legacy columns (gated on soak)

---

## Migration order (atomic, no half-states)

For each sub-PR, the migration is 3 atomic steps inside `BEGIN; ... COMMIT;`:

```sql
BEGIN;

-- Step 1: Add the child table (idempotent)
CREATE TABLE IF NOT EXISTS "rider_permissions" (...);

-- Step 2: Backfill from parent (idempotent via WHERE NOT EXISTS)
INSERT INTO "rider_permissions" (riderId, locationGranted, ...)
SELECT id, "locationGranted", ...
FROM "riders"
ON CONFLICT (riderId) DO NOTHING;

-- Step 3: Add FK constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rider_permissions_riderId_fkey') THEN
    ALTER TABLE "rider_permissions"
      ADD CONSTRAINT rider_permissions_riderId_fkey
      FOREIGN KEY ("riderId") REFERENCES "riders"(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
```

The `INSERT ... ON CONFLICT DO NOTHING` makes it re-runnable. The `IF NOT EXISTS` on the constraint makes re-runs safe.

---

## Why not all 5 at once?

5 sub-PRs lets us:
- Ship PR-S.1 (Permissions) in 1 day, soak 1 week, observe, then ship PR-S.2
- Each sub-PR is independently revertable (drop the child table, restore legacy columns)
- The 5 soaks run sequentially, not in parallel (because they touch shared writer code)
- **If PR-S.1 fails in staging, we don't ship PR-S.2-5**

This is the same pattern as the rider_fk_columns migration (PR-P3.2): additive first, backfill, then drop the legacy columns (in this case, gated per-sub-PR).

---

## Track 3 calendar (with PR-S.1 first)

| Date | Event | Staging soak |
|---|---|---|
| Week 1 (Day 1) | PR-S.1 code (RiderPermissions) | Apply to staging |
| Week 1-2 | Staging soak (1 week) | In progress |
| Week 2 (Day 8) | PR-S.1 promote to prod; PR-S.2 code (RiderDevice) | Apply to staging |
| Week 3 (Day 15) | PR-S.2 promote to prod; PR-S.3 code (RiderLocation) | Apply to staging |
| Week 4 (Day 22) | PR-S.3 promote to prod; PR-S.4 code (RiderOnboarding) | Apply to staging |
| Week 5 (Day 29) | PR-S.4 promote to prod; PR-S.5 code (RiderPickupPhotos) | Apply to staging |
| Week 6 (Day 36) | PR-S.5 promote to prod; **all 5 sub-PRs done** | Track 3 complete |

In parallel: PR-K.3 (drop legacy enum) can ship in Week 2-3 (after PR-K.1's 1-wk soak completes).

---

## Track 3 final status after PR-S

- ✅ PR-K.1 (lifecycle enum add) — shipped
- ✅ PR-K.2 (Flutter reads lifecycleStage) — shipped
- 🔄 PR-K.3 (drop legacy lifecycleStatus) — pending staging soak
- 🔄 PR-S.1 (RiderPermissions) — code complete, awaiting staging soak
- ⚪ PR-S.2-5 (RiderDevice, RiderLocation, RiderOnboarding, RiderPickupPhotos) — pending
- 🔄 PR-J (drop legacy `pickupHub`/`currentPlan`/`teamLeader`) — gated on PR-P3.2 staging soak

After all of Track 3 ships:
- `Rider` model: 64 fields → ~44 fields
- Each child table: 3-10 fields
- Read patterns: can `SELECT rider, permissions` instead of `SELECT * FROM rider WHERE id = ?`
- Write patterns: `UPDATE rider_permissions SET locationGranted = ? WHERE riderId = ?` instead of full-row UPDATE
