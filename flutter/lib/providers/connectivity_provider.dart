import 'dart:async';

import 'package:flutter/foundation.dart';

import '../services/connectivity_service.dart';
import '../services/offline_storage_service.dart';
import '../core/network/api_client.dart';

class ConnectivityProvider extends ChangeNotifier {
  StreamSubscription<bool>? _connectivitySubscription;

  bool _isOnline = true;
  bool get isOnline => _isOnline;

  int _pendingSyncCount = 0;
  int get pendingSyncCount => _pendingSyncCount;

  void bindConnectivityService(ConnectivityService service) {
    _connectivitySubscription?.cancel();
    _isOnline = service.isConnected;
    _connectivitySubscription = service.onConnectivityChanged.listen(setOnline);
  }

  void setOnline(bool online) {
    if (_isOnline == online) return;
    _isOnline = online;
    notifyListeners();

    // Flush pending offline operations when connectivity is restored
    if (online) {
      _flushPendingOperations();
    }
  }

  /// Flush queued offline operations sequentially when back online.
  Future<void> _flushPendingOperations() async {
    try {
      final offlineStorage = OfflineStorageService();
      final pending = await offlineStorage.getPendingOperations();

      if (pending.isEmpty) return;

      debugPrint(
          '[Connectivity] Flushing ${pending.length} pending offline operations');

      final apiClient = ApiClient();

      for (final op in pending) {
        try {
          final method = op['method'] as String;
          final endpoint = op['endpoint'] as String;
          final body = op['body'] as Map<String, dynamic>?;
          final idempotencyKey = op['idempotency_key'] as String?;

          await apiClient.sendQueuedRequest(
            method,
            endpoint,
            body,
            idempotencyKey: idempotencyKey,
          );

          // Remove on success
          await offlineStorage.removePendingOperation(op['id'] as int);
          _updatePendingCount();
        } catch (e) {
          debugPrint(
              '[Connectivity] Failed to flush operation ${op['id']}: $e');
          // Leave in queue for next retry
          break; // Stop on first failure to preserve ordering
        }
      }
    } catch (e) {
      debugPrint('[Connectivity] Error flushing offline queue: $e');
    }
  }

  Future<void> _updatePendingCount() async {
    try {
      final pending = await OfflineStorageService().getPendingOperations();
      setPendingSyncCount(pending.length);
    } catch (_) {
      // Ignore
    }
  }

  void setPendingSyncCount(int count) {
    if (_pendingSyncCount == count) return;
    _pendingSyncCount = count;
    notifyListeners();
  }

  void logout() {
    _isOnline = true;
    _pendingSyncCount = 0;
    notifyListeners();
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
    super.dispose();
  }
}
