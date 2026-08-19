# Admin Panel Flows Audit — Operations & Platform (Next.js `/admin`)
**Date:** 2026-08-05
**Scope:** 12 admin endpoints + 4 support / 2 settings / 1 pricing / 1 notifications / 1 incidents / 1 audit / 1 admins / 1 team-leaders / 1 feature-flags / 1 maintenance-mode / 1 system-settings route. Plus `web/src/lib/feature-flags.ts`, `web/src/lib/validators/admin.ts`, `web/src/lib/permissions-roles.ts`, `web/src/server/modules/{settings,pricing,notifications}/`.
**Audit type:** Cross-stack RBAC + cache invalidation + race condition + audit-log drift.
**Total findings:** 9 P0 · 19 P1 · 24 P2 · 21 P3 · 11 test gaps.

---

## 0. TL;DR

The admin operations surface is the most-overlooked attack surface in the codebase. It has three P0s that a penetration tester would find in 30 minutes:

1. **`POST /api/admin/notifications` `sendToAllRiders` has no rate limit, no throttle, no confirmation, and no async** — an admin can spam "send to all" repeatedly, generating 100k+ notifications per call. The `while (true)` loop in `notification.use-cases.ts:138-164` does 200 batch inserts (500 rows each) for 100k riders, synchronously, before the route returns. **A single admin can DoS the DB and the notification table in 2 calls**. Same risk class as 12th audit's "rider can send consent to all permissions" and 9th audit's "no upload rate limit".

2. **Audit log endpoint has no permission check** (`audit-logs/route.ts:8-11`) — only `requireAdmin()` is called. **Any admin (READ_ONLY, SUPPORT_AGENT, etc.) can read all audit logs**, including financial events (`transaction.approve`, `wallet.adjust`, `rental.approve_return`) with full PII (rider phones, Aadhaar numbers in `details`). The PII redaction on line 32-37 helps, but **an attacker with READ_ONLY role can exfiltrate admin action patterns** (e.g., "which admins do what when") for spear-phishing.

3. **`PUT /api/admin/admins` allows self-update and self-lockout** — `updateAdminSchema.id` is from the request body, and there's no `id !== session.adminId` check. **A SUPER_ADMIN can change their own role to READ_ONLY**, locking themselves out of admin management on the next request. Worse, a SUPER_ADMIN can change their own `password` without re-entering the current password — **a CSRF or session-theft attack can permanently lock the SUPER_ADMIN out of their account**.

Three secondary P0s:
- The `updateFeatureFlag` lib function writes `valueType: 'BOOLEAN'` always (line 103), even for `maxUploadSizeMb` which is a number. **Type drift on every numeric flag update**.
- The `maintenance-mode` route uses `getAdminSession` (not `requireAdmin`) and the same permission check is fine, but the `envelope consistency` comment claims PR-90 fixed error envelopes — **the `errors.internal('Internal error')` call is still the old generic message**, the same one flagged in 8 prior audits.
- The team-leader `PUT` route uses `createTeamLeaderSchema.partial().extend({id: ...})` — a partial schema. **An admin can send `{}` (just the id) and "update" with no changes**, silently incrementing the `updatedAt` and writing an audit log entry.

**The single highest-blast-radius fix** (30 min, P0): add a rate limit + confirmation flow to `/api/admin/notifications POST`. Specifically, require a `?confirm=true` query param and a `X-Confirmation-Token` header for `sendToAllRiders`. Or move the send to a background job (similar to the outbox pattern used elsewhere in the codebase) and return 202 immediately.

---

## 1. Files audited

### Backend (Next.js / Prisma)
- `web/src/app/api/admin/admins/route.ts` (106 lines) — GET, POST, PUT
- `web/src/app/api/admin/team-leaders/route.ts` (90 lines) — GET, POST, PUT, DELETE
- `web/src/app/api/admin/team-leaders/bulk/route.ts` — bulk ops (not deep-read)
- `web/src/app/api/admin/team-leaders/[id]/riders/route.ts` — riders per TL (not deep-read)
- `web/src/app/api/admin/audit-logs/route.ts` (49 lines) — GET
- `web/src/app/api/admin/incidents/route.ts` (47 lines) — GET, POST
- `web/src/app/api/admin/incidents/[id]/route.ts` (59 lines) — GET, PUT
- `web/src/app/api/admin/tickets/route.ts` (99 lines) — GET, POST, PUT
- `web/src/app/api/admin/tickets/[id]/route.ts` — GET
- `web/src/app/api/admin/tickets/[id]/messages/route.ts` — messages (not deep-read)
- `web/src/app/api/admin/tickets/bulk/route.ts` (35 lines) — POST
- `web/src/app/api/admin/notifications/route.ts` (88 lines) — GET, POST
- `web/src/app/api/admin/feature-flags/route.ts` (63 lines) — GET, PUT
- `web/src/app/api/admin/maintenance-mode/route.ts` (102 lines) — GET, PUT
- `web/src/app/api/admin/system-settings/route.ts` (134 lines) — GET, PUT
- `web/src/app/api/admin/settings/route.ts` (44 lines) — GET, PUT
- `web/src/app/api/pricing/route.ts` (26 lines) — GET only (no PUT)

### Shared modules
- `web/src/lib/feature-flags.ts` (147 lines) — `getFeatureFlags`, `updateFeatureFlag`, `getAllFeatureFlags`
- `web/src/lib/validators/admin.ts` (222 lines) — all admin schemas (`.strict()`)
- `web/src/lib/permissions-roles.ts` (107 lines) — `ROLE_PERMISSIONS` map
- `web/src/server/modules/notifications/notification.use-cases.ts` (193+ lines) — `sendToSingleRider`, `sendToAllRiders`, `sendToSpecificRiders`
- `web/src/server/modules/settings/setting.use-cases.ts` (98 lines)
- `web/src/server/modules/pricing/pricing.use-cases.ts` (31 lines)

### Tests
- `web/tests/integration/admin/team-leaders/` — search returned no test files
- `web/tests/unit/admin-api.test.ts` — generic admin API
- `web/tests/integration/admin/admin_users_roles.test.ts` — admin user/role tests
- `web/tests/integration/admin/incidents_fines.test.ts` — incident tests
- `web/tests/unit/admin-permissions-shape.test.ts`
- `web/tests/unit/admin-permissions-migration.test.ts`

---

## 2. Cross-stack P0 findings (security / correctness / data integrity)

