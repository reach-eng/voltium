# Rider App Flows Audit — Referrals, Rewards & Offers (Flutter → API)
**Date:** 2026-08-05
**Scope:** `flutter/lib/features/referrals/`, `flutter/lib/features/rewards/`, `flutter/lib/services/referral_service.dart`, `flutter/lib/models/reward_model.dart`; `web/src/app/api/rider/{referral,referrals,rewards,offers}/`, `web/src/server/modules/{referrals,rewards,offers}/`, `web/prisma/schema.prisma` (Offer / Reward models).
**Audit type:** Cross-stack Flutter ⇄ API contract + dead-code + currency/identity drift.
**Total findings:** 9 P0 · 19 P1 · 24 P2 · 21 P3 · 11 test gaps · ~700 lines of dead code.

---

## 0. TL;DR

The Referrals / Rewards / Offers feature is the most fragmented rider-facing surface in the app:

- **Two parallel referral systems** — server-issued code in `Rider.referralCode` (used by `ReferralScreen` via `riderProvider.referralCode`) **and** a 245-line offline-only `ReferralService` in `flutter/lib/services/referral_service.dart` that no production code path calls.
- **Three "rewards" concepts colliding** — the dashboard's `rider.totalRewardPoints` (integer counter), the per-rider `Reward` Prisma table (transactional log), and the admin-side `rewardUseCases.list/award` (manual award). Flutter `RewardsScreen` reads the dashboard counter, **never the rewards endpoint**, and the rewards endpoint **never the dashboard counter**.
- **The offers endpoint exists but is never called** — `getRiderOffers()` lives in `api_client.dart:383` with zero production callers; the corresponding Flutter `OfferCard` / "Promotions" tab does not exist in the rider app.
- **Money is wrong in 3 places** — `REWARD_PER_REFERRAL = 500` (rupees) is hardcoded in `referral.use-cases.ts:15`, but the actual transaction writes `bonusPaise` from `setting:referralBonus` (paise, default 20000 = ₹200). The admin referrals UI shows `totalEarnings: activeRiders * 500` while the wallet only credits ₹200. **Riders see 2.5× less than the admin UI promises.**
- **Tier thresholds are hardcoded in Flutter** (Bronze<500, Silver<2000, Gold) with no backend source of truth.
- **No "redeem reward" endpoint** — `RewardsScreen` always renders the "No rewards unlocked yet" empty state; there is no `POST /api/rider/rewards/redeem`.
- **The rewards `findAllPaginated` runs without auth scoping** — `reward.repository.ts:4` is an admin-list query, but the rider endpoint hits `riderUseCases.getRewards`. Two different code paths with similar names; a future engineer could easily route them to the wrong one.
- **Referral code display has no fallback** — if `rider.referralCode` is `null` (some legacy sign-ups), Flutter renders the literal string `"VOLTIUM-XXXX"` and posts it to the share URL. The share text leaks the placeholder to the recipient.

**The single highest-blast-radius fix** (15 min, P0): align the hardcoded `REWARD_PER_REFERRAL = 500` in `referral.use-cases.ts:355, 380, 211-212` with the actual `setting:referralBonus` value. This stops the admin UI from showing a 2.5× inflated payout and stops new engineers from copying the wrong constant.

---

## 1. Files audited

### Backend (Next.js / Prisma)
- `web/src/app/api/rider/referral/route.ts` (18 lines) — `GET /api/rider/referral` → `getReferralInfo(riderDbId)` → `{referralCode, referredBy, referredUsers[]}`
- `web/src/app/api/rider/referrals/route.ts` (21 lines) — `GET /api/rider/referrals` → `getReferrals(riderDbId)` → `{referralCode, stats, referrals[]}` (404 if no code)
- `web/src/app/api/rider/rewards/route.ts` (21 lines) — `GET /api/rider/rewards` → `riderUseCases.getRewards(riderDbId)` → `{rewards[], totalPoints, thisMonthPoints, currentStreak}`
- `web/src/app/api/rider/offers/route.ts` (16 lines) — `GET /api/rider/offers` → `offerUseCases.getActiveSponsored()` → `{offers[]}` (no riderId)
- `web/src/server/modules/referrals/referral.use-cases.ts` (384 lines)
- `web/src/server/modules/rewards/reward.use-cases.ts` (32 lines, admin-only)
- `web/src/server/modules/rewards/reward.repository.ts` (63 lines, admin-only)
- `web/src/server/modules/offers/offer.use-cases.ts` (76 lines)
- `web/prisma/schema.prisma:683-696` (Offer model), `:716-725` (Reward model), `:202-203` (referralCode / referredBy)

### Frontend (Flutter)
- `flutter/lib/features/referrals/presentation/screens/referral_screen.dart` (313 lines)
- `flutter/lib/features/referrals/widgets/referral_card.dart` (368 lines — DEAD)
- `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart` (331 lines)
- `flutter/lib/features/rewards/domain/entity.dart` (45 lines — DEAD)
- `flutter/lib/services/referral_service.dart` (245 lines — DEAD)
- `flutter/lib/models/reward_model.dart` (22 lines — DEAD), `reward_model.g.dart` (generated — DEAD)
- `flutter/lib/core/network/generated/api_client.dart:382-422` — typed methods
- `flutter/lib/core/network/generated/api_models.dart:1431-1448` — `AwardRewardRequest` (admin-only, dead in rider)
- `flutter/lib/services/voltium_api_service.dart:191, 197` — `fetchRewards()`, `fetchReferrals()`
- `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart:117-147` — the only production caller of `fetchRewards` / `fetchReferrals`
- `flutter/lib/models/rider_model.dart:172-174, 254-255, 624-625` — `referralCode` and `totalRewardPoints` on the rider model

### Tests
- `flutter/test/features/referrals/presentation/screens/referral_screen_test.dart` (20 lines — golden only)
- `flutter/test/rewards/referrals_test.dart` (67 lines — render-only)
- `flutter/test/widgets/referral_card_golden_test.dart` — DEAD widget snapshot
- `flutter/test/services/referral_service_test.dart` — DEAD service
- `flutter/test/rewards/rewards_screen_test.dart` (10 lines — render-only)
- `flutter/test/features/rewards/presentation/screens/rewards_screen_test.dart` (20 lines — golden only)
- `web/tests/integration/rewards/referrals.test.ts` (73 lines — 4 tests, only `/referral` + `/referrals` GETs; **no rewards or offers coverage**)
- `web/tests/unit/auth-self-referral.test.ts`, `auth-referral-exists.test.ts` — auth-time, not rider-time
- `web/tests/unit/workers/referral-reward.job.test.ts` — job path, not endpoint

---

## 2. Cross-stack P0 findings (security / correctness / data integrity)

