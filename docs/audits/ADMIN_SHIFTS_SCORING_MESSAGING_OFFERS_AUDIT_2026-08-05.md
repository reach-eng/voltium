# Admin Shifts + Rider Scoring + Messaging + Offers & Coupons — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:**
- **Shifts** — `web/src/components/admin/screens/shifts/` (7 files, ~10 KB) + `web/src/app/api/admin/shifts/route.ts` + `web/src/server/modules/shifts/shift.use-cases.ts` + the rider-facing `web/src/app/api/shifts/route.ts`
- **Rider Scoring** — `web/src/components/admin/screens/rider-scoring/` (7 files, ~11 KB) + `web/src/app/api/admin/scores/{route.ts, recalculate/route.ts}` + `web/src/server/modules/scores/score.use-cases.ts` + `web/src/lib/score-calculator.ts` + `web/prisma/schema.prisma` (RiderScore)
- **Messaging (announcements + notifications)** — `web/src/components/admin/screens/bulk-messaging/` (9 files, ~12 KB) + `web/src/components/admin/screens/notifications/` (7 files, ~7 KB) + `web/src/app/api/admin/announcements/route.ts` + `web/src/app/api/admin/notifications/route.ts` + `web/src/server/modules/announcements/announcement.use-cases.ts` + `web/src/server/modules/notifications/{notification.use-cases.ts, notification.repository.ts, notification.routes.ts, notification.policy.ts}` + `web/src/lib/{notification-service.ts, fcm.ts}` + `web/src/app/api/cron/notifications/route.ts`
- **Offers & Coupons** — `web/src/components/admin/screens/offers/` (5 files, ~12 KB) + `web/src/components/admin/screens/OfferManagement.tsx` + `web/src/app/api/admin/offers/route.ts` + `web/src/app/api/admin/coupons/route.ts` + `web/src/server/modules/offers/offer.use-cases.ts` + `web/src/server/modules/coupons/coupon.use-cases.ts` + `web/prisma/schema.prisma` (Offer, Coupon, DiscountType)
- 6 existing test files in `web/tests/integration/admin/` (`scores.test.ts`, `admin_scores_recalculate.test.ts`, `coupons.test.ts`, `offers.test.ts`, and 2 auth/permissions tests)

**Out of scope:** Rider-app shift picker, support notifications, the `rewards` module (covered in a follow-up audit), KYC notifications (the KYC module calls `notificationService.notifyKycStatusChange` — see P0-4).

---

## TL;DR

**Of the four sections, two are quietly broken and one is silently misleading.** The "Recalculate All" button on the Rider Scoring page is a no-op for up to 15 minutes after each rider's last calculation (the cache window). The "Schedule for later" feature on bulk messaging has no processor — the announcement stays in `SCHEDULED` status forever, never sent. The Coupons admin table renders `undefined%` / `₹undefined` for every row because the API returns `discountValueInPaise` but the TypeScript `Coupon` interface declares `discountValue`. The admin "Send Notification" dialog also drops FCM push for all admin-initiated notifications — the rows land in the DB but the rider's device never gets a sound.

There are **4 P0s (must fix before next release)** and the fixes are mostly small. The biggest surprise is that the codebase has a centralized `notificationService.notify*` for business events (KYC, support, payment, rewards, shifts) but **most of those methods are wired with type strings that are not in the Prisma `NotificationType` enum** — at runtime every call throws and gets caught silently. The system has been "working" in the sense that no exception bubbles up to the caller, but the riders have not been receiving push notifications for the most important business events for an unknown period of time.

The rest of the sections (Shifts, Offers, the visible-by-design rider-facing flows) are clean. There are real P1 UX issues — the Scoring breakdown dialog always shows 2 of 5 sub-scores as 0%, the Bulk Messaging audience count fetches N+1 round-trips for hubs, the Coupon search filters the loaded page instead of the dataset, the offer "tab count" shows the loaded page size instead of the total — but no data loss.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Security hole, broken feature, silent data corruption, riders missing notifications | Before next release |
| **P1** | UX friction, accessibility, performance, misleading data | Next 2 sprints |
| **P2** | Code quality, naming, dead code, console warnings | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: "Recalculate All" button is a no-op for up to 15 minutes — admin gets fake "success"

**Files:**
- `web/src/app/api/admin/scores/recalculate/route.ts` line 13: `await scoreUseCases.recalculateAll(session.adminId || '')`
- `web/src/server/modules/scores/score.use-cases.ts` lines 91–122: `recalculateAll` loops over all riders calling `calculateRiderScore(rider.id)` (no `forceRecalculate` argument)
- `web/src/lib/score-calculator.ts` lines 5–11: `calculateRiderScore` checks `SCORE_CACHE_TTL_MS = 15 * 60 * 1000` and returns the existing record without re-computing

**What:** The score calculator has a 15-minute read-through cache: if a rider's `lastCalculated` is within 15 minutes, the function returns the existing record **without re-running the four sub-score formulas**. The `recalculate` use case never passes `forceRecalculate=true`, so the cache always wins. The result: the admin's "Recalculate All" button returns `successCount: <N>` and the admin UI shows a green "Scores recalculated" toast — but the scores in the database haven't changed.

```ts
// web/src/lib/score-calculator.ts:5-11
export async function calculateRiderScore(riderId: string, forceRecalculate = false) {
  if (!forceRecalculate) {
    const existing = await db.riderScore.findUnique({ where: { riderId } }).catch(() => null);
    if (existing && Date.now() - existing.lastCalculated.getTime() < SCORE_CACHE_TTL_MS) {
      return existing;  // <-- early return, no re-compute
    }
  }
  // ... real calculation
}
```

