import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart' as api;
import 'package:voltium_rider/features/wallet/domain/entity.dart';
import 'package:voltium_rider/features/wallet/domain/repository.dart';

/// Implementation of [WalletRepository] using the Voltium API.
class WalletRepositoryImpl implements WalletRepository {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;

  WalletRepositoryImpl(this._client, this._apiClient);

  @override
  Future<WalletEntity> getWallet(String riderDbId) async {
    final response = await _apiClient.getRiderDashboard();
    return WalletEntity.fromJson(response);
  }

  @override
  Future<TopupRequest> submitTopup(TopupRequest request) async {
    final req = api.TopupRequest(
      riderId: request.riderId,
      amount: request.amount,
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
    String riderDbId, {
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _apiClient.getTransactionHistory(page, limit);
    final List<dynamic> data =
        response['data'] ?? response['transactions'] ?? [];
    return data
        .map((e) => TransactionEntity.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> deleteTransactionHistory(String riderDbId) async {
    await _client.delete('/api/transaction/history');
  }
}
