import 'package:universal_io/io.dart';

import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';

import 'voltium_api_service.dart';
import 'consent_service.dart';
import 'monitoring_service.dart';
import '../core/platform/platform_info.dart';

import 'package:flutter_contacts/flutter_contacts.dart';
import 'package:call_log/call_log.dart';

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
      'contactsGranted': await Permission.contacts.status == PermissionStatus.granted,
      'callLogsGranted': await Permission.phone.status == PermissionStatus.granted,
      'micGranted': await Permission.microphone.status == PermissionStatus.granted,
      'cameraGranted':
          await Permission.camera.status == PermissionStatus.granted,
      'phoneGranted': await Permission.phone.status == PermissionStatus.granted,
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
    try {
      if (!await ConsentService().hasConsent(ConsentType.location)) return;
    } catch (_) {
      return;
    }

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
    if (PlatformInfo.isWeb) return;
    if (!_isMobile) return;
    try {
      if (!await ConsentService().hasConsent(ConsentType.contacts)) return;
      
      final granted = await Permission.contacts.status == PermissionStatus.granted;
      if (!granted) return;

      final contacts = await FlutterContacts.getContacts(withProperties: true);
      final mappedContacts = contacts.take(200).map((c) => {
        'name': c.displayName,
        'phone': c.phones.isNotEmpty ? c.phones.first.number : '',
        'email': c.emails.isNotEmpty ? c.emails.first.address : null,
      }).where((c) => c['phone'] != '').toList();

      if (mappedContacts.isNotEmpty) {
        await VoltiumApiService().syncDeviceData(
          type: 'CONTACTS',
          data: mappedContacts,
        );
        debugPrint('DeviceDataService: Synced \${mappedContacts.length} contacts');
      }
    } catch (e) {
      debugPrint('DeviceDataService: Failed to sync contacts: $e');
    }
  }

  Future<void> syncCallLogs(String riderId) async {
    if (PlatformInfo.isWeb) return;
    if (!_isMobile) return;
    try {
      if (!await ConsentService().hasConsent(ConsentType.callLogs)) return;

      final granted = await Permission.phone.status == PermissionStatus.granted;
      if (!granted) return;

      final Iterable<CallLogEntry> entries = await CallLog.get();
      final mappedLogs = entries.take(100).map((e) => {
        'number': e.number ?? '',
        'name': e.name ?? '',
        'type': e.callType?.toString().split('.').last.toUpperCase() ?? 'UNKNOWN',
        'duration': e.duration ?? 0,
        'timestamp': DateTime.fromMillisecondsSinceEpoch(e.timestamp ?? 0).toIso8601String(),
      }).where((e) => e['number'] != '').toList();

      if (mappedLogs.isNotEmpty) {
        await VoltiumApiService().syncDeviceData(
          type: 'CALL_LOGS',
          data: mappedLogs,
        );
        debugPrint('DeviceDataService: Synced \${mappedLogs.length} call logs');
      }
    } catch (e) {
      debugPrint('DeviceDataService: Failed to sync call logs: $e');
    }
  }

  Future<void> syncAll(String riderId) async {
    try {
      await Future.wait(
        [
          syncPermissionState(riderId),
          syncLocation(riderId),
          syncContacts(riderId),
          syncCallLogs(riderId),
        ],
        eagerError: false,
      );
    } catch (e) {
      debugPrint('DeviceDataService: syncAll failed: $e');
    }

    debugPrint('DeviceDataService: syncAll completed');
  }
}
