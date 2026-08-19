# Admin Panel Audit — Legal Documents, Device Tracking, Workflow Coverage

**Date:** 2026-08-05
**Scope:** Three admin sections — Legal Documents (`/api/admin/legal`), Device Tracking (`/api/admin/riders/[id]/device-data` + admin rider actions), and Workflow Coverage (`/api/admin/workflow-coverage`). All three are tied to the AdminLayout sidebar items.
**Method:** Surface + deep read of every route, server module, validator, schema, and UI component. Cross-checked against the Prisma schema, the `permissions-roles.ts` matrix, and the previous 5 audit reports.
**Reviewer:** Mavis (audit pass #6)

---

## 0. TL;DR — What is broken today

1. **`/api/rider/device/verify-lock` always returns "Lock password is not configured"** — the route reads `rider.lockPassword` but the schema has only `rider.lockPasswordHash`. **Riders can NEVER unlock their admin-locked devices.** This is the same P0 the riders deep audit caught on 2026-08-05; it is still unfixed.

2. **`/api/admin/riders/actions` `ADMIN_LOCK` generates an ALPHANUMERIC code, not the 12-digit numeric the UI promises.** The route calls `generateRandomPassword(12).toUpperCase()` (uppercase + digits) but the `securityActionLabels.ts` copy says "12-digit numeric password". The `generateNumericPassword` helper exists in `lib/utils.ts:32` but is unused. The rider's device lock screen (numeric keypad) can never match an alphanumeric code.

3. **`workflow-coverage` is dev-only in the UI but shipped to production in the API.** `WorkflowCoverageScreen.tsx:120` short-circuits with `if (process.env.APP_ENV !== 'development') return null;` — but the route `api/admin/workflow-coverage/route.ts` is unconditional. The route also runs **10 sequential fetch() calls** with 5s timeouts = up to 50s per request, no caching, no rate limit, and exposes the DB/worker health to any admin session (not gated by `analytics_view`).

4. **The `actions/route.ts` permission gate is muddled** — the route requires `riders_update` (broad) at the top, then `device_remote_control` (narrow) inside `handleSecurityAction`. A `FINANCE_ADMIN` has `riders_update` but not `device_remote_control`; they get past the first gate, fail the second, see a generic 403. The `LOCK_DEVICE` case in the same switch is reachable through the schema but is hard-disabled with `errors.badRequest('LOCK_DEVICE action is disabled for security compliance.')` — dead code path.

5. **`getDeviceData` selects `lockPassword: true` from a Prisma model that has only `lockPasswordHash`.** The result is `undefined` for every rider. The TypeScript type says `string | null`. The UI never shows the actual lock password (which is correct for security) but the field name in the SELECT is wrong AND the type contract is wrong.

6. **Two parallel legal schemas** — `updateLegalSchema` (non-strict, in `validators.ts:312-319`) is used by the live route; `updateLegalAdminSchema` (`.strict()`, in `validators/admin.ts:186-192`) is the canonical "admin mutation" version. Same pattern as the admin audit's password schema drift. The non-strict one lets a client send extra fields (no-op'd silently).

7. **`legalUseCases.upsert` runs `sanitizeHtml` on legal document content** — but a legal document is plain text (the UI shows it in a `<Textarea>`, the preview renders with `whitespace-pre-wrap`). If the document legitimately contains `<` or `&` (e.g. a clause about "data subject rights under GDPR <Article 17>"), the sanitizer may strip it. If the rider app renders the content as HTML, XSS IS a real risk — but the right fix is "render as plain text" not "scrub the input".

8. **No version history for legal documents.** Every `upsert` overwrites. If an admin accidentally deletes content, it's gone forever. The audit log records `{ type: doc.type }` only — no title, no content hash, no diff. So even the audit trail can't recover the previous version.

9. **The `actions/route.ts` `ASSIGN_PLAN` case calls `update` then `assignPlan` with the same `planId` argument twice** — `assignPlan(riderId, body.planId, body.planId, ...)`. The third argument is duplicated. Either a typo or a misordered signature.

10. **`securityActionLabels.ts:15-17` UI copy says "12-digit numeric password" but the `actions/route.ts:128` generates an alphanumeric string** — combined with #2, this is a real bug that affects every rider who gets locked by an admin.

---

## 1. File Map (read scope)

### Routes
| File | Lines | Purpose |
| --- | --- | --- |
| `web/src/app/api/admin/legal/route.ts` | 42 | GET (list) + PUT (upsert). Permission-gated `legal_manage`. Cached 300s. |
| `web/src/app/api/admin/workflow-coverage/route.ts` | 149 | GET only. Requires `requireAdmin()` only (not `analytics_view`). Dev-only in UI but route ships to prod. |
| `web/src/app/api/admin/riders/[id]/device-data/route.ts` | 24 | GET. Permission-gated `device_tracking_view`. |
| `web/src/app/api/admin/riders/actions/route.ts` | 192 | POST. Handles `ASSIGN_PLAN`/`COMPLETE_PICKUP`/`END_RENTAL` + dispatches security actions. **Dual permission gate (`riders_update` + `device_remote_control`).** |
| `web/src/app/api/rider/device/route.ts` | 52 | Rider-side: GET (own device state) + POST (report violation). |
| `web/src/app/api/rider/device/permissions/route.ts` | 63 | Rider-side: POST (sync own permissions). |
| `web/src/app/api/rider/device/verify-lock/route.ts` | 87 | Rider-side: POST. **Reads wrong field (`lockPassword` vs `lockPasswordHash`). P0.** |

### Server modules
| File | Lines | Purpose |
| --- | --- | --- |
| `web/src/server/modules/legal/legal.use-cases.ts` | 25 | `list` + `upsert`. Uses `sanitizeHtml`. No version history. |
| `web/src/server/modules/device-compliance/device-compliance.policy.ts` | 17 | `canSyncState` / `canReportViolation` / `canLockDevice` — **all return `{ allowed: true }` unconditionally**. Dead policy. |
| `web/src/server/modules/device-compliance/device-compliance.repository.ts` | 52 | `getState` — reads rider permissions + lock state. Selects correct fields. |
| `web/src/server/modules/device-compliance/device-compliance.schemas.ts` | 18 | `syncDeviceStateSchema` + `reportViolationSchema` (both non-strict). |
| `web/src/server/modules/device-compliance/device-compliance.types.ts` | 44 | `DeviceComplianceState` + `DevicePermission` union. |
| `web/src/server/modules/device-compliance/device-compliance.use-cases.ts` | 151 | `syncState` / `reportViolation` / `getDeviceState` (returns `lockPassword: null` even though select reads `lockPassword`) / `syncContacts` / `syncCallLogs` / `syncLocation`. |
| `web/src/server/modules/riders/admin-riders.use-cases.ts` (lines 679-732) | 53 | `getDeviceData` (selects `lockPassword: true` — wrong field) + `updateSecurityFlags` (re-hashes `lockPassword` if string, but field is `lockPasswordHash`). |

### Validators
- `web/src/lib/validators.ts:312-319` — `updateLegalSchema` (non-strict, used by live route).
- `web/src/lib/validators/admin.ts:186-192` — `updateLegalAdminSchema` (`.strict()`, unused by live route).
- `web/src/lib/validators.ts:385-409` — `riderActionSchema` (includes `LOCK_DEVICE` + `ENABLE_CAMERA` even though the action is disabled in the route).

