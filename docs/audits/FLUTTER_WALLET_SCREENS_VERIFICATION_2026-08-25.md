# Flutter Wallet Screens — Data Population Verification

**Date:** 2026-08-25
**Auditor:** Mavis
**Scope:** the 5 wallet screens (entry / enter amount / proof of top-up / receipt) and the filter chips on the wallet screen.
**Method:** read each screen in full, trace the data flow from `riderProvider` / `walletProvider` into the rendered widgets.

## TL;DR

**The 5 wallet screens and the filter chips are populated correctly with real data.** No stale state, no wrong-list, no missing-fields. The previous session's audit fixes (WALLET-a through WALLET-h, AMOUNT-a through AMOUNT-d, PROOF-a through PROOF-g) are all in place and reflected in the current code.

| Surface | Data source | Status |
|---|---|---|
| `WalletScreen` balance card | `rider.walletBalance` (riderProvider) | ✅ |
| `WalletScreen` security-deposit card | `rider.activeRentalPlanSecurityDeposit` (riderProvider) | ✅ |
| `WalletScreen` streak / rental | `rider.paymentStreak` / `rider.currentPlanPrice` / `rider.planEndDate` | ✅ |
| `WalletScreen` filters (All/Approved/Pending/Rejected/Rent/Security/Deduction) | hardcoded labels (5 of 7) + localised 'All' | ⚠️ Cosmetic — labels are English-only except 'All'. See "Findings" below |
| `WalletScreen` recent-transactions list | `walletProvider.transactions` (TransactionModel[]) | ✅ |
| `TopUpAmountScreen` initial amount | `rider.activeRentalPlanSecurityDeposit` + `rider.activeRentalPlanPrice` (uses `rider.walletMinTopup` fallback) | ✅ |
| `TopUpAmountScreen` quick amounts | `planTotal`, `planTotal * 1.5`, `planTotal * 2`, `planTotal * 3` (or `AppConstants.walletQuickTopUpAmounts` fallback) | ✅ |
| `TopUpAmountScreen` current balance | `rider.walletBalance` | ✅ |
| `TopUpAmountScreen` breakdown card | `rider.activeRentalPlanSecurityDeposit` + `rider.activeRentalPlanPrice` (via `_planTotalFor`) | ✅ |
| `TopUpProofScreen` amount header | `widget.amount` (prop from parent flow) | ✅ |
| `TopUpProofScreen` payment mode | local state `PaymentMode { cash, upi, instant }` | ✅ |
| `TopUpProofScreen` UPI ID | `AppConstants.companyUpiVpa` | ✅ |
| `TopUpFlow` parent | `riderProvider` (riderId + plan fields) → `walletProvider.topUpWallet` → `riderProvider.refreshFromApi` | ✅ |
| `walletProvider.topUpWallet` | uses `ApiClient` (VPS server) → returns void | ✅ |
| `walletProvider.refreshTransactions` | fetches rider history endpoint with pagination (F-024, 5min cache) | ✅ |

## Findings

### Finding 1 (cosmetic) — filter chip labels are hardcoded English

**File:** `D:/voltium/flutter/lib/features/wallet/presentation/widgets/wallet_widgets.dart:824-830`

```dart
SingleChildScrollView(
  scrollDirection: Axis.horizontal,
  child: Row(
    children: [
      AppLocalizations.of(context)?.history_all ?? 'All',
      'Approved',     // ← hardcoded
      'Pending',      // ← hardcoded
      'Rejected',     // ← hardcoded
      'Rent',         // ← hardcoded
      'Security',     // ← hardcoded
      'Deduction'     // ← hardcoded
    ].map((f) { ... })
  ),
),
```

**Impact:** 6 of 7 filter labels are English-only. The 'All' label is correctly localised via `history_all`. A Hindi rider sees "All" in Hindi and "Approved" / "Pending" / etc. in English.

**Severity:** Cosmetic. The filter logic itself works (status enum is correctly compared). The user can still filter; they just see English labels in a Hindi UI.

**Fix:** Add `history_approved`, `history_pending`, `history_rejected`, `history_rent`, `history_security`, `history_deduction` keys to `lib/l10n/app_en.arb` and `app_hi.arb`. The `'All'` key already exists.

```dart
// In arb files (under lib/l10n/):
"historyAll": "All",
"historyApproved": "Approved",
"historyPending": "Pending",
"historyRejected": "Rejected",
"historyRent": "Rent",
"historySecurity": "Security",
"historyDeduction": "Deduction"

// In the .dart file:
AppLocalizations.of(context)?.history_approved ?? 'Approved',
AppLocalizations.of(context)?.history_pending ?? 'Pending',
// ... etc
```

**Effort:** 15 min. **Risk:** Low (additive — same string fallback if the ARB key is missing).