**Repro:**
1. Log in as admin → Rider Scoring page
2. Note the Composite Score for any rider
3. Change that rider's data (e.g. add a transaction, mark a KYC as APPROVED)
4. Click "Recalculate All" → green "Scores recalculated" toast
5. Refresh the page → score is **unchanged**
6. Wait 15+ minutes → click "Recalculate All" → score is now updated

The single-rider `POST /api/admin/scores` endpoint (which takes a `riderId` in the body) has the **exact same bug** — the cache suppresses every re-compute for the next 15 minutes. And that endpoint is also dead-code-ish — the admin UI only exposes the "Recalculate All" button, never a per-rider recalc. So the per-rider endpoint serves no UI but inherits the same cache bug for any direct caller (cron, future API consumer).

**Impact:** This is the admin's primary lever to refresh stale risk scores. The team is currently operating on scores that are at minimum 15 minutes stale — and the UI does not indicate that. After a security event (e.g. a rider is suspended, a fine is issued, a payment fails) the risk score that the admin sees for that rider will not reflect the change for up to 15 minutes. Worse: a real security escalation where an admin immediately recalculates expects the score to reflect the new data **and it silently does not**.

**Fix:**
1. In `score.use-cases.ts` `recalculateAll`, pass `true` for `forceRecalculate`: `await calculateRiderScore(rider.id, true)`.
2. Same in `recalculate(riderId, actorId)`: `await calculateRiderScore(riderId, true)`.
3. Consider also bumping the cache TTL or adding a manual "bypass cache" header for admin routes (since the cache exists to avoid recomputing on every page load — it should not apply to an explicit user-initiated recalc).

**Effort:** ~10 minutes. One-line change per use case.

---

### P0-2: Scheduled announcements are never sent — "Schedule for later" creates a record and forgets it

**Files:**
- `web/src/server/modules/announcements/announcement.use-cases.ts` line 89: `const status = data.scheduledAt ? 'SCHEDULED' : 'SENT'`
- `web/src/app/api/cron/` directory contains only `notifications`, `reconciliation`, `cleanup-telemetry` — **no announcement processor exists**
- `web/src/components/admin/screens/bulk-messaging/CreateAnnouncementDialog.tsx` lines 195–213: the "Schedule for later" switch + datetime input

**What:** The Create Announcement dialog lets the admin toggle "Schedule for later" and pick a future datetime. The backend correctly writes a row with `status: 'SCHEDULED'` and `scheduledAt: <future>`. **No cron job or scheduler ever queries `WHERE status = 'SCHEDULED' AND scheduledAt <= now()` to send them.** A `grep -r "processScheduledAnnouncements\|processAnnouncements\|SCHEDULED"` across the codebase returns zero matches outside the `create` use case and the display dialog.

Compare to the sibling `web/src/app/api/cron/notifications/route.ts` — it exists, it calls `notificationUseCases.processScheduledNotifications()`, and it handles birthday wishes / payment reminders / referral leaderboard. The announcement module has no equivalent.

**Repro:**
1. Log in as admin → Bulk Messaging → Create Announcement
2. Toggle "Schedule for later" → set scheduled date to 5 minutes from now
3. Click "Schedule"
4. The announcement is saved with status `SCHEDULED`
5. Wait 1 hour
6. Open the announcement detail → status is still `SCHEDULED`, `sentAt` is `null`, no notifications exist for any rider
7. No riders received the message

**Impact:** Every scheduled announcement is silently dropped. If the operations team uses this to pre-stage a release-day push, a maintenance window warning, a regulatory notice, or any compliance-grade communication, the message never reaches riders. From a rider's perspective: zero. From an admin's perspective: the announcement appears in the list with status `SCHEDULED` forever. The admin doesn't know it's broken.

**Fix:**
1. Add a `processScheduledAnnouncements` use case to `announcement.use-cases.ts`:
   - `findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } } })`
   - For each: resolve the recipient set, call the same delivery logic as `create`'s `if (recipients.length > 0 && !data.scheduledAt)` branch, update `status: 'SENT'`, set `sentAt: new Date()`.
2. Add a `web/src/app/api/cron/announcements/route.ts` that wires the use case (mirror `cron/notifications/route.ts`).
3. Wire it into the existing cron schedule (wherever `cron/notifications` is scheduled from — Vercel cron config, an external scheduler, etc.).
4. Add an integration test that creates a SCHEDULED announcement, advances time / directly invokes the cron, asserts the deliveries are created and the status flips to SENT.

**Effort:** ~2 hours. The delivery logic already exists in `create` — it just needs to be extracted into a helper and re-invoked.

---

### P0-3: Coupons admin UI renders `undefined` for every row — `discountValue` vs `discountValueInPaise` field-name mismatch

**Files:**
- `web/prisma/schema.prisma` line 703: `discountValueInPaise Int`
- `web/src/server/modules/coupons/coupon.use-cases.ts` line 7–12: `list` returns `db.coupon.findMany(...)` directly — no transform
- `web/src/components/admin/screens/offers/types.ts` line 17: `discountValue: number;` (the TypeScript interface)
- `web/src/components/admin/screens/offers/OfferGrid.tsx` line 242–245: `c.discountType === 'PERCENTAGE' ? \`${c.discountValue}%\` : \`₹${c.discountValue}\``
- `web/src/server/modules/coupons/coupon.use-cases.ts` line 33: `discountValueInPaise: data.discountValue` (the create path stores the value under the paise column)

**What:** The Prisma column is `discountValueInPaise` (integer paise — i.e. ₹100 = `10000`). The admin API serialises the raw Prisma record, so the response contains `discountValueInPaise`. The TypeScript `Coupon` interface declares `discountValue: number`. The admin UI accesses `c.discountValue` — which is `undefined` at runtime. **Every coupon row in the table renders `undefined%` or `₹undefined`.** The "Uses" column renders `undefined / undefined`. The "Min Amount" column also reads `c.minAmount` which happens to be the actual DB field name, but it too is in paise so the display shows paise as rupees.