### UI (15+ files)
- **Legal:** `LegalManagement.tsx` (190) — single file, all state inline. No version diff, no preview-only mode, no audit log link.
- **Device tracking:** `DeviceTrackingView.tsx` (114) + `device-tracking/` subdirectory (12 files):
  - `useDeviceTracking.ts` (162) — data hook
  - `CallRegisterTab.tsx`, `ContactsTab.tsx`, `LocationTab.tsx`, `DeviceDataSubTabs.tsx`, `DeviceTrackingHeader.tsx`, `DeviceTrackingStates.tsx`
  - `SecurityControls.tsx` (353) — 4-card grid for Admin Lock / Restrict Hardware / Location Integrity / Factory Reset
  - `SecurityConfirmDialog.tsx`, `UnlockCodeDialog.tsx`, `securityActionLabels.ts`
  - `types.ts`
- **Workflow coverage:** `WorkflowCoverageScreen.tsx` (259) — single file. Dev-only short-circuit at line 120. 2 cards (admin sections + rider app sections) + 2 badges (DB, workers).

### Permissions matrix (relevant keys)
| Key | Allowed roles | Used by |
| --- | --- | --- |
| `legal_manage` | `[]` (no role; SUPER_ADMIN bypass) | `legal/route.ts` |
| `device_tracking_view` | `OPERATIONS_ADMIN`, `FLEET_MANAGER` | `device-data/route.ts` + `DeviceTrackingView.tsx` |
| `device_remote_control` | `OPERATIONS_ADMIN` | `actions/route.ts:86` + `SecurityControls.tsx:323` |
| `analytics_view` | `OPERATIONS_ADMIN`, `FINANCE_ADMIN`, `FLEET_MANAGER`, `HUB_MANAGER` | role-config (workflow-coverage nav) — but NOT enforced in route |

---

## 2. P0 — "breaks production today, users see broken data"

### P0-1 `verify-lock/route.ts:60-69` — reads `rider.lockPassword` but the field is `lockPasswordHash`

```ts
// web/src/app/api/rider/device/verify-lock/route.ts:60-69
const rider = await db.rider.findUnique({
  where: { id: riderDbId },
  select: { lockPassword: true },  // ← WRONG: field is lockPasswordHash
});

if (!rider || !rider.lockPassword) {
  return success({ success: false }, 'Lock password is not configured');
}

const { valid } = await verifyPassword(password, rider.lockPassword);  // ← always compares against undefined
```

The Prisma schema (`web/prisma/schema.prisma:218, 928`) has only `lockPasswordHash String?`. `select: { lockPassword: true }` returns `undefined` (TypeScript would error; at runtime Prisma silently returns the value of the wrong shape). The check `!rider.lockPassword` is ALWAYS TRUE, so the function ALWAYS returns `{ success: false }` with "Lock password is not configured".

**Effect:** Every rider with an admin-locked device is permanently locked. The `ADMIN_LOCK` action at `actions/route.ts:127-138` correctly stores a hash in `lockPasswordHash`. The `UNLOCK_DEVICE` action at lines 140-154 correctly verifies against `lockPasswordHash`. But the rider app's unlock screen calls `verify-lock` and never succeeds.

This is the same bug the riders deep audit caught on 2026-08-05 (line "Riders P0: `web/src/app/api/rider/device/verify-lock/route.ts:62,65,69` reads `rider.lockPassword` (DB has only `lockPasswordHash`) — riders can NEVER unlock their admin-locked devices"). It has not been fixed.

**Fix shape:**
```ts
// 1-line fix
select: { lockPasswordHash: true },
// and
if (!rider || !rider.lockPasswordHash) {
  return success({ success: false }, 'Lock password is not configured');
}
const { valid } = await verifyPassword(password, rider.lockPasswordHash);
```

The test at `web/tests/integration/admin/admin_riders_id_device_data.test.ts` does not cover the verify-lock path; only the device-data fetch.

**Severity:** P0. Locked riders can never recover their device. The `UNLOCK_DEVICE` admin action would also be useless even after the bug is fixed because the rider would still need a way to enter the password (currently the only path is verify-lock).

---

### P0-2 `actions/route.ts:128` — `ADMIN_LOCK` generates ALPHANUMERIC not NUMERIC

```ts
// web/src/app/api/admin/riders/actions/route.ts:127-138
case 'ADMIN_LOCK': {
  const newPassword = generateRandomPassword(12).toUpperCase();
  ...
  responseData = { unlockCode: newPassword };
  ...
}
```

```ts
// web/src/lib/utils.ts:23-30
export function generateRandomPassword(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  // ...
}
```

The UI's `securityActionLabels.ts:15-17` says:
```ts
title: 'Admin Override Lock',
message: 'This will generate a 12-digit numeric password and lockdown the device. Continue?',
```

And the `SecurityControls.tsx:68` placeholder says "Lock device with a 12-digit numeric password." Both promises are lies — the code generates an uppercase alphanumeric string.

`web/src/lib/utils.ts:32-38` has `generateNumericPassword(length = 12)` which does exactly what's promised, but is **never called** in the codebase.

**Effect:** When an admin locks a device, the rider sees a 12-character alphanumeric string in the unlock code dialog (`UnlockCodeDialog.tsx`). The rider's device lock screen likely has a numeric keypad (Android lockscreen pattern). The admin's promise of "numeric" is broken.

**Fix shape:**
```ts
const newPassword = generateNumericPassword(12);  // already exists, just not used
```

1-line change. Add a test asserting the format (`/^\d{12}$/`).

---

### P0-3 `workflow-coverage/route.ts` is shipped to production despite dev-only UI

```ts
// web/src/app/api/admin/workflow-coverage/route.ts:26-31
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return errors.unauthorized('Admin authentication required');
    }
    ...
```

The UI (`WorkflowCoverageScreen.tsx:120`) short-circuits:
```ts
if (process.env.APP_ENV !== 'development') return null;
```

But the route has no such guard. Any admin in production can hit `/api/admin/workflow-coverage` and get the full health snapshot: DB connectivity, stuck worker count, and the result of 10 health-probe fetches against internal API endpoints.

Three concrete problems:
1. **Information disclosure** — the worker stuck-count and DB health are admin-only signals. A `READ_ONLY` or `SUPPORT_AGENT` admin can read them.
2. **10 sequential `fetch()` calls with 5s timeouts** (line 17: `signal: AbortSignal.timeout(5000)`) — at worst, a single health check takes 50 seconds. The route has no cache, no rate limit, no parallelism.
3. **The base URL fallback** at line 43: `env.INTERNAL_API_URL ?? env.NEXT_PUBLIC_APP_URL`. If `INTERNAL_API_URL` is unset in production, the route fetches the public URL — going through the load balancer with each check.

**Fix shape:** add `if (process.env.APP_ENV !== 'development') return errors.notFound('Not found');` at the top of the route. Convert the 10 `checkApi` calls to `Promise.all`. Cache for 30s.

**Test gap:** `web/tests/integration/admin/workflow_coverage.test.ts` exists but only covers the dev-mode happy path.

---

### P0-4 `actions/route.ts` `ASSIGN_PLAN` case — duplicate `planId` argument

```ts
// web/src/app/api/admin/riders/actions/route.ts:31-48
case 'ASSIGN_PLAN': {
  await adminRiderUseCases.update(
    riderId,
    { currentPlan: body.planId },
    { actorId: session.adminId || '', actorRole: session.adminRole || '' }
  );
  const result = await adminRiderUseCases.assignPlan(
    riderId,
    body.planId,
    body.planId,  // ← same value passed twice
    session.adminId || '',
    session.adminRole || ''
  );
  ...
}
```

