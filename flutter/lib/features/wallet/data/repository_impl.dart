import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart' as gen;
import '../domain/entity.dart';
import '../domain/repository.dart';

/// Implementation of WalletRepository using VoltiumApiClient and ApiClient.
class WalletRepositoryImpl implements WalletRepository {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;

  WalletRepositoryImpl(this._client, this._apiClient);

  @override
  Future<WalletEntity> getWallet(String riderDbId) async {
    final profile = await _apiClient.getRiderProfile();
    return WalletEntity(
      riderId: profile.riderId ?? '',
      balanceInPaise: profile.walletBalance ?? 0,
      depositStatus: profile.depositStatus ?? 'PENDING',
      securityDeposit: 0,
      paymentStreak: 0,
      pendingTopupsInPaise: 0,
    );
  }

  @override
  Future<TopupRequest> submitTopup(TopupRequest request) async {
    final req = gen.TopupRequest(
      riderId: request.riderId,
      amount: request.amount,
      method: request.method == 'UPI'
          ? 'UPI'
          : request.method == 'CARD'
              ? 'CARD'
              : 'CASH',
      upiRef: request.upiRef,
      proofUrl: request.proofUrl,
      purpose: request.purpose,
    );
    await _apiClient.postTransactionTopup(req);
    return request;
  }

  @override
  Future<List<TransactionEntity>> getTransactionHistory(String riderDbId, {int page = 1, int limit = 20}) async {
    final response = await _apiClient.getTransactionHistory(page, limit);
    final data = response['data'] as Map<String, dynamic>? ?? response;
    final transactions = data['transactions'] as List<dynamic>? ?? [];
    return transactions
        .map((tx) => TransactionEntity.fromJson(tx as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> deleteTransactionHistory(String riderDbId) async {
    await _client.delete('/api/transaction/history');
  }
}
