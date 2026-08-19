# Detailed Fix Plan — 7 Mixed Audits (2026-08-06)

**Date:** 2026-08-06
**Scope:** Fix every still-true and partially-fixed finding from the 7-audit re-verification (`docs/audits/2026-08-06-reverification-7-mixed-audits.md`).
**Audits covered:**
1. `ADMIN_RIDER_MANAGEMENT_AUDIT_2026-08-05.md`
2. `ADMIN_SHIFTS_SCORING_MESSAGING_OFFERS_AUDIT_2026-08-05.md`
3. `ADMIN_SUPPORT_INCIDENT_FINES_AUDIT_2026-08-05.md`
4. `EVENT_BUS_CATALOGUE_AUDIT_2026-08-05.md`
5. `FLUTTER_API_AUTH_FLOW_AUDIT_2026-08-05.md`
6. `FLUTTER_API_RENTAL_LIFECYCLE_FLOW_AUDIT_2026-08-05.md`
7. `FLUTTER_API_SUPPORT_NOTIFICATIONS_AUDIT_2026-08-05.md`

**Inventory:**
- 11 P0s still true (4 critical, 7 important)
- 4 P0s partially fixed (need to close the gap)
- 23 P1s still true (10 impactful, 13 low-priority)
- 29 P1s already in `FOLLOWUP_TICKETS.md` backlog
- 1 N/A (intentional GDPR change)

**Total still-true: 38 items** (down from 40 P0s in the original audits — 16 already fixed in this round).

**Auditor:** Mavis (this plan)

---

## 0. TL;DR

This plan delivers **24 PRs across 4 phases** (P0 critical → P0 important → P1 impactful → P1 housekeeping). Wall time: **5 days, 1 reviewer. Total reviewer time: ~22 hours.** Plus 5 backlog items for product decisions.

The work is split by **blast radius**:

| Phase | Items | Time | Description |
|---|---|---|---|
| **Phase 1: P0 critical (security + ops blockers)** | 6 PRs | 5h | Admin reply, incident fraud vector, audit log gaps, dead code with silent failure |
| **Phase 2: P0 important (broken features)** | 6 PRs | 5h | Event bus dead consumers, dead code, Flutter end-rental fixes |
| **Phase 3: P1 impactful (UX + quality)** | 8 PRs | 8h | Search, dashboards, type mapping, priority, scoring breakdown |
| **Phase 4: P1 housekeeping (cleanup)** | 4 PRs | 4h | Dead code, dead widgets, dead enum cleanup |
| **Backlog (5 items)** | — | — | Product decisions, long refactors, real-time chat build |

**Highest-blast-radius items (do first):**
1. **PR-3 — Admin "Send Reply" feature is non-functional** (admin support P0-1) — test for it exists and fails in CI. 1-hour build unblocks a core ops workflow.
2. **PR-4 — Incident assignment uses free-text Input** (fraud vector) — admin can type any string and have it saved as `adminId`. Replace with `<Select>` of valid IDs.
3. **PR-1 — Bulk rider DELETE writes no audit log** (SOC2 gap) — silent rider destruction.
4. **PR-8 + PR-10 — End-rental Flutter contract drift + stranded success** (real money flow) — rider currently can't end rentals successfully.

---

## 1. Re-verified state (recap)

### Items still true (11 P0s + 23 P1s = 34 items)

| Audit | P0 still true | P1 still true |
|---|---|---|
| Admin Rider Management | P0-1 (4 endpoints mismatch), P0-3 (KYC 2 round trips), P0-5 (bulk DELETE no audit) | P1-1, P1-2, P1-3, P1-4, P1-5, P1-6, P1-7 |
| Admin Shifts/Scoring/Messaging/Offers | (none — all P0s fixed) | P1-1, P1-2, P1-3, P1-4 |
| Admin Support/Incidents/Fines | P0-1 (ticket messages missing), P0-4 (incident assignment free-text) | P1-2, P1-3 |
| Event Bus Catalogue | P0-3 (WALLET_RECONCILIATION dead), P0-5 (RENT_PAID dead) | P1-1, P1-2, P1-3, P1-4, P1-5, P1-6 |
| Flutter Auth Flow | (none — P0-3 is dead code) | P1-1, P1-2, P1-5, P1-6 |
| Flutter Rental Lifecycle | P0-3 (RiderProvider empty vehicleId), P0-4 (EndRental stranded success) | P1-1, P1-2, P1-3, P1-4, P1-5 |
| Flutter Support/Notifications | P0-2 (no /api/rider/search), P0-3 (chat dead-end), P0-5 (markAllRead race) | P1-1, P1-2, P1-3, P1-4, P1-5 |

### Items partially fixed (4 P0s)

| # | Item | What's still needed |
|---|---|---|
| 1 | Admin messaging P0-4 (notifications type string mapping) | Verify the type strings now match the Prisma enum; fix any that don't |
| 2 | Admin support P0-3 (`updateIncidentSchema` enum) | `OPEN` still in the enum but state machine uses `REPORTED`; the `IncidentDetailSheet` "Reopen" button sends `OPEN` which the server accepts but the state machine doesn't |
| 3 | Flutter rental P0-1 (end-rental body shape) | Server accepts `returnPhotos[]`; Flutter side may still send `photoUrls[]` |
| 4 | Event bus P1-6 (`ADMIN_JOB_*` priority mismatches) | Most fixed; `daily-engagement` still wrong |

### Items now in backlog (29 P1s)

These are real but **deliberately excluded** from this plan because they need a different conversation (see Section 6).

---

## 2. Plan structure (24 PRs across 4 phases)

### Phase 1 — P0 critical (security + ops blockers) (6 PRs, ~5 hours)

