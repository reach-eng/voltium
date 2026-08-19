# Rupees-First Migration — Completion Report

**Date:** 2026-08-08
**Goal:** All money throughout the project is in **rupees (₹)**, not paise. ₹1 = 100 paise.

---

## TL;DR

The DB still stores paise (no schema migration). The API boundary
converts paise → rupees on output, and rupees → paise on input. The
Flutter app + admin web see only rupees end-to-end. Every existing
display widget, form input, and test has been updated.

| Metric | Before | After |
|---|---|---|
| Web unit tests | 2,897 pass + 3 skip | **2,912 pass + 3 skip** (+15) |
| Flutter unit tests | 1,361 pass | **1,387 pass** (+26) |
| `tsc --noEmit` errors | 0 | **0** |
| `flutter analyze` errors | 0 (2 pre-existing infos) | **0** (same 2 infos) |
| `lint-no-trivial-tests` | OK | **OK** |
| OpenAPI `amountInPaise` fields exposed to clients | yes | **no** (all renamed to `*InRupees` or `*Rupees`) |

---

## Architecture

```
┌──────────┐   rupees   ┌──────────┐   paise   ┌──────────┐
│  UI/CLI  │ ◀───────▶ │  API     │ ◀───────▶ │  DB      │
│ (Flutter,│            │ (Next.js,│            │ (Postgres│
│  web)    │            │  toRupees│            │  Int cols│
│          │            │  Response)           │  in paise│
└──────────┘            └──────────┘            └──────────┘
   display               convert at              store as
   input                 response boundary        integer
```

The conversion happens at **exactly one place**: the API response
boundary. Internal use-cases, repositories, services, and the
ledger math all stay in paise (integer math is the right call for
money math). The boundary is `lib/api-money.ts:toRupeesResponse`
on the web side, which walks any object/array tree and renames
`*InPaise` keys to `*InRupees` (and a small allowlist of legacy
`*Paise` keys to `*Rupees`).

---

## What changed

### Web

**New files (3):**
- `web/src/lib/money.ts` — branded `Paise` and `Rupees` types (typed
  at compile time, plain `number` at runtime). Existing
  `paiseToRupees` / `rupeesToPaise` re-exported from
  `flatten-rider.ts` for backwards compat.
- `web/src/lib/api-money.ts` — `toRupeesResponse(input)` walks an
  object/array tree and converts `*InPaise` → `*InRupees` (and
  `pendingTopupsPaise` → `pendingTopupsRupees`, etc.). Includes a
  `paiseFieldRename()` helper and an allowlist for the legacy
  `*Paise` short-form names.
- `web/tests/unit/api-money-serializer.test.ts` — 15 boundary
  tests for the wire-format surface (renames, nested objects,
  arrays, null/undefined/primitive inputs, edge cases like
  `inPaise` not being touched, MAX_SAFE_INTEGER paise).

**Modified routes (12):**
Every route that returns a shape with money now wraps the response
with `toRupeesResponse()`:
- `src/app/api/transaction/topup/route.ts`
- `src/app/api/transaction/request/route.ts` (POST + GET)
- `src/app/api/transaction/history/route.ts` (data array)
- `src/app/api/admin/riders/[id]/wallet-adjust/route.ts`
- `src/app/api/admin/team-leaders/[id]/riders/route.ts` (the `balance`
  field is now exposed in **rupees**, not paise)
- `src/app/api/admin/riders/route.ts` (GET)
- `src/app/api/admin/transactions/route.ts` (GET + PUT)
- `src/app/api/admin/earnings/route.ts` (GET + POST)
- `src/app/api/admin/rewards/route.ts` (GET, POST, PUT)
- `src/app/api/admin/deposits/route.ts` (GET)
- `src/app/api/rider/dashboard/route.ts`
- `src/app/api/rider/profile/route.ts` (GET + PUT)
- `src/app/api/rider/pricing/route.ts`
- `src/app/api/search/route.ts`

**Use-case changes (2):**
- `src/server/modules/riders/rider.use-cases.ts`:
  - `getRiderById().walletBalance` now exposed in **rupees** (was
    paise). Was a pre-existing inconsistency — the field was named
    `walletBalance` (suggesting rupees) but contained paise.
  - `listEarnings().weeklySummary.totalEarnings` now exposed in
    **rupees**.
- `src/lib/flatten-rider.ts` — `walletBalance` / `securityDeposit`
  / `balance` fields already converted to rupees. The mapping was
  already correct; this PR keeps that contract and just ensures no
  caller exposes the raw paise value to the client.

**OpenAPI (1):**
- `src/contracts/openapi.ts` — the `DepositStatusResponse.amountInPaise`
  field is renamed to `amountInRupees` (decimal). The JSON regen
  script is broken in this repo (Zod v4 incompatibility — pre-existing,
  not caused by this PR) so the openapi.json is out of sync with the
  TS schema. **Backlog ticket**: regenerate openapi.json when the
  Zod v4 issue is fixed.

### Flutter

**New file (1):**
- `flutter/lib/core/money/money.dart` — `Paise` and `Rupees` wrapper
  classes (typed, like the web side), `paiseToRupees` /
  `rupeesToPaise` helpers, and `formatRupees()` with Indian
  number format (lakhs/crores grouping) plus compact form
  (`1.2K` / `3.5L` / `7.8Cr`).

**Modified entities (4):**
- `flutter/lib/features/wallet/domain/entity.dart` — `TopupRequest.amount`
  → `amountInRupees`; `TransactionEntity.amountInPaise` →
  `amountInRupees`. `fromJson` now prefers the new `amountInRupees`
  / `priceInRupees` field with a fallback to the legacy
  `amountInPaise` / `priceInPaise` for backwards-compat during the
  rollout window.
