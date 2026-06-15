import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/services.dart';
import 'dart:developer' as developer;
import '../providers/device_policy_provider.dart';
import '../providers/wallet_provider.dart';
import '../providers/support_provider.dart';
import '../providers/rider_provider.dart';

class FCMService {
  static const _channel = MethodChannel('in.voltium.rider/device_policy');
  static DevicePolicyProvider? _devicePolicy;
  static WalletProvider? _wallet;
  static SupportProvider? _support;
  static RiderProvider? _rider;

  static const _allowedSecurityActions = <String>{
    'LOCK_DEVICE',
    'FACTORY_RESET',
    'DISABLE_CAMERA',
    'ENABLE_CAMERA',
    'ENFORCE_PASSCODE',
    'CHECK_LOCATION_INTEGRITY',
    'ADMIN_LOCK',
    'UNLOCK_DEVICE',
    'PERSIST_APP',
    'ENFORCE_LOCATION',
    'RESTRICT_APPS_CONTROL',
  };

  static const _allowedOverlayActions = <String>{
    'MANDATORY_UPDATE',
    'WALLET_LOW',
    'KYC_STATUS',
    'SUPPORT_REPLY',
  };

  static bool _validatePayload(Map<String, dynamic> data,
      {required bool isSecurity}) {
    final action = data['action'];
    if (action == null || action is! String || action.isEmpty) {
      developer.log('FCM: Rejected payload with missing/invalid action');
      return false;
    }
    final allowed =
        isSecurity ? _allowedSecurityActions : _allowedOverlayActions;
    if (!allowed.contains(action)) {
      developer.log(
          'FCM: Rejected unknown ${isSecurity ? "security" : "overlay"} action: $action');
      return false;
    }
    return true;
  }

  static Future<void> initialize({
    required DevicePolicyProvider devicePolicy,
    required WalletProvider wallet,
    required SupportProvider support,
    required RiderProvider rider,
  }) async {
    _devicePolicy = devicePolicy;
    _wallet = wallet;
    _support = support;
    _rider = rider;
    final messaging = FirebaseMessaging.instance;

    // Request permissions
    await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Handle background messages
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      developer.log('Foreground message received: ${message.data}');
      final data = message.data;
      if (data['type'] == 'SECURITY_COMMAND' &&
          _validatePayload(data, isSecurity: true)) {
        _handleSecurityCommand(message);
      } else if (data['type'] == 'OVERLAY_TRIGGER' &&
          _validatePayload(data, isSecurity: false)) {
        _handleOverlayTrigger(message);
      }
    });
  }

  static Future<void> _handleSecurityCommand(RemoteMessage message) async {
    final data = message.data;
    if (data['type'] == 'SECURITY_COMMAND') {
      final action = data['action'];
      developer.log('Security command received: $action');

      try {
        if (action == 'LOCK_DEVICE') {
          await _channel.invokeMethod('lockDevice');
        } else if (action == 'FACTORY_RESET') {
          await _channel.invokeMethod('factoryReset');
        } else if (action == 'DISABLE_CAMERA') {
          await _channel.invokeMethod('setCameraDisabled', {'disabled': true});
        } else if (action == 'ENABLE_CAMERA') {
          await _channel.invokeMethod('setCameraDisabled', {'disabled': false});
        } else if (action == 'ENFORCE_PASSCODE') {
          final minLength = int.tryParse(data['minLength'] ?? '4') ?? 4;
          await _channel
              .invokeMethod('setPasscodeRequirement', {'minLength': minLength});
        } else if (action == 'CHECK_LOCATION_INTEGRITY') {
          final isMock = await _channel.invokeMethod('isMockLocationEnabled');
          developer.log('Location integrity check result: $isMock');
        } else if (action == 'ADMIN_LOCK') {
          final password = data['password'] ?? data['pin'];
          if (password != null) {
            _devicePolicy?.setLockedByAdmin(true, password: password);
            await _channel.invokeMethod('lockDevice');
          }
        } else if (action == 'UNLOCK_DEVICE') {
          _devicePolicy?.setLockedByAdmin(false);
        } else if (action == 'PERSIST_APP') {
          final enabled = data['enabled'] == 'true';
          await _channel
              .invokeMethod('setUninstallBlocked', {'enabled': enabled});
        } else if (action == 'ENFORCE_LOCATION') {
          final enabled = data['enabled'] == 'true';
          await _channel
              .invokeMethod('setLocationMandatory', {'enabled': enabled});
        } else if (action == 'RESTRICT_APPS_CONTROL') {
          final enabled = data['enabled'] == 'true';
          await _channel
              .invokeMethod('setAppsControlDisabled', {'enabled': enabled});
        }
      } on PlatformException catch (e) {
        developer.log('Error executing security command: ${e.message}');
      }
    }
  }

  static void _handleOverlayTrigger(RemoteMessage message) {
    final data = message.data;
    final action = data['action'];
    developer.log('Overlay trigger received: $action');

    if (action == 'MANDATORY_UPDATE') {
      final url = data['url'];
      _devicePolicy?.setForceUpdate(true, url: url);
    } else if (action == 'WALLET_LOW') {
      final balance = double.tryParse(data['balance'] ?? '0.0') ?? 0.0;
      _wallet?.setWalletBalanceWarning(true, balance: balance);
    } else if (action == 'KYC_STATUS') {
      _rider?.refresh();
    } else if (action == 'SUPPORT_REPLY') {
      _support?.refreshTickets();
    }
  }

  static Future<String?> getToken() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      developer.log('Error getting FCM token: $e');
      return null;
    }
  }
}

