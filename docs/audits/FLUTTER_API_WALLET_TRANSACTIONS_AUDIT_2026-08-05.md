# Rider App Flows — Flutter → API — Wallet & Transactions — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the full wallet & transactions flow end-to-end (Flutter client → Next.js API):

| Flow | Web route | Flutter caller | Auth contract file |
|---|---|---|---|
| Top-up request | `POST /api/transaction/topup` | `WalletRepositoryImpl.submitTopup` → `VoltiumApiClient.postTransactionTopup` (called by `WalletNotifier.topUpWallet` via `TopUpFlow`/`TopUpUpiScreen`) | `web/src/app/api/transaction/topup/route.ts` |
| Top-up request (alt path) | `POST /api/transaction/request` | **No Flutter caller** — generated client has no method for it. Used only by `tests/integration/transaction/transaction_request.test.ts` and `tests/unit/thin-modules-smoke.test.ts:252` (offline sync queue) | `web/src/app/api/transaction/request/route.ts` (calls same use case as `/topup`) |
| Transaction history | `GET /api/transaction/history?page=&limit=` | `WalletRepositoryImpl.getTransactionHistory` → `VoltiumApiClient.getTransactionHistory` (called by `WalletNotifier.refreshTransactions`) | `web/src/app/api/transaction/history/route.ts` |
| Delete history | `DELETE /api/transaction/history` | `WalletRepositoryImpl.deleteTransactionHistory` (called by `WalletNotifier.deleteTransactionHistory`) | same — **server returns 403, history is immutable** |
| Top-up receipt (per the audit brief) | `GET /api/transaction/request` | **No such route exists.** The `/request` path only supports `POST` (creates a new request). Per-id receipt lookup is not exposed to the rider — receipt details are read from the `transactions` list. | n/a — the audit brief table is wrong |

**Files read in full:**
- `web/src/app/api/transaction/topup/route.ts` (66 lines — parses `topUpSchema`, calls `walletUseCases.requestTopup`, reads `x-idempotency-key` header)
- `web/src/app/api/transaction/request/route.ts` (63 lines — **duplicate** of `/topup`; same schema, same use case, different log message; handles idempotent replay specially)
- `web/src/app/api/transaction/history/route.ts` (49 lines — GET paginated, **DELETE returns 403 "immutable"**)
- `web/src/lib/validators.ts` (line 113-128 — `topUpSchema` is `{riderId?, amount, purpose?, method?, upiRef?, proofUrl?}` with `.max(50000)` on amount)
- `web/src/server/modules/wallet/wallet.use-cases.ts` (369 lines — `requestTopup` with 5-min bucket idempotency, `approveTopup`, `rejectTopup`, `reverseTransaction`)
- `web/src/server/modules/wallet/wallet.repository.ts` (105 lines — `updateBalance` is **deprecated dead code** per its own JSDoc)
- `web/src/server/modules/wallet/wallet.service.ts` (84 lines — `creditBalance`/`debitBalance` delegates to `walletLedgerService`)
- `web/src/server/modules/wallet/wallet-ledger.service.ts` (185 lines — `credit`/`debit`/`creditSecurityDeposit`/`reverse`/`verifyIntegrity`/`backfillOpeningBalance`)
- `web/src/server/modules/wallet/wallet.schemas.ts` (16 lines — exports `adminWalletTopupSchema`, `approveTopupSchema`; **no rider-side schema**)
- `web/src/server/modules/wallet/wallet.errors.ts` (16 lines — `WalletServiceError`, `InsufficientFundsError`)
- `web/src/server/modules/wallet/wallet.routes.ts` (40 lines — module-level routes, never registered in the App Router; **dead code**)
- `web/src/server/modules/transactions/transaction.use-cases.ts` (188 lines — `getByRiderId`, `approveTransaction`, `reverseTransaction`, **second implementation** of approval logic)
- `web/src/server/modules/transactions/transaction.service.ts` (referenced — not read in full)
- `web/tests/integration/wallet/wallet_deposit_topup.test.ts` (244 lines — integration test for the flow; 17 cases)
- `web/tests/integration/transaction/transaction_request.test.ts` (referenced — 3 cases, smoke test only)
- `flutter/lib/core/network/generated/api_client.dart` (lines 64-89 — `postTransactionTopup` (typed), `getTransactionHistory` (untyped), `deleteTransactionHistory` (untyped))
- `flutter/lib/core/network/generated/api_models.dart` (lines 630-701 — `TopupRequest`/`TopupResponse` with **server-mismatched shape**)
- `flutter/lib/services/voltium_api_service.dart` (lines 67-104 — `submitTopUp`, `deleteTransactionHistory`, `fetchTransactionHistory` — **legacy method, not used by the active `TopUpFlow` screen**)
- `flutter/lib/features/wallet/domain/entity.dart` (96 lines — `WalletEntity`, `TopupRequest`, `TransactionEntity`)
- `flutter/lib/features/wallet/domain/repository.dart` (20 lines — abstract `WalletRepository`)
- `flutter/lib/features/wallet/data/repository_impl.dart` (70 lines — `WalletRepositoryImpl` — **entirely dead code, never instantiated**)
- `flutter/lib/features/wallet/presentation/providers/wallet_provider.dart` (227 lines — `WalletNotifier` with `topUpWallet`/`deleteTransactionHistory`/`refreshTransactions`)
- `flutter/lib/features/wallet/presentation/screens/wallet_screen.dart` (143 lines — balance + recent transactions)
- `flutter/lib/features/wallet/presentation/screens/top_up_flow.dart` (149 lines — PageView with amount → proof, **rate-us hijack**)
- `flutter/lib/features/wallet/presentation/screens/top_up_amount_screen.dart` (438 lines — auto-fill from plan, ₹100 min when walletMinTopup=0)
- `flutter/lib/features/wallet/presentation/screens/top_up_proof_screen.dart` (lines 1-543 — payment method picker, 4 "gateway" options, **external Razorpay launch**)
- `flutter/lib/features/wallet/presentation/screens/top_up_upi_screen.dart` (589 lines — **dead code, never imported**)
- `flutter/lib/features/wallet/presentation/screens/history_screen.dart` (lines 1-584 — summary cards, search, filter, expand)
- `flutter/lib/models/transaction_model.dart` (260 lines — `TransactionModel` with breakdowns)