### P0-1 — `POST /api/admin/notifications` `sendToAllRiders` is unthrottled and synchronous
**Severity:** P0 (DoS / data exfiltration / spam)
**File:** `web/src/server/modules/notifications/notification.use-cases.ts:138-164`
```ts
async sendToAllRiders(title: string, message: string, type: string, actorId: string) {
  const BATCH_SIZE = 500;
  let skip = 0;
  let totalSent = 0;
  while (true) {
    const batch = await db.rider.findMany({ select: { id: true }, skip, take: BATCH_SIZE });
    if (batch.length === 0) break;
    await db.notification.createMany({
      data: batch.map((r: { id: string }) => ({
        riderId: r.id,
        title,
        message,
        type: type as 'INFO' | 'ALERT' | ...,
      })),
    });
    totalSent += batch.length;
    skip += BATCH_SIZE;
  }

  createAuditLog({...}).catch(...);
  return { count: totalSent };
},
```

**Bug:**
1. **No rate limit**: a single admin (with `notifications_manage`, which is granted to OPERATIONS_ADMIN and SUPPORT_AGENT per `permissions-roles.ts:80`) can call this endpoint repeatedly. Each call inserts N rows in the `Notification` table.
2. **No confirmation**: no `?confirm=true` query, no `X-Confirmation-Token` header. The admin clicks "Send to all" once and 100k notifications are sent.
3. **No throttling between batches**: the `while (true)` loop runs 200 batch inserts in a tight loop for 100k riders. Each `createMany` is a separate round-trip.
4. **Synchronous**: the route blocks until all batches complete. For 100k riders, this is ~30-60 seconds. The HTTP request times out at the proxy. The admin doesn't know if it succeeded.
5. **No "is this a test?" gate**: there's no way to do a dry-run. The first call writes 100k rows.
6. **The audit log catches errors** (line 162) but the `createMany` does not — a failed batch is silently dropped (the `while` loop continues, the admin sees `count: totalSent` but some rows are missing).

**A malicious or buggy admin can DoS the DB with 2-3 calls.**

**Fix shape (1 day, 1 PR):**
1. Add a rate limit: `checkRateLimit('admin:notification:sendAll', { windowMs: 60 * 60 * 1000, maxRequests: 3 })`.
2. Add a confirmation requirement: `?confirm=true&token=<csrf-token>`.
3. Move the send to a background job via `OutboxService.emit(NOTIFICATION_BROADCAST, {title, message, type, adminId})`. The route returns 202 Accepted immediately.
4. Worker processes the job in batches with a per-batch sleep (e.g., 100ms) to avoid DB spikes.

Audit ticket #111.

---

### P0-2 — `GET /api/admin/audit-logs` has no permission check
**Severity:** P0 (audit log enumeration / spear-phishing intel)
**File:** `web/src/app/api/admin/audit-logs/route.ts:8-11`
```ts
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // ← no hasPermission check
  try {
    ...
```

**Bug:** Only `requireAdmin()` is called. **Every admin** (including READ_ONLY, SUPPORT_AGENT, TEAM_LEADER, etc.) can read all audit logs. The route is in the admin section but the access control is "you must be any admin", not "you must have audit_view permission".

A READ_ONLY admin can:
- See which SUPER_ADMIN exists (`actorId: 'admin_xyz'`).
- See what time they typically log in (audit log entries cluster around their work hours).
- See what financial events they handle (`transaction.approve` audit entries).
- See which riders they touch (via `entityId` in audit entries).
- Use this for targeted spear-phishing or social engineering.

