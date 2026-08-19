# L5 WalletRepositoryImpl — Investigation Verdict (2026-08-13)

## TL;DR

The full-project audit's L5 claim that `WalletRepositoryImpl` was "dead code with
a wrong endpoint" is **incorrect on both counts**. The layer is alive, the
endpoints are correct, and the abstraction does real work that would be lost
if the layer were removed. There are four small, well-scoped cleanups worth
shipping, but no reason to rip the layer out.

**Recommended action**: ship the four cleanups as one small PR, keep the
abstraction.

## What the audit said (and where it's wrong)

> "WalletRepositoryImpl is dead code with a wrong endpoint."

Two claims. Both wrong:

### Claim 1: "dead code"

**Wrong.** Three places import or construct `WalletRepositoryImpl`:

- `flutter/lib/features/wallet/data/repository_impl.dart` — the implementation
- `flutter/lib/features/wallet/presentation/providers/wallet_provider.dart:24,224` —
  imported and constructed in `walletRepositoryProvider`
- `flutter/lib/core/state/app_provider.dart:30,64` —
  registered as a Riverpod override in `_createDefaultWalletProvider`

`WalletNotifier` (the Riverpod v3 notifier) reads it via
`ref.read(walletRepositoryProvider)` at `wallet_provider.dart:102` and calls
both methods (`submitTopup`, `getTransactionHistory`) on the real instance.

**The layer is the production wallet API path.** Removing it would break wallet
top-up and transaction history for every rider.

### Claim 2: "wrong endpoint"

**Wrong.** The endpoints are correct:

- `submitTopup` → `_apiClient.postTransactionTopup(req)` →
  `POST /api/transaction/topup` (matches server route)
- `getTransactionHistory` → `_apiClient.getTransactionHistory(page, limit)` →
  `GET /api/transaction/history?page=&limit=` (matches server route)

The "wrong endpoint" reading likely came from a glance at the request body
shape. The `TopupRequest` entity passes `amount: amountInRupees` (a `double`
in rupees, not a `BigInt` in paise), and the `TransactionEntity.fromJson`
prefers `amountInRupees` then falls back to `amount` then `amountInPaise / 100`.
This is the **PR-RUPEES-2026-08-08** contract change — the API is in rupees,
the DB still stores paise, the Flutter app never sees paise. Not a bug, it's
the documented behaviour.

## What the layer actually does (and why removing it would hurt)

1. **DTO conversion** — the domain `TopupRequest` (uses `amountInRupees`,
   has a `purpose` field) is reshaped into the API `TopupRequest` (uses
   `amount`, also a generated OpenAPI class) before being sent. Without the
   layer, every wallet screen would have to know about both shapes.
2. **Unit-fallback parsing** — `TransactionEntity.fromJson` (entity.dart:58-83)
   gracefully handles three response shapes: `amountInRupees`, `amount`, and
   `amountInPaise / 100`. This is defensive parsing for clients in flight during
   the RUPEES migration. Without the layer, every history consumer duplicates
   this.
3. **Test seam** — `WalletNotifier` reads the repo via
   `ref.read(walletRepositoryProvider)`. Tests can override the provider with
   a fake. Without the layer, tests would have to mock `VoltiumApiClient` at
   the HTTP boundary, which is much more brittle.
4. **Error translation** — `submitTopup` throws a typed `Exception` when the
   server returns an empty id, instead of letting a low-level DTO leak up to
   the UI. Small but real.

## The four real cleanups

These are worth doing as one small PR. None require touching the public
contract.

### 1. Drop the unused `ApiClient` constructor param

`WalletRepositoryImpl(ApiClient client, this._apiClient)` — the `client`
parameter is never used in the body. The comment on lines 11-14 says it's
kept for back-compat with call sites and test doubles. Check the actual
call sites:

- `app_provider.dart:64` — `WalletRepositoryImpl(client, vClient)` — passes
  both, so removing the unused param requires updating this site.
- `wallet_provider.dart:224` — `WalletRepositoryImpl(client, vClient)` —
  same.
- Any test doubles — grep for `WalletRepositoryImpl(` and update them.

This is mechanical. ~3 sites to update, all in-tree.

### 2. Drop the unused `riderId` parameter from `getTransactionHistory`

`getTransactionHistory(String riderDbId, {int page, int limit})` —
`riderDbId` is in the signature but the body (repository_impl.dart:37-55)
never uses it. The server route derives the rider from the auth token. This
is dead code in the contract.

Two options:

- **(a) Keep the param, suppress the warning** — ~zero risk, preserves
  external API.
- **(b) Drop the param and update the one caller** —
  `WalletNotifier._doRefreshTransactions` at `wallet_provider.dart:165-167`
  passes `riderId` (from the notifier's `riderId` arg) but doesn't actually
  use the returned `riderId` for anything. Drop both.

I recommend **(b)** since the caller is the only consumer in-tree and the
param is purely a vestigial signature. Low risk.

### 3. Unify the duplicate `ApiClient()` construction in `wallet_provider.dart`

`filesRepositoryProvider` and `walletRepositoryProvider` each construct their
own `ApiClient` and `VoltiumApiClient`:

```dart
final filesRepositoryProvider = Provider<FilesRepository>((ref) {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  return FilesRepository(client, vClient);
});

final walletRepositoryProvider = Provider<WalletRepository>((ref) {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  return WalletRepositoryImpl(client, vClient);
});
```

Two `ApiClient` instances means two auth-header sources, two connection
pools, two token-refresh paths. Fix: hoist the construction to a shared
provider:

```dart
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
final voltiumApiClientProvider = Provider<VoltiumApiClient>((ref) {
  return VoltiumApiClient(ref.read(apiClientProvider));
});
```

Then `filesRepositoryProvider` and `walletRepositoryProvider` read from
these. Tests still override `walletRepositoryProvider` for fakes.

### 4. Collapse the 3-shape defensive parsing in `getTransactionHistory`

The body of `getTransactionHistory` (repository_impl.dart:42-55) tries three
shapes:

```dart
if (response['data'] is Map<String, dynamic> &&
    response['data']['transactions'] is List) {
  data = response['data']['transactions'] as List<dynamic>;
} else if (response['data'] is List) {
  data = response['data'] as List<dynamic>;
} else if (response['transactions'] is List) {
  data = response['transactions'] as List<dynamic>;
}
```

The server should return one canonical shape. Confirm with the server
contract; once confirmed, drop the other branches and add a server-side
contract test that locks the response shape.

## What I'm NOT recommending

- **Don't remove the layer.** The abstraction earns its keep (DTO conversion,
  unit fallback, test seam, error translation).
- **Don't rewrite the wallet.** The wallet works end-to-end as-is. These
  cleanups are polish, not surgery.
- **Don't merge the layer with `FilesRepository` or any other repo.** They
  have different DTOs and different concerns; keeping them separate is
  correct.

## Estimated effort

- 1 PR
- ~1-2 hours of work (mostly mechanical renames)
- 0 test churn (the wallet tests already exercise the layer)
- Risk: low (no behaviour change, just dead-code removal and one shared
  client)

## What I need from you to start

Just a "go" on shipping the 4 cleanups as one PR. I'll do the work, run
the wallet test suite to confirm no regressions, and hand you a review-ready
diff.
