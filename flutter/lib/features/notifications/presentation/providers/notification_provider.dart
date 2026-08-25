// R4.3c-2 — Riverpod v3 `NotificationProvider` (Notifier + immutable state).
//
// Same surface as the previous `ChangeNotifier` version:
//   - `notifications`, `unreadCount`, `unreadNotifications`
//   - `addNotification`, `addNotifications`, `markAsRead`,
//     `markAllAsRead`, `deleteNotification`, `clearAll`
//
// State is hydrated from `SharedPreferences` in `build()` and
// persisted after each mutation. The same `volt_notifications`
// storage key is used for backward compatibility — existing
// installs keep their cached notifications.

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:voltium_rider/models/notification_model.dart';

/// Immutable notification list state.
@immutable
class NotificationState {
  final List<AppNotification> notifications;
  final bool isLoading;

  const NotificationState({
    this.notifications = const [],
    this.isLoading = true,
  });

  int get unreadCount => notifications.where((n) => !n.isRead).length;
  List<AppNotification> get unreadNotifications =>
      notifications.where((n) => !n.isRead).toList();

  NotificationState copyWith({
    List<AppNotification>? notifications,
    bool? isLoading,
  }) =>
      NotificationState(
        notifications: notifications ?? this.notifications,
        isLoading: isLoading ?? this.isLoading,
      );
}

/// Riverpod v3 Notifier. Loads from `SharedPreferences` in `build()`.
class NotificationNotifier extends Notifier<NotificationState> {
  static const String _key = 'volt_notifications';

  @override
  NotificationState build() {
    // Trigger an async hydration; the initial state starts in loading state
    // and the loaded list is published once available.
    Future.microtask(() {
      if (ref.mounted) {
        _hydrate();
      }
    });
    return const NotificationState(isLoading: true);
  }

  Future<void> _hydrate() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final json = prefs.getString(_key);
      if (json != null) {
        final list = jsonDecode(json) as List;
        final loaded = list
            .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
            .toList();

        if (!ref.mounted) return;
        // AUDIT FIX (FL-6): merge loaded notifications with any that were
        // added in-memory before hydration finished, deduplicating by ID.
        final existingIds = state.notifications.map((n) => n.id).toSet();
        final merged = [
          ...state.notifications,
          ...loaded.where((n) => !existingIds.contains(n.id)),
        ]..sort((a, b) => b.createdAt.compareTo(a.createdAt));

        state = state.copyWith(notifications: merged, isLoading: false);
        return;
      }
    } catch (_) {
      // Corrupt cache; ignore.
    }
    if (ref.mounted) {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      jsonEncode(state.notifications.map((n) => n.toJson()).toList()),
    );
  }

  Future<void> addNotification(AppNotification notification) async {
    state = state.copyWith(
      notifications: [notification, ...state.notifications],
    );
    await _persist();
  }

  Future<void> addNotifications(List<AppNotification> notifications) async {
    final next = [...notifications, ...state.notifications]..sort(
        (a, b) => b.createdAt.compareTo(a.createdAt),
      );
    state = state.copyWith(notifications: next);
    await _persist();
  }

  Future<void> markAsRead(String id) async {
    final next = [
      for (final n in state.notifications)
        if (n.id == id) n.copyWith(isRead: true) else n,
    ];
    state = state.copyWith(notifications: next);
    await _persist();
  }

  Future<void> markAllAsRead() async {
    state = state.copyWith(
      notifications:
          state.notifications.map((n) => n.copyWith(isRead: true)).toList(),
    );
    await _persist();
  }

  Future<void> deleteNotification(String id) async {
    state = state.copyWith(
      notifications: state.notifications.where((n) => n.id != id).toList(),
    );
    await _persist();
  }

  Future<void> clearAll() async {
    state = const NotificationState();
    await _persist();
  }

  /// AUDIT FIX (workflows P0-G): logout isolation. `clearAll()` persists
  /// an empty list, which is exactly what logout needs — but the
  /// orchestrator previously never called it, so the previous rider's
  /// notification titles/messages survived in memory AND in plaintext
  /// SharedPreferences, and were re-hydrated for whoever logged in next.
  /// Wired into [RiderLogoutOrchestrator].
  Future<void> reset() => clearAll();
}

/// Backwards-compat type alias for any code still importing
/// `NotificationProvider` as a class.
typedef NotificationProvider = NotificationNotifier;

/// Riverpod v3 provider for the in-app notification list.
final notificationProvider =
    NotifierProvider<NotificationNotifier, NotificationState>(
  NotificationNotifier.new,
);
