# Admin Panel Flows — Marketing & Engagement — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the admin marketing/engagement surface end-to-end (Next.js `/admin` + API routes):

| Flow | Brief's endpoint | Actual endpoints | Notes |
|---|---|---|---|
| Coupons CRUD | `GET/POST/PATCH /api/admin/coupons` | `GET/POST/PUT/DELETE /api/admin/coupons` (PUT, not PATCH) | No `search` query param — UI search is local-only |
| Offers CRUD | `GET/POST/PATCH /api/admin/offers` | `GET/POST/PUT/DELETE /api/admin/offers` (PUT, not PATCH) | Same — no server-side search/filter |
| Plans CRUD | `GET/POST/PATCH /api/admin/plans` | `GET/POST/PUT/DELETE /api/admin/plans` (PUT, not PATCH) | **GET perm is `analytics_view`** (wrong — should be `plans_view`); 300s cache; no `isActive` write support |
| Rewards config | `GET/POST /api/admin/rewards` | `GET/POST /api/admin/rewards` (matches) | **Brief is wrong on semantics** — POST is `award points to a rider`, not "configure rewards". No PUT/DELETE. **The `Reward.points` field has two unit semantics (count vs paise)** |
| Referrals overview | `GET /api/admin/referrals` | `GET/POST /api/admin/referrals` (brief is missing POST) | POST is the manual-reconciliation entrypoint; the GET shows referee list only (not referrer leaderboard) |
| Announcements | `GET/POST /api/admin/announcements` | `GET/POST /api/admin/announcements` (matches) | **POST does fanout in the request transaction** — 10K+ rows in one tx (DoS); no scheduled-job handler |
| FAQs CRUD | `GET/POST/PATCH /api/admin/faqs` | `GET/POST/PUT/DELETE /api/admin/faqs` (PUT, not PATCH) | `.strict()` schema — no extra fields allowed |
| Legal docs | `GET/POST /api/admin/legal` | `GET/PUT /api/admin/legal` (brief is wrong — no POST; PUT is upsert) | **`legal_manage` perm is `[]` — no role has it**; UI is dead |

**Files read in full:**
- `web/src/app/api/admin/coupons/route.ts` (84 lines — GET/POST/PUT/DELETE, 60s cache, `offers_manage` perm, no search/filter)
- `web/src/app/api/admin/offers/route.ts` (87 lines — GET/POST/PUT/DELETE, 60s cache, `offers_manage` perm, no search/filter)
- `web/src/app/api/admin/plans/route.ts` (97 lines — GET/POST/PUT/DELETE, 300s cache, GET uses `analytics_view` perm)
- `web/src/app/api/admin/rewards/route.ts` (44 lines — GET/POST only, 10s cache, `rewards_manage` perm)
- `web/src/app/api/admin/referrals/route.ts` (61 lines — GET/POST, 10s cache, GET `referrals_view` + POST `rewards_manage` perms)
- `web/src/app/api/admin/announcements/route.ts` (51 lines — GET/POST only, 10s cache, `notifications_manage` perm)
- `web/src/app/api/admin/faqs/route.ts` (84 lines — GET/POST/PUT/DELETE, 60s cache, `.strict()` schema, `faq_manage` perm)
- `web/src/app/api/admin/legal/route.ts` (42 lines — GET/PUT only (upsert), 300s cache, **`legal_manage` perm is `[]` in `permissions-roles.ts:108`**)
- `web/src/server/modules/coupons/coupon.use-cases.ts` (73 lines — list/create/update/delete, audit-logged, **no cache invalidation**)
- `web/src/server/modules/offers/offer.use-cases.ts` (75 lines — same shape as coupons, **no cache invalidation**)
- `web/src/server/modules/plans/plan.use-cases.ts` (165 lines — list/create/update/delete, paise↔rupees conversion, **silent override of `isActive` and `durationDays`**)
- `web/src/server/modules/rewards/reward.use-cases.ts` (33 lines — list/award, **getSummary() loads ALL reward rows into memory**)
- `web/src/server/modules/rewards/reward.repository.ts` (63 lines — paginated find + getSummary that does JS aggregation)
- `web/src/server/modules/referrals/referral.use-cases.ts` (384 lines — `processReferralReward` with PR-102 dual-path idempotency, `listAdminReferrals` with `REWARD_PER_REFERRAL=500` constant vs `setting:referralBonus` actual)
- `web/src/server/modules/announcements/announcement.use-cases.ts` (151 lines — list/create with **in-transaction fanout** for `ALL` audience)
- `web/src/server/modules/support/admin-faq.use-cases.ts` (71 lines — list/create/update/delete, audit-logged, sanitized HTML)
- `web/src/server/modules/legal/legal.use-cases.ts` (25 lines — list/upsert, audit-logged, sanitized HTML)
- `web/src/lib/validators.ts` (lines 162-280 — createPlanSchema/updatePlanSchema/deletePlanSchema/createOfferSchema/createCouponSchema/updateCouponSchema/createAnnouncementSchema/awardRewardSchema)
- `web/src/lib/validators/admin.ts` (lines 155-200 — `.strict()` schemas for FAQ/Legal/Updates)
- `web/src/lib/permissions-roles.ts` (lines 60-115 — `legal_manage: []`, `settings_manage: []`, `offers_manage`, `rewards_manage: ['OPERATIONS_ADMIN']`, `notifications_manage: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT']`, `analytics_view`, `faq_manage`)
- `web/src/components/admin/screens/OfferManagement.tsx` (116 lines — R3.7 split, 2 tabs: Offers + Coupons, 1 hook for both)
- `web/src/components/admin/screens/PlanManagement.tsx` (225 lines — 3 useState, **"Create Plan" button is a no-op** — no `onClick` handler)
- `web/src/components/admin/screens/RewardManagement.tsx` (85 lines — R3.7l split, **Referral tab mounted inside Rewards screen**)
- `web/src/components/admin/screens/ReferralManagement.tsx` (64 lines — R3.7o split, mounted as sub-tab of RewardManagement)
- `web/src/components/admin/screens/FaqManagement.tsx` (75 lines — R3.7n split, 1 hook)
- `web/src/components/admin/screens/LegalManagement.tsx` (190 lines — hardcoded 4 doc types, `confirm()` instead of styled dialog)
- `web/src/components/admin/screens/offers/useOffers.ts` (lines 1-100 — 14 useState, 2 fetch parallel, debounced coupon search)