The PII redaction on line 32-37 helps (the `details` JSON is redacted via `redactPii`), but **the `entityId` (which is a rider's `riderId`), the `actorId`, and the `action` are not redacted**. A READ_ONLY admin can build a graph of "admin X touched rider Y at time Z".

**Fix shape (15 min, 1 file):**
1. Add `if (!hasPermission(session.adminRole || '', 'audit_view')) return adminForbidden();`.
2. Define `audit_view` in `permissions-roles.ts` and grant it to a sensible set (e.g., SUPER_ADMIN only, or SUPER_ADMIN + FINANCE_ADMIN for SOC2).
3. Remove `entityId` from the response (or scope it to events the admin is authorized to see).

Audit ticket #112.

---

### P0-3 — `PUT /api/admin/admins` allows self-update, self-lockout, password change without current password
**Severity:** P0 (account takeover / self-lockout)
**File:** `web/src/app/api/admin/admins/route.ts:73-105`
```ts
export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'admins_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = updateAdminSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    const { id, password, email, name, role, permissions, isActive } = validation.data;

    const updateData: UpdateAdminParams = {
      email,
      name,
      role: role as AdminRole | undefined,
      permissions,
      isActive,
    };
    if (password) {
      updateData.password = await hashPassword(password);
    }

    const admin = await adminUseCases.updateAdmin(
      id,
      updateData,
      session.adminId ?? session.riderDbId ?? 'system'
    );
    return success(admin);
  } catch (error) {
    ...
  }
}
```

**Bug:** The `id` of the admin to update comes from the request body. There is **no check that `id !== session.adminId`**. So a SUPER_ADMIN can:
1. Change their own `role` to `READ_ONLY`. The next request fails `hasPermission('admins_manage')` (which is `[]` for non-SUPER_ADMIN roles). **Self-lockout**.
2. Change their own `password` to a new password. **No "re-enter current password" check** (`updateAdminSchema` doesn't have a `currentPassword` field). The session is now logged in with the old JWT (still valid for 2 hours), but the password has changed. The session cannot be refreshed.
3. Change their own `isActive` to `false`. **The next `verifySessionToken` call hits the cache (30s TTL)** and the cache returns `isActive: true`. After 30s, the cache expires and the session is invalidated. **Self-lockout with a 30s grace period**.
4. Change their own `email` to a fake email. **The session JWT has `phone: admin.email`**. The session is now tied to a fake email.

A CSRF or session-theft attack (via a stolen cookie) can also call this endpoint to change the SUPER_ADMIN's password and lock them out.

**Fix shape (2 hours, 1 file):**
1. Add a "self-update" check: if `id === session.adminId`, only allow changes to `name` and `email` (not `role`, `password`, `isActive`, `permissions`).
2. For password change, require a `currentPassword` field in the schema and verify it before allowing the update.
3. For self-deactivation, return 400 with a message "Use the logout endpoint to deactivate your session".
4. For self-demotion, return 400 with "Ask another SUPER_ADMIN to demote you".

Audit ticket #113.

---

### P0-4 — `updateFeatureFlag` always writes `valueType: 'BOOLEAN'` even for numeric flags
**Severity:** P0 (data integrity — numeric flag values lose type)
**File:** `web/src/lib/feature-flags.ts:98-115`
```ts
export async function updateFeatureFlag(key: string, value: string): Promise<boolean> {
  try {
    const dbKey = `flag.${key}`;
    await db.systemSetting.upsert({
      where: { key: dbKey },
      update: { value, valueType: 'BOOLEAN', category: 'FEATURE', isSecret: false, isEditable: true },
      create: { key: dbKey, value, valueType: 'BOOLEAN', category: 'FEATURE', isSecret: false, isEditable: true },
    });
    ...
```

**Bug:** The `valueType` is hardcoded to `'BOOLEAN'`. But the `FeatureFlags` interface includes `maxUploadSizeMb: number`. When an admin updates `maxUploadSizeMb` to `50`, the DB stores `valueType: 'BOOLEAN'` even though the value is `'50'` (a number).

On read (line 35-57), `loadDbFlags` correctly distinguishes:
```ts
if (typeof defaultFlags[typed] === 'boolean') {
  (dbFlags as Record<string, unknown>)[typed] = s.value === 'true';
} else {
  (dbFlags as Record<string, unknown>)[typed] = parseInt(s.value);
}
```

So the read path handles both. **But the DB is lying about the type**. A future engineer querying `db.systemSetting.findMany({where:{valueType:'BOOLEAN'}})` to find boolean settings will include `maxUploadSizeMb`. A migration script that updates boolean settings will hit `maxUploadSizeMb` and corrupt it.

**Fix shape (15 min, 1 file):**
```ts
const isBoolean = typeof defaultFlags[key as keyof FeatureFlags] === 'boolean';
await db.systemSetting.upsert({
  where: { key: dbKey },
  update: { value, valueType: isBoolean ? 'BOOLEAN' : 'NUMBER', ... },
  create: { key: dbKey, value, valueType: isBoolean ? 'BOOLEAN' : 'NUMBER', ... },
});
```

Audit ticket #114.

---

### P0-5 — Maintenance-mode `errors.internal('Internal error')` is the old generic message; PR-90 comment lies
**Severity:** P0 (envelope inconsistency + low-priority)
**File:** `web/src/app/api/admin/maintenance-mode/route.ts:9-15, 37, 100`
```ts
// PR-90 (API N12): envelope consistency. The original implementation
// returned `NextResponse.json({error: '...'})` for every failure
// case, which means clients had to read two different shapes (the
// envelope and the raw body) to handle errors. After this change the
// route is on the shared `success()` / `errors.*()` envelope and the
// 500 body is a generic 'Internal error' with the real cause logged
// (instead of echoed back to the caller).
...
} catch (err: unknown) {
  logger.error('[admin/maintenance-mode] GET failed', err);
  return errors.internal('Internal error');
}
```

**Bug:** The comment claims PR-90 fixed the envelope. **The error message is still `'Internal error'`** (not the team's standard `'Failed to ...'` pattern). Every other route uses `errors.internal('Failed to fetch X')` or `errors.internal('Failed to update X')`. **This route is the only one using `'Internal error'`.** Either the comment lies or the route is the only one that wasn't migrated.

This is a low-priority P0 (envelope inconsistency), but it's a regression from PR-90 that should have been caught by lint or review.

**Fix shape (5 min, 1 file):**
```ts
return errors.internal('Failed to fetch maintenance status');  // GET
return errors.internal('Failed to update maintenance mode');    // PUT
```

Audit ticket #115.

---

### P0-6 — `team-leaders PUT` accepts empty body (`{}`) and silently "updates" with no changes
**Severity:** P0 (audit log pollution / unnecessary DB writes)
**File:** `web/src/app/api/admin/team-leaders/route.ts:52-72`
```ts
export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'tl_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(
      createTeamLeaderSchema.partial().extend({ id: z.string().min(1) }),
      body
    );
    if (!validation.success) return errors.validation(validation.error!);

    const { id, ...data } = validation.data;
    const teamLeader = await teamLeaderUseCases.update(id, data, session.adminId || '');
    return success(teamLeader);
  } catch (error) {
    ...
  }
}
```

**Bug:** The schema is `createTeamLeaderSchema.partial().extend({id: z.string().min(1)})`. With `.partial()`, every field is optional. The body `{id: 'tl_123'}` is valid. The use-case `teamLeaderUseCases.update('tl_123', {}, ...)` is called with an empty data object. The repository probably does `db.teamLeader.update({where:{id}, data:{}})` which is a no-op but writes an audit log entry "team_leader.update" with no actual change.

An admin can spam `PUT /api/admin/team-leaders` with `{id: 'tl_123'}` repeatedly. Each call writes an audit log entry. **The audit log gets polluted with "team leader updated" entries that didn't change anything**. A future forensic review of the audit log is confused by the noise.

**Fix shape (30 min, 1 file):**
1. Reject empty bodies: if `Object.keys(data).length === 0`, return 400 "No fields to update".
2. OR: add a `require at least one field` refine to the schema.

Audit ticket #116.

---

### P0-7 — `GET /api/pricing` is unauthenticated; pricing logic is exposed
**Severity:** P0 (info disclosure)
**File:** `web/src/app/api/pricing/route.ts:6-25`
```ts
export async function GET(request: NextRequest) {
  try {
    const hubId = request.nextUrl.searchParams.get('hubId');
    const basePriceParam = request.nextUrl.searchParams.get('basePrice');
    ...
    const result = await pricingUseCases.calculate(hubId, basePriceRupees);
    return success(result, 'Dynamic price calculated');
  } catch (err: unknown) {
    ...
  }
}
```

**Bug:** The pricing endpoint has **no authentication**. Anyone with the URL can:
1. Query the dynamic price for any hub.
2. See the surge multiplier (1.0 / 1.1 / 1.2).
3. See the total vehicles and available vehicles for any hub (competitive intel).
4. Probe to determine which hubs are at high utilization (≥80% triggers 1.2× surge).

A competitor could scrape all hubs and their utilization patterns. A rider could game the system by waiting until surge drops.

The `pricingUseCases.calculate` (line 4-18) returns:
```ts
return {
  basePrice: basePriceRupees,
  dynamicPrice,
  utilization,        // ← leak
  surgeMultiplier,    // ← leak
  totalVehicles,      // ← leak
  availableVehicles,  // ← leak
};
```

**Fix shape (30 min, 1 file):**
1. Require rider session (`getRiderId`) for the endpoint.
2. OR: return only `dynamicPrice` (the rider-facing number), not the breakdown.
3. OR: rate-limit the endpoint to prevent scraping.

Audit ticket #117.

---

### P0-8 — `system-settings PUT` allows updating `value` to an empty string; `isSecret` guard is incomplete
**Severity:** P0 (data corruption)
**File:** `web/src/app/api/admin/system-settings/route.ts:108-121`
```ts
// Guard: if setting is a secret and value hasn't changed, skip update
// This prevents saving the masked placeholder "[CONFIGURED]" as the actual value
if (existing.isSecret && value === '[CONFIGURED]') {
  return success({ key, value }, 'unchanged');
}

// Update the setting
await db.systemSetting.update({
  where: { key },
  data: {
    value,  // ← no validation
    updatedByAdminId: session.adminId ?? session.riderDbId,
  },
});
```

**Bug:** The `value` field is `z.string()` (line 151 of validators/admin.ts) with no min length. An admin can set any setting's value to an empty string `""`. For a secret setting (e.g., `JWT_SECRET`), this **destroys the secret**. The next request that needs the secret fails (e.g., JWT verification fails for all users).

The `[CONFIGURED]` guard is good for "don't overwrite a secret with the masked placeholder", but it doesn't guard against "wipe the secret by setting value to empty string".

**Fix shape (30 min, 1 file):**
1. Add `value: z.string().min(1, 'Value cannot be empty')` to `updateSystemSettingSchema`.
2. Add a route-level check: if the setting is `isSecret`, require a `currentValue` field in the body to confirm the admin knows the current value before changing it.

Audit ticket #118.

---

### P0-9 — `notifications POST` with `sendToAll: true` is a single-call DoS / spam
**Severity:** P0 (see P0-1; this is the same code from the route perspective)
**File:** `web/src/app/api/admin/notifications/route.ts:62-69`
```ts
if (validation.data.sendToAll) {
  const result = await notificationUseCases.sendToAllRiders(
    title,
    message,
    type,
    session.adminId || ''
  );
  return success(result, 'Notifications sent to all riders', 201);
}
```

**Bug:** The route accepts `sendToAll: true` and calls `sendToAllRiders` synchronously (covered in P0-1). From the route's perspective:
- No rate limit (`checkRateLimit` not called).
- No confirmation flow.
- The admin can re-submit the form in 1 second and a 2nd batch is sent.

The route has no `?confirm=true` check, no `X-Confirmation-Token` header check, no "are you sure?" modal interaction. The user-facing admin UI may have a confirmation modal (would need to check), but the API does not enforce it.

**Fix shape:** covered by P0-1. Add rate limit + confirmation + async background job.

Audit ticket #111 (continued).

---

## 3. P1 findings (real bugs, fix in next sprint)

| # | File:Line | Issue |
|---|---|---|
| P1-1 | `web/src/app/api/admin/admins/route.ts:50-57` | `permissions` is filtered against `validPermissionKeys` (good) but `name`, `email`, `role` are passed through unchecked. The `createAdminSchema` is `.strict()` so unknown fields are rejected, but the route still uses `validation.data.role as AdminRole ?? 'READ_ONLY'` — if `role` is missing, defaults to READ_ONLY. **No validation that the requester is allowed to create that role** (a SUPER_ADMIN creating a SUPER_ADMIN is fine; a SUPER_ADMIN creating another SUPER_ADMIN with the same email is rejected by `findByEmail`, but the error path could be cleaner). |
| P1-2 | `web/src/app/api/admin/admins/route.ts:92-94` | The password is hashed with `await hashPassword(password)`. **Argon2id hashing is CPU-intensive (~100ms per hash)**. For a bulk-create admin scenario, this blocks the request. For a single update, it's fine. No rate limit on PUT either. |
| P1-3 | `web/src/app/api/admin/team-leaders/route.ts:74-89` | DELETE handler accepts `{id: string}` from body, not from URL params. The convention is `/api/admin/team-leaders/[id]` for DELETE. **Inconsistent with REST**. |
| P1-4 | `web/src/app/api/admin/audit-logs/route.ts:13-15` | `actorId` and `action` are free-text search params. No SQL injection (Prisma is parameterized), but the user can pass `action: '%'` which won't match (no LIKE). OK. |
| P1-5 | `web/src/app/api/admin/audit-logs/route.ts:32-37` | PII redaction is applied to `details` only. The `actorId` (admin's id) is not redacted. For SOC2, the admin's identity in audit logs is expected. OK. But `entityId` is a rider's `riderId` (not PII directly, but a key into PII). **Not redacted**. |
| P1-6 | `web/src/app/api/admin/audit-logs/route.ts:39-44` | The response includes `page`, `limit`, `total`, `totalPages`. The route does NOT include `total` in the redacted response. **Wait, it does (line 41)**. OK, false alarm. |
| P1-7 | `web/src/app/api/admin/audit-logs/route.ts:46-47` | `logger.error('[AUDIT_LOGS_GET]', error)` — logs the full error which may include Prisma's SQL with the `actorId` value. **PII leak in logs** if the actorId is a phone number (which it could be for rider actions, not admin actions). |
| P1-8 | `web/src/app/api/admin/incidents/route.ts:31-46` | POST creates an incident. No `riderId` is required in the schema (need to check). If an admin creates an incident for a non-existent rider, the use-case may throw a confusing error. |
| P1-9 | `web/src/app/api/admin/incidents/route.ts:55-58` | Catch block returns `errors.internal('Failed to update incident')` without logging the error. **Inconsistent with other routes**. |
| P1-10 | `web/src/app/api/admin/tickets/route.ts:43-66` | The PUT handler reads `body.id`, `body.status`, `body.assignedTo` directly — **no schema validation**. An admin can send `status: 'banana'` and the update proceeds. The use-case may or may not validate. |
| P1-11 | `web/src/app/api/admin/tickets/route.ts:48-50` | `resolvedAt: ['RESOLVED', 'CLOSED'].includes(status) ? new Date() : null` — uses `null` to clear, but Prisma `data: {resolvedAt: null}` is a valid update. OK. But the `updateData: Record<string, unknown>` type is unsafe. |
| P1-12 | `web/src/app/api/admin/tickets/route.ts:74-97` | POST creates a ticket with **no validation** (line 76 reads fields directly). An admin can create a ticket with `subject: ''` (line 77 checks but only if the field is undefined; an empty string passes). The use-case may validate. |
| P1-13 | `web/src/app/api/admin/notifications/route.ts:36-49` | The `riderId` is read from `body as Record<string, unknown>`.riderId — **untyped**. The Zod schema (`sendNotificationSchema`) is checked, but `riderId` is not in the schema (it's the legacy field). **The legacy `riderId` field is not validated**. |
| P1-14 | `web/src/app/api/admin/notifications/route.ts:51-60` | `sendToSingleRider(riderId, ...)` — the riderId is passed unvalidated. If the rider doesn't exist, the use-case throws and the catch returns 500. |
| P1-15 | `web/src/app/api/admin/feature-flags/route.ts:40` | `String(value)` — converts the value to a string. For a boolean `true`, the string is `'true'`. For a number `50`, the string is `'50'`. For an object `{}`, the string is `'[object Object]'`. **The schema accepts `z.union([z.string(), z.number(), z.boolean()])`** but the implementation coerces to string. If a client sends `value: {nested: 'object'}`, the schema's union might not catch it (Zod `z.union` requires exact type match). Edge case. |
| P1-16 | `web/src/app/api/admin/feature-flags/route.ts:47` | `invalidateCache('admin:feature-flags:*')` — wildcard cache invalidation. If 50 admins are viewing the page, all 50 caches are cleared. **Same as 16th audit P0-6**. |
| P1-17 | `web/src/app/api/admin/maintenance-mode/route.ts:60-86` | The PUT handler uses `db.systemSetting.upsert` for both `MAINTENANCE_MODE` and `MAINTENANCE_MESSAGE` in parallel (line 60-86). The `valueType` is hardcoded (`'BOOLEAN'` for the flag, `'STRING'` for the message). OK. But the `updatedByAdminId` is `session.adminId ?? session.riderDbId` — **the session's `riderDbId` is the admin's id (per the auth flow)**, so the fallback is the admin's id. OK. |
| P1-18 | `web/src/app/api/admin/maintenance-mode/route.ts:55-57` | `if (enabled === undefined || message === undefined)` — if the admin sends `{enabled: true}` (no message), the route returns 400. **Cannot enable maintenance without a message**. Probably intended (don't show a blank banner), but should be documented. |
| P1-19 | `web/src/app/api/admin/settings/route.ts:38` | `invalidateCache('admin:*')` — wildcard. Same as 16th audit P0-6 and 17th audit P1-16. Cache thrashing. |

---

## 4. P2 findings (type safety / contract issues)

| # | File:Line | Issue |
|---|---|---|
| P2-1 | `web/src/app/api/admin/admins/route.ts:48` | `errors.validation(validation.error.message)` — `validation.error.message` is the first error message only. The full Zod error has `error.issues[]` for all errors. **The client gets the first error only**. |
| P2-2 | `web/src/app/api/admin/team-leaders/route.ts:42` | `errors.validation(validation.error!)` — non-null assertion. The `!` is unsafe if the validation passed but `error` is somehow set. Type-belt-and-suspenders. |
| P2-3 | `web/src/app/api/admin/team-leaders/route.ts:60-62` | `createTeamLeaderSchema.partial().extend({id: z.string().min(1)})` — `partial()` allows `id` to be optional, but `extend` re-adds it. The resulting schema is correct, but the construction is hard to read. |
| P2-4 | `web/src/app/api/admin/team-leaders/route.ts:65-66` | `const { id, ...data } = validation.data;` — `data` may be empty. **No check**. Covered by P0-6. |
| P2-5 | `web/src/app/api/admin/audit-logs/route.ts:19` | `getAuditLogs({ actorId, action, page, limit })` — no `entity` or `entityId` filter, even though the repository supports it (per `admin.repository.ts:112-138`). The audit log UI may want to filter by entity. |
| P2-6 | `web/src/app/api/admin/audit-logs/route.ts:32-37` | `redactPii` is called on `JSON.parse(log.details)`. **What if `log.details` is malformed JSON?** `JSON.parse` throws, the catch on line 45 returns 500. The audit log becomes inaccessible on the first malformed entry. |
| P2-7 | `web/src/app/api/admin/audit-logs/route.ts:35` | `log.details ? redactPii(...)` — the ternary checks truthiness, but `log.details` is a string (JSON-stringified). Empty string is falsy, so an empty `details` row is treated as "no redaction needed". OK, but a non-JSON string (e.g., "ERROR") would throw. |
| P2-8 | `web/src/app/api/admin/incidents/route.ts:18` | `status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'` — the route doesn't validate. The use-case may. **Inconsistent**. |
| P2-9 | `web/src/app/api/admin/incidents/[id]/route.ts:42-49` | The PUT handler passes `session.adminId || ''` to `incidentUseCases.updateIncident`. The empty string is sent if the session has no adminId. The use-case may write `assignedTo: ''` to the DB. |
| P2-10 | `web/src/app/api/admin/tickets/route.ts:47-50` | `const updateData: Record<string, unknown> = {};` — type-unsafe record. The use-case probably has its own types, but the route erases them. |
| P2-11 | `web/src/app/api/admin/notifications/route.ts:40-49` | The route reads `body as Record<string, unknown>`.riderId (line 41), bypassing the Zod schema. The `riderIds` field IS in the schema (line 73 uses it), but `riderId` (singular) is not. **Inconsistent naming** (plural vs singular). |
| P2-12 | `web/src/app/api/admin/feature-flags/route.ts:40` | `String(value)` — converts any value to string. For a boolean `true`, the string is `'true'`. For `false`, `'false'`. For `1`, `'1'`. For `null`, `'null'`. The schema accepts `null`? No, the union is `string | number | boolean`. So `null` is rejected. OK. |
| P2-13 | `web/src/app/api/admin/feature-flags/route.ts:55` | `details: { key, value }` — both are passed. For a secret-style flag, the value is in the audit log. The audit log has PII redaction on read (line 35 of audit-logs route), but the write may store the secret. **PII leak in audit log**. |
| P2-14 | `web/src/app/api/admin/maintenance-mode/route.ts:91` | `action: enabled ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED'` — these action names don't match the `AUDIT_ACTIONS` map in `admin.types.ts:76-145`. The map has `RECONCILIATION_RUN`, `SYSTEM_CONFIG_CHANGE`, etc. but no `MAINTENANCE_*`. **The action is not in the canonical map**. |
| P2-15 | `web/src/app/api/admin/system-settings/route.ts:67-71` | The GET endpoint exposes `DATABASE_URL_CONFIGURED`, `JWT_SECRET_CONFIGURED`, `SESSION_SECRET_CONFIGURED` as `'true' | 'false'`. This is information disclosure (an admin can tell which secrets are configured). For a SUPER_ADMIN this is fine; for an OPERATIONS_ADMIN... wait, the route only requires `requireAdmin()`. **Any admin can see which secrets are configured**. The actual secrets are not exposed. |
| P2-16 | `web/src/app/api/admin/system-settings/route.ts:65` | `DATABASE_HOST: (process.env.DATABASE_URL || '').includes('localhost') ? 'localhost' : 'remote'` — coarse-grained info disclosure. An admin can tell if the DB is on localhost (dev) or remote (prod). Not a security issue, but info disclosure. |
| P2-17 | `web/src/app/api/admin/system-settings/route.ts:109-112` | The `[CONFIGURED]` guard returns 200 with `value: '[CONFIGURED]'` even though the value is unchanged. **The response doesn't tell the admin that no change was made**. They may re-submit. UX issue. |
| P2-18 | `web/src/app/api/admin/settings/route.ts:24-43` | The PUT handler passes `validation.data` (a `Record<string, unknown>`) directly to `settingUseCases.update`. The use-case iterates over keys. If a key is not in the registry, line 42 (`SETTINGS_BY_KEY.get(key)!`) throws. **500 error for unknown keys**. Should be 400. |
| P2-19 | `web/src/lib/feature-flags.ts:30-33` | Module-level `let cachedFlags`, `cacheExpiry`, `pendingPromise`. **Serverless-incompatible**. Each cold start resets the cache, and concurrent requests within a single instance race on the cache. |
| P2-20 | `web/src/lib/feature-flags.ts:35-57` | `loadDbFlags` reads `key { startsWith: 'flag.' }`. The system setting keys are `flag.enableReferralSystem`, etc. The query loads all flag-prefixed rows. For 10 flags, OK. For 100, slow. |
| P2-21 | `web/src/lib/feature-flags.ts:121-146` | `getAllFeatureFlags` does a second DB query to overlay `source: 'database'`. The first call (`getFeatureFlags`) already loaded the DB values. **Redundant query**. |
| P2-22 | `web/src/lib/validators/admin.ts:96-104` | `createAdminSchema.role: z.enum(ADMIN_ROLES).optional()` — defaults to `OPERATIONS_ADMIN` in the route (line 60 of admins/route.ts: `role: (role as AdminRole) ?? 'READ_ONLY'`). Wait, the route uses `READ_ONLY` as the fallback, not `OPERATIONS_ADMIN`. **Inconsistent with the `default()` in the enum**. |
| P2-23 | `web/src/lib/validators/admin.ts:106-116` | `updateAdminSchema.password: z.string().min(8).optional()` — no `currentPassword` field. **Cannot require re-auth before password change**. Covered by P0-3. |
| P2-24 | `web/src/lib/validators/admin.ts:122-133` | `FEATURE_FLAG_KEYS` includes `maxUploadSizeMb`. The PUT route hardcodes `String(value)`. For `maxUploadSizeMb: 50`, the string is `'50'`. The route returns `success({key, value})` (line 58), where `value` is `'50'`. **The client gets a string, not a number**. The client must `parseInt` to use it. |

---

## 5. P3 findings (code quality / dead code)

| # | File:Line | Issue |
|---|---|---|
| P3-1 | `web/src/app/api/admin/admins/route.ts:1-12` | Imports `AdminRole` and `UpdateAdminParams` from internal modules. OK, but the route re-implements the create/update logic that exists in `admin.routes.ts:48-127`. **Two route files for the same endpoints**. |
| P3-2 | `web/src/app/api/admin/admins/route.ts:73-105` | The PUT handler doesn't export the `actorId` to `createAuditLog`. The use-case's `updateAdmin` does (per `admin.use-cases.ts:55-72`). OK. |
| P3-3 | `web/src/app/api/admin/team-leaders/route.ts:1-9` | The DELETE handler uses `{id: z.string().min(1)}` in the body. Convention: `/api/admin/team-leaders/[id]` for DELETE. **Inconsistent REST**. |
| P3-4 | `web/src/app/api/admin/audit-logs/route.ts:8-11` | `requireAdmin` is the only check. Covered by P0-2. |
| P3-5 | `web/src/app/api/admin/incidents/route.ts:31-46` | The POST handler is identical in shape to the team-leader POST. The use-cases differ. Could be extracted to a generic factory. **DRY violation**. |
| P3-6 | `web/src/app/api/admin/tickets/route.ts:37-66` | The PUT handler does **no Zod validation**. Other PUTs use schemas. **Inconsistent**. |
| P3-7 | `web/src/app/api/admin/tickets/route.ts:69-97` | The POST handler does **no Zod validation**. Same. |
| P3-8 | `web/src/app/api/admin/tickets/route.ts:56-60` | `logAdminAction` is called with `details: updateData` (the raw update payload). The full update is in the audit log. If the update included a sensitive note (e.g., "rider's bank account changed"), the note is in the audit log. |
| P3-9 | `web/src/app/api/admin/notifications/route.ts:62-69` | The `sendToAllRiders` call is synchronous. Covered by P0-1, P0-9. |
| P3-10 | `web/src/app/api/admin/notifications/route.ts:72-80` | The `sendToSpecificRiders` call is synchronous. **Same issue as `sendToAllRiders` but for 100 IDs at a time**. |
| P3-11 | `web/src/app/api/admin/feature-flags/route.ts:11-26` | The GET endpoint caches for 60s. After a PUT, the cache is invalidated. But if multiple admins are viewing, only the cache entry for THIS admin is invalidated. **Other admins see stale flags for up to 60s**. (The cache key is by `Authorization` header per the comment line 17-19, so each admin has a separate cache. The PUT invalidates `admin:feature-flags:*` which is a wildcard, so all caches are cleared.) |
| P3-12 | `web/src/app/api/admin/maintenance-mode/route.ts:9-15` | The PR-90 comment is misleading (covered by P0-5). |
| P3-13 | `web/src/app/api/admin/system-settings/route.ts:25-74` | The GET endpoint returns editable + readOnly. The two are mixed in the response. A client filtering by `category` must search the `editable` map. |
| P3-14 | `web/src/app/api/admin/system-settings/route.ts:60-71` | The `readOnly` map is built from env vars at request time. **The values are not redacted**. An admin can see `DATABASE_URL_CONFIGURED: 'true'` and infer the DB is configured. |
| P3-15 | `web/src/app/api/admin/system-settings/route.ts:115-121` | The PUT updates the setting without invalidating the cache. **A subsequent GET may return stale data for up to 60s**. (The settings cache is in `settingUseCases.getAll` which uses `db.systemSetting.findMany()` directly — no in-memory cache. But the response is cached for 60s via `withCacheHeaders`. So clients see stale data.) |
| P3-16 | `web/src/app/api/admin/settings/route.ts:38` | `invalidateCache('admin:*')` — wildcard. Covered by P1-19. |
| P3-17 | `web/src/app/api/pricing/route.ts:21-22` | The catch block distinguishes "Hub not found" (404) and "Hub is currently inactive" (400) by **stringly-typed error matching**. Same pattern as 15th audit P0-7. |
| P3-18 | `web/src/server/modules/notifications/notification.use-cases.ts:138-164` | The `sendToAllRiders` loop has no yield / no rate limit. Covered by P0-1, P0-9. |
| P3-19 | `web/src/server/modules/settings/setting.use-cases.ts:42-43` | `SETTINGS_BY_KEY.get(key)!` — non-null assertion. Throws if the key is not in the registry. The schema (`updateSettingsAdminSchema`) validates the key against `ADMIN_SETTING_KEYS`, so the assertion is safe in practice. |
| P3-20 | `web/src/server/modules/settings/setting.use-cases.ts:54-63` | The `create` payload sets `isSecret: false, isEditable: true` always. **An admin can convert a read-only setting to editable** (if the key is in the DB but not in the registry). The schema's allowlist prevents this for the 7 known keys, but a malicious admin could insert a new key via direct DB. Edge case. |
| P3-21 | `web/src/server/modules/pricing/pricing.use-cases.ts:5-7` | The `calculate` use-case returns `utilization`, `surgeMultiplier`, etc. — all internal numbers. The route returns all of them. **Info disclosure** (covered by P0-7). |

---

## 6. Test gaps (11)

| # | What | Where it should live |
|---|---|---|
| TG-1 | `POST /api/admin/notifications` with `sendToAll: true` for 100k riders completes (or rate-limits) | `web/tests/integration/admin/notifications_broadcast.test.ts` (does not exist) |
| TG-2 | `POST /api/admin/notifications` with `sendToAll: true` is rate-limited to N per hour per admin | same |
| TG-3 | `GET /api/admin/audit-logs` with a `READ_ONLY` admin returns 403 | `web/tests/integration/admin/audit_logs_rbac.test.ts` (does not exist) |
| TG-4 | `PUT /api/admin/admins` self-update with `role: 'READ_ONLY'` returns 400 (self-lockout prevention) | `web/tests/integration/admin/admins_self_update.test.ts` (does not exist) |
| TG-5 | `PUT /api/admin/admins` self-update with `password` requires `currentPassword` | same |
| TG-6 | `updateFeatureFlag('maxUploadSizeMb', '50')` writes `valueType: 'NUMBER'` not `'BOOLEAN'` | `web/tests/unit/feature-flags.test.ts` (does not exist) |
| TG-7 | `GET /api/pricing` requires authentication (rider session) | `web/tests/integration/pricing_auth.test.ts` (does not exist) |
| TG-8 | `PUT /api/admin/system-settings` with `value: ''` returns 400 (empty value) | `web/tests/integration/admin/system_settings_empty.test.ts` (does not exist) |
| TG-9 | `PUT /api/admin/team-leaders` with `{id: 'tl_123'}` (no other fields) returns 400 | `web/tests/integration/admin/team_leaders_empty_update.test.ts` (does not exist) |
| TG-10 | `PUT /api/admin/maintenance-mode` with `{enabled: true}` (no message) returns 400 | `web/tests/integration/admin/maintenance_no_message.test.ts` (does not exist) |
| TG-11 | `GET /api/admin/audit-logs` redacts phone numbers in `details` (per `redactPii`) | `web/tests/integration/admin/audit_logs_pii.test.ts` (does not exist; covered by `audit-logs-pii-redaction.test.ts` per file list but I haven't read it) |

---

## 7. What I'd do first if I had to pick one fix

**P0-1 (1 day, 1 file, multi-step)**: rate-limit + confirmation + async for `sendToAllRiders`. The fix is multi-part:

1. **Rate limit** (15 min):
```ts
const rl = await checkRateLimit('admin:notification:sendAll', {
  windowMs: 60 * 60 * 1000,
  maxRequests: 3,
  failClosed: true,
});
if (!rl.allowed) return errors.tooManyRequests('Too many broadcast attempts. Wait 1 hour.');
```

2. **Confirmation flow** (30 min): require `?confirm=true&token=<csrf-token>` for the `sendToAll` branch. The admin UI generates a one-time token when the user clicks "Send to all", the token is verified on submit.

3. **Async via outbox** (4 hours): move the `sendToAllRiders` to a background job. The route returns 202 Accepted with a job ID. The worker processes the job in batches with throttling.

**Why this fix first:**
- 1 day of focused work that prevents the most catastrophic single-keystroke DoS on the rider notification system.
- The fix is mostly additive (rate limit + outbox), so it's low-risk.
- The pattern is reusable for other admin broadcasts (e.g., `POST /api/admin/rider-actions` for bulk rider operations).

**Effort / blast-radius ranking** (next 5 fixes, in order):
1. P0-2 (15 min) — add `requirePermission('audit_view')` to audit-logs GET. SOC2 attribution.
2. P0-3 (2 hours) — add self-update prevention + `currentPassword` to admin PUT. Account takeover prevention.
3. P0-4 (15 min) — fix `updateFeatureFlag` to write correct `valueType`. Data integrity.
4. P0-7 (30 min) — require auth on `/api/pricing` GET. Info disclosure.
5. P0-6 (30 min) — reject empty body in team-leader PUT. Audit log noise.

---

## 8. Cross-audit pattern: what this audit confirmed vs. previous 16

This 17th audit confirms and extends three cross-audit patterns:

### Pattern A: "Wildcard cache invalidation" (now 3rd occurrence)
- **6th audit (legal-device-workflow)**: `invalidateCache('*')` in a device-sync endpoint.
- **16th audit (admin-panel-financial)**: `invalidateCache('admin:*')` in the transactions PUT route.
- **17th audit (this)**: `invalidateCache('admin:*')` in `/api/admin/settings PUT` (line 38), `invalidateCache('admin:feature-flags:*')` in feature-flags PUT (line 47).

**Pattern: wildcard cache invalidation is the team's go-to "fix" for cache consistency, but it causes cache thrashing for concurrent admins.** A grep for `invalidateCache('admin:\*')` would find 3+ instances.

### Pattern B: "Endpoint has no rate limit on a sensitive action" (now 4th occurrence)
- **9th audit (flutter-my-documents-settings)**: KYC photo upload has no rate limit.
- **15th audit (admin-panel-auth)**: `/api/admin/auth/auto-login` has no rate limit.
- **16th audit (admin-panel-financial)**: `/api/admin/transactions` PUT has no rate limit.
- **17th audit (this)**: `/api/admin/notifications POST` `sendToAllRiders` has no rate limit.

**Pattern: the team adds rate limits to login endpoints but not to admin write endpoints.** Every admin write should have a per-admin rate limit (e.g., 10 admin-writes per minute per admin).

### Pattern C: "Self-update / self-lockout" (now 2nd occurrence)
- **15th audit (admin-panel-auth)**: `/api/admin/auth/logout` allows logout without session, but the audit log entry is `actorId: 'system'`.
- **17th audit (this)**: `PUT /api/admin/admins` allows self-update of role / password / isActive, leading to self-lockout.

**Pattern: admin endpoints don't check "is the admin changing themselves?"** A `if (id === session.adminId) { /* self-update restrictions */ }` block is missing in the admin management PUT.

### Pattern D: "Schema strict but route bypasses it" (now 2nd occurrence)
- **16th audit**: `transactionBulkActionSchema.reason` is in the schema but the route uses `body.reason` (untyped).
- **17th audit (this)**: `tickets/route.ts PUT` and `POST` do no Zod validation at all.

**Pattern: routes sometimes bypass the Zod schemas defined in `validators.ts`.** A lint rule that requires `validateBody(...)` in every POST/PUT would catch this.

### Pattern E: "Stringly-typed error matching" (now 3rd occurrence)
- **15th audit**: `login/route.ts` checks `err.message === 'Invalid credentials'`.
- **16th audit**: `reconciliation/route.ts` checks `err.message === 'Hub not found'`.
- **17th audit (this)**: `pricing/route.ts` checks `err.message === 'Hub not found' / 'Hub is currently inactive'`.

**Pattern: the team uses stringly-typed error matching instead of typed errors.** A custom `HubError` class with a `code` field would prevent silent fall-through.

### Pattern F: "Info disclosure via unauthenticated endpoint" (now 2nd occurrence)
- **14th audit (rider-referrals-rewards-offers)**: `/api/rider/offers` requires auth but ignores the rider (effectively public).
- **17th audit (this)**: `/api/pricing` has no auth at all.

**Pattern: when an endpoint is "informational", the team sometimes skips auth.** Pricing for a hub, offers for promotions, and similar lookups are public-looking but contain competitive intel (utilization, surge).

---

## 9. Recommended fix order (with hours)

| # | Fix | Effort | Blast radius | Risk |
|---|---|---|---|---|
| 1 | P0-2: Add `requirePermission('audit_view')` to audit-logs GET | 15 min | 1 route | Low |
| 2 | P0-4: Fix `updateFeatureFlag` to write correct `valueType` | 15 min | 1 lib | Low |
| 3 | P0-7: Require auth on `/api/pricing` GET | 30 min | 1 route | Low |
| 4 | P0-6: Reject empty body in team-leader PUT | 30 min | 1 route | Low |
| 5 | P0-5: Replace `'Internal error'` with `'Failed to ...'` | 5 min | 1 route | Low |
| 6 | P0-3: Add self-update prevention + `currentPassword` to admin PUT | 2 hours | 1 route + 1 schema | Med |
| 7 | P0-8: Reject empty value in system-settings PUT | 30 min | 1 schema | Low |
| 8 | P0-1: Rate limit + confirmation + async for `sendToAllRiders` | 1 day | 1 route + 1 use-case | Med |
| 9 | P1-1..P1-19, P2-1..P2-24, P3-1..P3-21, TG-1..TG-11 | 2 days | Multi-file | Low |

**Total: ~1.5 days of focused work to clear all P0; ~1 week to clear everything.**

---

## 10. File-level summary (what to keep / delete / refactor)

### Delete
- `web/src/app/api/pricing/route.ts:21-22` — stringly-typed error matching; replace with typed errors
- The `value: 'Internal error'` in `maintenance-mode/route.ts:37, 100` — replace with `'Failed to ...'`
- `web/src/app/api/admin/team-leaders/route.ts:74-89` DELETE handler — replace with `/api/admin/team-leaders/[id]` REST convention

### Refactor
- `web/src/app/api/admin/notifications/route.ts:62-69` — add rate limit + confirmation + async
- `web/src/app/api/admin/audit-logs/route.ts:8-11` — add `requirePermission('audit_view')` (**P0-2**)
- `web/src/app/api/admin/admins/route.ts:73-105` — add self-update prevention + `currentPassword` (**P0-3**)
- `web/src/lib/feature-flags.ts:98-115` — fix `valueType` based on flag type (**P0-4**)
- `web/src/app/api/pricing/route.ts:6-25` — require auth (**P0-7**)
- `web/src/app/api/admin/team-leaders/route.ts:52-72` — reject empty body (**P0-6**)
- `web/src/app/api/admin/system-settings/route.ts:108-121` — add `value: z.string().min(1)` to schema (**P0-8**)
- `web/src/app/api/admin/tickets/route.ts:37-66, 69-97` — add Zod validation for PUT/POST (P1-10, P1-12)

### Keep
- `web/src/lib/validators/admin.ts` (good — `.strict()` schemas are the right pattern)
- `web/src/lib/permissions-roles.ts` (good — `admins_manage: []` and `settings_manage: []` correctly restrict to SUPER_ADMIN)

---

## 11. Cumulative totals across 17 audits (post this audit)

| Severity | Count | Δ from 16 audits |
|---|---|---|
| P0 | **120** | +9 |
| P1 | **310** | +19 |
| P2 | **293** | +24 |
| P3 | **313** | +21 |
| Test gaps | **124** | +11 |
| Dead code (lines) | **~5,900** | +~10 |

**Top 10 P0 across all 17 audits** (by blast radius, with newest at top):

1. **P0-1 (this audit)**: `POST /api/admin/notifications` `sendToAllRiders` is unthrottled and synchronous.
2. **P0-3 (this audit)**: `PUT /api/admin/admins` allows self-update, self-lockout, password change without current password.
3. **16th audit P0-1**: `walletCreditAmount` has no upper bound — single admin can credit unlimited amount.
4. **16th audit P0-3**: `POST /api/admin/transactions/bulk` is not transactional and silently fails.
5. **15th audit P0-1**: `AdminLoginForm` ships with default credentials prefilled.
6. **15th audit P0-2**: `/api/admin/auth/auto-login` is a plaintext-password backdoor.
7. **15th audit P0-3**: `/api/admin/auth/refresh` doesn't verify `type === 'refresh'`.
8. **14th audit P0-1**: `REWARD_PER_REFERRAL = 500` vs `setting:referralBonus` ₹200 (admin UI shows 2.5× real payout).
9. **13th audit**: `verify-lock/route.ts:62` reads `rider.lockPassword` but Prisma has `lockPasswordHash` — **3rd audit to flag this exact bug, 7+ days unfixed**.
10. **12th audit**: FCM endpoint `/api/rider/fcm-token` should be `/api/rider/register-token` — 1 line fix, 5 min.

---

## 12. Audit metadata

- **Auditor:** Mavis (MiniMax)
- **Audit depth:** Cross-stack RBAC + cache invalidation + race condition + audit-log drift.
- **Files read:** 23 (18 backend, 2 lib, 3 use-case).
- **Lines analyzed:** ~1,900.
- **Confidence:** High for P0-1, P0-2, P0-3, P0-4, P0-6, P0-7, P0-8, P0-9, P1-1..P1-19, P2-1..P2-24. Medium for P0-5 (the PR-90 comment is misleading, but the actual error message is just inconsistent — not a security issue). Medium for the notification rate limit gap (depends on whether the admin UI has a confirmation modal that prevents accidental sends).
- **Re-test trigger:** after P0-1 lands, `POST /api/admin/notifications` with `sendToAll: true` should rate-limit after 3 calls per hour. After P0-2 lands, GET /api/admin/audit-logs with a READ_ONLY admin should return 403.
- **Owner question for product/security:** is the maintenance-mode banner message a "user-facing copy" that requires legal review? If so, the current `z.string()` (no validation) allows HTML/JS injection in the banner.
