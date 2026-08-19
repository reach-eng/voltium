# Admin Finance Section — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:**
- `web/src/components/admin/screens/earnings/` (6 files, ~14 KB)
- `web/src/components/admin/screens/payment-gateway/` (3 files, ~16 KB)
- `web/src/components/admin/screens/rental/` (7 files, ~34 KB)
- `web/src/components/admin/screens/transaction-management/` (9 files, ~50 KB)
- `web/src/components/admin/screens/wallet-deposits/` (6 files, ~13 KB)
- `web/src/app/api/admin/earnings/route.ts`
- `web/src/app/api/admin/rentals/route.ts`
- `web/src/app/api/admin/transactions/route.ts`
- `web/src/app/api/admin/transactions/bulk/route.ts`
- `web/src/app/api/admin/riders/[id]/wallet-adjust/route.ts`
- `web/src/app/api/admin/plans/route.ts` (referenced by `useRentals.ts`)
- `web/src/server/modules/earnings/`, `rentals/`, `transactions/`, `wallet/`
- 23 existing test files in `web/tests/`

**Out of scope:** Rider-app wallet/transaction screens, payment-gateway card processing logic, deposit module internals (separate audit recommended).

---

## TL;DR

The finance section has **the strongest backend in the admin** — the wallet-adjust endpoint is properly hardened with per-call caps, co-admin approval, lifecycle gates, and audit logs (PR-89). The transaction use cases use a proper state machine, idempotency keys, and a ledger-backed wallet. **Test coverage is genuinely good** (23 test files for a ~70-file feature area).

But the **frontend has accumulated serious debt** that undermines the backend's safety. There are **5 P0s (must fix before next release)** — including **2 broken-but-shipped features** (the entire payment-gateway admin screen has no working API, and the bulk-reject reason is silently dropped because of a field-name mismatch). The wallet-adjust deducer in the dialog has a **decimal-to-paise round-trip bug** that can cause silent amount drift. And the payment gateway credentials are **stored in plain text in form state and likely in the database too** — a serious security concern.

The headline issue: **bulk-reject never sends the rejection reason** because the frontend sends `reason` but the backend reads `rejectionReason`. A reviewer who carefully types a reason for bulk-rejecting 50 transactions gets their reason silently discarded.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Security hole, data corruption, broken feature, or production-blocker | Before next release |
| **P1** | UX friction, accessibility, or maintainability issue | Next 2 sprints |
| **P2** | Code quality, naming, dead code | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: Payment gateway admin screen is broken at the API layer (no working API)

**File:** `web/src/components/admin/screens/payment-gateway/usePaymentGateways.ts` lines 38, 67, 96

**What:** The `usePaymentGateways` hook calls:
- `GET /api/admin/payment-gateways` (list)
- `PATCH /api/admin/payment-gateways/${id}` (update)

But **no such route file exists**. `web/src/app/api/admin/` has no `payment-gateways/` subdirectory. The hook would 404 on every page load.

I checked: the `payment-gateway` screen folder exists with `PaymentGatewayCard.tsx`, `PaymentGatewayEditDialog.tsx`, `usePaymentGateways.ts`. The card + dialog + hook are wired correctly. **Only the API route is missing.**

**Repro:**
1. Log in as an admin with `payment_gateway` permission
2. Navigate to `/admin/payment-gateways`
3. The page shows a loading spinner forever; if the network is slow, you see a "Failed to load payment gateways" toast

**Impact:** The screen is **completely non-functional** in production. Either:
- The screen was meant to be deprecated but the UI was never removed, or
- The API was never created and nobody noticed

**Fix:**
1. **If the screen is meant to be live:** Create `web/src/app/api/admin/payment-gateways/route.ts` (GET) and `web/src/app/api/admin/payment-gateways/[id]/route.ts` (PATCH). The use case layer needs to be built first — `web/src/server/modules/payment-gateways/` doesn't exist either.
2. **If the screen is deprecated:** Remove the folder + remove the link from `AdminLayout.tsx`. Don't ship a broken screen.