```ts
// OfferGrid.tsx:240-251
<TableCell>
  <Badge variant="secondary">
    {c.discountType === 'PERCENTAGE'
      ? `${c.discountValue}%`        // undefined
      : `₹${c.discountValue}`}        // ₹undefined
  </Badge>
</TableCell>
<TableCell>{c.minAmount ? `₹${c.minAmount}` : '—'}</TableCell>  // paise shown as ₹
<TableCell>
  {c.currentUses}                    // works
  {c.maxUses ? ` / ${c.maxUses}` : ''}
</TableCell>
```

There is also a second-order issue from the same root cause. The create path does:

```ts
// coupon.use-cases.ts:32-33
discountType: data.discountType as 'PERCENTAGE' | 'FIXED',
discountValueInPaise: data.discountValue,  // <-- treated as paise
```

The admin enters `100` in the dialog (placeholders: `"20"` for percentage, `"100"` for fixed). The label is "Discount Value" with no unit hint, and the table displays `₹100`. So the admin thinks they created a "₹100 off" coupon. **The DB stores 100 paise = ₹1.00.** When the rider later redeems it, the system computes a ₹1 discount — 100× less than intended. The display in the table confirms the wrong amount (`₹100` — but it's actually 100 paise being formatted with a rupee sign).

**Repro:**
1. Log in as admin → Offers & Coupons → Coupons tab
2. Open any existing coupon (or create one)
3. The Discount column shows `undefined%` or `₹undefined`
4. The Min Amount column shows `undefined`
5. The Uses column shows `undefined / undefined`
6. Create a new FIXED coupon: code `TESTBUG`, Discount Value `100`, save
7. The table shows `₹100` for the new coupon
8. Check the DB: `discountValueInPaise = 100` (= ₹1.00), `minAmount` is also stored as paise but shown as ₹100

**Impact:**
1. **All existing coupons show broken display.** Every row is partly `undefined`. Operations cannot read the discount value, the min amount, or the use count from the admin UI without going to the DB directly.
2. **All FIXED coupons ever created have a 100× lower discount than the admin intended.** This is a **silent data corruption** that has likely been ongoing since the Coupons module shipped. A "₹500 off" coupon actually gives ₹5 off. A "₹50 off" coupon gives ₹0.50.
3. The percentage case (`PERCENTAGE`) accidentally works because the value is unit-less — 20 means 20%. But the *display* still says `undefined%` because of the field-name mismatch.

This is the **second decimal-units bug in the admin panel** (the finance audit found the inverse: finance stored rupees in a paise column). Here the bug is the same root cause: a field named with a unit suffix (InPaise) but the rest of the admin panel treats the value as if it were in rupees.

**Fix:**
1. **Server-side transform** in `couponUseCases.list` (and `get` if it exists): map the Prisma record to the API shape:
   ```ts
   {
     ...coupon,
     discountValue: coupon.discountValueInPaise,  // OR divide by 100
     minAmount: coupon.minAmount,                 // OR divide by 100
   }
   ```
   Decide on one unit for the API contract and document it. Recommendation: keep paise internally, expose rupee-decimals (e.g. divide by 100) at the API boundary so the frontend stays simple.
2. **Client-side fix** in `OfferGrid.tsx`: use `c.discountValueInPaise` (after step 1) or — preferred — `c.discountValue` after the transform. Same for `c.minAmount`.
3. **Write a one-off backfill / correction script** to identify and fix existing coupons whose `discountValueInPaise` was stored as if it were rupees. **Audit log this — it's a data correction.** A safety check: only auto-correct if the original intent can be reliably inferred (e.g. 100 paise is almost certainly intended as ₹100, not ₹1).
4. Add a test that asserts the API response shape and that a created `100` (intended as ₹100) round-trips to `10000` paise.
5. **Paise display consistency**: the OfferGrid shows `₹${value}` — if value is paise, this is wrong. Either divide by 100 in the display, or expose rupees from the API.

**Effort:** ~1 hour for the code fix + ~2 hours for the data correction script + tests. **Add to the data-migration backlog immediately so it gets attention before the next release.**

---

### P0-4: Admin "Send Notification" / business-event notifications never reach the rider's device

**Files:**
- `web/src/app/api/admin/notifications/route.ts` lines 51–81: the admin `POST` calls `notificationUseCases.sendToSingleRider` / `sendToAllRiders` / `sendToSpecificRiders`
- `web/src/server/modules/notifications/notification.use-cases.ts` lines 106–191: these three methods write to the `Notification` table directly via `db.notification.create` / `createMany` — **they never call `notificationService.createAndSend`**
- `web/src/lib/notification-service.ts` lines 13–47: the centralised `createAndSend` is the only path that calls `fcmService.sendPushNotification`
- `web/src/lib/notification-service.ts` lines 49–123: business event helpers (`notifyKycStatusChange`, `notifySupportReply`, `notifyPaymentReminder`, `notifyRewardMilestone`, `notifyBirthdayWish`, `notifyShiftReminder`) all pass a **custom `type` string** to `createAndSend`
- `web/prisma/schema.prisma` lines 1447–1458: `enum NotificationType { INFO, ALERT, PROMOTION, PAYMENT, VEHICLE, SOS, SYSTEM, BIRTHDAY_WISH }` — no `KYC_UPDATE`, `SUPPORT_REPLY`, `PAYMENT_DUE`, `REWARD`, or `SHIFT_REMINDER`
- `web/src/components/admin/screens/notifications/SendNotificationDialog.tsx` lines 120–131: the admin dialog's type `<Select>` uses **lowercase** values (`system`, `payment`, `vehicle`, `alert`)
- `web/src/lib/validators.ts` line 230: `sendNotificationSchema` z.enum is **UPPERCASE** (`['INFO', 'ALERT', 'PROMOTION', 'PAYMENT', 'VEHICLE']`)

**What:** This is two bugs that compound:

**Bug A — admin Send Notification dialog sends the wrong case for `type` (validation rejection):**
The dialog's type selector has options `system`, `payment`, `vehicle`, `alert` (lowercase). The `sendNotificationSchema` z.enum is `['INFO', 'ALERT', 'PROMOTION', 'PAYMENT', 'VEHICLE']` (uppercase). The dialog sends the raw lowercase value, the validator rejects it with a 422, the admin sees "Failed with status 422" or "validation failed" and **the notification is never sent at all**. So even the in-DB record creation never happens — the admin's intended message vanishes.

**Bug B — even if Bug A is fixed, the admin route bypasses FCM push entirely:**
The admin route (`/api/admin/notifications` POST) calls `notificationUseCases.sendToSingleRider` etc., which call `db.notification.create` / `createMany` directly. These do **not** call `notificationService.createAndSend` — the only path that sends an FCM push. The rider therefore sees the notification only **if and when they next open the app** and call `GET /api/notifications` (which is the rider's own list endpoint, in the rider-app API). With a cold app, a closed app, or a rider who hasn't opened the app in a day, the admin's message arrives silently hours later (or never, if the rider's app cache is evicted).

Compare to the rider-route `POST_send` in `web/src/server/modules/notifications/notification.routes.ts` lines 25–51 — that path **also** goes directly to `db.notification.create` for individual riders, so the same gap exists for some rider-initiated flows, but the **admin Send Notification** is the most user-visible regression.

**Bug C — `notificationService.notify*` business helpers pass type strings that are NOT in the Prisma enum (silent throw):**
The centralised service has:

```ts
// lib/notification-service.ts
async notifyKycStatusChange(riderId, status, reason) {
  return this.createAndSend(riderId, title, message, 'KYC_UPDATE', { ... });
}
async notifySupportReply(riderId, ticketId, subject) {
  return this.createAndSend(riderId, title, message, 'SUPPORT_REPLY', { ... });
}
async notifyPaymentReminder(riderId, amount, dueDate) {
  return this.createAndSend(riderId, title, message, 'PAYMENT_DUE', { ... });
}
async notifyRewardMilestone(riderId, points, title) {
  return this.createAndSend(riderId, title, message, 'REWARD', { ... });
}
async notifyShiftReminder(riderId, startTime) {
  return this.createAndSend(riderId, title, message, 'SHIFT_REMINDER');
}
```

None of `KYC_UPDATE`, `SUPPORT_REPLY`, `PAYMENT_DUE`, `REWARD`, `SHIFT_REMINDER` are in the Prisma `NotificationType` enum. The `createAndSend` does:

```ts
db.notification.create({
  data: { ..., type: type as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM' },
}),
```

The `as` is a TypeScript cast, not a runtime check. At runtime, Prisma's enum validation throws `PrismaClientValidationError`. The error is caught one level up in `createAndSend`:

```ts
} catch (error) {
  logger.error('[NotificationService] Error:', error);
  return { success: false, error };
}
```

So:
- No DB record is created
- No FCM push is sent
- The error is logged but swallowed
- The calling code (KYC change handler, support reply handler, etc.) sees `success: false` and either retries, logs, or proceeds silently

**This means every business-event notification for the last N releases has been failing silently.** Riders have not been receiving KYC status change notifications, support reply notifications, payment due reminders, reward milestone alerts, or shift reminders. The "KYC Update Required" / "Support Ticket Update" / "Payment Reminder" push notifications that the system advertises in the rider app's settings screen have never actually been delivered. (The `notifyBirthdayWish` call works because `BIRTHDAY_WISH` IS in the enum.)

**Repro for Bug A (admin dialog type-case):**
1. Log in as admin → Messaging → Notifications → Send Notification
2. Fill in title + message, pick a rider, set Type = "Payment"
3. Click Send
4. The POST goes through with `type: "payment"` (lowercase)
5. The zod validator returns 422 ("Invalid enum value...")
6. The toast shows "Failed to send notification"
7. No row in the DB, no FCM, the rider is unaware

**Repro for Bug C (silent enum throw):**
1. As any rider, complete KYC submission
2. An admin approves the KYC
3. The KYC use case calls `notificationService.notifyKycStatusChange(riderId, 'APPROVED')`
4. Inside `createAndSend`, `db.notification.create` throws `PrismaClientValidationError` because `'KYC_UPDATE'` is not in the enum
5. The error is logged as `[NotificationService] Error: ...`
6. The rider receives no push, no in-app banner, no notification record
7. Next time the rider opens the app, there is **no KYC approval notification** waiting for them — they have to find the KYC screen by tapping through the menu

**Impact:**
- **Bug A** breaks the admin's only way to send a one-off notification to a specific rider from the dashboard.
- **Bug B** breaks the admin's "send to all" and "send to specific" notifications in the same way — the rows land in the DB but no push is sent.
- **Bug C** is the silent killer. It breaks 5 of the 6 business-event notifications that the system advertises in the rider app. Riders have been getting KYC support / payment / reward / shift push notifications only because **other code paths** create those records separately (e.g. the rider's KYC status screen polls, the rider's support screen polls). The push channel — the channel that lets the rider know something happened when they are not actively using the app — has been dead.

This is the **highest-impact P0 in the audit.** It is silent, it is across multiple sections, and it affects every rider.

**Fix (in this order):**
1. **Bug A** — In `SendNotificationDialog.tsx` lines 126–131, change the type `<SelectItem>` values to uppercase (`INFO`, `PAYMENT`, `VEHICLE`, `ALERT`) to match the validator. Add a `value.toUpperCase()` defensively. (~10 min)
2. **Bug B** — In `notification.use-cases.ts` lines 106–191, change the three admin send methods to use `notificationService.createAndSend` for each rider (loop) instead of `db.notification.createMany`. Or, add a `sendToRiderBatch` helper on `notificationService` that does the FCM-and-DB in one call and call that. (~30 min)
3. **Bug C** — Add the missing values to the `NotificationType` enum: `KYC_UPDATE`, `SUPPORT_REPLY`, `PAYMENT_DUE`, `REWARD`, `SHIFT_REMINDER`, plus any other business strings you find via `grep -r "createAndSend(" web/src/lib/notification-service.ts`. After the enum migration, remove the misleading `as` cast in `createAndSend` so the next mismatch fails loudly at compile time. (~1 hour + migration)
4. **Add a test** that asserts: admin POST → a real push payload is sent (mock `fcmService.sendPushNotification` and verify the call). And a test for each business-event helper that asserts the enum value is accepted by Prisma. (~1 hour)

**Effort:** ~3–4 hours total, with the schema migration being the riskiest step (must be deployed atomically with the code change — otherwise the enum cast at the DB level will reject writes from a partially-deployed codebase).

---

## P1 — Next 2 sprints

### P1-1: Shifts route uses the wrong permission — non-SUPER_ADMIN can't manage shifts
**File:** `web/src/app/api/admin/shifts/route.ts` lines 33, 48, 64, 81 — all four handlers check `hasPermission(session.adminRole || '', 'settings_manage')`.

**What:** The Shifts admin screen is gated by `settings_manage` (the System Settings permission). There is no `shifts_manage` permission. The only role that has `settings_manage` by default is SUPER_ADMIN. An operations admin, team leader supervisor, or any other role cannot create, edit, toggle, or delete shifts even though the admin menu shows the Shifts tab to anyone with menu access (the menu uses `settings_manage` for the parent section too — `web/src/lib/role-config.ts` line 14).

**Repro:**
1. As an OPERATIONS_ADMIN, navigate to Shifts
2. Click "Add Shift" → 403 from the server, "Insufficient permissions for this action"
3. Same for Edit / Delete / Toggle

**Fix:** Add a `shifts_manage` permission to `web/src/lib/permissions.ts` and use it in the route + the menu entry. Default to OPERATIONS_ADMIN + SUPER_ADMIN.

**Effort:** ~20 min.

---

### P1-2: Scoring breakdown dialog always shows 2 of 5 sub-scores as 0% — misleading
**File:** `web/src/server/modules/scores/score.use-cases.ts` lines 49–68: the formatter maps `vehicleScore: 0, locationScore: 0` (hardcoded).

**What:** The `RiderScore` Prisma model has 4 sub-score columns: `paymentScore`, `kycScore`, `activityScore`, `supportScore`. The composite formula `payment*0.3 + kyc*0.25 + activity*0.25 + support*0.2` correctly sums to 1.0 across these 4 scores. The TypeScript `RiderScore` interface declares 5 sub-scores, including `vehicleScore` and `locationScore`. The Score Breakdown dialog renders all 5 as coloured progress bars. Two of them (vehicle + location) are always hardcoded to `0` in the formatter.

Result: every breakdown dialog shows two red `0` progress bars that visually dominate. An admin looking at a rider's breakdown sees "vehicleScore 0, locationScore 0" and reasonably concludes "this rider has bad vehicles and bad location" — when those sub-scores simply do not exist yet.

**Fix:** Either (a) implement the missing sub-score formulas in `score-calculator.ts`, or (b) remove `vehicleScore` and `locationScore` from the `RiderScore` interface and the dialog (and reduce the dialog to 4 progress bars).

**Effort:** ~2–3 hours for (a), ~30 min for (b). Recommend (a) — the rider-facing app would benefit from a real vehicle sub-score, and the dialog is already wired to display it.

---

### P1-3: Bulk Messaging recipient count does N+1 round-trips and "BY_PLAN" silently targets 0 riders
**File:** `web/src/components/admin/screens/bulk-messaging/useBulkMessaging.ts` lines 80–101 (`calculateRecipients`).

**What:** When the admin picks `BY_HUB` or `BY_STATUS` and selects N targets, the hook fires **N parallel** `GET /api/admin/riders?hubId=...&limit=1` requests to count the recipient set. The server returns 1 record but `pagination.total`, so the math is OK — but for 50 hubs this is 50 HTTP round-trips from the admin's browser, on a tab that the admin is likely to open often.

Additionally, **BY_PLAN** is wired in the dialog (`CreateAnnouncementDialog.tsx` line 174) and in the use case (`announcement.use-cases.ts` lines 82–86 — `recipients = await db.rider.findMany({ where: { currentPlan: { in: data.targetIds } } })`). But the dialog sends the plan names as a CSV (lines 177–181) and `calculateRecipients` does **not handle BY_PLAN** (it falls through to the early-return at line 89 because `targetIds.length` may be 0 right after the user pastes plans). So the recipient count for BY_PLAN is always **0** in the dialog. The admin sees "Estimated Recipients: 0" and either corrects by switching the audience or hits Send Anyway. The actual broadcast will fire because the use case reads `data.targetIds` directly, but the displayed estimate is wrong.

**Fix:**
1. Add a single `POST /api/admin/announcements/estimate` (or extend the create endpoint with a `dryRun: true` flag) that takes the targeting config and returns the recipient count. Replace the N+1 client loop with one call.
2. Add a `BY_PLAN` branch in `calculateRecipients`.

**Effort:** ~1 hour for the new endpoint, ~15 min for the plan branch.

---

### P1-4: Coupon search filters the loaded page, not the dataset
**File:** `web/src/components/admin/screens/offers/OfferGrid.tsx` lines 166–175 (the `CouponTable` `filteredCoupons`).
**File:** `web/src/app/api/admin/coupons/route.ts` lines 18–20 (`couponUseCases.list` accepts no `search` parameter).

**What:** The admin types in the Coupon search box. The hook (`useOffers.ts` line 39) exposes `debouncedCouponSearch` but **does not send it to the API**. The API returns paginated results, paginated 20 at a time. The `CouponTable` filters the loaded page client-side:

```ts
const filteredCoupons = coupons.filter(
  (c) => !debouncedCouponSearch ||
    c.code.toLocaleLowerCase('en').includes(debouncedCouponSearch.toLocaleLowerCase('en')) ||
    (c.description || '').toLocaleLowerCase('en').includes(debouncedCouponSearch.toLocaleLowerCase('en'))
);
```

If there are 200 coupons and the admin searches for `"WIN2026"`, the result is:
1. API returns page 1 of 200 unfiltered coupons (20 records)
2. Client filters those 20 — likely 0 matches
3. Table renders "No coupons match your search"
4. The actual matching coupon is on page 7

**Repro:**
1. As admin → Offers & Coupons → Coupons tab
2. Create 25 coupons, with one named "FESTIVE50"
3. Type "FESTIVE" in the search → "No coupons match" (because FESTIVE50 is on page 2)

**Fix:** Either (a) add `search` to the API and a `where` clause on `OR(code contains, description contains)` in the use case, or (b) load all coupons and filter client-side. (a) is correct for scale. Also: the empty-state row's copy is hard-coded for "no coupons at all" but re-used for "no matches" — fix the copy.

**Effort:** ~30 min.

---

### P1-5: Offer & Coupon tab counts show the loaded page size, not the total
**File:** `web/src/components/admin/screens/OfferManagement.tsx` lines 49–50: `<TabsTrigger value="offers">Offers ({offerState.offers.length})</TabsTrigger>` and the coupons counterpart.

**What:** The tab label is `Offers (N)` where `N = offers.length` of the loaded page. With pagination, this is up to 100. The admin sees `Offers (100)` and assumes there are 100 offers total. The pagination actually has more. This is a misleading UX — the count should be the total from the API's `pagination.total` field.

**Fix:** Switch to server-side counts: either include `pagination.total` on both the offers and coupons responses (the offers response already does — line 11 of `offer.use-cases.ts`), and have the hook surface it. Or render the count only when the user is on page 1 of an unfiltered list.

**Effort:** ~20 min.

---

### P1-6: Bulk Messaging — "Send Now" vs "Schedule" success message lies about a `SCHEDULED` state
**File:** `web/src/app/api/admin/announcements/route.ts` line 46: `return success(result, scheduledAt ? 'Announcement scheduled' : 'Announcement sent', 201);`

**What:** The response message says "Announcement scheduled" — but as P0-2 documents, the schedule is never honoured. The toast says "Announcement scheduled", the admin walks away confident, and the message is silently dropped. This is the same root cause as P0-2 but the symptom surfaces in the UI. Fixing P0-2 makes this go away, but if P0-2 is deferred the toast should at least warn "Note: scheduled announcements require the cron processor to be configured (see audit)".

**Fix:** Bundle with P0-2. Or, if the cron isn't ready for release, temporarily disable the "Schedule for later" toggle in the UI and show a "Coming soon" tooltip.

**Effort:** ~5 min (defensive) or 0 (once P0-2 lands).

---

### P1-7: Score recalculate-all on 10k+ riders will time out and lock the request
**File:** `web/src/server/modules/scores/score.use-cases.ts` lines 91–122: sequential `for` loop with no batching, no async concurrency, no progress reporting.

**What:** `recalculateAll` fetches all riders into memory, then iterates one by one calling `calculateRiderScore(rider.id)`. Each call is 4 sub-formulas + 1 upsert. For 1,000 riders at ~50 ms each, that's 50 seconds. For 10,000 riders, 8 minutes. The route is `POST /api/admin/scores/recalculate` (no async queue). The HTTP request will time out at the load balancer / Vercel / client (default browser timeout 60 s). When the request fails, the admin sees a generic error and **doesn't know how many riders were processed**.

**Fix:** Move the work to a background job. Add a `POST /api/admin/scores/recalculate` that enqueues a job and returns `{ jobId }`. The job runs in a worker process with progress + retry. The admin UI polls a `GET /api/admin/scores/recalculate/:jobId` for status. If you want a smaller change, at minimum process the loop in `Promise.all` chunks of 50, and return partial results in the response so the admin knows what was completed.

**Effort:** ~3 hours for the queue pattern (the codebase already has background jobs — see `web/src/components/admin/screens/background-jobs/`), ~30 min for the in-process chunking fallback.

---

### P1-8: Notification type filter dropdowns are inconsistent — UI uses lowercase, DB / validator uses UPPERCASE
**File:** `web/src/components/admin/screens/notifications/NotificationFiltersBar.tsx` lines 60–62: `<SelectItem value="system">`, `<SelectItem value="payment">`, `<SelectItem value="vehicle">`, `<SelectItem value="alert">`.
**File:** `web/src/components/admin/screens/notifications/NotificationsTable.tsx` line 89: `TYPE_COLORS[n.type] || TYPE_COLOR_FALLBACK` — works because `TYPE_COLORS` has both cases, but the lowercase one wins for admin-sent records.

**What:** Even ignoring the validation rejection in P0-4, the table's `TYPE_COLORS` map is a frankenmix:

```ts
export const TYPE_COLORS: Record<string, string> = {
  system: '...',
  payment: '...',
  vehicle: '...',
  alert: '...',
  INFO: '...',
  ALERT: '...',
  SOS: '...',
  PROMOTION: '...',
};
```

The lowercase entries are what the admin dialog sends (pre-P0-4-fix). The uppercase entries are what `notificationService` writes (when the enum is happy). The CRITICAL and BIRTHDAY_WISH values aren't in the map and fall through to the slate fallback. Vehicle is amber in lowercase but `VEHICLE` is in neither the dialog nor the canonical `VEHICLE` constant.

**Fix:** Standardise on one case (UPPERCASE, since that's the Prisma enum). Update the dialog values to UPPERCASE. Drop the lowercase entries from `TYPE_COLORS`. Add a `BIRTHDAY_WISH` entry (purple?).

**Effort:** ~15 min.

---

## P2 — Cleanup backlog

### P2-1: Shifts search is case-insensitive in the DB (`mode: 'insensitive'`) but the column is `String` — works only for Postgres
**File:** `web/src/server/modules/shifts/shift.use-cases.ts` line 113. The codebase uses Postgres per `agent-context`, so this is informational only.

### P2-2: `Offer` model has no `isActive` index — listing "active only" requires a full table scan for sponsored offers
**File:** `web/prisma/schema.prisma` lines 683–695. The `Offer.getActiveSponsored` use case (line 69) filters on `isActive: true, isSponsored: true, validUntil: { gte: now }` with no supporting index. For 10k offers this is fine; for 1M it's a problem.

### P2-3: Offers & Coupons route files have a duplicate `checkOfferPermission` helper
**File:** `web/src/app/api/admin/offers/route.ts` lines 12–14 defines `function checkOfferPermission(session) { return hasPermission(session.adminRole || '', 'offers_manage'); }` — a one-liner that should just be the inline call, and should live in `web/src/lib/rbac.ts` so the coupons route can use it too (the coupons route inlines the same check at every handler).

### P2-4: Bulk Messaging audience count depends on `data.targetIds` for `BY_HUB` but the dialog sends `hub.name` instead of `hub.id`
**File:** `web/src/components/admin/screens/bulk-messaging/CreateAnnouncementDialog.tsx` line 148: `checked={form.targetIds.includes(hub.name)}` and the toggle is `onCheckedChange={() => onToggleTargetId(hub.name)}`.
**File:** `web/src/server/modules/announcements/announcement.use-cases.ts` lines 72–76: `where: { pickupHub: { in: data.targetIds } }` — but `pickupHub` is the hub **name** in the Rider model (a string column, not a FK). So sending `hub.name` is actually correct — but this is implicit and fragile. If the schema ever migrates to `pickupHubId`, the dialog needs to change.

Document this in a comment or rename `pickupHub` to `pickupHubName` to make the contract explicit.

### P2-5: `useBulkMessaging.calculateRecipients` returns the wrong type for `BY_HUB` — fetches page 1, not all matching
**File:** `web/src/components/admin/screens/bulk-messaging/useBulkMessaging.ts` line 95: `fetch(\`/api/admin/riders?hubId=${id}&limit=1\`)` then reads `j.pagination?.total`. This works **only because** the server returns the total in the pagination object. If the server is ever optimised to return just `limit` records and not compute `count`, the count will silently be wrong.

**Fix:** Pass `limit=0` and use `pagination.total` server-side, or add a `?countOnly=true` flag.

### P2-6: `coupon.use-cases.list` returns the raw Prisma record, exposing the database column name
**File:** `web/src/server/modules/coupons/coupon.use-cases.ts` lines 7–12. The endpoint leaks the schema's paise-suffixed field names. Already documented in P0-3; the fix is the same.

### P2-7: Score list orders by `compositeScore: 'asc'` — lowest scores first
**File:** `web/src/server/modules/scores/score.use-cases.ts` line 31. This puts the WORST-scoring riders at the top — sensible for risk triage but the table shows no sort indicator and the leaderboard is derived client-side. Easy for an admin to mistake the top row for "best rider".

**Fix:** Default to `compositeScore: 'asc'` (current) is correct for a risk page. Add a column sort header and visual indicator.

### P2-8: Announcement `status === 'FAILED'` filter is silently empty — no code path ever sets the status to FAILED
**File:** `web/src/components/admin/screens/bulk-messaging/types.ts` lines 65–71: `STATUS_FILTERS` includes `FAILED`. The Prisma `AnnouncementStatus` enum has `FAILED`. The list use case filters by `status` (line 10 of the use case). But **no code path ever sets `status: 'FAILED'`** on an announcement. So filtering by `FAILED` always shows an empty list.

Either implement FAILED (mark as failed when all delivery rows are FAILED), or remove it from the filter options.

### P2-9: Dead `sendToAll` method in notification use cases duplicates `sendToAllRiders` logic
**File:** `web/src/server/modules/notifications/notification.use-cases.ts` lines 23–25: `sendToAll` uses `notificationRepository.sendToAll`. The admin route doesn't call this (it calls `sendToAllRiders` which goes directly to `db.notification.createMany`). The rider route at `notification.routes.ts:33-37` calls `sendToAll`. Two paths, two slightly different implementations, one works (uses FCM-bypass), the other doesn't. Consolidate.

### P2-10: Hardcoded "Sparkles" icon for sponsored offers but no equivalent for unsponsored
**File:** `web/src/components/admin/screens/offers/OfferGrid.tsx` lines 87–94. UX suggestion only — consider an icon for "regular" offers (e.g. `Tag` or `Gift`) so the card is less bare.

---

## Recommended fix order

| # | Item | Section | Effort | Risk |
|---|---|---|---|---|
| 1 | **P0-4** Send-notification FCM bypass + enum throw | Messaging | 3–4h | Medium (enum migration) |
| 2 | **P0-1** Score recalculate cache bypass | Scoring | 10m | Low |
| 3 | **P0-2** Scheduled announcement processor | Messaging | 2h | Low |
| 4 | **P0-3** Coupon field-name + paise data fix | Coupons | 1h + 2h backfill | Medium (data correction) |
| 5 | **P1-1** Shifts permission | Shifts | 20m | Low |
| 6 | **P1-4** Coupon search server-side | Coupons | 30m | Low |
| 7 | **P1-8** Type-case consistency | Messaging | 15m | Low |
| 8 | **P1-2** Score breakdown sub-scores | Scoring | 30m–3h | Low |
| 9 | **P1-3** Bulk Messaging recipient count | Messaging | 1h | Low |
| 10 | **P1-5** Tab counts from server totals | Offers | 20m | Low |
| 11 | **P1-7** Recalculate-all async job | Scoring | 3h | Medium |
| 12 | **P2-3** Permission helper extraction | All | 15m | Low |
| 13 | **P2-8** Remove dead FAILED filter | Messaging | 10m | Low |

**Suggested PR shape (each shippable independently):**
- PR: "P0-1 + P1-2 score recalc fix" — 1 file use-case, 1 file dialog, ~10 lines. Trivial review.
- PR: "P0-2 announcement scheduler" — 1 new cron route, 1 helper in the announcement use case, 1 integration test. Self-contained.
- PR: "P0-3 + P2-6 coupon display + data correction" — 1 file use-case transform, 1 file display, 1 migration script. The migration script should be reviewed by data/ops.
- PR: "P0-4 + P1-8 notification system fix" — 1 enum migration + 4 file updates + tests. Needs careful review.
- PR: "P1-1 + P1-4 + P1-5 admin permission + search/count" — small UI/route cleanups. 3 PRs in one or split.

---

## Tests gap analysis

| Section | Existing test | What's missing |
|---|---|---|
| **Shifts** | None | CRUD happy paths, the `parts` JSON round-trip, the "active lease blocks delete" guard |
| **Scoring** | `scores.test.ts` (list + POST) and `admin_scores_recalculate.test.ts` (POST recalc-all) | The **cache bypass** (P0-1) is the most critical gap — no test asserts the score actually changes after a recalc when the source data changes |
| **Announcements** | None | The **scheduled → sent** processor (P0-2), the delivery breakdown, the target audience resolution (ALL, BY_HUB, BY_STATUS, BY_PLAN) |
| **Notifications** | None | The **enum-validation** throw (P0-4), the admin route vs the rider route divergence (Bug B), the markRead race |
| **Offers** | `offers.test.ts` (list + POST) | PUT (update), DELETE, the toggle, the `getActiveSponsored` use case |
| **Coupons** | `coupons.test.ts` (list + POST + PUT + DELETE) | The **field-name shape** (P0-3) — tests don't assert that the response contains `discountValue` |
| **Scoring - per-rider recalc** | `scores.test.ts` POST hits the same `calculateRiderScore` with the same cache | A test that changes a rider's KYC status, recalculates, and asserts the new score reflects the change within 0ms (no cache) |

Adding the cache-bypass test and the coupon shape test is the highest-value test work — both would have caught the corresponding P0s.

---

## Architecture observations (informational, not actionable)

1. **The four modules have very different levels of code-splitting.** `bulk-messaging` is split into 9 files, `notifications` into 7, `rider-scoring` into 7, `shifts` into 7, but `offers` is split into 5 and the `OfferManagement.tsx` orchestrator still re-exports 3 of them inline (5x `import { ... } from './offers'`). The `coupons` code is **entirely inside** the `offers` subdirectory — there is no `coupons/` split, even though offers and coupons are different domain entities with different schemas. This makes the code harder to navigate and the next refactor (extracting coupons to its own module) is a real PR-sized job.

2. **All four use cases rely on `createAuditLog(...).catch(() => {})` (fire-and-forget audit writes).** A failing audit log never blocks the user-facing action, but it also never surfaces. The audit log table is the only place that records "who created coupon X" — if the audit log silently fails for a week, the team has no idea. Consider at minimum a counter / metric.

3. **The Notification table has no `deletedAt` and no retention policy.** Every admin "send to all" creates N rows that live forever. For 10k riders and 1 admin broadcast per week, that's 520k rows / year. The schema has `NotificationDelivery` for tracking, but no cleanup job. The `web/src/app/api/cron/cleanup-telemetry/route.ts` exists but is for telemetry, not notifications.

4. **The bulk messaging use case wraps announcement + delivery + notification writes in a single `db.$transaction`.** Good. But the FCM-side effects (which the system is not actually doing, per P0-4) should also be transactional or have a retry mechanism. Right now, even after P0-4 is fixed, the FCM send happens after the transaction commits, so a FCM failure leaves a "sent" announcement with no FCM payload — which is exactly the current bug, just renamed.

5. **`coupon.use-cases.create` does not normalise the `code` field on read.** It only uppercases on write. If the schema ever supports case-insensitive uniqueness (or the unique constraint is ever moved to `LOWER(code)` for collation reasons), every existing coupon with mixed case will need a migration. Trivial now; load-bearing later.

---

## Out-of-scope notes

- The rider-facing `/api/shifts` endpoint (used by the Flutter app) is touched only as far as it depends on the shift use case. The audit focused on the admin side.
- The `rewards` module in the admin panel is a separate audit. It has a `notifyRewardMilestone` integration with `notificationService` that is currently broken for the same P0-4 enum-mismatch reason.
- The `feature-flags` module uses `notificationService` for the "MANDATORY_UPDATE" overlay — same enum-mismatch risk, but the FCM `sendOverlayTrigger` path doesn't go through Prisma so it may not be affected. Worth verifying separately.
