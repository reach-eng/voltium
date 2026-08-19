import 'entity.dart';

/// Abstract repository for wallet operations.
abstract class WalletRepository {
  /// Submits a top-up request.
  Future<TopupRequest> submitTopup(TopupRequest request);

  /// Returns transaction history.
  Future<List<TransactionEntity>> getTransactionHistory(
    String riderDbId, {
    int page = 1,
    int limit = 20,
  });
}