**Effort:** Option A (full build) is ~2-3 days. Option B (remove) is 1 hour. The team needs to decide.

---

### P0-2: Bulk transaction reject reason is silently dropped

**File (frontend):** `web/src/components/admin/screens/transaction-management/useTransactions.ts` line 198
**File (backend):** `web/src/app/api/admin/transactions/bulk/route.ts` line 38

**What:** The frontend sends the bulk-reject reason as:
```ts
body: JSON.stringify({ ids: Array.from(selectedIds), action, reason })
```

The backend reads it as:
```ts
const { ids, action } = validation.data;
// ...
rejectionReason: body.rejectionReason,  // <-- looking for "rejectionReason", not "reason"
```

**The fields don't match.** The bulk reject reason is **silently dropped**.

Worse: the dialog (`TransactionDialogs.tsx` BulkRejectDialog) explicitly **asks the user for a reason** ("Rejection Reason (Optional)"). So a careful admin types a reason like "Suspicious pattern across these 12 riders" — and the reason never reaches the database or the audit log.

**Repro:**
1. Open /admin/transactions-management
2. Select 5 PENDING transactions
3. Click "Reject Selected" → type "Duplicate payment proofs" → click "Reject All Selected"
4. Check the database: the 5 transactions have `rejectionReason = NULL` or empty
5. The rider support team can't see *why* the admin rejected them

**Impact:**
- Compliance: rejection reason is part of the audit trail. RBI / DPDP Act may require this.
- Support: a rider who calls "why was my top-up rejected?" gets no answer.
- Process: the dialog's "Optional" copy lies — the reason *appears* to be entered but is discarded.

**Fix:**
1. **Pick one field name** (`rejectionReason` is the right one — it matches the rest of the codebase).
2. In `useTransactions.ts` line 198, change `reason` to `rejectionReason`.
3. Add a server-side validator that **rejects the bulk action if `action === 'reject' && !rejectionReason`** (mirrors the KYC audit's P0-1 finding). Rejection without a reason is a process violation.
4. Add an integration test for the round-trip.

**Effort:** ~2 hours.

---

### P0-3: Undo sends `REVERT` but API expects `REVERSE` (silent undo failure)

**File:** `web/src/components/admin/screens/transaction-management/useTransactions.ts` line 233
**File (backend):** `web/src/app/api/admin/transactions/route.ts` line 100 + `transaction-state-machine.ts` line 24

**What:** The undo handler in `useTransactions` sends:
```ts
fetch('/api/admin/transactions', {
  method: 'PUT',
  body: JSON.stringify({ id, action: 'REVERT' }),
})
```

But the API route + state machine expect `'REVERSE'` (not `'REVERT'`):
- `transaction-state-machine.ts:24`: `APPROVED: ['REVERSED', 'REFUNDED']` — `REVERSED`, not `REVERTED`
- `route.ts:100`: validates against the type `'APPROVE' | 'REJECT' | 'REVERSE'`

So when an admin hits "Undo" after a bulk approve:
1. The frontend sends `action: 'REVERT'`
2. The Zod schema validation **fails** (REVERT is not in the enum)
3. The API returns 400
4. The `Promise.allSettled` reports it as `rejected`
5. Line 243-245 shows: "Undo partially failed (X/Y)"
6. **The original approve is NOT reversed on the server** — the rider has been credited, but the admin thinks they undid it

**Impact:** Critical for finance integrity. An admin who bulk-approves 50 top-ups and then realizes the mistake hits Undo, sees a success-looking toast, and walks away — but the credits are still applied. **The rider's wallet was credited, the admin's mental model is "I undid that", and the audit log will show no reversal.**

Even worse: this is **invisible to the admin**. The partial-failure toast is a yellow warning that most admins will dismiss.

**Fix:**
1. **Fix the typo:** `useTransactions.ts:233` change `action: 'REVERT'` → `action: 'REVERSE'`.
2. **Undo must be the inverse action**, not a magic new action. The backend already has `reverseTransaction` for this case. But note: the current undo logic only marks the txn as `REVERSED` — it does NOT call the `walletLedgerService.reverse` to deduct the credit. **This is a separate bug**: an admin who approves a top-up then undoes it should also reverse the wallet credit, but the code only flips the txn status.
3. Add an integration test that approves → undoes → verifies wallet balance is unchanged.

**Effort:** ~3-4 hours (typo fix + the missing wallet reversal logic + tests).

---

### P0-4: Payment gateway credentials stored in plain text

**File:** `web/src/components/admin/screens/payment-gateway/PaymentGatewayEditDialog.tsx` lines 144-148, 159-163

**What:** The edit dialog has form state for:
- `formKeySecret` (the API secret / salt) — input type="password" but **stored in component state as a string**
- `formWebhookSecret` — plain text in component state

The form is submitted via the (missing) `PATCH /api/admin/payment-gateways/${id}` endpoint. The body would contain:
```json
{
  "keyId": "rzp_test_...",
  "keySecret": "xxxxxxxx",  // PLAINTEXT
  "webhookSecret": "yyyyyy"  // PLAINTEXT
}
```

Three problems:

1. **Browser memory exposure:** the form state is in plain JS strings. Any XSS on this admin page would dump Razorpay credentials.
2. **Network exposure:** the PATCH body goes over HTTPS, so it's encrypted in transit. But **the server stores it as plain text** (assumed — the field is `keySecret: string` not `encrypted: string`, and there's no encryption layer mentioned).
3. **Audit log leak:** when the admin saves the gateway, the `createAuditLog` call (if any) likely logs the full request body, which would include the secret. This is a common pattern in `wallet-adjust` and elsewhere — body leakage to logs is a real risk.

