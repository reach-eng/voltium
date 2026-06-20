import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../core/network/api_client.dart';
import 'consent_service.dart';

class BackgroundLocationService {
  static const String notificationChannelId = 'voltium_background_location';
  static const int notificationId = 888;

  static Future<void> initializeService() async {
    final service = FlutterBackgroundService();

    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      notificationChannelId,
      'Voltium Active Tracking',
      description: 'Used to track device location when vehicle is active.',
      importance: Importance.low,
    );

    final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
        FlutterLocalNotificationsPlugin();

    await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: true,
        isForegroundMode: true,
        notificationChannelId: notificationChannelId,
        initialNotificationTitle: 'Voltium Tracking Active',
        initialNotificationContent: 'Monitoring status...',
        foregroundServiceNotificationId: notificationId,
      ),
      iosConfiguration: IosConfiguration(
        autoStart: true,
        onForeground: onStart,
        onBackground: onIosBackground,
      ),
    );

    await service.startService();
  }

  @pragma('vm:entry-point')
  static Future<bool> onIosBackground(ServiceInstance service) async {
    WidgetsFlutterBinding.ensureInitialized();
    return true;
  }

  @pragma('vm:entry-point')
  static void onStart(ServiceInstance service) async {
    DartPluginRegistrant.ensureInitialized();
    WidgetsFlutterBinding.ensureInitialized();

    if (service is AndroidServiceInstance) {
      service.on('setAsForeground').listen((event) {
        service.setAsForegroundService();
      });

      service.on('setAsBackground').listen((event) {
        service.setAsBackgroundService();
      });
    }

    service.on('stopService').listen((event) {
      service.stopSelf();
    });

    Timer.periodic(const Duration(seconds: 30), (timer) async {
      if (service is AndroidServiceInstance) {
        if (await service.isForegroundService()) {
          service.setForegroundNotificationInfo(
            title: "Voltium Tracking Active",
            content: "Syncing location...",
          );
        }
      }

      try {
        final consent = await ConsentService().hasConsent(ConsentType.location);
        if (!consent) return;

        final isLocationEnabled = await Geolocator.isLocationServiceEnabled();
        if (!isLocationEnabled) return;

        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
          ),
        );

        await ApiClient().post(
          '/api/device/data',
          body: {
            'type': 'LOCATION',
            'data': {
              'lat': position.latitude,
              'lng': position.longitude,
              'accuracy': position.accuracy,
              'speed': position.speed,
              'isMocked': position.isMocked,
              'timestamp': DateTime.now().toIso8601String(),
            },
          },
        );
      } catch (e) {
        debugPrint('BackgroundLocationService: Error getting location: $e');
      }
    });
  }
}