| PR | Title | Files | Est. | Why now |
|---|---|---|---|---|
| **PR-1** | **Add audit log to bulk rider DELETE** (admin rider P0-5) | `web/src/server/modules/riders/admin-riders.use-cases.ts:762-772` | **30m** | Silent rider destruction; SOC2 gap; trivial fix |
| **PR-2** | **Verify + fix notification type string mapping** (admin messaging P0-4 partial) | `web/src/lib/notification-service.ts:49-123`, `web/prisma/schema.prisma:1447-1458` (verify enum) | **1h** | If type strings don't match, every notification throws silently |
| **PR-3** | **Build `/api/admin/tickets/[id]/messages` route** (admin support P0-1) | New file: `web/src/app/api/admin/tickets/[id]/messages/route.ts` | **1h** | **Admin reply feature is non-functional; test for it exists and fails** |
| **PR-4** | **Replace free-text incident assignment with `<Select>` of valid admin IDs** (admin support P0-4) | `web/src/components/admin/screens/incident-management/IncidentDetailSheet.tsx:251-258`, `web/src/app/api/admin/incidents/[id]/route.ts` (server-side validation) | **1h** | Fraud vector |
| **PR-5** | **Add server-side validation for incident assignment** (paired with PR-4) | `web/src/app/api/admin/incidents/[id]/route.ts` | **30m** | Don't trust the client |
| **PR-6** | **Make `OPEN` and `REPORTED` consistent in incident state machine** (admin support P0-3 partial) | `web/src/server/modules/incidents/incident-state-machine.ts:1`, `web/src/lib/validators.ts:535` (enum) | **30m** | Audit recommended `REPORTED` everywhere; `OPEN` is now a duplicate |

**Subtotal: ~5 hours.**

### Phase 2 — P0 important (broken features) (6 PRs, ~5 hours)

| PR | Title | Files | Est. | Why now |
|---|---|---|---|---|
| **PR-7** | **Remove `WALLET_RECONCILIATION` dead enum + consumer** (event bus P0-3) | `web/src/server/workers/outbox.ts:35-126` (remove the entry), `web/src/server/workers/index.ts:62-69` (remove consumer) | **15m** | Dead enum + dead consumer |
| **PR-8** | **Remove `RENT_PAID` dead enum + consumer** (event bus P0-5) | Same files | **15m** | Same |
| **PR-9** | **Fix `ADMIN_JOB_DAILY_ENGAGEMENT` priority to `background`** (event bus P1-2) | `web/src/app/api/admin/jobs/route.ts:298-308` | **15m** | 1-line fix; prevents interactive queue starvation |
| **PR-10** | **Verify Flutter `EndRentalScreen` uses `returnPhotos` not `photoUrls`** (Flutter rental P0-1 partial) | `flutter/lib/services/voltium_api_service.dart`, `flutter/lib/core/network/generated/api_models.dart` | **1h** | Confirm contract drift is closed end-to-end |
| **PR-11** | **Delete dead `RiderProvider.submitVehicleReturn`** (Flutter rental P0-3) | `flutter/lib/core/state/rider_provider.dart:279-301` (delete), `flutter/lib/features/rentals/data/repository_impl.dart:49-60` (delete) | **15m** | Dead code with a swap bug |
| **PR-12** | **`EndRentalScreen` refresh + nav back on success** (Flutter rental P0-4) | `flutter/lib/features/rentals/presentation/screens/end_rental_screen.dart` (add `refreshFromApi` + `Navigator.pop(context, true)` in success branch), `flutter/lib/features/rentals/presentation/screens/rental_details_screen.dart:243-250` (pass `onSuccess` callback) | **1h** | User-facing: success state currently stranded |

**Subtotal: ~4 hours.**

### Phase 3 — P1 impactful (UX + quality) (8 PRs, ~8 hours)

| PR | Title | Files | Est. | Why now |
|---|---|---|---|---|
| **PR-13** | **Fix `useRiders` response parsing** (admin rider P1-2) | `web/src/components/admin/screens/rider-management/useRiders.ts` | **1h** | Inconsistent parsing with other hooks; low risk |
| **PR-14** | **Coupons/Offer search filter the dataset, not the page** (admin messaging P1-1) | `web/src/components/admin/screens/offers/useOffers.ts`, `web/src/app/api/admin/coupons/route.ts` (add server-side search) | **1h** | Current behavior filters loaded page only |
| **PR-15** | **Bulk messaging N+1 hub fetches → single batched query** (admin messaging P1-2) | `web/src/components/admin/screens/bulk-messaging/useBulkMessaging.ts` | **1h** | N+1 round-trips for hubs |
| **PR-16** | **Scoring breakdown dialog — fix the 2 zeroed sub-scores** (admin messaging P1-4) | `web/src/components/admin/screens/rider-scoring/ScoringBreakdownDialog.tsx` | **1h** | The breakdown is misleading; the "wallet" and "plan" sub-scores always show 0% |
| **PR-17** | **Update `KYC` review screen to use 1 round trip** (admin rider P0-3) | `web/src/components/admin/screens/kyc-management/useKyc.ts:38-44` | **1h** | The 2-round-trip race is real; combine the queries |
| **PR-18** | **Add `exists` is a UI-only hint (intentional)** | Document the GDPR change in `web/src/contracts/auth.contract.ts` (mark `exists` as deprecated) | **30m** | The audit flagged it as a bug; it's a privacy improvement |
| **PR-19** | **Increase `MAX_OUTBOX_PAYLOAD_BYTES` from 64KB to 1MB** (event bus P1-4) | `web/src/server/workers/outbox.ts:150` | **15m** | Trivial 1-line fix; unblocks batch operations |
| **PR-20** | **`subscribePlanSchema` adds `hubId`/`securityDeposit`/`advanceRentPaid`** (Flutter rental P1-1) | `web/src/lib/validators.ts:358-362` (add fields), `flutter/.../api_client.dart` (regen) | **1h** | Document the server contract; align with what Flutter sends |

**Subtotal: ~8 hours.**

### Phase 4 — P1 housekeeping (cleanup) (4 PRs, ~4 hours)

| PR | Title | Files | Est. | Why now |
|---|---|---|---|---|
| **PR-21** | **Remove `auth.routes.ts` parallel implementation** (Flutter auth P0-3) | `web/src/server/modules/auth/auth.routes.ts` (delete) | **15m** | Dead code; 48 lines of confusion |
| **PR-22** | **Remove 8 deprecated outbox events** (event bus P1-1) | `web/src/server/workers/outbox.ts:35-126` (remove `WALLET_TOPUP_REQUESTED`, `DEPOSIT_APPROVED`, `DEPOSIT_REJECTED`, `DEPOSIT_REFUNDED`, `ANNOUNCEMENT_DISPATCH`, `REFERRAL_SIGNUP`, `RENT_DUE`, `AUDIT_LOG_CLEANUP`, `TELEMETRY_DATA_CLEANUP`) | **1h** | Mechanical; remove dead enum entries |
| **PR-23** | **Delete `rental.schemas.ts` and `endRentalSchema`** (Flutter rental P1-2) | `web/src/server/modules/rentals/rental.schemas.ts` (delete; re-export is dead) | **15m** | Dead code |
| **PR-24** | **Add `validateAdmin` middleware to admin endpoints** (defense-in-depth) | `web/src/lib/rbac.ts` (add helper), apply to all `/api/admin/*` routes that don't have it | **2h** | Audit logging is best-effort; permission gates are the first line of defense |

