import 'package:universal_io/io.dart';

import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';

import '../core/network/api_client.dart';
import '../core/network/generated/api_client.dart' as gen;
import '../core/network/generated/api_models.dart' as gen;
import 'consent_service.dart';
import 'monitoring_service.dart';
import '../core/platform/platform_info.dart';
import '../utils/app_logger.dart';

import 'package:flutter_contacts/flutter_contacts.dart' hide PermissionStatus;
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
      'contactsGranted':
          await Permission.contacts.status == PermissionStatus.granted,
      'callLogsGranted':
          await Permission.phone.status == PermissionStatus.granted,
      'micGranted':
          await Permission.microphone.status == PermissionStatus.granted,
      'cameraGranted':
          await Permission.camera.status == PermissionStatus.granted,
      'phoneGranted': await Permission.phone.status == PermissionStatus.granted,
    };
  }

  Future<void> syncPermissionState(String riderId) async {
    if (PlatformInfo.isWeb) return;
    try {
      final permissions = await getPermissionState();
      // PR-13: route to the generated client. The wrapper's
      // `.syncPermissionState(riderId:, permissions:)` was a 1-line
      // round-trip to `postRiderDevicePermissions` with a typed
      // request body, so the call shape is identical.
      final api = gen.VoltiumApiClient(ApiClient());
      await api.postRiderDevicePermissions(
        gen.DevicePermissionsRequest(
          riderId: riderId,
          permissions: permissions,
        ),
      );
      appDebug('DeviceDataService: Permission state synced');
    } catch (e) {
      appDebug('DeviceDataService: Failed to sync permission state: $e');
      MonitoringService.logError(e, null, reason: 'syncPermissionState');
    }
  }

  Future<void> syncLocation(String riderId, {int? batteryLevel}) async {
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

      final locationData = <String, dynamic>{
        'lat': position.latitude,
        'lng': position.longitude,
        'accuracy': position.accuracy,
        'speed': position.speed,
        'isMocked': position.isMocked,
      };
      if (batteryLevel != null) {
        locationData['batteryLevel'] = batteryLevel;
      }

      await gen.VoltiumApiClient(ApiClient()).postRiderSyncDeviceData({
        'type': 'LOCATION',
        'data': locationData,
      });
      appDebug('DeviceDataService: Location synced');
    } catch (e) {
      appDebug('DeviceDataService: Failed to sync location: $e');
    }
  }

  Future<void> syncContacts(String riderId) async {
    if (PlatformInfo.isWeb) return;
    if (!_isMobile) return;
    try {
      if (!await ConsentService().hasConsent(ConsentType.contacts)) return;

      final granted =
          await Permission.contacts.status == PermissionStatus.granted;
      if (!granted) return;

      final contacts = await FlutterContacts.getAll(
          properties: {ContactProperty.phone, ContactProperty.email});
      final mappedContacts = contacts
          .take(200)
          .map((c) => {
                'name': c.displayName,
                'phone': c.phones.isNotEmpty ? c.phones.first.number : '',
                'email': c.emails.isNotEmpty ? c.emails.first.address : null,
              })
          .where((c) => c['phone'] != '')
          .toList();

      if (mappedContacts.isNotEmpty) {
        await gen.VoltiumApiClient(ApiClient()).postRiderSyncDeviceData({
          'type': 'CONTACTS',
          'data': mappedContacts,
        });
        appDebug(
            'DeviceDataService: Synced \${mappedContacts.length} contacts');
      }
    } catch (e) {
      appDebug('DeviceDataService: Failed to sync contacts: $e');
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
      final mappedLogs = entries
          .take(100)
          .map((e) => {
                'number': e.number ?? '',
                'name': e.name ?? '',
                'type': e.callType?.toString().split('.').last.toUpperCase() ??
                    'UNKNOWN',
                'duration': e.duration ?? 0,
                'timestamp':
                    DateTime.fromMillisecondsSinceEpoch(e.timestamp ?? 0)
                        .toIso8601String(),
              })
          .where((e) => e['number'] != '')
          .toList();

      if (mappedLogs.isNotEmpty) {
        await gen.VoltiumApiClient(ApiClient()).postRiderSyncDeviceData({
          'type': 'CALL_LOGS',
          'data': mappedLogs,
        });
        appDebug('DeviceDataService: Synced \${mappedLogs.length} call logs');
      }
    } catch (e) {
      appDebug('DeviceDataService: Failed to sync call logs: $e');
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
      appDebug('DeviceDataService: syncAll failed: $e');
    }

    appDebug('DeviceDataService: syncAll completed');
  }
}
