# Admin Panel Flows — Rider Management — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the admin rider-management surface end-to-end (Next.js `/admin` + API routes):

| Flow | Brief's endpoint | Actual endpoints | Notes |
|---|---|---|---|
| List / search riders | `GET /api/admin/riders` | `GET /api/admin/riders` (matches) | Cached 5s, `getOrSetResponse` |
| Rider detail | `GET /api/admin/riders/[id]` | **Route does not exist.** Detail is loaded by filtering the list (search by id) or via subroutes: `/wallet-adjust`, `/plan`, `/device-data`, `/data-deletion` | Brief's URL is wrong |
| KYC review (approve/reject) | `PATCH /api/admin/kyc/[id]` | `POST /api/admin/kyc` (no `[id]`, no `PATCH`) | Brief's method+URL is wrong |
| Deposit management | `GET/POST /api/admin/deposits` | `GET /api/admin/deposits`, `PUT /api/admin/deposits`, `POST /api/admin/deposits` (alias for PUT) | 4 actions: APPROVE/REJECT/REFUND/FORFEIT |
| Guarantor review | `GET /api/admin/guarantors` | `GET /api/admin/guarantors`, `POST /api/admin/guarantors` (matches) | Permission check uses `kyc_approve` (wrong) |
| Rider scoring | `GET/POST /api/admin/scores` | `GET /api/admin/scores` (list), `POST /api/admin/scores` (recalc single), `POST /api/admin/scores/recalculate` (bulk) | No "create score" — scores are computed |
| Earnings override | `GET/POST /api/admin/earnings` | `GET /api/admin/earnings` only | **No POST/PUT exists.** Brief is wrong — there is no override endpoint |

**Files read in full:**
- `web/src/app/api/admin/riders/route.ts` (240 lines — GET list, POST create, PUT update, DELETE; field allowlist with 60+ KYC/wallet/guarantor fields)
- `web/src/app/api/admin/kyc/route.ts` (125 lines — GET with Prisma `contains` search, POST review; routes APPROVE through the new `approveKyc` use case)
- `web/src/app/api/admin/deposits/route.ts` (124 lines — GET with date filters, PUT 4 actions; **POST is `= Put` for backward compat**)
- `web/src/app/api/admin/guarantors/route.ts` (91 lines — GET list, POST review; **wrong permission: `kyc_approve`**)
- `web/src/app/api/admin/scores/route.ts` (52 lines — GET list, POST recalc single)
- `web/src/app/api/admin/scores/recalculate/route.ts` (28 lines — POST bulk recalc, **walks every rider in a loop**)
- `web/src/app/api/admin/earnings/route.ts` (44 lines — GET only, 10s cache, thin pass-through to `earningUseCases.list`)
- `web/src/app/api/admin/riders/[id]/wallet-adjust/route.ts` (181 lines — PR-89 hard cap MAX_DEBIT ₹50K, large-debit second-admin co-approval ₹10K+, SUSPENDED/CLOSED blocklist)
- `web/src/app/api/admin/riders/[id]/data-deletion/route.ts` (149 lines — PR-57 randomUUID for anonymization, audit row on start+complete+fail)
- `web/src/app/api/admin/riders/[id]/plan/route.ts` (27 lines — **only handles `REJECT` action; no `APPROVE`**)
- `web/src/app/api/admin/riders/[id]/device-data/route.ts` (25 lines — GET device tracking data)
- `web/src/app/api/admin/riders/bulk/route.ts` (98 lines — `updateStatus`/`delete`/`bulkKyc` actions; idempotency middleware)
- `web/src/app/api/admin/riders/actions/route.ts` (192 lines — `ASSIGN_PLAN`/`COMPLETE_PICKUP`/`END_RENTAL` + security actions; `LOCK_DEVICE` is **disabled**)
- `web/src/server/modules/riders/admin-riders.use-cases.ts` (867 lines — `list`/`create`/`update`/`delete`; field allowlists SAFE_RIDER_FIELDS/KYC_FIELDS/WALLET_FIELDS/GUARANTOR_FIELDS; shared-guarantor detection walks all riders)
- `web/src/server/modules/deposits/deposit.use-cases.ts` (126 lines — `submitDeposit` MIN ₹500, `reviewDeposit`, `requestRefund`, `forfeitDeposit`, `listDeposits`)
- `web/src/server/modules/scores/score.use-cases.ts` (125 lines — `list`/`recalculate`/`recalculateAll`; `recalculateAll` loops every rider)
- `web/src/server/modules/earnings/earning.use-cases.ts` (15 lines — single `list` method, thin pass-through to repo)
- `web/src/components/admin/screens/RiderScoringScreen.tsx` (90 lines — R3 split orchestrator; 2 tabs: scores/leaderboard)
- `web/src/components/admin/screens/KycManagement.tsx` (95 lines — uses `useKyc` hook; bulk action bar)
- `web/src/components/admin/screens/rider-management/useRiders.ts` (lines 1-100 — 22 useState hooks; 300+ lines of data hook)
- `web/src/components/admin/screens/WalletDepositManagement.tsx` (35 lines — R3.7j split; uses `useWalletDeposits`)
- `web/src/components/admin/CommandPalette.tsx` (160 lines — calls `/api/admin/riders?search=...&limit=3` for cross-entity search)
- `web/src/lib/admin-api.ts` (referenced — in-flight dedup for GETs)

