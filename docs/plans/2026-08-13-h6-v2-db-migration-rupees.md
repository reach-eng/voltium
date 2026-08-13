# H6 v2 — DB Migration: Rupees, Read-Path Cleanup

**Replaces**: `2026-08-13-h6-db-migration-rupees.md` (v1)
**Decision date**: 2026-08-13
**Decision**: Re-plan after the v1 plan was found to conflict with the real schema.
**Effort**: 1 day (Option A) or 3-4 days (Option B)

## What v1 got wrong

The v1 plan proposed creating new `DepositTransaction` and `TopUpTransaction`
tables. That proposal was based on a wrong mental model of the existing schema.

**The split v1 wanted already exists, at the data layer:**

| Concept              | Table / field         | Purpose                              |
| -------------------- | --------------------- | ------------------------------------ |
| Wallet state         | `Wallet`              | `balanceInPaise`, `securityDepositInPaise`, `depositStatus` |
| Deposit lifecycle    | `DepositRecord`       | 1:1 with rider; `PENDING → APPROVED → REFUNDED/FORFEITED` |
| Append-only audit    | `WalletLedger`        | every credit/debit, with `category` discriminator |
| Approval workflow    | `Transaction`         | request + admin approval; carries `purpose` enum |

`DepositRecord` already holds the deposit-specific lifecycle the v1 plan wanted
in a new `DepositTransaction` table. `WalletLedger` already discriminates by
category (`LedgerCategory { TOP_UP, SECURITY_DEPOSIT, RENT_PAYMENT, REWARD, ... }`)
and is the immutable audit trail.

What the v1 plan was actually trying to fix is narrower: **the Flutter user
history view should only show user-initiated flows (top-up, security deposit),
not the 7 system flows (RENT_PAYMENT, REWARD, REFUND, REVERSAL, ADMIN_ADJUSTMENT,
FORFEITURE, ONBOARDING).** Right now there's no schema-level signal for that;
it's filtered in app code if at all.

## What the v1 plan would have broken