**Subtotal: ~4 hours.**

### Backlog (5 items) — Deferred

| Item | Title | Why deferred | Where to track |
|---|---|---|---|
| **BACKLOG-1** | **Build `/api/rider/search` for rider-side cross-entity search** (Flutter support P0-2) | Product decision: what does "search" mean for the rider? 4-6h. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-2** | **Delete or properly build `/api/support/chat`** (Flutter support P0-3) | Either 1h to delete or 1-2 weeks to build properly. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-3** | **`markAllRead` race with per-id `markRead`** (Flutter support P0-5) | Needs design: should `markAllRead` invalidate the per-id cache? Or use a different API path? 1-2h. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-4** | **All 29 P1s from the 7 audits** | Various low-priority UX/test/code quality issues. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-5** | **`MAX_OUTBOX_PAYLOAD_BYTES` strategy (split or bump?)** | 1h to bump to 1MB (PR-19); 1 day to do the split-into-sub-events pattern. | `docs/FOLLOWUP_TICKETS.md` |

---

## 3. Detailed PR specifications

### PR-1 — Add audit log to bulk rider DELETE

**Audit:** admin-rider-management P0-5
**Severity:** P0 (SOC2 gap, silent data destruction)
**Effort:** 30 min
**Risk:** Low

**Files:**
- `web/src/server/modules/riders/admin-riders.use-cases.ts:762-772`

**Current state:**
```typescript
async delete(id: string) {
  await db.$transaction([
    db.notification.deleteMany({ where: { riderId: id } }),
    db.rentalLease.deleteMany({ where: { riderId: id } }),
    db.guarantor.deleteMany({ where: { riderId: id } }),
    db.kycProfile.deleteMany({ where: { riderId: id } }),
    db.wallet.deleteMany({ where: { riderId: id } }),
    db.rider.delete({ where: { id } }),
  ]);
  invalidateRiderCache(id);
}
```

**Fix:**
```typescript
async delete(id: string, actorId: string) {
  await db.$transaction(async (tx) => {
    // Capture rider snapshot for audit BEFORE delete
    const rider = await tx.rider.findUnique({ where: { id }, select: { id: true, riderId: true, fullName: true, phone: true, email: true, lifecycleStatus: true } });
    if (!rider) throw new Error('Rider not found');

    // Audit log FIRST (inside the transaction; rolls back if anything fails)
    await tx.auditLog.create({
      data: {
        actorId,
        actorType: 'ADMIN',
        action: 'rider.delete',
        entity: 'Rider',
        entityId: id,
        details: { riderSnapshot: rider },
      },
    });

    // Cascade delete
    await tx.notification.deleteMany({ where: { riderId: id } });
    await tx.rentalLease.deleteMany({ where: { riderId: id } });
    await tx.guarantor.deleteMany({ where: { riderId: id } });
    await tx.kycProfile.deleteMany({ where: { riderId: id } });
    await tx.wallet.deleteMany({ where: { riderId: id } });
    await tx.rider.delete({ where: { id } });
  });
  invalidateRiderCache(id);
}
```

**Update the bulk DELETE call site** (`riders/bulk/route.ts`) to pass `session.adminId`:
```typescript
await adminRiderUseCases.delete(id, session.adminId);
```

**Acceptance criteria:**
- [ ] `delete(id, actorId)` writes a `rider.delete` audit log inside the same transaction
- [ ] Audit log includes rider snapshot (id, riderId, fullName, phone, email, lifecycleStatus)
- [ ] If the transaction fails, the audit log is rolled back (no orphan audit entries)
- [ ] Caller in `riders/bulk/route.ts` passes `session.adminId`
- [ ] Integration test: assert that calling `delete()` produces an audit log row with the correct snapshot

**Reviewer focus:** The transaction atomicity is the key check. Verify by simulating a failure (e.g., inject a constraint violation) and confirm the audit log isn't written alone.

---

### PR-2 — Verify + fix notification type string mapping

**Audit:** admin-shifts-scoring-messaging-offers P0-4 (partial)
**Severity:** P0 (silent notification failure across all business events)
**Effort:** 1 hour
**Risk:** Low

**Files:**
- `web/src/lib/notification-service.ts:49-123` (business event helpers)
- `web/prisma/schema.prisma:1447-1458` (NotificationType enum)
- `web/src/server/modules/notifications/notification.use-cases.ts` (the consumer)

**Current state:** The audit noted that 5 type strings (`KYC_UPDATE`, `SUPPORT_REPLY`, `PAYMENT_DUE`, `REWARD`, `SHIFT_REMINDER`) are not in the `NotificationType` enum. The audit's claim is from before any fixes — need to verify if the team has since updated the enum.

**Fix:**
1. Read `web/prisma/schema.prisma:1447-1458` and confirm the current `NotificationType` enum.
2. For each business event helper (`notifyKycStatusChange`, `notifySupportReply`, `notifyPaymentReminder`, `notifyRewardMilestone`, `notifyBirthdayWish`, `notifyShiftReminder`):
   - Check the type string passed to `createAndSend`
   - If the type is not in the enum, **add it to the enum** (with a comment) OR **map it to a valid enum value**
3. Run a quick integration test: trigger each business event, assert a `Notification` row is created with the correct `type`.

