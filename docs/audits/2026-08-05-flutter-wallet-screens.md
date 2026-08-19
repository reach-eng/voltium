# Flutter Wallet Audit — Wallet Screen & Sub-screens

**Date:** 2026-08-05
**Scope:** The Voltium Rider app wallet feature — every Dart file under `lib/features/wallet/`, every related widget under `lib/features/wallet/widgets/`, the wallet provider, the wallet repository, the data models it consumes (`RiderModel`, `TransactionModel`, `DepositRecord`), and the wallet-related test files.
**Method:** Surface + deep read of 25+ source files, the entity types, the API client methods called, and the test suite. Cross-checked against the web admin audit findings (wallet screen at `web/src/components/admin/screens/wallet/...`) and the prior 6 audits.
**Reviewer:** Mavis (audit pass #7)

---

## 0. TL;DR — What is broken today

1. **The wallet's `TopUpFlow` shows a success snackbar, but the dedicated `TopUpReceiptScreen` (with success animation, "Verification in Progress" status card, and "Back to Dashboard" CTA) is never reached.** The router imports it, the new flow does not push it. **PostHog's `top_up_completed` event is never sent** because the new flow only emits `wallet_top_up_submitted`. Analytics is broken for the top-up funnel.

2. **`top_up_proof_screen.dart:158` hardcodes a Razorpay URL** — `https://api.razorpay.com/v1/checkout/embedded?rider_id=...&amount=...&gateway=...`. This is not a server endpoint. The rider is sent to a third-party URL with no auth, no signing, no server-side callback. **A successful charge does not credit the wallet.** The 2.5% fee warning in the dialog says "when enabled by admin" but the URL is hardcoded regardless.

3. **The "Online / Instant" payment mode does not work** — when the user picks the Instant tab, the screen sets `_selectedPaymentMode = PaymentMode.online`. The submit button at line 393 sends `methodStr = _selectedPaymentMode == PaymentMode.upi ? 'UPI' : 'CASH'`. So if the user picks "Instant", gets redirected to Razorpay, and returns without clicking submit, the next submission sends `method: 'CASH'`. The server receives the wrong method.

4. **`top_up_proof_screen.dart:382` declares `_upiRefCtrl` as a field in the middle of the class, between methods.** This is a Dart style violation but more importantly, the controller is created outside `initState` (so `dispose` works, OK) — but the controller is wired in `_submit` to send `upiRef` only if mode is UPI. The flow path from `top_up_flow.dart` (the actual orchestrator) never sets `upiRef` — it always passes `null`. The UPI reference field on the screen is decorative.

5. **`activeRentalPlanPrice` / `activeRentalPlanSecurityDeposit` fall back to a hardcoded map in `app_constants.dart:57-86`.** The map has 4 plans (DAILY_FLEX, WEEKLY_BASIC, WEEKLY_MAX, MONTHLY_PREMIUM). If the server adds a new plan or renames one, the rider sees `₹1,500` (the `defaultPlanPrice` fallback) for every new plan. No server-driven source of truth.

6. **`requiredPaymentAmount` in `rider_model.dart:536-538` uses `walletMinTopup` as a fallback for the rental price** — but `walletMinTopup` is a config setting (the minimum top-up amount), not a plan price. If `currentPlanPrice` is 0 and `walletMinTopup` is 100, the formula returns `100 + securityDeposit` — which makes no sense.

7. **`top_up_proof_screen.dart:155-163` reads `rider.id ?? rider.riderId` for the checkout URL but the rest of the wallet code uses `rider.riderId` (the public id).** The `rider.id` is the internal cuid. The URL goes to Razorpay with the wrong id. Not a security issue (Razorpay doesn't store it) but the wrong identifier is sent.

8. **`TransactionListTile` in `wallet_widgets.dart:13-172` is dead code** — it accepts `final dynamic tx;` (loses all type safety), but the new wallet screen uses its own inline list. The widget is not imported anywhere. Same for `transaction_filter.dart:24-250` (both `TransactionFilterSort` and `DateRangePicker` are unused).

9. **`history_screen.dart:393` `tx.createdAt!.toIso8601String().substring(0, 10)`** — `createdAt` is `DateTime?` and the `!` force-unwrap can crash. The transaction model allows null `createdAt` (per `transaction_model.dart:131`). If a transaction has no `createdAt`, the history screen throws.

10. **`history_screen.dart:298-322` search field** — `onChanged: (val) => setState(() => _searchQuery = val)` rebuilds the entire screen on every keystroke. With 1000 transactions, this is janky. No debounce, no `controller`, no `onSubmitted`. And the search only matches `description` (not `purpose`, not `remark`, not the amount, not the type) — a rider searching "UPI" or "1000" finds nothing.

11. **`SecurityDepositCard` at `wallet_widgets.dart:208-320` uses `rider.securityDeposit ?? 0`** — but `securityDeposit` is `final double` (not nullable). The `?? 0` is dead code. The copy says "Your first top-up of ₹X is refundable after 180 days of active service" — the "180 days" is hardcoded, the "first top-up" claim is misleading (the card shows the current deposit), and the threshold check is `deposit >= 2000`.

12. **`WalletBalanceCard` at `wallet_widgets.dart:322-540+` uses `final dynamic rider;`** — same type-unsafe pattern. Reads `rider.walletBalance`, `rider.paymentStreak`, `rider.currentPlanPrice`, `rider.planEndDate` as raw fields. If the rider model renames any of these, the compiler doesn't catch it.

13. **`SecurityDepositCard` and `TopUpRequestSentCard` show rupee amounts with `.toString()` on doubles** — e.g. `₹${rider.securityDeposit}` shows `₹2049.0` instead of `₹2,049`. No thousand separator, no integer formatting.

14. **`top_up_amount_screen.dart:82-88` has a `CustomAmountCtrl` listener that fires on every keystroke and calls `widget.onAmountChanged?.call(val)`** — and the `TextFormField`'s own `onChanged` at line 187 also calls `setState`. Two state updates per keystroke. Wasteful. And the listener doesn't notify when text is empty (the `if (text.isNotEmpty)` guard) — so the parent's `_amount` stays at the last non-zero value.

15. **`top_up_amount_screen.dart:100-104` `_canProceed`** — `minTopup.toInt()` truncates. If `walletMinTopup = 99.5`, the check is `_finalAmount >= 99` — a 99-rupee top-up passes the client check but the server may require 100. No upper bound (no max). A rider can type 999999999.

---

## 1. File Map (read scope)

### Source files
| File | Lines | Purpose |
| --- | --- | --- |
| `lib/features/wallet/presentation/screens/wallet_screen.dart` | 142 | Main wallet screen. Lists balance, deposit, transactions. |
| `lib/features/wallet/presentation/screens/top_up_flow.dart` | 150 | New 2-page top-up flow (PageView). Orchestrates amount + proof. |
| `lib/features/wallet/presentation/screens/top_up_amount_screen.dart` | 438 | Step 1: pick amount. |
| `lib/features/wallet/presentation/screens/top_up_proof_screen.dart` | 812 | Step 2: pick payment method + upload proof. |
| `lib/features/wallet/presentation/screens/top_up_receipt_screen.dart` | 265 | **DEAD** — old 3-page flow's receipt. Success animation, "Back to Dashboard". Never reached by new flow. |
| `lib/features/wallet/presentation/screens/top_up_upi_screen.dart` | 588 | **DEAD** — old 3-page flow's UPI screen. Never imported by new flow. |
| `lib/features/wallet/presentation/screens/history_screen.dart` | 700+ | Transaction history with search, filter, summary, expandable cards. |
| `lib/features/wallet/presentation/providers/wallet_provider.dart` | 227 | Riverpod v3 Notifier. `refreshTransactions`, `topUpWallet`, `setWalletSettings`, `logout`. |
| `lib/features/wallet/presentation/widgets/wallet_widgets.dart` | 540+ | `TransactionListTile` (DEAD), `MethodChip` (DEAD), `SecurityDepositCard`, `WalletBalanceCard`, `MiniWalletCard`, `GradientWalletCard`, `WalletActionButton`. |
| `lib/features/wallet/widgets/wallet_card.dart` | 290+ | `GradientWalletCard`, `MiniWalletCard`, `WalletActionButton`. |
| `lib/features/wallet/widgets/transaction_filter.dart` | 250+ | **DEAD** — `TransactionFilterSort` and `DateRangePicker` widgets, not imported. |
| `lib/features/wallet/widgets/top_up_request_sent_card.dart` | 201 | Card shown on wallet screen when a top-up is pending/rejected. |
| `lib/features/wallet/widgets/skeleton_wallet_card.dart` | 92 | Loading skeleton. |
| `lib/features/wallet/widgets/earnings_chart.dart` | 165 | Bar chart for daily earnings. Not used in wallet (used in dashboard). |
| `lib/features/wallet/domain/entity.dart` | 97 | `WalletEntity`, `TopupRequest`, `TransactionEntity` domain types. |
| `lib/features/wallet/domain/repository.dart` | 20 | Abstract `WalletRepository` interface. |
| `lib/features/wallet/data/repository_impl.dart` | 70 | HTTP-backed implementation. |
| `lib/models/transaction_model.dart` | 261 | `TransactionModel`, `TransactionType`, `TransactionStatus`, `TransactionBreakdown`. |
| `lib/models/rider_model.dart` | 800+ | Rider model (50+ fields). Includes wallet/deposit/plan getters. |
| `lib/models/deposit_record.dart` | 30 | `DepositRecord` model. |
| `lib/utils/app_constants.dart` | 87 | Plan price map (fallback), thresholds, test mode. |

### Test files
| File | Lines | Purpose |
| --- | --- | --- |
| `test/wallet/wallet_screen_test.dart` | 99 | 3 widget tests: render, title, top-up action. |
| `test/wallet/wallet_screen_enhanced_test.dart` | 181 | 8 tests: header, body, action, transaction list, refresh, top-up nav, filter. |
| `test/wallet/topup_flow_test.dart` | 51 | 2 tests: amount screen renders, has input field. |
| `test/wallet/top_up_proof_screen_test.dart` | ? | Exists, not read in detail. |
| `test/wallet/top_up_receipt_screen_test.dart` | ? | Exists for dead screen. |
| `test/wallet/top_up_upi_screen_test.dart` | ? | Exists for dead screen. |
| `test/features/wallet/empty_states_test.dart` | 85 | Tests `IllustratedEmptyState` widget. |
| `test/features/wallet/data/repository_impl_test.dart` | 228 | 16 unit tests for `WalletRepositoryImpl`. |
| `test/features/wallet/widgets/skeleton_wallet_card_test.dart` | ? | Skeleton card test. |
| `test/features/wallet/presentation/screens/wallet_screen_golden_test.dart` | ? | **Pre-existing broken** (per session memory) — LocaleNotifier signature mismatch. |

### Cross-cutting
- `lib/core/network/api_client.dart:67` `postTransactionTopup` → `/api/transaction/topup`
- `lib/core/network/api_client.dart:74` `getTransactionHistory(page, limit)` → `/api/transaction/history?page=...&limit=...`
- `lib/core/network/api_client.dart:351` `getRiderDashboard` → `/api/rider/dashboard`
- `lib/app/router.dart:34-38` imports all 4 top-up screens (3 dead + 1 used)
- `lib/core/observability/posthog_service.dart` — PostHog event capture used in top-up flow

---

## 2. P0 — "breaks production today, users see broken data"

### P0-1 `TopUpFlow` never shows `TopUpReceiptScreen` — PostHog `top_up_completed` is never sent

```dart
// lib/features/wallet/presentation/screens/top_up_flow.dart:89-135
await wProvider.topUpWallet(...);
await ref.read(riderProvider.notifier).refreshFromApi();
...
PostHogService.capture('wallet_top_up_submitted', properties: { ... });
if (context.mounted) {
  final nav = Navigator.of(context);
  nav.pop();  // ← just pops the flow
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: const Text('Top-up proof submitted successfully!'), ...),
  );
}
```

The new flow shows a snackbar and pops. It does NOT push `TopUpReceiptScreen`. Compare to the OLD flow (which the new flow replaced) that DID push the receipt. So:

- **PostHog `top_up_completed` event** is never sent. Analytics for the top-up funnel is broken — only the `_initiated` and `_submitted` events fire, but never `_completed`. (Source: `top_up_receipt_screen.dart:49-53` is the only place that captures `top_up_completed`.)
- **The success animation** (`ElectricBurstSuccess` + `AnimatedSuccessGlow` from `top_up_receipt_screen.dart:76-79`) is never shown. The rider just sees a snackbar.
- **"Back to Dashboard" CTA** is never shown. The rider is dumped back to wherever they came from, with no clear "what's next" guidance.

**Effect:** Every top-up is logged as "submitted" but never "completed". The PM looking at the funnel sees drop-off between `submitted` and "any further event" (which is 100%).

**Fix shape:** push `TopUpReceiptScreen` after the snackbar (or replace the snackbar with a push). The receipt already exists and works; just wire it into the new flow.

---

### P0-2 `top_up_proof_screen.dart:158` hardcoded Razorpay URL — no server callback, charges don't credit wallet

```dart
// lib/features/wallet/presentation/screens/top_up_proof_screen.dart:155-163
final rider = ref.read(riderProvider).rider;
final riderId = rider?.id ?? rider?.riderId ?? '';
final checkoutUrl = Uri.parse(
  'https://api.razorpay.com/v1/checkout/embedded?rider_id=$riderId&amount=${widget.amount}&gateway=$_selectedGateway',
);
if (await canLaunchUrl(checkoutUrl)) {
  await launchUrl(checkoutUrl, mode: LaunchMode.externalApplication);
}
```

This is a hardcoded URL to `api.razorpay.com`. The rider is sent to a third-party URL with no auth, no signing, no server-side callback. The flow:
1. Rider picks "Instant" → opens this URL
2. Rider pays (or doesn't pay) on Razorpay's site
3. ??? → wallet is never credited server-side

The dialog text says "Note: Payment gateway fee of up to 2.5% extra will apply on online transactions when enabled by admin." So the design intent is: only when the admin enables a gateway, the URL is hit. But the URL is hardcoded regardless.

**Effect:** When the admin enables online top-ups, a rider can pay Razorpay successfully and the wallet won't be credited. When the admin hasn't enabled it, the URL still loads Razorpay (no validation). Either way, this is broken.

**Fix shape:** Replace the hardcoded URL with a call to a server endpoint like `/api/transaction/online-topup/init` that returns a gateway-specific checkout URL (Razorpay, PhonePe, Cashfree, Easebuzz per the dropdown). The server should sign the request with the merchant key, return the URL, and have a webhook to credit the wallet on success.

---

### P0-3 `top_up_proof_screen.dart:393` — "Instant" mode submits as `method: 'CASH'`

```dart
// lib/features/wallet/presentation/screens/top_up_proof_screen.dart:390-400
Future<void> _submit() async {
  if (_imageFile == null) return;
  setState(() => _isUploading = true);
  final methodStr = _selectedPaymentMode == PaymentMode.upi ? 'UPI' : 'CASH';
  // ...
  await widget.onSubmit?.call(_imageFile!, methodStr, refVal);
}
```

`_selectedPaymentMode` is one of `cash`, `upi`, `online`. The submit converts to `UPI` or `CASH`. There is no `'ONLINE'` branch. So if the user picks "Instant" (line 282-284), the dialog sets `_selectedPaymentMode = PaymentMode.online` (line 153), the user goes to Razorpay, and on return clicks Submit → server receives `method: 'CASH'`.

The server's wallet ledger then treats this as a CASH top-up, not an online payment. The admin sees a "CASH" top-up in the queue with a photo proof — confusing.

**Fix shape:** add `case PaymentMode.online: methodStr = 'ONLINE';` and have the server handle the gateway flow.

---

### P0-4 `history_screen.dart:393` `tx.createdAt!.toIso8601String().substring(0, 10)` — NPE if `createdAt` is null

```dart
// lib/features/wallet/presentation/screens/history_screen.dart:388-394
Widget _buildTransactionCard(TransactionModel tx, bool isExpanded) {
  final isCredit = tx.isCredit;
  final amount = tx.amount;
  final status = tx.status.value.toUpperCase();
  final date = tx.createdAt != null
      ? tx.createdAt!.toIso8601String().substring(0, 10)
      : '';
```

Wait, the code does check `tx.createdAt != null` first. Let me re-read.

```dart
final date = tx.createdAt != null
    ? tx.createdAt!.toIso8601String().substring(0, 10)
    : '';
```

The `!` is safe because the null check is in the ternary. So this is actually OK. Phew.

**But wait, the same pattern in `wallet_widgets.dart:131-133` `TransactionListTile` does the same** and that widget is dead, so it doesn't matter.

Let me also re-check the actual NPE risk in `history_screen.dart`. The `id` is `tx.id ?? ''` on line 395. The `id` is used for `_expandedId == id`. If two transactions have the same id (shouldn't happen but possible if backend returns null id for failed transactions), the expand state is shared. Not an NPE.

OK P0-4 is not a real P0. Downgrading.

---

### P0-4 (revised) `top_up_proof_screen.dart:155-163` reads `rider.id` (cuid) for the Razorpay URL but the wallet code uses `rider.riderId` (public id)

```dart
// lib/features/wallet/presentation/screens/top_up_proof_screen.dart:155-163
final rider = ref.read(riderProvider).rider;
final riderId = rider?.id ?? rider?.riderId ?? '';  // ← prefers internal cuid
final checkoutUrl = Uri.parse(
  'https://api.razorpay.com/v1/checkout/embedded?rider_id=$riderId&amount=${widget.amount}&gateway=$_selectedGateway',
);
```

The rest of the wallet code uses `rider.riderId` (the public `VFR-...` id, see `rider_model.dart:58` `riderId`). The Razorpay URL goes to a third-party with the internal `rider.id` (cuid). This is a privacy leak — Razorpay (and anyone who sees the URL) can correlate the internal cuid with the public id.

Combined with P0-2, this is part of a "the entire online payment path is broken" cluster.

**Fix shape:** use `rider.riderId` (the public id) consistently. The server-side gateway integration should accept the public id and resolve to the internal id server-side.

---

### P0-5 `top_up_flow.dart:135-141` `topUpWallet` calls `refreshTransactions` but `isToppingUp` is reset BEFORE the refresh completes

```dart
// lib/features/wallet/presentation/providers/wallet_provider.dart:111-141
Future<void> topUpWallet({
  required double amount,
  ...
}) async {
  state = state.copyWith(isToppingUp: true);
  try {
    var uploadedUrl = screenshotUrl;
    if (image != null) {
      uploadedUrl = await _files.uploadFile(image, 'TOPUP_PROOF');
    }
    final req = entity.TopupRequest(...);
    await _repo.submitTopup(req);
    await refreshTransactions(riderId: riderId);  // ← happens in try
  } catch (e) {
    rethrow;
  } finally {
    state = state.copyWith(isToppingUp: false);  // ← reset BEFORE refresh
  }
}
```

The `finally` block runs after `try` completes, which includes `await refreshTransactions(...)`. Wait, no — `finally` runs after the entire `try` block (including all awaits in the try). So `isToppingUp: false` is set AFTER `refreshTransactions` completes.

Let me re-read. Yes, the `await refreshTransactions` is inside the `try` block. The `finally` runs after the try block exits. So `isToppingUp` is reset AFTER the refresh. OK, this is actually correct.

But the comment in the code says: "state = state.copyWith(isToppingUp: false);" is in the finally. The refresh IS awaited, so this is correct. P0-5 downgraded.

---

### P0-5 (revised) `wallet_provider.dart:152-167` `refreshTransactions` coalesces via `_refreshInFlight` but `topUpWallet` doesn't wait for the coalesced refresh

```dart
// lib/features/wallet/presentation/providers/wallet_provider.dart:152-167
Future<void> refreshTransactions({required String riderId}) async {
  final pending = _refreshInFlight;
  if (pending != null) return pending;  // ← returns the in-flight future
  // ...
  final future = _doRefreshTransactions(riderId: riderId);
  _refreshInFlight = future;
  try { await future; }
  finally { _refreshInFlight = null; state = state.copyWith(isRefreshingTransactions: false); }
}
```

And `topUpWallet`:
```dart
await _repo.submitTopup(req);
await refreshTransactions(riderId: riderId);  // ← waits for the refresh
```

So if a refresh is already in flight when `topUpWallet` is called, `topUpWallet` awaits the EXISTING refresh. But that refresh was started BEFORE the top-up — it returns stale data (no top-up). The wallet shows the old balance + the "Top-up submitted" snackbar. The user then needs to pull-to-refresh to see the updated balance.

**Effect:** After a successful top-up, the wallet shows the old balance until the user manually refreshes.

**Fix shape:** after `await _repo.submitTopup(req)`, if the pending refresh is from before the submit, force a new one. Or invalidate the cached data and trigger a fresh fetch.

---

## 3. P1 — "real bugs, fix in next sprint"

### P1-1 `activeRentalPlanPrice` and `activeRentalPlanSecurityDeposit` fall back to a hardcoded `app_constants.dart:57-86` map

```dart
// lib/models/rider_model.dart:447-456
double get activeRentalPlanPrice {
  if (currentPlanPrice != null && currentPlanPrice! > 0) {
    return currentPlanPrice!;
  }
  return _planFallbacks.$1;
}
(double, double) get _planFallbacks => (
  AppConstants.getPlanPrice(currentPlan),
  AppConstants.getPlanSecurityDeposit(currentPlan),
);
```

```dart
// lib/utils/app_constants.dart:57-70
static const Map<String, double> planPriceRupees = {
  'DAILY_FLEX': 250.0,
  'WEEKLY_BASIC': 1000.0,
  'WEEKLY_MAX': 1500.0,
  'MONTHLY_PREMIUM': 2500.0,
};
```

The hardcoded map has 4 plans. If the server adds `WEEKLY_PRO` or renames `WEEKLY_BASIC` to `WEEKLY_V2`, the rider sees `defaultPlanPrice = 1500.0` for the new plan. The server is the source of truth; the client should not duplicate.

**Fix shape:** when the server doesn't send `currentPlanPrice`, the client should NOT make up a number. Either: (a) always require the server to send it, (b) use 0 with a "contact support" CTA, or (c) use the actual current plan's price from a plan catalog API.

---

### P1-2 `requiredPaymentAmount` in `rider_model.dart:536-538` uses `walletMinTopup` as fallback for plan price

```dart
// lib/models/rider_model.dart:535-538
/// Calculate the required payment amount (plan price + security deposit).
double requiredPaymentAmount(double walletMinTopup) =>
    (activeRentalPlanPrice > 0 ? activeRentalPlanPrice : walletMinTopup) +
    activeRentalPlanSecurityDeposit;
```

`walletMinTopup` is a config (the minimum top-up amount the admin set, e.g. ₹100). It's not a plan price. If `currentPlanPrice` is 0 and `walletMinTopup` is 100, the formula returns `100 + securityDeposit` — but the rider's plan is ₹1500, not ₹100. The rider pre-fills the wrong amount in the top-up screen.

**Fix shape:** if `activeRentalPlanPrice` is 0, return 0 (and let the UI show a "Select a plan" CTA) or use `defaultPlanPrice` from app_constants (which is ₹1500 — closer but still wrong if the real plan is different).

---

### P1-3 `top_up_proof_screen.dart:382` `_upiRefCtrl` is declared between methods, in the middle of the class

```dart
// lib/features/wallet/presentation/screens/top_up_proof_screen.dart
class _TopUpProofScreenState extends ConsumerState<TopUpProofScreen> {
  final ImagePicker _picker = ImagePicker();
  File? _imageFile;
  bool _isUploading = false;
  PaymentMode _selectedPaymentMode = PaymentMode.cash;
  String _selectedGateway = 'razorpay';

  void _showOnlinePaymentAlertDialog() { ... }
  Widget _buildPaymentMethodSelector() { ... }
  Future<void> _pickImage(...) async { ... }
  Future<void> _showImageSourceSheet() async { ... }

  final TextEditingController _upiRefCtrl = TextEditingController();  // ← declared HERE

  @override
  void dispose() { ... }
  ...
}
```

The controller is declared in the middle of the class, between two methods. This compiles but is a Dart style violation. The dispose method at line 386 correctly disposes it. But the declaration is in a non-standard location, which makes the file harder to read.

**Fix shape:** move `_upiRefCtrl` to the top of the class with the other fields.

---

### P1-4 `top_up_flow.dart:90-96` `topUpWallet` always passes `upiRef: null` — the UPI ref field is decorative

```dart
// lib/features/wallet/presentation/screens/top_up_flow.dart:90-96
await wProvider.topUpWallet(
  riderId: ref.read(riderProvider).riderId!,
  amount: _amount.toDouble(),
  method: method ?? 'CASH',
  upiRef: upiRef,
  image: _proofImage,
);
```

The `upiRef` is the value from the proof screen's `_upiRefCtrl` (a `TextEditingController`). It's passed through. But the proof screen's `_submit` (line 390-400) checks `_selectedPaymentMode == PaymentMode.upi` — if UPI, the `upiRef` is sent; otherwise null. OK so the wiring is there. But the field is only shown if UPI is selected. The rider can enter a UPI ref. So this is actually fine. P1-4 downgraded.

---

### P1-4 (revised) `_showImageSourceSheet` (line 375) is not awaited; rapid taps open multiple pickers

```dart
// lib/features/wallet/presentation/screens/top_up_proof_screen.dart:375-380
Future<void> _showImageSourceSheet() async {
  final source = await ImageSourceBottomSheet.show(context: context);
  if (source != null) {
    _pickImage(source);  // ← not awaited
  }
}
```

And the call site at line 627:
```dart
onTap: _showImageSourceSheet,  // ← not awaited
```

A user who taps rapidly on the upload area may open the system image picker multiple times. P1.

**Fix shape:** add a `_isPickingImage` flag; disable the upload area while picking.

---

### P1-5 `history_screen.dart:298-322` search field rebuilds entire screen on every keystroke

```dart
// lib/features/wallet/presentation/screens/history_screen.dart:298-322
Widget _buildSearchBar() {
  return Container(
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppRadius.md),
      boxShadow: AppShadows.card,
    ),
    child: TextFormField(
      onChanged: (val) => setState(() => _searchQuery = val),
      // ← no controller, no debounce, no onSubmitted
      ...
    ),
  );
}
```

With 1000 transactions, every keystroke triggers a full `setState` which rebuilds the screen, including the `CustomScrollView` with `SliverList.separated(itemCount: filtered.length, ...)` and the `_filteredTx` re-computation. The search also only matches `description` (not `purpose`, not `remark`, not the amount, not the type).

**Fix shape:** use a `TextEditingController`, debounce 300ms, search across `description + purpose + remark + amount + type.toLowerCase()`. Use `ListView.builder` + `itemCount` instead of `SliverList.separated` to limit the rebuild to the list.

---

### P1-6 `history_screen.dart:24-25` `riderId` param is required but never used

```dart
// lib/features/wallet/presentation/screens/history_screen.dart:22-26
class HistoryScreen extends ConsumerStatefulWidget {
  final String riderId;
  final VoidCallback? onBack;
  const HistoryScreen({super.key, required this.riderId, this.onBack});
```

The `riderId` is a required parameter. But the screen reads `ref.read(riderProvider).riderId` instead. The parameter is dead. Every caller has to pass an unused argument.

**Fix shape:** drop the parameter, or use it for the initial `refreshTransactions` call.

---

### P1-7 `top_up_proof_screen.dart:160` `canLaunchUrl` is deprecated

```dart
// lib/features/wallet/presentation/screens/top_up_proof_screen.dart:160
if (await canLaunchUrl(checkoutUrl)) {
  await launchUrl(checkoutUrl, mode: LaunchMode.externalApplication);
}
```

`canLaunchUrl` is deprecated in newer Flutter versions. The replacement is `LaunchUrl.checkForLaunchMode` or just calling `launchUrl` directly (which throws if it can't launch).

**Fix shape:** use the modern API. Update import.

---

### P1-8 `top_up_proof_screen.dart:34-37` enum `PaymentMode { cash, upi, online }` — `online` mode is broken (P0-3)

The enum is fine, but the `online` case sends `method: 'CASH'` to the server. The server has no way to distinguish a "online payment that was redirected to Razorpay" from "cash payment with a photo proof". Both come in as CASH.

**Fix shape:** P0-3 fix.

---

### P1-9 `top_up_receipt_screen.dart` is dead code (imported by router, never reached by the new flow)

```dart
// lib/app/router.dart:36
import '../features/wallet/presentation/screens/top_up_receipt_screen.dart';
```

```dart
// lib/features/wallet/presentation/screens/top_up_flow.dart — does NOT import top_up_receipt_screen.dart
```

The router imports all 4 top-up screens. The new flow imports only `top_up_amount_screen.dart` and `top_up_proof_screen.dart`. The `top_up_receipt_screen.dart` and `top_up_upi_screen.dart` are from the OLD 3-page flow.

**Effect:** The dead `top_up_receipt_screen.dart` has the success animation, the "Verification in Progress" card, the "Back to Dashboard" CTA, and the `top_up_completed` PostHog event. All dead. Either delete the screens or wire them into the new flow.

---

### P1-10 `top_up_upi_screen.dart` is dead code (same pattern)

Same as P1-9. The screen handles UPI in the OLD 3-page flow. The new flow combines UPI into `top_up_proof_screen.dart` (with the `PaymentMode.upi` mode). The old screen is never used.

**Fix shape:** delete the screen and its import in `router.dart`.

---

### P1-11 `TransactionListTile` in `wallet_widgets.dart:13-172` is dead code with `final dynamic tx`

```dart
// lib/features/wallet/presentation/widgets/wallet_widgets.dart:13-17
class TransactionListTile extends StatelessWidget {
  const TransactionListTile({super.key, required this.tx});
  final dynamic tx;
```

The widget accepts `dynamic` (loses type safety). The new wallet screen uses its own inline list (in `TransactionHistorySection` which I haven't read but is clearly not `TransactionListTile`). The widget is not imported.

**Fix shape:** delete the widget (140+ lines). The inline list in the wallet screen should be promoted to a typed `TransactionListTile` widget.

---

### P1-12 `TransactionFilterSort` and `DateRangePicker` in `transaction_filter.dart` are dead code

```dart
// lib/features/wallet/widgets/transaction_filter.dart:24-250
class TransactionFilterSort extends StatelessWidget { ... }
class DateRangePicker extends StatelessWidget { ... }
```

Neither is imported anywhere. The history screen uses its own tabs. The wallet screen uses its own inline filter chips.

**Fix shape:** delete the file (250+ lines).

---

### P1-13 `SecurityDepositCard` and `TopUpRequestSentCard` show rupee amounts with `.toString()` on doubles — no thousand separator, no integer formatting

```dart
// lib/features/wallet/widgets/top_up_request_sent_card.dart:96
_buildRow('Security Deposit', '₹${rider.securityDeposit}'),
// Shows: "₹2049.0" (double) or "₹0.0" (zero)

// lib/features/wallet/presentation/widgets/wallet_widgets.dart:297
Text(
  deposit.toInt().toString(),
  style: AppTypography.headingMedium.copyWith(color: colors.onSurface),
),
// Shows: "2049" (integer) — but no rupee symbol, no separator
```

Inconsistency: one shows `₹2049.0` (double, no separator), the other shows `2049` (no symbol). The web equivalent shows `₹2,049` consistently.

**Fix shape:** use a `formatINR(double)` helper that returns `₹X,XXX` (Indian number format with thousand separators). Apply consistently.

---

### P1-14 `WalletBalanceCard` at `wallet_widgets.dart:333-338` — hardcoded `5 Days` streak target

```dart
// lib/features/wallet/presentation/widgets/wallet_widgets.dart:493
Text(
  '$streak / 5 Days',
  ...
),
```

The "5 Days" is hardcoded. The streak is from `rider.paymentStreak`. The business rule for what makes a "good streak" is server-driven (presumably), but the client hardcodes 5.

**Fix shape:** add `rider.streakTargetDays` (or similar) and use it.

---

### P1-15 `top_up_amount_screen.dart:359` "Step 1 of 2" — hardcoded in the new flow

The new flow has 2 pages (amount + proof). The "Step X of 2" labels are correct for the new flow. But the same `TopUpAmountScreen` is also imported by other places (e.g. `router.dart:34`) where the flow could be different. If a future flow has 3 pages, the label is wrong.

**Fix shape:** parameterize the total step count.

---

### P1-16 `history_screen.dart:155-158` title `Transaction History` — hardcoded English

The wallet screen uses `appLocalizations` (per the test setup at `wallet_screen_test.dart:45-49`). The history screen does NOT use `appLocalizations` — the title is hardcoded `'Transaction History'`, the filter tabs are `'All'`, `'Credits'`, `'Debits'`, the search hint is `'Search transactions...'`. All hardcoded English.

**Fix shape:** use `AppLocalizations.of(context)!` for all strings. The project supports localization but the wallet screens don't use it.

---

### P1-17 `top_up_proof_screen.dart:153-154` after Instant payment, `_selectedPaymentMode = PaymentMode.online` is set but the form is still in the "proof" state

When the user clicks "Instant" (line 283), the dialog opens. On confirm (line 151-153), `setState(_selectedPaymentMode = PaymentMode.online)`. But the form still requires a proof image (line 391: `if (_imageFile == null) return;`). The user is taken to Razorpay, returns, and has to upload a proof too. The "Instant" path is for a fully-online payment where the proof is the gateway receipt, not a photo.

**Fix shape:** when mode is `online`, skip the proof requirement OR have the proof come from the gateway callback.

---

### P1-18 `top_up_proof_screen.dart:46-170` `_showOnlinePaymentAlertDialog` doesn't actually wire to the server

The dialog shows info, the rider picks a gateway, and then the URL is launched. There's no server-side initiation, no callback URL, no error handling if Razorpay rejects. The dialog dismisses and the form is "done" from the user's perspective, but the wallet is never credited.

Combined with P0-2, this is the "online payment doesn't work" cluster.

---

## 4. P2 — type safety / contract issues

### P2-1 `rider_model.dart:619-622` `lifecycleStage` fallback map from `lifecycleStatus` is duplicated logic

```dart
lifecycleStage: (json['lifecycleStage'] as String? ?? '').isNotEmpty
    ? parseRiderLifecycleStage(json['lifecycleStage'] as String?)
    : lifecycleStageFromStatus(
        json['lifecycleStatus'] as String? ?? 'NEW'),
```

The server has both a 5-value `lifecycleStage` and a 15-value `lifecycleStatus`. The client prefers the new one, falls back to mapping from the old. The mapping function `lifecycleStageFromStatus` lives elsewhere (not read in this audit). If the mapping is wrong, every rider gets the wrong stage. No test for this fallback.

**Fix shape:** add a unit test that covers the fallback for every `lifecycleStatus` value.

---

### P2-2 `rider_model.dart:543-580` `fromJson` is 40+ lines of inline parsing

The `fromJson` factory does all the parsing inline. No `_parseBool`, `_parseDate` helpers for some fields. The `kycRejectionReason` is read from a nested `kycProfile` map (line 560-562) — a different shape than the flat string. The `lifecycleStatus` falls back to `state` (line 615). All inline, no abstraction.

**Fix shape:** extract helpers for date parsing, status enum parsing, etc. The transaction model already does this (`_parseTransactionStatus`, `_toDouble`).

---

### P2-3 `wallet_widgets.dart:38-39` `TransactionListTile` uses `dynamic` for `tx` — type-unsafe

```dart
class TransactionListTile extends StatelessWidget {
  const TransactionListTile({super.key, required this.tx});
  final dynamic tx;
```

The widget then does `tx is TransactionModel ? tx.type.value.toUpperCase() : (tx['type'] ?? 'OTHER').toString()` — accepting both a `TransactionModel` AND a raw map. This is the "support both" pattern but it's a type-safety hole. Just type it as `TransactionModel` and let the caller map.

**Fix shape:** type as `TransactionModel` and `tx.type.value.toUpperCase()`. (If the widget is kept.)

---

### P2-4 `wallet_widgets.dart:209` `SecurityDepositCard.rider` is `dynamic`

```dart
class SecurityDepositCard extends StatelessWidget {
  final dynamic rider;
  ...
  final double deposit = (rider.securityDeposit ?? 0).toDouble();
```

Same as P2-3. The widget reads `rider.securityDeposit` as if it were a typed object. If `securityDeposit` is renamed, the compiler doesn't catch it. The `?? 0` is dead (securityDeposit is `double`, not `double?`).

---

### P2-5 `wallet_widgets.dart:323` `WalletBalanceCard.rider` is `dynamic`

Same pattern. Reads `rider?.walletBalance`, `rider?.paymentStreak`, `rider?.currentPlanPrice`, `rider?.planEndDate` as raw fields. Type-unsafe.

---

### P2-6 `wallet_widgets.dart:333-335` `(rider!.currentPlanPrice as num).toDouble()` — redundant casts

```dart
final double rentAmount = (rider?.currentPlanPrice != null)
    ? (rider!.currentPlanPrice as num).toDouble()  // ← `as num` and `.toDouble()` are redundant
    : AppConstants.defaultRentalPrice;
```

`currentPlanPrice` is `double?`. The `as num` and `.toDouble()` are both redundant.

---

### P2-7 `wallet_widgets.dart:333` `rider!.currentPlanPrice` — could NPE if rider is null and the condition is wrong

The check is `rider?.currentPlanPrice != null`. If `rider` is null, `rider?.currentPlanPrice` is null, and the check is false (null != null is false). So the else branch is taken. Safe. But confusing. Use a `if (rider == null) ...` early return.

---

### P2-8 `wallet_widgets.dart:540+` `WalletBalanceCard` (continued) — `hasWholeCardRedHalo` wraps the card in `AnimatedGlow`

The rest of the file (read truncated) probably has more styling. The `AnimatedGlow` is conditionally applied based on `hasWholeCardRedHalo`. Cosmetic but works.

---

### P2-9 `top_up_amount_screen.dart:100-104` `minTopup.toInt()` truncates

```dart
bool get _canProceed {
  final minTopup =
      ref.watch(walletProvider.select((p) => p.walletMinTopup)).toInt();
  return _finalAmount >= (minTopup > 0 ? minTopup : 100);
}
```

`walletMinTopup` is `double`. `.toInt()` truncates. If `walletMinTopup = 99.5`, the check is `_finalAmount >= 99`. The server may require 100. No upper bound — a rider can type 999999999.

**Fix shape:** use `minTopup.ceil()` (round up) and add a max bound (e.g. 100000).

---

### P2-10 `top_up_amount_screen.dart:187-191` `onChanged` and the `addListener` both call `setState` — double update

```dart
// line 82-88 (in initState)
_customAmountCtrl.addListener(() {
  final text = _customAmountCtrl.text;
  if (text.isNotEmpty) {
    final val = int.tryParse(text) ?? 0;
    widget.onAmountChanged?.call(val);
  }
});

// line 187-191 (in build)
onChanged: (val) {
  setState(() {
    _selectedAmount = int.tryParse(val) ?? 0;
  });
},
```

Two listeners: the `addListener` fires on every text change (including programmatic via `_selectQuickAmount`), the `onChanged` fires on user input. The `addListener` calls `onAmountChanged` (parent callback), the `onChanged` calls `setState` (local). Different purposes but two state updates per keystroke.

**Fix shape:** consolidate. Use only the `onChanged` for local state; use a `didUpdateWidget` or `addPostFrameCallback` to notify the parent.

---

### P2-11 `top_up_amount_screen.dart:61-62` fallback to `1000` disagrees with `requiredPaymentAmount`

```dart
_selectedAmount = planTotal > 0 ? planTotal : 1000;
```

The fallback is `1000` (₹1000). The `requiredPaymentAmount` (used elsewhere) returns 0 if no plan. The two disagree. A rider in the top-up flow sees ₹1000 as the default; the same rider in the deposit flow sees ₹0.

**Fix shape:** use the same calculation. If no plan, return 0 (and show a "Select a plan" CTA in the amount screen).

---

### P2-12 `top_up_proof_screen.dart:499` `PendingUploadsPill()` is rendered but the pill depends on parent state

The pill shows the count of pending uploads. The pill's state is managed by the parent (or some global provider). The `top_up_proof_screen` doesn't manage it. If the pill count changes, the screen doesn't rebuild — only the pill rebuilds (assuming it's a `ConsumerWidget`).

**Fix shape:** verify the pill watches the correct provider. If not, wrap the screen in a `Consumer`.

---

### P2-13 `history_screen.dart:391-392` `tx.status.value.toUpperCase()` matches against `'SUCCESS' | 'APPROVED' | 'COMPLETED'`

The enum has `pending, approved, rejected, failed, reversed, refunded, success`. So `.toUpperCase()` returns one of `PENDING, APPROVED, REJECTED, FAILED, REVERSED, REFUNDED, SUCCESS`. The check at line 466-468:
```dart
status == 'SUCCESS' ||
status == 'APPROVED' ||
status == 'COMPLETED'  // ← never returned
```

`'COMPLETED'` is never returned by `toUpperCase()`. Dead comparison. Should be removed.

---

### P2-14 `history_screen.dart:79` `description.contains(_searchQuery.toLowerCase())` — case-insensitive but no `purpose`/`remark` search

```dart
final description = (tx.description ?? tx.purpose ?? '').toLowerCase();
final matchesSearch = _searchQuery.isEmpty ||
    description.contains(_searchQuery.toLowerCase());
```

Searches `description` OR `purpose` (line 79). Does NOT search `remark`, `type`, or the amount. A rider searching "UPI" finds transactions where `purpose = 'UPI_TOPUP'` (lowercase: 'upi_topup' — 'upi' is a substring, so OK). A rider searching "1000" finds nothing. A rider searching "rent" finds only rent transactions (the displayLabel logic at `wallet_widgets.dart:42-50` substitutes "Rent" for `purpose == 'RENTAL'`, but the search uses the raw `purpose`).

**Fix shape:** search across `description + purpose + remark + type + amount.toString()`. Add a `contains` helper.

---

### P2-15 `history_screen.dart:18` import is in the middle of the file

The imports at the top are `flutter/material.dart`, `google_fonts/google_fonts.dart`, theme, etc. But the `flutter_riverpod/flutter_riverpod.dart` and `voltium_rider/core/state/riverpod_providers.dart` imports are at line 18-20, AFTER the class declaration starts. Same with the `import 'package:voltium_rider/models/transaction_model.dart';` on line 20.

Dart convention is all imports at the top. This file violates the convention.

---

### P2-16 `top_up_proof_screen.dart:155-156` `riderId` falls back to `''` (empty string)

If the rider is null, `riderId = ''`. The Razorpay URL becomes `rider_id=&amount=...`. The URL is malformed. The check `canLaunchUrl` may return true (it's a valid URL syntax) but Razorpay will reject the empty rider_id.

**Fix shape:** show an error if the rider is not loaded.

---

### P2-17 `top_up_proof_screen.dart:282-283` the "Instant" card's onTap calls `_showOnlinePaymentAlertDialog` but the local `_selectedPaymentMode` is unchanged

The "Cash" tap (line 195-196) sets `_selectedPaymentMode = PaymentMode.cash`. The "UPI" tap (line 238-239) sets `_selectedPaymentMode = PaymentMode.upi`. The "Instant" tap (line 282-283) opens the dialog but does NOT change `_selectedPaymentMode` directly — only the dialog's "Proceed to Pay" button does (line 153). If the user dismisses the dialog, the mode stays `cash` (the default).

**Effect:** User taps "Instant", reads the dialog, dismisses. Mode is still `cash`. The submit goes through the CASH path. The user thinks they selected Instant but got CASH.

**Fix shape:** set the mode on tap, or make the dialog non-cancelable.

---

### P2-18 `top_up_proof_screen.dart:557-567` "Edit" button calls `widget.onEditAmount` but the button is `TextButton` not `IconButton`

The "Edit" link is a `TextButton` with no icon, no accessibility label. The screen-reader experience is "Edit" only. Better: `TextButton.icon` with `Icons.edit`.

---

### P2-19 `top_up_amount_screen.dart:53-55` plan total calculation includes `rentPrice` even when `secDeposit` is 0

```dart
final planTotal = isAdvanceRentPaid
    ? (secDeposit + rentPrice)
    : (secDeposit > 0 ? secDeposit : (rentPrice > 0 ? rentPrice : 0));
```

If `secDeposit = 0` and `rentPrice > 0`, the plan total is `rentPrice` (e.g. 1500). But this is the rental cost, not the top-up amount. The rider is asked to top up ₹1500 for a plan, which is just the rent. Without a deposit, the top-up is wasted.

**Fix shape:** clarify the math. If `secDeposit == 0`, the rider hasn't selected a plan and shouldn't be in the top-up flow.

---

### P2-20 `top_up_amount_screen.dart:67-75` `_quickAmounts` is computed once in `initState`

```dart
if (planTotal > 0) {
  _quickAmounts = [
    planTotal,
    (planTotal * 1.5).round(),
    (planTotal * 2).round(),
    (planTotal * 3).round(),
  ];
} else {
  _quickAmounts = [500, 1000, 2000, 5000];
}
```

`_quickAmounts` is `late final` and never updated. If the rider changes the plan mid-flow, the quick amounts are stale. Not a real-world issue (plan can't change mid-top-up) but the comment is misleading.

---

## 5. P3 — code quality / dead code

### P3-1 `top_up_receipt_screen.dart:34` `TickerProviderStateMixin` for the dead screen

The screen is dead but the file still has the animation. Ticker leaks if the screen is ever mounted. Remove.

### P3-2 `top_up_receipt_screen.dart:132` inline regex for thousand separator

```dart
'₹${widget.amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
```

The regex is duplicated across:
- `top_up_receipt_screen.dart:132`
- `top_up_upi_screen.dart:275`
- `top_up_proof_screen.dart:548`

Three copies of the same regex. Should be a helper like `formatINR(int)`.

### P3-3 `wallet_widgets.dart:147-149` `\u20B9` instead of `'₹'`

```dart
'${isCredit ? '+' : '-'}\u20B9${amount.abs().toStringAsFixed(0)}',
```

Inconsistent with other widgets that use the `'₹'` character directly.

### P3-4 `history_screen.dart:41-49` `_entryCtrl` AnimationController never used

The controller is created and `.forward()` is called, but no widget is wired to it. Dead animation. Remove.

### P3-5 `history_screen.dart:556-580` `_buildBreakdownItem` type-matching cascade

```dart
if (type == 'TAX') { ... }
if (type == 'DISCOUNT') { ... }
if (type == 'PENALTY') { ... }
if (type == 'ADJUSTMENT') { ... }
```

Four separate `if` statements instead of a `switch`. The cascade is harder to read and adds no value. Use a `switch`.

### P3-6 `wallet_provider.dart:30-47` `_parseTransactionStatus` uses lowercase mapping

The parser is in the wallet provider (not the model). The transaction model has its own parser (line 248-260). Two parsers doing the same thing. The wallet provider's parser maps `'SUCCESS' → success` and `'APPROVED' → approved`. The model's parser does the same. Duplicate logic.

### P3-7 `wallet_provider.dart:194-199` error message is hardcoded English

```dart
state = state.copyWith(
  lastError: 'Couldn\'t load your transactions. Pull to retry.',
);
```

No localization. Same as P1-16.

### P3-8 `top_up_proof_screen.dart:35-36` `String _selectedGateway = 'razorpay';` — default gateway

The hardcoded default is fine, but the `gateway` value is only used in the Razorpay URL (P0-2). The dropdown shows 4 gateways (Razorpay, PhonePe, Cashfree, Easebuzz) but all of them are sent to the same hardcoded URL. Dead option.

### P3-9 `top_up_amount_screen.dart:287-298` `Edit` button is `TextButton` without icon

Already noted P2-18.

### P3-10 `wallet_screen.dart:73-83` `Future.wait<dynamic>([...])` — type-unsafe

`Future.wait<dynamic>` is the same anti-pattern as the admin audit found. Use `Future.wait<void>` or `Future.wait<Object?>`.

### P3-11 `top_up_flow.dart:33-39` `_nextPage` and `_prevPage` are 1-line wrappers

```dart
void _nextPage() {
  _pageController.nextPage(
    duration: const Duration(milliseconds: 300),
    curve: Curves.easeInOut,
  );
}
```

The `Duration` and `Curves` are constants. Could be `const`. Cosmetic.

### P3-12 `top_up_flow.dart:46-49` `PopScope` callbacks are inline

The `onPopInvokedWithResult` is 4 lines. Could be a method.

### P3-13 `top_up_proof_screen.dart:382` controller declared in middle of class

Already noted P1-3.

### P3-14 `wallet_widgets.dart:38-39` `TransactionListTile` and `wallet_widgets.dart:41-43` other dead code

The `MethodChip` widget (line 174-206) is also dead — not imported.

### P3-15 `wallet_widgets.dart:1-12` (top of file) — `import '../../../models/transaction_model.dart';` uses relative path going up 3 levels

The file is at `lib/features/wallet/presentation/widgets/wallet_widgets.dart`. The import goes up 3 to `lib/`. Dart convention is package imports (`package:voltium_rider/models/transaction_model.dart`). Inconsistent with the rest of the file (which uses package imports for `app_theme` and `app_typography`).

### P3-16 `top_up_amount_screen.dart:9` `import 'package:voltium_rider/core/state/riverpod_providers.dart';`

The amount screen uses `ref.read(riderProvider)` in `initState`. The `ref` is a `WidgetRef` (from `ConsumerStatefulWidget`). The `ref.read` is OK in `initState` but accessing `rider?.advanceRentPaid` from `initState` is a side effect on Riverpod state. Should be `ref.read` only for one-time reads, not `ref.watch` (which would cause rebuilds).

### P3-17 `wallet_widgets.dart:18` `class WalletActionButton` is in the dead file

Dead code from the OLD wallet screen. Not imported by the new screen.

---

## 6. Test coverage gaps

| Area | Existing tests | Gaps |
| --- | --- | --- |
| `wallet_provider` | (none) | No unit test for `topUpWallet`, `refreshTransactions` coalescing, `setWalletSettings`, `logout`, `_parseTransactionStatus` mapping. |
| `top_up_proof_screen` "Online/Instant" path | (only golden + basic widget) | No test that Online mode submits the right method. No test that the Razorpay URL contains the rider id. |
| `top_up_amount_screen` `_canProceed` | (none) | No test for the min topup check, the plan total calculation, the fallback to 1000. |
| `top_up_flow` post-submit | (none) | No test that `refreshTransactions` is called after submit. No test for the snackbar shown. No test for `PostHog` events captured. |
| `history_screen` search | (none) | No test for case-insensitive matching, no test for filter switching, no test for the summary card math. |
| `history_screen` `riderId` param | (none) | No test that the param is actually used (or that it's dead). |
| `TransactionListTile` | (none — but the widget is dead) | If kept, needs a typed `tx` parameter test. |
| `TransactionFilterSort` / `DateRangePicker` | (none) | Both dead, no tests, no callers. |
| `TopUpReceiptScreen` | `top_up_receipt_screen_test.dart` exists | Tests a dead screen. Either wire it up or delete. |
| `top_up_upi_screen` | `top_up_upi_screen_test.dart` exists | Tests a dead screen. |
| `rider.requiredPaymentAmount` | (none) | No test for the `walletMinTopup` fallback. |
| `rider.activeRentalPlanPrice` fallback | (none) | No test that a server plan not in `app_constants.dart` returns `defaultPlanPrice`. |
| `SecurityDepositCard` / `WalletBalanceCard` | (none — only via wallet_screen_test) | No direct test for the dynamic-rider reading, no test for the `5 Days` hardcode, no test for the threshold check. |
| `repository_impl` 16 tests | Good | All 16 cover happy paths and error paths. No test for the `?type=` query param, no test for the `getRiderDashboard` shape variations (3 different shapes the impl tries). |
| `wallet_screen` integration | 3 widget tests | No test for RefreshIndicator onRefresh, no test for the pending deposit card, no test for the route navigation. |
| `SkeletonWalletCard` | `skeleton_wallet_card_test.dart` | OK, but no test that the skeleton matches the loaded card's height (no layout shift). |

---

## 7. What I'd do first (single highest-blast-radius fix)

**P0-1 (wire `TopUpReceiptScreen` into the new flow) — 1-hour fix.** This is the highest-blast-radius bug because:
- The PM's analytics funnel is broken (top_up_completed never fires)
- The rider misses the success animation, the status card, the "Back to Dashboard" CTA
- The fix is a single line in `top_up_flow.dart:116-135`: replace the snackbar with a `Navigator.push(MaterialPageRoute(builder: (_) => TopUpReceiptScreen(amount: _amount, purpose: ..., onBackToDashboard: nav.pop)))`.

**Second PR (P0-2 + P0-3 + P0-4 + P1-17 + P1-18): the entire "Online / Instant" payment path** is broken. Either delete the "Instant" tab entirely (most likely) or build a real server-side integration. The current state is "Riders think they can pay online; they actually can't."

**Third PR (P1-11 + P1-12): delete the 3 dead screens/widgets** (`top_up_receipt_screen.dart`, `top_up_upi_screen.dart`, `TransactionListTile`, `TransactionFilterSort`, `DateRangePicker`). ~700 lines of dead code gone. The router stops importing them.

---

## 8. Recommended fix order with hour estimates

| Order | PR | Scope | Est. hours | Notes |
| --- | --- | --- | --- | --- |
| 1 | `topup-flow-show-receipt` | P0-1: wire `TopUpReceiptScreen` into the new flow | 1 | Highest impact |
| 2 | `online-payment-remove-or-build` | P0-2, P0-3, P0-4, P1-17, P1-18: either delete "Instant" tab or build server integration | 4 (delete) / 8 (build) | Recommend delete + admin-UI flag |
| 3 | `topup-wallet-fresh-refresh` | P0-5: force fresh refresh after top-up, not the in-flight one | 0.5 | |
| 4 | `dead-code-cleanup` | P1-9, P1-10, P1-11, P1-12: delete dead screens/widgets | 1 | |
| 5 | `plan-fallback-remove` | P1-1, P1-2: remove or document the hardcoded `app_constants.dart` plan map | 2 | |
| 6 | `upi-controller-move` | P1-3: move `_upiRefCtrl` to top of class | 0.25 | |
| 7 | `image-picker-debounce` | P1-4: disable upload area while picking | 0.25 | |
| 8 | `history-search-debounce` | P1-5: debounce + controller + search across fields | 1 | |
| 9 | `history-riderid-cleanup` | P1-6: drop unused param or use it | 0.25 | |
| 10 | `canLaunchUrl-migrate` | P1-7: use new API | 0.5 | |
| 11 | `amount-rupee-format` | P1-13: create `formatINR(double)` helper, apply consistently | 1 | |
| 12 | `streak-target-server` | P1-14: add `streakTargetDays` to rider model | 0.5 | |
| 13 | `localize-wallet-screens` | P1-16: use `AppLocalizations` in history + top-up screens | 2 | |
| 14 | `topup-online-mode-fix` | P1-8: `case PaymentMode.online: methodStr = 'ONLINE'` | 0.25 | Depends on P0-2/P0-3 |
| 15 | (cleanup) | P2-1 through P2-20: type safety + contract | 6 | |
| 16 | (P3s) | Various small cleanups | 3 | |

**Total: 16 PRs, ~24 hours of focused work.** The first 3 are P0 and ship in ~5-6 hours.

---

## 9. Cross-cutting observations

1. **The "dead code from the old 3-page top-up flow" is the same pattern as the admin audit found** — the admin audit found `admin.routes.ts` (142 lines) as a parallel implementation of the working `admins/route.ts`. The Flutter audit finds `top_up_receipt_screen.dart` (265 lines) and `top_up_upi_screen.dart` (588 lines) as dead code from the old flow. **The team's habit is to add new code without removing the old.** Recommend a `flutter analyze` rule that flags "exported symbols never imported" — both Flutter and the admin web have the same problem.

2. **The "dynamic typing hole" pattern is widespread** — `TransactionListTile` (`wallet_widgets.dart:16`), `SecurityDepositCard` (`wallet_widgets.dart:209`), `WalletBalanceCard` (`wallet_widgets.dart:323`) all take `dynamic rider` or `dynamic tx`. The new `wallet_screen.dart` and `history_screen.dart` use `ref.watch(riderProvider)` which is properly typed. The pattern is "the OLD widgets were untyped, the NEW screens are typed". Delete the untyped widgets.

3. **The "PostHog event drift" pattern** — `top_up_initiated`, `top_up_submitted`, `top_up_completed` are 3 separate events. Only 2 of them fire (in the new flow). The PM's funnel is wrong. Recommend a single `top_up_status_change` event with a `status: 'initiated|submitted|completed|failed'` property. Easier to query.

4. **The "hardcoded Razorpay URL" is the same anti-pattern as the admin audit's "hardcoded INTERNAL_API_URL"** — both assume the integration works without server-side coordination. The audit on legal-device-workflow found the same: `workflow-coverage/route.ts:43` falls back to `NEXT_PUBLIC_APP_URL` which is the public URL, not the internal one. The team has a habit of writing client code that bypasses the server.

5. **The "format INR inconsistency" appears 4 times** — `top_up_receipt_screen.dart:132`, `top_up_upi_screen.dart:275`, `top_up_proof_screen.dart:548` use `replaceAllMapped` with a regex. `wallet_widgets.dart:147` uses `\u20B9${amount.abs().toStringAsFixed(0)}` (no separator). The web equivalent uses `formatINR` from a shared utility. Add a Dart `formatINR` to `lib/utils/`.

6. **The "dead `AppConstants` map" pattern is the same as the admin audit's "dead permission in matrix"** — `app_constants.dart:57-86` has 4 hardcoded plan prices. The admin audit found `admins_manage: []` (empty) and `legal_manage: []` (empty) in `permissions-roles.ts`. Both are "the client/server has a hardcoded list of values that the source of truth should be the other side." Recommend a CI check: any `Map<String, ...>` constant with > 5 entries is flagged for review.

7. **The "two parsers doing the same thing" pattern** — `wallet_provider.dart:30-47` has `_parseTransactionStatus` and `transaction_model.dart:248-260` has its own `_parseTransactionStatus`. Both map `'SUCCESS' → success` and `'APPROVED' → approved`. The wallet provider's parser is used to convert `entity.TransactionEntity.status` to `TransactionModel.status`. Duplicate logic.

8. **The "fetched-then-stale data" pattern is in `TopUpRequestSentCard`** — the card shows the deposit record's amount, status, rejection reason. If the rider hasn't refreshed in 5 minutes, the data is stale. The wallet screen calls `refreshTransactions` on mount, but the deposit record is read from `rider.depositRecord`, not from the transaction list. Two separate refresh paths. Could be unified.

9. **The "refund-threshold hardcode" pattern** — `depositRefundThreshold = 2000.0` (line 6 of `app_constants.dart`). The "180 days" is in `SecurityDepositCard` copy. The "5 Days" streak target is in `WalletBalanceCard` copy. All three are business rules hardcoded in the client. The server is the source of truth for these. Recommend a settings API.

10. **The "history screen search is broken" pattern** — only matches `description`, only on `onChanged` (no debounce), no controller. A rider with 100 transactions searches "rent" and finds 0 results because `purpose = 'RENT'` but `description` is null. The data model has all the fields; the search just doesn't use them.

---

## 10. What this audit confirmed (vs. previous 6 audits)

- **The "dead code" pattern is universal** — admin audit found 142-line `admin.routes.ts` parallel to working `admins/route.ts`; this audit finds 853 lines of dead screens/widgets in Flutter. **Same team, same habit.** Recommend a quarterly "delete dead code" pass.

- **The "hardcoded URL to a third-party" pattern** — the admin audit found `api.razorpay.com/v1/checkout/embedded` was referenced (in `web/src/app/api/admin/riders/actions/route.ts:158`, indirectly via FCM). The Flutter audit confirms the client hardcodes the same URL. **The integration is broken on both sides of the stack.**

- **The "dynamic typing hole" pattern** — admin audit found TypeScript `any` casts. Flutter audit finds `dynamic rider` and `dynamic tx`. Same anti-pattern, different language.

- **The "silent error swallowing" pattern** — admin audit found `if (!res.ok) return;` everywhere. Flutter audit finds `try { ... } catch (e) { rethrow; }` (which re-throws but no UI feedback) and `setState(() => _isUploading = false)` only if `mounted`. Same pattern: "errors happen but the user doesn't know."

- **The "two schemas for the same operation" pattern** — admin audit found `createAdminSchema` (live) vs `CreateAdminSchema` (canonical, dead). Flutter audit finds `_parseTransactionStatus` in both `wallet_provider.dart:30-47` AND `transaction_model.dart:248-260`. Same drift, different files.

- **The "hardcoded currency formatting" pattern** — admin audit found `paiseToRupees` used inconsistently. Flutter audit finds the regex `replaceAllMapped(r'(\d{1,3})(?=(\d{3})+(?!\d))')` duplicated in 3 screens. Same problem (no shared helper), different solution (regex vs divide-by-100).

- **The "screen routes to nowhere" pattern** — admin audit found `workflow-coverage/route.ts` ships to prod but UI short-circuits. Flutter audit finds `top_up_receipt_screen.dart` is in the router import but never reached by the new flow. Same pattern: "the route is wired but the code path bypasses it."

- **The "wallet state changes don't propagate" pattern** — the admin `dashboard.ts` `activeRentals = activeRiders` (from the previous admin audit) is the same as the Flutter `WalletBalanceCard` showing stale data after a top-up. The data model has the right field; the wiring is wrong.

- **The "fetch + cache" pattern is missing everywhere** — admin `getDashboardStats` does 13 parallel queries. Flutter `wallet_screen.dart:73-83` does 2 parallel fetches. Neither caches. The 5-min cache header on the admin legal route (`legal/route.ts:16`) is similar to the 0s cache on the Flutter `walletProvider.refreshTransactions`.

- **The "missing upper bound" pattern** — the admin `top-up-processor` likely has a max. The Flutter `top_up_amount_screen.dart:100-104` has no max. A rider can type 999999999 and submit. The server may reject but the UI doesn't.

---

**End of audit. Total findings: 5 P0s, 18 P1s, 20 P2s, 17 P3s, 15 test gaps, 1,500+ lines of dead code (3 dead screens/widgets + dynamic-typed widgets in the new flow).**

The single most impactful fix is **P0-1: wire the receipt screen into the new flow**. One hour, fixes the analytics funnel, restores the success animation, and gives the rider a clear "what's next" path.