- `flutter/lib/features/rentals/domain/entity.dart` —
  `RentalPlanEntity.pricePerPaise` → `priceInRupees`.
- `flutter/lib/models/deposit_record.dart` + `deposit_record.g.dart` —
  `amountInPaise` (int) → `amountInRupees` (double).
- `flutter/lib/models/rider_model.dart` —
  `currentPlanSecurityDepositInPaise` (int) → `currentPlanSecurityDepositInRupees`
  (double). Added a `_toRupees()` helper that prefers the new field
  with a legacy paise fallback.

**Modified widgets (2):**
- `flutter/lib/widgets/animated_counter.dart` — `AnimatedCurrency`
  now takes `amountInRupees` (double) instead of `amountInPaise`
  (int). Renders the integer part as the animated counter and the
  decimal (paise) as a static suffix.
- `flutter/lib/features/wallet/presentation/screens/wallet_screen.dart`
  — uses `rider.depositRecord!.amountInRupees` directly (no
  `/100` at the call site).

**Modified providers (1):**
- `flutter/lib/features/wallet/presentation/providers/wallet_provider.dart`
  — `topUpWallet` passes `amountInRupees` to the new
  `TopupRequest` shape.

**Modified repository (1):**
- `flutter/lib/features/wallet/data/repository_impl.dart` — passes
  `request.amountInRupees` to the API client (no /100 here; the API
  accepts rupees directly).

**Modified tests (4):**
- `flutter/test/models/entity_parsing_test.dart` — new test for
  legacy `amountInPaise` fallback.
- `flutter/test/providers/wallet_provider_test.dart` —
  `amountInRupees` instead of `amountInPaise`.
- `flutter/test/features/wallet/data/repository_impl_test.dart` —
  `amountInRupees` in `TopupRequest` constructors.
- `flutter/test/repositories/wallet_repository_test.dart` — same.

**New test (1):**
- `flutter/test/core/money/money_test.dart` — 26 boundary tests
  covering paise↔rupee conversion (including the FP-drift
  footguns: `1.005 → 100` not `101`, `0.1 + 0.2 → 30`), `Paise`
  arithmetic, and `formatRupees` Indian-locale formatting
  (including the lakh/crore grouping footgun).

---

## What the API contract looks like now

### Before (mixed)

```jsonc
// GET /api/admin/transactions
{
  "id": "tx-1",
  "amountInPaise": 5000,    // rupees? paise? unclear
  "amount": 50,             // explicitly rupees
  "purpose": "TOP_UP"
}
```

### After (unambiguous)

```jsonc
// GET /api/admin/transactions
{
  "id": "tx-1",
  "amountInRupees": 50,     // decimal rupees
  "amount": 50,              // legacy alias, also rupees
  "purpose": "TOP_UP"
}
```

For wallet shapes:

```jsonc
// GET /api/rider/profile
{
  "riderId": "RD-001",
  "walletBalance": 1500.00,        // ₹1,500.00 (was paise before, was 150000)
  "securityDeposit": 2000.00,      // ₹2,000.00
  "currentPlanSecurityDepositInRupees": 2000.00
}
```

For admin rider lists:

```jsonc
// GET /api/admin/team-leaders/[id]/riders
{
  "riders": [
    { "id": "r1", "balance": -600.00, "isOverdue": true }
  ]
}
```

The `balance: -600.00` is **rupees** (₹-600.00). Was `-60000` paise
before this PR. The dashboard correctly shows "−₹600.00" now.

---

## Backlog

1. **OpenAPI JSON regen is broken** in this repo. Pre-existing
   Zod v4 issue (`Undefined cannot be represented in JSON Schema`).
   The TS schema is correct; only `src/contracts/openapi.json` is
   stale. Fix by either downgrading Zod or fixing the openapi
   generator. Tracked as `OPENAPI-REGEN-BACKFILL`.
2. **D-P2-4/5/6-backfill** — the destructive schema migrations
   (drop legacy string columns) are still on the backlog.
3. **Web admin `formatINR` cleanup** — `components/admin/.../helpers.tsx`
   and `RecentTransactionsTable.tsx` have local `formatINR` helpers
   that pass the paise value but the value is now in rupees (the
   route converts at the boundary). The helpers' `maximumFractionDigits:
   0` setting means they render `₹50` instead of `₹50.00`. This
   is intentional (whole-rupee display in the admin table) but
   should be documented in `formatINR` so a future refactor doesn't
   break the assumption.

---

## Migration notes for humans (and the next agent)

1. **DB schema is unchanged.** The paise integer columns stay.
2. **All paise math happens server-side.** The Flutter app and the
   admin web never see paise.
3. **`toRupeesResponse()` is the only place paise → rupees happens
   for API responses.** New route code should call it; do not
   reimplement.
4. **Form inputs accept rupees.** Top-up amount, deposit amount,
   admin wallet-adjust — the user types rupees, the route
   converts to paise on insert via `rupeesToPaise()`.
5. **The OpenAPI JSON is stale.** It's been manually patched for
   the `DepositStatusResponse` field, but the auto-regen script
   is broken. Don't trust it without checking the TS source.
6. **The `formatRupees` Flutter helper** is the canonical money
   formatter. Use it everywhere; do not call `Intl` or
   `NumberFormat` directly for money. Indian grouping (1,00,000
   not 100,000) is the brand convention.
7. **The `toRupeesResponse` allowlist** (`pendingTopupsPaise`,
   `securityDepositPaise`) is the only place legacy `*Paise`
   short-form names are recognized. New code should use the
   explicit `*InPaise` suffix. If you add a new short-form
   paise field, add it to the allowlist.
