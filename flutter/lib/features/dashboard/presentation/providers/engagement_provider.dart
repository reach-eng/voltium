// PR-8 (2026-08-21): rename `EngagementNotifier` → `EngagementProvider`.
// The class is the canonical provider; the previous `typedef` alias
// was a leftover from the legacy `ChangeNotifier` migration.
//
// R4.3c-4 — Riverpod v3 `EngagementProvider` (Notifier + state).
//
// Same surface as the previous `ChangeNotifier`:
//   - `rewardPoints`, `paymentStreak`, `rewards`, `referralData`,
//     `notifications`, `unreadCount`
//   - `initEngagementData`, `refreshRewards`, `refreshReferrals`,
//     `refreshNotifications`, `markNotificationAsRead`,
//     `markAllNotificationsRead`, `logout`
//
// PR-13 (2026-08-22): the notifier now talks directly to the
// generated [VoltiumApiClient] for typed endpoints (rewards,
// referrals) and to the [ApiClient] for the untyped notification
// REST paths. The old `VoltiumApiService` wrapper is gone. Tests
// override [voltiumApiClientProvider] / construct a fresh
// [ApiClient] for the notification path.

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/models/notification_model.dart';
import 'package:voltium_rider/utils/app_constants.dart';

import '../../../../utils/app_logger.dart';

@immutable
class RewardItem {
  final String id;
  final String title;
  final int points;
  final String createdAt;

  const RewardItem({
    required this.id,
    required this.title,
    required this.points,
    required this.createdAt,
  });