### P0-1 — Admin referrals UI shows 2.5× the actual reward
**Severity:** P0 (user-trust + financial mis-reporting)
**Files:**
- `web/src/server/modules/referrals/referral.use-cases.ts:15` — `const REWARD_PER_REFERRAL = 500;`
- `web/src/server/modules/referrals/referral.use-cases.ts:211-212` — `earned: isActive ? REWARD_PER_REFERRAL : 0, potential: !isActive ? REWARD_PER_REFERRAL : 0,`
- `web/src/server/modules/referrals/referral.use-cases.ts:355` — `earningForReferrer: isActive ? 500 : 0,`
- `web/src/server/modules/referrals/referral.use-cases.ts:380` — `totalEarnings: activeRiders * 500,`
- `web/src/server/modules/referrals/referral.use-cases.ts:89` — `const bonusPaise = parseInt(settingVal || '20000');` (the actual wallet credit, 20000 paise = ₹200)

**Bug:** The admin referrals API returns `totalEarnings: activeRiders * 500` and per-row `earningForReferrer: 500`. The wallet ledger credits the referrer `bonusPaise` (default ₹200). The two values disagree by 2.5×.

When an operator opens `/admin/referrals`, they see "Total Earnings: ₹12,500" for 25 active referrals. The actual wallet ledger shows ₹5,000. They will assume the difference is "pending payout" or "tech debt" and try to reconcile — sending 25 × ₹500 = ₹12,500 worth of adjustment credits to riders who already got ₹200.

**Fix shape (5 min):**
```ts
// Replace 500 with the same source-of-truth the wallet uses.
const bonusSettingPaise = parseInt(getCachedResponse('setting:referralBonus') || '20000');
const REWARD_PER_REFERRAL_RUPEES = bonusSettingPaise / 100;
```
Or, better: change `REWARD_PER_REFERRAL` from "rupees-as-int" to a `paise` value and divide by 100 at the formatter layer (consistent with the rest of the codebase).

**1-PR scope, 1 file, 4 line edits.** Audit ticket #84.

---

### P0-2 — `getRiderOffers()` is dead code; offers endpoint is unreachable from the rider app
**Severity:** P0 (architecture — confirms a shipped-but-unwired feature)
**Files:**
- `flutter/lib/core/network/generated/api_client.dart:382-385` — `getRiderOffers()` exists, no callers
- `web/src/app/api/rider/offers/route.ts` — endpoint exists, **only callable from non-rider clients**
- `web/src/server/modules/offers/offer.use-cases.ts:69-75` — `getActiveSponsored()` runs `db.offer.findMany()` with no rider filter, no limit, no pagination

**Bug:** Grepping the entire rider codebase for `getRiderOffers` returns only the declaration. There is no `OfferScreen`, no `PromotionsScreen`, no `RewardsScreen` "available offers" section. The route was added (likely as an admin symmetry) but never wired into any screen.

Meanwhile, the `getActiveSponsored()` implementation has **no `take` limit**:
```ts
async getActiveSponsored() {
  const now = new Date();
  return db.offer.findMany({
    where: { isActive: true, isSponsored: true, validUntil: { gte: now } },
    orderBy: { createdAt: 'desc' },
  });
}
```
If a future engineer wires the endpoint into the rider app without adding `take: 50`, an admin who creates 1,000 promo offers will ship a multi-MB JSON to every rider on every dashboard load.

**Fix shape (1 hour):**
1. Add `take: 50` to `getActiveSponsored` (defensive, even if the endpoint stays unused).
2. Either delete `getRiderOffers()` from `api_client.dart` and `GET /api/rider/offers` route, **or** build a 1-screen "Promotions" tab and wire it. Decision required from product.

Audit ticket #85. Do **not** ship PR-7 / 8 / 9 (wallet / kyc reward integrations that promise "see your offers") until this is decided.

---

### P0-3 — Reward endpoints return different shapes from the rider dashboard, and Flutter `EngagementProvider` silently desyncs
**Severity:** P0 (silent data corruption in state)
**Files:**
- `web/src/app/api/rider/rewards/route.ts:13-14` — returns `riderUseCases.getRewards(riderDbId)` (rider-specific) on 404
- `web/src/server/modules/riders/rider.use-cases.ts:332-367` — `getRewards()` returns `{rewards[], totalPoints, thisMonthPoints, currentStreak}`
- `web/src/server/modules/rewards/reward.use-cases.ts:7-13` — `list()` is **admin-only**, returns `{...paginatedFindAll, summary}` (totally different shape, has `summary.uniqueRiders`, `summary.thisMonthCount`)
- `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart:117-134` — reads `data['totalPoints']`, `data['currentStreak']`, `data['rewards']`

**Bug:** There are two unrelated `getRewards` functions:

1. `riderUseCases.getRewards(riderDbId)` — returns the rider's own reward log + aggregates. **This is what `GET /api/rider/rewards` actually calls.** ✅
2. `rewardUseCases.list({search, page, limit})` — returns a global paginated list of every rider's rewards for the admin table. **Never called by the rider endpoint.** ❌

The naming collision has already caused one near-miss: the `reward.repository.ts:42-58 getSummary()` does `db.reward.findMany({select:{points:true,createdAt:true,riderId:true}})` (no `where`, no `riderId` filter). If a future engineer routes the rider endpoint through `rewardUseCases.list` thinking it's the right helper, every rider will get a paginated dump of every other rider's reward history — and the `getSummary()` call will materialize the entire `rewards` table into Node memory.

The `riderUseCases.getRewards` path itself is OK shape-wise, but **Flutter only reads `totalPoints`, `currentStreak`, and `rewards[]`** — `thisMonthPoints` is dropped. That's fine; not a bug. But `RewardsScreen` doesn't even read this state; it reads `rider?.totalRewardPoints` from the rider model (which the dashboard endpoint sets). So **the rewards endpoint is called by `EngagementNotifier._fetchAll`, the response is mapped into `EngagementState`, and the screen ignores the state entirely.**

**Fix shape (2 hours, 1 PR):**
1. Rename `rewardUseCases` → `adminRewardUseCases` to break the naming collision.
2. Delete the dead `EngagementNotifier.refreshRewards` call (or wire `RewardsScreen` to it).
3. Add a vitest asserting that `riderUseCases.getRewards` returns the documented shape, and that no other `getRewards` exists.

Audit ticket #86.

---

### P0-4 — Two parallel reward systems in Flutter: `RewardItem` (api_models) vs `RewardEntity` (features/rewards/domain)
**Severity:** P0 (dead-code mask; engines have been tricked before)
**Files:**
- `flutter/lib/core/network/generated/api_models.dart:1431-1448` — `AwardRewardRequest` (admin-only, but a generated client method exists)
- `flutter/lib/core/network/generated/api_client.dart` — grep for `awardReward` returns **0 results** (no client method)
- `flutter/lib/features/rewards/domain/entity.dart:2-24` — `RewardEntity` (id, title, points, createdAt) — UNUSED, tested at `flutter/test/features/rewards/domain/reward_entity_test.dart` (likely broken since the test file is in a folder with no `*.dart` test source — let alone re-confirm)
- `flutter/lib/models/reward_model.dart:1-22` — `RewardItem` (same shape) — UNUSED outside `engagement_provider.dart`'s `state.rewards: List<RewardItem>`
- `flutter/lib/models/reward_model.g.dart` — generated for `RewardItem` (json_serializable)

