import 'package:universal_io/io.dart';
import 'package:flutter/foundation.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/features/wallet/domain/repository.dart';
import 'package:voltium_rider/features/wallet/domain/entity.dart' as entity;
import 'package:voltium_rider/models/transaction_model.dart';

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

class WalletProvider extends ChangeNotifier {
  final WalletRepository _walletRepository;
  final FilesRepository _filesRepository;

  WalletProvider({
    required WalletRepository walletRepository,
    required FilesRepository filesRepository,
  })  : _walletRepository = walletRepository,
        _filesRepository = filesRepository;

  List<TransactionModel> _transactions = [];
  List<TransactionModel> get transactions => _transactions;

  /// Single-flight guard: returns the in-flight refresh Future so
  /// concurrent callers share the same work instead of being silently
  /// dropped (F-024).
  Future<void>? _refreshInFlight;

  bool get isRefreshingTransactions => _refreshInFlight != null;

  String? _lastError;
  String? get lastError => _lastError;

  bool _isToppingUp = false;
  bool get isToppingUp => _isToppingUp;

  double _walletMinTopup = 0.0;
  double get walletMinTopup => _walletMinTopup;

  bool _walletBalanceLow = false;
  bool get walletBalanceLow => _walletBalanceLow;

  double _currentBalance = 0.0;
  double get currentBalance => _currentBalance;

  void setWalletBalanceWarning(bool low, {double balance = 0.0}) {
    _walletBalanceLow = low;
    _currentBalance = balance;
    notifyListeners();
  }

  void setWalletSettings(double minTopup) {
    _walletMinTopup = minTopup;
    notifyListeners();
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
    _isToppingUp = true;
    notifyListeners();

    try {
      if (image != null) {
        screenshotUrl = await _filesRepository.uploadFile(image, 'TOPUP_PROOF');
      }
      final req = entity.TopupRequest(
        riderId: riderId,
        amount: amount,
        method: method,
        upiRef: upiRef,
        proofUrl: screenshotUrl,
        purpose: purpose,
      );
      await _walletRepository.submitTopup(req);
      await refreshTransactions(riderId: riderId);
    } catch (e) {
      rethrow;
    } finally {
      _isToppingUp = false;
      notifyListeners();
    }
  }

  Future<void> deleteTransactionHistory({required String riderId}) async {
    try {
      await _walletRepository.deleteTransactionHistory(riderId);
      _transactions = [];
      notifyListeners();
    } catch (e) {
      rethrow;
    }
  }

  Future<void> refreshTransactions({required String riderId}) async {
    // Coalesce concurrent callers onto the in-flight refresh so they
    // see the same error / outcome (F-024).
    final pending = _refreshInFlight;
    if (pending != null) return pending;

    final future = _doRefreshTransactions(riderId: riderId);
    _refreshInFlight = future;
    notifyListeners();
    try {
      await future;
    } finally {
      _refreshInFlight = null;
      notifyListeners();
    }
  }

  Future<void> _doRefreshTransactions({required String riderId}) async {
    try {
      final txs = await _walletRepository.getTransactionHistory(riderId);
      _transactions = txs
          .map(
            (t) => TransactionModel(
              id: t.id,
              riderId: riderId,
              amount: t.amountInRupees,
              type: t.type == 'CREDIT'
                  ? TransactionType.credit
                  : TransactionType.debit,
              purpose: t.purpose,
              status: _parseTransactionStatus(t.status),
              createdAt: t.createdAt,
            ),
          )
          .toList();
      _lastError = null;
      notifyListeners();
    } catch (e) {
      _lastError = 'Couldn\'t load your transactions. Pull to retry.';
      debugPrint('WalletProvider: refresh failed: $e');
      notifyListeners();
    }
  }

  void logout() {
    _transactions = [];
    _refreshInFlight = null;
    _isToppingUp = false;
    _walletBalanceLow = false;
    _currentBalance = 0.0;
    _lastError = null;
    notifyListeners();
  }
}