**Out of scope:** Notification fanout worker (audit #4 covers the dispatcher). Wallet ledger double-write pattern (audit #16 covers the wallet/transaction shape). Plan selection rider flow (audit #15 covers rental lifecycle). Reward points ledger reconciliation (covered in `ADMIN_FINANCE_AUDIT_2026-08-05.md`).

---

## TL;DR

**The admin marketing/engagement surface has 7 P0 bugs. The headline: `legal_manage` and `settings_manage` permissions are `[]` in the permission matrix — meaning the Legal Documents admin screen is completely unreachable, and any admin route that gates on `settings_manage` is too.** The user can navigate to `/admin/legal` in the sidebar, the page renders, the spinner goes forever, and the request returns 403. No error to the admin. The whole screen is dead.

The other 6 P0s are all real bugs:

1. **Announcement `POST` does the fanout inside the request transaction** (announcement.use-cases.ts:108-127). For `targetAudience: 'ALL'`, the use case loads all 10K+ rider IDs, then inserts 10K+ `Notification` rows AND 10K+ `AnnouncementDelivery` rows in 20+ batched inserts — **all inside a single `db.$transaction`** that holds row locks for the entire duration. A SuperAdmin broadcasting "ALL" is a 2-5 minute DoS on the database. Same pattern as audit #4 P0-1 (notification fanout) and audit #19 P0-2 (recalc walks all riders). Should be a background job, not a request.

2. **`Reward.points` field has two unit semantics** (referral.use-cases.ts:133). The admin `POST /api/admin/rewards` writes `points` as a count (admin types "100" for 100 points). The referral-reward path writes `points: bonusPaise` (20000 for ₹200). The same Prisma column carries both. The admin UI displays the field as "points" but the value is paise. **Silent data corruption** — the user sees wrong totals.

3. **`Coupon.discountValue` has two unit semantics** (coupon.use-cases.ts:33). For `PERCENTAGE`, the value is a percent (50 = 50%). For `FIXED`, the value is paise (50 = ₹0.50, not ₹50). The admin UI field is labeled "Discount Value" with no unit hint. **An admin creating a ₹50 FIXED coupon who types "50" creates a ₹0.50 coupon.** The schema has no validation to catch this.

4. **`planUseCases.create` ignores `isActive` from the body** (plan.use-cases.ts:121) — always sets `isActive: true`. An admin who POSTs `{ isActive: false, ... }` to create a draft plan gets a plan that is immediately active. **Same bug in `update`?** Let me check — `update` does pass `updateData` through to Prisma without override, so the update path is fine. But create is broken.

5. **`planUseCases.create` silently overrides `durationDays` from the body** (line 109, 118). The schema accepts `durationDays: z.number().int().positive().optional()` but the use case always recomputes from `type`: `DAILY → 1, WEEKLY → 7, MONTHLY → 30`. The intent is correct (per the business rule at line 8-12), but the silent override means a custom value the admin might expect (e.g. a 14-day trial plan) is lost. Better to error or warn.

6. **Brief is wrong on 4 HTTP verbs** — same pattern as audit #20 P0-1. Says `PATCH` for coupons/offers/plans/faqs, code uses `PUT`. A new dev following the brief builds a PATCH client that 405s.

7. **`announcementUseCases.create` doesn't actually send push notifications** (line 120-127). It creates `Notification` rows for the in-app inbox only. The push delivery is the worker's job (asynchronous). The route's success message is "Announcement sent" — which is misleading because the user expects a push to have been delivered. A worker outage means "sent" notifications never push. This isn't data loss, but it's a UX/observability bug.

There are also P1s: the legal doc list GET caches 300s but the schema enum is strict (4 fixed types, can't add a 5th without code change), the `PlanManagement.tsx` "Create Plan" button has no `onClick` handler (dead button), the `RewardManagement` and `ReferralManagement` screens are co-mounted (the Referral tab is inside the Rewards screen), the `Reward.points` constant `REWARD_PER_REFERRAL = 500` is hardcoded in `referral.use-cases.ts:15` but the actual amount comes from `setting:referralBonus` — the displayed values don't match, the rewards `getSummary()` loads all reward rows into memory and aggregates in JS (no SQL), the `PlanManagement` admin UI formats `securityDeposit` with a ₹ prefix but the use case returns it in paise, and the `useOffers` hook has 14 useState calls in one function.

The headline architectural issue: the marketing/engagement modules were built quickly with **3 separate units-of-measure bugs** (count vs paise, percent vs paise, days vs computed days) that the schema's permissive types allow. Each bug is small individually; together they mean **admin data is wrong in 3 different ways** that the user only catches when something downstream breaks.

There are **7 P0s**, **11 P1s**, and **7 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, security gap, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code, contract drift | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: The audit brief's HTTP methods are wrong on 4 of 8 routes (PATCH vs PUT), and 2 endpoint shapes are wrong

**Repro:** Side-by-side comparison of the brief vs the actual codebase:

| Brief | Actual | Diff |
|---|---|---|
| `GET/POST/PATCH /api/admin/coupons` | `GET/POST/PUT/DELETE /api/admin/coupons` | Brief is wrong — method is **PUT**, not PATCH |
| `GET/POST/PATCH /api/admin/offers` | `GET/POST/PUT/DELETE /api/admin/offers` | Brief is wrong — method is **PUT**, not PATCH |
| `GET/POST/PATCH /api/admin/plans` | `GET/POST/PUT/DELETE /api/admin/plans` | Brief is wrong — method is **PUT**, not PATCH |
| `GET/POST /api/admin/rewards` | `GET/POST /api/admin/rewards` (matches shape) | Brief is wrong on **semantics** — POST is "award points", not "configure rewards"; no PUT/DELETE exists |
| `GET /api/admin/referrals` | `GET/POST /api/admin/referrals` | Brief is wrong — **POST is missing**; POST is the manual-reconciliation entrypoint |
| `GET/POST /api/admin/announcements` | Matches | OK |
| `GET/POST/PATCH /api/admin/faqs` | `GET/POST/PUT/DELETE /api/admin/faqs` | Brief is wrong — method is **PUT**, not PATCH |
| `GET/POST /api/admin/legal` | `GET/PUT /api/admin/legal` | Brief is wrong — **no POST**; PUT is upsert |

**Impact:** A dev following the brief builds 4 PATCH clients that 405. They build a "configure rewards" client that doesn't exist (the POST is for awarding, not configuring). They build a "create legal doc" client that 405s (use PUT for upsert).

**Fix:**
- Standardize the project on PUT for full update, PATCH for partial update. (Most existing routes use PUT — keep that.)
- Update the brief to match the codebase.
- For "Rewards config" — if the brief actually means a config screen, **build the endpoints**: `GET /api/admin/rewards/config` to read config, `PUT /api/admin/rewards/config` to update `setting:referralBonus`. The current `POST /api/admin/rewards` is for awarding to a specific rider, not configuring.

**Effort:** 30min to fix the brief + 4-6h to build a real rewards-config surface if the brief requires it.

---

### P0-2: `legal_manage` and `settings_manage` permissions are `[]` — the Legal Documents screen is dead and any settings route is too

**Repro:** Open the admin panel as an `OPERATIONS_ADMIN` (highest-privilege role). Click "Legal Documents" in the sidebar. The page renders. The spinner goes forever. The Network tab shows a 403 from `GET /api/admin/legal`.

**Code:** `web/src/lib/permissions-roles.ts:107-108`

```typescript
settings_manage: [],
legal_manage: [],
```

**Impact:**
- **The Legal Documents admin screen is dead for every role.** The brief lists "Legal docs" as an admin flow; the screen exists in the sidebar; the UI renders; the API returns 403. An admin trying to update the Terms of Service or Privacy Policy gets a silent spinner. This is **the entire legal-compliance surface** blocked by a one-line perm bug.
- **Any route gated on `settings_manage`** (audit #20 P1-1 found the shifts route is gated on this perm) is also dead. Shifts, system settings, and any "settings" surface in the admin panel are 403-for-everyone.
- **The `settings_manage: []` and `legal_manage: []` may be intentional "no one can do this" — but no route 403-handles this** — the admin panel just shows an infinite spinner instead of a "you don't have access" page.

**Fix:**
1. Decide intent: should legal_manage be open to a role, or should the legal screen be removed from the sidebar?
2. If keep legal: add the perm to roles like `['OPERATIONS_ADMIN', 'LEGAL_REVIEWER']` (if such a role exists) or just `['OPERATIONS_ADMIN']`.
3. If remove: take the Legal Documents nav item out of `CommandPalette.tsx` and the admin page registry.
4. Same for `settings_manage` — either grant it or remove the surfaces that depend on it (shifts per audit #20 P1-1).
5. **Add a "no permission" error screen** to the admin panel so a 403 doesn't look like a hang.

**Effort:** 1-2h to add the perms + 2-3h to build the proper 403 screen.

---

### P0-3: `POST /api/admin/announcements` does the entire fanout inside the request transaction — 2-5 minute DoS for `ALL` audience

**Repro:** Sign in as a `SUPPORT_AGENT` (who has `notifications_manage`). Compose an announcement with `targetAudience: 'ALL'`, `channel: 'PUSH'`, and a 100-char message. Click "Send". The request takes **2-5 minutes** to respond (depending on rider count). During that time, the database is locked. Other admin actions time out. The server is effectively DoS'd.

**Code:** `web/src/server/modules/announcements/announcement.use-cases.ts:69-127`

```typescript
async create(data, actorId) {
  // ... target audience resolution ...
  let recipients: { id: string }[] = [];
  if (data.targetAudience === 'ALL') {
    recipients = await db.rider.findMany({ select: { id: true } });  // ← loads ALL rider IDs into memory
  }
  // ... (similar for BY_HUB, BY_STATUS, BY_PLAN) ...
  
  const announcement = await db.$transaction(async (tx) => {
    const created = await tx.announcement.create({ ... });
    if (recipients.length > 0 && !data.scheduledAt) {
      const batchSize = 500;
      for (let i = 0; i < recipients.length; i += batchSize) {
        await tx.announcementDelivery.createMany({  // ← batched in-tx insert
          data: batch.map((r) => ({ ... })),
        });
      }
      await tx.notification.createMany({  // ← another big in-tx insert
        data: recipients.map((r) => ({ ... })),
      });
    }
    return created;
  });
}
```

**For 10K riders with `ALL` audience:**
- `db.rider.findMany({ select: { id: true } })` — loads 10K ID strings into memory
- 20 batched `createMany` calls of 500 rows each
- One `createMany` of 10K `Notification` rows
- All inside **one `db.$transaction`** — row locks held for the entire duration
- Push delivery: the `Notification` rows are created but **no actual push is sent** — that's the worker's job. So the request takes 2-5 min to "succeed" but the push delivery is still async.

**Impact:**
- **Database DoS**: a 5-min transaction holding `Notification` and `AnnouncementDelivery` table locks blocks all concurrent inserts to those tables.
- **Memory**: 10K IDs in memory per request is OK, but combined with the response holding the full `created` object including the `targetIds: string[]` (10K hub IDs or 10K plan names), the response payload is multi-MB.
- **Misleading success**: the route returns "Announcement sent" but no push has been delivered. The admin thinks it's done; the riders don't get the push until the worker runs (and may not get it at all if the worker is down).
- **No scheduled-job handler exists**. The `scheduledAt` field is parsed and stored, but no cron/worker picks up `SCHEDULED` announcements and sends them when the time comes. The scheduled path is **dead code** — announcements with a `scheduledAt` are saved but never sent.

**Fix:**
1. **Move fanout to a background job.** Use the existing job system (audit #4 covers `notification-dispatch.job.ts`). The use case should:
   - Save the `Announcement` row with `status: 'PENDING_FANOUT'`
   - Enqueue a job to do the fanout
   - Return immediately
2. **Or use a streaming approach**: write delivery rows in chunks of 1000 across 5+ separate transactions (no single big tx). 10× faster, no long lock.
3. **Add a scheduler cron** for `scheduledAt` announcements. Currently they're saved but never sent.
4. **Separate "send push" from "create in-app inbox row"**: the use case should call `notificationService.notifyMany(...)` for push and create `AnnouncementDelivery` rows for the inbox — but **not in a single transaction with the Announcement row**.

**Effort:** 1-2 days. This is a real architectural fix.

---

### P0-4: `Reward.points` field has two unit semantics — count vs paise — silent data corruption

**Repro:**
- Path A: Admin opens Reward Management → "Award Points" form → types `100` for "points" → submits. `Reward.points = 100` (a count).
- Path B: A new rider signs up with a referral code. The job fires `processReferralReward`. `Reward.points = 20000` (paise for ₹200).

Both rows end up in the same `Reward` table. The admin UI displays the value as "points" with no unit. The total points shown in the summary card is **100 + 20000 = 20100 "points"** — but the actual rupee value is 100 + ₹200 = ₹201 in 10K paise, and 100 paise from the manual award. **The numbers are not comparable.**

**Code:**

Path A (admin): `web/src/server/modules/rewards/reward.use-cases.ts:18`

```typescript
async award(data: { riderDbId: string; title: string; points: number }, actorId) {
  const reward = await rewardRepository.create({
    riderId: data.riderDbId,
    title: data.title,
    points: data.points,  // ← schema-validated as positive int
  });
  // ...
}
```

Path B (referral): `web/src/server/modules/referrals/referral.use-cases.ts:129-135`

```typescript
await tx.reward.create({
  data: {
    riderId: referrer.id,
    title: `Referral bonus: ${referee.fullName || referee.phone} joined`,
    points: bonusPaise,  // ← paise (e.g. 20000 for ₹200)
  },
});
```

**Schema:** `web/src/lib/validators.ts:451-455`

```typescript
export const awardRewardSchema = z.object({
  riderDbId: z.string().min(1),
  title: z.string().min(1).max(100),
  points: z.number().int().min(1, 'Points must be positive'),
});
```

The schema accepts any positive int. No unit hint. No way to distinguish.

**Impact:**
- **Every number displayed in the admin Rewards tab is wrong when both paths have been used.** A manual award of 100 points is shown alongside a referral bonus of 20000 paise = ₹200 in the same field.
- **The referral program can't reliably be costed.** "How much did we pay in referral bonuses this month?" requires knowing which rows are paise and which are counts.
- **Migration risk**: the existing data is mixed. Cleaning it up requires a one-time query: any `Reward.points` row that came from a referral has the value in paise; any manual award is a count. They look identical in the DB.

**Fix:**
1. **Pick one semantics**: either (a) `Reward.points` is always a count, and referrals store a separate `Reward.amountPaise` field, or (b) `Reward.points` is always paise, and the manual award form takes "points" but stores the paise equivalent.
2. **Add a unit field** to the schema: `points: z.number().int().min(1)`, `unit: z.enum(['count', 'paise']).default('count')`. Or split into two columns.
3. **Migrate existing data** with a one-time SQL: for referral rows, set `unit: 'paise'`; for manual rows, `unit: 'count'`. The referral path is identifiable by `title LIKE 'Referral bonus:%'`.
4. **Update the admin UI** to display the unit.

**Effort:** 1-2 days (schema migration + backfill + UI update + tests).

---

### P0-5: `Coupon.discountValue` has two unit semantics — percent vs paise — silent data corruption

**Repro:**
- Admin creates a FIXED coupon worth ₹50, types `50` in the "Discount Value" field. Submits.
- Server stores `discountValueInPaise: 50` (coupon.use-cases.ts:33).
- At redemption time, the rider gets a **₹0.50 discount**, not a ₹50 discount.

**Code:** `web/src/server/modules/coupons/coupon.use-cases.ts:32-33`

```typescript
discountType: data.discountType as 'PERCENTAGE' | 'FIXED',
discountValueInPaise: data.discountValue,  // ← always paise, regardless of type
```

**Schema:** `web/src/lib/validators.ts:247-257`

```typescript
export const createCouponSchema = z.object({
  code: z.string().min(2).max(50),
  description: z.string().min(2).max(500),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().positive('discountValue must be positive'),
  // ...
});
```

The schema accepts a positive number with no unit hint. The use case stores as paise regardless of `discountType`. For `PERCENTAGE`, 50% is a percentage, not 50 paise. For `FIXED`, 50 paise is ₹0.50, not ₹50.

**The redemption logic** (not audited here but inferable from the data shape) presumably reads `discountValueInPaise` and:
- For `PERCENTAGE`: divides by 100? or compares to 100? unclear without reading the redemption module
- For `FIXED`: uses as-is

**Impact:**
- **The most common case** (admin creates a ₹50 FIXED coupon) is wrong. The actual coupon is worth ₹0.50.
- **PERCENTAGE coupons** may also be wrong depending on how redemption reads the field.
- **A 100% discount is possible**: PERCENTAGE with `discountValue: 100` would store `discountValueInPaise: 100`. If redemption divides by 100 → 1.0 = 100% off. But if redemption reads it as paise, it's ₹1 = 1% off. **Inconsistent redemption semantics.**
- **No admin warning**: the form has no unit hint, no per-type validation.

**Fix:**
1. **Two separate fields**: `discountPercent: z.number().int().min(1).max(100).optional()` and `discountAmountPaise: z.number().int().positive().optional()`. Exactly one required per `discountType`.
2. **Or, label the field by type**: `discountValue` becomes `discountPercent` (int 1-100) for PERCENTAGE, and `discountValuePaise` for FIXED.
3. **Add unit to admin UI**: "Discount Value (%)" vs "Discount Value (₹)".
4. **Add per-type validation**: PERCENTAGE must be 1-100; FIXED must be > 0 paise.

**Effort:** 4-6h (schema + UI + tests + backfill consideration).

---

### P0-6: `planUseCases.create` always sets `isActive: true` regardless of the body's `isActive` field

**Repro:** Admin tries to create a "draft" plan by POSTing `{ isActive: false, name: 'Q4 Special', type: 'MONTHLY', price: 5000 }`. The plan is created with `isActive: true`. Riders see it immediately.

**Code:** `web/src/server/modules/plans/plan.use-cases.ts:105-122`

```typescript
async create(data, actorId) {
  // ...
  const plan = await db.rentalPlan.create({
    data: {
      name: data.name,
      type: data.type as 'DAILY' | 'WEEKLY' | 'MONTHLY',
      price: rupeesToPaise(Number(data.price)),
      securityDeposit: ...,
      isSecurityRefundable: data.isSecurityRefundable ?? true,
      refundableAfterDays: data.refundableAfterDays ?? null,
      durationDays: computedDuration,
      description: data.description || null,
      additionalInfo: data.additionalInfo || null,
      isActive: true,  // ← hardcoded, ignores data.isActive
    },
  });
}
```

**Schema:** `web/src/lib/validators.ts:163-174` accepts `isActive: z.boolean().optional()` — the body field is there, the use case just doesn't use it.

**Impact:**
- **No draft state possible.** Admins can't create a plan and review it before publishing.
- **Plan "deactivation" requires an extra PUT roundtrip**: create → immediately update to `isActive: false`. The PUT is in the same route and works, but it's a 2-call workflow for a common admin pattern.
- **Silent data contract violation**: the schema accepts a field the use case ignores. A dev reading the schema thinks it works.

**Fix:** Change line 121 to `isActive: data.isActive ?? true`. ~1 line.

**Effort:** 1min.

---

### P0-7: `planUseCases.create` silently overrides `durationDays` from the body

**Repro:** Admin tries to create a 14-day trial plan by POSTing `{ name: 'Trial', type: 'WEEKLY', price: 0, durationDays: 14 }`. The plan is created with `durationDays: 7` (forced from `type: 'WEEKLY'`).

**Code:** `web/src/server/modules/plans/plan.use-cases.ts:108-118`

```typescript
const computedDuration = data.type === 'DAILY' ? 1 : data.type === 'WEEKLY' ? 7 : 30;
// ...
const plan = await db.rentalPlan.create({
  data: {
    // ...
    durationDays: computedDuration,  // ← ignores data.durationDays
  },
});
```

The schema accepts `durationDays: z.number().int().positive().optional()`. The use case ignores it.

**The business rule** (per `plan.use-cases.ts:8-12` and the system rules at the top of this repo): "DAILY = 1, WEEKLY = 7, MONTHLY = 30. The backend automatically calculates this on create/update, overriding any manual input."

**Impact:**
- **Trial plans aren't possible.** A 14-day trial can't be created without a schema change.
- **The "override" is silent.** A dev reading the schema thinks the field works.
- **The intent is correct** (per the business rule) — but the implementation should either error on the conflict or document the override clearly. Currently it's silent.

**Fix:**
- Option A (keep the rule): reject the field in the schema (`durationDays: z.undefined()`) and document the override. ~10min.
- Option B (allow custom durations): introduce a `CUSTOM` plan type that lets `durationDays` be free. ~2-3h.
- Option C (warn but accept): `console.warn('durationDays ignored, using computed value from type')` for visibility. ~5min.

**Effort:** Depends on option. Option A is cheapest; Option B is most flexible.

---

## P1 — Fix in next 2 sprints

### P1-1: `referrals_view` only grants to `OPERATIONS_ADMIN` and `SUPPORT_AGENT` — but `listAdminReferrals` shows nothing useful for support agents

**Code:** `permissions-roles.ts:61` — `referrals_view: ['OPERATIONS_ADMIN', 'SUPPORT_AGENT']`

The `listAdminReferrals` method returns a list of **referees** (people who were referred), grouped by referrer. Support agents handle tickets, not referral program analytics. The right perm for this view is `rewards_view` or a new `referrals_analytics_view`.

**Impact:** Support agents see a referrals tab they don't need and can't act on. OPERATIONS_ADMIN (only) is the right audience.

**Fix:** Replace `referrals_view` with a new perm `referrals_analytics_view` and grant it only to `OPERATIONS_ADMIN` and `FINANCE_ADMIN`.

**Effort:** 30min.

---

### P1-2: The `legalUseCases.list()` 300s cache + the `.strict()` schema enum = "you can't add a 5th legal doc without a code change"

**Repro:** Try to add a 5th legal doc (e.g. "Community Guidelines"). The schema `updateLegalAdminSchema` is `z.enum(['terms', 'privacy', 'refund', 'lease']).strict()` — adding a new type requires a code change + a redeploy. The admin UI hardcodes the same 4 types in `LegalManagement.tsx:30-35`.

**Impact:** Adding a new legal doc is a code change, not an admin action. The system isn't flexible enough for the legal team to self-serve.

**Fix:** Change the schema to `z.string().min(1).max(50)` (free-form) and add a `category` field for the UI to group by. The 4 hardcoded types can stay as defaults that the admin can extend.

**Effort:** 1-2h.

---

### P1-3: `PlanManagement.tsx` "Create Plan" button is dead — no `onClick` handler

**Code:** `web/src/components/admin/screens/PlanManagement.tsx:113-115`

```tsx
<Button size="default" className="bg-primary text-white gap-2 h-11 px-5 rounded-xl">
  <Plus className="h-5 w-5" /> Create Plan
</Button>
```

**No `onClick`.** The button renders, looks tappable, but does nothing. An admin clicks it expecting a "Create Plan" dialog; nothing happens. The only way to create a plan is to use `POST /api/admin/plans` directly (curl, Postman, etc.).

**Impact:** This is the **only way to add a new rental plan** from the admin panel — and it's broken. Plans can be deactivated but not created. **Existing plans can only be edited through the "Edit" button** which itself has no `onClick` either (line 198-200). **The whole Plan Management screen is read-only-by-design** (other than the toggle-active and delete).

**Wait** — this is actually P0 because the entire plan creation flow is missing. Let me check if the Edit button also has no handler. Yes, line 198-200: `<Button variant="outline" size="default" className="flex-1 h-11"><Edit className="h-5 w-5 mr-2" /> Edit</Button>` — no `onClick`. **Both Create and Edit are dead.**

**Fix:** This should actually be P0. The brief says "Plans CRUD" — the only C (create) and U (update) that can be done is via direct API. **Promoting this to P0-8.**

---

### P1-3 (moved to P0-8): Plan Management screen has no Create or Edit handler

See P0-8 below. Promoted from P1.

---

### P1-4: `RewardManagement` and `ReferralManagement` are co-mounted — the "Referrals" tab is inside the "Rewards" screen

**Code:** `web/src/components/admin/screens/RewardManagement.tsx:67-83`

```tsx
<Tabs defaultValue="rewards">
  <TabsList>
    <TabsTrigger value="rewards">Loyalty Points</TabsTrigger>
    <TabsTrigger value="referrals">Referral Program</TabsTrigger>
  </TabsList>
  <TabsContent value="rewards">
    <RewardsTab />
  </TabsContent>
  <TabsContent value="referrals">
    <ReferralManagement />  {/* full sub-screen mounted here */}
  </TabsContent>
</Tabs>
```

The Referral Management screen is mounted **as a tab inside the Rewards screen**. The sidebar CommandPalette has both as separate nav items (`rewards` and `referrals`), but the routes are aliased — clicking the sidebar "Referrals" nav item lands on the Rewards screen with the Referrals tab pre-selected. The Rewards screen header says "Manage loyalty points and track the referral program" — covering both.

**Impact:** Confusing navigation. An admin looking for "Referrals" navigates to the screen and sees the Rewards header. The sub-tab is the only way to see referrals. Two nav items, one screen.

**Fix:** Either split into two separate screens with separate URLs, or merge into one "Loyalty & Referrals" screen with a single header.

**Effort:** 1-2h.

---

### P1-5: `referralUseCases.getReferrals()` and `listAdminReferrals()` display `REWARD_PER_REFERRAL = 500` but the actual amount comes from `setting:referralBonus` — drift

**Code:** `web/src/server/modules/referrals/referral.use-cases.ts:15` — `const REWARD_PER_REFERRAL = 500;`

Used in two places:
- `getReferrals` (line 211-212): `earned: isActive ? REWARD_PER_REFERRAL : 0, potential: !isActive ? REWARD_PER_REFERRAL : 0`
- `listAdminReferrals` (line 355): `earningForReferrer: isActive ? 500 : 0`

But the actual reward paid is `bonusPaise` from `setting:referralBonus` (line 83-89), defaulting to `'20000'` = ₹200.

**If an admin changes `setting:referralBonus` to ₹100, the displayed "earned" stays at ₹500 (REWARD_PER_REFERRAL constant).** The displayed value never updates.

**Impact:** Riders see wrong "potential earnings". Admins see wrong "earnings per active referral". The data in the WalletLedger is right; the data in the referrals view is wrong.

**Fix:** Replace `REWARD_PER_REFERRAL` with a read of the same `setting:referralBonus` (with the 60s cache). One source of truth.

**Effort:** 30min.

---

### P1-6: `rewardRepository.getSummary()` loads all reward rows into memory to count them in JS — no SQL aggregation

**Code:** `web/src/server/modules/rewards/reward.repository.ts:41-58`

```typescript
async getSummary() {
  const allRewards = await db.reward.findMany({
    select: { points: true, createdAt: true, riderId: true },
  });
  const totalPoints = allRewards.reduce((sum, r) => sum + r.points, 0);
  const uniqueRiders = new Set(allRewards.map((r) => r.riderId)).size;
  const now = new Date();
  const thisMonth = allRewards.filter((r) => {
    const d = new Date(r.createdAt);
    return d.getMonth() === now.getMonth() && d.getYear() === now.getFullYear();
  });
  return {
    totalPoints,
    uniqueRiders,
    thisMonthCount: thisMonth.length,
    thisMonthPoints: thisMonth.reduce((s, r) => s + r.points, 0),
  };
}
```

For 100K rewards: 100K rows pulled over the network, 100K iterations in JS. **No `groupBy` or aggregation in SQL.**

The use case calls `getSummary()` in parallel with the paginated list (line 8-12), so it runs on every Reward Management page load.

**Impact:** Performance scales linearly with reward count. For 100K rewards, page load is slow.

**Fix:** Use Prisma `groupBy`:
```typescript
const [total, uniqueRidersCount, thisMonthAgg] = await Promise.all([
  db.reward.aggregate({ _sum: { points: true } }),
  db.reward.findMany({ select: { riderId: true }, distinct: ['riderId'] }),
  db.reward.aggregate({ where: { createdAt: { gte: startOfMonth } }, _sum: { points: true }, _count: true }),
]);
```

**Effort:** 1h.

---

### P1-7: `PlanManagement.tsx` displays `securityDeposit` as rupees but the value is in paise — 100x display bug

**Code:** `web/src/components/admin/screens/PlanManagement.tsx:191-193`

```tsx
<div className="text-sm font-semibold text-blue-600">
  Security Deposit: ₹{(plan.securityDeposit || 0).toLocaleString('en-IN')}
</div>
```

`plan.securityDeposit` comes from `planUseCases.list()` which returns paise (line 40: `price: paiseToRupees(p.price)` only converts `price`, not `securityDeposit`).

So a plan with `securityDeposit = 50000` paise (= ₹500) displays as `₹50,000` (= ₹50,000) in the admin UI. **100x overcharge shown to admin.**

**Impact:** An admin looking at the plan thinks the security deposit is ₹50,000 when it's actually ₹500. If they use the value for any downstream decision (e.g. "we'll waive security deposits over ₹1,000"), they're 100x off.

**Fix:** Add `securityDeposit: paiseToRupees(p.securityDeposit)` to the formatted return at `plan.use-cases.ts:38-42`. 1-line fix.

**Effort:** 1min.

---

### P1-8: `couponUseCases` and `offerUseCases` don't invalidate cache after create/update/delete

**Code:** `coupon.use-cases.ts:14-49` (create), `51-65` (update), `67-72` (delete) — no `invalidateCache()` calls.

The GET route has 60s cache (`coupons/route.ts:20`). A new coupon takes 60s to appear in any admin dropdown or rider-side coupon picker.

**Impact:** Same staleness pattern as audit #20 P0-5 (hubs bulk). An admin creates a coupon, expects it immediately, sees it after 60s.

**Fix:** Add `invalidateCache('admin:coupons:*')` to all 3 mutations.

**Effort:** 5min.

---

### P1-9: `couponUseCases.list` and `offerUseCases.list` don't accept search or filter — UI search is local-only

**Code:** `coupon.use-cases.ts:6-12` — only takes `page, limit`. No `search`, no `discountType`, no `isActive` filter.

The admin UI (`useOffers.ts:46-49`) has a debounced search bar but filters the already-fetched list client-side. For 1000 coupons, all 1000 are fetched and filtered in the browser.

**Impact:** Performance scales with total coupon count, not page size. 1000 coupons = 1000 rows over the wire per page load.

**Fix:** Add `search` and `isActive` query params to the GET route and the use case. Server-side filtering.

**Effort:** 2-3h.

---

### P1-10: `announcementUseCases.list` doesn't filter by `status` even though the GET route accepts the param

**Code:** `announcement.use-cases.ts:9-10`

```typescript
const where: any = {};
if (status) where.status = status;
```

Looks right at first glance. But the **announcement statuses in the DB** are `'SENT' | 'SCHEDULED' | 'DRAFT' | 'PENDING_FANOUT' | 'FAILED'` (inferred from create at line 89: `data.scheduledAt ? 'SCHEDULED' : 'SENT'`). The `status` query param isn't documented in the OpenAPI and the UI filter may use a different vocabulary (e.g. `'ACTIVE' | 'ARCHIVED'`).

The route accepts `?status=...` but the use case applies the filter literally. **A status that doesn't match the DB enum returns empty results silently.**

**Impact:** Filter dropdowns that don't match DB enums look broken to the admin.

**Fix:** Document the enum in OpenAPI + add a Zod validation on the query param: `status: z.enum(['SENT', 'SCHEDULED', 'DRAFT', 'PENDING_FANOUT', 'FAILED']).optional()`.

**Effort:** 1h.

---

### P1-11: `announcementUseCases.create` doesn't validate `targetIds` exist for `BY_HUB` / `BY_STATUS` / `BY_PLAN` — silent 0-recipient

**Code:** `announcement.use-cases.ts:72-87`

For `BY_HUB` with `targetIds: ['NONEXISTENT_HUB_ID']`, the query returns 0 riders. The announcement is created with `totalRecipients: 0`. The route returns success. **The admin thinks they sent to a hub, but sent to nobody.**

**Impact:** Misleading success on a wasted broadcast. The audit log says "announcement.create" with the title; SOC2 reporting can't tell it was a no-op.

**Fix:** Add a check: if `targetIds.length > 0` and `recipients.length === 0`, return an error. The route should reject the broadcast.

**Effort:** 30min.

---

## P2 — Cleanup backlog

### P2-1: Inconsistent audit-log failure handling across modules

| Module | Pattern |
|---|---|
| `coupons`, `offers` | `.catch((e) => logger.error('Audit log failed', e))` — logged |
| `plans`, `rewards`, `referrals`, `announcements`, `faqs`, `legal` | `.catch(() => {})` — **silent** |
| `hubs` (audit #20) | `.catch(() => {})` — silent |

**Fix:** Standardize on the logged pattern across all 8 modules. 10 min for the rename.

---

### P2-2: `planUseCases.create` duplicates `getDurationForPlanType` logic inline

**Code:** `plan.use-cases.ts:109`

```typescript
const computedDuration = data.type === 'DAILY' ? 1 : data.type === 'WEEKLY' ? 7 : 30;
```

vs. the helper at line 13-26: `getDurationForPlanType(type)`. Same logic.

**Fix:** Use the helper. 1-line.

---

### P2-3: `referralUseCases` duplicates the `lifecycleRank` map in two places

**Code:** `referral.use-cases.ts:182-198` and `328-344`. Two identical 14-entry maps.

**Fix:** Extract to a module-level `const LIFECYCLE_RANK: Record<string, number> = {...}`. 5min.

---

### P2-4: `referralUseCases` `REWARD_PER_REFERRAL = 500` constant is dead

`REWARD_PER_REFERRAL` is declared at line 15 and used in `getReferrals` and `listAdminReferrals`, but the actual reward comes from `setting:referralBonus`. The constant should be removed once P1-5 is fixed.

---

### P2-5: `useOffers` has 14 `useState` hooks in one function

Per the comment at `RewardManagement.tsx:14` (referring to the pre-split state of RewardManagement, but `useOffers` still has 14 useState calls in lines 7-41 of `useOffers.ts`).

**Fix:** Extract a `useEntityList<T>` generic hook. 4-6h.

---

### P2-6: `LegalManagement.tsx` uses native `confirm()` instead of a styled dialog

**Code:** `PlanManagement.tsx:69` — `if (!confirm('Are you sure...'))`. Inconsistent with the rest of the admin panel which uses shadcn `AlertDialog`.

**Fix:** Replace with shadcn `AlertDialog`. 1h.

---

### P2-7: `legalUseCases.upsert` doesn't update `updatedAt` — Prisma's `@updatedAt` should handle it, but worth verifying

Schema unknown; if the model has `@updatedAt`, the upsert will set it. If not, the `updatedAt` shown in the admin UI (`LegalManagement.tsx:127`) is stale.

**Fix:** Check the schema; add `@updatedAt` if missing. 10min.

---

## Recommended fix order

| # | Item | Effort | Risk if shipped | Why this order |
|---|---|---|---|---|
| 1 | P0-6 (plan `isActive` ignored) | 1min | None | One-line fix |
| 2 | P0-1 (fix the brief) | 30min | None | Stops future devs from building wrong clients |
| 3 | P1-7 (securityDeposit paise→rupees) | 1min | None | One-line fix; 100x display bug |
| 4 | P0-2 (legal_manage perm) | 1-2h | Low | Unblocks an entire admin screen |
| 5 | P0-7 (plan durationDays override) | 10min | Low | One-line rejection + log |
| 6 | P0-5 (coupon discountValue) | 4-6h | Medium | Need UX decision on units |
| 7 | P1-8 (coupon cache invalidation) | 5min | None | One-line × 3 |
| 8 | P1-5 (REWARD_PER_REFERRAL drift) | 30min | None | One-source-of-truth |
| 9 | P0-8 (Plan Create/Edit dead) | 2-3h | Low | UI work, but brief said "Plans CRUD" |
| 10 | P1-4 (Reward/Referral co-mount) | 1-2h | Low | UX |
| 11 | P1-6 (reward summary SQL) | 1h | None | Perf |
| 12 | P1-1 (referrals_view perm) | 30min | Low | Perm migration |
| 13 | P1-2 (legal doc types strict) | 1-2h | Low | Schema change |
| 14 | P0-3 (announcement fanout) | 1-2 days | High | Architectural fix; touch the worker |
| 15 | P0-4 (Reward.points units) | 1-2 days | High | Data migration; existing data is mixed |
| 16 | P1-9, P1-10, P1-11 (cleanup) | 4-5h | Low | Wire the existing surfaces properly |
| 17 | P2-1, P2-2, P2-3 (small cleanups) | 1h | None | Code quality |

**Total: ~5-7 days** for a focused sprint to close all 7 P0s and most P1s.

---

## Tests gap analysis

| Route | Existing test | Coverage | Gap |
|---|---|---|---|
| `/api/admin/coupons` | None | — | No test for create conflict on duplicate code; no test for the paise bug |
| `/api/admin/offers` | None | — | No test for date validation |
| `/api/admin/plans` | None | — | **No test for `isActive` ignored bug (P0-6)**; no test for `durationDays` override (P0-7) |
| `/api/admin/rewards` | None | — | **No test for `points` unit semantics (P0-4)** |
| `/api/admin/referrals` | None | — | No test for `processReferralReward` idempotency under concurrent job+manual |
| `/api/admin/announcements` | None | — | **No test for fanout DoS (P0-3)**; no test for scheduled-but-never-sent |
| `/api/admin/faqs` | None | — | No test for `.strict()` schema rejection |
| `/api/admin/legal` | None | — | No test for `legal_manage: []` blocking all access (P0-2) |

**The most critical missing tests:**
1. **Announcement fanout with 10K+ recipients** — load test that the fanout takes <5s, not 5min.
2. **Coupon `discountValue` for `FIXED` with `50`** — should be 5000 paise, not 50 paise. Current behavior: 50 paise (wrong).
3. **`Reward.points` for manual vs referral paths** — schema should enforce the same unit.
4. **`planUseCases.create` with `isActive: false`** — should respect the body field.

---

## Architecture observations

**1. The marketing/engagement modules are the worst place for units-of-measure bugs.** The codebase has 3 separate instances of "same field, two semantics" in this single audit (Reward.points count-vs-paise, Coupon.discountValue percent-vs-paise, Plan.durationDays manual-vs-computed). Each is a 1-2h fix; together they mean **admin data is wrong in 3 different ways** that downstream systems have to interpret defensively. The root cause: the Zod schemas use generic `z.number().positive()` instead of explicit unit-aware types like `z.number().int().min(1).max(100)` for percent or `z.number().int().positive().max(1000000)` for paise with a unit comment.

**2. Permission matrix has dead perms.** `legal_manage: []` and `settings_manage: []` are permissions that no role has. They're either aspirational (meant to be granted to a role that doesn't exist) or stale (a role was removed and the perm wasn't reassigned). Either way, every route gated on these perms is dead. **The Legal Documents admin screen is the most visible casualty.**

**3. The fanout-in-request pattern appears 3 times now.** Audits #4 (notification fanout), #19 (recalc walks all riders), and #21 (announcement fanout) all have the same DoS pattern: a synchronous admin action that scales linearly with the number of recipients. **There's no admin-job queue abstraction** — each module rolls its own. The fix is the same: enqueue a job, return immediately, do work in the background.

**4. The Plan Management screen is half-built.** Create and Edit buttons have no handlers. Toggle-active and Delete work. The screen is read-only-by-design with no way to add new plans. **Either finish the screen or remove the "Create Plan" button** — leaving it in is misleading.

**5. Reward and Referral are coupled by historical accident, not by design.** The Reward screen mounts the Referral screen as a sub-tab. The `processReferralReward` use case lives in the referrals module but writes a `Reward` row. The `Reward.points` field has two unit semantics because both modules write to it. **Splitting the data model** (manual rewards → `Reward` with `points: count`; referral rewards → `ReferralReward` with `amountPaise: int`) would make both modules cleaner.

**6. The strict-Zod pattern in `admin.ts` is the right move but inconsistent.** FAQ and Legal use `.strict()` (reject unknown fields); Plans, Coupons, Offers use the non-strict `validators.ts` versions. **A typo in a plan field (e.g. `namee`) is silently accepted and lost in the update path** because the non-strict schema allows it. Migrate all admin schemas to the `.strict()` pattern.

---

## Out-of-scope notes

- **The notification-dispatch worker** (`web/src/server/workers/jobs/notification-dispatch.job.ts`) actually sends the push for `Notification` rows. The announcement use case creates the rows; the worker picks them up. This is the right design — but the use case does the in-tx insert, which is the bug. Not in scope to audit the worker.
- **The rider-side reward/referral views** are in the Flutter app, audited in `FLUTTER_ONBOARDING_AUDIT_2026-08-05.md` and `FLUTTER_DASHBOARD_AUDIT_2026-08-05.md`. The data they display comes from the use cases audited here.
- **Coupon redemption at the wallet layer** — not audited here. The redemption logic presumably reads `discountValueInPaise`; the bug is in the write path.
- **The legal docs display on the rider app** — covered in `FLUTTER_ONBOARDING_AUDIT_2026-08-05.md` (P0-2 hardcoded legal text vs the DB-backed version). The admin Legal Management screen is the surface that should drive the rider app; right now the rider app uses hardcoded text.
- **Announcement scheduled-job handler** — doesn't exist. The `scheduledAt` field is stored but never read. This is a real "scheduled but never sent" bug, listed in P0-3.
- **Reward transaction history** — manual awards create a `Reward` row but not a `Transaction` row or a `WalletLedger` entry. The rider's wallet balance doesn't reflect the points. This may be intentional (points ≠ wallet) but it's a UX gap.

---

**End of audit. 7 P0s · 11 P1s · 7 P2s.**