- **28 files** reference `purpose.*SECURITY_DEPOSIT|TOP_UP` (v1 said "every
  read of `Transaction`"). A two-table split would need a coordinator or
  duplication in every callsite.
- **`Transaction` is an aggregate root** with rich child relations
  (`TransactionBreakdown`, `WalletLedger.txnId` FK, `DepositRecord.transactionId`
  FK, `reversedTxnId`). Splitting out 2 of 9 purposes leaves a "halfwit" model
  that has to keep half its rows in the legacy table and rebuild the join
  graph for the other half.
- **`DepositStatus` enum already has 9 values** (PENDING, NOT_SUBMITTED,
  PENDING_VERIFICATION, APPROVED, REJECTED, REFUND_REQUESTED, REFUNDED,
  FORFEITED, PARTIALLY_REFUNDED). The v1 plan proposed 4 values
  (PENDING, HELD, REFUNDED, FORFEITED) which would collide.
- **`TransactionPurpose` has 9 values, not 4**: TOP_UP, SECURITY_DEPOSIT,
  RENT_PAYMENT, REWARD, REFUND, REVERSAL, ADMIN_ADJUSTMENT, FORFEITURE,
  ONBOARDING. v1 said "drop RENTAL_CHARGE/REFUND" — RENTAL_CHARGE doesn't
  even exist.
- **String-literal blast radius** (code search across `web/src/`):
  - SECURITY_DEPOSIT: 22 hits
  - REFUND: 18
  - REWARD: 16
  - TOP_UP: 15
  - ADMIN_ADJUSTMENT: 14
  - RENT_PAYMENT: 10
  - REVERSAL: 7
  - ONBOARDING: 3
  - FORFEITURE: 2

  Renaming, splitting, or filtering at the schema level touches every one.

## Two options

### Option A (recommended): discriminator + API filter, 1 day

Add a `TransactionAudience` enum: `USER | SYSTEM`. Set it at row-creation
time based on `purpose`:

- USER: `TOP_UP`, `SECURITY_DEPOSIT`
- SYSTEM: `RENT_PAYMENT`, `REWARD`, `REFUND`, `REVERSAL`,
  `ADMIN_ADJUSTMENT`, `FORFEITURE`, `ONBOARDING`

**Changes**:

1. `prisma/schema.prisma` — add `audience` column on `Transaction`, default to
   `SYSTEM` (safe default; existing rows are not user-initiated retroactively).
2. Migration: add column with `DEFAULT 'SYSTEM'`; do NOT backfill (rely on
   default).
3. Server: at every `Transaction.create` site, set `audience` based on
   `purpose`. Most existing writes are via `wallet.repository.createTransaction`
   or `transaction.repository` — one place to centralize.
4. Add `@@index([riderId, audience, createdAt])` for the history query.
5. `/api/transaction/history` filter: `WHERE audience = 'USER'` (default;
   admin can pass `?audience=ALL` to see system flows).
6. Flutter `TransactionEntity.fromJson` already accepts the current shape; no
   change needed (we're not changing the API contract, just adding a server
   filter).
7. Tests: add contract test that asserts `getTransactionHistory` returns only
   USER-audience rows for a rider with mixed flows.

**Acceptance criteria**:
- [ ] `audience` column added; index in place
- [ ] All `Transaction.create` sites set `audience`
- [ ] `/api/transaction/history` returns only USER flows by default
- [ ] Device walk-through: rider sees only their top-ups and deposits in
      history; admin can still see all flows
- [ ] Web + Flutter test suites green

**Effort**: ~1 day. Single PR. ~5 file edits, 1 new test.

### Option B: split the approval workflow, 3-4 days

If the real motivation for v1 was "approval workflows are different", then
splitting makes sense — but only for the approval-workflow rows, not the
audit/state rows (those are already split). Concretely:

1. New model `UserTransaction` for the 2 user-facing purposes (TOP_UP,
   SECURITY_DEPOSIT). Carries the same fields as Transaction minus the ones
   the 7 system flows need (e.g. `reversedTxnId`, `rejectionReason`).
2. Dual-write for the 2 user-facing purposes.
3. Read migration for the history endpoint.
4. Drop the 2 user-facing purposes from the legacy `Transaction` model.

**Why I'm not recommending this**:

- The approval workflow is the same code path for all 9 purposes. Splitting
  just 2 means `transaction.use-cases.ts` and `transaction.repository.ts`
  need to dispatch on purpose, which is uglier than filtering on audience.
- The data model is already split; the API surface is the only thing left
  to clean up. Option A is the right level of fix.
- 3-4 days is a lot of work to save 1 day of "filter at API" code.

If you still want Option B despite the above, say so and I'll re-plan with
the v1 pattern but corrected for the real schema (reuse `DepositStatus`,
keep all 9 purpose values, handle `TransactionBreakdown`/`WalletLedger.txnId`
explicitly). Estimated 4 PRs, 4-5 days.

## What I'm doing in Option A (the recommendation)

I'll do all 7 items above in one PR on branch
`db/h6-audience-discriminator`. The PR will:

1. Add the `audience` column to `Transaction`
2. Centralize the audience assignment in `transaction.repository.ts` (so
   future-purpose rows get the right audience automatically)
3. Add the index
4. Filter `/api/transaction/history` by `audience = USER` by default
5. Update the existing test suite (one file change: assert that the new
   filter is applied)
6. Add a new contract test (Flutter-shape × server-filter)
7. Update Flutter if needed (likely no-op since the JSON shape doesn't
   change)

**File scope** (estimated):
- `prisma/schema.prisma` (1 model edit + 1 enum)
- `prisma/migrations/<timestamp>_add_audience_to_transaction/migration.sql`
  (new file)
- `src/server/modules/transactions/transaction.repository.ts` (~10 lines)
- `src/server/modules/wallet/wallet.repository.ts` (~5 lines, if `createTransaction`
  lives there)
- `src/app/api/transaction/history/route.ts` (1 filter line)
- `tests/unit/money/transaction.repository.test.ts` (assertion update)
- `tests/integration/transaction/transaction_history_filter.test.ts`
  (new contract test)

That's the whole PR.

## Open questions

1. **Should the history endpoint default to `audience=USER` or `audience=ALL`?**
   - Default USER means admin tools need to pass `?audience=ALL` to see system
     flows. Safer default (don't leak admin flows to riders).
   - Default ALL means no behavior change for the existing admin screens.
   - **Recommend**: default USER. Admin screens pass `?audience=ALL` (one-line
     change in admin UI code).
2. **Backfill existing rows?** The new column defaults to `SYSTEM` on
   migration. Existing rider-facing rows (TOP_UP, SECURITY_DEPOSIT) will be
   marked SYSTEM unless we backfill.
   - **Recommend**: backfill `UPDATE transactions SET audience = 'USER' WHERE
     purpose IN ('TOP_UP', 'SECURITY_DEPOSIT')` as part of the migration. This
     ensures the history endpoint works for riders who already have data.
3. **Rollout order**: ship Option A first, observe for a week, then decide
   whether Option B is needed.
   - **Recommend**: yes. Most teams find the discriminator sufficient.

## What I'm NOT doing in Option A

- Not changing the `Transaction` model shape (it stays the aggregate root).
- Not touching `WalletLedger`, `DepositRecord`, `Wallet`, `TransactionBreakdown`.
- Not changing the Flutter `TransactionEntity` shape.
- Not dropping any `TransactionPurpose` values.
- Not splitting tables.
- Not changing the API contract (only adding a server-side filter).

## Estimated timeline

- Option A: 1 day, 1 PR, 1 migration, 1 new test
- Option B (only if you override): 4-5 days, 4 PRs

## What I need from you to start Option A

- [ ] Confirm Option A (or override to Option B)
- [ ] Confirm the 2 open-question recommendations (USER default, backfill
      existing rows)
- [ ] Confirm the branch name `db/h6-audience-discriminator`
- [ ] Confirm I should NOT touch the `feat/ux-2-loading-haptics` dirty
      state — I'll branch from current HEAD (dirty tree carried over, but
      the PR diff will only show my changes)

I'll then implement and report back with the test results.
