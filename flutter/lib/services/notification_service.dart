import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/app_logger.dart';
import '../gen/app_localizations.dart';

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

  Future<void> init() async {
    if (_initialized) return;

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings =
        InitializationSettings(android: androidSettings, iOS: iosSettings);
    await _notifications.initialize(initSettings);
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
      body:
          'Your ride has ended. Amount: ₹${(amount / 100).toStringAsFixed(2)}',
    );
  }

  Future<void> showPaymentReceived(int amount) async {
    await showNotification(
      id: 3,
      title: 'Payment Received',
      body:
          '₹${(amount / 100).toStringAsFixed(2)} has been added to your wallet.',
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
}