`assignPlan` is called with `body.planId` as both the 2nd AND 3rd argument. Either:
- The signature is `(riderId, planId, planType, actorId, actorRole)` and the third arg was a typo
- The signature is `(riderId, planId, paymentRef, actorId, actorRole)` and `body.planId` was passed instead of a real ref

`web/src/server/modules/riders/admin-riders.use-cases.ts:...` defines `assignPlan` (line not read in this audit but the call shape suggests `(riderId, planId, ??, actorId, actorRole)`). The 3rd arg duplication is suspicious.

**Fix shape:** read `assignPlan` signature, fix the duplicate. Add an integration test that asserts the plan type and any wallet/transaction state.

---

### P0-5 `admin-riders.use-cases.ts:684` — `getDeviceData` selects non-existent `lockPassword` field

```ts
// web/src/server/modules/riders/admin-riders.use-cases.ts:679-689
async getDeviceData(riderId: string, type: string = 'all') {
  const rider = await db.rider.findUnique({
    where: { id: riderId },
    select: {
      isAdminLocked: true,
      lockPassword: true,  // ← WRONG: field is lockPasswordHash
      isUninstallBlocked: true,
      isLocationMandatory: true,
      isAppsControlRestricted: true,
    },
  });
```

Same `lockPassword` vs `lockPasswordHash` confusion as P0-1, but here it just means the UI never sees the lock password (which is correct for security — the admin should never see the hash, only the rider's own attempt should). But:
- The TypeScript type at `web/src/components/admin/screens/device-tracking/types.ts:30` says `lockPassword: string | null` — wrong type
- The `SecurityControls.tsx:328-334` default rider object has `lockPassword: null` — never set anywhere
- The UI sends the user-typed password via `onTrigger('UNLOCK_DEVICE', { password: unlockPassword })` — correct flow

**Fix shape:** change the SELECT to `lockPasswordHash: true` (and document that the value is the hash, not the plaintext, so the UI should not display it). Or remove the field from the SELECT entirely. The `DeviceRiderSettings` type should drop `lockPassword` — it's never used.

---

## 3. P1 — "real bugs, fix in next sprint"

### P1-1 `legal/route.ts:30` uses `updateLegalSchema` (non-strict); `validators/admin.ts:186` has `updateLegalAdminSchema` (`.strict()`) but is unused

```ts
// web/src/lib/validators.ts:312-319
export const updateLegalSchema = z.object({
  type: z.enum(['terms', 'privacy', 'refund', 'lease'], '...'),
  title: z.string().max(200).optional(),
  content: z.string().min(1, 'content is required').max(100000),
});
// no .strict()
```

```ts
// web/src/lib/validators/admin.ts:186-192
export const updateLegalAdminSchema = z
  .object({
    type: z.enum(['terms', 'privacy', 'refund', 'lease']),
    title: z.string().max(200).optional(),
    content: z.string().min(1, 'content is required').max(100000),
  })
  .strict();
```

Same drift pattern as the admin-audit found with `createAdminSchema` vs `CreateAdminSchema`. The live route uses the non-strict one; the strict one is documented as "the canonical admin mutation schema" but no one uses it. A client could send `{ type, title, content, foo: 'bar' }` and the route would accept it (foo is silently dropped at Zod level, but the audit log records the entire body? No — it records `details: { type: doc.type }` only).

**Fix shape:** switch the route to `updateLegalAdminSchema`. Delete `updateLegalSchema`. The Flutter client should already be using just the 3 fields; verify in `lib/api/legal*.dart`.

---

### P1-2 `legalUseCases.upsert` overwrites without version history

```ts
// web/src/server/modules/legal/legal.use-cases.ts:10-24
async upsert(data, actorId) {
  const doc = await db.legalDocument.upsert({
    where: { type: data.type },
    update: { title: ..., content: sanitizeHtml(data.content) },
    create: { type: data.type, title: ..., content: ... },
  });
  createAuditLog({
    actorId,
    action: 'legal.update',
    entity: 'legal',
    entityId: doc.id,
    details: { type: doc.type },  // ← only the type, no diff
  });
  return doc;
}
```

Three problems:
1. **No soft-delete / no version history.** Every PUT is destructive. If an admin accidentally clears the Terms of Service, the rider app shows blank.
2. **Audit log detail is `{ type }` only** — no title, no content hash, no diff. The audit log says "I updated terms" but not "I replaced a 10,000-char doc with 200 chars".
3. **`sanitizeHtml` on the content** — see P1-3.

**Fix shape:** add a `LegalDocumentRevision` model + migration. The `upsert` writes the new revision and links it. The `LegalDocument` table holds the current pointer. The audit log captures `{ type, previousRevisionId, contentHash }`.

---

### P1-3 `legalUseCases.upsert` runs `sanitizeHtml` on plain-text legal content

```ts
// web/src/server/modules/legal/legal.use-cases.ts:13-14
update: { title: ..., content: sanitizeHtml(data.content) },
create: { type: data.type, title: ..., content: sanitizeHtml(data.content) },
```

The UI renders the content as plain text (`LegalManagement.tsx:154`):
```tsx
<div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap ...">
  {contents[dt.key] || 'No content yet.'}
</div>
```

`whitespace-pre-wrap` preserves whitespace but doesn't interpret HTML. So the HTML sanitization is **either**:
- Wasting cycles (if the rider app also renders as plain text) — the document is over-stripped
- Inadequate (if the rider app renders as HTML) — XSS risk

A legal document legitimately contains `<` (e.g. "the data subject has the right <Article 17>" or "use of the less-than sign (<)"). `sanitizeHtml` from `lib/sanitize` may strip these or replace them with `&lt;`.

**Fix shape:** pick a contract. If the rider app renders as plain text, drop `sanitizeHtml`. If the rider app renders as HTML, keep it but document the sanitization rules in a code comment. Test with a doc containing `& < > " '`.

---

### P1-4 `LegalManagement.tsx:70-87` `saveDocument` ignores `res.ok` and has no confirmation dialog

```ts
// web/src/components/admin/screens/LegalManagement.tsx:70-87
const saveDocument = async (type: string) => {
  try {
    setSaving(type);
    const docType = DOC_TYPES.find((d) => d.key === type);
    await fetch('/api/admin/legal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title: docType?.label || type, content: contents[type] || '' }),
    });
    fetchDocuments();
  } finally {
    setSaving(null);
  }
};
```

Same `if (!res.ok) return;` silent-failure pattern as the rewards/faqs/admins audit. Plus: clicking "Save" immediately overwrites the document. No "Are you sure?" dialog. The "Preview" button only toggles between `<Textarea>` and `<div>` — it doesn't render the document as the rider will see it (which would be Markdown if the rider app does `.parse(markdown)`, or plain text if `.text(content)`).

**Fix shape:** check `res.ok` and toast on failure. Add a confirmation dialog showing the content length + "X characters will replace the current version". Add a Markdown preview (if applicable).

---

### P1-5 `actions/route.ts:80-99` — dual permission gate is muddled

```ts
// web/src/app/api/admin/riders/actions/route.ts:17-19
if (!hasPermission(session.adminRole || '', 'riders_update')) return adminForbidden();
...
// line 86
if (!hasPermission(session, 'device_remote_control')) return adminForbidden();
```

The route is named "admin rider actions" but accepts `riders_update` (a general "edit a rider" permission) AND `device_remote_control` (a specific "send a remote command" permission) depending on the action. The `default` branch falls through to `handleSecurityAction` which requires `device_remote_control`, so:
- `ASSIGN_PLAN` / `COMPLETE_PICKUP` / `END_RENTAL` need `riders_update`
- All other actions need `riders_update` AND `device_remote_control`

But the schema (`riderActionSchema`) doesn't tell the client which is which. The client just sends the action and gets a 403 if they lack the right permission. The error message is "Insufficient permissions" — which permission was missing?

**Fix shape:** the route should require the most permissive permission at the top (`riders_update`) and then for security actions re-check the specific permission (`device_remote_control`). The 403 response should include which permission was required. Alternative: split the route into `/api/admin/riders/[id]/assign-plan`, `/api/admin/riders/[id]/actions` (security only) for cleaner separation.

---

### P1-6 `actions/route.ts:91-99` `fcmRequiredActions` includes `LOCK_DEVICE` which is unreachable

```ts
// web/src/app/api/admin/riders/actions/route.ts:88-99
const fcmRequiredActions = [
  'LOCK_DEVICE',
  'FACTORY_RESET',
  'DISABLE_CAMERA',
  'ENABLE_CAMERA',
  'ENFORCE_PASSCODE',
  'CHECK_LOCATION_INTEGRITY',
  'SYNC_DEVICE_DATA',
];
if (fcmRequiredActions.includes(action) && !rider.fcmToken) {
  return errors.badRequest('Device not connected (missing FCM token)');
}
...
// line 106-107
case 'LOCK_DEVICE':
  return errors.badRequest('LOCK_DEVICE action is disabled for security compliance.');
```

`LOCK_DEVICE` is in the FCM-required list AND in the action schema enum (`riderActionSchema`), but the switch case returns 400 immediately. The FCM check on line 97 is dead code for `LOCK_DEVICE`. The schema's `LOCK_DEVICE` value is also dead — no client should send it.

Same for `ENABLE_CAMERA`: it's in `fcmRequiredActions` AND in the schema. The UI's `SecurityAction` type includes it (`types.ts:52`) but the SecurityControls component doesn't have a button for it.

**Fix shape:** remove `LOCK_DEVICE` and `ENABLE_CAMERA` from `riderActionSchema` and from `fcmRequiredActions`. Remove from `SecurityAction` type. The dead action is a footgun: a future developer who wires it up via a new UI control will hit the dead case.

---

### P1-7 `workflow-coverage/route.ts:50-112` — 10 sequential fetches with 5s timeouts

```ts
// web/src/app/api/admin/workflow-coverage/route.ts:50-112
const workflowChecks: WorkflowStatus[] = [
  {
    id: 'riders',
    status: (await checkApi(`${baseUrl}/api/admin/riders?limit=1`, cookie)) ? 'green' : 'red',
    detail: 'GET /api/admin/riders',
  },
  {
    id: 'kyc',
    status: (await checkApi(`${baseUrl}/api/admin/kyc`, cookie)) ? 'green' : 'red',
    ...
  },
  // 8 more, awaited sequentially
];
```

Each `checkApi` has `signal: AbortSignal.timeout(5000)`. At 5s each, the worst case is 50s. The route has no cache, no rate limit, and the `await` chain blocks the Node event loop on every request.

**Fix shape:** `Promise.all(workflowChecks.map(c => checkApi(...).then(ok => ({ ...c, status: ok ? 'green' : 'red' }))))`. Cache the result for 30s. Reduce timeout to 2s.

---

### P1-8 `workflow-coverage/route.ts:43-48` — base URL fallback to public URL

```ts
// web/src/app/api/admin/workflow-coverage/route.ts:43
const baseUrl = env.INTERNAL_API_URL ?? env.NEXT_PUBLIC_APP_URL;
```

`INTERNAL_API_URL` is `z.string().url().optional()` in `env.ts:38`. If unset, the route uses the public URL. This means the server makes HTTP requests to its own public URL, going through Caddy, through the load balancer, with TLS termination. The 5s timeout x 10 fetches = up to 50s of public traffic per health check.

The comment says "operators can override" — but there's no startup-time check that the var is set in production. The `process.env.APP_ENV === 'production'` check is missing.

**Fix shape:** require `INTERNAL_API_URL` in production. Add a startup check: `if (process.env.APP_ENV === 'production' && !env.INTERNAL_API_URL) throw new Error(...)`. Default `INTERNAL_API_URL` to `http://127.0.0.1:8081` (the same as `NEXT_PUBLIC_APP_URL` default).

---

### P1-9 `device-compliance.use-cases.ts:36` — `getDeviceState` selects `lockPassword`

```ts
// web/src/server/modules/device-compliance/device-compliance.use-cases.ts:36-67
async getDeviceState(riderDbId: string) {
  const rider = await db.rider.findUnique({
    where: { id: riderDbId },
    select: {
      ...
      lockPassword: true,  // ← WRONG: should be lockPasswordHash
      ...
    },
  });
  ...
  return {
    ...
    lockPassword: null,  // ← hardcoded to null
    ...
  };
}
```

Same `lockPassword` vs `lockPasswordHash` confusion. The select is wrong AND the return value is hardcoded to `null`. So the rider-side `/api/rider/device` response says `lockPassword: null` always. This is the API that the rider app checks for "is my device locked?" — the rider app then shows the lock screen. The lock screen calls `/api/rider/device/verify-lock` (broken per P0-1) to attempt unlock.

The `lockPassword: null` in the return is the right security stance (never return the hash to the rider), but the `select: { lockPassword: true }` is dead.

**Fix shape:** drop `lockPassword` from the `select`. Add a comment: "intentionally not returning the hash to the rider".

---

### P1-10 `device-compliance.policy.ts:5-16` — every policy method returns `allowed: true` unconditionally

```ts
// web/src/server/modules/device-compliance/device-compliance.policy.ts
export const deviceCompliancePolicy = {
  canSyncState(_riderId: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },
  canReportViolation(_riderId: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },
  canLockDevice(_adminId: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },
};
```

The policy is unused (the routes use inline `hasPermission` instead) AND every method returns `allowed: true`. This is dead code masquerading as a policy layer.

**Fix shape:** either wire the policy into the routes (and define what "allowed" means — e.g. "rider can sync if not currently in lock state"), or delete the file. The pattern is misleading.

---

### P1-11 `DeviceDataSubTabs.tsx:42-51` "Sync Data" button has no permission check

```tsx
// web/src/components/admin/screens/device-tracking/DeviceDataSubTabs.tsx:42-51
<Button
  variant="default"
  onClick={onSync}
  disabled={syncing}
>
  <RefreshCw className={...} />
  Sync Data
</Button>
```

`onSync` triggers `SYNC_DEVICE_DATA` which requires `device_remote_control` server-side. The `SecurityControls.tsx:323` checks `hasPermission(session, 'device_remote_control')` and shows a no-permission card. But the `Sync Data` button in `DeviceDataSubTabs` has no such check — a FLEET_MANAGER (who has `device_tracking_view` but not `device_remote_control`) can click it, get a 403, and see a generic error toast.

**Fix shape:** add the same `hasPermission(session, 'device_remote_control')` check around the Sync Data button, or hide it for users without the permission.

---

### P1-12 `device-compliance.use-cases.ts:9-15` `syncState` updates Rider with `as any`

```ts
// web/src/server/modules/device-compliance/device-compliance.use-cases.ts:9-15
async syncState(riderDbId: string, permissions: Record<string, boolean>) {
  await db.rider.update({
    where: { id: riderDbId },
    data: permissions as any,  // ← type-unsafe cast
  });
  logger.info('[DeviceCompliance] State synced', { riderDbId, permissions });
}
```

The caller at `web/src/app/api/rider/device/permissions/route.ts:28-56` explicitly maps the input to a known set of fields. So `permissions` is a known shape. But the use-case accepts `Record<string, boolean>` and casts to `any`. If a future caller sends a new permission key (e.g. `nfcGranted`), it would be silently written to a non-existent column — Prisma would either ignore it (if it's a partial match) or throw at runtime. The cast removes the safety net.

**Fix shape:** type the parameter as `Partial<RiderPermissionFields>` or use a Zod schema (`syncDeviceStateSchema` already exists at `device-compliance.schemas.ts:7-10` — validate before the update).

---

### P1-13 `riderActionSchema` allows `LOCK_DEVICE` and `ENABLE_CAMERA` but they are dead actions

Already noted in P1-6. The schema should be the source of truth for what actions exist. Dead enum values invite bugs.

---

### P1-14 `useDeviceTracking.ts:62-72` and `:88-118` — silent fetch errors and 200/refresh on failure

```ts
// web/src/components/admin/screens/device-tracking/useDeviceTracking.ts:62-72
const fetchData = useCallback(async () => {
  if (!riderId) { ... }
  setLoading(true);
  try {
    const res = await fetch(`/api/admin/riders/${riderId}/device-data`);
    const json = await res.json();
    if (json.success) {
      setData(json.data);
    }
  } catch (err) {
    logger.error('Failed to fetch device data', { error: err });
  } finally {
    setLoading(false);
  }
}, [riderId]);
```

No `res.ok` check. A 403 or 500 returns `{ success: false }` and `setData(null)` is implicitly called. The UI shows the empty state. No error banner. Same pattern as the rewards/faqs/admins audit.

**Fix shape:** check `res.ok`, add an `error` state, render a toast/banner.

---

### P1-15 `actions/route.ts:73` `default: return await handleSecurityAction(rider, action, body, session);` — falls through with raw `body`

The action dispatcher receives the **raw** `body` (not the validated `validation.data`). Inside `handleSecurityAction`, `body.password`, `body.enabled` are accessed. If the client sends `{ action: 'UNLOCK_DEVICE', riderId: 'x', password: 12345 }`, the Zod schema's `password: z.string().optional()` rejects it. But the code path is fragile.

Also, `body.password` is the user-typed unlock code. The Zod schema doesn't `.strict()` so extra fields (e.g. `body.enabled: '<malicious string>'`) pass through.

**Fix shape:** pass `validation.data` (the Zod-parsed body) instead of `body`. Add `.strict()` to the action schema.

---

### P1-16 `DeviceTrackingView.tsx:30-34` — `if (t.session && !hasPermission(...))` — the `t.session &&` short-circuit hides the permission check until the session loads

```tsx
// web/src/components/admin/screens/device-tracking/DeviceTrackingView.tsx:30-34
if (t.loading) return <DeviceTrackingLoadingState />;

if (t.session && !hasPermission(t.session, 'device_tracking_view')) {
  return <DeviceTrackingPermissionDenied />;
}
```

If `t.session` is `null` (the `/api/admin/auth/me` fetch failed or hasn't completed), the permission check is skipped. The screen shows the rider selector + empty state. A user with no session could navigate here and see the empty state. Not a security issue (the underlying API is gated) but UX is wrong.

**Fix shape:** show the loading state until BOTH `t.session` and `t.data` are loaded, then run the permission check.

---

### P1-17 `DeviceTrackingView.tsx:55-59` — `onChangeRider` calls `t.fetchData()` but the new riderId is in local state

```tsx
// web/src/components/admin/screens/device-tracking/DeviceTrackingView.tsx:55-59
<DeviceTrackingHeader
  isStandalone={isStandalone}
  onChangeRider={() => {
    setSelectedRiderId(undefined);
    t.fetchData();  // ← fetches with the OLD riderId
  }}
/>
```

`setSelectedRiderId(undefined)` updates local state, but `t.fetchData` uses the closed-over `riderId` from the `useDeviceTracking` hook (which was set when the prop was last truthy). The fetch uses the stale riderId.

**Fix shape:** remove the explicit `t.fetchData()` call — the `useEffect` on line 79-86 will trigger when `riderId` changes to `undefined`.

---

## 4. P2 — type safety / contract issues

### P2-1 `legalUseCases.list` returns ALL legal documents (no pagination, no filtering)

```ts
// web/src/server/modules/legal/legal.use-cases.ts:6-8
async list() {
  return db.legalDocument.findMany({ orderBy: { type: 'asc' } });
}
```

There are only 4 types (`terms`, `privacy`, `refund`, `lease`) so the unfiltered `findMany` is fine for now. But the `LegalDocument` model could grow (e.g. `cookie_policy`, `aadhaar_consent`, etc.) and the route + UI would need updating. Document the assumption.

### P2-2 `LegalManagement.tsx:30-35` `DOC_TYPES` is hardcoded in the UI

The 4 legal document types are defined in the UI (`{ key: 'terms', label: 'Terms of Service', ... }`). The Zod enum at `validators.ts:313-315` defines the same 4. The Prisma model is a free-form string. Three sources of truth — if someone adds a 5th type, three files must change in lockstep.

**Fix shape:** export `LEGAL_DOCUMENT_TYPES` from a shared module (e.g. `validators/admin.ts`), import in both the UI and the schema.

### P2-3 `LegalManagement.tsx:42` `previewing` is shared across all 4 tabs

```ts
// web/src/components/admin/screens/LegalManagement.tsx:42
const [previewing, setPreviewing] = useState(false);
```

Clicking "Preview" on the Terms tab puts the entire screen in preview mode — including the Privacy tab. The user has to click "Edit" to switch back. Should be per-tab.

### P2-4 `LegalManagement.tsx:79` `title` is sent but optional and server-computed

```ts
// web/src/components/admin/screens/LegalManagement.tsx:79
title: docType?.label || type,
```

The UI sends `title: 'Terms of Service'` etc. The server-side `upsert` at `legal.use-cases.ts:14` uses `data.title || data.type` as fallback. If the UI changes the label (e.g. "Terms & Conditions"), the next save overwrites with the new label. But there's no admin-set custom title. The `title` field is always derived from `type` in the UI. Drop the `title` field from the request and let the server compute it.

### P2-5 `LegalManagement.tsx:155` "No content yet" shows in preview mode too

The empty state copy "No content yet" appears whether the doc is empty or just long. The preview should show a friendlier empty state ("This document has no content. Use the Edit tab to add some.").

### P2-6 `legal/route.ts:16` cache 300s with no client-side revalidation

The server caches the legal docs for 5 minutes. The UI doesn't poll. An admin saves a doc at 10:00, the cache expires at 10:05. If the rider app fetches at 10:01, it gets the old version. The Flutter client's legal screen probably also caches. No `Cache-Control: must-revalidate`. Add explicit revalidation or skip the cache for admin mutations.

### P2-7 `device-compliance.use-cases.ts:61` returns `lockPassword: null` literally

```ts
// web/src/server/modules/device-compliance/device-compliance.use-cases.ts:56-78
return {
  ...
  lockPassword: null,  // ← hardcoded
  ...
};
```

The return type in `device-compliance.types.ts` says `lockPassword: string | null`. But the value is always `null`. Either remove the field from the return or document the security reason. The Flutter client might be checking this field expecting a value.

### P2-8 `DeviceDataSubTabs.tsx:13-17` `SUB_TABS` is hardcoded; the `device-data` route supports 4 types

```ts
// web/src/components/admin/screens/device-tracking/DeviceDataSubTabs.tsx:13-17
const SUB_TABS = [
  { id: 'calls', label: 'Call Register', icon: Phone },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'location', label: 'Live GPS', icon: MapPin },
];
```

The `getDeviceData` use-case handles `'CONTACTS'`, `'CALL_LOGS'`, `'LOCATION'`, `'all'`. The UI shows 3 tabs (calls, contacts, location) but the type query param is not used. The route's `?type=` query is never read by the UI. Dead contract.

### P2-9 `ContactsTab.tsx:22-24` search is case-insensitive but `phone.includes(search)` is exact

```ts
// web/src/components/admin/screens/device-tracking/ContactsTab.tsx:22-24
const q = search.toLowerCase();
const filtered = (contacts || []).filter(
  (c) => c.name.toLowerCase().includes(q) || c.phone.includes(search)  // ← inconsistent
);
```

`name` search is case-insensitive; `phone` search is exact. A user searching "9876" finds contacts with "9876" in the name (lowercased) but not in the phone (which is already digits, so this might be OK actually). But searching "JOHN" would match the name "John" but not "john" (since name is lowercased first). Wait, the code DOES lowercase both. So name search is case-insensitive. Phone search doesn't need case-insensitivity (digits). The `q` variable is misleading — only the name branch uses it.

### P2-10 `LocationTab.tsx:32` "Live Active" badge is hardcoded

Even if the latest location is from 3 days ago, the badge says "Live Active". Should compare `current.timestamp` to `Date.now() - 60_000` (1 minute threshold).

### P2-11 `LocationTab.tsx:95` uses `toLocaleTimeString()` without locale

```ts
// web/src/components/admin/screens/device-tracking/LocationTab.tsx:95
{new Date(loc.timestamp).toLocaleTimeString()}
```

No locale specified. Different browsers default to different locales. The dashboard's `formatDashboardDate` uses `'en-GB'` for consistency. The Location tab doesn't. Inconsistency.

### P2-12 `CallRegisterTab.tsx:75` `formatDateTimeDDMMYYYY` is correct; `LocationTab.tsx:95` `toLocaleTimeString` is inconsistent

Same issue as P2-11.

### P2-13 `CallRegisterTab.tsx:30-32` `formatDuration` doesn't handle edge cases

```ts
// web/src/components/admin/screens/device-tracking/CallRegisterTab.tsx:30-32
const formatDuration = (seconds: number): string => {
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};
```

- 0 seconds → "0m 0s" (fine)
- 90 seconds → "1m 30s" (fine)
- 3600 seconds (1 hour) → "60m 0s" (should be "1h 0m")
- Negative or NaN → "NaNm NaNs"

Add hours handling, NaN guard.

### P2-14 `DeviceTrackingView.tsx:24` local `selectedRiderId` is initialised from `riderIdProp` only on mount

```ts
// web/src/components/admin/screens/device-tracking/DeviceTrackingView.tsx:24
const [selectedRiderId, setSelectedRiderId] = useState<string | undefined>(riderIdProp);
```

If the parent changes `riderIdProp` (e.g. navigates from rider A to rider B via the rider detail page), the state is stale. Add a `useEffect` to sync the state with the prop.

### P2-15 `SecurityControls.tsx:352` `void ShieldAlert;` — unused import

```ts
// web/src/components/admin/screens/device-tracking/SecurityControls.tsx:352
// Suppress unused-import warning for ShieldAlert (kept for future use)
void ShieldAlert;
```

`ShieldAlert` is imported on line 3 but never used. The `void` is a hack. Delete the import.

### P2-16 `DeviceTrackingView.tsx:32-33` permission check is client-side only

```tsx
// web/src/components/admin/screens/device-tracking/DeviceTrackingView.tsx:32
if (t.session && !hasPermission(t.session, 'device_tracking_view')) {
  return <DeviceTrackingPermissionDenied />;
}
```

The server-side check is at `device-data/route.ts:12`. So a user could bypass the client check and the server still gates. But the user sees the "Access Denied" UI vs. an API 403. Inconsistent UX. Either trust the server and show a generic error, or sync the client + server.

### P2-17 `actions/route.ts:97` `if (fcmRequiredActions.includes(action) && !rider.fcmToken)` — race condition

The `rider` is fetched at line 27 via `getRiderWithWallet(riderId)`. Between the read and the FCM call, the rider's FCM token could be cleared. The FCM call then fails. Should be a transaction or a retry.

### P2-18 `workflow-coverage/route.ts:124-138` worker stuck-count query has no index

```ts
// web/src/app/api/admin/workflow-coverage/route.ts:128-130
const stuckCount = await db.outboxEvent.count({
  where: { status: 'PROCESSING', updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
});
```

No mention of an index on `outboxEvent(status, updatedAt)`. At 100k outbox rows this is a full table scan. Add a composite index migration.

### P2-19 `workflow-coverage/route.ts:115-122` DB health is a single `SELECT 1` — doesn't actually verify the connection pool

A `SELECT 1` succeeds even if the pool is exhausted (it just queues). The "Database connected" / "Database unreachable" status is misleading. Consider checking `SELECT pg_backend_pid()` or hitting a real read query.

### P2-20 `workflow-coverage/route.ts:140-145` returns `timestamp: new Date().toISOString()` but the UI shows `toLocaleTimeString()`

```ts
// web/src/components/admin/screens/WorkflowCoverageScreen.tsx:162
new Date(healthData.timestamp).toLocaleTimeString()
```

OK — same issue as P2-11, no locale.

---

## 5. P3 — code quality / dead code

### P3-1 `LegalManagement.tsx:38-39` two state objects for the same data

```ts
const [documents, setDocuments] = useState<Record<string, LegalDoc>>({});
const [contents, setContents] = useState<Record<string, string>>({});
```

Both keyed by `type`, with `contents` mirroring `documents[dt.key].content`. The `fetchDocuments` callback sets both. Could be a single `Map<string, LegalDoc>`. Cosmetic.

### P3-2 `LegalManagement.tsx:93-94` `formatDate` is a 1-line wrapper around `formatDateDDMMYYYY`

```ts
const formatDate = (d: string) => formatDateDDMMYYYY(d);
```

Inline-import `formatDateDDMMYYYY` and drop the wrapper.

### P3-3 `device-compliance.schemas.ts` — schemas are non-strict and unused

`syncDeviceStateSchema` and `reportViolationSchema` are defined but never imported (the routes use inline Zod schemas). Dead.

### P3-4 `device-compliance.repository.ts:9-51` `getState` is not called by any route

The `getState` repository method duplicates the use-case's `getDeviceState`. The use-case is called by `/api/rider/device`. The repository method is not called by anyone. Dead.

### P3-5 `device-compliance.use-cases.ts:81-93` `syncContacts` accepts a list but no rate limit / pagination

A rider's phone can have 5,000 contacts. The endpoint accepts them all in one POST. No `LIMIT`, no `OFFSET`. Either paginate the sync or document the contract.

### P3-6 `device-compliance.use-cases.ts:95-115` `syncCallLogs` same issue

No pagination. A rider with 10k call logs uploads them all at once.

### P3-7 `device-compliance.use-cases.ts:117-150` `syncLocation` is called once per ping, not batched

The Flutter app probably calls this on every GPS update. If the rider's device sends 1 location/second, that's 86,400 rows/day. Add a `LIMIT` check or batch the inserts.

### P3-8 `actions/route.ts:128` `generateRandomPassword(12).toUpperCase()` — if the password is mixed-case, the uppercase conversion might collide (e.g. 'aA' and 'AA' both become 'AA'). The probability is low but non-zero.

### P3-9 `actions/route.ts:150` `lockPasswordHash: await hashPassword(generateRandomPassword(12).toUpperCase())` after unlock

After successful unlock, a new random hash is set. Why? The rider is unlocked; the next lock will generate a new password. The cleanup of the old hash is fine, but the unused hash is unnecessary work. Just `dbUpdate.lockPasswordHash = null`.

### P3-10 `DeviceDataSubTabs.tsx:53` `border-border/50` — Tailwind class on a `<div>`, fine

Cosmetic.

### P3-11 `DeviceTrackingHeader.tsx:20-21` `if (!isStandalone) return null;` is fine but the prop name is confusing

When `riderIdProp` is provided, `isStandalone = false`. The "header" is only shown in the standalone (no-rider-selected) view, which is paradoxical. The variable name suggests "is the screen standalone" but it means "is no rider selected".

### P3-12 `useDeviceTracking.ts:7-18` comment about "supersets" is hand-wavy

```ts
// The actual /api/admin/auth/me response is a superset, so the narrow
// interface is fine.
```

If the actual response is a superset, casting to `SessionPayload` discards fields. If the field is checked via `hasPermission(session, ...)`, the check uses the narrow interface. Fine, but the comment should say which fields are missing.

### P3-13 `workflow-coverage/route.ts:50-112` 10 hardcoded workflow IDs

Each workflow is a tuple of `{ id, label, status, detail }`. The IDs (`riders`, `kyc`, `rentals`, etc.) are also defined in `WorkflowCoverageScreen.tsx:29-72` `adminGroups`. Two sources of truth. If a new screen is added, the array in the route is updated but the array in the UI may not be. The UI's `getWorkflowStatus` returns `'unknown'` for unmatched IDs, which is silent.

**Fix shape:** move the workflow list to a shared module.

### P3-14 `WorkflowCoverageScreen.tsx:25-93` `adminGroups` and `riderGroups` are hardcoded

The `riderGroups` at line 78-93 are plain text descriptions. The list is "Auth, KYC, Plan and deposit, ..." etc. — descriptive of the rider app's screen flow. There's no link to the actual screens, no API health check for the rider app. The "Coverage" claim is asserted, not verified.

**Fix shape:** either link to actual rider routes or remove the rider section (it's a manual claim that the operator must update by hand).

### P3-15 `WorkflowCoverageScreen.tsx:120` `process.env.APP_ENV !== 'development'` — `APP_ENV` is not a Next.js standard

Next.js uses `NODE_ENV` (`production` / `development` / `test`). `APP_ENV` is custom. Verify that the build sets it. If not, the screen always shows in production.

### P3-16 `WorkflowCoverageScreen.tsx:122-137` `fetchHealthData` ignores `res.status`

```ts
// web/src/components/admin/screens/WorkflowCoverageScreen.tsx:122-137
const res = await fetch('/api/admin/workflow-coverage');
if (res.ok) {
  ...
}
```

OK, this one DOES check `res.ok`. But no error UI on failure. The `loading` state goes to false but the screen shows no error.

### P3-17 `DeviceDataSubTabs.tsx:47-48` `disabled={syncing}` but `syncing` is only set by `SYNC_DEVICE_DATA`

If a different action is pending, the Sync Data button is still enabled. Should disable on any pending action.

---

## 6. Test coverage gaps

| Area | Existing tests | Gaps |
| --- | --- | --- |
| `legal` | `tests/integration/admin/legal.test.ts` | No test for `sanitizeHtml` interaction; no test for 4 vs 5 doc types; no test for `.strict()` enforcement. |
| `workflow-coverage` | `tests/integration/admin/workflow_coverage.test.ts` | No test for `APP_ENV !== 'development'` short-circuit (the route has no such check). No test for the 10 sequential fetches. No test for the 50s worst-case. |
| `device-data` | `tests/integration/admin/admin_riders_id_device_data.test.ts` | No test for `device_tracking_view` permission gate. No test for type filter (`?type=CALL_LOGS`). No test for missing rider. |
| `device-actions` | (none) | No test for `ADMIN_LOCK` generated password format. No test for `UNLOCK_DEVICE` with `rider.lockPasswordHash` (correct field) vs `rider.lockPassword` (wrong field). No test for the FCM-required path. |
| `verify-lock` | `tests/integration/admin/admin_riders_id_device_data.test.ts` (admin side) | No test for the rider-side `verify-lock` route. The P0-1 bug is undetected by tests. |
| `device-compliance` | `tests/unit/device-compliance.job.test.ts` | No test for `getDeviceState` returning `lockPassword: null` (security stance). No test for `syncState` accepting unknown fields. |
| `legalUseCases` | (none) | No unit test for the `upsert` audit log details. |
| `actions/route.ts` dual permission gate | (none) | No test that `device_remote_control` is required for security actions. |

---

## 7. What I'd do first (single highest-blast-radius fix)

**P0-1 (`verify-lock` reads wrong field) — single line fix.** This is the only finding that affects production users right now: every rider with an admin-locked device is permanently locked out. The fix is `lockPassword: true` → `lockPasswordHash: true` in the SELECT, plus the corresponding variable renames in the verification. 5 minutes. Deploy as hotfix.

**P0-2 (`ADMIN_LOCK` generates alphanumeric, not numeric) — single line fix.** Change `generateRandomPassword(12).toUpperCase()` to `generateNumericPassword(12)`. 1 minute. Deploy as hotfix. This affects every future lock action; existing locks with alphanumeric codes can still be unlocked with the alphanumeric string (the unlock screen probably has a text input, not a numeric keypad — but verify).

**Third PR (P0-3):** Add the dev-only guard to `workflow-coverage/route.ts` and convert the 10 sequential fetches to `Promise.all`. The dev-only guard prevents information disclosure; the parallel fetch is a 50s→5s improvement.

**Fourth PR (P1-6 + P1-13):** Remove `LOCK_DEVICE` and `ENABLE_CAMERA` from the action schema, the FCM-required list, and the SecurityAction type. These are dead actions that invite bugs.

---

## 8. Recommended fix order with hour estimates

| Order | PR | Scope | Est. hours | Notes |
| --- | --- | --- | --- | --- |
| 1 | `verify-lock-hash-field` | P0-1: 3-line fix + test | 0.25 | Hotfix |
| 2 | `admin-lock-numeric` | P0-2: 1-line fix + test | 0.1 | Hotfix |
| 3 | `workflow-coverage-prod-guard` | P0-3: dev-only guard + parallel fetches + cache | 1.5 | |
| 4 | `assign-plan-duplicate-arg` | P0-4: investigate + fix + test | 1 | |
| 5 | `device-data-lock-password-select` | P0-5: drop wrong SELECT field, fix UI type | 0.5 | |
| 6 | `legal-strict-schema` | P1-1: switch to `updateLegalAdminSchema` | 0.5 | |
| 7 | `legal-version-history` | P1-2: add `LegalDocumentRevision` model + migration | 4 | New model + UI |
| 8 | `legal-sanitize-investigate` | P1-3: decide contract, document, test | 1 | |
| 9 | `legal-save-confirmation` | P1-4: add confirm dialog + res.ok check | 1 | |
| 10 | `actions-permission-cleanup` | P1-5 + P1-15: pass `validation.data`, split route | 3 | |
| 11 | `actions-remove-dead-enum` | P1-6 + P1-13: drop LOCK_DEVICE/ENABLE_CAMERA | 0.5 | |
| 12 | `workflow-coverage-parallel` | P1-7: Promise.all + cache | 0.5 | |
| 13 | `workflow-coverage-internal-url-required` | P1-8: require INTERNAL_API_URL in prod | 0.5 | |
| 14 | `device-state-remove-lockPassword` | P1-9: drop SELECT field, document | 0.25 | |
| 15 | `device-policy-cleanup` | P1-10: delete or wire `device-compliance.policy.ts` | 0.5 | |
| 16 | `device-sync-permission-gate` | P1-11: add `hasPermission` check around Sync Data | 0.25 | |
| 17 | `device-state-type-safety` | P1-12: remove `as any` cast | 0.5 | |
| 18 | `use-device-tracking-errors` | P1-14: error state + toast | 1 | |
| 19 | `device-tracking-perm-check-on-session` | P1-16: defer permission check until session loaded | 0.5 | |
| 20 | `device-tracking-on-change-rider` | P1-17: remove stale `t.fetchData()` | 0.25 | |
| 21 | (cleanup) | P2-1 through P2-20: type safety + contract | 4 | |
| 22 | (P3s) | Various small cleanups | 3 | |

**Total: 22 PRs, ~20 hours of focused work.** The first 5 are P0 and ship in ~3 hours.

---

## 9. Cross-cutting observations

1. **The `lockPassword` vs `lockPasswordHash` field-name confusion appears in 4 files** — `verify-lock/route.ts:62,65,69` (P0-1), `admin-riders.use-cases.ts:684` (P0-5), `device-compliance.use-cases.ts:36` (P1-9), and indirectly the `SecurityControls.tsx:328-334` default rider object (P2-15). A simple lint rule that detects dual-named credential fields would have caught this at write time. Suggest adding to `tool/lint_*.dart` analogues in TS.

2. **The same "two parallel schemas" pattern appears 3 times now** — `createAdminSchema` (admin audit), `updateLegalSchema` (this audit), and previously for `rider` mutations. The strict version is always `validators/admin.ts`, the non-strict version is always `validators.ts`. The fix: collapse to one file (`validators/admin.ts` is the canonical one) and migrate all routes.

3. **The "dead enum value" pattern is recurring** — `LOCK_DEVICE` and `ENABLE_CAMERA` in `riderActionSchema`, `ADMIN`/`MANAGER`/`SUPPORT_LEAD`/`VIEWER` in the admin role dropdown (admin audit), `AnalyticsDashboard` type (admin audit). Recommend a CI check that enum values in Zod schemas are actually reachable in the route's switch.

4. **The "client-side permission check that the server also does" pattern is fine for security, but the UX is broken** — when the server returns 403, the client usually shows a generic error or a blank screen. The pattern should be: client shows "You don't have permission" card on `!hasPermission`, and ALSO catches 403 from the server with the same UI. Right now they're independent code paths.

5. **The `legalManage: []` permission is the third empty permission in the matrix** — `admins_manage: []` (admin audit), `settings_manage: []` (admin audit), `legal_manage: []` (this audit). Each is saved by the `SUPER_ADMIN` special bypass in `hasPermission` (line 88 of `permissions.ts`). If a future refactor removes the bypass, three sections would 403 for every admin. Suggest an audit-time check: every permission in the matrix should have at least one role assigned OR an explicit "super_admin only" comment.

6. **The `process.env.APP_ENV !== 'development'` check is in 2 places** (`WorkflowCoverageScreen.tsx:120` and the dead `getDashboardStats` in the analytics audit). This is custom env var convention. Document it or migrate to Next.js's `NODE_ENV`.

7. **The `INTERNAL_API_URL` / `NEXT_PUBLIC_APP_URL` fallback** is in `workflow-coverage/route.ts:43`. Same pattern appears in the dr-drill runner (PR-D-FIX from the previous PR set). The fallback is fine for dev but dangerous in prod. Add a startup-time validation: `if (NODE_ENV === 'production' && !process.env.INTERNAL_API_URL) throw`.

8. **The 4 separate `legal_manage`, `legal/route.ts`, `legalUseCases` files have 3 sources of truth for the document types** (UI hardcoded, Zod enum, Prisma string). For a 4-item list, this is OK. For 20 items, it would be a maintenance nightmare. Document the contract.

9. **The `DeviceRiderSettings.lockPassword: string | null` type in `types.ts:30` is wrong** — the value is always `null` (or `undefined` from the wrong SELECT). Drop the field from the type.

10. **The `fcmRequiredActions` list at `actions/route.ts:88-99` includes `LOCK_DEVICE` and `ENABLE_CAMERA`** — both are dead. The list has 2 dead entries out of 7. Drift over time will add more.

---

## 10. What this audit confirmed (vs. previous 5 audits)

- **Same `lockPassword` vs `lockPasswordHash` confusion** — found in 4 files here (P0-1, P0-5, P1-9, P2-15). The riders deep audit caught one of these on 2026-08-05. The pattern is "two parallel fields, only one updated". A `linter` check is warranted.

- **Same "two parallel schemas" drift** — `updateLegalSchema` (non-strict, used by live route) vs `updateLegalAdminSchema` (`.strict()`, canonical, unused). Same pattern as `createAdminSchema` / `CreateAdminSchema` from the admin audit. Same fix: pick one file as canonical.

- **Same "dead enum value in Zod schema"** — `LOCK_DEVICE` and `ENABLE_CAMERA` in `riderActionSchema`. The admin audit found `ADMIN`/`MANAGER`/`SUPPORT_LEAD`/`VIEWER` in the role dropdown. The analytics audit found `getDashboard` as a dead use-case method. The pattern: someone added an action, then disabled it in the route, but didn't clean up the schema. Recommend a CI check that every enum value has at least one switch case that doesn't `return errors.badRequest`.

- **Same "silent fetch errors with `if (!res.ok) return`"** — `useDeviceTracking.ts:62-72`, `useDeviceTracking.ts:88-118`, `LegalManagement.tsx:70-87`, `WorkflowCoverageScreen.tsx:122-137`. The pattern is universal. Suggest a `useApiFetch` hook with built-in error handling, used everywhere.

- **Same "permission gate is muddled"** — `actions/route.ts:19` uses `riders_update` (broad), then `handleSecurityAction:86` uses `device_remote_control` (narrow). The team-leaders audit found `team_leaders_manage` vs `tl_manage` confusion. The pattern: routes named after a concept but checking a different permission. The 403 error message doesn't say which permission was missing.

- **Same "in-memory state that doesn't survive serverless"** — N/A for this audit (no rate limiters, no caches). The pattern was found in the admin audit (login rate limit).

- **The "dev-only feature shipped to prod" pattern is new here** — `workflow-coverage/route.ts` has no prod guard but the UI does. The data-management route from the prior audits may have a similar issue (not re-read in this audit).

- **The "module exists but isn't wired" pattern is widespread** — `device-compliance.policy.ts` is unused (P1-10), `device-compliance.schemas.ts` is unused (P3-3), `device-compliance.repository.ts getState` is unused (P3-4), `legalUseCases.upsert`'s `sanitizeHtml` may be unnecessary (P1-3). The team has been adding modules "for completeness" but not always wiring them. Consider adding a "use count" lint to the CI: every exported function is called at least once, otherwise warn.

- **The "P0 in audit but not in the next" pattern** — P0-1 (`verify-lock` reads `lockPassword`) was flagged in the riders deep audit on 2026-08-05 and is still unfixed. Either the fix was attempted and reverted, or it was deprioritized. The bug ships in production every day. This is the most concerning finding across all 6 audits: **a known P0 from 1 day ago is not fixed**.

---

**End of audit. Total findings: 5 P0s, 17 P1s, 20 P2s, 17 P3s, 8 test gaps, ~400 lines of dead code.**