**Bug:** Three "Reward" classes, all with the same field shape, none of them in active use. `RewardItem` is referenced only in `engagement_provider.dart:27, 47, 53, 128` and the generated `reward_model.g.dart`. `EngagementState.rewards: List<RewardItem>` is set in `refreshRewards` but **never read by any UI** (the `RewardsScreen` reads `rider.totalRewardPoints` only).

The legacy `ReferralCode` / `PromoCode` / `ReferralService` triplet in `flutter/lib/services/referral_service.dart` (245 lines) is a 4th parallel implementation: stores referral codes + promo codes in `SharedPreferences`, generates them with `Random.secure()`, and seeds 2 hardcoded promos (`WELCOME50`, `FLAT100`). It is **not instantiated anywhere in production** — a search of `import '...referral_service.dart';` returns only the test file.

**Fix shape (30 min, 1 PR):**
1. Delete `flutter/lib/services/referral_service.dart` (245 lines).
2. Delete `flutter/lib/models/reward_model.dart` + `.g.dart` (replaced by `RewardItem` in api_models, which is also unused but at least lives in the right place).
3. Delete `flutter/lib/features/rewards/domain/entity.dart` (45 lines).
4. Delete the matching test files.

Audit ticket #87.

---

### P0-5 — Tier thresholds hardcoded in `RewardsScreen` with no backend source of truth
**Severity:** P0 (consumer-protection — visible number changes silently)
**Files:**
- `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:41-46`
```dart
final currentTier =
    points < 500 ? 'Bronze' : (points < 2000 ? 'Silver' : 'Gold');
final nextTierThreshold =
    points < 500 ? 500 : (points < 2000 ? 2000 : 5000);
```
- `web/src/server/modules/referrals/referral.use-cases.ts:15` — `REWARD_PER_REFERRAL = 500` (rupees, not points)
- `prisma/schema.prisma:716-725` — `Reward.points: Int` (no enum, no tier table)

**Bug:** Three magic numbers (500, 2000, 5000) hardcoded in the UI for what is presented as a "tier system". If marketing decides to change Silver to 1500, marketing has no UI to do it; only a Flutter release. If they want to add a "Platinum" tier, they can't.

Also, **the tier is computed from `rider.totalRewardPoints`, but the actual reward transactions are recorded in `prisma.reward.points` (whose unit is rupees / paise / arbitrary integer — see P0-1 confusion)**. The dashboard `totalRewardPoints` field is set in `rider.use-cases.ts` (presumably from `db.reward.aggregate({_sum:{points:true}})`), so a rider with 5 successful referrals would see 5 × `bonusPaise / 100` ≈ 1000 points → Silver tier. But the `RewardsScreen` "tier" calculation is in `points`, not rupees. **No one can tell if "500 points" means 500 rupees, 500 paise, 500 transactions, or 500 referrals** without reading the SQL.

**Fix shape (4 hours, 1 PR):**
1. Add a `setting:tierBronze` / `tierSilver` / `tierGold` to `settings.registry.ts`.
2. New endpoint `GET /api/rider/rewards/tier` returns `{currentTier, nextTier, nextThreshold, progress, pointsToNext}`.
3. `RewardsScreen` reads that endpoint instead of computing locally.
4. Backend uses the **same** point value as the rest of the system (resolve the unit confusion in P0-1 first).

Audit ticket #88.

---

### P0-6 — No "redeem reward" endpoint; `RewardsScreen` always shows the empty state
**Severity:** P0 (feature gap — riders cannot spend points)
**Files:**
- `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:264-325` — hardcoded "No rewards unlocked yet" empty state
- `web/src/app/api/rider/rewards/route.ts` — `GET` only, no `POST`
- `web/prisma/schema.prisma:716-725` — `Reward` model has no `redeemedAt`, no `status`, no `catalogId`

**Bug:** The `Reward` Prisma table is purely an append-only log of "this rider got N points for reason X". It has no catalog, no redemption concept, no status field. `RewardsScreen` displays a list of unlocked rewards — but the only "list" available to render is the same append-only log (id, title, points, createdAt). The "Available Rewards" section therefore can never show a usable item; the empty state is the only honest output.

The product promise — "Bronze/Silver/Gold tier with unlockable rewards" — is unreachable without:
- a `RewardCatalog` model,
- a `RewardRedemption` model,
- a `POST /api/rider/rewards/redeem` endpoint,
- a wallet debit use-case that calls `walletLedgerService.debit({purpose: 'REWARD_REDEMPTION'})`.

This is **the most expensive P0 in the file** if the feature is meant to ship in the next release. It is also the only one that is feature-shaped rather than bug-shaped.

**Fix shape (2 days, 1 PR — and an architecture decision):**
- Decide if rewards are wallet credits (transfer to top-up balance) or external (Amazon voucher, etc.).
- If wallet: extend `Reward` with `redeemedAt` + `redeemedAsTransactionId`, add `POST /api/rider/rewards/:id/redeem`, debit wallet.
- If external: add `RewardCatalog`, `RewardOrder`, integration stub.

Audit ticket #89. Block PR-7 (wallet milestones) until this decision lands.

---

### P0-7 — Referral code shown in `ReferralScreen` is sourced from `riderProvider`, not the server endpoint — and falls back to the literal string `"VOLTIUM-XXXX"`
**Severity:** P0 (privacy leak of placeholder + share text reveals nothing was generated)
**Files:**
- `flutter/lib/features/referrals/presentation/screens/referral_screen.dart:73-74`
```dart
final rider = ref.watch(riderProvider.select((p) => p.rider));
final referralCode = rider?.referralCode ?? 'VOLTIUM-XXXX';
```
- Same file, line 281:
```dart
'Join Voltium EV Mobility! Use my referral code $referralCode to earn bonus reward points on your first ride: https://voltium.app/ref/$referralCode',
```

**Bug:** If a rider's `referralCode` is null (legacy signup, DB backfill that skipped the column, or the dashboard endpoint that returns `rider.referralCode ?? <client-generated>` per the 13th audit), the Flutter screen shows the literal string `"VOLTIUM-XXXX"` and the user can tap "Share Code" — which produces a share message containing `VOLTIUM-XXXX`. Anyone who receives that message will type `VOLTIUM-XXXX` as their referral code at signup, and the server's `findUnique({where:{referralCode:'VOLTIUM-XXXX'}})` will return null. No harm done (server rejects), but the rider gets no credit and has no idea why.

Per the 13th dashboard audit, the `rider.referralCode` field is sometimes generated client-side if missing. So this may be a real (intermittent) failure path, not a hypothetical.

**Fix shape (30 min, 1 PR):**
1. In `ReferralScreen`, if `rider.referralCode` is null, hit `GET /api/rider/referral` (the singular endpoint, currently dead) and use the server's code. The endpoint already handles the null case (`if (!rider || !rider.referralCode) return null;`).
2. If the endpoint also returns null, show a `Skeleton` with a "Generating..." message and a retry button, instead of the placeholder.
3. Disable the Share button when `referralCode == 'VOLTIUM-XXXX' || referralCode == null`.

