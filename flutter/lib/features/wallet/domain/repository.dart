import 'entity.dart';

/// Abstract repository for wallet operations.
abstract class WalletRepository {
  /// Returns the current wallet balance and status.
  Future<WalletEntity> getWallet(String riderDbId);

  /// Submits a top-up request.
  Future<TopupRequest> submitTopup(TopupRequest request);

  /// Returns transaction history.
  Future<List<TransactionEntity>> getTransactionHistory(String riderDbId, {int page = 1, int limit = 20});

  /// Deletes transaction history (mostly for test reset).
  Future<void> deleteTransactionHistory(String riderDbId);
}