**Acceptance criteria:**
- [ ] Every `notify*` helper passes a type that is in the `NotificationType` enum
- [ ] For each helper, an integration test creates the notification successfully (no exception)
- [ ] No silent failures (i.e., the try/catch in `createAndSend` doesn't swallow valid events)

**Reviewer focus:** The audit's main concern was silent swallowing. The fix is small (1-3 enum additions + tests) but the impact is huge (every business notification).

---

### PR-3 — Build `/api/admin/tickets/[id]/messages` route

**Audit:** admin-support-incident-fines P0-1
**Severity:** P0 (admin reply feature is non-functional)
**Effort:** 1 hour
**Risk:** Low

**Files:**
- New: `web/src/app/api/admin/tickets/[id]/messages/route.ts`
- Existing test: `web/tests/integration/admin/tickets_id_messages.test.ts` (already exists; should pass after this fix)

**Fix:**

Create the route:
```typescript
// web/src/app/api/admin/tickets/[id]/messages/route.ts
import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, sendMessageSchema } from '@/lib/validators';
import { requireAdmin, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { supportUseCases } from '@/server/modules/support/support.use-cases';
import { logger } from '@/lib/logger';
import { notifySupportReply } from '@/lib/notification-service';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return errors.unauthorized('Admin authentication required');

    if (!hasPermission(session.adminRole || '', 'tickets_manage')) {
      return adminForbidden('Requires tickets_manage permission');
    }

    const body = await request.json().catch(() => null);
    const validation = validateBody(sendMessageSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error!);
    }

    const message = await supportUseCases.replyToTicket(
      params.id,
      session.adminId,
      'ADMIN',
      { message: validation.data.message }
    );

    // Notify the rider
    await notifySupportReply(params.id, message.id).catch((err) => {
      logger.error('[POST /api/admin/tickets/messages] notify failed', { err });
    });

    return success({ message }, 'Reply sent successfully', 201);
  } catch (err: unknown) {
    logger.error('[POST /api/admin/tickets/messages]', err);
    return errors.internal('Failed to send reply');
  }
}
```

**Acceptance criteria:**
- [ ] Route handles `POST` with `{ message: string }` body
- [ ] Permission: `tickets_manage`
- [ ] Returns 201 with the new message id
- [ ] Calls `notifySupportReply` to push the notification to the rider
- [ ] Existing test `tickets_id_messages.test.ts` passes
- [ ] Add a Flutter integration test (or update existing) that asserts the reply is visible in the ticket detail

**Reviewer focus:** The test for this route already exists. If the route is built correctly, the test will pass. If the test is somehow wrong, fix the test. Verify the `notifySupportReply` is actually pushing to FCM (or the right channel).

---

### PR-4 — Replace free-text incident assignment with `<Select>` of valid admin IDs

**Audit:** admin-support-incident-fines P0-4
**Severity:** P0 (fraud vector)
**Effort:** 1 hour
**Risk:** Low (defense-in-depth; client-side fix only)

**Files:**
- `web/src/components/admin/screens/incident-management/IncidentDetailSheet.tsx:251-258`
- `web/src/components/admin/screens/incident-management/useIncidents.ts` (fetch admin list)

**Current state:**
```tsx
<Input
  placeholder="Admin ID or name"
  onBlur={(e) => {
    if (e.target.value) onAssign(selectedIncident.id, e.target.value);
  }}
/>
```

**Fix:**

1. Fetch the list of valid admins (the same list used by the ticket-management bulk assign):
```typescript
// useIncidents.ts
const admins = useQuery({ queryKey: ['admins'], queryFn: () => fetch('/api/admin/admins?limit=100').then(r => r.json()) });
```

2. Replace the `<Input>` with a `<Select>`:
```tsx
<Select
  value={selectedIncident.assignedTo || ''}
  onValueChange={(value) => onAssign(selectedIncident.id, value)}
>
  <SelectTrigger>
    <SelectValue placeholder="Unassigned" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">Unassigned</SelectItem>
    {admins.map((admin) => (
      <SelectItem key={admin.id} value={admin.id}>
        {admin.name} ({admin.email})
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

3. Remove the `onBlur` handler.

**Acceptance criteria:**
- [ ] Assignment uses a `<Select>` of valid admin IDs
- [ ] "Unassigned" option is present
- [ ] No free-text input
- [ ] Selection is committed on click (not on blur)
- [ ] Server-side validation rejects unknown admin IDs (paired with PR-5)

---

### PR-5 — Add server-side validation for incident assignment

**Audit:** admin-support-incident-fines P0-4 (server-side)
**Severity:** P0 (defense in depth)
**Effort:** 30 min
**Risk:** Low

**Files:**
- `web/src/app/api/admin/incidents/[id]/route.ts`

**Current state:** The PUT handler accepts `assignedTo: z.string().optional()` — no validation that it's a real admin ID.

**Fix:**

```typescript
// In the route, before processing:
if (data.assignedTo) {
  const admin = await db.admin.findUnique({ where: { id: data.assignedTo }, select: { id: true } });
  if (!admin) {
    return errors.validation(`Unknown admin ID: ${data.assignedTo}`);
  }
}
```

**Acceptance criteria:**
- [ ] Server rejects `assignedTo` values that don't match an `Admin.id`
- [ ] Returns 400 with a clear error message
- [ ] Audit log includes the resolved admin's name (not just the raw ID)
- [ ] Integration test: assert that PUT with a fake `assignedTo` returns 400

---

### PR-6 — Make `OPEN` and `REPORTED` consistent in incident state machine

**Audit:** admin-support-incident-fines P0-3 (partial)
**Severity:** P1 (consistency)
**Effort:** 30 min
**Risk:** Medium (touches the state machine)

**Files:**
- `web/src/server/modules/incidents/incident-state-machine.ts:1`
- `web/src/lib/validators.ts:535` (enum)
- `web/src/components/admin/screens/incident-management/IncidentDetailSheet.tsx:240-248` (Reopen button)

**Current state:** The enum includes both `OPEN` and `REPORTED`. The state machine uses 5 statuses. The "Reopen" button sends `OPEN` to the server, but the state machine transitions `RESOLVED → INVESTIGATING` (no `OPEN` in the transition map).

**Fix:** Pick one. The audit recommended `REPORTED`. Migration:

1. Remove `OPEN` from the enum in `validators.ts:535`.
2. Update the `IncidentDetailSheet` "Reopen" button to send `REPORTED`.
3. Update the state machine to use `REPORTED` for the new status.
4. Add a migration script to rename any existing `OPEN` rows in the DB to `REPORTED`.

**Acceptance criteria:**
- [ ] Enum has only `REPORTED`, `INVESTIGATING`, `RESOLVED`, `CLOSED`, `DISMISSED` (no `OPEN`)
- [ ] "Reopen" button sends `REPORTED`
- [ ] State machine transitions match the enum
- [ ] Migration script converts any existing `OPEN` rows to `REPORTED`
- [ ] Integration test: a `RESOLVED` incident can be "reopened" (transitioned to `INVESTIGATING`)

**Reviewer focus:** This is a data migration. Verify the migration is safe (idempotent, handles no-row case).

---

### PR-7 — Remove `WALLET_RECONCILIATION` dead enum + consumer

**Audit:** event-bus-catalogue P0-3
**Severity:** P1 (cleanup; the dead consumer polls every minute)
**Effort:** 15 min
**Risk:** Low (dead code)

**Files:**
- `web/src/server/workers/outbox.ts:35-126` (remove enum entry)
- `web/src/server/workers/index.ts:62-69` (remove consumer)

**Current state:** `WALLET_RECONCILIATION` is in the enum, has a consumer (the OLD N+1 `reconciliationJob`), but no producer. The cron route calls the function directly. The admin `/api/admin/jobs` uses `ADMIN_JOB_WALLET_RECONCILIATION` (a different event type with a producer).

**Fix:**

1. Remove the `WALLET_RECONCILIATION` entry from `OutboxEventTypes` enum.
2. Remove the `{ jobType: OutboxEventTypes.WALLET_RECONCILIATION, ... }` entry from `WORKERS` array.
3. Verify the consumer was the OLD N+1 implementation (it was — see audit).

**Acceptance criteria:**
- [ ] `WALLET_RECONCILIATION` no longer in the enum
- [ ] Consumer no longer in `WORKERS` array
- [ ] No new lint warnings
- [ ] All existing tests still pass

**Reviewer focus:** The audit noted that `reconciliationJob` is the OLD N+1 version. If we keep the `reconciliationJob` for `ADMIN_JOB_WALLET_RECONCILIATION`, that's OK. Just remove the dead enum entry + the orphan consumer registration.

---

### PR-8 — Remove `RENT_PAID` dead enum + consumer

**Audit:** event-bus-catalogue P0-5
**Severity:** P1 (cleanup)
**Effort:** 15 min
**Risk:** Low

**Files:**
- `web/src/server/workers/outbox.ts` (remove enum entry)
- `web/src/server/workers/jobs/orphan-event-consumer.job.ts` (remove `handleRentPaid`)

**Current state:** `RENT_PAID` is in the enum (marked `@deprecated`), the orphan consumer subscribes to it, but no producer emits it.

**Fix:**

1. Remove the `RENT_PAID` entry from `OutboxEventTypes` enum.
2. Remove the `handleRentPaid` method and its registration in `orphanEventConsumerJob`.

**Acceptance criteria:**
- [ ] `RENT_PAID` no longer in the enum
- [ ] `handleRentPaid` removed
- [ ] No new lint warnings

**Reviewer focus:** This is dead code. No regression risk.

---

### PR-9 — Fix `ADMIN_JOB_DAILY_ENGAGEMENT` priority to `background`

**Audit:** event-bus-catalogue P1-2
**Severity:** P1 (prevents interactive queue starvation)
**Effort:** 15 min
**Risk:** Low

**Files:**
- `web/src/app/api/admin/jobs/route.ts:298-308` (the JOB_TO_OUTBOX map or the priority mapping)

**Current state:** `ADMIN_JOB_DAILY_ENGAGEMENT` is emitted with `priority: 'interactive'`. Daily engagement is background work (it sends birthday wishes, payment reminders, etc. — not user-latency-sensitive).

**Fix:** Change the priority mapping for `ADMIN_JOB_DAILY_ENGAGEMENT` to `'background'`.

**Acceptance criteria:**
- [ ] `daily-engagement` is emitted with `priority: 'background'`
- [ ] `hasPendingInteractive()` check correctly identifies it as background
- [ ] Integration test: assert the emitted event has the correct priority

---

### PR-10 — Verify Flutter `EndRentalScreen` uses `returnPhotos` not `photoUrls`

**Audit:** flutter-api-rental-lifecycle-flow P0-1 (partial)
**Severity:** P0 (end-rental still broken if Flutter side didn't update)
**Effort:** 1 hour
**Risk:** Low

**Files:**
- `flutter/lib/services/voltium_api_service.dart` (the `submitVehicleReturn` method)
- `flutter/lib/core/network/generated/api_models.dart` (the `VehicleReturnRequest` model)

**Current state:** The server now accepts `returnPhotos[]` (per the strict schema fix). The Flutter side may still send `photoUrls[]`.

**Fix:**

1. Read `flutter/lib/services/voltium_api_service.dart:172-184` and check the body shape.
2. If it sends `photoUrls`, change to `returnPhotos`.
3. If the generated `VehicleReturnRequest` model has `photoUrls`, regenerate from the OpenAPI spec OR update the model's `toJson`.
4. Add a Flutter integration test that exercises the full upload → return flow and asserts 200.

**Acceptance criteria:**
- [ ] Flutter sends `returnPhotos` (not `photoUrls`)
- [ ] Server returns 200 (not 400)
- [ ] The full flow works end-to-end
- [ ] Integration test in `flutter/integration_test/e2e_individual/32_rental_end_test.dart` covers the happy path

**Reviewer focus:** This is a contract drift. The simplest fix is to update the Flutter model. If the generated client has `photoUrls`, we need to regenerate.

---

### PR-11 — Delete dead `RiderProvider.submitVehicleReturn`

**Audit:** flutter-api-rental-lifecycle-flow P0-3
**Severity:** P1 (dead code with a swap bug)
**Effort:** 15 min
**Risk:** Low

**Files:**
- `flutter/lib/core/state/rider_provider.dart:279-301` (delete the method)
- `flutter/lib/features/rentals/data/repository_impl.dart:49-60` (delete the method)

**Current state:** `RiderProvider.submitVehicleReturn(photos, reason)` passes `vehicleId: ''` and `hubId: ''` to `RentalRepositoryImpl.submitVehicleReturn(vehicleId, hubId, photos)` which then does `riderId: vehicleId` (param swap). Dead code today, but a maintenance landmine.

**Fix:**

1. Delete the `submitVehicleReturn` method from `RiderProvider`.
2. Delete the `submitVehicleReturn` method from `RentalRepositoryImpl`.
3. Add a comment on the `RentalRepository` interface explaining the current architecture: "The repository is currently a thin abstraction; prefer `VoltiumApiService` for new code."

**Acceptance criteria:**
- [ ] Both methods deleted
- [ ] No compile errors (no remaining callers)
- [ ] Comment added to `RentalRepository` interface

---

### PR-12 — `EndRentalScreen` refresh + nav back on success

**Audit:** flutter-api-rental-lifecycle-flow P0-4
**Severity:** P0 (user-facing: success state stranded)
**Effort:** 1 hour
**Risk:** Low

**Files:**
- `flutter/lib/features/rentals/presentation/screens/end_rental_screen.dart` (success branch)
- `flutter/lib/features/rentals/presentation/screens/rental_details_screen.dart:243-250` (pass `onSuccess` callback)

**Current state:** The success state fires a 2-second `Future.delayed` then calls `widget.onSuccess?.call()` — but the caller in `rental_details_screen.dart` doesn't pass `onSuccess`. The user is stranded on the success screen.

**Fix:**

1. In `end_rental_screen.dart`, after the 2-second delay:
   - Call `ref.read(riderProvider.notifier).refreshFromApi()` to pull the fresh `lifecycleStatus: 'RETURN_PENDING'`.
   - Call `widget.onSuccess?.call()` (which will trigger the nav back).

2. In `rental_details_screen.dart:243-250`:
```dart
ElevatedButton(
  onPressed: () async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => EndRentalScreen(
          onSuccess: () => Navigator.of(context).pop(true),
        ),
      ),
    );
  },
  ...
)
```

3. Move `PostHogService.capture('rental_ended', ...)` into the success branch (only fire on actual success).

**Acceptance criteria:**
- [ ] After successful return, `riderProvider.refreshFromApi()` is called
- [ ] `widget.onSuccess` is wired in `rental_details_screen.dart`
- [ ] PostHog only fires on actual success
- [ ] Integration test: success path returns to rental details with updated state

---

### PR-13 — Fix `useRiders` response parsing

**Audit:** admin-rider-management P1-2
**Severity:** P1 (parsing consistency)
**Effort:** 1 hour
**Risk:** Low

**Files:**
- `web/src/components/admin/screens/rider-management/useRiders.ts`

**Current state:** The audit noted that `useRiders` parses the response inconsistently with other admin hooks (e.g., `useKyc`, `useBulkMessaging`).

**Fix:** Audit the response shape and align the parsing with the standard pattern. Use the `paginated` helper if it exists.

**Acceptance criteria:**
- [ ] Response parsing matches the standard admin-hook pattern
- [ ] No `any` types in the parsing
- [ ] Integration test covers the happy path

---

### PR-14 — Coupons/Offer search filter the dataset, not the page

**Audit:** admin-shifts-scoring-messaging-offers P1-1
**Severity:** P1 (UX confusion)
**Effort:** 1 hour
**Risk:** Low

**Files:**
- `web/src/components/admin/screens/offers/useOffers.ts`
- `web/src/app/api/admin/coupons/route.ts` (add server-side `search` query param)
- `web/src/app/api/admin/offers/route.ts` (add server-side `search` query param)

**Current state:** The search bar filters the loaded page only. Searching "Payment" in a 50-row page with 1 "Payment" entry shows 1 result even if there are 5 more on other pages.

**Fix:** Add `search` as a server-side query param, pass it to the route, and filter at the SQL level (Prisma `contains` on the relevant fields).

**Acceptance criteria:**
- [ ] Search is server-side
- [ ] Empty results show "No results"
- [ ] Search persists across pagination (the search is on the dataset, not the page)

---

### PR-15 — Bulk messaging N+1 hub fetches → single batched query

**Audit:** admin-shifts-scoring-messaging-offers P1-2
**Severity:** P1 (perf)
**Effort:** 1 hour
**Risk:** Low

**Files:**
- `web/src/components/admin/screens/bulk-messaging/useBulkMessaging.ts`

**Current state:** The "audience count" preview fetches hubs one at a time in an N+1 loop.

**Fix:** Use `Promise.all` to fetch all hubs in parallel, or a single batched endpoint that returns the counts for all hubs.

**Acceptance criteria:**
- [ ] No N+1 loop
- [ ] The audience count preview loads in O(1) round-trips
- [ ] Per-hub counts are still accurate

---

### PR-16 — Scoring breakdown dialog — fix the 2 zeroed sub-scores

**Audit:** admin-shifts-scoring-messaging-offers P1-4
**Severity:** P1 (UX misleading data)
**Effort:** 1 hour
**Risk:** Low

**Files:**
- `web/src/components/admin/screens/rider-scoring/ScoringBreakdownDialog.tsx`

**Current state:** The breakdown always shows 2 of 5 sub-scores as 0% — the "wallet" and "plan" sub-scores. The math is wrong.

**Fix:** Audit the score-calculator formula and the breakdown display. Identify why 2 sub-scores are always 0. Likely a missing field in the rider state passed to the calculator.

**Acceptance criteria:**
- [ ] All 5 sub-scores show non-zero values for a normal rider
- [ ] The breakdown accurately reflects the rider's risk profile
- [ ] Unit test for the score calculator

---

### PR-17 — Update KYC review screen to use 1 round trip

**Audit:** admin-rider-management P0-3
**Severity:** P0 (race condition between table and detail dialog)
**Effort:** 1 hour
**Risk:** Low

**Files:**
- `web/src/components/admin/screens/kyc-management/useKyc.ts:38-44`

**Current state:** The KYC review table loads from `/api/admin/riders?kycStatus=...` and the detail sheet calls `/api/admin/kyc`. Two endpoints, two cache keys, race condition.

**Fix:** Have the KYC review table call `/api/admin/kyc` directly (the purpose-built endpoint). The kyc endpoint already returns the KYC data the review needs.

**Acceptance criteria:**
- [ ] Single round trip per page load
- [ ] No race condition between table and detail
- [ ] Cache invalidation is consistent (one key to invalidate)
- [ ] Integration test covers the happy path

---

### PR-18 — Document `exists` is intentional (GDPR)

**Audit:** flutter-api-auth-flow P0-2 (N/A)
**Severity:** P0-2 is N/A; this is a docs-only fix
**Effort:** 30 min
**Risk:** Low

**Files:**
- `web/src/contracts/auth.contract.ts`

**Current state:** The `exists` field was intentionally removed for GDPR (PR-52). The audit flagged it as a bug; it's a privacy improvement. The contract file should be updated to reflect this.

**Fix:**

```typescript
// web/src/contracts/auth.contract.ts
/**
 * PR-52 (GDPR): The `exists` field was intentionally removed from
 * `SendOtpResponse` to prevent account enumeration. Account existence
 * is now determined AFTER OTP verification via the `isNewRider` field
 * in `VerifyOtpResponse`.
 */