Audit ticket #90.

---

### P0-8 — `maskPhone` is called on the server, but the masked format doesn't round-trip through Flutter parsing
**Severity:** P0 (low risk, but confirmed contract drift)
**Files:**
- `web/src/server/modules/referrals/referral.use-cases.ts:180, 245` — `const { maskPhone } = await import('@/lib/pii');`
- The two responses (`getReferrals`, `getReferralInfo`) include `phone: maskPhone(ref.phone)` and `name: ref.fullName || 'Unknown Rider'`

**Bug:** I haven't read `lib/pii.ts` to confirm the exact mask format, but the cross-audit pattern (PII returned in 5 other places: dashboard, kyc, guarantor, wallet) has consistently been:
- The server masks `9876543210` to `98****3210` or similar.
- The Flutter side has no `maskPhone` of its own and treats the masked string as if it were a real phone (e.g., for re-lookup, for dialing, for the share-message).

`ReferralScreen` does not call `phone`, but `EngagementProvider` stores the whole `response['data']` as `referralData` and exposes it to the dashboard. If the dashboard ever tries to dial the masked phone, the call will silently fail (no user feedback).

This is a **monitor-and-defer** P0, not a fix-now P0, because no production code currently dials the masked phone. But it is the 4th cross-audit PII leak / drift point, and the next dashboard redesign will likely try to "tap to call your referee" and hit this.

**Fix shape:** Confirm `lib/pii.ts maskPhone` format; document the format on the response schema; add a Dart extension `String get isMaskedPhone => ...` that detects masked phones and refuses to dial. Audit ticket #91.

---

### P0-9 — `riderAuth` is acquired in `offers/route.ts` but completely unused
**Severity:** P0 (info-disclosure + missing rate-limit)
**Files:**
- `web/src/app/api/rider/offers/route.ts:8-9`
```ts
const auth = await requireRiderSession(request);
if (auth instanceof Response) return auth;
```
- The `auth` object is never read after the null check.

**Bug:** The endpoint requires authentication, but the result is **identical for every authenticated rider** (active sponsored offers globally). This means:
- The endpoint is effectively a public, authenticated list (any signed-in rider — or a stolen session token — can enumerate all current promos).
- The endpoint has no per-rider rate limit (a stolen session can poll every 50ms).
- The endpoint ignores the rider identity, so there's no way to hide a personal promo (e.g., "this offer only for riders in city X") without a refactor.

Also: the unused `auth` is a TS-`noUnusedParameters` lint warning that the codebase has been suppressing (or that ESLint hasn't caught because it's an exception to the rule for the pattern).

**Fix shape (15 min, 1 PR):**
1. Either:
   - **Option A (recommended for now):** Drop `requireRiderSession`, document the endpoint as "public marketing list", and add a global rate-limit (e.g., 60 req/min per IP).
   - **Option B:** Use `auth.riderDbId` to filter offers by rider's city / plan / lifecycle, and add per-rider rate-limit.
2. Add an explicit rate-limit middleware to the route. Right now there is none.

Audit ticket #92.

---

## 3. P1 findings (real bugs, fix in next sprint)

| # | Severity | File:Line | Issue |
|---|---|---|---|
| P1-1 | P1 | `web/src/app/api/rider/referrals/route.ts:14` | Returns `errors.notFound('Referral code not found for this rider')` with 404 if `getReferrals` returns null. The rider is authenticated — they exist. Returning 404 "Referral code not found" is confusing; should be 200 with `{referralCode: null, stats: {...zeros}, referrals: []}`. |
| P1-2 | P1 | `web/src/server/modules/referrals/referral.use-cases.ts:217-218` | `totalEarned` and `potentialEarnings` use the hardcoded `REWARD_PER_REFERRAL = 500` (rupees), but the actual paid bonus is in paise from the settings table. Payout discrepancy for any UI that reads these. |
| P1-3 | P1 | `web/src/server/modules/referrals/referral.use-cases.ts:199-213` | `isActive = rank >= 11` includes `SUSPENDED` (rank 12), `RETURN_PENDING` (13), and `CLOSED` (14). A suspended rider is counted as "active" for the referrer's reward display. The wallet already paid, so no money issue, but the UI shows misleading state. |
| P1-4 | P1 | `web/src/server/modules/referrals/referral.use-cases.ts:182-198, 328-344` | The `lifecycleRank` map is duplicated verbatim in two places. Should be extracted to a shared `lib/lifecycle-ranks.ts` constant. |
| P1-5 | P1 | `web/src/server/modules/rewards/reward.repository.ts:42-58` | `getSummary()` calls `db.reward.findMany({select:{points:true, createdAt:true, riderId:true}})` with **no `where` filter** — full table scan + memory aggregation on every admin page load. Should be `db.reward.aggregate({...})` or at least `db.reward.groupBy({by:['riderId'], ...})`. |
| P1-6 | P1 | `web/src/server/modules/rewards/reward.repository.ts:6, 26-33` | `(r: any)` everywhere — type safety lost. Should use `Reward & {rider: Rider | null}` and let TS infer. |
| P1-7 | P1 | `web/src/app/api/rider/rewards/route.ts:14` | Returns 404 if `riderUseCases.getRewards` returns null. Same as P1-1 — should return 200 with empty list. |
| P1-8 | P1 | `web/src/app/api/rider/rewards/route.ts:13` | Logs full `err` to the logger without `riderDbId` — PII correlation gap. Add `riderDbId` to the log context. |
| P1-9 | P1 | `web/src/app/api/rider/referral/route.ts:15-18` | Catches errors and returns generic message. Should distinguish 401 (no session) from 500 (DB). The `auth instanceof Response` check handles 401, so this is OK, but the error path is hard to debug when it fires. |
| P1-10 | P1 | `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart:117-134` | `refreshRewards` catches all exceptions silently. A 500 from the server is logged at `appDebug` and the rider sees stale data with no error indicator. |
| P1-11 | P1 | `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart:139-142` | Same as P1-10 for referrals. |
| P1-12 | P1 | `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart:67-72` | `initEngagementData` is fire-and-forget (no `await`); the test stub `_loadDummyData` only runs in `AppConstants.isTestMode`. In `flutter test` mode but not setting `AppConstants.isTestMode`, real API calls fire and fail. |
| P1-13 | P1 | `flutter/lib/features/referrals/presentation/screens/referral_screen.dart:39-69` | `_copyToClipboard` returns `Future<void>` but is called as `() => _copyToClipboard(referralCode)` (line 207), which is a sync function. If the copy fails, the UI flips `_isCopied = true` and the snackbar fires, but no error feedback. |
| P1-14 | P1 | `flutter/lib/features/referrals/presentation/screens/referral_screen.dart:281` | Share URL `https://voltium.app/ref/$referralCode` is hardcoded. The domain may not be owned by Voltium; if the user taps the share message, the link is broken. Use a dynamic setting. |
| P1-15 | P1 | `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:37-46` | Tier calc uses `rider?.totalRewardPoints` from `riderProvider` (a snapshot from the dashboard load). If the rider redeems a reward (hypothetically), the dashboard's `totalRewardPoints` is stale until the next dashboard refresh. No pull-to-refresh on this screen. |
| P1-16 | P1 | `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:265-325` | Empty state is hardcoded as a static widget. If the rewards endpoint is eventually wired in, the empty state needs to be conditional (`rewards.isEmpty ? EmptyState : ListView`). |
| P1-17 | P1 | `web/src/server/modules/offers/offer.use-cases.ts:30-31` | `validFrom` / `validUntil` parsed via `new Date(string)` without validation. If the admin sends `"banana"`, Prisma throws an opaque error. Add `.refine(s => !isNaN(new Date(s).getTime()))`. |
| P1-18 | P1 | `web/src/server/modules/offers/offer.use-cases.ts:48-50` | `update()` passes `data` through with `as Record<string, unknown>`, so an unknown field would silently land in the DB via `prisma.offer.update({data: updateData})`. Not a real risk today (Prisma ignores unknown fields), but `prisma.$transaction` wrappers are not used — partial update could leave an offer with `validFrom: <new>` and `validUntil: <old>`. |
| P1-19 | P1 | `web/src/server/modules/offers/offer.use-cases.ts:62-67` | `delete()` is hard-deleting the offer. If a rider saw the offer in their app cache, the next refresh will 404 it, but their UI may still render the offer. Should be a soft-delete (set `isActive=false`) or emit a `offer.deleted` event. |

