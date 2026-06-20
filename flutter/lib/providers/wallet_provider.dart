import 'dart:io';
import 'package:flutter/foundation.dart';
import '../core/network/files_repository.dart';
import '../features/wallet/domain/repository.dart';
import '../features/wallet/domain/entity.dart' as entity;
import '../models/transaction_model.dart';

TransactionStatus _parseTransactionStatus(String status) {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
    case 'COMPLETED':
      return TransactionStatus.success;
    case 'FAILED':
      return TransactionStatus.failed;
    case 'REFUNDED':
      return TransactionStatus.refunded;
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

  bool _isRefreshingTransactions = false;
  bool get isRefreshingTransactions => _isRefreshingTransactions;

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
    if (_isRefreshingTransactions) return;
    _isRefreshingTransactions = true;
    notifyListeners();

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
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching transactions: $e');
    } finally {
      _isRefreshingTransactions = false;
      notifyListeners();
    }
  }

  void logout() {
    _transactions = [];
    _isRefreshingTransactions = false;
    _isToppingUp = false;
    _walletBalanceLow = false;
    _currentBalance = 0.0;
    notifyListeners();
  }
}
