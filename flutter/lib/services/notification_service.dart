import 'dart:async';
import 'package:flutter/widgets.dart' show Locale;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:meta/meta.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/app_logger.dart';
import '../gen/app_localizations.dart';
import 'cache_service.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  /// Cached notification-enabled flag, refreshed only when the user
  /// toggles the setting in app_settings or notification_preferences.
  bool _notificationsEnabled = true;

  /// Global tap callback invoked when any local notification is tapped.
  static void Function(NotificationResponse response)? onNotificationTapped;

  /// Stream controller broadcasting notification response taps.
  static final StreamController<NotificationResponse>
      _notificationTapStreamController =
      StreamController<NotificationResponse>.broadcast();

  /// Broadcast stream of notification taps.
  static Stream<NotificationResponse> get onNotificationTapStream =>
      _notificationTapStreamController.stream;

  @pragma('vm:entry-point')
  static void _onNotificationTapped(NotificationResponse response) {
    appDebug(
      'NotificationService: Local notification tapped id=${response.id}, payload=${response.payload}',
    );
    onNotificationTapped?.call(response);
    _notificationTapStreamController.add(response);
  }

  @visibleForTesting
  static void handleNotificationResponseForTesting(
      NotificationResponse response) {
    _onNotificationTapped(response);
  }

  /// Hook for unit tests to intercept showNotification calls.
  @visibleForTesting
  static Future<void> Function({
    required int id,
    required String title,
    required String body,
    String? payload,
  })? showNotificationOverride;

  Future<void> init({
    void Function(NotificationResponse response)? onNotificationTap,
  }) async {
    if (_initialized) return;

    if (onNotificationTap != null) {
      onNotificationTapped = onNotificationTap;
    }

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings =
        InitializationSettings(android: androidSettings, iOS: iosSettings);
    await _notifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );
    _initialized = true;
    await refreshNotificationPreference();
  }

  Future<bool> requestPermission() async {
    final android = _notifications.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (android != null) {
      final granted = await android.requestNotificationsPermission();
      return granted ?? false;
    }
    return true;
  }

  /// Refreshes the cached notification-enabled flag from SharedPreferences.
  /// Call this after the user toggles the notif_push preference.
  Future<void> refreshNotificationPreference() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _notificationsEnabled = prefs.getBool('notif_push') ?? true;
    } catch (_) {
      _notificationsEnabled = true; // fail-open
    }
  }

  Future<void> showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (showNotificationOverride != null) {
      await showNotificationOverride!(
        id: id,
        title: title,
        body: body,
        payload: payload,
      );
      return;
    }

    if (!_notificationsEnabled) {
      appDebug('NotificationService: notifications disabled, skipping');
      return;
    }

    const androidDetails = AndroidNotificationDetails(
      'volt_channel',
      'Voltium Notifications',
      channelDescription: 'Notifications from Voltium',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details =
        NotificationDetails(android: androidDetails, iOS: iosDetails);

    await _notifications.show(id, title, body, details, payload: payload);
  }

  Future<void> showRideStarted(String vehicleNumber) async {
    await showNotification(
      id: 1,
      title: 'Ride Started',
      body: 'Your ride on $vehicleNumber has started. Safe travels!',
    );
  }

  Future<void> showRideEnded(int amount) async {
    await showNotification(
      id: 2,
      title: 'Ride Ended',
      body: 'Your ride has ended. Amount: ₹$amount',
    );
  }

  Future<void> showPaymentReceived(int amount) async {
    await showNotification(
      id: 3,
      title: 'Payment Received',
      body: '₹$amount has been added to your wallet.',
    );
  }

  Future<void> showLowBattery(String vehicleNumber) async {
    await showNotification(
      id: 4,
      title: 'Low Battery Alert',
      body:
          'Vehicle $vehicleNumber battery is low. Please swap at nearest station.',
    );
  }

  Future<void> showSOSAlert() async {
    await showNotification(
      id: 5,
      title: 'SOS Alert',
      body: 'Emergency services have been contacted.',
    );
  }

  Future<void> cancelNotification(int id) async {
    await _notifications.cancel(id);
  }

  Future<void> cancelAllNotifications() async {
    await _notifications.cancelAll();
  }

  // P2-12 (PR-G, 2026-08-28 workflows deferred): the server no
  // longer pre-formats the KYC push notification body — it sends a
  // type discriminator + structured data, and the Flutter client
  // renders the localized string from the ARB bundle. This helper
  // does the lookup. The FCM handler in fcm_service.dart calls
  // this when a KYC message arrives.
  //
  // Returns null if the data does not describe a KYC event, so
  // the FCM handler can fall through to its existing render path.
  static ({String title, String body})? renderKycPushFromData(
    Map<String, dynamic> data,
    AppLocalizations l10n,
  ) {
    final type = data['type'] as String?;
    if (type == null) return null;
    if (type != 'KYC_APPROVED' &&
        type != 'KYC_REJECTED' &&
        type != 'KYC_INFO_REQUESTED') {
      return null;
    }
    final reason = data['reason'] as String?;
    switch (type) {
      case 'KYC_APPROVED':
        return (
          title: l10n.kycPushTitleApproved,
          body: l10n.kycPushBodyApproved,
        );
      case 'KYC_REJECTED':
        return (
          title: l10n.kycPushTitleRejected,
          body: reason != null && reason.isNotEmpty
              ? l10n.kycPushBodyRejected(reason)
              : l10n.kycPushBodyFallback,
        );
      case 'KYC_INFO_REQUESTED':
        return (
          title: l10n.kycPushTitleInfoRequired,
          body: l10n.kycPushBodyInfoRequired,
        );
    }
    return null;
  }

  // Fixed notification ID for the KYC push channel. Stable so
  // a re-arrival replaces the previous KYC notification rather
  // than stacking.
  static const int _kycPushNotificationId = 9100;

  // P2-12 follow-up (PR-H, 2026-08-28): the FCM-to-local-notification
  // bridge. The server's KYC push is delivered as an FCM data
  // message (no `notification` block on the wire — the server sends
  // an empty title/message and relies on the client to render the
  // localized string). This helper:
  //
  //  1. Reads the rider's saved locale from CacheService (the
  //     locale_provider.dart write path is the source of truth).
  //  2. Looks up the l10n via the synchronous `lookupAppLocalizations`
  //     helper. We don't need a BuildContext here because the
  //     generated lookup is a pure switch on `locale.languageCode`.
  //  3. Calls `renderKycPushFromData` to resolve the discriminator
  //     to a (title, body) pair.
  //  4. Shows a local notification with that (title, body).
  //
  // If the data does not describe a KYC event (returns null), no
  // notification is shown — the FCM handler can fall through to
  // its existing render path for non-KYC messages.
  //
  // Returns true if a notification was shown, false otherwise.
  static Future<bool> showKycPushFromFcm(Map<String, dynamic> data) async {
    try {
      final localeCode = CacheService().getLocale() ?? 'en';
      final l10n = lookupAppLocalizations(Locale(localeCode));
      final result = renderKycPushFromData(data, l10n);
      if (result == null) return false;
      await NotificationService().showNotification(
        id: _kycPushNotificationId,
        title: result.title,
        body: result.body,
        payload: 'kyc_status',
      );
      return true;
    } catch (e) {
      appDebug('NotificationService: showKycPushFromFcm failed: $e');
      return false;
    }
  }
}
