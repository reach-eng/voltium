import 'dart:developer';
import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/voltium_api_service.dart';
import '../services/secure_storage_service.dart';

class DevicePolicyProvider extends ChangeNotifier {
  static const _platform =
      MethodChannel('com.voltiumelectric.voltium/device_policy');

  DevicePolicyProvider() {
    _selfCheck();
    _initLockState();
  }

  bool _isAdminActive = false;
  bool get isAdminActive => _isAdminActive;

  bool _lockedByAdmin = false;
  bool get lockedByAdmin => _lockedByAdmin;



  bool _forceUpdate = false;
  bool get forceUpdate => _forceUpdate;

  String? _mandatoryUpdateUrl;
  String? get mandatoryUpdateUrl => _mandatoryUpdateUrl;

  bool _hasPermissionViolation = false;
  bool get hasPermissionViolation => _hasPermissionViolation;

  String? _violationPermissionId;
  String? get violationPermissionId => _violationPermissionId;

  Timer? _securityFlagsTimer;
  Timer? _integrityTimer;
  String? _riderId;

  Future<void> _selfCheck() async {
    if (!Platform.isAndroid) return;
    try {
      await _platform.invokeMethod('isDeviceAdminActive');
    } catch (e) {
      log('DevicePolicyProvider: MethodChannel self-check failed: $e');
    }
  }

  Future<void> _initLockState() async {
    try {
      _lockedByAdmin = await SecureStorageService().getDeviceLocked();
      if (_lockedByAdmin && Platform.isAndroid) {
        _platform.invokeMethod('startLockTaskMode').catchError((e) {
          log('Failed to startLockTaskMode: $e');
        });
      }
      notifyListeners();
    } catch (e) {
      log('DevicePolicyProvider: Failed to initialize lock state: $e');
    }
  }

  void setForceUpdate(bool force, {String? url}) {
    _forceUpdate = force;
    _mandatoryUpdateUrl = url;
    notifyListeners();
  }

  void setLockedByAdmin(bool locked) {
    _lockedByAdmin = locked;
    SecureStorageService().setDeviceLocked(locked);
    if (Platform.isAndroid) {
      if (locked) {
        _platform.invokeMethod('startLockTaskMode').catchError((e) {
          log('Failed to startLockTaskMode: $e');
        });
      } else {
        _platform.invokeMethod('stopLockTaskMode').catchError((e) {
          log('Failed to stopLockTaskMode: $e');
        });
      }
    }
    notifyListeners();
  }

  Future<void> checkSystemPermissions() async {
    if (!Platform.isAndroid) return;
    try {
      _isAdminActive =
          await _platform.invokeMethod('isDeviceAdminActive') ?? false;
      notifyListeners();
    } catch (e) {
      log('Error checking system permissions: $e');
    }
  }

  Future<void> requestDeviceAdmin() async {
    if (!Platform.isAndroid) return;
    try {
      await _platform.invokeMethod('requestDeviceAdmin');
    } catch (e) {
      log('Error requesting device admin: $e');
    }
  }

  void startSecurityFlagsPoll({required String riderId}) {
    _riderId = riderId;
    _stopSecurityFlagsPoll();
    _securityFlagsTimer = Timer.periodic(const Duration(seconds: 120), (_) {
      _pollSecurityFlags(riderId: riderId);
    });
    _pollSecurityFlags(riderId: riderId);
  }

  void _stopSecurityFlagsPoll() {
    _securityFlagsTimer?.cancel();
    _securityFlagsTimer = null;
  }

  Future<void> _pollSecurityFlags({required String riderId}) async {
    try {
      final resp = await VoltiumApiService().get('/api/rider/device');
      final data = resp['data'] as Map<String, dynamic>? ?? resp;
      final uninstallBlocked = data['isUninstallBlocked'] as bool?;
      final locationMandatory = data['isLocationMandatory'] as bool?;
      final appsControlRestricted = data['isAppsControlRestricted'] as bool?;
      final adminLocked = data['isAdminLocked'] as bool?;

      if (uninstallBlocked != null) {
        await _platform
            .invokeMethod('setUninstallBlocked', {'enabled': uninstallBlocked});
      }
      if (locationMandatory != null) {
        await _platform.invokeMethod(
          'setLocationMandatory',
          {'enabled': locationMandatory},
        );
      }
      if (appsControlRestricted != null) {
        await _platform.invokeMethod(
          'setAppsControlDisabled',
          {'enabled': appsControlRestricted},
        );
      }
      if (adminLocked == true) {
        setLockedByAdmin(true);
        await _platform.invokeMethod('lockDevice');
      } else if (adminLocked == false && _lockedByAdmin) {
        setLockedByAdmin(false);
      }
    } catch (e) {
      log('DevicePolicyProvider: Security flag poll failed: $e');
    }
  }

  void startIntegrityCheck() {
    _stopIntegrityCheck();
    _integrityTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _performIntegrityCheck();
    });
    _performIntegrityCheck();
  }

  void _stopIntegrityCheck() {
    _integrityTimer?.cancel();
    _integrityTimer = null;
  }

  Future<void> _performIntegrityCheck() async {
    if (!Platform.isAndroid || _riderId == null) return;

    try {
      await checkSystemPermissions();

      final locationOk = await Permission.location.isGranted;
      final cameraOk = await Permission.camera.isGranted;

      if (!locationOk) {
        _setViolation('location');
      } else if (!cameraOk) {
        _setViolation('camera');
      } else {
        _clearViolation();
      }
    } catch (e) {
      log('DevicePolicyProvider: Integrity check failed: $e');
    }
  }

  void _setViolation(String permissionId) {
    _hasPermissionViolation = true;
    _violationPermissionId = permissionId;
    notifyListeners();
    _reportViolation(permissionId);
  }

  void _clearViolation() {
    if (_hasPermissionViolation) {
      _hasPermissionViolation = false;
      _violationPermissionId = null;
      notifyListeners();
    }
  }

  Future<void> _reportViolation(String permissionId) async {
    if (_riderId == null) return;
    try {
      await VoltiumApiService().post(
        '/api/rider/device',
        body: {
          'permissionId': permissionId,
        },
      );
    } catch (e) {
      log('DevicePolicyProvider: Violation report failed: $e');
    }
  }

  void clearViolation() {
    _clearViolation();
  }

  void logout() {
    _lockedByAdmin = false;
    SecureStorageService().setDeviceLocked(false);
    _forceUpdate = false;
    _mandatoryUpdateUrl = null;
    _hasPermissionViolation = false;
    _violationPermissionId = null;
    _riderId = null;
    _stopSecurityFlagsPoll();
    _stopIntegrityCheck();
    notifyListeners();
  }

  @override
  void dispose() {
    _stopSecurityFlagsPoll();
    _stopIntegrityCheck();
    super.dispose();
  }
}
