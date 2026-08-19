// PR-VER-2026-08-07 (SUPPORT P0-5) — regression guard for the
// `markAllNotificationsRead` in-flight guard.
//
// The previous version re-fired the PUT on every tap (rapid taps → N
// concurrent PUTs) and could race an in-flight per-notification markRead.
// The fix adds a one-shot in-flight flag: while a mark-all PUT is pending,
// further calls early-return and the guard resets after the call completes.
//
// In unit tests `AppConstants.isTestMode` is false, so the API path runs —
// a gated fake lets us hold the PUT open and observe the guard.

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:voltium_rider/models/notification_model.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';

/// Fake API whose `put` future stays unresolved until the test completes it,
/// so the in-flight window can be held open deterministically.
class _GatedApi extends Fake implements VoltiumApiService {
  final Completer<Map<String, dynamic>> _completer =
      Completer<Map<String, dynamic>>();
  int putCalls = 0;
  String? lastPutPath;
  Map<String, dynamic>? lastPutBody;

  @override
  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? body,
  }) {
    putCalls++;
    lastPutPath = path;
    lastPutBody = body;
    return _completer.future;
  }

  void complete() => _completer.complete(<String, dynamic>{'success': true});
}

AppNotification _notification(String id, {bool isRead = false}) =>
    AppNotification(
      id: id,
      title: 'Notification $id',
      message: 'Body $id',
      type: AppNotificationType.system,
      createdAt: DateTime(2026, 8, 1),
      isRead: isRead,
    );

void main() {
  group('EngagementNotifier.markAllNotificationsRead', () {
    test('applies read state once and early-returns concurrent calls',
        () async {
      final api = _GatedApi();
      final container = ProviderContainer(
        overrides: [engagementApiProvider.overrideWithValue(api)],
      );
      addTearDown(container.dispose);

      final notifier = container.read(engagementProvider.notifier);
      notifier.state = EngagementState(
        notifications: [_notification('1'), _notification('2')],
        unreadCount: 2,
      );

      // First call — PUT is held open by the gated fake.
      final first = notifier.markAllNotificationsRead();
      // Second call while the first PUT is still in flight.
      final second = notifier.markAllNotificationsRead();

      expect(api.putCalls, 1,
          reason: 'second call must early-return while the first is in flight');
      expect(container.read(engagementProvider).unreadCount, 0,
          reason: 'read state applied immediately on the first call');
      expect(
        container.read(engagementProvider).notifications.every((n) => n.isRead),
        isTrue,
        reason: 'all notifications marked read locally',
      );

      api.complete();
      await first;
      await second;

      // Guard released: a fresh call issues a new PUT.
      final third = notifier.markAllNotificationsRead();
      await third;
      expect(api.putCalls, 2,
          reason: 'guard must reset after the in-flight call completes');
    });

    test('PUTs the notifications endpoint with an empty body', () async {
      final api = _GatedApi();
      final container = ProviderContainer(
        overrides: [engagementApiProvider.overrideWithValue(api)],
      );
      addTearDown(container.dispose);

      final notifier = container.read(engagementProvider.notifier);
      notifier.state = EngagementState(unreadCount: 1);

      final call = notifier.markAllNotificationsRead();
      expect(api.lastPutPath, '/api/rider/notifications');
      expect(api.lastPutBody, isEmpty);
      expect(container.read(engagementProvider).unreadCount, 0);

      api.complete();
      await call;
    });
  });
}
