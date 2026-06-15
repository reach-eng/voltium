import 'package:flutter/foundation.dart';
import '../../domain/entity.dart';
import '../../domain/repository.dart';

/// Controller for the wallet screen.
class WalletController extends ChangeNotifier {
  final WalletRepository _repository;

  WalletController({required WalletRepository repository})
      : _repository = repository;

  WalletEntity? _wallet;
  WalletEntity? get wallet => _wallet;

  List<TransactionEntity> _transactions = [];
  List<TransactionEntity> get transactions => _transactions;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  Future<void> loadWallet(String riderDbId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _wallet = await _repository.getWallet(riderDbId);
      _transactions = await _repository.getTransactionHistory(riderDbId);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> submitTopup(TopupRequest request) async {
    try {
      await _repository.submitTopup(request);
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    }
  }
}
