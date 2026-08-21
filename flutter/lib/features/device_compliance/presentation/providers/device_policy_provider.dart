// PR-8 (2026-08-21): rename `DevicePolicyNotifier` → `DevicePolicyProvider`.
// The class is the canonical provider; the previous `typedef` alias
// was a leftover from the legacy `ChangeNotifier` migration.
//
// R4.3c-5 — Riverpod v3 `DevicePolicyProvider` (Notifier + state).
//
// The previous `ChangeNotifier` had three concurrent timers
// (security-flags poll, integrity check with exponential
// backoff, location-sync) and a method-channel bridge to the
// native Android device-policy module. All of that machinery
// is preserved — the notifier holds the same `Timer` instances
// and the same `MethodChannel` reference. Lifecycle is now
// managed via `ref.onDispose` instead of the manual
// `dispose()` override.
//
// Same external surface:
//   - isAdminActive, lockedByAdmin, forceUpdate,
//     mandatoryUpdateUrl, hasPermissionViolation,
//     violationPermissionId
//   - setForceUpdate, setCameraDisabled, setPasscodeRequired,
//     triggerLocationVerification, setAppPersistenceRequired,
//     setLocationRequired, setRestrictedAppsMode,
//     setLockedByAdmin, checkSystemPermissions,
//     requestDeviceAdmin, startSecurityFlagsPoll,
//     startIntegrityCheck, clearViolation, logout

import 'dart:async';
import 'dart:developer' show log;
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:voltium_rider/core/navigation/app_state.dart';
import 'package:voltium_rider/core/navigation/app_state_notifier.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';
import 'package:voltium_rider/core/platform/platform_info.dart';

@immutable
class DevicePolicyState {
  final bool isAdminActive;
  final bool lockedByAdmin;
  final bool forceUpdate;
  final String? mandatoryUpdateUrl;
  final bool hasPermissionViolation;
  final String? violationPermissionId;

  const DevicePolicyState({
    this.isAdminActive = false,
    this.lockedByAdmin = false,
    this.forceUpdate = false,
    this.mandatoryUpdateUrl,
    this.hasPermissionViolation = false,
    this.violationPermissionId,
  });

  DevicePolicyState copyWith({
    bool? isAdminActive,
    bool? lockedByAdmin,
    bool? forceUpdate,
    String? mandatoryUpdateUrl,
    bool? hasPermissionViolation,
    String? violationPermissionId,
    bool clearMandatoryUpdateUrl = false,
    bool clearViolationPermissionId = false,
  }) =>
      DevicePolicyState(
        isAdminActive: isAdminActive ?? this.isAdminActive,
        lockedByAdmin: lockedByAdmin ?? this.lockedByAdmin,
        forceUpdate: forceUpdate ?? this.forceUpdate,
        mandatoryUpdateUrl: clearMandatoryUpdateUrl
            ? null
            : (mandatoryUpdateUrl ?? this.mandatoryUpdateUrl),
        hasPermissionViolation:
            hasPermissionViolation ?? this.hasPermissionViolation,
        violationPermissionId: clearViolationPermissionId
            ? null
            : (violationPermissionId ?? this.violationPermissionId),
      );
}

class DevicePolicyProvider extends Notifier<DevicePolicyState> {
  static const _platform =
      MethodChannel('com.voltiumelectric.voltium/device_policy');

  Timer? _securityFlagsTimer;
  Timer? _integrityTimer;
  String? _riderId;
  int _integrityFailureCount = 0;

  static const Duration _integrityInitialInterval = Duration(seconds: 10);
  static const Duration _integrityMaxBackoff = Duration(seconds: 60);
  static const int _integrityMaxRetries = 6;

  @override
  DevicePolicyState build() {
    // Kick off the same async setup the old ChangeNotifier did in
    // its constructor.
    Future.microtask(() async {
      await _selfCheck();
      await _initLockState();
    });
    // R4.5 — Scope security polling strictly to active screen states
    ref.listen<AppState>(appStateProvider, (previous, next) {
      if (next is! ActiveDashboard && next is! PreDashboard) {
        _stopSecurityFlagsPoll();
        _stopIntegrityCheck();
      }
    });

    ref.onDispose(() {
      _stopSecurityFlagsPoll();
      _stopIntegrityCheck();
    });
    return const DevicePolicyState();
  }

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
      final locked = await SecureStorageService().getDeviceLocked();
      state = state.copyWith(lockedByAdmin: locked);
      if (locked && Platform.isAndroid) {
        _platform.invokeMethod('startLockTaskMode').catchError((e) {
          log('Failed to startLockTaskMode: $e');
        });
      }
    } catch (e) {
      log('DevicePolicyProvider: Failed to initialize lock state: $e');
    }
  }

  void setForceUpdate(bool force, {String? url}) {
    state = state.copyWith(
      forceUpdate: force,
      mandatoryUpdateUrl: url,
      clearMandatoryUpdateUrl: url == null,
    );
  }

  void setCameraDisabled(bool disabled) {
    state = state.copyWith(hasPermissionViolation: disabled);
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
    state = state.copyWith(hasPermissionViolation: required);
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
    state = state.copyWith(lockedByAdmin: locked);
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
  }

  Future<void> checkSystemPermissions() async {
    if (PlatformInfo.isWeb) return;
    if (!Platform.isAndroid) return;
    try {
      final result = await _platform.invokeMethod('isDeviceAdminActive');
      final active = result is bool ? result : false;
      state = state.copyWith(isAdminActive: active);
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
    final appState = ref.read(appStateProvider);
    if (appState is! ActiveDashboard && appState is! PreDashboard) return;
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
      final resp = await ref.read(apiClientProvider).get('/api/rider/device');
      final data = resp['data'] as Map<String, dynamic>? ?? resp;
      final uninstallBlocked = data['isUninstallBlocked'] as bool?;
      final locationMandatory = data['isLocationMandatory'] as bool?;
      final appsControlRestricted = data['isAppsControlRestricted'] as bool?;
      final adminLocked = data['isAdminLocked'] as bool?;

      if (PlatformInfo.isWeb) {
        if (adminLocked == true) {
          setLockedByAdmin(true);
        } else if (adminLocked == false && state.lockedByAdmin) {
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
      } else if (adminLocked == false && state.lockedByAdmin) {
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
    state = state.copyWith(
      hasPermissionViolation: true,
      violationPermissionId: permissionId,
    );
    _reportViolation(permissionId);
  }

  void _clearViolation() {
    if (state.hasPermissionViolation) {
      state = state.copyWith(
        hasPermissionViolation: false,
        clearViolationPermissionId: true,
      );
    }
  }

  Future<void> _reportViolation(String permissionId) async {
    if (_riderId == null) return;
    try {
      await ref.read(apiClientProvider).post(
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

  /// Sign-out: clear state and stop all timers.
  void logout() {
    state = const DevicePolicyState();
    SecureStorageService().setDeviceLocked(false);
    _riderId = null;
    _stopSecurityFlagsPoll();
    _stopIntegrityCheck();
  }
}

/// Riverpod v3 provider for the device-policy feature.
final devicePolicyProvider =
    NotifierProvider<DevicePolicyProvider, DevicePolicyState>(
  DevicePolicyProvider.new,
);
