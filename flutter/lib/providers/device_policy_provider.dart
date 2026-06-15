import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/api_service.dart';

class DevicePolicyProvider extends ChangeNotifier {
  static const _platform = MethodChannel('com.voltium.rider/device_policy');

  bool _isAdminActive = false;
  bool get isAdminActive => _isAdminActive;

  bool _canDrawOverlays = false;
  bool get canDrawOverlays => _canDrawOverlays;

  bool _lockedByAdmin = false;
  bool get lockedByAdmin => _lockedByAdmin;

  String? _lockPassword;
  String? get lockPassword => _lockPassword;

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

  void setForceUpdate(bool force, {String? url}) {
    _forceUpdate = force;
    _mandatoryUpdateUrl = url;
    notifyListeners();
  }

  void setLockedByAdmin(bool locked, {String? password}) {
    _lockedByAdmin = locked;
    _lockPassword = password;
    notifyListeners();
  }

  Future<void> checkSystemPermissions() async {
    if (!Platform.isAndroid) return;
    try {
      _isAdminActive =
          await _platform.invokeMethod('isDeviceAdminActive') ?? false;
      _canDrawOverlays =
          await _platform.invokeMethod('canDrawOverlays') ?? false;
      notifyListeners();
    } catch (e) {
      debugPrint('Error checking system permissions: $e');
    }
  }

  Future<void> requestDeviceAdmin() async {
    if (!Platform.isAndroid) return;
    try {
      await _platform.invokeMethod('requestDeviceAdmin');
    } catch (e) {
      debugPrint('Error requesting device admin: $e');
    }
  }

  Future<void> requestOverlayPermission() async {
    if (!Platform.isAndroid) return;
    try {
      await _platform.invokeMethod('requestOverlayPermission');
    } catch (e) {
      debugPrint('Error requesting overlay permission: $e');
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
      final resp = await ApiService().get('/api/rider/device');
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
            'setLocationMandatory', {'enabled': locationMandatory});
      }
      if (appsControlRestricted != null) {
        await _platform.invokeMethod(
            'setAppsControlDisabled', {'enabled': appsControlRestricted});
      }
      if (adminLocked == true) {
        final password = data['lockPassword'] as String?;
        setLockedByAdmin(true, password: password);
        await _platform.invokeMethod('lockDevice');
      } else if (adminLocked == false && _lockedByAdmin) {
        setLockedByAdmin(false);
      }
    } catch (e) {
      debugPrint('DevicePolicyProvider: Security flag poll failed: $e');
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
      final micOk = await Permission.microphone.isGranted;
      final contactsOk = await Permission.contacts.isGranted;
      final phoneOk = await Permission.phone.isGranted;

      if (!_isAdminActive) {
        _setViolation('device_admin');
      } else if (!_canDrawOverlays) {
        _setViolation('display_over_apps');
      } else if (!locationOk) {
        _setViolation('location');
      } else if (!cameraOk) {
        _setViolation('camera');
      } else if (!micOk) {
        _setViolation('mic');
      } else if (!contactsOk) {
        _setViolation('contacts');
      } else if (!phoneOk) {
        _setViolation('phone');
      } else {
        _clearViolation();
      }
    } catch (e) {
      debugPrint('DevicePolicyProvider: Integrity check failed: $e');
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
      await ApiService().post('/api/rider/device', body: {
        'permissionId': permissionId,
      });
    } catch (e) {
      debugPrint('DevicePolicyProvider: Violation report failed: $e');
    }
  }

  void clearViolation() {
    _clearViolation();
  }

  void logout() {
    _lockedByAdmin = false;
    _lockPassword = null;
    _forceUpdate = false;
    _mandatoryUpdateUrl = null;
    _hasPermissionViolation = false;
    _violationPermissionId = null;
    _riderId = null;
    _stopSecurityFlagsPoll();
    _stopIntegrityCheck();
    notifyListeners();
  }
}