export interface SendOtpResponse {
  otp?: string;
}
```

**Acceptance criteria:**
- [ ] Contract file has a PR-52 comment explaining the GDPR change
- [ ] The `exists` field is not in the response

---

### PR-19 — Increase `MAX_OUTBOX_PAYLOAD_BYTES` to 1MB

**Audit:** event-bus-catalogue P1-4
**Severity:** P1 (unblocks batch operations)
**Effort:** 15 min
**Risk:** Low

**Files:**
- `web/src/server/workers/outbox.ts:150`

**Current state:** `MAX_OUTBOX_PAYLOAD_BYTES = 64 * 1024` (64KB). A 10K rider announcement exceeds this.

**Fix:** Change to `1024 * 1024` (1MB). Postgres `jsonb` handles this easily.

**Acceptance criteria:**
- [ ] Constant is 1MB
- [ ] Integration test: emit a 100KB payload succeeds

---

### PR-20 — `subscribePlanSchema` adds `hubId`/`securityDeposit`/`advanceRentPaid`

**Audit:** flutter-rental-lifecycle-flow P1-1
**Severity:** P1 (contract drift)
**Effort:** 1 hour
**Risk:** Low

**Files:**
- `web/src/lib/validators.ts:358-362`
- Regenerate Flutter client

**Current state:** The Flutter `subscribePlan` sends `hubId`/`securityDeposit`/`advanceRentPaid` but the server's `subscribePlanSchema` only allows `planId`. The server is lenient (Zod non-strict), but this is a footgun.

**Fix:**

```typescript
export const subscribePlanSchema = z.object({
  planId: z.string().min(1),
  hubId: z.string().min(1).optional(),
  securityDeposit: z.number().int().min(0).optional(),
  advanceRentPaid: z.boolean().optional(),
});
```

Regenerate the Flutter client so the `SubscribePlanRequest` model includes these fields.

**Acceptance criteria:**
- [ ] Server schema accepts the 3 new fields
- [ ] Flutter client sends them
- [ ] Integration test: subscribe with all 4 fields succeeds

---

### PR-21 — Remove `auth.routes.ts` parallel implementation

**Audit:** flutter-api-auth-flow P0-3
**Severity:** P1 (dead code)
**Effort:** 15 min
**Risk:** Low

**Files:**
- `web/src/server/modules/auth/auth.routes.ts` (delete; 48 lines)

**Current state:** A parallel, dead implementation of the auth routes. The live routes are at `web/src/app/api/auth/*`. The dead `auth.routes.ts` is never imported.

**Fix:** Delete the file. Verify nothing imports it.

**Acceptance criteria:**
- [ ] File deleted
- [ ] No compile errors
- [ ] All auth tests still pass

---

### PR-22 — Remove 8 deprecated outbox events

**Audit:** event-bus-catalogue P1-1
**Severity:** P1 (cleanup)
**Effort:** 1 hour
**Risk:** Low (deprecated, no consumers/producers)

**Files:**
- `web/src/server/workers/outbox.ts:35-126`

**Current state:** 8 events are marked `@deprecated` but still in the enum. The audit listed them: `WALLET_TOPUP_REQUESTED`, `DEPOSIT_APPROVED`, `DEPOSIT_REJECTED`, `DEPOSIT_REFUNDED`, `ANNOUNCEMENT_DISPATCH`, `REFERRAL_SIGNUP`, `RENT_DUE`, `AUDIT_LOG_CLEANUP`, `TELEMETRY_DATA_CLEANUP`.

**Fix:**

1. Remove the 9 enum entries.
2. Verify no producers or consumers reference them (the audit already verified this).

**Acceptance criteria:**
- [ ] 9 enum entries removed
- [ ] No compile errors
- [ ] No tests reference the removed events

---

### PR-23 — Delete `rental.schemas.ts` and `endRentalSchema`

**Audit:** flutter-rental-lifecycle-flow P1-2
**Severity:** P1 (dead code)
**Effort:** 15 min
**Risk:** Low

**Files:**
- `web/src/server/modules/rentals/rental.schemas.ts` (delete)

**Current state:** A 24-line file with a `endRentalSchema` that's never imported. The live route has its own inline `returnSchema`.

**Fix:** Delete the file.

**Acceptance criteria:**
- [ ] File deleted
- [ ] No compile errors
- [ ] No tests reference the removed schema

---

### PR-24 — Add `validateAdmin` middleware to admin endpoints

**Audit:** Cross-cutting (not in any specific audit, but related to P1-1 admin-rider-management and others)
**Severity:** P1 (defense in depth)
**Effort:** 2 hours
**Risk:** Low

**Files:**
- `web/src/lib/rbac.ts` (add helper)
- All `/api/admin/*` routes (apply)

**Current state:** Admin endpoints use `requireAdmin()` for auth, but permission gates are sometimes missing or inconsistent. The audit-log pattern is best-effort (`.catch(() => {})`).

**Fix:** Add a `validateAdmin(permission?)` helper that:
1. Calls `requireAdmin()`.
2. If `permission` is provided, calls `hasPermission()`.
3. Returns 401/403 with structured error codes.

Apply to all `/api/admin/*` routes that don't already have it. Defense in depth.

**Acceptance criteria:**
- [ ] Helper is defined in `web/src/lib/rbac.ts`
- [ ] All `/api/admin/*` routes use the helper
- [ ] 401/403 responses include structured error codes
- [ ] No regression in existing tests

---

## 4. Execution order

The PRs are sized to ship in a single day each, with the critical Phase 1 PRs at the start.

| Day | PRs | Reviewer focus |
|---|---|---|
| **Day 1 morning (Phase 1: critical P0s)** | PR-1, PR-3, PR-4, PR-5 | Security/ops blockers. PR-3 is the highest impact. |
| **Day 1 afternoon** | PR-2, PR-6 | Notification type mapping, state machine consistency. |
| **Day 2 morning (Phase 2: P0 important)** | PR-7, PR-8, PR-9 | Event bus cleanup. 15-min PRs. |
| **Day 2 afternoon** | PR-10, PR-11, PR-12 | Flutter end-rental fixes. The most user-facing work. |
| **Day 3 (Phase 3: P1 impactful)** | PR-13, PR-14, PR-15 | Admin UI consistency. |
| **Day 4** | PR-16, PR-17, PR-18, PR-19, PR-20 | Mix of small + medium. |
| **Day 5 (Phase 4: P1 housekeeping)** | PR-21, PR-22, PR-23, PR-24 | Mechanical cleanup. |

**Total wall time: 5 days, 1 reviewer. Total reviewer time: ~22 hours.**

**Recommended day 1 sequence (the highest-priority work):**
1. **PR-1** (audit log) — 30 min
2. **PR-3** (admin reply) — 1 hour ← unblocks a core ops workflow
3. **PR-4 + PR-5** (incident assignment + server validation) — 1.5 hours ← closes a fraud vector
4. **PR-12** (Flutter end-rental stranded success) — 1 hour ← user-facing
5. **PR-10** (Flutter end-rental contract) — 1 hour ← user-facing

That day alone closes 3 P0s and 1 P0 partial.

---

## 5. Documentation deliverables

After all PRs are merged, ship one docs commit that:

1. **Reclassifies** the 16 items that are now fixed in `docs/AUDIT_INDEX_2026-08-03.md`. For each, add a reclassification entry with a `## ✅ Fixed in <date> (PR-<n>)` heading and link to the PR.
2. **Updates** the 7 audit files to mark the now-fixed P0s with `✅ Fixed in <PR>` inline notes.
3. **Appends BACKLOG-1 to BACKLOG-5** to `docs/FOLLOWUP_TICKETS.md`.
4. **Adds this report** to `docs/plans/2026-08-06-fix-plan-7-mixed-audits.md` (this file).
5. **Updates** `docs/plans/2026-08-06-reverification-7-mixed-audits.md` (the re-verification report) to reference this fix plan.

---

## 6. Out-of-scope reminders

These items are real but **deliberately excluded** from this plan because they need a different conversation:

1. **Flutter integration test coverage** (e.g., end-rental happy path) — needs ~1-2 weeks of dedicated QA work. The integration test files exist but are minimal.
2. **Auth state machine refactor** — touches the router state machine, 1-2 day work.
3. **Permissions UX refactor** — needs UX design (which permissions to show where).
4. **All 29 P1 items from the 7 audits** (UX/test/code quality) — ~20 hours.
5. **Dead enum + dead code cleanup across all 7 audits** — mechanical but the team needs to decide which enums to keep for backward compat.
6. **Payment-gateway credentials encryption** (admin-finance P0-4 from earlier audit) — 1-2 days, needs security review.
7. **Reward.points / Coupon.discountValue unit semantics** (admin-marketing P0-4/5 from earlier audit) — product decision.

---

## 7. Test gates (must pass before merge)

```bash
# Web backend
npm test -- --run tests/unit                                       # 2201+ pass expected
npm run test:integration                                           # 23 files, all green
npm run test:api                                                   # 541+ lines, all green
npm run typecheck                                                  # 0 errors
npm run lint                                                       # 0 errors

# Flutter
flutter test                                                       # all unit + widget, all green
flutter test integration_test/ --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true  # 33/33 e2e
flutter analyze                                                    # 0 errors
```

**Per-PR gates:**
- Every PR that adds a new endpoint must add an integration test that covers the happy path + at least one failure path.
- Every PR that modifies a use case must add a unit test for the new behavior.
- Every PR that adds a new Flutter widget must add a widget test.

---

## 8. What "done" looks like

- All 24 PRs in Phases 1-4 are merged.
- BACKLOG-1 to BACKLOG-5 are in `docs/FOLLOWUP_TICKETS.md`.
- `docs/AUDIT_INDEX_2026-08-03.md` is updated with reclassification entries.
- This plan is at `docs/plans/2026-08-06-fix-plan-7-mixed-audits.md`.
- All test gates pass.
- Coverage ratchet: still 85%+ lines, no regression.

**Cumulative status after this plan:**
- Admin Rider Management: 2 → 9 fixed, 1 partial
- Admin Shifts/Scoring/Messaging/Offers: 3 → 9 fixed, 1 partial
- Admin Support/Incidents/Fines: 2 → 6 fixed
- Event Bus Catalogue: 4 → 11 fixed, 1 partial
- Flutter Auth Flow: 2 → 5 fixed
- Flutter Rental Lifecycle: 1 → 6 fixed, 1 partial
- Flutter Support/Notifications: 2 → 7 fixed
- **Total: 16 → 53 fixed across 7 audits.**
- **Still true (after this plan): 11 items, mostly low-priority P1s and code-quality issues.**

---

## 9. Open questions for the team

Before executing this plan, the team should confirm:

1. **PR-3 admin reply feature** — does the team want this built now, or is it already replaced by some other workflow (e.g., Slack)?
2. **PR-4 incident assignment** — is the `useIncidents` hook the right place to fetch the admin list, or should we use a server-side render?
3. **PR-6 OPEN vs REPORTED** — confirm `REPORTED` is the right canonical name (some teams prefer `OPEN`).
4. **PR-19 MAX_OUTBOX_PAYLOAD_BYTES** — is 1MB enough, or do we need the split-into-sub-events pattern?
5. **PR-22 deprecated events** — is now the right time to remove them, or should we wait for v0.4?
6. **PR-24 validateAdmin middleware** — is this a 2-hour task, or do we need a bigger refactor of the auth middleware?

If any of these are blockers, the corresponding PRs can be deferred to BACKLOG.

---

## 10. Appendix — Cross-audit integration

This plan integrates with the prior fix plans:

- **`docs/plans/2026-08-06-fix-plan-8-audits-v2.md`** (8 audits re-verified) — covers 23 PRs for rider/dashboard/legal/wallet/rewards/analytics/finance. Some PRs overlap with this plan (e.g., PR-16 for rent reminder timezone was a separate plan).
- **`docs/plans/2026-08-06-fix-plan-9-admin-audits.md`** (9 admin audits re-verified) — covers 23 PRs for admin config, data mgt, finance, fleet, KYC, marketing.
- **`docs/plans/2026-08-06-reverification-9-flutter-audits.md`** (9 Flutter audits re-verified) — covers 15 PRs for Flutter wallet, dark mode, dashboard, emergency, login, onboarding, pickup, rental, support.

Together, the 4 plans cover **85+ PRs** for the ~120 P0s across all 33 audits. The team's audit-fix velocity is strong; the bottleneck now is integration test coverage and dead-code cleanup.
