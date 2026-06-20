import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  static final ConnectivityService _instance = ConnectivityService._internal();
  factory ConnectivityService() => _instance;
  ConnectivityService._internal();

  final Connectivity _connectivity = Connectivity();
  final StreamController<bool> _connectionController =
      StreamController<bool>.broadcast();
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  Stream<bool> get onConnectivityChanged => _connectionController.stream;
  bool _isConnected = true;
  bool get isConnected => _isConnected;

  Future<void> init() async {
    final results = await _connectivity.checkConnectivity();
    _updateConnectionStatus(results);

    _subscription =
        _connectivity.onConnectivityChanged.listen(_updateConnectionStatus);
  }

  void _updateConnectionStatus(List<ConnectivityResult> results) {
    final wasConnected = _isConnected;
    _isConnected =
        results.isNotEmpty && !results.contains(ConnectivityResult.none);

    if (wasConnected != _isConnected) {
      _connectionController.add(_isConnected);
    }
  }

  Future<bool> checkConnection() async {
    final results = await _connectivity.checkConnectivity();
    _updateConnectionStatus(results);
    return _isConnected;
  }

  void dispose() {
    _subscription?.cancel();
    _connectionController.close();
  }
}
