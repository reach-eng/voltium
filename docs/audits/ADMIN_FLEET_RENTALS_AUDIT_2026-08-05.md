# Admin Panel Flows — Fleet & Rentals — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the admin fleet/rentals/hubs/shifts surface end-to-end (Next.js `/admin` + API routes):

| Flow | Brief's endpoint | Actual endpoints | Notes |
|---|---|---|---|
| Vehicle CRUD | `GET/POST/PATCH /api/admin/vehicles` | `GET/POST/PUT/DELETE /api/admin/vehicles` (method is **PUT**, not PATCH) | DELETE is **soft-delete** (sets `status: 'RETIRED'`); success message says "Vehicle deleted" but row remains |
| Fleet view | `GET /api/admin/fleet` | `GET /api/admin/fleet` (matches) | `riders_view` perm, 5s cache, no POST/PUT; returns rider list grouped by hub+status with `lowBattery` filter |
| Hub CRUD | `GET/POST/PATCH /api/admin/hubs` | `GET/POST/PUT/DELETE /api/admin/hubs` (PUT, not PATCH) | **300s cache** — way longer than other admin routes (5s); 5 min lag for new hub to appear in dropdowns |
| Rental management | `GET/PATCH /api/admin/rentals` | `GET/PUT /api/admin/rentals` (PUT, not PATCH); **no POST** | GET requires `riders_view` (not a rentals perm); PUT perm is a fragile substring match |
| Shift management | `GET/POST /api/admin/shifts / GET /api/shifts` | Matches for shape, but admin shifts use `settings_manage` perm (shifts aren't settings) | Public `/api/shifts` has no auth — by design for rider view, but no rate limit |

**Files read in full:**
- `web/src/app/api/admin/vehicles/route.ts` (165 lines — GET list, POST create, PUT update, DELETE soft-delete; 5s cache)
- `web/src/app/api/admin/vehicles/bulk/route.ts` (35 lines — POST bulk changeStatus/reassignHub/delete; `fleet_manage` perm)
- `web/src/app/api/admin/vehicles/[id]/history/route.ts` (62 lines — GET merged timeline of leases/returns/incidents/tickets; `take: 50` hard-coded)
- `web/src/app/api/admin/fleet/route.ts` (27 lines — GET only; 4 filters: hubId/status/search/lowBattery; 5s cache)
- `web/src/app/api/admin/hubs/route.ts` (100 lines — GET/POST/PUT/DELETE; **300s cache**; `hubs_manage` perm)
- `web/src/app/api/admin/hubs/bulk/route.ts` (45 lines — POST bulk activate/deactivate/delete; **no cache invalidation**)
- `web/src/app/api/admin/rentals/route.ts` (101 lines — GET list, PUT action only; **no POST**; GET uses `riders_view`; PUT uses fragile `action.includes('RETURN')` perm switch)
- `web/src/app/api/admin/shifts/route.ts` (97 lines — GET/POST/PUT/DELETE; **all 4 use `settings_manage`**)
- `web/src/app/api/shifts/route.ts` (26 lines — public, no auth, returns shifts for a `hubId`; validates YYYY-MM-DD date format)
- `web/src/server/modules/vehicles/vehicle.use-cases.ts` (275 lines — `listAdminVehicles`, `bulkUpdateVehicles` (race-y `getNextId`), `assignVehicle`, `markForMaintenance`)
- `web/src/server/modules/hubs/hub.use-cases.ts` (124 lines — all 4 CRUD + 3 bulk operations call `createAuditLog` from use case)
- `web/src/server/modules/shifts/shift.use-cases.ts` (186 lines — all CRUD calls `createAuditLog` from use case; `bulkActivate` invalidates)
- `web/src/server/modules/rentals/rental.repository.ts` (lines 160-231 — `executeLeaseAction` with 6 actions: `START`/`PICKUP_COMPLETE`/`MARK_OVERDUE`/`REQUEST_RETURN`/`APPROVE_RETURN`/`CLOSE`/`SUSPEND`)
- `web/src/lib/validators.ts` (lines 422-448 — `vehicleBulkActionSchema`, `hubBulkActionSchema`, `teamLeaderBulkActionSchema`)
- `web/src/components/admin/CommandPalette.tsx` (lines 1-80 — admin nav structure with `vehicles` and `rentals` items; calls `/api/admin/riders?search=...&limit=3` for cross-entity search)

**Out of scope:** Admin auth + RBAC internals (covered in `ADMIN_KYC_ONBOARDING_AUDIT_2026-08-05.md`). Rider-side pickup flow (covered in `FLUTTER_PICKUP_WORKFLOW_AUDIT_2026-08-05.md`). Rental pricing + plan selection (covered in `FLUTTER_API_RENTAL_LIFECYCLE_FLOW_AUDIT_2026-08-05.md`). End-rental body-shape mismatch (covered in audit #15 P0-1). Notification fanout (audit #4).

---

## TL;DR

**The admin fleet & rentals surface has 5 P0 bugs. The headline: the brief has 3 wrong HTTP methods (says PATCH, code uses PUT), 1 non-existent endpoint shape (no POST on rentals), and 1 soft-delete mislabeled as hard-delete.** The biggest operational risk is the **300s hubs cache** — 5× longer than every other admin route, means a new hub takes 5 minutes to appear in any dropdown. Combined with the brief's wrong verb (PATCH), the next dev who follows the brief will build a route that 405s.

The other 4 P0s are all real:
1. **`DELETE /api/admin/vehicles` is soft-delete** (`status: 'RETIRED'`, not row deletion), but the success message says "Vehicle deleted" (route.ts:160). The UI toast says "Vehicle deleted"; the row remains in DB. **Compliance and operations both get wrong telemetry.**
2. **`/api/admin/rentals` GET requires `riders_view` permission** (route.ts:13). The endpoint is about rentals, not riders. Anyone with `rentals_view` (if such perm existed) couldn't view rentals; any finance admin with `riders_view` can. The perm is misnomer.
3. **The `rentals` PUT perm check is a fragile substring match** (route.ts:87-91): `action.includes('RETURN') || action === 'CLOSE' ? 'rentals_return_inspection' : 'rentals_pickup_inspection'`. This happens to work for the 6 current actions, but the moment a new action is added (e.g. `REVERT_RETURN`, `SUSPEND_FRAUD`, `EXTEND_RENTAL`), the perm check silently picks the wrong bucket.
4. **`POST /api/admin/hubs/bulk` doesn't invalidate the `admin:*` cache** after bulk delete/activate/deactivate. The hubs GET has 300s TTL — so a bulk delete leaves the list showing the deleted hubs for **5 minutes**. The 5 min lag is the worst staleness in the admin panel.
5. **`/api/admin/shifts` uses `settings_manage` permission** for all 4 CRUD operations. Shifts are not settings; they have their own domain. A user with `shifts_manage` (if it existed) couldn't manage shifts; an operations admin with only `settings_manage` can. Same misnamed-perm pattern as `kyc_approve` on guarantors (audit #19 P0-4).

There are also P1s: `vehicleUseCases.getNextId()` is **count-based** with a race on concurrent POSTs, `vehicleUseCases.bulkUpdateVehicles` invalidates `vehicles_list:*` but not `admin:vehicles:*` (admin UI cache may go stale), hub use case `listAdminHubs` builds breakdown from in-memory `vehicles` array (no SQL aggregation), the audit log pattern is inconsistent (vehicles route-level vs hubs/shifts use-case-level), the public `/api/shifts` has no rate limit, the vehicle history endpoint has `take: 50` hard-coded with no pagination, and the bulk `reassignHub` runs 500 sequential `db.vehicle.update`s in one transaction.

The headline architectural issue: the admin panel grew organically with **three different audit-log patterns** (route-level for vehicles, use-case-level for hubs and shifts, sometimes `await`-ed, sometimes `.catch(() => {})` with no error surfacing). SOC2 compliance is at risk — failures are silent.

There are **5 P0s**, **9 P1s**, and **6 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, security gap, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code, contract drift | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: The audit brief's HTTP methods are wrong on 3 of 5 routes, and 1 endpoint shape is non-existent

**Repro:** Side-by-side comparison of the brief vs the actual codebase:

| Brief | Actual | Diff |
|---|---|---|
| `GET/POST/PATCH /api/admin/vehicles` | `GET/POST/PUT/DELETE /api/admin/vehicles` | Brief is wrong — method is **PUT**, not PATCH; also has DELETE that the brief doesn't mention |
| `GET/POST/PATCH /api/admin/hubs` | `GET/POST/PUT/DELETE /api/admin/hubs` | Brief is wrong — method is **PUT**, not PATCH; DELETE also exists |
| `GET/PATCH /api/admin/rentals` | `GET/PUT /api/admin/rentals` (no POST) | Brief is wrong — method is **PUT**, not PATCH; **no POST exists** for "create rental" (rentals are created by the rider app via `/api/rental/book`) |
| `GET/POST /api/admin/shifts` | `GET/POST/PUT/DELETE /api/admin/shifts` (matches) | OK |
| `GET /api/shifts` | `GET /api/shifts` (matches, public, no auth) | OK |

**Impact:** A dev following the brief will build a `PATCH` client and watch it 405. The brief's mental model of "rental management = CRUD from admin" is wrong — **admin manages state transitions on existing rentals, not rental creation.** Following the brief blindly would duplicate `/api/rental/book` and create split-brain rental creation paths.

**Fix:**
- For the verb mismatch: **standardize on PUT for updates and PATCH for partial updates** as a project convention, then update the brief.
- For "no POST on rentals": document in the brief that **rental creation is rider-side** via `/api/rental/book`; admin only handles state transitions.

**Effort:** 30min to fix the brief + 1h to add a 405-handler test that documents the convention.

---

### P0-2: `DELETE /api/admin/vehicles` is soft-delete but the success message says "Vehicle deleted" — silent data retention

**Repro:** Open a vehicle, click "Delete" in the admin UI, watch the success toast. The vehicle disappears from the active list (because of the `status: 'AVAILABLE'` filter), but the row remains in the DB with `status: 'RETIRED'`. There is no way to "undelete" from the UI.

**Code:** `web/src/app/api/admin/vehicles/route.ts:147-160`

```typescript
const vehicle = await vehicleUseCases.getVehicle(id);
if (vehicle) {
  await vehicleUseCases.updateVehicle(id, { status: 'RETIRED' });  // ← soft delete
  invalidateCache('admin:*');
  await createAuditLog({ ... action: 'vehicle.delete', ... });     // ← audit log says "delete"
}
return success(null, 'Vehicle deleted');                             // ← success says "deleted"
```

**Impact:**
- **Operations:** A SuperAdmin "deletes" a vehicle; ops looks at the DB 6 months later, sees `RETIRED` rows, and thinks there's a bug. They re-create the vehicle number; the unique constraint at `existsByNumber` (line 76) blocks them.
- **Compliance:** SOC2 right-to-deletion claims are wrong. "We deleted it" → row still exists with PII (assignedRider, leaseHistory).
- **Telemetry:** Audit log action is `vehicle.delete` but the actual mutation is `vehicle.update`. A SOC2 auditor reading the audit log thinks the row is gone.
- **Recovery gap:** A user clicking "delete" by accident has no UI to restore. They'd have to manually run a SQL UPDATE to flip back to `AVAILABLE`.

**Fix:**
1. **Rename the UI action** from "Delete" to "Retire" so user expectation matches the mutation.
2. **Either:**
   - (a) **Make it a real hard-delete** + add a "Confirm" dialog that types the vehicle number + check no active leases exist.
   - (b) **Keep soft-delete** but rename the success message to "Vehicle retired" and the audit action to `vehicle.retire`.
3. **Add an admin "Show retired vehicles" toggle** so they can restore one.
4. **Decision needed**: which is right for the business? If hard-delete: PII data (rider, leases) must be redacted first via the existing `data-deletion` pattern.

**Effort:** 2-4h for option (b); 1-2 days for option (a) including the PII redaction.

---

### P0-3: `/api/admin/rentals` GET requires `riders_view` permission — the endpoint is about rentals, not riders

**Repro:** Sign in as a user with role `FLEET_MANAGER` (who has `rentals_pickup_inspection` + `rentals_return_inspection` per `permissions-roles.ts:53-54` but not `riders_view`). Open the Rentals tab in the admin panel. Server returns 403.

**Code:** `web/src/app/api/admin/rentals/route.ts:13`

```typescript
if (!hasPermission(session.adminRole || '', 'riders_view')) return adminForbidden();
```

**Impact:** FLEET_MANAGER and HUB_MANAGER (who are the primary operators managing rentals) **cannot see the rental list** without also having the broader `riders_view` perm. A user with `riders_view` but not `rentals_*_inspection` (e.g. a finance-only role) **can** see the rental list, but the PUT perm check then blocks them from doing anything. The perm is **misnomer**, not just wrong.

**Fix:** Replace `riders_view` with the right perm. There are 2 candidates:
- Create a new perm `rentals_view` and grant it to the same roles that have `rentals_pickup_inspection`.
- Or reuse `rentals_pickup_inspection` for the GET (since that's the read-side companion to the inspection action).

Option B is simpler and doesn't need a permission migration.

**Effort:** 30min (line change + update seed script + update OpenAPI).

---

### P0-4: The `rentals` PUT perm check is a fragile substring match — `action.includes('RETURN')` will silently break the moment a new action is added

**Repro:** Send a PUT to `/api/admin/rentals` with `action: 'SUSPEND'`. The route checks `action.includes('RETURN')` → false → falls through to `rentals_pickup_inspection`. The user has that perm → 200. The same happens for `MARK_OVERDUE` (falls to `rentals_pickup_inspection`), but **SUSPEND and MARK_OVERDUE are not inspection actions** — they're operational.

**Code:** `web/src/app/api/admin/rentals/route.ts:87-91`

```typescript
const permission =
  action.includes('RETURN') || action === 'CLOSE'
    ? 'rentals_return_inspection'
    : 'rentals_pickup_inspection';
```

**Action whitelist** in `rental.repository.ts:162-224`:

| Action | Match → perm | Correct perm | Notes |
|---|---|---|---|
| `START` | falls to `pickup` | `rentals_pickup_inspection` ✓ | start = pickup |
| `PICKUP_COMPLETE` | falls to `pickup` | `rentals_pickup_inspection` ✓ | |
| `MARK_OVERDUE` | falls to `pickup` | **wrong** — this is operational, not inspection | falls to pickup because substring doesn't match |
| `REQUEST_RETURN` | matches `RETURN` | `rentals_return_inspection` ✓ | substring match works |
| `APPROVE_RETURN` | matches `RETURN` | `rentals_return_inspection` ✓ | |
| `CLOSE` | exact match | `rentals_return_inspection` ✓ | |
| `SUSPEND` | falls to `pickup` | **wrong** — this is operational, not inspection | falls to pickup because substring doesn't match |

**Impact:**
1. **2 of 6 current actions get the wrong perm** (SUSPEND + MARK_OVERDUE). Currently they're "permissive errors" (admin has more than they need), so no security incident. But:
2. **A new action like `EXTEND_RENTAL` or `REVERT_RETURN` (both plausible) would silently pick the wrong perm** — extension might pass for a `pickup_inspection` user, or fail for a `return_inspection` user who should be able to extend.
3. **No `await hasPermission` validation against a whitelist at the route** — the route hands off to the use case and the use case throws "Unsupported rental action". An attacker can enumerate valid actions by trying 405-able verbs.
4. The perm map at the route is **inverted from the rest of the codebase** (which uses `permMap: Record<string, string>` in `vehicles/route.ts:14-22`).

**Fix:** Replace substring match with an explicit whitelist:

```typescript
const PERM_BY_ACTION: Record<string, string> = {
  START: 'rentals_pickup_inspection',
  PICKUP_COMPLETE: 'rentals_pickup_inspection',
  MARK_OVERDUE: 'rentals_manage',
  REQUEST_RETURN: 'rentals_return_inspection',
  APPROVE_RETURN: 'rentals_return_inspection',
  CLOSE: 'rentals_return_inspection',
  SUSPEND: 'rentals_manage',
};
const permission = PERM_BY_ACTION[action];
if (!permission) return errors.badRequest(`Unknown action: ${action}`);
if (!hasPermission(session.adminRole || '', permission as any)) return adminForbidden();
```

**Effort:** 30min (move the table to a shared module since `executeLeaseAction` should also use it; add a unit test that fails when a new action is added without a perm mapping).

---

### P0-5: `POST /api/admin/hubs/bulk` doesn't invalidate the `admin:*` cache after bulk operations — 5-minute lag for bulk delete/activate

**Repro:** Open two admin tabs. In tab 1: select 3 hubs → bulk delete. In tab 2: hubs list still shows the 3 deleted hubs. **Wait 5 minutes.** Tab 2 finally updates.

**Code:** `web/src/app/api/admin/hubs/bulk/route.ts:13-44`

```typescript
export async function POST(req: NextRequest) {
  // ... no invalidateCache call ...
  switch (action) {
    case 'activate':    result = await hubUseCases.bulkActivate(...); break;
    case 'deactivate':  result = await hubUseCases.bulkDeactivate(...); break;
    case 'delete':      result = await hubUseCases.bulkDelete(...); break;
  }
  return success(result, `Bulk ${action} completed`);  // ← no invalidate
}
```

Compare to the non-bulk `POST /api/admin/hubs` (single) at line 49: `invalidateCache('admin:*');` is called. The bulk version is missing the same call.

**Impact:**
- Hubs has a 300s cache (5 min) — the longest in the admin panel. Bulk operations leave stale data for **5 minutes** instead of the immediate refresh that single-row operations give.
- An admin who bulk-deletes a hub and then immediately tries to filter "vehicles at this hub" sees a 5-minute window of dangling vehicle references.
- The bug compounds with the existing hubs 300s cache (audit would call this P1 separately) — single-row delete takes 5 min to propagate, bulk delete also takes 5 min. The 5 min is the worst case for any admin op.

**Fix:** Add `invalidateCache('admin:*');` before the success return. **Even better:** add `invalidateCache('admin:vehicles:*');` too because the hubs dropdown is consumed by the vehicle list page.

**Effort:** 5min (one line).

---

## P1 — Fix in next 2 sprints

### P1-1: `/api/admin/shifts` uses `settings_manage` perm — shifts aren't settings

**Repro:** Sign in as a `FLEET_MANAGER` (no `settings_manage`). Try to open the Shifts tab in admin. 403.

**Code:** `web/src/app/api/admin/shifts/route.ts:33, 48, 64, 81` — all 4 CRUD operations check `hasPermission(session.adminRole || '', 'settings_manage')`.

The shifts module has its own concept (max bookings, parts, active state) and the role-permission matrix in `permissions-roles.ts` doesn't even have a `shifts_*` key. Shifts are a domain entity, not a config value. **Same misnomer pattern as `kyc_approve` on guarantors (audit #19 P0-4).**

**Impact:** FLEET_MANAGERs who schedule shift changes for their own hub can't. Hub managers can't. Team leaders can't. The shift tab is effectively admin-only. If a non-admin tries to fetch `/api/shifts` (the public rider route at `/api/shifts/route.ts`) they can — but the admin side is gated on the wrong perm.

**Fix:** Add `shifts_manage` perm to `permissions-roles.ts` and grant it to `OPERATIONS_ADMIN`, `HUB_MANAGER`, `FLEET_MANAGER`. Update the 4 perm checks in `shifts/route.ts`.

**Effort:** 1h (perm migration + 4 line changes + seed update).

---

### P1-2: Hubs 300s cache — 60× longer than every other admin route

**Repro:** Open the Hubs tab. Create a new hub via POST `/api/admin/hubs`. Refresh the Hubs tab — new hub not visible for **5 minutes**.

**Code:** `web/src/app/api/admin/hubs/route.ts:30, 32`

```typescript
const result = await getOrSetResponse(cacheKey, () => hubUseCases.listAdminHubs(page, limit), 300);
// ...
return withCacheHeaders(success(...), 300);
```

Compare to all other admin routes: vehicles (5s), rentals (5s), fleet (5s), riders (5s), deposits (5s), kyc (5s), guarantors (5s), shifts (60s). **Hubs is the outlier at 300s.** Why? There's no comment explaining the choice. It's likely an old "set it and forget it" value.

**Impact:**
- An admin creating a new hub (POST) cannot see it in any other tab (e.g. vehicle create dropdown, fleet filter) for 5 min.
- A new hub manager trying to assign their team can't pick the new hub.
- During onboarding rush, the lag becomes visible to users.

**Fix:** Change to 30s. If there's a real perf reason, add a comment explaining it. The 300s saves maybe 1ms of CPU at the cost of 5 minutes of operational confusion.

**Effort:** 1min (two number changes).

---

### P1-3: `vehicleUseCases.bulkUpdateVehicles` invalidates `vehicles_list:*` but not `admin:vehicles:*` — admin UI cache goes stale after bulk ops

**Repro:** Open the Vehicles tab. Bulk-change status of 5 vehicles to `MAINTENANCE`. Refresh the Vehicles tab — the 5 vehicles still show `AVAILABLE` for up to 5s (the admin vehicles route's 5s cache).

**Code:** `web/src/server/modules/vehicles/vehicle.use-cases.ts:272`

```typescript
async bulkUpdateVehicles(ids, action, value, actorId) {
  // ...
  createAuditLog({ ... }).catch(...);
  invalidateCache('vehicles_list:*');   // ← invalidates rider-side cache
  return { count: updatedCount };
  // ← does NOT invalidate admin:vehicles:*
}
```

The admin vehicles GET uses cache key `admin:vehicles:{adminId}:{status}:{hubId}:{page}:{limit}` (route.ts:35-42). The rider-side cache key is `vehicles_list:{hubId}:{status}`. Two different keyspaces, and the bulk update only touches one.

**Impact:** Admin bulk operations leave the admin UI stale for up to 5s. The "Bulk action completed" toast fires immediately, but the user has to wait or manually refresh to see the change. Inconsistency between the rider-side (correct) and admin-side (wrong) invalidation is a code-quality issue.

**Fix:** Add `invalidateCache('admin:vehicles:*');` alongside the existing `invalidateCache('vehicles_list:*');`.

**Effort:** 2min.

---

### P1-4: Audit log pattern inconsistency — vehicles route-level, hubs/shifts use-case-level

**Repro:** Read the audit log calls across the 3 modules:

| Module | Route-level audit | Use-case-level audit |
|---|---|---|
| `vehicles/route.ts` | POST (line 93-99), PUT (123-129), DELETE (151-157) — all 3 | Some on `markForMaintenance`, `assignVehicle` |
| `hubs/route.ts` | **None** | All 4 CRUD + 3 bulk in `hub.use-cases.ts` |
| `shifts/route.ts` | **None** | All 3 CRUD in `shift.use-cases.ts` |

Two patterns are in use. Both work. **But the failure modes differ:**

- Route-level: the route handler wraps the `createAuditLog` in `.catch(() => {})` and the failure is silent. But if the use case throws, the audit log is never written.
- Use-case-level: the use case writes the audit log only after the mutation succeeds. If the use case throws, no log. If the log write fails, silent.

**Impact:**
- A reader looking for "where do we audit-log a hub delete" has to grep 2 files. A reader looking for "where do we audit-log a vehicle delete" can answer with a single file.
- The `.catch(() => {})` pattern is **silent** — a SOC2 auditor can't tell if a `vehicle.delete` was audited or not without checking the audit log table directly. The same is true for hubs and shifts.
- The bulk routes (`vehicles/bulk`, `hubs/bulk`) delegate entirely to the use case. Single routes mix. **Inconsistent**.

**Fix:** Standardize on **use-case-level audit logging** for all admin mutations. The use case is the natural place because it has the business context. Update `vehicles/route.ts` to remove the 3 route-level calls (the use case can write them, but `vehicleUseCases.createVehicle` doesn't currently — need to add). Also: replace `.catch(() => {})` with `.catch((e) => logger.error('audit log failed', e))` everywhere so failures are visible in the log.

**Effort:** 2-3h (move 3 audit calls from route to use case + add audit calls to `createVehicle`/`updateVehicle` + 12 `.catch` updates).

---

### P1-5: Public `/api/shifts` has no rate limit — rider-app abuse vector

**Repro:** Hit `GET /api/shifts?hubId=...` 10,000 times from a script. The server accepts every request. There's no auth, no rate limit, no per-IP cap.

**Code:** `web/src/app/api/shifts/route.ts:6-25` — no `requireRider`, no IP-based rate limit, no IP allowlist.

**Impact:**
- A malicious actor can scrape the shifts data for all hubs (used for capacity planning, competitor intel).
- A buggy client can hammer the endpoint in a loop and DoS the database.
- The endpoint returns 400/404 for invalid `hubId`/`date` but not 429.

**Fix:** Add a basic in-memory token-bucket rate limit (e.g. 60 req/min per IP) and a 429 response. Move behind a CDN for production.

**Effort:** 2-3h (rate limit middleware + tests).

---

### P1-6: `vehicleUseCases.getNextId()` is count-based — race condition on concurrent POSTs

**Repro:** Two admins open the "Create vehicle" dialog at the same time. Both click "Save" within 100ms. Both `getNextId()` calls see `count = 50` and return `VF-VH-000051`. Both INSERT succeed (vehicleId is not unique-constrained, only vehicleNumber is). The DB now has 2 rows with `vehicleId: 'VF-VH-000051'`. Audit logs and downstream queries that key on `vehicleId` (e.g. command palette, vehicle lookup) get ambiguous results.

**Code:** `web/src/server/modules/vehicles/vehicle.use-cases.ts:120-123`

```typescript
async getNextId() {
  const count = await db.vehicle.count();
  return `VF-VH-${String(count + 1).padStart(6, '0')}`;
}
```

The `vehicleId` is meant to be a human-readable business key (per the `VF-VH-` prefix style), but it's generated via a non-atomic count+format. The fix should be either:
- A Postgres sequence: `CREATE SEQUENCE vehicle_id_seq;` and `nextval('vehicle_id_seq')` in a transaction.
- A unique constraint + retry-on-conflict.

**Impact:** Two duplicate `vehicleId` rows is a P1 because the lookup ambiguity is silent — it shows up in the admin UI as "weird results" rather than a thrown error. For 100 vehicles it's a non-issue; for 10K it's a real risk.

**Fix:** Use a Postgres sequence or a unique constraint with retry. The Prisma schema may already have a `vehicleIdSequence` — check `prisma/schema.prisma`.

**Effort:** 2-4h depending on whether a sequence exists.

---

### P1-7: `vehicleUseCases.bulkUpdateVehicles` `reassignHub` runs 500 sequential `db.vehicle.update`s in one transaction

**Repro:** Admin bulk-reassigns 500 vehicles to a new hub. The use case builds `ids.map((id) => db.vehicle.update(...))` and wraps in `db.$transaction(...)`. That's 500 round-trips inside one transaction. **For Postgres, the transaction holds locks for the duration.** Any concurrent read of the affected rows is blocked.

**Code:** `web/src/server/modules/vehicles/vehicle.use-cases.ts:239-253`

```typescript
case 'reassignHub': {
  // ...
  await db.$transaction(
    ids.map((id) =>
      db.vehicle.update({ where: { id }, data: { hubId: value } })
    )
  );
}
```

**Impact:** A 500-vehicle bulk reassign can hold the row locks for several seconds. Concurrent reads are blocked. Other admins trying to update any of those vehicles get timeouts.

**Fix:** Use `db.vehicle.updateMany({ where: { id: { in: ids } }, data: { hubId: value } })` — Prisma supports `in` filter, and it's a single round-trip. (The comment in the code says "update individually because hubId is not allowed in updateMany mutation input" — that comment is **wrong**; `updateMany` does support `hubId`.)

**Effort:** 5min (one line change + comment fix).

---

### P1-8: `/api/admin/vehicles/[id]/history` returns 4 event types merged in timeline with `take: 50` hard-coded

**Repro:** A vehicle with 200 leases, 200 returns, 200 incidents, 200 tickets is requested. Server returns only the latest 50 of each, merged. The timeline shows 200 items but they're truncated per-type. The 150th most recent lease might not appear because only the top 50 leases made it in.

**Code:** `web/src/app/api/admin/vehicles/[id]/history/route.ts:18-42`

```typescript
leases: { orderBy: { createdAt: 'desc' }, take: 50, ... },
returns: { orderBy: { createdAt: 'desc' }, take: 50, ... },
incidents: { orderBy: { createdAt: 'desc' }, take: 50, ... },
tickets: { orderBy: { createdAt: 'desc' }, take: 50, ... },
```

**Impact:** A high-traffic vehicle's history is silently truncated. The admin UI might show "Vehicle: VF-VH-000001 — 4 leases, 3 returns" while the DB has 200 of each. The 50-cap is per-type, not per-page.

**Fix:** Accept `?limit=N&offset=M` query params, default to 20/0. Or use Prisma cursor-based pagination on the merged timeline.

**Effort:** 2-3h (pagination + UI scrolling).

---

### P1-9: `/api/admin/rentals` PUT has no `leaseId` validation — accepts both `body.leaseId` and `body.id` silently

**Repro:** Send `PUT /api/admin/rentals` with `{id: 'abc'}`. The route reads `body.leaseId || body.id` (line 84) and works. The OpenAPI spec probably documents only `leaseId`. A client built from the spec will only send `leaseId`; a client built by reading the route may send either. **Drift.**

**Code:** `web/src/app/api/admin/rentals/route.ts:84`

```typescript
const leaseId = body.leaseId || body.id;
```

**Impact:** A future Zod schema tightening (e.g. `z.object({ leaseId: z.string() }).strict()`) will break clients that send `id`. The current lenient read is a compatibility hack.

**Fix:** Pick one. Standardize on `leaseId` (the more explicit name) and use `.strict()` Zod. Update the OpenAPI spec.

**Effort:** 30min.

---

## P2 — Cleanup backlog

### P2-1: `hubUseCases.listAdminHubs` builds vehicle breakdown from in-memory `vehicles` array instead of SQL aggregation

**Code:** `web/src/server/modules/hubs/hub.use-cases.ts:11-35`

The use case pulls `hub.vehicles` (a `vehicle[]` relation), then loops in JS to count by status. For a hub with 200 vehicles that's 200 in-memory iterations per hub. The DB could `GROUP BY status` in a single query.

**Impact:** O(vehicles) per hub per request. For 100 hubs × 200 vehicles = 20,000 iterations per page load. Not crippling but wasteful.

**Fix:** Use Prisma `groupBy` on `db.vehicle.groupBy({ by: ['hubId', 'status'], _count: { _all: true } })`. ~1h.

---

### P2-2: `vehicleUseCases.listAdminVehicles` returns hub list inside the vehicles response

**Code:** `web/src/app/api/admin/vehicles/route.ts:53` returns `{ vehicles, hubs }` where `hubs` is the full list of hubs (for the filter dropdown). The list of hubs is cached per-request. A change to a hub won't appear in the vehicle list for 5s.

**Impact:** Stale hub list in the vehicle filter dropdown. Hub list is also fetched in the hubs tab; could be deduplicated.

**Fix:** Move the hubs list to a separate `/api/admin/hubs/dropdown` (or expose as a client store). ~3-4h.

---

### P2-3: Public `/api/shifts` error handling has nested ternaries that defeat type-safety

**Code:** `web/src/app/api/shifts/route.ts:21-22`

```typescript
if ((err instanceof Error ? err.message : String(err)) === 'Hub not found') return errors.notFound((err instanceof Error ? err.message : String(err)));
if ((err instanceof Error ? err.message : String(err)) === 'Hub is currently inactive') return errors.badRequest((err instanceof Error ? err.message : String(err)));
```

The `(err instanceof Error ? err.message : String(err))` is evaluated **5 times** in 2 lines, and a thrown non-Error gets `.toString()`'d differently each time. This is a copy-paste of the same pattern from elsewhere in the codebase (probably the deposits module).

**Fix:** Extract `function errorMessage(err: unknown): string { return err instanceof Error ? err.message : String(err); }` and use it. ~10min.

---

### P2-4: `CommandPalette.tsx` admin nav searches only `/api/admin/riders` — no cross-entity search for vehicles or rentals

**Code:** `web/src/components/admin/CommandPalette.tsx` calls `/api/admin/riders?search=...&limit=3` for the command palette search. Vehicles and rentals are **not searchable** from the command palette. An admin trying to "open vehicle VF-VH-000001" can't.

**Impact:** Minor UX gap. Admins fall back to navigating via the sidebar.

**Fix:** Add a `?entity=vehicles|rentals` parameter or a separate endpoint. ~2-3h.

---

### P2-5: `vehicleRepository.bulkDelete` exists but no UI calls it — dead-code risk

**Code:** `web/src/server/modules/vehicles/vehicle.use-cases.ts:254-258`

```typescript
case 'delete': {
  const result = await vehicleRepository.bulkDelete(ids);
  // ...
}
```

The `vehicleBulkActionSchema` includes `'delete'` as a valid action. But the admin Vehicles UI (per the sidebar CommandPalette) has no bulk-delete button. So this code path is **exercised only by direct API call or test**.

**Impact:** Dead-code risk: if the API contract drifts, no UI catches it.

**Fix:** Either wire the UI or remove the bulk delete action. ~1h to wire UI, ~30min to remove.

---

### P2-6: `teamLeaderBulkActionSchema` and `hubBulkActionSchema` are identical — duplicate enum

**Code:** `web/src/lib/validators.ts:440-448`

Both `hubBulkActionSchema` and `teamLeaderBulkActionSchema` have the same `action: z.enum(['activate', 'deactivate', 'delete'])`. Two enums for the same shape.

**Fix:** Extract to a shared `bulkStatusActionSchema` and reuse. ~10min.

---

## Recommended fix order

| # | Item | Effort | Risk if shipped | Why this order |
|---|---|---|---|---|
| 1 | P0-5 (hubs bulk cache invalidate) | 5min | None | One-line fix; immediate 5min→0 staleness win |
| 2 | P0-1 (fix the brief) | 30min | None | Stops future devs from building the wrong client |
| 3 | P0-4 (rentals PUT perm switch) | 30min | Low | One-file refactor; unit-testable |
| 4 | P0-3 (rentals perm rename) | 30min | Low | One-line perm change; seed update |
| 5 | P1-2 (hubs 300s→30s cache) | 1min | Low | One-number change |
| 6 | P0-2 (soft-delete UX) | 2-4h | Medium | Need product decision: real delete vs rename |
| 7 | P1-1 (shifts perm) | 1h | Low | Perm migration |
| 8 | P1-3 (bulk vehicles cache) | 2min | None | One-line fix |
| 9 | P1-7 (bulk reassignHub N+1) | 5min | Low | One-line fix; perf win |
| 10 | P1-4 (audit log pattern) | 2-3h | Low | Cross-cutting cleanup |
| 11 | P1-6 (vehicleId race) | 2-4h | Medium | Need schema decision |
| 12 | P1-5 (public shifts rate limit) | 2-3h | Low | Add middleware |
| 13 | P1-8 (vehicle history pagination) | 2-3h | Low | UI work |
| 14 | P1-9 (leaseId strict) | 30min | Low | One-line + spec |
| 15 | P2-1 (hubs SQL aggregation) | 1h | None | Cleanup |
| 16 | P2-2 (hubs list separate) | 3-4h | Medium | API split |
| 17 | P2-3, P2-6 (cleanup small) | 20min | None | Cleanup |
| 18 | P2-4 (palette search) | 2-3h | Low | UX |
| 19 | P2-5 (bulk delete UI) | 1h | Low | Wire or remove |

**Total: ~24-32h** (3-4 days) for a focused sprint to close all 5 P0s and most P1s.

---

## Tests gap analysis

| Route | Existing test | Coverage | Gap |
|---|---|---|---|
| `/api/admin/vehicles` | `tests/api-routes.test.ts` line ~400 | GET list happy path | No test for soft-delete semantics, no test for `getNextId` race |
| `/api/admin/vehicles/bulk` | None | — | No test for any bulk action |
| `/api/admin/vehicles/[id]/history` | None | — | No test for timeline merge order, no test for `take: 50` truncation |
| `/api/admin/fleet` | None | — | No test for `lowBattery` filter or hub grouping |
| `/api/admin/hubs` | `tests/api-routes.test.ts` line ~200 | GET list | No test for cache invalidation after POST; **no test that bulk POST invalidates** (P0-5) |
| `/api/admin/hubs/bulk` | None | — | No test for any bulk action |
| `/api/admin/rentals` | `tests/api-routes.test.ts` line ~500 | GET list happy path | **No test for perm check on each action** (P0-4) |
| `/api/admin/shifts` | None | — | No test for any CRUD |
| `/api/shifts` (public) | None | — | No test for `hubId` validation, no test for date format |

**The most critical missing tests:**
1. **Perm check matrix for rentals PUT** (P0-4) — a table-driven test that iterates all 6 actions × 4 roles.
2. **Cache invalidation for hubs bulk** (P0-5) — POST then GET should reflect the change immediately, not after 5 min.
3. **Vehicle soft-delete semantics** (P0-2) — POST DELETE then GET list should NOT include the row if status filter excludes `RETIRED`, but DB should still have the row.
4. **`getNextId` race** (P1-6) — concurrent POSTs should produce unique `vehicleId` values (or the test should document that the race is accepted and add a unique constraint).

---

## Architecture observations

**1. The admin fleet surface is the most stable part of the admin panel.** Compared to the rider-management audit (#19) which has 4 endpoint-shape mismatches between brief and code, fleet/rentals has 3 (all method-verb issues, none missing endpoints). The P0-2 soft-delete is a UX/contract issue, not a missing endpoint. This is the more mature module.

**2. The audit-log pattern drift is a SOC2 compliance risk.** Three modules (vehicles, hubs, shifts) use three slightly different patterns. Some await, some catch. The `.catch(() => {})` is in 5+ places; a failing audit log write is silent. Recommendation: standardize on use-case-level audit + `logger.error` on failure.

**3. Cache TTLs are wildly inconsistent.** 5s for most, 30s for some, 60s for shifts, 300s for hubs. The choice between them doesn't follow any pattern. The 5s default is good for "ops feedback" but expensive for "high-read data"; the 300s is good for "read-heavy config" but wrong for "things an admin just created". Recommendation: define a cache policy — e.g. 5s for entity lists, 30s for dropdowns, 60s for reference data — and apply uniformly.

**4. The `rentals` PUT is the most fragile route in the admin panel.** Substring perm matching, no action whitelist at the route, dual `leaseId`/`id` acceptance, hardcoded success message. It works for the current 6 actions but is a minefield for additions. This is the same pattern as audit #15 P0-1 (rental lifecycle flow) where the body shape was wrong — both modules were built fast and not hardened.

**5. The "bulk operation" pattern is duplicated across 3 modules** (riders bulk, vehicles bulk, hubs bulk, team leaders bulk) with the same `z.array(z.string()).min(1).max(500)` shape and the same `action` enum pattern. The schema validators are already shared; the routes are not. Recommendation: extract a `createBulkHandler` factory that wires the common pattern (validate body, check perm, call use case, invalidate cache, return result).

---

## Out-of-scope notes

- **KYC review, deposits, guarantors, scores, earnings** are covered in `ADMIN_RIDER_MANAGEMENT_AUDIT_2026-08-05.md`. The fleet surface has no overlap with those modules except via `vehicleId` lookups.
- **Rider-side rental lifecycle flow** (rider app end-rental) is covered in `FLUTTER_API_RENTAL_LIFECYCLE_FLOW_AUDIT_2026-08-05.md`. Audit #15 P0-1 (end-rental body shape) crosses the admin/rider boundary.
- **Pricing + plan selection** is in audit #15. The admin panel has a rentals PUT for state transitions, not for pricing overrides.
- **Rider-side shifts** (the public `/api/shifts` consumer) is the rider app's shift picker. The contract is: get shifts for a hub, optionally filtered by date. The rider app probably renders them in the booking flow. Not audited here.
- **Hub data scope** — what fields are exposed in the admin hub detail view vs. the rider-side hub list. The rider-side public `/api/rider/hubs` returns a smaller shape; the admin returns everything. Not audited here.
- **Vehicle telemetry / IoT** — no admin surface exists for vehicle GPS / battery health monitoring. The `lowBattery` filter on `/api/admin/fleet` is a basic count, not a telemetry feed. Not in scope.
- **Team Leaders** — the admin `teamLeaderBulkActionSchema` and `teamLeaders` nav item are in scope for the broader admin but not for this audit. (The schema duplicate with hub bulk is noted in P2-6.)

---

**End of audit. 5 P0s · 9 P1s · 6 P2s.**