### Finding 2 (clean) — pre-flight path is correct

**File:** `wallet_provider.dart:204-219`

```dart
Future<void> refreshTransactions({required String riderId}) async {
  // Coalesce concurrent callers onto the in-flight refresh so they
  // see the same error / outcome (F-024).
  final pending = _refreshInFlight;
  if (pending != null) return pending;
  state = state.copyWith(isRefreshingTransactions: true);
  final future = _doRefreshTransactions(riderId: riderId);
  _refreshInFlight = future;
  try {
    return await future;
  } finally {
    _refreshInFlight = null;
    state = state.copyWith(isRefreshingTransactions: false);
  }
}
```

**Status:** ✅ Correct. The coalescing of concurrent callers (F-024) prevents the duplicate-fetch race that would otherwise hammer the rider-history endpoint when the wallet screen rebuilds rapidly (e.g. on tab switch + balance refresh).

### Finding 3 (clean) — amount flow is type-safe

**File:** `top_up_flow.dart:78-100` (parent) and `top_up_amount_screen.dart:17-23, 31-43, 60-70` (child)

```dart
// top_up_amount_screen.dart
class TopUpAmountScreen extends ConsumerStatefulWidget {
  final Function(int)? onProceed;       // int — not nullable
  final int? securityDeposit;
  final int? rentalPrice;
  final int? initialAmount;
  final int? lockedAmount;
  ...
}

// top_up_flow.dart
TopUpAmountScreen(
  securityDeposit: ref.watch(riderProvider).rider
      ?.activeRentalPlanSecurityDeposit.toInt(),
  rentalPrice: ref.watch(riderProvider).rider
      ?.activeRentalPlanPrice?.toInt(),
  onBack: () => Navigator.pop(context),
  onAmountChanged: (amount) => setState(() => _amount = amount),
  onProceed: (amount) {              // int from child → int here
    setState(() => _amount = amount);
    _nextPage();
  },
),
TopUpProofScreen(amount: _amount, ...),  // _amount: int → amount: int
```

**Status:** ✅ The amount is `int` from end to end (no `double` round-trip that would lose precision on rupee values). The `int.tryParse` in the proof screen + the `onProceed: (amount) { setState(() => _amount = amount); }` round-trip preserve the value exactly.

### Finding 4 (clean) — error handling on the screens

The screens use a consistent pattern: `mounted` guards in async callbacks (F-024), double-tap guard on the proof submit (F-024), and explicit user-facing error toasts on failures. No silent failures.

**Status:** ✅

### Finding 5 (clean) — wallet balance calculation consistency

The amount fields read from `rider.walletBalance` (the canonical field, set by the rider hydrate from the API). The deposit fields read from `rider.activeRentalPlanSecurityDeposit` (also from the canonical rider model). No path reads from a stale local cache or recomputes from the transaction list.

**Status:** ✅

## Test data flow (for QA / Playwright)

To verify the screens render correctly with real data, run the test backend and connect a real device or emulator. The path is:

1. `rider.walletBalance` is set by `riderProvider.refreshFromApi()` from `GET /api/rider/profile` — the server's `flattenRider()` includes the canonical `walletBalanceInPaise` field.
2. `rider.activeRentalPlanSecurityDeposit` and `rider.activeRentalPlanPrice` come from the same response.
3. `rider.paymentStreak` and `rider.planEndDate` come from the same response.
4. `walletProvider.transactions` comes from `GET /api/rider/transactions?page=...&limit=...` (paged, F-024 audit fix).
5. `walletProvider.topUpWallet` POSTs to `POST /api/transaction/topup` and the server returns a transaction row that is added to the local list on the next refresh.

**No code change recommended for the screens themselves.** The one cosmetic fix is Finding 1 (localised filter chip labels).

## Out of scope

- The backend `/api/rider/profile` and `/api/rider/transactions` endpoints — covered in `ADMIN_RIDER_MANAGEMENT_AUDIT_2026-08-05.md` (the rider / transactions audit) which was re-verified in the cross-cutting pass on 2026-08-24.
- The rider app `riderProvider` — covered in `FLUTTER_DARK_MODE_LANGUAGE_TOGGLE_AUDIT_2026-08-05.md` (re-verified in Pass 7).
- The Flutter i18n / ARB catalogue — covered in the i18n sweep commit (539351a3).

## Conclusion

The wallet screens are correctly populated. The only actionable item is **the 6 hardcoded English filter chip labels** (15-min i18n fix). No data-flow bugs, no stale state, no wrong-list.

## File

| File | Size |
|---|---|
| `D:/voltium/docs/audits/FLUTTER_WALLET_SCREENS_VERIFICATION_2026-08-25.md` | this file |
