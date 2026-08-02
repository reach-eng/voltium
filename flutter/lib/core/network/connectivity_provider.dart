// R4.3c-3 — Riverpod v3 `ConnectivityProvider` (Notifier + state).
//
// The previous `ChangeNotifier`-based class held a
// `StreamSubscription<bool>` and a `ConnectivityService` binding.
// The new `ConnectivityNotifier` keeps the same external surface
// (`isOnline`, `pendingSyncCount`, `setOnline`,
// `setPendingSyncCount`, `bindConnectivityService`, `logout`)
// so call sites and the FCM/initialization code in `main.dart`
// continue to work without renames.

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/services/connectivity_service.dart';
import 'package:voltium_rider/services/offline_storage_service.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import '../../utils/app_logger.dart';

@immutable
class ConnectivityState {
  final bool isOnline;
  final int pendingSyncCount;
  const ConnectivityState({
    this.isOnline = true,
    this.pendingSyncCount = 0,
  });

  ConnectivityState copyWith({bool? isOnline, int? pendingSyncCount}) =>
      ConnectivityState(
        isOnline: isOnline ?? this.isOnline,
        pendingSyncCount: pendingSyncCount ?? this.pendingSyncCount,
      );
}

class ConnectivityNotifier extends Notifier<ConnectivityState> {
  StreamSubscription<bool>? _connectivitySubscription;

  @override
  ConnectivityState build() {
    ref.onDispose(() {
      _connectivitySubscription?.cancel();
      _connectivitySubscription = null;
    });
    return const ConnectivityState();
  }

  /// Bind the notifier to a [ConnectivityService] stream. Calling this
  /// multiple times cancels the previous subscription.
  void bindConnectivityService(ConnectivityService service) {
    _connectivitySubscription?.cancel();
    state = state.copyWith(isOnline: service.isConnected);
    _connectivitySubscription = service.onConnectivityChanged.listen(setOnline);
  }

  /// Manually push an online/offline transition (also used by the
  /// stream listener above).
  void setOnline(bool online) {
    if (state.isOnline == online) return;
    state = state.copyWith(isOnline: online);

    // Flush pending offline operations when connectivity is restored.
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

      appDebug(
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

          await offlineStorage.removePendingOperation(op['id'] as int);
          await _updatePendingCount();
        } catch (e) {
          appDebug('[Connectivity] Failed to flush operation ${op['id']}: $e');
          // Leave in queue for next retry.
          break; // Stop on first failure to preserve ordering.
        }
      }
    } catch (e) {
      appDebug('[Connectivity] Error flushing offline queue: $e');
    }
  }

  Future<void> _updatePendingCount() async {
    try {
      final pending = await OfflineStorageService().getPendingOperations();
      setPendingSyncCount(pending.length);
    } catch (_) {
      // Ignore.
    }
  }

  void setPendingSyncCount(int count) {
    if (state.pendingSyncCount == count) return;
    state = state.copyWith(pendingSyncCount: count);
  }

  /// Reset state for sign-out.
  void logout() {
    state = const ConnectivityState();
  }
}

/// Backwards-compat type alias.
typedef ConnectivityProvider = ConnectivityNotifier;

/// Riverpod v3 provider for connectivity state.
final connectivityProvider =
    NotifierProvider<ConnectivityNotifier, ConnectivityState>(
  ConnectivityNotifier.new,
);
