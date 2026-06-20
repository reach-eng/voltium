import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';

import 'voltium_api_service.dart';
import 'consent_service.dart';
import 'monitoring_service.dart';
import '../core/platform/platform_info.dart';

// Conditional imports for mobile-only packages
// ignore: unused_import
import 'package:flutter_contacts/flutter_contacts.dart' hide PermissionStatus;
// ignore: unused_import
import 'package:call_log/call_log.dart' show CallLog;

class DeviceDataService {
  static final DeviceDataService _instance = DeviceDataService._internal();
  factory DeviceDataService() => _instance;
  DeviceDataService._internal();

  bool get _isMobile => !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  Future<Map<String, bool>> getPermissionState() async {
    if (PlatformInfo.isWeb) {
      return {
        'locationGranted': false,
        'batteryGranted': false,
        'contactsGranted': false,
        'callLogsGranted': false,
        'micGranted': false,
        'cameraGranted': false,
        'phoneGranted': false,
      };
    }
    return {
      'locationGranted':
          await Permission.location.status == PermissionStatus.granted,
      'batteryGranted': await Permission.ignoreBatteryOptimizations.status ==
          PermissionStatus.granted,
      'contactsGranted': false,
      'callLogsGranted': false,
      'micGranted': false,
      'cameraGranted':
          await Permission.camera.status == PermissionStatus.granted,
      'phoneGranted': false,
    };
  }

  Future<void> syncPermissionState(String riderId) async {
    if (PlatformInfo.isWeb) return;
    try {
      final permissions = await getPermissionState();
      await VoltiumApiService()
          .syncPermissionState(riderId: riderId, permissions: permissions);
      debugPrint('DeviceDataService: Permission state synced');
    } catch (e) {
      debugPrint('DeviceDataService: Failed to sync permission state: $e');
      MonitoringService.logError(e, null, reason: 'syncPermissionState');
    }
  }

  Future<void> syncLocation(String riderId) async {
    if (PlatformInfo.isWeb) return;
    if (!_isMobile) return;
    if (!await ConsentService().hasConsent(ConsentType.location)) return;

    final granted =
        await Permission.location.status == PermissionStatus.granted;
    if (!granted) return;

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.best,
          distanceFilter: 10,
        ),
      );

      await VoltiumApiService().syncDeviceData(
        type: 'LOCATION',
        data: {
          'lat': position.latitude,
          'lng': position.longitude,
          'accuracy': position.accuracy,
          'speed': position.speed,
          'isMocked': position.isMocked,
        },
      );
      debugPrint('DeviceDataService: Location synced');
    } catch (e) {
      debugPrint('DeviceDataService: Failed to sync location: $e');
    }
  }

  Future<void> syncContacts(String riderId) async {
    if (!await ConsentService().hasConsent(ConsentType.contacts)) return;
    // Disabled for public beta privacy compliance
    return;
  }

  Future<void> syncCallLogs(String riderId) async {
    if (!await ConsentService().hasConsent(ConsentType.callLogs)) return;
    // Disabled for public beta privacy compliance
    return;
  }

  Future<void> syncAll(String riderId) async {
    await Future.wait(
      [
        syncPermissionState(riderId),
        syncLocation(riderId),
        syncContacts(riderId),
        syncCallLogs(riderId),
      ],
      eagerError: false,
    );

    debugPrint('DeviceDataService: syncAll completed');
  }
}