// Global background handler
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  developer.log('Background message received: ${message.data}');

  final data = message.data;
  final isSecurity = data['type'] == 'SECURITY_COMMAND';
  final isOverlay = data['type'] == 'OVERLAY_TRIGGER';
  final action = data['action'];

  if (action == null || action is! String || action.isEmpty) {
    developer
        .log('FCM background: Rejected payload with missing/invalid action');
    return;
  }

  if (isSecurity && !FCMService._allowedSecurityActions.contains(action)) {
    developer.log('FCM background: Rejected unknown security action: $action');
    return;
  }

  if (isOverlay && !FCMService._allowedOverlayActions.contains(action)) {
    developer.log('FCM background: Rejected unknown overlay action: $action');
    return;
  }

  if (isSecurity) {
    const channel = MethodChannel('in.voltium.rider/device_policy');

    try {
      if (action == 'LOCK_DEVICE') {
        await channel.invokeMethod('lockDevice');
      } else if (action == 'FACTORY_RESET') {
        await channel.invokeMethod('factoryReset');
      } else if (action == 'DISABLE_CAMERA') {
        await channel.invokeMethod('setCameraDisabled', {'disabled': true});
      } else if (action == 'ENABLE_CAMERA') {
        await channel.invokeMethod('setCameraDisabled', {'disabled': false});
      } else if (action == 'ENFORCE_PASSCODE') {
        final minLength = int.tryParse(data['minLength'] ?? '4') ?? 4;
        await channel
            .invokeMethod('setPasscodeRequirement', {'minLength': minLength});
      } else if (action == 'UNLOCK_DEVICE') {
        // Can't update AppProvider state in background, but native unlock isn't needed
        // since the lock screen will be dismissed by the user with the recovery password
        developer.log('UNLOCK_DEVICE received in background');
      } else if (action == 'ADMIN_LOCK') {
        // System lock as part of Admin Lock
        await channel.invokeMethod('lockDevice');
      } else if (action == 'PERSIST_APP') {
        final enabled = data['enabled'] == 'true';
        await channel.invokeMethod('setUninstallBlocked', {'enabled': enabled});
      } else if (action == 'ENFORCE_LOCATION') {
        final enabled = data['enabled'] == 'true';
        await channel
            .invokeMethod('setLocationMandatory', {'enabled': enabled});
      } else if (action == 'RESTRICT_APPS_CONTROL') {
        final enabled = data['enabled'] == 'true';
        await channel
            .invokeMethod('setAppsControlDisabled', {'enabled': enabled});
      }
    } catch (e) {
      developer.log('Error in background security command: $e');
    }
  }
}