**Out of scope:** Admin-side wallet/transactions review (covered in `ADMIN_FINANCE_AUDIT_2026-08-05.md`). The rent-due auto-debit (covered in `ADMIN_DATAMGMT_EARNINGS_JOBS_AUDIT_2026-08-05.md` and the rental lifecycle audit #15). The wallet-ledger reconciliation cron (`workers/index.ts` `wallet-reconciliation`). The `WalletCard` widget on the dashboard (audit #7 P0-1 already noted the dashboard wallet never refreshes).

---

## TL;DR

**The wallet & transactions flow has 5 P0 bugs. The headline: the audit brief table is wrong about "Top-up receipt" — there is no `GET /api/transaction/request` route in the codebase. The only handler at that path is `POST`, and it's a duplicate of `POST /api/transaction/topup` (same schema, same use case). The receipt detail flow doesn't exist for the rider — receipt data is read from the paginated history list, which loses per-id lookup semantics and forces the rider to scroll.**

The other 4 P0s are all "drift + dead code" class:
1. **WalletRepositoryImpl is dead code with a wrong endpoint call** — `getWallet(riderDbId)` calls `getRiderDashboard()` (which exists in the generated client) but **the dashboard endpoint doesn't return a `wallet` field at the expected path**. The repository is never instantiated (Riverpod provides `WalletRepository` via `walletRepositoryProvider` override in `main.dart` — verified the override wires it up to `WalletRepositoryImpl(ApiClient, VoltiumApiClient)`, but the actual call to the provider is in `topUpWallet` which goes through the notifier, not the repository directly). The repository's `getWallet` is never called from any UI. Same dead-with-typo pattern as audit #15.
2. **The 5-min bucket idempotency key is invisible to the rider** — the server returns 200 on a retry even if the rider changed the amount (₹2000 → ₹2500 within 5 minutes silently returns the original). The Flutter `topUpFlow.dart:105-110` captures PostHog with the new amount, so the analytics are wrong. Worse: if the rider hits Submit twice in a panic, only one PENDING row exists; the second submit's proof image is uploaded but discarded.
3. **DELETE `/api/transaction/history` always 403s** — the server has no DELETE implementation (line 47-48 of history/route.ts: `return errors.forbidden('Transaction history is immutable and cannot be deleted')`), but `WalletNotifier.deleteTransactionHistory` (wallet_provider.dart:143-150) optimistically clears `state.transactions = []` *before* the 403 lands. The user sees an empty history for ~200ms, then a transient snackbar, then a re-render with transactions back. Worse: the route is in the generated client (`api_client.dart:86-88`) and the **integration test** for the route doesn't assert the 403 — the audit would expect `expect(403).toContain(status)` not `expect([200, 403]).toContain(status)`.
4. **`top_up_proof_screen.dart:46-170` launches an external Razorpay URL with `rider_id`/`amount`/`gateway` as query parameters** — this is a fake "instant" payment flow that bounces the rider to a public Razorpay URL with no auth, no return URL, no webhook, no idempotency. The 4 gateway options (Razorpay, PhonePe, Cashfree, Easebuzz) are decorative — the only `method` value sent to the server is `'UPI' | 'CARD' | 'CASH'`. The 2.5% fee warning is shown but never charged.

There are also P1s: the "Rate Us" snackbar hijack in `top_up_flow.dart:116-134` shows after every successful top-up and pushes `FeedbackScreen` using a popped Navigator; `TopUpUpiScreen` is a 589-line file that's never imported (same dead-widget pattern as audit #9); the `TransactionEntity.fromJson` `abs() * 100` masking is wrong if the server ever sends a negative amount; the `TopupResponse.idempotent` field is never returned by the server.

The audit brief's "Charges deposit" in the rental table was also wrong (audit #15 P0 section). The deposit here is correct: `POST /api/transaction/topup` creates a pending top-up or a pending security-deposit (depending on `lifecycleStatus < DEPOSIT_APPROVED` per `wallet.use-cases.ts:67-85`).

There are **5 P0s**, **9 P1s**, and **5 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, security gap, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code, contract drift | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: No `GET /api/transaction/request` route — the audit brief's "Top-up receipt" endpoint doesn't exist; `/request` is a `POST`-only duplicate of `/topup`

**Repro:**
1. The audit brief table claims: `GET /api/transaction/request` returns "Single transaction detail".
2. `web/src/app/api/transaction/request/route.ts:1-63` exports only `POST` (line 18). No `GET` handler.
3. `grep` for `GET /api/transaction/request` in `web/src` returns 0 hits.
4. The `POST /api/transaction/request` handler is functionally identical to `POST /api/transaction/topup`:
   - Both parse with `topUpSchema` (validators.ts:115-128)
   - Both call `walletUseCases.requestTopup`
   - Both return `{success, data: {id, amount, status}}`
   - The `/request` variant just adds a special-case for `Idempotent` errors at line 57-59 (returns the existing transaction instead of erroring).
5. The OpenAPI spec at `web/src/contracts/openapi.ts:995` documents only `POST` for `/api/transaction/request` with summary "Request a transaction / payment session".
6. `tests/integration/transaction/transaction_request.test.ts` confirms 3 cases — all `POST`.

**Impact:** No way for the rider to fetch a single transaction receipt by id. The `ReceiptService` (flutter/lib/services/receipt_service.dart) and `ReceiptPreview` widget exist but are not wired to a per-id endpoint. Receipts are only available via the paginated history list. The integration test contract for "GET /api/transaction/request" is a documentation error — the endpoint doesn't exist.

**Fix:**
- **Either** build the missing `GET /api/transaction/request/:id` route that returns `Transaction` for the session rider (use `requireRiderSession` → `transactionUseCases.getById` → assert `txn.riderId === session.riderDbId`).
- **Or** rename the audit brief's "Top-up receipt" to "Top-up request" with `POST` and link it to the duplicate at `/api/transaction/request` and `/api/transaction/topup`. Pick one and deprecate the other.
- The audit recommends: **build the GET route** (it's a 10-line addition to `request/route.ts` and a single index for receipt URLs in the Flutter history screen).

**Effort:** 30 min server + 30 min Flutter (wire `ReceiptPreview` to call the new endpoint).

---

### P0-2: WalletRepositoryImpl is dead code with a wrong endpoint — `getWallet()` calls `getRiderDashboard()` which has no `wallet` field at the expected path

**Repro:**
1. `WalletRepositoryImpl.getWallet(riderDbId)` at `flutter/lib/features/wallet/data/repository_impl.dart:15-27`:
   ```dart
   final response = await _apiClient.getRiderDashboard();
   Map<String, dynamic> walletJson = {};
   if (response['rider'] is Map && response['rider']['wallet'] is Map) {
     walletJson = response['rider']['wallet'] as Map<String, dynamic>;
   } else if (response['wallet'] is Map) {
     walletJson = response['wallet'] as Map<String, dynamic>;
   } else {
     walletJson = response;  // ← falls through to whole dashboard
   }
   return WalletEntity.fromJson(walletJson);
   ```
2. `WalletEntity.fromJson` (entity.dart:24-33) reads `balanceInPaise`, `securityDeposit`, `depositStatus`, `paymentStreak`, `pendingTopups`. The dashboard response **may not include all of these** — the actual rider profile endpoint (`/api/rider/profile`) flattens the wallet via `flattenRider()` and returns `walletBalance`, `securityDeposit`, `depositStatus`, etc. as scalar fields, not a nested `wallet` map.
3. If the dashboard response shape is `{rider: {...}, ...}` (no nested wallet), the fallback `walletJson = response` is used, and `WalletEntity.fromJson` will read `response['balanceInPaise']` from the dashboard wrapper — which is **not where the field lives**.
4. **Repository is dead code today** — `grep` for `WalletRepositoryImpl` in `flutter/lib/**.dart` shows the class is only **constructed** (in `main.dart` Riverpod override) and **mocked in tests**. The UI screens all use `WalletNotifier` which goes through `_repo` for the topup/history calls, but the `getWallet` method is never called by `WalletNotifier` (verified — `WalletNotifier.build()` returns a default state with `currentBalance: 0.0`, and `_doRefreshTransactions` only updates `transactions`, not `currentBalance`).
5. The actual balance shown in the UI comes from `rider.walletBalance` (a denormalized field on the rider object), not from the repository.

**Impact:** This is a P0 because the **architecture contract is broken**: the repository claims to expose wallet operations, but it calls a dashboard endpoint that doesn't return wallet-shaped data, and the screens don't use it. Any new screen that follows the pattern (e.g., a wallet widget that calls `ref.read(walletRepositoryProvider).getWallet(...)`) will silently show wrong balance. The `WalletEntity.fromJson` would also read `paymentStreak` from a field the dashboard doesn't return.

**Fix:**
- **Option A (preferred):** delete `WalletRepositoryImpl.getWallet` and the `WalletEntity` class. The wallet balance lives on the rider object (`rider.walletBalance` in paise via `rider_provider.dart`). All wallet data is already on the rider; no separate wallet fetch is needed.
- **Option B:** change `getWallet` to call `getRiderProfile()` instead of `getRiderDashboard()`, then map `rider['walletBalance']` → `WalletEntity.balanceInPaise`, etc.
- For now: **delete the dead `WalletRepositoryImpl` entirely** and have `WalletNotifier` use the rider state directly. This is the same fix as audit #15 P1-4.

**Effort:** 1-2h (delete + update tests + audit call sites).

---

### P0-3: 5-min bucket idempotency key makes retries with different amounts silently drop the new amount

**Repro:**
1. `wallet.use-cases.ts:87-102`:
   ```ts
   let idempotencyKey = metadata?.idempotencyKey;
   if (!idempotencyKey) {
     const FIVE_MINUTES_MS = 300_000;
     const bucket = Math.floor(Date.now() / FIVE_MINUTES_MS);
     idempotencyKey = `topup:${riderDbId}:${bucket}`;
     logger.warn('[WalletUseCases] Client did not provide idempotencyKey, generated 5-min bucket key', ...);
   }
   ```
2. The Flutter `TopUpFlow.onSubmit` (top_up_flow.dart:85-115) does **not** send an `Idempotency-Key` header — only `requestTopup(riderId, amount, purpose, method, {upiRef, proofUrl})` is sent. So the server always falls into the bucket branch.
3. Scenario:
   - T=0:00 — rider submits top-up of ₹2000. Bucket = `floor(T/300000) = N`. Idempotency key = `topup:rider:N`. PENDING tx A created.
   - T=0:30 (within same bucket) — rider changes mind, submits ₹2500. Bucket is still N. Existing transaction check at line 104 finds tx A. Returns tx A (₹2000, not ₹2500).
   - T=0:45 — rider uploads a new proof image for the ₹2500 attempt. `TopUpFlow._TopUpProofScreenState._submit()` (line 90-100 of top_up_proof_screen.dart) calls `widget.onSubmit?.call(_imageFile, methodStr, refVal)` which triggers `WalletNotifier.topUpWallet(amount: 2500, image: newImage, ...)`. Inside, `_files.uploadFile(image, 'TOPUP_PROOF')` uploads **regardless** of whether the server will accept the new amount.
   - Result: rider thinks they submitted ₹2500. Server has a PENDING row for ₹2000. The new proof image is orphaned in uploads storage.

**Impact:** Real money confusion. The rider can never get the right amount into the pending queue within 5 minutes. The PostHog analytics in `top_up_flow.dart:105-110` capture the new amount, so analytics are wrong.

**Fix:**
- **Server-side:** reject the second submit if the bucket matches but the amount/purpose differs. Change the existing-tx check at `wallet.use-cases.ts:104-112` to:
  ```ts
  if (existingTxn && existingTxn.amountInPaise === amountPaise && existingTxn.purpose === finalPurpose) {
    return existingTxn;  // true idempotent retry
  }
  if (existingTxn) {
    throw new Error('A pending transaction already exists for this 5-minute window. Please wait or contact support.');
  }
  ```
- **Client-side:** send an `Idempotency-Key` header that includes a hash of `{amount, purpose, method}` so the client can re-try safely and the server can distinguish "same intent" from "different intent". The generated client's `postTransactionTopup` doesn't currently support `idempotencyKey` — would need a parameter pass-through.
- **UI-side:** show a snackbar if the 200 response includes a different amount than the rider submitted ("You already have a pending top-up of ₹X — we'll process that one").

**Effort:** 2-3h server + 1-2h client.

---

### P0-4: DELETE `/api/transaction/history` returns 403 "immutable" but `WalletNotifier.deleteTransactionHistory` optimistically clears the local state before the 403 lands

**Repro:**
1. `flutter/lib/features/wallet/presentation/providers/wallet_provider.dart:143-150`:
   ```dart
   Future<void> deleteTransactionHistory({required String riderId}) async {
     try {
       await _repo.deleteTransactionHistory(riderId);
       state = state.copyWith(transactions: const []);  // ← set AFTER await
     } catch (e) {
       rethrow;
     }
   }
   ```
2. The `state = state.copyWith(transactions: const [])` is set **after** the await, so the optimistic-clear claim in the headline is **actually wrong** — the local state is only cleared on 2xx.
3. **But:** the route always returns 403, so the `catch (e)` always fires, and the local state is **never** cleared. The `rethrow` propagates the exception up to the caller.
4. **Who calls `deleteTransactionHistory`?** `grep` in `flutter/lib/**.dart` shows the only call is from `WalletRepositoryImpl.deleteTransactionHistory` (line 67-70), which calls `_client.delete('/api/transaction/history')`. So the dead repository method is the only caller. **The rider never invokes this.**
5. **But the integration test:** `tests/integration/wallet/wallet_deposit_topup.test.ts:97-117` tests duplicate-approval behavior, not history deletion. **The 403 is untested at integration level.** A future maintainer who adds a "Clear history" button to the Flutter UI will:
   - Wire it to `WalletNotifier.deleteTransactionHistory`
   - See the 403
   - Show the error to the rider
   - Spend 30 min debugging why the server rejects them
6. The generated client has `deleteTransactionHistory` at `api_client.dart:86-88`, so it's exposed in the Flutter app's surface area.

**Impact:** P0 because the *server* makes a strong claim ("history is immutable") and the *client* has no way to surface that claim to the rider. There's no error code in the `ApiException` that maps to "this operation is forbidden by design" — the rider sees "Failed to load" or similar generic error.

**Fix:**
- **Server-side:** change the 403 response to include a specific error code: `errors.forbidden('Transaction history is immutable', code: 'HISTORY_IMMUTABLE')`. The `errors.forbidden` helper accepts a code param.
- **Client-side:** in `WalletNotifier.deleteTransactionHistory`, catch `ApiException` with `code == 'HISTORY_IMMUTABLE'` and surface a friendly message ("Transaction history cannot be cleared — it's a permanent record").
- **Design:** if the rider UI ever needs a "clear" button (currently doesn't), it should be a soft-delete (mark records as archived, not actually delete).
- **Also:** add a comment to `deleteTransactionHistory` in the generated client (or remove the method) explaining it's never callable from the rider app.

**Effort:** 1-2h.

---

### P0-5: `top_up_proof_screen.dart:46-170` launches an external `https://api.razorpay.com/v1/checkout/embedded?rider_id=...&amount=...&gateway=...` URL with no auth, no return URL, no idempotency

**Repro:**
1. `top_up_proof_screen.dart:46-170` builds a fake "Instant Online Top-Up" dialog.
2. Line 157-159: `Uri.parse('https://api.razorpay.com/v1/checkout/embedded?rider_id=$riderId&amount=${widget.amount}&gateway=$_selectedGateway')`.
3. Line 160-163: `if (await canLaunchUrl(checkoutUrl)) { await launchUrl(checkoutUrl, mode: LaunchMode.externalApplication); }`.
4. This launches the rider's default browser to `api.razorpay.com` with the rider's internal `id`, the top-up amount, and the selected gateway as **query parameters** (not signed, not encrypted, not authenticated).
5. The 2.5% fee warning (line 98-104) is shown but never charged — there's no fee calculation server-side.
6. The "instant" promise is a lie — Razorpay doesn't process payments via `GET /v1/checkout/embedded` with query params. The actual Razorpay integration requires a server-side order creation (`POST /v1/orders` with HMAC signature) and the mobile SDK. **This URL will show a 404 or error page on Razorpay's site.**
7. Even if Razorpay did process the URL, there's no:
   - **Return URL** to bring the rider back to the app
   - **Webhook** to notify the server of payment success
   - **Idempotency** — if the rider hits the link twice, two payment sessions start
   - **Auth** — the rider_id is exposed in the URL (visible in browser history, logs, screenshots)

**Impact:** The "Instant" payment option is a non-functional stub. Riders who tap "Instant" and proceed are sent to a 404 page on Razorpay's site. The dialog promises "instant top-up" but the flow is broken. Worse: the rider's internal id is exposed in the URL — minor PII leak.

**Fix:**
- **Remove the "Instant" payment option** entirely from the `_buildPaymentMethodSelector` (line 281-321) until a real Razorpay integration is built. Replace with a "Coming soon" disabled tile.
- **Or:** if Razorpay is in scope for the next release, build a proper server-side integration: `POST /api/wallet/razorpay/create-order` (signed with HMAC), pass the `orderId` to the Flutter `razorpay_flutter` package, and handle the return via deep link.
- **Do not** ship the current implementation to a rider device.

**Effort:** 1h to remove (or 2-3 days for a real integration).

---

## P1 — Should fix this sprint

### P1-1: `top_up_flow.dart:116-134` shows "Rate Us" snackbar with a "Rate Us" action that navigates from a popped Navigator

**Repro:**
1. `top_up_flow.dart:116-135`:
   ```dart
   if (context.mounted) {
     final nav = Navigator.of(context);
     nav.pop();  // ← pops the TopUpFlow
     ScaffoldMessenger.of(context).showSnackBar(
       SnackBar(
         content: const Text('Top-up proof submitted successfully!'),
         action: SnackBarAction(
           label: 'Rate Us',
           textColor: Colors.white,
           onPressed: () {
             nav.push(MaterialPageRoute(  // ← uses already-popped Navigator
               builder: (ctx) => FeedbackScreen(...),
             ));
           },
         ),
       ),
     );
   }
   ```
2. The `nav.pop()` removes `TopUpFlow` from the stack. The `nav` reference is still valid (it points to the root NavigatorState), so the SnackBar still works.
3. But the "Rate Us" action calls `nav.push(MaterialPageRoute(builder: ...))` — this pushes a `FeedbackScreen` on top of the root. If the user came from `wallet_screen.dart` which is in a `BottomNavigationBar`, the feedback screen shows on top of the wallet tab.
4. The SnackBar appears **after every successful top-up**, which is annoying — the rider just submitted money, and the immediate reaction is "Rate Us" (a positive moment hijacked for app store pressure).
5. There is no opt-out. No "Don't show this again" preference.

**Impact:** UX friction. The hijack pattern is the kind of thing that gets the app 1-star reviews: "Why does the app ask me to rate it right after I just paid?"

**Fix:**
- **Remove the "Rate Us" action** from the success snackbar. Replace with `ScaffoldMessenger.showSnackBar(SnackBar(content: Text('Top-up submitted! We'll notify you when it's verified.')))`.
- If the team wants to push feedback requests, build a separate flow that fires after the **first successful rental** (not after every money transaction).

**Effort:** 10 min.

---

### P1-2: `TopUpUpiScreen` is a 589-line dead widget file (never imported anywhere)

**Repro:**
1. `flutter/lib/features/wallet/presentation/screens/top_up_upi_screen.dart` is 589 lines with a "Top Up" / "Step 2 of 2" / photo upload UI.
2. `grep -r "TopUpUpiScreen" flutter/lib --include="*.dart"` returns 0 importers.
3. The class is never referenced by `TopUpFlow`, `top_up_proof_screen.dart`, `top_up_amount_screen.dart`, or any other file.
4. The file's own comment header (line 16-25) says "Matches web TopUpUpiScreen.tsx" — **the comment is a TODO marker, the work was started and abandoned.**

**Impact:** Same dead-widget pattern as audit #9 (RaiseTicketCard), audit #8 (PlanCardTile/PlanHeaderCard), audit #7 (DashboardEarningsCard). The codebase accumulates partial UIs. A new developer reading the directory listing sees 4 top-up screens and wonders which one is canonical.

**Fix:** Delete `top_up_upi_screen.dart`. If a UPI-specific flow is needed in the future, rebuild from scratch with the current design system (the current implementation uses outdated color tokens, hardcoded gradients, and a `flutter_inappwebview`-style URL launch that doesn't work — see P0-5).

**Effort:** 5 min (delete + verify no broken imports).

---

### P1-3: `TopUpAmountScreen` hardcodes min top-up to ₹100 when `walletMinTopup` is unset

**Repro:**
1. `top_up_amount_screen.dart:100-104`:
   ```dart
   bool get _canProceed {
     final minTopup = ref.watch(walletProvider.select((p) => p.walletMinTopup)).toInt();
     return _finalAmount >= (minTopup > 0 ? minTopup : 100);
   }
   ```
2. `WalletNotifier.setWalletSettings(minTopup)` is the only way to set `walletMinTopup` (wallet_provider.dart:107-109). It's never called from any code path — `grep` for `setWalletSettings` returns 0 callers outside the definition.
3. So `minTopup` is always 0, and the floor is the hardcoded 100.
4. The audit of `web/src/lib/validators.ts:115-128` shows the server's `topUpSchema` enforces `amount.max(50000)` but no minimum. A rider submitting ₹10 succeeds on the server, fails on the client.

**Impact:** Floor mismatch. The client refuses ₹10 even though the server would accept it. If the server ever adds a minimum (likely for fraud/abuse prevention), the client won't be updated.

**Fix:** Either:
- **Make the minimum a server-driven value** returned in `/api/rider/profile` (e.g., `rider.minTopupInPaise`).
- **Add a `kMinTopup` constant** in `app_constants.dart` and reference it from both the server schema and the client.

**Effort:** 30 min.

---

### P1-4: `TransactionEntity.fromJson` masks negative amounts with `abs() * 100` — wrong if the server ever sends a refund-as-negative

**Repro:**
1. `flutter/lib/features/wallet/domain/entity.dart:85-96`:
   ```dart
   final rawAmount = (json['amount'] as num?)?.toDouble() ?? 0.0;
   return TransactionEntity(
     ...
     amountInPaise: (rawAmount.abs() * 100).toInt(),
     ...
   );
   ```
2. The `abs()` silently converts a `-1500.00` to `150000` (positive paise). The transaction would show as a credit instead of a debit.
3. The server's `transactionRepository` returns `amount` as a positive number with a `type: 'CREDIT' | 'DEBIT'` discriminator. So in practice, this is **correct behavior** today. But:
4. If the server ever introduces refund-as-negative (e.g., `refundRecord.amount = -2000`) for the rider history, the Flutter side will display it as a positive credit.
5. The web side's `paiseToRupees(txn.amount)` (transaction.use-cases.ts:64) also assumes positive amounts. Same blind spot on both sides.

**Impact:** Latent bug. Doesn't fire today because of the `type` discriminator. If anyone refactors to use signed amounts, both sides break.

**Fix:** Remove the `.abs()`. Trust the server to send positive amounts. Add a comment explaining the invariant.

**Effort:** 5 min.

---

### P1-5: `TopupResponse.idempotent` is never returned by the server — the generated model carries a phantom field

**Repro:**
1. `flutter/lib/core/network/generated/api_models.dart:670-701` — `TopupResponse` has `final bool? idempotent`.
2. `web/src/app/api/transaction/topup/route.ts:48-57` returns `{id, amount, status}` only.
3. `web/src/app/api/transaction/request/route.ts:53` returns the full `transaction` object (which also doesn't include `idempotent`).
4. The field is dead. The Flutter `WalletRepositoryImpl.submitTopup` (line 39-44) only checks `response.id` and doesn't read `idempotent`.

**Impact:** Latent confusion. A future maintainer might check `topupResponse.idempotent == true` to detect "this was a retry" — but the server never sets it. They'd need to use the `Idempotency-Key` header round-trip pattern or compare with the previous PENDING list.

**Fix:** Remove the `idempotent` field from the generated `TopupResponse`. OR: have the server return it (`{id, amount, status, idempotent: Boolean(existingTxn != null)}`) and use it in the Flutter side to surface a "duplicate top-up detected" message.

**Effort:** 5 min (regenerate) or 1h (full feature).

---

### P1-6: `TopUpProofScreen._showOnlinePaymentAlertDialog` shows 4 gateway options but the API only accepts a single `method` field — the gateway choice is decorative

**Repro:**
1. `top_up_proof_screen.dart:120-129` — `DropdownButtonFormField` with 4 options: `razorpay`, `phonepe`, `cashfree`, `easebuzz`.
2. Line 158: builds URL with `gateway=$_selectedGateway`.
3. The dialog returns and the user is sent to the (broken — P0-5) Razorpay URL with the gateway as a query param.
4. The `WalletNotifier.topUpWallet` (wallet_provider.dart:111-141) accepts `method: String` with values `'UPI' | 'CARD' | 'CASH'` only (per `VoltiumApiService.submitTopup` line 78-83). It maps the 4-gateway choice to `'CARD'` if `online` was selected (top_up_proof_screen.dart line 153: `_selectedPaymentMode = PaymentMode.online`).
5. **The gateway selection is never sent to the server as part of the topup.** It's only used in the broken URL.

**Impact:** Decorative UI that confuses users. A rider who picks "Cashfree" thinks their top-up will be processed by Cashfree — but the request goes to the server with `method: 'CARD'` (or whatever the default is).

**Fix:** Remove the gateway dropdown from the dialog. Either:
- Replace with a single "Instant online payment" button that calls a real integration.
- Or remove the "Instant" option entirely (per P0-5).

**Effort:** 30 min (with P0-5 fix).

---

### P1-7: `_autoApproveTestTopup` hard-codes ₹8,000 opening balance for test riders regardless of top-up amount

**Repro:**
1. `wallet.use-cases.ts:165-222`:
   ```ts
   if (purpose === 'SECURITY_DEPOSIT') {
     await walletLedgerService.creditSecurityDeposit(...)
     await walletLedgerService.credit({
       riderId: riderDbId,
       amountInPaise: 800000,  // ← ₹8,000 hardcoded
       category: 'ADMIN_ADJUSTMENT',
       note: 'Test mode: opening balance',
     });
     ...
   }
   ```
2. The ₹8,000 is a magic number. If a test rider's actual top-up was ₹5,000, the wallet now has ₹8,000 + ₹5,000 = ₹13,000 (or just ₹8,000, depending on order — the `creditSecurityDeposit` is for the actual top-up amount; the ₹8,000 is *additional* opening balance).
3. The intent is "give test riders some balance to play with", but the value isn't derived from anything — it's just 8,000.
4. The function also hard-codes `TEST_PHONES = ['9876543210', '9999999999', '8888888888', '7788888801']` at line 27 — same placeholder phone pattern that the support/emergency audits flagged (audit #9 P1-1, audit #10 P1-2, audit #12 P0-2).

**Impact:** Test data drift. A test rider with phone 9876543210 in dev mode gets ₹8,000 + their top-up amount. A test rider with a different phone gets their top-up amount only. The asymmetry makes test scenarios hard to reason about.

**Fix:** Move the opening balance to an env var: `const OPENING_BALANCE_PAISE = parseInt(process.env.TEST_OPENING_BALANCE_PAISE || '800000')`. Also move the `TEST_PHONES` list to a shared constants file (this list is also referenced in `auth.use-cases.ts:30` per audit #14).

**Effort:** 30 min.

---

### P1-8: `WalletNotifier.topUpWallet` doesn't capture PostHog on failure

**Repro:**
1. `wallet_provider.dart:111-141`:
   ```dart
   Future<void> topUpWallet({...}) async {
     state = state.copyWith(isToppingUp: true);
     try {
       ...
       await _repo.submitTopup(req);
       await refreshTransactions(riderId: riderId);
     } catch (e) {
       rethrow;  // ← no PostHog capture
     } finally {
       state = state.copyWith(isToppingUp: false);
     }
   }
   ```
2. Compare to `top_up_flow.dart:136-141` which does show a `ScaffoldMessenger` snackbar on error but doesn't capture PostHog.
3. The success path captures `wallet_top_up_submitted` in the screen layer (top_up_flow.dart:105-110), but the notifier doesn't capture anything on either path.
4. This means analytics for failed top-ups are blind. The team can't see:
   - How many top-ups fail (and which error class)
   - What amount the rider tried
   - The error message from the server

**Impact:** Measurement gap. Combined with audit #12 P1-5 (no analytics on emergency contact CRUD), this is part of a wider pattern.

**Fix:** Add a `try/catch` in the notifier that captures `PostHogService.capture('wallet_top_up_failed', properties: {amount, method, error: e.toString()})`. Also: capture `wallet_top_up_succeeded` with the response id and status (currently only the screen layer captures the analytics with the wrong amount — see P0-3).

**Effort:** 30 min.

---

### P1-9: `WalletNotifier.refreshTransactions` accepts a `riderId` parameter but the server already filters by session — the parameter is unused server-side

**Repro:**
1. `wallet_provider.dart:152-167` accepts `riderId` as a required parameter.
2. The repository call `await _repo.getTransactionHistory(riderId)` (line 171) passes it.
3. The generated client's `getTransactionHistory(page, limit)` (api_client.dart:74-83) **does not accept a riderId** — it just hits `/api/transaction/history?page=&limit=`.
4. The web route (history/route.ts:17-42) takes `riderDbId` from the session, not from any query param.
5. So the `riderId` parameter is:
   - **Required** by the Flutter function signature (compile-time error if removed).
   - **Unused** server-side.
   - **Forced** into every call site (`wallet_screen.dart:33`, `history_screen.dart:53`, `top_up_flow.dart:135` after a top-up).

**Impact:** Misleading API. A new developer reads `refreshTransactions(riderId: 'rider-123')` and thinks the riderId is being used for filtering. The fact that it's silently ignored server-side is a maintenance trap.

**Fix:**
- Either remove the `riderId` parameter from `WalletNotifier.refreshTransactions()` and `_doRefreshTransactions()` (and all call sites).
- Or wire the `riderId` into the request as a query param if there's a legitimate admin use case (the admin client uses a different path).

**Effort:** 30 min.

---

## P2 — Cleanup backlog

### P2-1: `wallet.errors.ts` exports `InsufficientFundsError` but nothing in the code throws it

The wallet use case's `requestTopup` doesn't check balance (because top-up is a credit, not a debit — there's no "insufficient funds" branch for top-ups). The `debit` path in `wallet.service.ts:34-51` could throw it, but the use case at `requestTopup` never debits. `InsufficientFundsError` is imported by `web/src/app/api/rider/plans/route.ts:7` (in the plan subscription path) but I haven't seen it thrown. Verify it's actually wired in or delete.

### P2-2: `TopupRequest.purpose` is `String?` in the generated model but the server infers it from lifecycle status — client value is silently overwritten

`flutter/.../api_models.dart:630-668` has `final String? purpose`. The web's `wallet.use-cases.ts:84-85` computes `finalPurpose = rank < 8 ? 'SECURITY_DEPOSIT' : purpose || 'TOP_UP'`. So if a rider sends `purpose: 'TOP_UP'` while in `lifecycleStatus: 'GUARANTOR_APPROVED'` (rank=6), the server overwrites it to `'SECURITY_DEPOSIT'`. The Flutter screen's `isDeposit` heuristic (`top_up_flow.dart:103-104`) then doesn't match the server's actual purpose, and the analytics is wrong.

### P2-3: `top_up_amount_screen.dart:263-264` displays `Min: ₹${walletMinTopup}` which is always ₹0

`ref.watch(walletProvider.select((p) => p.walletMinTopup)).toInt()` is always 0 (per P1-3). The UI shows "Min: ₹0" — confusing for the rider. Fix once P1-3 is fixed.

### P2-4: `history_screen.dart:79` search filters by `description` only — `purpose` is the more user-friendly field

The search bar at line 298-322 searches by `description.contains(query)`. But `TransactionModel.description` is server-generated metadata ("Top-up of ₹500.00") and the `purpose` field is the canonical semantic ("TOP_UP", "SECURITY_DEPOSIT", "RENT_PAYMENT"). Riders searching "rent" or "deposit" won't find anything.

### P2-5: `wallet_screen.dart:30-36` reads `riderId` in `addPostFrameCallback` and refreshes — classic hydration race

Same pattern as audits #9 (ticket_provider) and #12 (emergency_contacts). The screen renders with `transactions: []` for a frame, then shows a flash. The `PR #6` skeleton was added to mask it (per `wallet_screen.dart:68-69`: `isLoading ? const WalletSkeleton() : ...`), but the skeleton is the wrong shape — it doesn't match the actual list when it loads, causing a layout shift.

---

## Tests gap analysis

| Endpoint | Integration test? | Unit test? | Notes |
|---|---|---|---|
| `POST /api/transaction/topup` | Yes (`wallet_deposit_topup.test.ts:8-28, 141-189`) | No | Coverage OK for happy path |
| `POST /api/transaction/request` | Yes (`transaction_request.test.ts` — 3 cases) | No | Smoke only |
| `GET /api/transaction/history` | No | No | **GAP** — pagination untested |
| `DELETE /api/transaction/history` | No (no test exists for the 403) | No | **GAP** — 403 untested |
| `flutter` top-up integration test | No (`flutter/integration_test/` has 33 files, none cover the wallet flow end-to-end) | `test/providers/wallet_provider_test.dart` (mocks) | **GAP** — no e2e test |
| `flutter` history screen | No | No | **GAP** — search/filter/expand untested |
| Idempotency 5-min bucket | No | No | **GAP** — P0-3 hidden bug has no test |
| `_autoApproveTestTopup` opening balance | No | No | **GAP** — magic number ₹8,000 untested |

**Headline:** the top-up has server-side integration coverage but the **5-min bucket idempotency logic is untested**, which is the P0-3 hidden bug. The Flutter wallet flow has **zero end-to-end test coverage** — no integration test exercises the `TopUpFlow` → `WalletNotifier.topUpWallet` → server round trip.

**Recommended test additions:**
1. `wallet.use-cases.test.ts` — idempotency: same bucket + same amount returns existing; same bucket + different amount throws. **2h.**
2. `wallet.use-cases.test.ts` — `_autoApproveTestTopup` — opening balance = 800000 paise. **1h.**
3. `flutter/integration_test/34_wallet_top_up_test.dart` — full flow: amount screen → proof screen → submit → server PENDING row → wallet_history shows it. **4h.**
4. `flutter/integration_test/35_wallet_history_test.dart` — search, filter, expand, totals. **2h.**

**Total: 9h of test work.**

---

## Recommended fix order

| # | PR | Scope | Effort | Risk | Closes |
|---|---|---|---|---|---|
| 1 | **PR-8a: Remove fake Razorpay dialog** | Delete `_showOnlinePaymentAlertDialog`, remove "Instant" tile, or stub it with "Coming soon". Remove the 4-gateway dropdown. | 1h | Low | P0-5, P1-6 |
| 2 | **PR-8b: Fix 5-min bucket idempotency** | Server rejects second submit if amount/purpose differs; client sends Idempotency-Key; UI surfaces "you already have a pending top-up" snackbar. | 3h | Medium (backward-compat check) | P0-3 |
| 3 | **PR-8c: Add per-id receipt endpoint** | Build `GET /api/transaction/request/:id` for the rider. Wire `ReceiptPreview` to it. | 1h | Low | P0-1 |
| 4 | **PR-8d: WalletRepository cleanup** | Delete `WalletRepositoryImpl` and the `WalletEntity` class (or fix the wrong endpoint call). Make `WalletNotifier` use rider state directly. | 2h | Medium (touches tests) | P0-2, P1-9 |
| 5 | **PR-8e: Remove "Rate Us" hijack** | Replace success snackbar with friendly message; no action. | 10min | Low | P1-1 |
| 6 | **PR-8f: Delete dead TopUpUpiScreen** | `rm top_up_upi_screen.dart`. Verify no imports. | 5min | Low | P1-2 |
| 7 | **PR-8g: Add server-side `HISTORY_IMMUTABLE` error code** | Server returns specific code; client surfaces friendly message. | 2h | Low | P0-4 |
| 8 | **PR-8h: Wallet min top-up from server** | Add `rider.minTopupInPaise` to profile response. Read in `TopUpAmountScreen`. | 2h | Low | P1-3, P2-3 |
| 9 | **PR-8i: Test sprint** | Idempotency tests + Flutter wallet e2e + history e2e. | 9h | n/a | Tests gap (all) |

**Total: ~3 days of focused work to close all 5 P0s and 6/9 P1s.**

---

## Architecture observations

### Two parallel API surfaces, same dead code

Same as audit #15: `WalletRepositoryImpl` is dead (Riverpod provider is overridden in `main.dart` but only `topUpWallet`'s use of it is real, and even that is shadowed by the singleton `VoltiumApiService`). The repository layer was aspirational, never completed. The "delete it" answer is the same as for rentals.

### Top-up flow has 4 different screens for the same operation

`top_up_amount_screen.dart`, `top_up_proof_screen.dart`, `top_up_upi_screen.dart` (dead), and `top_up_flow.dart` (the orchestrator). The web has 2 (`TopUpAmountScreen.tsx`, `TopUpProofScreen.tsx`) — and the Flutter team tried to mirror it. The dead `top_up_upi_screen.dart` is the third of three (amount → UPI proof → ?) attempts at the same flow. Consolidate.

### The "POST /api/transaction/request" duplicate is a code smell, not a feature

Two routes that accept the same schema, call the same use case, return the same data. The only difference is the `/request` variant handles idempotent-replay errors specially (line 57-59). The duplicate exists because two teams (or two refactors) built the same endpoint under different names. **Delete one.** Recommended: keep `/topup` (more semantic for the rider), delete `/request`. Update the OpenAPI spec and the generated client.

### Receipt preview infrastructure exists but isn't wired

`flutter/lib/services/receipt_service.dart` and `flutter/lib/widgets/receipt_preview.dart` exist (grep showed both). The `txttransactionReceipt` localization string exists. But no UI calls `receipt_service.getReceipt(id)`. The receipt flow is a stub. This is the same "feature built, never wired" pattern as `getRiderPricing` (audit #15 P1-3), `getRiderHubs` (works), and the notifications surface (audit #7 P0-1).

### `_autoApproveTestTopup` puts test data in the same `Wallet` table as production

The function creates a `Wallet` row in the same database as production riders, with an ₹8,000 "opening balance" ADMIN_ADJUSTMENT. There's no `isTestRider` flag on the wallet, no way to clean it up, no way to distinguish in the admin UI. Test data pollutes the production database. **Consider a `test` database or a `isTestData` flag.**

### The 5-min bucket idempotency is a hack that should be a feature

The whole point of idempotency keys is to allow safe client retries. The server is implementing a **default key** that's a function of `{riderId, time-bucket}` — this is *anti*-idempotency because it forces same-bucket requests to be identical regardless of client intent. The right design is: client sends a key, server deduplicates by key, server rejects if key exists with different payload. The current design accepts different payloads as the same key.

---

## Out of scope for this audit

- **Admin-side wallet review** (approve/reject/refuse top-up) — covered in `ADMIN_FINANCE_AUDIT_2026-08-05.md`.
- **Rent-due auto-debit** — covered in `ADMIN_DATAMGMT_EARNINGS_JOBS_AUDIT_2026-08-05.md` and audit #15.
- **Wallet ledger reconciliation cron** (`workers/index.ts`) — separate audit.
- **The dashboard's wallet card** that never refreshes (audit #7 P0-1).
- **The wallet widget on the home screen** — covered in audit #7.
- **Notifications for top-up approval** — `wallet.use-cases.ts:292-298` emits a `PAYMENT` notification; whether the rider sees it is a notifications audit issue.
- **Flutter `WalletCard` widget** (`flutter/lib/features/wallet/widgets/wallet_card.dart`) — read it, but the main UX issues are in the screens.

---

## Cross-audit themes this audit confirms

1. **The "rate us" / positive-moment hijack pattern** is the same as the notifications hijack (audit #4 P0-4) — the codebase uses user-positive moments to push other agendas.
2. **Dead code with wrong endpoint calls** is a recurring landmine (audit #15 P0-2, this audit P0-2). The repository pattern is started but never finished.
3. **Test mode special-cases with hard-coded test data** (TEST_PHONES, ₹8,000 opening balance) are the same pattern as audit #14 P0-3 (TEST_PHONES in auth.use-cases.ts) and audit #9 P1-1 (placeholder support number). These should be in a shared constants file.
4. **Server features that exist but the client doesn't surface** (P0-1 receipt endpoint, audit #15 P1-3 pricing endpoint, audit #7 P0-1 notifications). Pattern: server builds it, app never shows it.

---

## Cross-audit links

- Audit #7 (Dashboard, P0-1) — wallet balance on the dashboard never refreshes.
- Audit #14 (Auth Flow, P0-3) — same `TEST_PHONES` hardcoded list.
- Audit #15 (Rental Lifecycle, P0-2, P1-4) — same dead repository pattern.
- Audit #9 (Support, P1-1) — same hardcoded placeholder phone pattern.
- Audit #6 (Data Mgmt + Jobs, P0-2) — same "endpoint exists, client doesn't call it" pattern.

---

**End of audit.** Recommend starting with **PR-8a (P0-5 Razorpay dialog)** — 1h, removes a non-functional feature that sends riders to a 404. Follow with **PR-8b (P0-3 idempotency)** — 3h, real money bug, server-side fix.
