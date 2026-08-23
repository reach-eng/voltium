import 'entity.dart';

/// A single page of transaction history plus server pagination metadata.
class TransactionHistoryPage {
  final List<TransactionEntity> transactions;

  /// Total transactions server-side. `null` when unknown (e.g. a fake
  /// repository that only exposes an unpaginated list).
  final int? total;

  /// Total pages server-side; used to decide whether more pages exist.
  final int totalPages;

  const TransactionHistoryPage({
    required this.transactions,
    this.total,
    required this.totalPages,
  });

  bool get hasMore => total == null
      ? false // Unknown totals can't promise more pages.
      : totalPages > 0 && transactions.isNotEmpty;
}

/// Abstract repository for wallet operations.
abstract class WalletRepository {
  /// Submits a top-up request.
  ///
  /// PR-4 (F-011 — 2026-08-22 deep audit): pass [idempotencyKey] (a
  /// fresh UUID per user-initiated submit) to enable safe retry on
  /// network failure. Without a key, a retry after a transient 504
  /// could double-credit the rider's wallet. The server already
  /// honours the `Idempotency-Key` header on `/api/transaction/topup`
  /// and returns `idempotent: true` for the second request.
  Future<TopupRequest> submitTopup(
    TopupRequest request, {
    String? idempotencyKey,
  });

  /// Returns transaction history.
  Future<List<TransactionEntity>> getTransactionHistory(
    String riderDbId, {
    int page = 1,
    int limit = 20,
  });

  /// Returns a page of transaction history with pagination metadata so
  /// callers can accumulate totals across pages.
  ///
  /// AUDIT FIX 2026-08-22 (HIST-a): default implementation adapts
  /// [getTransactionHistory] so existing fakes/test doubles keep working;
  /// the API-backed implementation overrides it with real pagination.
  Future<TransactionHistoryPage> getTransactionHistoryPage(
    String riderDbId, {
    int page = 1,
    int limit = 20,
  }) async {
    final txs =
        await getTransactionHistory(riderDbId, page: page, limit: limit);
    final isLastPage = txs.length < limit;
    return TransactionHistoryPage(
      transactions: txs,
      total: isLastPage ? (page - 1) * limit + txs.length : null,
      totalPages: isLastPage ? page : page + 1,
    );
  }
}
