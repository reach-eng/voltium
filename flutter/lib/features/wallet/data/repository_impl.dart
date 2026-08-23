import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/features/wallet/domain/entity.dart';
import 'package:voltium_rider/features/wallet/domain/repository.dart';

/// Implementation of [WalletRepository] using the Voltium API.
class WalletRepositoryImpl implements WalletRepository {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;

  // PR-VER-2026-08-06 (WALLET P0-2/P0-4): `_client` was only used by the
  // removed `deleteTransactionHistory` (HISTORY_IMMUTABLE — history is a
  // permanent record). The `client` param is kept so call sites and test
  // doubles that construct with two args keep compiling.
  //
  // PR-4 (F-011 — 2026-08-22 deep audit): the field is now ALSO used
  // by `submitTopup` to send the `Idempotency-Key` header. The
  // generated `VoltiumApiClient.postTransactionTopup` does not
  // accept an idempotency key, so we bypass it and call
  // `_client.post('/api/transaction/topup', ...)` directly.
  WalletRepositoryImpl(this._client, this._apiClient);

  @override
  Future<TopupRequest> submitTopup(
    TopupRequest request, {
    String? idempotencyKey,
  }) async {
    final body = {
      'riderId': request.riderId,
      // PR-RUPEES-2026-08-08: the API accepts the amount in rupees. The
      // conversion to paise happens server-side on insert.
      'amount': request.amountInRupees,
      'method': request.method,
      'purpose': request.purpose,
      'upiRef': request.upiRef,
      'proofUrl': request.proofUrl,
    };
    // F-011: always send a key. Callers MAY pass their own (the
    // wallet provider does, so a single user-initiated submit has
    // one key across its retry window), but the repository is
    // defence-in-depth — a missing caller-side key is silently
    // generated here so a submission without a key cannot
    // double-credit the wallet on a retried 504.
    final key = idempotencyKey ?? ApiClient.newIdempotencyKey();
    final response = await _client.post(
      '/api/transaction/topup',
      body: body,
      idempotencyKey: key,
    );
    // The generated `TopupResponse` only ever has `id`, `amount`,
    // `status`, `idempotent`. We only care about `id` to confirm the
    // server accepted the request.
    final id = response['id'] as String?;
    if (id == null || id.isEmpty) {
      throw Exception('Top-up request was not accepted by the server');
    }
    return request;
  }

  @override
  Future<List<TransactionEntity>> getTransactionHistory(
    String riderDbId, {
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _apiClient.getTransactionHistory(page, limit);
    List<dynamic> data = [];
    if (response['data'] is Map<String, dynamic> &&
        response['data']['transactions'] is List) {
      data = response['data']['transactions'] as List<dynamic>;
    } else if (response['data'] is List) {
      data = response['data'] as List<dynamic>;
    } else if (response['transactions'] is List) {
      data = response['transactions'] as List<dynamic>;
    }
    return data
        .map((e) => TransactionEntity.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TransactionHistoryPage> getTransactionHistoryPage(
    String riderDbId, {
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _apiClient.getTransactionHistory(page, limit);
    List<dynamic> data = [];
    if (response['data'] is Map<String, dynamic> &&
        response['data']['transactions'] is List) {
      data = response['data']['transactions'] as List<dynamic>;
    } else if (response['data'] is List) {
      data = response['data'] as List<dynamic>;
    } else if (response['transactions'] is List) {
      data = response['transactions'] as List<dynamic>;
    }

    // Server envelope: `success({ transactions, pagination }, msg)` where
    // pagination = { page, limit, total, totalPages }.
    final pagination = response['data'] is Map<String, dynamic>
        ? response['data']['pagination'] as Map<String, dynamic>?
        : response['pagination'] as Map<String, dynamic>?;
    final serverTotal = pagination?['total'];
    final serverTotalPages = pagination?['totalPages'];

    final txs = data
        .map((e) => TransactionEntity.fromJson(e as Map<String, dynamic>))
        .toList();

    return TransactionHistoryPage(
      transactions: txs,
      total: serverTotal is num ? serverTotal.toInt() : txs.length,
      totalPages: serverTotalPages is num
          ? serverTotalPages.toInt()
          : (txs.length < limit ? page : page + 1),
    );
  }
}