---

## 4. P2 findings (type safety / contract issues)

| # | File:Line | Issue |
|---|---|---|
| P2-1 | `web/src/app/api/rider/referral/route.ts:13` | `referralUseCases.getReferralInfo` returns `{referralCode, referredBy, referredUsers[]}` with `referredUsers: {name, phone, kycStatus, status, date}`. The `status` field is mapped from `kycProfile?.status === 'APPROVED' ? 'COMPLETED' : ...` — `COMPLETED` is not a real lifecycle value, and this string bleeds into the Flutter `referralData` map. |
| P2-2 | `web/src/app/api/rider/referrals/route.ts:13` | `getReferrals` returns `referrals[]` with `planStatus`, `rentalStatus`, `paymentStatus` — three derived booleans, all derived from `lifecycleRank`. The Flutter `EngagementState.referralData` is `Map<String, dynamic>?` so they're dropped, but a future UI that wants to display "X paid, Y pending" has to redo the lifecycle mapping. |
| P2-3 | `web/src/server/modules/referrals/referral.use-cases.ts:210` | `paymentStatus: rank >= 9 ? 'Paid & Active' : 'Payment Pending'` is a UI string in the API. Should be an enum, with i18n at the Flutter layer. |
| P2-4 | `web/src/server/modules/referrals/referral.use-cases.ts:115-116` | `description: \`Referral reward for ${referee.fullName || referee.phone}\`` — PII (full name or phone) in the wallet ledger description. The audit-ledger has PII redaction (per the 1st audit), but the wallet ledger does not. |
| P2-5 | `web/src/server/modules/referrals/referral.use-cases.ts:131-135` | `tx.reward.create({data:{riderId, title, points: bonusPaise}})` — `points` is set to `bonusPaise` (e.g., 20000), but the column is `Int` with no unit. If the UI later treats this as "display points", a ₹200 reward shows as "20,000 points". |
| P2-6 | `web/src/server/modules/rewards/reward.repository.ts:1-3` | Direct import of `db`; no `withErrorHandler`. Other modules (rider, kyc) wrap calls. |
| P2-7 | `web/src/server/modules/rewards/reward.repository.ts:60-62` | `create(data: Record<string, unknown>)` accepts any shape and casts to `any` on the prisma call. Should accept a typed `RewardCreateInput` or at minimum a zod-validated payload. |
| P2-8 | `web/src/server/modules/offers/offer.use-cases.ts:5` | No `withErrorHandler` wrapper. |
| P2-9 | `web/src/server/modules/offers/offer.use-cases.ts:26-36` | `db.offer.create({data: {...validFrom: new Date(data.validFrom), validUntil: new Date(data.validUntil), ...}})` — if the dates are invalid, Prisma throws and the route returns a generic 500. |
| P2-10 | `flutter/lib/core/network/generated/api_client.dart:382-422` | All four rider endpoints (`getRiderOffers`, `getRiderReferral`, `getRiderReferrals`, `getRiderRewards`) return `Future<Map<String, dynamic>>` — no typed model. Same pattern as the rest of the codebase (Phase 1 typing deferred), but the rewards response has been stable for 6+ months and is a good candidate for `RiderRewardsResponse`. |
| P2-11 | `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart:124-127` | `data['totalPoints'] as int?` and `data['currentStreak'] as int?` — no defensive parsing. If the server returns a string (`'1250'`), the cast throws and the entire `refreshRewards` errors out. The catch swallows it, but the rider sees stale data with no explanation. |
| P2-12 | `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart:128` | `RewardItem.fromJson(e as Map<String, dynamic>)` — if the server omits a field, the generated `_$RewardItemFromJson` throws. |
| P2-13 | `flutter/lib/features/referrals/presentation/screens/referral_screen.dart:73` | `ref.watch(riderProvider.select((p) => p.rider))` — Riverpod `select` returns the inner rider, but the screen rebuilds on every rider-model field change, not just `referralCode`. Use `.select((r) => r?.referralCode)` for a 5x rebuild reduction. |
| P2-14 | `flutter/lib/features/referrals/presentation/screens/referral_screen.dart:227` | `Text(referralCode, style: GoogleFonts.ibmPlexMono(...))` — `GoogleFonts.ibmPlexMono` is loaded async on first use; the first frame may fall back to the default font and cause a layout jump. Cache the font. |
| P2-15 | `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:122-124` | `BackdropFilter(filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20))` on a `ClipRRect` — high GPU cost; on low-end Android devices the pulse animation drops frames. The pulse animation runs forever (`repeat(reverse: true)`), so the GPU is always under load. |
| P2-16 | `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:228-247` | `FractionallySizedBox(widthFactor: progress.clamp(0.0, 1.0))` — for Gold tier (points ≥ 5000), `nextTierThreshold` is 5000, but `progress` will be `points / 5000`. If `points = 10000` (e.g., a power user with 50 referrals at 200 pts each), progress is 2.0; `.clamp(0, 1)` shows a full bar but the text says "$pointsToNext pts to next" → 5000 - 10000 = -5000 → "−5000 pts to next" is shown. |
| P2-17 | `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:44` | `nextTierThreshold` for Gold is hardcoded to 5000; if marketing wants a Platinum at 10000, the code path `points < 2000 ? 2000 : 5000` returns 5000 unconditionally, so Platinum is unreachable. (Same as P0-5.) |
| P2-18 | `flutter/lib/models/rider_model.dart:172` | `final String? referralCode;` is nullable, but the Prisma column is `String @unique` — every rider must have a code, or the schema constraint fails. The nullable Dart type hides a real backend invariant. |
| P2-19 | `flutter/lib/models/rider_model.dart:174` | `final int totalRewardPoints;` is non-nullable with default 0, but the dashboard endpoint (per 13th audit) may omit it. The `json['totalRewardPoints'] as int? ?? 0` fallback is correct, but the type signature lies. |
| P2-20 | `flutter/test/rewards/referrals_test.dart:13-29` | `buildTestApp` is defined inside `main()` but `referrals_test.dart` and `rewards_screen_test.dart` both define their own. Extract a `helpers/build_test_app.dart`. |
| P2-21 | `flutter/test/features/referrals/presentation/screens/referral_screen_test.dart:12` | `// ignore: prefer_const_constructors` — the constructor is `const`, so the ignore is a stale comment. Remove. |
| P2-22 | `web/tests/integration/rewards/referrals.test.ts:64` | `expect([200, 404]).toContain(referralsRes.status)` — passing for the wrong reason. The test author documented "depends on mock DB state" but the test will pass even if `/referrals` always 404s. Tighten to `200`. |
| P2-23 | `web/tests/integration/rewards/referrals.test.ts` | No test for `/api/rider/rewards` or `/api/rider/offers`. Add. |
| P2-24 | `web/src/server/modules/rewards/reward.use-cases.ts:28-30` | `notificationService.notifyRewardMilestone(...).catch((e) => logger.error('Failed to notify reward', e))` — silently swallows the error and only logs. If notifications are down, the rider never knows they got a reward. Should at least write a `Notification` row to the DB as a fallback. |

