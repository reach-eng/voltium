// R4.3c-4 — Riverpod v3 `WalletProvider` (Notifier + immutable state).
//
// Same surface as the previous `ChangeNotifier`:
//   - `transactions`, `isRefreshingTransactions`, `lastError`,
//     `isToppingUp`, `walletMinTopup`, `walletBalanceLow`,
//     `currentBalance`
//   - `topUpWallet`, `refreshTransactions`, `setWalletBalanceWarning`,
//     `setWalletSettings`, `logout`
//
// The notifier pulls its dependencies (`WalletRepository`,
// `FilesRepository`) from Riverpod providers defined at the
// bottom of this file. `main.dart` registers the actual
// implementations via `ProviderScope.overrides`; tests can
// inject fakes the same way.

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:universal_io/io.dart';

import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/features/wallet/domain/repository.dart';
import 'package:voltium_rider/features/wallet/data/repository_impl.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/features/wallet/domain/entity.dart' as entity;
import 'package:voltium_rider/models/transaction_model.dart';

import '../../../../utils/app_logger.dart';

TransactionStatus _parseTransactionStatus(String status) {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
    case 'COMPLETED':
      return TransactionStatus.success;
    case 'APPROVED':
      return TransactionStatus.approved;
    case 'REJECTED':
      return TransactionStatus.rejected;
    case 'FAILED':
      return TransactionStatus.failed;
    case 'REFUNDED':
      return TransactionStatus.refunded;
    case 'PENDING':
    default:
      return TransactionStatus.pending;
  }
}

/// State for the wallet feature.
@immutable
class WalletState {
  final List<TransactionModel> transactions;
  final bool isRefreshingTransactions;
  final String? lastError;
  final bool isToppingUp;
  final double walletMinTopup;
  final bool walletBalanceLow;
  final double currentBalance;

  const WalletState({
    this.transactions = const [],
    this.isRefreshingTransactions = false,
    this.lastError,
    this.isToppingUp = false,
    this.walletMinTopup = 0.0,
    this.walletBalanceLow = false,
    this.currentBalance = 0.0,
  });

  WalletState copyWith({
    List<TransactionModel>? transactions,
    bool? isRefreshingTransactions,
    String? lastError,
    bool? isToppingUp,
    double? walletMinTopup,
    bool? walletBalanceLow,
    double? currentBalance,
    bool clearLastError = false,
  }) =>
      WalletState(
        transactions: transactions ?? this.transactions,
        isRefreshingTransactions:
            isRefreshingTransactions ?? this.isRefreshingTransactions,
        lastError: clearLastError ? null : (lastError ?? this.lastError),
        isToppingUp: isToppingUp ?? this.isToppingUp,
        walletMinTopup: walletMinTopup ?? this.walletMinTopup,
        walletBalanceLow: walletBalanceLow ?? this.walletBalanceLow,
        currentBalance: currentBalance ?? this.currentBalance,
      );
}

/// Riverpod v3 Notifier. Dependencies are looked up from
/// Riverpod providers so the notifier is test-friendly.
class WalletNotifier extends Notifier<WalletState> {
  static const int defaultMaxPages = 3;
  static const Duration refreshCooldown = Duration(seconds: 15);

  Future<void>? _refreshInFlight;
  DateTime? _lastRefreshTime;
  String? _lastRefreshedRiderId;

  @override
  WalletState build() => const WalletState();

  WalletRepository get _repo => ref.read(walletRepositoryProvider);
  FilesRepository get _files => ref.read(filesRepositoryProvider);

  void setWalletBalanceWarning(bool low, {double balance = 0.0}) {
    state = state.copyWith(walletBalanceLow: low, currentBalance: balance);
  }

  void setWalletSettings(double minTopup) {
    state = state.copyWith(walletMinTopup: minTopup);
  }

  Future<void> topUpWallet({
    required double amount,
    required String method,
    String? upiRef,
    File? image,
    String? screenshotUrl,
    String purpose = 'TOP_UP',
    required String riderId,
  }) async {
    state = state.copyWith(isToppingUp: true);
    try {
      var uploadedUrl = screenshotUrl;
      if (image != null) {
        uploadedUrl = await _files.uploadFile(image, 'TOPUP_PROOF');
      }
      final req = entity.TopupRequest(
        riderId: riderId,
        // PR-RUPEES-2026-08-08: `amount` is now in **rupees** (the
        // public API contract). The server converts to paise on
        // insert; the Flutter app never sees paise.
        amountInRupees: amount,
        method: method,
        upiRef: upiRef,
        proofUrl: uploadedUrl,
        purpose: purpose,
      );
      await _repo.submitTopup(req);
      await refreshTransactions(riderId: riderId, force: true);
    } catch (e) {
      rethrow;
    } finally {
      state = state.copyWith(isToppingUp: false);
    }
  }

