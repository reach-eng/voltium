import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  static final ConnectivityService _instance = ConnectivityService._internal();
  factory ConnectivityService() => _instance;
  ConnectivityService._internal();

  final Connectivity _connectivity = Connectivity();
  final StreamController<bool> _connectionController =
      StreamController<bool>.broadcast(sync: false);
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

  Timer? _debounceTimer;

  void _updateConnectionStatus(List<ConnectivityResult> results) {
    // Reflect the latest known state immediately — callers checking
    // `isConnected` right after init()/checkConnection() must not see the
    // stale default. The 1.5s debounce below only smooths the STREAM
    // emission (no flapping for transient blips), not the getter.
    final nextConnected =
        results.isNotEmpty && !results.contains(ConnectivityResult.none);
    final wasConnected = _isConnected;
    _isConnected = nextConnected;

    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 1500), () {
      if (wasConnected != _isConnected) {
        _connectionController.add(_isConnected);
      }
    });
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
