import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();
  bool _initialized = false;

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

  Future<void> showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
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
}