---

## 5. P3 findings (code quality / dead code)

| # | File:Line | Issue |
|---|---|---|
| P3-1 | `flutter/lib/services/referral_service.dart` (entire file, 245 lines) | DEAD. `ReferralService`, `ReferralCode`, `PromoCode` — none referenced from production. Delete (covered in P0-4). |
| P3-2 | `flutter/lib/models/reward_model.dart` (22 lines) + `.g.dart` | DEAD. Replaced by `RewardItem` in api_models, but `RewardItem` is also mostly unused. |
| P3-3 | `flutter/lib/features/rewards/domain/entity.dart` (45 lines) | DEAD. `RewardEntity` and `ReferralEntity` are not imported anywhere. |
| P3-4 | `flutter/lib/features/referrals/widgets/referral_card.dart` (368 lines) | DEAD. `ReferralCard`, `ReferralStatsCard`, `ReferralShareOptions`, `_StatItem`, `_ShareOption` are all never imported by `ReferralScreen` (which builds its own custom UI). |
| P3-5 | `flutter/test/widgets/referral_card_golden_test.dart` | DEAD. Snapshot of the dead widget. |
| P3-6 | `flutter/test/services/referral_service_test.dart` | DEAD. Tests for the dead service. |
| P3-7 | `flutter/lib/core/network/generated/api_client.dart:382-385` | `getRiderOffers()` is never called from production. Either wire it (P0-2) or delete. |
| P3-8 | `flutter/lib/core/network/generated/api_client.dart:407-411` | `getRiderReferral()` (singular) is never called. The only caller is `ReferralScreen` (which should call it per P0-7) but currently doesn't. |
| P3-9 | `flutter/lib/core/network/generated/api_models.dart:1431-1448` | `AwardRewardRequest` exists but no `awardReward()` client method exists. The whole shape is dead in the rider client. |
| P3-10 | `flutter/lib/services/voltium_api_service.dart:191-198` | `fetchRewards()` and `fetchReferrals()` are called only by `EngagementProvider._fetchAll`. The whole engagement data flow is invisible to UI (the screens read `rider.totalRewardPoints` instead). |
| P3-11 | `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart:60-198` | The notifier's `logout` and `markAllNotificationsRead` paths exist but the screens that call them (notification list, settings logout) use a different `authProvider`. The whole `EngagementNotifier` is largely orphaned. |
| P3-12 | `web/src/server/modules/rewards/reward.use-cases.ts:6-13` | `list()` and `award()` are admin-side; never called from the rider API. The whole module is a sibling of the rider rewards path; the naming collision (P0-3) is the root cause. |
| P3-13 | `web/src/server/modules/rewards/reward.repository.ts:60-62` | `create()` exists for the admin path but is never called from `award()` — the use-case calls it directly. Could be inlined. |
| P3-14 | `web/src/server/modules/offers/offer.use-cases.ts:14-44` | `create()` has no auth/permission check inside the use-case; the route is responsible. Tight coupling between route and use-case. |
| P3-15 | `web/src/app/api/rider/referral/route.ts:9` | `const auth = await requireRiderSession(request);` — `auth.riderDbId` is used correctly. |
| P3-16 | `web/src/app/api/rider/referrals/route.ts:14` | `errors.notFound('Referral code not found for this rider')` — error message exposes "rider" terminology. Use generic message. |
| P3-17 | `web/src/app/api/rider/rewards/route.ts:14` | `errors.notFound('Rider not found')` — same. |
| P3-18 | `web/src/app/api/rider/offers/route.ts:6-15` | No `logger` import / error logging. Other routes log with `logger.error('[GET /api/...]', err)`. Inconsistent. |
| P3-19 | `flutter/lib/features/referrals/presentation/screens/referral_screen.dart:74` | Magic string fallback `'VOLTIUM-XXXX'` — should be a constant `kPendingReferralCodePlaceholder` with a TODO. |
| P3-20 | `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:42` | Magic numbers `500`, `2000`, `5000` — covered by P0-5. |
| P3-21 | `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:213` | Text says "$pointsToNext pts to next" — `$pointsToNext` is interpolated as a literal `${...}` not as a `\$` template. Not a bug (no `\$` here), but the syntax is confusing. Use `'$pointsToNext pts to next'`. |

---

## 6. Test gaps (11)

| # | What | Where it should live |
|---|---|---|
| TG-1 | `GET /api/rider/referral` returns the correct shape and masks phone | `web/tests/integration/rewards/referrals.test.ts` (currently 4 tests, none for shape) |
| TG-2 | `GET /api/rider/referrals` returns stats with 0 referrals when none exist | same file |
| TG-3 | `GET /api/rider/referrals` returns 404 → 200-with-empty when rider has no code | new |
| TG-4 | `GET /api/rider/rewards` returns empty `rewards` list and 0 totals for a fresh rider | new |
| TG-5 | `GET /api/rider/rewards` includes `thisMonthPoints` and `currentStreak` | new |
| TG-6 | `GET /api/rider/offers` returns active sponsored offers only (excludes `isActive=false` and `isSponsored=false`) | new |
| TG-7 | `GET /api/rider/offers` is rate-limited to N req/min per IP | new |
| TG-8 | `referralUseCases.listAdminReferrals` returns `totalEarnings = activeRiders * (bonusPaise/100)` (the actual setting), not the hardcoded 500 | `web/tests/unit/server/modules/referrals/referral.use-cases.test.ts` (does not exist) |
| TG-9 | `offerUseCases.getActiveSponsored` does NOT return offers with `validUntil < now` | `web/tests/unit/server/modules/offers/offer.use-cases.test.ts` (does not exist) |
| TG-10 | `EngagementNotifier.refreshRewards` handles 500 / 404 / 200 responses correctly | `flutter/test/features/dashboard/engagement_provider_test.dart` (does not exist) |
| TG-11 | `RewardsScreen` shows empty state when `rider.totalRewardPoints == 0` AND when the rewards endpoint returns empty | `flutter/test/features/rewards/presentation/screens/rewards_screen_test.dart` (currently golden only) |