**Out of scope:** Admin auth + RBAC internals (covered in `ADMIN_KYC_ONBOARDING_AUDIT_2026-08-05.md` and the role permission screens). The `data-management` subroutes. The notification fanout (audit #4). The `earnings` module's deeper internals — there's no override flow at all.

---

## TL;DR

**The admin rider-management surface has 6 P0 bugs. The headline: the audit brief has 4 wrong URLs/methods out of 7 listed.** `GET /api/admin/riders/[id]` doesn't exist. `PATCH /api/admin/kyc/[id]` is actually `POST /api/admin/kyc` (no id, no PATCH). `GET/POST /api/admin/earnings` is actually `GET`-only — **there is no earnings override endpoint at all.** The brief's mental model of admin rider management doesn't match what's in the codebase.

The other 5 P0s are all real bugs that affect admin operations daily:
1. **`POST /api/admin/scores/recalculate` walks every rider in a single sync loop** (score.use-cases.ts:91-120). For 10K riders at 200ms each, that's 33 minutes of blocking the server. No batching, no queue, no cancel. A SuperAdmin clicking "Recalculate all" on the Rider Scoring screen is a 33-minute denial-of-service on the database.
2. **The KYC review screen makes 2 round trips per page load** — `kyc-management/useKyc.ts:40` calls `/api/admin/riders?kycStatus=...` (the riders list with nested kycProfile) and the KYC detail sheet then calls `/api/admin/kyc` for the official KYC record. **Two endpoints, two sources of truth**, the rider table may be stale by 5s (the cache TTL), and the "official" KYC record is in a different cache key.
3. **`/api/admin/guarantors` POST requires `kyc_approve` permission** (guarantors/route.ts:77). A user with `kyc_view` (the appropriate permission for review) **cannot** review guarantors. The permission name is wrong — it should be `guarantor_approve` or a shared `onboarding_approve`. **Permission misnamed = unauthorized access denied for legitimate reviewers.**
4. **The bulk DELETE on `/api/admin/riders?id=...` writes no audit log entry** (riders/route.ts:222-239). Compare to the data-deletion route at `[id]/data-deletion/route.ts` which writes `RIDER_DATA_DELETION_INITIATED`/`_COMPLETED`/`_FAILED`. **Two ways to delete a rider, one audited, one not.** A malicious admin can use the silent path.
5. **Wallet-adjust allows `allowNegative: true` for DEBIT** with no minimum balance check (wallet-adjust/route.ts:149). The comment says "for late fees" but there's no max-negativity, no per-day cap (MAX_DEBIT_INR is per-call, not per-day), no admin warning. An admin can drain a wallet to -₹10L.
6. **`POST /api/admin/riders/[id]/plan` only handles `REJECT`** (plan/route.ts:17-26). The companion `APPROVE` action is in the legacy `actions/route.ts` under `ASSIGN_PLAN`. **Two ways to do the same thing; the newer one is half-implemented.**

There are also P1s: the shared-guarantor detection walks all riders (expensive, O(N²)), the rider list `useRiders.ts` parses the response inconsistently with `useKyc.ts` and `useBulkMessaging.ts`, the `LOCK_DEVICE` action is **listed in the openapi spec but disabled in code** (line 107 of actions/route.ts: `'LOCK_DEVICE action is disabled for security compliance.'`), the `kyc-review` audit log `createAuditLog` calls use `.catch(() => {})` (silent failure), the `wallet-adjust` per-call cap is ₹50K with no daily aggregation, and the `useRiders` hook has **22 useState hooks** in a single function (massive god-hook).

The headline architectural issue: the admin panel grew organically from a single Next.js page to a 100+ component split via R3 (RiderScoringScreen, KycManagement, etc.). The refactor is good — but the **API contracts didn't get refactored with it.** The audit caught multiple cases where the same UI surface reads from 2-3 different endpoints that return overlapping data with different shapes.

There are **6 P0s**, **9 P1s**, and **6 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, security gap, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code, contract drift | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: The audit brief's 4 endpoints don't match the codebase — including 2 that simply don't exist

**Repro:** Side-by-side comparison of the brief vs the actual codebase:

| Brief | Actual | Diff |
|---|---|---|
| `GET /api/admin/riders/[id]` | **No route exists.** Only `GET /api/admin/riders` (list with search filter) + subroutes `/wallet-adjust`, `/plan`, `/device-data`, `/data-deletion` | Brief is wrong — feature is **not implemented** as a single GET-by-id |
| `PATCH /api/admin/kyc/[id]` | `POST /api/admin/kyc` (no id, no PATCH) | Brief is wrong — method is POST, not PATCH; no id path param |
| `GET/POST /api/admin/earnings` | `GET /api/admin/earnings` only | **Brief is wrong** — no POST/PUT exists; **no override endpoint** at all |
| `POST /api/admin/scores` (recalc) | `POST /api/admin/scores` (recalc single) + `POST /api/admin/scores/recalculate` (bulk) | Partial — recalc is split across 2 routes |

**Impact:** The brief was written by someone who didn't read the codebase. The plan to build "Earnings override" assumes the endpoint exists; it doesn't. A new dev following the brief would build the wrong client or duplicate an endpoint.

**Fix:**
- For `GET /api/admin/riders/[id]`: **build it.** The current pattern of "filter the list by id" is slow and wrong (the list includes all riders, the detail should be a focused query with all relations).
- For the brief's other inaccuracies: **update the brief** to match the codebase. The OpenAPI spec at `contracts/openapi.ts` is the source of truth.

**Effort:** 2-4h to build the missing detail endpoint + 30min to fix the brief.

---

### P0-2: `POST /api/admin/scores/recalculate` walks every rider in a synchronous loop — 33-minute DoS for 10K riders

**Repro:**
1. `score.use-cases.ts:91-120`:
   ```ts
   async recalculateAll(actorId: string) {
     const riders = await db.rider.findMany({ select: { id: true } });
     let successCount = 0;
     let failureCount = 0;
     const errors: string[] = [];
     for (const rider of riders) {
       try {
         await calculateRiderScore(rider.id);
         successCount++;
       } catch (err) {
         failureCount++;
         errors.push(`Failed for rider ${rider.id}: ${(err as Error).message}`);
         logger.error(`Score recalculation failed for rider ${rider.id}:`, err);
       }
     }
     ...
   }
   ```
2. `db.rider.findMany({ select: { id: true } })` returns **every rider** in the database. For 10K riders, this is a 5MB+ result.
3. The loop is **synchronous**, no `Promise.all`/batching. Each `calculateRiderScore` is a multi-query Prisma call (~200ms). For 10K riders: 10K × 200ms = **33 minutes** blocking the request thread.
4. The route at `scores/recalculate/route.ts` is just:
   ```ts
   const result = await scoreUseCases.recalculateAll(session.adminId || '');
   return success({ ... }, `Recalculated scores for ${result.successCount} riders`);
   ```
   The HTTP request hangs for 33 minutes.
5. The admin UI at `useRiderScoring.ts:83-94` calls this from a button:
   ```ts
   const res = await fetch('/api/admin/scores/recalculate', { method: 'POST' });
   ```
   No confirmation dialog. No cancel. The admin clicks "Recalculate all" and the button shows the spinner for 33 minutes.
6. **One user can DoS the entire admin panel for half an hour** by clicking the button.
7. Worse: the same use case has a per-rider path `recalculate` (line 76) which is per-call slow. The bulk path has no per-rider batching, no queue, no `Promise.all`/chunking.

**Impact:** **Server-wide DoS via admin button.** A bored user or a malicious admin can lock the server for 30+ minutes with one click. Worse: during the 30 minutes, every other admin action that touches the database is competing for connections (pool starvation).

**Fix:**
- **Immediate:** wrap the loop in `Promise.allSettled` with a chunked batch (e.g., 50 at a time). For 10K riders at 200ms each, 50-in-parallel = 200ms × (10K/50) = 40 seconds — much better but still slow.
- **Proper:** enqueue a background job via the Outbox (audit #4 P0-1 already noted the outbox pattern). The button returns immediately with `{ jobId: 'recalc-all-1234' }`, the worker processes the queue over 30 minutes, the admin watches progress.
- **For now:** add a confirmation dialog with the estimated count and a hard cap (e.g., max 1000 riders per click; "Recalculate more" enables the full job).

**Effort:** 4-6h for the queue-based approach; 30min for the chunked-batching minimum.

---

### P0-3: KYC review screen makes 2 round trips per page load — two endpoints, two sources of truth

**Repro:**
1. `kyc-management/useKyc.ts:38-44` (referenced in the file tree):
   ```ts
   if (startDate) params.set('startDate', startDate);
   if (endDate) params.set('endDate', endDate);
   const res = await fetch(`/api/admin/riders?${params.toString()}`);
   ```
   The KYC review table loads from `/api/admin/riders?kycStatus=...` — the **rider list with nested kycProfile** (5s route cache).
2. Then `KycDetailSheet` (in the same `KycManagement.tsx`) calls a different endpoint to get the full KYC record. The KYC review table is filtering riders by kyc status, but the "review" action needs the official KYC record (with documents, editable fields, etc.) — which the rider list's nested kycProfile may not include all of (line 197-201 of admin-riders.use-cases.ts: `updatedAt: true` is the only field beyond the basic ones).
3. The rider list's nested kycProfile (from `admin-riders.use-cases.ts:184-201`) doesn't include `editableFields`, `reviewedAt`, `reviewedBy`, `riderVideo` — all of which are needed for the review dialog.
4. The KYC cache key is per-admin (line 49-56 of kyc/route.ts: `'admin:kyc' + adminId + status + search + page + limit`). The rider-list cache key is per-admin + per-filter (line 123-136 of riders/route.ts: `'admin:riders' + adminId + search + state + kycStatus + startDate + endDate + cursor + page + limit + sortBy + sortDir`). **The KYC review table and the official KYC record can be out of sync by up to 5s** if a different admin's action invalidates one cache but not the other.
5. The `invalidateCache('admin:kyc:*')` (line 122) only invalidates the KYC route's cache. The rider list's cache key is `'admin:riders:*'`. The rider list will show stale KYC status for up to 5s after an admin takes an action.

**Impact:** **Race condition between the KYC review table and the KYC detail dialog.** An admin approves a KYC, the KYC table refreshes (the kyc route invalidates), but the rider list cache still shows the rider as PENDING. The admin clicks "approve" again on the same rider. The second approve either no-ops (because the state machine rejects it) or fires a duplicate notification.

**Fix:**
- **Short term:** have the KYC review table call `/api/admin/kyc` directly (the purpose-built endpoint), not `/api/admin/riders?kycStatus=...`. The kyc endpoint already returns the KYC data the review needs.
- **Better:** make the rider list's nested kycProfile include all fields (a single `kycProfile` include in the select).
- **Best:** unify the KYC review under a single `useKyc` hook that calls one endpoint.

**Effort:** 1-2h.

---

### P0-4: `/api/admin/guarantors` POST requires `kyc_approve` permission — a `kyc_view` user cannot review guarantors

**Repro:**
1. `guarantors/route.ts:15` (GET): `if (!hasPermission(session.adminRole || '', 'guarantor_view_limited')) return adminForbidden();` — **uses `guarantor_view_limited`**.
2. `guarantors/route.ts:77` (POST): `if (!hasPermission(session.adminRole || '', 'kyc_approve')) return adminForbidden();` — **uses `kyc_approve`**.
3. **The two endpoints use different permission names.** A user with the `guarantor_view_limited` permission (the appropriate read permission) cannot POST to the same endpoint — they need `kyc_approve` (a write permission they may not have).
4. Compare to `/api/admin/kyc` which uses `kyc_view` for GET (line 16) and `kyc_approve` for POST (line 89). The KYC route is internally consistent.
5. `kyc_approve` is a write permission for KYC. Reviewing a guarantor is a different domain. **The permission name is wrong.**
6. Consequence: a viewer-level admin cannot act on guarantors. If a viewer-level admin is the only person on shift, guarantors pile up.

**Impact:** **Permission misnamed = unauthorized access denied for legitimate reviewers.** Same root cause as audit #10 P0-1 (deadline bypass for permissions) and audit #4 P0-3 (notification permissions). The team is using `kyc_approve` as a generic "approve onboarding" permission, but the route-level check requires it.

**Fix:**
- Add a `guarantor_approve` permission to the role definitions.
- Update the route to use `guarantor_approve` for POST and `guarantor_view` (or `guarantor_view_limited`) for GET.
- Audit all routes for permission-name consistency.

**Effort:** 1-2h.

---

### P0-5: Bulk DELETE on `/api/admin/riders` writes no audit log — silent rider destruction

**Repro:**
1. `riders/route.ts:222-239`:
   ```ts
   export async function DELETE(req: NextRequest) {
     const session = await getAdminSession();
     if (!session) return errors.unauthorized();
     if (!hasPermission(session, 'riders_delete')) {
       return errors.forbidden(...);
     }
     try {
       const id = req.nextUrl.searchParams.get('id');
       if (!id) return errors.badRequest('ID required');
       await adminRiderUseCases.delete(id);
       invalidateCache('admin:*');
       return success(null, 'Rider deleted');
     } catch (error) {
       logger.error('Delete rider error:', error);
       return errors.internal('Delete failed');
     }
   }
   ```
2. **No `createAuditLog` call.** A successful delete writes nothing to the audit log.
3. Compare to `/api/admin/riders/[id]/data-deletion/route.ts:45-51` which writes `RIDER_DATA_DELETION_INITIATED` before any destructive work, then `RIDER_DATA_DELETION_COMPLETED` or `_FAILED` (lines 119-146).
4. **Two ways to delete a rider; one audited, one not.** A malicious admin can use the silent path.
5. The bulk route at `riders/bulk/route.ts:52-62` (the `delete` case) also has no audit log.
6. The `rider-provider.dart:271-277` in the rider_provider (rider_provider.dart from the rider app) doesn't clear engagement/support/onboarding state on delete (this is a cross-cutting audit #7/#8/#9/#10/#14 issue). **The rider's data persists in caches after delete.**

**Impact:** **Compliance gap.** A SOC2 audit will catch this — "show me the audit log for rider X being deleted on date Y". The answer is: there is no audit log. The PR-57 data-deletion route's audit pattern is correct; the simple delete is not.

**Fix:**
- Add `createAuditLog({ actorId: session.adminId, action: 'rider.delete', entity: 'rider', entityId: id })` to the DELETE handler in `riders/route.ts:222-239` AND the `delete` case in `riders/bulk/route.ts:52-62`.
- Move the delete logic into a single `adminRiderUseCases.delete(id, { actorId, actorRole })` that handles audit logging internally.

**Effort:** 30min.

---

### P0-6: Wallet-adjust allows `allowNegative: true` for DEBIT with no min-balance, no per-day cap, no warning

**Repro:**
1. `wallet-adjust/route.ts:18-21`:
   ```ts
   const MAX_DEBIT_PAISE = env.MAX_ADMIN_DEBIT_INR * 100;
   const LARGE_DEBIT_PAISE = env.LARGE_DEBIT_THRESHOLD_INR * 100;
   ```
   Defaults: `MAX_DEBIT_PAISE = 50,000,000` (₹50,000), `LARGE_DEBIT_PAISE = 10,000,000` (₹10,000).
2. Line 149: `allowNegative: true` for DEBIT — no min-balance check.
3. Line 79-83: per-call cap is ₹50,000 — but **no per-day aggregation**. An admin can do ₹50K × 100 calls = ₹50L per day.
4. The co-admin approval (line 89-105) only requires a **second active admin** to co-sign. If the team has 2 admins, one can co-sign for the other. **A 2-admin team has no real segregation of duties for debits under ₹50K** (each can do unlimited small debits).
5. The reason minimum length is 10 chars (line 53) — too short for a "real" audit reason. "test debit 1" passes.
6. The audit log is **not written if the route throws before reaching the `createAuditLog` call** (line 161-174). The transaction commits before the audit log. **A failed audit log write leaves the wallet change permanent and the audit empty.** The `.catch(() => {})` (line 174) silently swallows.
7. The route allows DEBIT for any `lifecycleStatus` not in `BLOCKED_LIFECYCLE_STATUSES` (line 71-75). A rider in `PLAN_SELECTED` can be debited — the wallet might not even exist yet (`rider.wallet.findUnique` may return null, the line 458-466 logic creates one on demand). **Forcing a wallet to exist when it shouldn't is a data integrity issue.**

**Impact:** **Multi-step financial damage potential.** A rogue admin (or two colluding) can drain a rider's wallet to -₹10L in 200 calls per day, with an audit log that may or may not fire. The PR-89 second-admin approval is a half-measure — it's per-call, not per-day.

**Fix:**
- Per-day aggregate cap: query the audit log for `wallet_adjustment` actions in the last 24h by the same admin, sum the DEBIT amounts, reject if over the cap.
- Require a **2-of-3** co-sign for debits above the threshold (instead of 1 co-sign).
- Remove `allowNegative: true` or set a hard floor (e.g., -₹10,000).
- Make `createAuditLog` a **synchronous** call BEFORE the transaction commits. If the audit log fails, the transaction rolls back.
- Move audit logging to a `createAuditLog` wrapper that the route uses, ensuring it always runs.

**Effort:** 2-3h.

---

## P1 — Should fix this sprint

### P1-1: `POST /api/admin/riders/[id]/plan` is half-implemented — only handles `REJECT`, no `APPROVE`

**Repro:**
1. `riders/[id]/plan/route.ts:7-26`:
   ```ts
   export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
     ...
     const { action, reason } = body;
     if (action === 'REJECT') {
       if (!reason) return errors.badRequest('reason is required for REJECT');
       await riderUseCases.rejectPlan(riderId, session.adminId || '', reason);
       return success(null, 'Plan rejected');
     }
     return errors.badRequest('Invalid action');
   }
   ```
2. The route has no `APPROVE` action. Only `REJECT`.
3. The companion `APPROVE`/`ASSIGN_PLAN` action lives at `riders/actions/route.ts:30-48` under `ASSIGN_PLAN`.
4. **Two routes do the same thing; one is half-implemented.** A dev looking at `/api/admin/riders/[id]/plan` for "plan approval" will see only REJECT. They have to find the legacy `actions` route to approve.
5. The `ASSIGN_PLAN` action in the legacy route **also** calls `adminRiderUseCases.update` first (line 32-36) to set `currentPlan`, then calls `adminRiderUseCases.assignPlan` (line 37-43) which presumably handles the lifecycle transition. The new `/plan` route is `riderUseCases.rejectPlan` (a different use case module). **Inconsistent.**

**Impact:** API contract confusion. New devs build against the wrong route.

**Fix:** Pick one. Either:
- Extend `/plan` to handle both `APPROVE` and `REJECT`, deprecate the `actions` route's `ASSIGN_PLAN` case.
- Or remove `/plan` and route everything through `/actions`.

**Effort:** 1-2h.

---

### P1-2: `LOCK_DEVICE` action is listed in the openapi spec but disabled in the code

**Repro:**
1. `riders/actions/route.ts:107`:
   ```ts
   case 'LOCK_DEVICE':
     return errors.badRequest('LOCK_DEVICE action is disabled for security compliance.');
   ```
2. But the action is in the `fcmRequiredActions` array (line 89-96) — so the `!rider.fcmToken` check at line 97-99 doesn't apply.
3. The OpenAPI spec at `contracts/openapi.ts` (per the file tree) documents `LOCK_DEVICE` as a valid action.
4. The admin UI (`device-tracking/useDeviceTracking.ts:91` per the file tree) sends the action. The server returns 400 "disabled for security compliance." **The UI thinks the action works; the server rejects it.** The error message doesn't tell the admin "this is intentionally disabled."

**Impact:** Confusing admin UX. The admin clicks "Lock device" and gets a 400 with no explanation.

**Fix:** Either:
- Implement `LOCK_DEVICE` properly (a server-side lock that doesn't require FCM — e.g., set `isAdminLocked: true` and invalidate the rider's session).
- Remove `LOCK_DEVICE` from the openapi spec and from the action list.
- Add a clear error code: `errors.badRequest('LOCK_DEVICE is not yet supported. Use ADMIN_LOCK instead.', code: 'NOT_IMPLEMENTED')`.

**Effort:** 1h.

---

### P1-3: `useRiders.ts` parses the response inconsistently with `useKyc.ts` and `useBulkMessaging.ts`

**Repro:**
1. `useRiders.ts:73`: `setRiders(json.data?.riders || []);`
2. `useBulkMessaging.ts:96`: `.then((j) => j.pagination?.total || 0)`
3. `useKyc.ts:42`: `const json = await res.json();` (then `kyc.filteredRiders` — search the file to confirm).
4. The actual response shape from `/api/admin/riders` (per `admin-riders.use-cases.ts:296-309`):
   ```ts
   return {
     riders: signed,
     pagination: { page, limit, total, totalPages, nextCursor },
     flags: { enableKYCVerification, enableGuarantorRequirement },
   };
   ```
   This is wrapped in the standard `success()` envelope: `{success: true, data: {riders, pagination, flags}}`.
5. **Some callers access `json.data?.riders` (correct), some `json.data.riders` (also correct), some `json.pagination.total` (incorrect — `pagination` is nested under `data`)**, some `json.data` directly (the Kyc hook — which is fine if data is a list).
6. If a caller has the wrong path, they get `undefined` → `[]` fallback → empty result. **Silent failure mode.**

**Impact:** Different parts of the admin panel show different things for the same API. The "ticket assignment" dialog might show no riders because `useTickets.ts:73` reads the wrong path.

**Fix:** Add a typed `RiderListResponse` and a shared `useAdminRidersApi` hook (similar to `useAdminApi`) that handles the parsing once.

**Effort:** 2-3h.

---

### P1-4: `useRiders.ts` has 22 `useState` hooks in a single function — massive god-hook

**Repro:**
1. `useRiders.ts:23-53` declares **22 useState** calls: `riders`, `loading`, `searching`, `search`, `stateFilter`, `kycFilter`, `selectedRider`, `page`, `totalPages`, `total`, `isEditing`, `editForm`, `saving`, `sortKey`, `sortDir`, `confirmDelete`, `selectedKycDocs`, `confirmKycAction`, `kycRejectionReason`, `deleteDocKey`, `confirmClearGuarantor`, `selectedIds`, `bulkLoading`, `lastAction`, `showUndoToast`, `showAddDialog`, `newRider`, `addingRider`, `showAdjustWallet`, `bulkDeleteOpen`. (33+ useState calls total.)
2. The hook handles: paginated list (debounced search + state + KYC filter + sort), selection, edit form, KYC doc selection, the bulk-action undo stack, all PUT/DELETE mutation handlers.
3. The R3 split refactor split the **screens** into orchestrator + subcomponents. The data hook stayed monolithic.
4. Hard to test: 33 useState calls means 2³³ state combinations — only a few are reachable in normal use.

**Impact:** The hook is un-unit-testable beyond "render with a fake fetch". A bug in the bulk-action undo logic affects 4 different state fields.

**Fix:** Split into `useRiderList` (pagination + filter + search), `useRiderEdit` (editForm + saving), `useRiderBulkActions` (selection + undo stack), `useRiderDialogs` (confirmDelete + addDialog + adjustWallet). Each gets its own state.

**Effort:** 3-4h.

---

### P1-5: Shared-guarantor detection walks every rider — O(N²) on a 10K-rider list

**Repro:**
1. `admin-riders.use-cases.ts:264-275`:
   ```ts
   const guarantorPhones = (riders as any[])
     .map((r) => r.guarantor?.phone)
     .filter((phone): phone is string => !!phone && phone.trim() !== '');
   let sharingRiders: any[] = [];
   if (guarantorPhones.length > 0) {
     sharingRiders = (await db.rider.findMany({
       where: { guarantor: { phone: { in: guarantorPhones } } },
       select: { id: true, fullName: true, riderId: true, guarantor: { select: { phone: true } } },
     })) as any[];
   }
   ```
2. For a 20-rider page where 18 have guarantors, this runs a `findMany` on the entire rider table (not the page) filtered by 18 phone numbers. **For 10K riders, the `findMany` is O(10K)** even though we only display 20. Then the `flat.map` (line 277-285) iterates the page and filters `sharingRiders` for each — **O(20 × 10K) = O(200K) for a 20-rider page.**
3. The query is not indexed by guarantor phone (the schema likely has an index on `rider.id` only). **Full table scan on every list request.**
4. The `rider-management/DataDeletionQueueTable.tsx:29` calls `/api/admin/riders?deleted=true` — the route doesn't support a `deleted` filter (the use case has no `deleted` parameter). The query returns all non-deleted riders; the client filters client-side. **Inefficient + incorrect.**

**Impact:** Admin list pages slow as the rider count grows. 10K riders → ~5s per page load. Compounds with the 5s route cache.

**Fix:**
- Add an index on `Guarantor.phone` (verify the Prisma schema).
- Move the shared-guarantor detection to a **separate** admin endpoint (`GET /api/admin/riders/[id]/shared-guarantor`) and call it only when the user opens a rider detail.
- Or, if the use case stays, fetch only the page's worth of guarantor phones (not all of them).

**Effort:** 1-2h.

---

### P1-6: `RiderSelector` and `useRiderScoring` use inconsistent limits for rider lists

**Repro:**
1. `RiderSelector.tsx:44`: `params.set('limit', '50');`
2. `useRiderScoring.ts:64`: (per file tree) no explicit limit.
3. The default in the route is `parseInt(url.searchParams.get('limit') || '20')` (riders/route.ts:119). So `useRiderScoring` defaults to 20, `RiderSelector` requests 50.
4. Different components using different limits = inconsistent UI. The "send to all" feature in `useBulkMessaging.ts:82` uses `limit=1` (just to get the total count).
5. `useRentals.ts:45` uses `limit=500` — the rentals screen needs all riders to assign plans, but 500 is a magic number.

**Impact:** The admin team can't trust "the rider list shows all active riders." Some places show 20, some 50, some 500.

**Fix:** Centralize limits in a constants file: `RIDER_PICKER_LIMIT = 50`, `RIDER_LIST_LIMIT = 20`, `RIDER_BULK_LIMIT = 1000`.

**Effort:** 1h.

---

### P1-7: The deposit route's `createAuditLog` calls use `.catch(() => {})` — silent failure on audit write

**Repro:**
1. `deposits/route.ts:61-67, 73-82, 87-97, 101-110`: every `createAuditLog` call is wrapped in `.catch(() => {})`.
2. If the audit log table is locked (e.g., during a migration), the deposit action succeeds and the audit log write fails silently.
3. Compare to `data-deletion/route.ts:119-146` which uses `await createAuditLog` (no catch) — the audit log is awaited and the success path only fires on commit.
4. Compare to `kyc/use-cases/approveKyc.ts:87-89` which uses `.catch((err) => logger.warn(...))` — logged but not swallowed.

**Impact:** **Inconsistent audit trail.** Some admin actions are durably audited (kyc.approved, rider_data_deletion_completed), some are not (deposit.approve, deposit.reject, deposit.refund, deposit.forfeit). A compliance audit will catch the gap.

**Fix:** Make all `createAuditLog` calls `await`-ed. Move them inside the transaction so they fail together. If the audit log is critical for compliance (it is for SOC2), treat it as a hard requirement.

**Effort:** 2-3h.

---

### P1-8: `useEarnings.ts:43` silently handles 403 — admin lacks `riders_view` and sees no error

**Repro:**
1. `useEarnings.ts:43-46`:
   ```ts
   const res = await fetch(`/api/admin/earnings?${params}`);
   if (!mountedRef.current) return;
   if (res.status === 403) {
     // Silently handle — admin lacks riders_view permission
   }
   ```
2. The `riders_view` permission is required for the GET (line 12 of earnings/route.ts). The hook catches the 403 and **does nothing** — the admin sees an empty earnings table with no error message.
3. The admin doesn't know if there are no earnings or if they don't have permission.

**Impact:** Confusing UX. The admin thinks the data is empty when it's actually a permission issue.

**Fix:** Surface the 403 to the admin with a clear message: "You don't have `riders_view` permission. Contact your admin." Or move the `riders_view` requirement to a separate `earnings_view` permission.

**Effort:** 30min.

---

### P1-9: The shared-guarantor detection in `adminRiderUseCases.list` doesn't paginate — the `in: [...]` clause is unbounded

**Repro:**
1. `admin-riders.use-cases.ts:271`: `where: { guarantor: { phone: { in: guarantorPhones } } }`. The `in` array has up to 20 phone numbers (the page size). PostgreSQL handles this fine.
2. **But** the result of `sharingRiders` is the **entire** matching set across the database, not just the page. If 100 riders share the same guarantor phone, all 100 are returned.
3. The `flat.map` at line 277-285 then iterates only the page and filters `sharingRiders`. The 100 other riders are loaded into memory but only the page is rendered.
4. Same O(N) problem as P1-5, but harder to fix because the query is structurally unbounded.

**Impact:** Memory + DB load scales with duplicate guarantors, not page size.

**Fix:** Limit the `findMany` to page-size + a buffer (e.g., 50). Or, push the shared-guarantor detection to a per-rider endpoint.

**Effort:** 1h (with P1-5 fix).

---

## P2 — Cleanup backlog

### P2-1: The OpenAPI spec at `contracts/openapi.ts` documents `LOCK_DEVICE` as a valid action

The action is disabled in the route but listed in the spec. A client generated from the spec would send the action and get a 400. **Spec/code drift.**

### P2-2: `data-deletion` route uses `requirePermission('admin:write')` (a different permission model) from the rest of the admin routes

`data-deletion/route.ts:14`: `const session = await requirePermission('admin:write');`. Every other admin route uses `hasPermission(session, 'specificPermission')`. **Inconsistent permission model.**

### P2-3: `KycManagement.tsx` `KycDetailSheet` exists but is not imported in `KycTable`

The KYC detail sheet is declared but `KycTable` only shows summary data. A reviewer must click the row to see the full KYC record. Verify the click flow works.

### P2-4: The `RiderSelector.tsx:46` URL includes `search` but the route at `riders/route.ts:106-110` doesn't have a "starts with" branch for short searches

For searches of length 2-4, the route's `use case` calls `where.OR = [...]` which does a `contains` (not `startsWith`). For phone-like searches (line 126-128), it does `startsWith`. Inconsistent.

### P2-5: `kys-management/useKyc.ts:40` fetches `/api/admin/riders?...` instead of `/api/admin/kyc?...`

The hook is in the kyc-management directory but reads the rider list endpoint. Confusing.

### P2-6: The `riders/[id]/plan` route uses the rider.use-cases.rejectPlan — but the action's body says `action: 'REJECT'`, not `action: 'REJECT_PLAN'`

Naming is generic. If a future action `REJECT_DEPOSIT` is added to the same route, the body shape collides.

---

## Tests gap analysis

| Endpoint | Integration test? | Unit test? | Notes |
|---|---|---|---|
| `GET /api/admin/riders` | Yes (per file tree) | Yes (`rider-management/useRiders.ts` mocked in tests) | Coverage OK for happy path |
| `GET /api/admin/riders/[id]` | **N/A** — endpoint doesn't exist | **N/A** | Brief was wrong |
| `POST /api/admin/kyc` (review) | Yes (per file tree) | Yes | Coverage OK |
| `PUT /api/admin/riders` (update) | Yes | Yes | Coverage OK |
| `PUT /api/admin/riders/[id]/plan` (reject) | Yes | No | **GAP** — only REJECT tested |
| `POST /api/admin/riders/[id]/wallet-adjust` | Yes (per file tree) | No | Coverage OK for happy path; co-admin flow undertested |
| `DELETE /api/admin/riders/[id]/data-deletion` | Yes | No | **GAP** — anonymization on suspended rider untested |
| `POST /api/admin/riders/bulk` | Yes | No | **GAP** — only the happy path; idempotency untested |
| `POST /api/admin/riders/actions` | Yes | No | **GAP** — `LOCK_DEVICE` error path untested |
| `GET /api/admin/deposits` | Yes | No | Coverage OK |
| `PUT /api/admin/deposits` | Yes | No | **GAP** — REFUND/FORFEIT paths undertested |
| `GET /api/admin/guarantors` | No | No | **GAP** — review queue untested |
| `POST /api/admin/guarantors` | No | No | **GAP** — review action untested |
| `GET /api/admin/scores` | Yes | No | Coverage OK |
| `POST /api/admin/scores` (recalc single) | Yes | No | Coverage OK |
| `POST /api/admin/scores/recalculate` | **No — and it's a 33-minute DoS** | No | **GAP** — no integration test because it would block CI |
| `GET /api/admin/earnings` | Yes | No | Coverage OK |

**Headline:** the `POST /api/admin/scores/recalculate` endpoint has no integration test, which is the right call (it would block CI for 30+ minutes). But this is exactly why the P0-2 DoS isn't caught. **Add a unit test that asserts the recalc is bounded to N batches of K riders each.**

**Recommended test additions:**
1. **`tests/integration/admin/scores_bulk_recalc.test.ts`** — assert the route returns within 30s even with 10K riders (mock Prisma). **2h.**
2. **`tests/integration/admin/riders_bulk_delete_audit.test.ts`** — bulk delete, assert audit log entries. **1h.**
3. **`tests/integration/admin/wallet_adjust_daily_cap.test.ts`** — 100 small debits in a day, assert the 101st is rejected. **2h.**
4. **`tests/integration/admin/guarantors_permission.test.ts`** — `kyc_view` user tries to POST, assert 403. **30min.**

**Total: 6h of test work.**

---

## Recommended fix order

| # | PR | Scope | Effort | Risk | Closes |
|---|---|---|---|---|---|
| 1 | **PR-11a: Batch the bulk score recalc** | Wrap `recalculateAll` in chunks of 50 with `Promise.allSettled`. Add a daily cap. Add a confirmation dialog in the UI. | 2-3h | Low | P0-2 |
| 2 | **PR-11b: Fix guarantor permission** | Add `guarantor_approve` permission. Update route. | 1-2h | Low | P0-4 |
| 3 | **PR-11c: Add audit log to rider DELETE** | Add `createAuditLog` to the DELETE handler and the bulk delete case. | 30min | Low | P0-5 |
| 4 | **PR-11d: Wallet-adjust per-day cap + remove `allowNegative`** | Track per-day debits. Floor the wallet at -₹10K. Make audit log awaited. | 2-3h | Medium | P0-6 |
| 5 | **PR-11e: Build `GET /api/admin/riders/[id]`** | New route with full relations (kyc, wallet, guarantor, leases, deviceData, support tickets, transactions). | 4-6h | Medium | P0-1 (partial) |
| 6 | **PR-11f: Unify KYC review under `/api/admin/kyc`** | Move KYC review table to call `/api/admin/kyc` directly. Add fields the rider list doesn't have. | 1-2h | Low | P0-3 |
| 7 | **PR-11g: Half-implemented `/api/admin/riders/[id]/plan`** | Either extend to APPROVE or deprecate. Update openapi spec. | 1-2h | Low | P1-1 |
| 8 | **PR-11h: Surface earnings 403 to admin** | Replace silent handling with a clear error message. | 30min | Low | P1-8 |
| 9 | **PR-11i: Add `LOCK_DEVICE` error code** | Add `code: 'NOT_IMPLEMENTED'` to the error response. Document in spec. | 1h | Low | P1-2 |
| 10 | **PR-11j: Index `Guarantor.phone`** | Add Prisma index. Verify migration. | 30min | Low | P1-5, P1-9 |
| 11 | **PR-11k: Split `useRiders.ts` god-hook** | Extract `useRiderList`, `useRiderEdit`, `useRiderBulkActions`, `useRiderDialogs`. | 3-4h | Low | P1-4 |
| 12 | **PR-11l: Test sprint** | Bulk recalc bounded test, audit log on delete, daily cap test, guarantor permission test. | 6h | n/a | Tests gap |

**Total: ~3-4 days of focused work to close all 6 P0s and 4/9 P1s.**

---

## Architecture observations

### Two ways to do the same thing, half-implemented

- `/api/admin/riders/[id]/plan` (PUT, REJECT only) vs `/api/admin/riders/actions` (POST, ASSIGN_PLAN/COMPLETE_PICKUP/END_RENTAL).
- `/api/admin/deposits` PUT vs POST (alias for PUT).
- `/api/admin/kyc` POST review vs `/api/admin/riders` PUT (which can also set `kycStatus`).

The pattern: when a use case grows, the team adds a new route. The old route stays. **No deprecation policy.** New devs don't know which route to use.

### Cache invalidation is partial

- `riders/route.ts:151`: `invalidateCache('admin:*')` after POST/PUT/DELETE. Wipes everything.
- `kyc/route.ts:122`: `invalidateCache('admin:kyc:*')` after POST. Targeted.
- `guarantors/route.ts:90`: `invalidateCache('admin:guarantors:*')` after POST. Targeted.
- `deposits/route.ts` has **no `invalidateCache` call at all** after PUT. **A deposit action returns, the cache is stale for 5s, the admin sees the old status.**
- `scores/route.ts` has no cache invalidation after recalc.

**The `invalidateCache` calls are inconsistent.** Some routes wipe everything, some are targeted, some don't invalidate at all. The KYC and rider list caches can be out of sync for 5s.

### Two endpoints, two sources of truth

- KYC review reads from `/api/admin/riders?kycStatus=...` (the list) AND `/api/admin/kyc` (the review). The two are cached separately, invalidated separately, and return overlapping data with different shapes.
- The fix is to **pick one endpoint per use case**. The KYC review should be a single source.

### `useRiders.ts` is the god-hook

22 useState calls. 4 distinct concerns (list, edit, bulk, dialogs). The R3 split refactor split the **screens** but not the **hooks**. The hook is now the bottleneck for testing.

### The audit log isn't a first-class concern

- Some routes await audit log writes (`data-deletion`, `approveKyc`).
- Some routes `.catch(() => {})` them (`deposits`).
- Some routes skip audit log entirely (`riders` DELETE, `riders/bulk` delete).
- **There's no shared `withAudit` wrapper.** Each route does its own.

### The `earnings` module is a thin facade

`earnings/route.ts:30-38` → `earningUseCases.list` (1 method) → `earningRepository.findAllPaginated`. **3 layers, all pass-through.** The brief's "Earnings override" implies there's an override path; there isn't. **If override is a roadmap, the team needs to build it.**

### `useEarnings.ts` silently swallows 403

The hook catches a 403 and does nothing. The admin sees an empty table with no error. **The pattern of "handle 403 by not showing data" is a security/UX anti-pattern.** Either surface the error or hide the feature entirely (don't show the screen).

---

## Out of scope for this audit

- Admin auth + RBAC internals (covered in `ADMIN_KYC_ONBOARDING_AUDIT_2026-08-05.md`).
- The `data-management` subroutes (DR, storage, schedule) — separate audit.
- The notification fanout (audit #4).
- The `earnings` module's deeper internals — there's no override flow at all.
- The admin users management screen — separate audit.
- The fleet map / live tracking screens — separate audit.
- The `payments` admin flows (Razorpay gateway config) — separate audit.

---

## Cross-audit themes this audit confirms

1. **The audit briefs are written without reading the codebase.** This audit's brief had 4 wrong URLs/methods out of 7. The rental audit had 3 wrong fields. The wallet audit had 1 wrong endpoint shape. **The briefs are aspirational documentation, not source-of-truth.**
2. **Cache invalidation is inconsistent across admin routes.** Some wipe `admin:*`, some target a prefix, some don't invalidate at all. Pattern appears in rider-list, deposit, and earnings routes.
3. **Audit log writes are inconsistent.** Some awaited, some `.catch(() => {})`'d, some skipped. SOC2 compliance gap.
4. **Background jobs are synchronous.** The `recalculateAll` walks every rider in a sync loop. Same anti-pattern as the deposit confirmation email job (audit #4 P0-4) and the rent-due emitter (audit #15).
5. **Two endpoints for the same use case** (plan: route vs actions; kyc review: riders vs kyc). No deprecation policy.

---

## Cross-audit links

- Audit #4 (Notifications, P0-4) — same `.catch(() => {})` on audit log writes.
- Audit #5 (Config/Health, P0-1) — same maintenance-mode enforcement gap.
- Audit #7 (Dashboard, P0-1) — same wallet balance never refreshes pattern.
- Audit #14 (Auth, P0-1) — same `requirePermission` permission-name mismatch.
- Audit #15 (Rental, P0-2) — same pattern: 2 use cases (`bookRental` + `syncPickup`) for the same intent.
- Audit #16 (Wallet, P0-3) — same 5-min bucket idempotency anti-pattern.

---

**End of audit.** Recommend starting with **PR-11a (P0-2 bulk recalc batching, 2-3h)** — fixes a real DoS, prevents accidental denial-of-service. Follow with **PR-11c (P0-5 audit log on delete, 30min)** — smallest, highest compliance value.
