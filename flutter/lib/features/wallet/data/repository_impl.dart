import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart' as api;
import 'package:voltium_rider/features/wallet/domain/entity.dart';
import 'package:voltium_rider/features/wallet/domain/repository.dart';

/// Implementation of [WalletRepository] using the Voltium API.
class WalletRepositoryImpl implements WalletRepository {
  final VoltiumApiClient _apiClient;

  WalletRepositoryImpl(this._apiClient);

  @override
  Future<TopupRequest> submitTopup(TopupRequest request) async {
    final req = api.TopupRequest(
      riderId: request.riderId,
      // PR-RUPEES-2026-08-08: the API accepts the amount in rupees. The
      // conversion to paise happens server-side on insert.
      amount: request.amountInRupees,
      method: request.method,
      purpose: request.purpose,
      upiRef: request.upiRef,
      proofUrl: request.proofUrl,
    );
    final response = await _apiClient.postTransactionTopup(req);
    if (response.id == null || response.id!.isEmpty) {
      throw Exception('Top-up request was not accepted by the server');
    }
    return request;
  }

  @override
  Future<List<TransactionEntity>> getTransactionHistory(
    // The server scopes the result to the authenticated rider via
    // session auth (see web/src/app/api/transaction/history/route.ts
    // → `requireRiderSession`). This parameter is kept only to document
    // the caller's intent; it is NOT forwarded to the server. The
    // server's session-derived rider ID is the sole scope authority.
    // Passing a stale or wrong value here cannot leak another rider's
    // data — the server rejects any non-matching session.
    @Deprecated(
      'Server scopes via session auth; the riderDbId parameter is '
      'no longer needed and will be removed in a future release.',
    )
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
}
