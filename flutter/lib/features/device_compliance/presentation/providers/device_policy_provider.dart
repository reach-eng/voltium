import 'dart:developer';
import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';
import 'package:voltium_rider/core/platform/platform_info.dart';


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
  int _integrityFailureCount = 0;

  static const Duration _integrityInitialInterval = Duration(seconds: 10);
  static const Duration _integrityMaxBackoff = Duration(seconds: 60);
  static const int _integrityMaxRetries = 6;

  Future<void> _selfCheck() async {
    if (PlatformInfo.isWeb) return;
    if (!Platform.isAndroid) return;
    try {
      await _platform.invokeMethod('isDeviceAdminActive');
    } catch (e) {
      log('DevicePolicyProvider: MethodChannel self-check failed: $e');
    }
  }

  Future<void> _initLockState() async {
    if (PlatformInfo.isWeb) return;
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

  void setCameraDisabled(bool disabled) {
    _hasPermissionViolation = disabled;
    notifyListeners();
    if (!PlatformInfo.isWeb && Platform.isAndroid) {
      _platform.invokeMethod('setCameraDisabled', {'disabled': disabled});
    }
  }

  void setPasscodeRequired(bool required) {
    if (!PlatformInfo.isWeb && Platform.isAndroid) {
      _platform.invokeMethod('setPasscodeRequired', {'required': required});
    }
  }

  void triggerLocationVerification() {
    if (!PlatformInfo.isWeb && Platform.isAndroid) {
      _platform.invokeMethod('triggerLocationVerification');
    }
  }

  void setAppPersistenceRequired(bool required) {
    if (!PlatformInfo.isWeb && Platform.isAndroid) {
      _platform.invokeMethod('setAppPersistenceRequired', {
        'required': required,
      });
    }
  }

  void setLocationRequired(bool required) {
    _hasPermissionViolation = required;
    notifyListeners();
    if (!PlatformInfo.isWeb && Platform.isAndroid) {
      _platform.invokeMethod('setLocationMandatory', {'enabled': required});
    }
  }

  void setRestrictedAppsMode(bool restricted) {
    if (!PlatformInfo.isWeb && Platform.isAndroid) {
      _platform.invokeMethod('setAppsControlDisabled', {
        'enabled': restricted,
      });
    }
  }

  void setLockedByAdmin(bool locked) {
    _lockedByAdmin = locked;
    SecureStorageService().setDeviceLocked(locked);
    if (!PlatformInfo.isWeb && Platform.isAndroid) {
      if (locked) {
        _platform.invokeMethod('startLockTaskMode').catchError((e) {
          log('Failed to startLockTaskMode: $e');
        });
        _platform.invokeMethod('lockDevice').catchError((e) {
          log('Failed to lockDevice: $e');
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
    if (PlatformInfo.isWeb) return;
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
    if (PlatformInfo.isWeb) return;
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

      if (PlatformInfo.isWeb) {
        if (adminLocked == true) {
          setLockedByAdmin(true);
        } else if (adminLocked == false && _lockedByAdmin) {
          setLockedByAdmin(false);
        }
        return;
      }

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
    _integrityFailureCount = 0;
    _scheduleIntegrityCheck(_integrityInitialInterval);
  }

  void _stopIntegrityCheck() {
    _integrityTimer?.cancel();
    _integrityTimer = null;
  }

  void _scheduleIntegrityCheck(Duration interval) {
    _stopIntegrityCheck();
    _integrityTimer = Timer(interval, _performIntegrityCheck);
  }

  Future<void> _performIntegrityCheck() async {
    if (PlatformInfo.isWeb) return;
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

      _onIntegrityResult(locationOk && cameraOk);
    } catch (e) {
      log('DevicePolicyProvider: Integrity check failed: $e');
      _onIntegrityResult(false);
    }
  }

  void _onIntegrityResult(bool success) {
    if (success) {
      _integrityFailureCount = 0;
      _scheduleIntegrityCheck(_integrityInitialInterval);
      return;
    }
    _integrityFailureCount++;
    if (_integrityFailureCount >= _integrityMaxRetries) {
      _stopIntegrityCheck();
      return;
    }
    final backoff = Duration(
      seconds:
          (_integrityInitialInterval.inSeconds << (_integrityFailureCount - 1))
              .clamp(0, _integrityMaxBackoff.inSeconds),
    );
    _scheduleIntegrityCheck(backoff);
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