  factory RewardItem.fromJson(Map<String, dynamic> json) {
    return RewardItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      points: json['points'] as int? ?? 0,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

@immutable
class EngagementState {
  final int rewardPoints;
  final int paymentStreak;
  final List<RewardItem> rewards;
  final Map<String, dynamic>? referralData;
  final List<AppNotification> notifications;
  final int unreadCount;

  const EngagementState({
    this.rewardPoints = 0,
    this.paymentStreak = 0,
    this.rewards = const [],
    this.referralData,
    this.notifications = const [],
    this.unreadCount = 0,
  });

  EngagementState copyWith({
    int? rewardPoints,
    int? paymentStreak,
    List<RewardItem>? rewards,
    Map<String, dynamic>? referralData,
    List<AppNotification>? notifications,
    int? unreadCount,
    bool clearReferralData = false,
  }) =>
      EngagementState(
        rewardPoints: rewardPoints ?? this.rewardPoints,
        paymentStreak: paymentStreak ?? this.paymentStreak,
        rewards: rewards ?? this.rewards,
        referralData:
            clearReferralData ? null : (referralData ?? this.referralData),
        notifications: notifications ?? this.notifications,
        unreadCount: unreadCount ?? this.unreadCount,
      );
}

class EngagementProvider extends Notifier<EngagementState> {
  @override
  EngagementState build() => const EngagementState();

  /// PR-13: typed endpoint client (rewards, referrals). Sourced
  /// from the shared Riverpod provider so tests can inject a fake.
  VoltiumApiClient get _gen => ref.read(voltiumApiClientProvider);

  /// PR-13: untyped REST paths (the `/api/rider/notifications*`
  /// endpoints aren't in the generated client — they're raw HTTP).
  /// Sourced from [apiClientProvider] so tests can inject a fake
  /// (the regression guard for `markAllNotificationsRead`'s
  /// in-flight flag needs a gated `put`).
  ApiClient get _http => ref.read(apiClientProvider);

  void initEngagementData() {
    if (AppConstants.isTestMode) {
      _loadDummyData();
      return;
    }
    _fetchAll();
  }

  void _loadDummyData() {
    state = state.copyWith(
      rewardPoints: 1250,
      paymentStreak: 3,
      notifications: [
        AppNotification(
          id: '1',
          title: 'Rent Reminder',
          message: 'Your rent is due in 3 days.',
          type: AppNotificationType.system,
          createdAt: DateTime.now(),
          isRead: false,
        ),
        AppNotification(
          id: '2',
          title: 'Weekly Reward',
          message: 'You earned 50 bonus points!',
          type: AppNotificationType.system,
          createdAt: DateTime.now(),
          isRead: false,
        ),
        AppNotification(
          id: '3',
          title: 'System Update',
          message: 'App updated to latest version.',
          type: AppNotificationType.system,
          createdAt: DateTime.now(),
          isRead: true,
        ),
      ],
      unreadCount: 2,
    );
  }

  Future<void> _fetchAll() async {
    await Future.wait([
      refreshRewards(),
      refreshReferrals(),
      refreshNotifications(),
    ]);
  }

  /// FL-1 (envelope contract): `ApiClient._handleResponse` already unwraps
  /// `{success:true, data:{...}}` payloads when `data` is a Map — the
  /// returned value IS the server payload. These three methods previously
  /// re-gated on `response['success']`/`response['data']`, keys that no
  /// longer exist on map-shaped responses, so rewards/referrals/
  /// notifications silently never populated in production.
  ///
  /// Defensive dual-shape handling: accept BOTH the unwrapped payload
  /// (production) and a raw envelope (older test fakes), so neither
  /// contract regresses silently.

  /// Extracts the payload from either an unwrapped response or a raw
  /// `{success, data}` envelope. Returns null when neither shape holds.
  static Map<String, dynamic>? _extractPayload(Map<String, dynamic> res) {
    if (res['success'] == true && res['data'] is Map<String, dynamic>) {
      // Raw envelope (legacy fakes / future contract flip).
      return res['data'] as Map<String, dynamic>;
    }
    // Unwrapped production shape: any map that isn't an envelope.
    if (res['success'] == null) return res;
    return null;
  }

  Future<void> refreshRewards() async {
    try {
      final response = await _gen.getRiderRewards();
      final data = _extractPayload(response);
      if (data != null) {
        state = state.copyWith(
          rewardPoints: data['totalPoints'] as int? ?? 0,
          paymentStreak: data['currentStreak'] as int? ?? 0,
          rewards: ((data['rewards'] as List<dynamic>?) ?? const [])
              .map((e) => RewardItem.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      appDebug('Failed to fetch rewards: $e');
    }
  }

  Future<void> refreshReferrals() async {
    try {
      final response = await _gen.getRiderReferrals();
      final data = _extractPayload(response);
      if (data != null) {
        state = state.copyWith(referralData: data);
      }
    } catch (e) {
      appDebug('Failed to fetch referrals: $e');
    }
  }

  Future<void> refreshNotifications() async {
    try {
      final response = await _http.get('/api/rider/notifications');
      final data = _extractPayload(response);
      if (data != null) {
        final list = data['notifications'] as List<dynamic>?;
        state = state.copyWith(
          unreadCount: data['unreadCount'] as int? ?? 0,
          notifications: (list ?? const [])
              .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      appDebug('Failed to fetch notifications: $e');
    }
  }

  void markNotificationAsRead(String id) {
    final idx = state.notifications.indexWhere((n) => n.id == id);
    if (idx == -1) return;
    final next = [...state.notifications];
    next[idx] = next[idx].copyWith(isRead: true);
    state = state.copyWith(
      notifications: next,
      unreadCount: (state.unreadCount - 1).clamp(0, 999),
    );
    if (!AppConstants.isTestMode) {
      unawaited(
        _http.put('/api/rider/notifications',
            body: {'notificationId': id}).catchError((e) {
          appDebug('Failed to mark notification $id as read: $e');
          return <String, dynamic>{};
        }),
      );
    }
  }

  /// PR-VER-2026-08-06 (SUPPORT_NOTIFICATIONS P0-5): delete one notification
  /// server-side (DELETE /api/rider/notifications?id=...) and remove it from
  /// state only on success. Returns true when the row was deleted.
  Future<bool> deleteNotification(String id) async {
    AppNotification? target;
    for (final n in state.notifications) {
      if (n.id == id) {
        target = n;
        break;
      }
    }
    final wasUnread = target?.isRead == false;

    if (AppConstants.isTestMode) {
      final next = [...state.notifications]..removeWhere((n) => n.id == id);
      state = state.copyWith(
        notifications: next,
        unreadCount: (state.unreadCount - (wasUnread ? 1 : 0)).clamp(0, 999),
      );
      return true;
    }

    try {
      await _http.delete('/api/rider/notifications?id=$id');
      final next = [...state.notifications]..removeWhere((n) => n.id == id);
      state = state.copyWith(
        notifications: next,
        unreadCount: (state.unreadCount - (wasUnread ? 1 : 0)).clamp(0, 999),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  bool _markAllInFlight = false;

  // PR-VER-2026-08-07 (SUPPORT P0-5): the previous version re-fired the
  // PUT on every tap (rapid taps → N concurrent PUTs) and could race an
  // in-flight per-notification markRead. Guard with an in-flight flag and
  // await the call so local state is applied once.
  Future<void> markAllNotificationsRead() async {
    if (_markAllInFlight) return;
    _markAllInFlight = true;
    state = state.copyWith(
      notifications:
          state.notifications.map((n) => n.copyWith(isRead: true)).toList(),
      unreadCount: 0,
    );
    try {
      if (!AppConstants.isTestMode) {
        await _http.put('/api/rider/notifications', body: {});
      }
    } catch (_) {
      // Best-effort — local read state is already applied.
    } finally {
      _markAllInFlight = false;
    }
  }

  Future<void> clearReadNotifications() async {
    final previousNotifications = state.notifications;
    final readIds =
        state.notifications.where((n) => n.isRead).map((n) => n.id).toList();
    if (readIds.isEmpty) return;

    final unreadOnly = state.notifications.where((n) => !n.isRead).toList();
    state = state.copyWith(notifications: unreadOnly);

    if (!AppConstants.isTestMode) {
      try {
        await Future.wait(readIds
            .map((id) => _http.delete('/api/rider/notifications?id=$id')));
      } catch (e) {
        appDebug('Failed to delete read notifications: $e');
        // Rollback optimistic state if server delete failed (FL-14)
        state = state.copyWith(notifications: previousNotifications);
      }
    }
  }

  void logout() {
    state = const EngagementState();
  }
}

/// Riverpod v3 provider for the engagement feature.
final engagementProvider =
    NotifierProvider<EngagementProvider, EngagementState>(
  EngagementProvider.new,
);

/// PR-13 (2026-08-22): backwards-compat alias. The engagement notifier
/// now reads [voltiumApiClientProvider] (defined in
/// `riverpod_providers.dart`) directly. This re-export keeps any
/// downstream code that imported `engagementApiProvider` working.
final engagementApiProvider = voltiumApiClientProvider;