---

## 7. What I'd do first if I had to pick one fix

**P0-1 (15 min, 1 file, 4 line edits)**: align the hardcoded `REWARD_PER_REFERRAL = 500` with the actual `setting:referralBonus`. This stops the admin UI from showing a 2.5× inflated payout, stops new engineers from copying the wrong constant into a new code path, and unblocks the rewards audit ticket (P0-3, P0-5, P0-6) that all need the same source of truth.

```ts
// In referral.use-cases.ts
- const REWARD_PER_REFERRAL = 500;
+ const getBonusRupees = async (): Promise<number> => {
+   const cached = getCachedResponse<string>('setting:referralBonus');
+   if (cached) return parseInt(cached) / 100;
+   const setting = await db.systemSetting.findFirst({ where: { key: 'referralBonus' } });
+   const paise = parseInt(setting?.value || '20000');
+   cacheResponse('setting:referralBonus', String(paise), 60);
+   return paise / 100;
+ };
```
Then update the four call sites (`earned`, `potential`, `earningForReferrer`, `totalEarnings`) to compute from `getBonusRupees()`.

**Why this fix first:**
- 15 min, no DB migration, no Flutter change, no docs.
- Stops a real user-trust incident (admin tries to "reconcile" the 2.5× gap and double-pays).
- Unblocks the 3 follow-on reward tickets that need a single source of truth.

**Effort / blast-radius ranking** (next 5 fixes, in order):
1. P0-7 (30 min) — hide the "VOLTIUM-XXXX" placeholder, disable Share when null.
2. P0-9 (15 min) — drop `requireRiderSession` from `/api/rider/offers` (or use `auth.riderDbId`); add rate limit.
3. P0-4 (30 min) — delete the 4 dead Flutter files (referral_service, reward_model, entity, referral_card).
4. P0-2 (1 hour) — decide offers: ship a 1-screen "Promotions" tab, or delete the endpoint and the `getRiderOffers` client method.
5. P0-3 (2 hours) — rename `rewardUseCases` → `adminRewardUseCases`; add vitest asserting shape.

---

## 8. Cross-audit pattern: what this audit confirmed vs. previous 13

This 14th audit confirms and extends three cross-audit patterns:

### Pattern A: "Hardcoded constants that disagree with the source of truth"
- **1st audit (riders deep)**: `referral.rewardPerReferral` was hardcoded 100, then 200, then 500 across three call sites.
- **5th audit (rewards-analytics-admins-faqs)**: `getRevenueTrend` hardcoded `type = 'CREDIT'` instead of `RENT_PAYMENT` DEBIT.
- **6th audit (legal-device-workflow)**: `consentSchema.policyVersion` hardcoded `'public-beta-v1'`.
- **13th audit (rider-dashboard-profile-api-flows)**: `dashboard.todayStats` hardcoded to `{distance:0, power:0, speed:0, battery:0}`.
- **14th audit (this)**: `REWARD_PER_REFERRAL = 500` hardcoded in 4 places while the actual paid bonus is from `setting:referralBonus` (20000 paise = ₹200).

**Pattern: settings are defined in the DB but ignored in code.** Every reward / tier / bonus number that has a `setting:xxx` entry in `settings.registry.ts` should be consumed via `getCachedResponse('setting:xxx')`; hardcoded mirrors rot.