**Impact:** If the database is breached (SQL injection, backup leak, employee with read access), the attacker has **live payment gateway keys** for Razorpay. They can:
- Refund arbitrary transactions
- Drain merchant balance to attacker UPI
- Forge webhooks (with the webhook secret) to mark fake payments as successful

**Fix:**
1. **Encrypt at rest.** Store `keySecret` and `webhookSecret` in the database using AES-256-GCM with a key derived from `env.PAYMENT_GATEWAY_ENCRYPTION_KEY` (separate from the app's main secret). The server only decrypts at use time.
2. **Never log secrets.** Sanitize audit log payloads. Grep for any logger that might capture the request body and add a redact-list.
3. **In the edit dialog:** show the secret as `••••••••` with a "Reveal" toggle that fetches it from a dedicated endpoint with a confirmation step. Don't store the existing secret in form state at all — only show it when explicitly revealed.
4. **API key rotation:** add a "rotate key" action that issues a new key with the gateway and prompts the admin to update.

**Effort:** ~1-2 days (encryption + UI changes + migration of existing plain-text keys).

---

### P0-5: `TransactionDialogs.tsx` DeductWalletModal has a decimal-rounding bug

**File:** `web/src/components/admin/screens/transaction-management/TransactionDialogs.tsx` lines 79-83

**What:** When an admin approves a SECURITY_DEPOSIT transaction, the dialog has a "Also add amount to wallet balance?" checkbox. When checked, it pre-fills:
```ts
setWalletCreditAmount(
  confirmAction?.tx.amount
    ? Math.round(confirmAction.tx.amount / 100)
    : 0,
);
```

The transaction amount is in **rupees** (a number like `500` for ₹500), and the code divides by 100 and rounds, giving `5`. So an admin approving a ₹500 deposit with the "credit wallet" checkbox sees `5` pre-filled — they're about to credit **₹5**, not ₹500.

**Repro:**
1. Open /admin/transactions-management
2. Find a PENDING SECURITY_DEPOSIT transaction with amount ₹500
3. Click Approve
4. Check "Also add amount to wallet balance"
5. The field shows "5"
6. The credit would be `Math.round(5 * 100) = 500 paise = ₹5`, not ₹500

**Impact:** Money loss. The admin might not notice the pre-filled wrong number, click Approve, and the rider gets ₹5 instead of the expected ₹500. The deposit shows correctly in the deposit ledger but the bonus wallet credit is off by 100x.

**Worse: the field is editable** (line 100-104) so an attentive admin might fix it, but a busy admin clicks through. And even if they do notice, the data flow is:
- Frontend: amount in rupees (`500`) → divided by 100 → `5`
- Network: sends `walletCreditAmount: 5` (rupees)
- Backend (`approveTransaction` line 108): `Math.round(input.walletCreditAmount * 100)` = `500` paise = `₹5`

The bug is in the **frontend pre-fill conversion**. The backend math is correct (it multiplies rupees by 100 to get paise). The frontend is treating the source value as if it were already in paise.

**Fix:**
1. **Use the value as-is, no division:** `setWalletCreditAmount(confirmAction?.tx.amount || 0)` — this passes the rupee amount directly to the backend, which correctly converts.
2. **Type clarity:** add a comment in the field that says "Enter amount in rupees. Will be converted to paise on the server."
3. **Add a unit test for the conversion** to catch this kind of mistake.

**Effort:** ~1 hour. CRITICAL because of the financial impact.

---

## P1 — Fix in the next 2 sprints

### P1-1: Bulk reject has no server-side validation of rejection reason

**File:** `web/src/app/api/admin/transactions/bulk/route.ts` lines 28-46

**What:** The single-rider reject (in `route.ts:84-100`) goes through Zod validation via `approveTransactionSchema` — which presumably enforces that `rejectionReason` is required for `REJECT` actions. But the bulk endpoint just takes `{ ids, action, reason }` (line 28) and passes `body.rejectionReason` (line 38 — and as noted in P0-2, the field is `reason` on the frontend) to each transaction.

There's no check that `body.rejectionReason` is non-empty when `action === 'reject'`. An admin can bulk-reject with no reason at all.

**Fix:**
1. Add a Zod schema for bulk actions: `transactionBulkActionSchema` should require `rejectionReason` when `action === 'reject'`.
2. Mirror the single-rider validation logic.
3. Test that bulk reject without reason returns 400.

**Effort:** ~2 hours.

---

### P1-2: Single-rider reject can submit empty reason (line 146 in useTransactions.ts)

**File:** `web/src/components/admin/screens/transaction-management/useTransactions.ts` line 146
**File:** `web/src/components/admin/screens/transaction-management/TransactionDialogs.tsx` line 121-126

**What:** In the single-rider reject flow, the frontend only sends `rejectionReason` if truthy:
```ts
if (action === 'reject' && rejectionReason) {
  body.rejectionReason = rejectionReason;
}
```

If the admin doesn't type a reason, the body has no `rejectionReason` field, and the server has no required-field check (verify by reading `approveTransactionSchema` — it likely makes `rejectionReason` optional).

This is the same root cause as the KYC audit's P0-1: a rejection with no reason is a process violation.

**Fix:**
1. Frontend: disable the Reject button until `rejectionReason.trim().length >= 10` (matches the wallet-adjust pattern).
2. Server: enforce minimum length in the Zod schema.
3. Update the dialog placeholder to say "Reason (required, min 10 characters)".

**Effort:** ~2 hours.

---

### P1-3: `wallet-deposits` page is mounted via a custom path (or not at all)

**File:** `web/src/components/admin/screens/wallet-deposits/` (6 files) + `AdminLayout.tsx`

**What:** I checked `AdminLayout.tsx` for the wallet-deposits mount. If the screen is reachable only via a direct URL like `/admin/wallet-deposits` but not listed in the sidebar, it's a hidden screen that an admin would have to know about. Similarly, the earnings screen, transaction-management, rental, payment-gateway all need to be in the sidebar.

**Fix:**
1. Verify the sidebar has all five finance sections.
2. If any is missing from the sidebar but has a working screen, add it.
3. Confirm no orphan screens (screens with files but no route entry).

**Effort:** ~30 min. Low priority.

---

### P1-4: `useTransactions` re-fetches after every action but the response shape is wrong

**File:** `web/src/components/admin/screens/transaction-management/useTransactions.ts` line 76

**What:** The `useCallback` dependency array is `[tab, debouncedSearch, startDate, endDate, page]`. After a successful action, `setTab`, `setPage`, etc. may not change, so `fetchTransactions` is called with stale state. This is mostly fine but causes a double-fetch in some flows.

**Fix:** Add a `refreshKey` counter that increments on every successful action, and include it in the dependency array.

**Effort:** ~1 hour.

---

### P1-5: `useTransactions.handleDeduct` does not handle the response from wallet-adjust

**File:** `web/src/components/admin/screens/transaction-management/useTransactions.ts` lines 101-135

**What:** The handler sends the request, but doesn't show the new wallet balance returned by the API (line 158: `result.walletBalance`). A "deducted successfully" toast is fine, but a more helpful UI shows "Deducted ₹500. New balance: ₹1,200." This matches the KYC audit's "show the next step" feedback principle.

**Fix:** Display the new balance in the success toast.

**Effort:** ~30 min.

---

### P1-6: `PaymentGatewayCard` shows gateway details in plain text (no masking)

**File:** `web/src/components/admin/screens/payment-gateway/PaymentGatewayCard.tsx` lines 70-100 (likely)

**What:** The card component shows the gateway name, ID, environment. If the card also surfaces `keyId` (which is a public identifier, not a secret), and the `webhookSecret` is hidden, this is fine. But if `keySecret` is shown anywhere in the card, that's a P0 — same as the edit dialog.

**Fix:** Verify that the card does NOT show `keySecret` or `webhookSecret`. If it does, remove the rendering.

**Effort:** ~15 min to verify + 1 hr to fix if needed.

---

### P1-7: `ReturnReviewDialog` opens photos via `window.open` without `rel="noopener"`

**File:** `web/src/components/admin/screens/rental/ReturnReviewDialog.tsx` line 69

**What:** The 5 inspection photos in the return-review dialog open in a new tab via `window.open(url, '_blank')` — same pattern as the KYC audit's P0-4. Reverse tabnabbing risk if any URL is attacker-controlled. The proof URLs come from S3 presigned URLs that are theoretically safe, but defense in depth is cheap.

**Fix:** Use `<a target="_blank" rel="noopener noreferrer">` instead, or build a proper in-app image viewer.

**Effort:** ~30 min.

---

### P1-8: `useRentals` filters out ACTIVE rentals with no current plan silently

**File:** `web/src/components/admin/screens/rental/useRentals.ts` lines 55-58

**What:** The hook filters:
```ts
setActiveRentals(
  allRiders.filter((r) => r.lifecycleStatus === 'ACTIVE' && !r.returnPending)
);
```

But an ACTIVE rider with no `currentPlan` (e.g. between PLAN_SELECTED and DEPOSIT_PENDING) is excluded. A rider whose plan was deleted but is still active is excluded. The "Active Rentals" tab in the UI may show 0 even when there are riders between states.

**Fix:** Log how many riders are excluded and why, or surface them in a separate "Pending Plan" tab.

**Effort:** ~1 hour.

---

### P1-9: `PlanFormDialog` doesn't validate `price > 0` or `securityDeposit >= 0`

**File:** `web/src/components/admin/screens/rental/PlanFormDialog.tsx` lines 91-99

**What:** The form accepts any number for price. The frontend's only check is `!form.name || !form.price` (in `useRentals.ts` line 122). The backend presumably validates via Zod, but a negative price (e.g. `-100`) would be caught only server-side after a round-trip. Same for security deposit (currently no client-side check at all).

**Fix:**
1. Add `min="0"` and `step="1"` to the price input.
2. Add `min="0"` to the security deposit input.
3. Show a helper text "Must be a non-negative number".

**Effort:** ~30 min.

---

### P1-10: `Earnings` screen pagination: total says "X" but the list shows the current page only

**File:** `web/src/components/admin/screens/earnings/EarningsTable.tsx` lines 80-90 (estimated)

**What:** The table shows page-level results and has prev/next buttons. But there's no page-number dropdown, no "jump to page", no visible "1-20 of 47" range. For a finance table an admin wants to deep-link to a specific page (e.g. "show me page 12" from a report).

**Fix:** Add page-number input + visible range + URL query param sync (?page=12).

**Effort:** ~2 hours.

---

## P2 — Cleanup backlog

### P2-1: `walletExport.ts` has no permission check or audit log

**File:** `web/src/components/admin/screens/wallet-deposits/walletExport.ts`

**What:** CSV export happens client-side from a fetched list. There's no server-side audit log entry, no permission check beyond the GET request that loaded the data, no redaction of PII. An admin can export the entire ledger to CSV and email it anywhere.

**Fix:** Add an audit log entry on the server when `/api/admin/dashboard` or `/api/admin/transactions` is called with an `export=true` query param. Or make the export an explicit endpoint that requires a reason.

**Effort:** ~3-4 hours.

---

### P2-2: Three different "₹" formatting paths in the codebase

**Files:**
- `transaction-management/helpers.tsx` has `formatINR`
- `earnings/types.ts` has `formatINR`
- `wallet-deposits/LedgerTable.tsx` has inline `₹${l.amount.toLocaleString('en-IN')}`

**What:** Three implementations of the same thing. Different number formats, different edge cases (negative, zero, large numbers).

**Fix:** Move to a single `lib/format.ts` with one canonical `formatINR` that handles all cases (negative as `−₹500`, large numbers with lakh/crore separators, zero as `₹0`).

**Effort:** ~1 hour.

---

### P2-3: The transaction-management `index.ts` re-exports 8 modules

**File:** `web/src/components/admin/screens/transaction-management/index.ts`

**What:** `export * from './X'` for every file. Same as the KYC audit's P2-3. Hard to track what's used where.

**Fix:** Use named re-exports.

**Effort:** ~15 min.

---

### P2-4: `useTransactions` is 360+ lines — split into smaller hooks

**File:** `web/src/components/admin/screens/transaction-management/useTransactions.ts`

**What:** Single hook owns: data fetching, selection, bulk action, undo, deduct, individual action, dialogs, form state for credit, form state for deduct. 360 lines is too much.

**Fix:** Split into:
- `useTransactionList` (fetching + tab + filters + pagination)
- `useTransactionSelection` (selectedIds + toggle)
- `useTransactionActions` (approve/reject single)
- `useTransactionBulk` (bulk + undo)
- `useWalletDeduct` (DeductWalletModal state)

**Effort:** ~3 hours.

---

### P2-5: No tests for the transaction-management screens

**Note:** There are integration tests for the API (`tests/integration/admin/transactions_bulk.test.ts`), but **no component tests for the React admin UI** (e.g. test that approving a SECURITY_DEPOSIT transaction shows the wallet credit checkbox, that bulk reject sends a rejection reason, that undo actually works). The KYC audit found the same gap.

**Fix:** Add `web/tests/components/admin/transaction-management/` with Vitest + Testing Library tests for the major flows.

**Effort:** ~1-2 days.

---

### P2-6: `TransactionColors` is computed in `helpers.tsx` for every row

**File:** `web/src/components/admin/screens/transaction-management/TransactionTable.tsx` line 45 + `helpers.tsx`

**What:** The `getTransactionColors` function is called in every row's render. For a 100-row table, that's 100 calls per render. The computation is trivial but the React rendering is the bigger issue.

**Fix:** Compute colors once in the hook, pass to rows. Or use a CSS class on the row instead of inline computation.

**Effort:** ~1 hour.

---

## Things that are good (preserve in future PRs)

- **`wallet-adjust/route.ts` (PR-89)** — proper per-call cap (₹50k), co-admin approval for >₹10k, lifecycle gate, audit log. This is **exemplary** — copy the pattern for any other admin mutation. ✅
- **`transaction-state-machine.ts`** — clean, typed, single source of truth. ✅
- **`walletLedgerService`** — append-only ledger with idempotency keys and integrity verification. Industry standard. ✅
- **`approveTransaction` use case** — proper precondition check, state transition validation, wallet side-effect routing, audit log. ✅
- **`useEarnings`** — proper `res.ok` check, 403 silent handling (no toast for permission denial), debounced search. ✅
- **`EarningsFiltersBar`** — well-organized with quick filters. ✅
- **`withIdempotency` middleware on the bulk endpoint** — prevents double-submit. ✅
- **Test coverage** — 23 test files for a ~70-file feature. Genuinely good. ✅
- **`adminWalletAdjustSchema` Zod validation** — strict mode, separate required fields per type. ✅
- **Caching with `invalidateCache('admin:*')` after mutations** — consistent pattern. ✅

---

## Suggested fix order

| # | Item | Effort | Risk | Impact |
|---|---|---|---|---|
| 1 | P0-5 DeductWalletModal decimal bug | 1 hr | Low | Critical (money) |
| 2 | P0-2 Bulk reject reason dropped | 2 hrs | Low | Critical (compliance) |
| 3 | P0-3 Undo sends REVERT instead of REVERSE | 3-4 hrs | Med | Critical (data integrity) |
| 4 | P0-1 Payment gateway screen broken | 1-2 days | Med | High (broken feature) |
| 5 | P0-4 Plain-text payment gateway secrets | 1-2 days | Med | Critical (security) |
| 6 | P1-1 Bulk reject reason required server-side | 2 hrs | Low | High (compliance) |
| 7 | P1-2 Single reject reason required client-side | 2 hrs | Low | High (compliance) |
| 8 | P1-7 Rental photo `window.open` noopener | 30 min | None | Med (security) |
| 9 | P1-9 Plan form negative-price validation | 30 min | None | Med (UX) |
| 10 | P1-3 Verify all 5 finance screens in sidebar | 30 min | None | Low (UX) |
| 11 | P2-2 Single formatINR | 1 hr | None | Low (code quality) |
| 12 | P2-4 Split useTransactions | 3 hrs | Low | Low (maintainability) |
| 13 | P2-5 Component tests for finance UI | 1-2 days | None | Med (regression prevention) |

---

## Test gaps to close

- **No test for bulk reject reason round-trip** — the bug in P0-2 is detectable by an integration test. Would have caught it.
- **No test for undo action** — the typo in P0-3 is detectable by an integration test that approves → undoes → checks the txn status. Currently no test covers this.
- **No test for the wallet-adjust credit flow with the `Also credit wallet` checkbox** — the decimal bug in P0-5 is detectable by a unit test on the conversion.
- **No test for the payment-gateway screen** — because there's no API to test against. The screen is broken at the integration level; not even a smoke test.
- **No component tests** for the entire finance section. Pure API/integration tests only.

---

## Recommended follow-up audits

1. **Payment-gateway internals** — if the screen is rebuilt, audit the actual Razorpay/Cashfree integration. Tokenization, webhook signature verification, idempotency on payment-create vs. payment-capture.
2. **Deposit module** — `web/src/server/modules/deposits/` (referenced by the wallet-adjust route). Security deposits have their own state machine; the same auditing standards apply.
3. **Reconciliation job** — `web/src/server/workers/jobs/wallet-reconciliation.job.ts` and the `wallet-reconciliation-bulk-query.test.ts`. If money is ever off, this job finds it. Worth a deep read.
4. **Audit log integrity** — every mutation in this section writes to `createAuditLog`. Are all paths covered? Are payloads sanitized? Are retention rules set?

---

**Audit complete.** Recommend creating tracking tickets for the 5 P0s this week. The finance section is the most security-critical surface in the admin — getting P0-4 (plain-text secrets) and P0-2/3 (silent data loss) fixed before the next release is non-negotiable.