  Future<void> refreshTransactions({
    required String riderId,
    bool force = false,
    int maxPages = defaultMaxPages,
  }) async {
    final now = DateTime.now();
    if (!force &&
        _lastRefreshedRiderId == riderId &&
        _lastRefreshTime != null &&
        now.difference(_lastRefreshTime!) < refreshCooldown) {
      return;
    }

    // Coalesce concurrent callers onto the in-flight refresh so they
    // see the same error / outcome (F-024).
    final pending = _refreshInFlight;
    if (pending != null) return pending;

    state = state.copyWith(isRefreshingTransactions: true);
    final future = _doRefreshTransactions(riderId: riderId, maxPages: maxPages);
    _refreshInFlight = future;
    try {
      await future;
      _lastRefreshTime = DateTime.now();
      _lastRefreshedRiderId = riderId;
    } finally {
      _refreshInFlight = null;
      state = state.copyWith(isRefreshingTransactions: false);
    }
  }

  Future<void> _doRefreshTransactions({
    required String riderId,
    int maxPages = defaultMaxPages,
  }) async {
    try {
      // PR-N4 (N-4) / F-14: paginate up to defaultMaxPages so history totals
      // reflect recent history while strictly bounding network requests to
      // prevent runaway/infinite loops on tab switches or balance refreshes.
      final List<entity.TransactionEntity> allTxs = [];
      int currentPage = 1;
      const int pageSize = 100;
      bool hasMore = true;

      while (hasMore && currentPage <= maxPages) {
        final pageTxs = await _repo.getTransactionHistory(
          riderId,
          page: currentPage,
          limit: pageSize,
        );
        if (pageTxs.isEmpty) {
          hasMore = false;
          break;
        }
        allTxs.addAll(pageTxs);
        if (pageTxs.length < pageSize) {
          hasMore = false;
        } else {
          currentPage++;
        }
      }

      final sorted = allTxs
          .map(
            (t) => TransactionModel(
              id: t.id,
              riderId: riderId,
              amount: t.amountInRupees,
              // PR-B (2026-08-28) BUG FIX: the previous
              // `t.type == 'CREDIT' ? credit : debit` silently
              // misclassified any non-'CREDIT' type (e.g. 'HOLD',
              // 'TRANSFER', 'ADJUSTMENT' if the backend ever adds
              // them) as debit. Use the model's parseTransactionType
              // helper which matches by .value (case-insensitive)
              // and falls back to debit only for truly unknown
              // values, which the notifier can log.
              type: TransactionModel.parseTransactionType(t.type),
              purpose: t.purpose,
              status: _parseTransactionStatus(t.status),
              createdAt: t.createdAt,
            ),
          )
          .toList()
        ..sort((a, b) {
          if (a.createdAt == null && b.createdAt == null) return 0;
          if (a.createdAt == null) return 1;
          if (b.createdAt == null) return -1;
          return b.createdAt!.compareTo(a.createdAt!);
        });
      state = state.copyWith(transactions: sorted, clearLastError: true);
    } catch (e) {
      state = state.copyWith(
        lastError: 'Couldn\'t load your transactions. Pull to retry.',
      );
      appDebug('WalletNotifier: refresh failed: $e');
    }
  }

  void logout() {
    state = const WalletState();
    _refreshInFlight = null;
    _lastRefreshTime = null;
    _lastRefreshedRiderId = null;
  }
}

/// Backwards-compat type alias used by `AppProvider` and call sites
/// that still reference the old class name.
typedef WalletProvider = WalletNotifier;

/// Riverpod v3 provider for the wallet feature.
final walletProvider = NotifierProvider<WalletNotifier, WalletState>(
  WalletNotifier.new,
);

// ── Repository providers (overridden in main.dart with real impls) ──

final filesRepositoryProvider = Provider<FilesRepository>((ref) {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  return FilesRepository(client, vClient);
});

final walletRepositoryProvider = Provider<WalletRepository>((ref) {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  return WalletRepositoryImpl(vClient);
});