### Pattern B: "Endpoint exists, Flutter method exists, but neither is called"
- **12th audit (rider-onboarding-api-flows)**: `POST /api/rider/kyc` (0 callers), `POST /api/rider/device` (0 callers).
- **13th audit (rider-dashboard-profile-api-flows)**: `POST /api/rider/verify-lock-password` (0 callers, also broken).
- **14th audit (this)**: `GET /api/rider/offers` (0 callers), `GET /api/rider/referral` (singular, 0 callers; plural is called), `POST /api/rider/rewards/redeem` (doesn't exist).

**Pattern: the API surface has grown faster than the UI consumes it.** Every new endpoint should ship with at least one screen that calls it; otherwise it should be deleted, not parked.

### Pattern C: "Rewards & points have no unit"
- **1st audit**: `rider.rewardPoints: Int` with no documented unit.
- **5th audit**: `Reward.points` in `prisma.reward` is set to `bonusPaise` (an integer paise value, not points), so a ₹200 reward shows as "20,000 points" if displayed.
- **14th audit (this)**: same issue persists; `tier` thresholds are 500/2000/5000 in some unit, but no one knows which.

**Pattern: a single integer column in Prisma is being used to represent rupees, paise, points, and "milestone count" interchangeably.** The team's "points" concept is overloaded. A `RiderPoint` model with `unit: 'POINTS' | 'RUPEES' | 'PAISE'` would force a decision, but until then, every UI that displays points is wrong.

### Pattern D: "Naming collision between admin and rider use-cases"
- **5th audit**: `analytics.use-cases` and `dashboard.ts` both have `getRevenue*` functions with different filter sets.
- **14th audit (this)**: `rewardUseCases` (admin) and `riderUseCases.getRewards` (rider) are entirely different functions with similar names.

**Pattern: when an admin and a rider path both need rewards / analytics / kyc, the team copies the function name into both modules.** This is the second `reward` collision in the codebase. Renaming `rewardUseCases` → `adminRewardUseCases` and similar in the analytics module would prevent the next engineer from routing the wrong way.

---

## 9. Recommended fix order (with hours)

| # | Fix | Effort | Blast radius | Risk |
|---|---|---|---|---|
| 1 | P0-1: align `REWARD_PER_REFERRAL` with `setting:referralBonus` | 15 min | All admin referrals pages | Low — server-only, no Flutter change |
| 2 | P0-7: hide "VOLTIUM-XXXX" placeholder; disable Share when null | 30 min | 1 rider screen | Low |
| 3 | P0-9: drop `requireRiderSession` from `/api/rider/offers` + add rate limit | 15 min | 1 route | Low |
| 4 | P0-4: delete 4 dead Flutter files (~700 lines) | 30 min | Build size | Low — dead code |
| 5 | P0-2: decide offers (ship Promotions tab OR delete endpoint + client method) | 1 hour | 1 endpoint + 1 client method | Med — product decision |
| 6 | P0-3: rename `rewardUseCases` → `adminRewardUseCases` | 2 hours | All admin reward pages | Med — grep + replace |
| 7 | P0-5: tier thresholds in settings + new endpoint | 4 hours | 1 endpoint + 1 screen | Med |
| 8 | P1-1, P1-7: 404 → 200-with-empty for missing referral/rewards | 30 min | 2 routes | Low |
| 9 | P1-3: lifecycle "active" should exclude SUSPENDED/RETURN_PENDING/CLOSED | 30 min | 1 use-case | Low |
| 10 | P1-5: replace `getSummary` `findMany` with `aggregate` | 1 hour | 1 repo function | Low |
| 11 | P0-6: catalog + redemption flow | 2 days | New Prisma models + endpoint + screen | High — feature work |
| 12 | P0-8: PII mask format documentation | 1 hour | 1 doc | Low |
| 13 | P1-13..P1-19, P2-1..P2-24, P3-1..P3-21, TG-1..TG-11 | 2 days | Multi-file | Low |

**Total: ~5 days of focused work to clear all P0 + P1; ~2 weeks to clear everything.**

---

## 10. File-level summary (what to keep / delete / refactor)

### Delete (dead code, ~700 lines, no production impact)
- `flutter/lib/services/referral_service.dart` (245)
- `flutter/lib/models/reward_model.dart` (22) + `.g.dart`
- `flutter/lib/features/rewards/domain/entity.dart` (45)
- `flutter/lib/features/referrals/widgets/referral_card.dart` (368) — but only after confirming `ReferralCard`, `ReferralStatsCard`, `ReferralShareOptions` are not referenced by any other module. Grep the codebase.
- `flutter/test/services/referral_service_test.dart`
- `flutter/test/widgets/referral_card_golden_test.dart`
- `flutter/lib/core/network/generated/api_client.dart:382-385` (`getRiderOffers`) — **after** P0-2 decision
- `flutter/lib/core/network/generated/api_client.dart:407-411` (`getRiderReferral`) — **after** P0-7 fix wires it in; if not wired, delete
- `flutter/lib/core/network/generated/api_models.dart:1431-1448` (`AwardRewardRequest`) — dead, but generated, so requires regenerating from OpenAPI

### Refactor
- `web/src/server/modules/referrals/referral.use-cases.ts:15, 211-212, 355, 380` — replace `REWARD_PER_REFERRAL = 500` with `getBonusRupees()`
- `web/src/server/modules/referrals/referral.use-cases.ts:182-198, 328-344` — extract `lifecycleRank` to `lib/lifecycle-ranks.ts`
- `web/src/server/modules/referrals/referral.use-cases.ts:199` — `isActive` should be `rank === 11` (not `>= 11`), so SUSPENDED/RETURN_PENDING/CLOSED don't count
- `web/src/server/modules/rewards/reward.repository.ts` — `getSummary` use `aggregate`; type the parameters (no `any`)
- `web/src/server/modules/rewards/reward.use-cases.ts` — rename to `adminRewardUseCases`
- `web/src/app/api/rider/referrals/route.ts:14` — return 200 with empty list instead of 404
- `web/src/app/api/rider/rewards/route.ts:14` — return 200 with empty list instead of 404
- `web/src/app/api/rider/offers/route.ts` — drop `requireRiderSession` (or use `auth.riderDbId`); add rate limit; add `take: 50` to `getActiveSponsored`
- `flutter/lib/features/referrals/presentation/screens/referral_screen.dart:74` — replace `'VOLTIUM-XXXX'` placeholder with API-fetched code
- `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:41-46` — replace hardcoded tier thresholds with API call
- `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart` — defensive parsing; typed `RiderRewardsResponse`

### Keep
- `web/src/app/api/rider/referral/route.ts` (shape OK, fix placeholder)
- `web/src/app/api/rider/referrals/route.ts` (shape OK, fix 404 → 200)
- `web/src/app/api/rider/rewards/route.ts` (shape OK, fix 404 → 200)
- `web/src/app/api/rider/offers/route.ts` (fix auth + rate limit; decide endpoint vs delete)
- `web/src/server/modules/referrals/referral.use-cases.ts` (core logic OK; constants wrong)
- `web/src/server/modules/rewards/reward.repository.ts` (admin path; refactor for performance + typing)
- `web/src/server/modules/offers/offer.use-cases.ts` (OK, add validations)
- `flutter/lib/features/referrals/presentation/screens/referral_screen.dart` (OK, wire to API)
- `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart` (OK, replace hardcoded tier)
- `flutter/lib/core/network/generated/api_client.dart` (typed methods are fine)

---

## 11. Cumulative totals across 14 audits (post this audit)

| Severity | Count | Δ from 13 audits |
|---|---|---|
| P0 | **93** | +9 |
| P1 | **253** | +19 |
| P2 | **221** | +24 |
| P3 | **250** | +21 |
| Test gaps | **91** | +11 |
| Dead code (lines) | **~5,700** | +~700 |

**Top 10 P0 across all 14 audits** (by blast radius, with newest at top):

1. **P0-1 (this audit)**: `REWARD_PER_REFERRAL = 500` vs `setting:referralBonus` 20000 paise — admin UI shows 2.5× real payout.
2. **13th audit**: `verify-lock/route.ts:62` reads `rider.lockPassword` but Prisma has `lockPasswordHash` — **3rd audit to flag this exact bug, 7+ days unfixed**.
3. **12th audit**: FCM endpoint `/api/rider/fcm-token` should be `/api/rider/register-token` — 1 line fix, 5 min.
4. **9th + 11th audits**: DOB format `dd-MM-yyyy` broken in BOTH rider and guarantor onboarding.
5. **10th audit**: Two Terms of Service copies are different (legal unenforceability).
6. **10th audit**: Legal acceptance not persisted.
7. **12th audit**: `POST /api/rider/consent` doesn't persist (DPDP Act 2023 violation).
8. **12th audit**: 4 rider-facing schemas NOT strict (admin schemas fixed in PR-26; rider security is 4 PR-26 follow-ups behind).
9. **13th audit**: Dashboard returns 4 PII fields on every app open (DPDP data-minimization violation).
10. **9th audit**: "Delete Account" fake (GDPR / DPDP Article 17 violation).

---

## 12. Audit metadata

- **Auditor:** Mavis (MiniMax)
- **Audit depth:** Cross-stack contract + dead-code + currency drift + lifecycle mapping + PII flow.
- **Files read:** 32 (16 backend, 11 Flutter, 5 test).
- **Lines analyzed:** ~2,400.
- **Confidence:** High for P0-1, P0-4, P0-7, P0-9, P1-1..P1-19 (file-level grep + read). Medium for P0-5, P0-6 (no backend source for tier thresholds confirmed — would need to grep `settings.registry.ts` for `tier*` keys to be 100% sure none exist). Medium for P0-2 (no UI to confirm the offers endpoint is unreachable — would need to grep for `getRiderOffers(` in all *.dart).
- **Re-test trigger:** after P0-1 lands, re-run `web/tests/integration/rewards/referrals.test.ts` and the admin referrals UI; the displayed totalEarnings should now equal `activeRiders * (bonusPaise/100)`.
- **Owner question for product:** is the offers endpoint being shipped? If not, delete in 1 PR. If yes, who builds the Promotions tab?
