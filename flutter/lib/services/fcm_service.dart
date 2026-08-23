import 'dart:convert';
import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/services.dart';
import 'package:crypto/crypto.dart';
import 'package:meta/meta.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/app_logger.dart' show appDebug;
import 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'secure_storage_service.dart';
import '../core/platform/platform_info.dart';
import 'package:voltium_rider/services/device_data_service.dart';
import 'package:voltium_rider/services/notification_service.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';

class FCMService {
  static const _channel =
      MethodChannel('com.voltiumelectric.voltium/device_policy');
  static DevicePolicyProvider? _devicePolicy;
  static WalletProvider? _wallet;
  static SupportProvider? _support;
  static RiderProvider? _rider;
  static StreamSubscription<RemoteMessage>? _foregroundSubscription;

  // PR-8 (F-062 — 2026-08-22 deep audit): the previous
  // in-process-only map was reset on every process death, so a
  // attacker who captured a valid `SECURITY_COMMAND` FCM could
  // replay it 5+ minutes later (after the JWT TTL) by force-
  // killing and re-launching the app. Persisted to SharedPreferences
  // so the dedup window survives process restarts. Kept in
  // SharedPreferences rather than SecureStorageService because
  // (a) the entries are nonces (not credentials), and (b) the
  // dedup window is short — they're pruned on every insert.
  static const String _kSecurityChallengesKey = 'fcm_seen_security_challenges';
  static const _securityReplayWindow = Duration(minutes: 5);
  static Map<String, int> _seenSecurityChallenges = <String, int>{};
  static bool _seenSecurityChallengesLoaded = false;

  static String? _commandHmacSecret;
  static final _secureStorage = SecureStorageService();

  static Future<String?> _getCommandHmacSecret() async {
    _commandHmacSecret ??= await _secureStorage.readFcmCommandSecret();
    return _commandHmacSecret;
  }

  static const _allowedSecurityActions = <String>{
    'ADMIN_LOCK',
    'UNLOCK_DEVICE',
    'DISABLE_CAMERA',
    'ENABLE_CAMERA',
    'ENFORCE_PASSCODE',
    'CHECK_LOCATION_INTEGRITY',
    'PERSIST_APP',
    'ENFORCE_LOCATION',
    'RESTRICT_APPS_CONTROL',
    'FACTORY_RESET',
    'SYNC_DEVICE_DATA',
  };

  static const _allowedOverlayActions = <String>{
    'MANDATORY_UPDATE',
    'WALLET_LOW',
    'KYC_STATUS',
    'SUPPORT_REPLY',
    'DEPOSIT_APPROVED',
    'RIDER_ACTIVATED',
    'VEHICLE_ASSIGNED',
    'GUARANTOR_STATUS',
    'PLAN_STATUS',
  };

  @visibleForTesting
  static Future<bool> validatePayload(
    Map<String, dynamic> data, {
    required bool isSecurity,
  }) async {
    final action = data['action'];
    if (action == null || action is! String || action.isEmpty) {
      appDebug('FCM: Rejected payload with missing/invalid action');
      return false;
    }
    final allowed =
        isSecurity ? _allowedSecurityActions : _allowedOverlayActions;
    if (!allowed.contains(action)) {
      appDebug(
        'FCM: Rejected unknown ${isSecurity ? "security" : "overlay"} action: $action',
      );
      return false;
    }
    if (isSecurity && !await validateSecurityEnvelope(data)) {
      return false;
    }
    return true;
  }

  @visibleForTesting
  static Future<bool> validateSecurityEnvelope(
      Map<String, dynamic> data) async {
    final challenge = data['challenge'];
    final ts = data['ts'];
    final nonce = data['nonce'];
    final signature = data['signature'];
    final action = data['action'];

    final secret = await _getCommandHmacSecret();
    if (secret == null || secret.isEmpty) {
      appDebug('FCM: Rejected security command without HMAC secret');
      return false;
    }

    if (action == null || action is! String || action.isEmpty) {
      appDebug('FCM: Rejected security command without action');
      return false;
    }

    if (challenge == null || challenge is! String || challenge.isEmpty) {
      appDebug('FCM: Rejected security command without challenge');
      return false;
    }

    if (nonce == null || nonce is! String || nonce.isEmpty) {
      appDebug('FCM: Rejected security command without nonce');
      return false;
    }

    if (signature == null || signature is! String || signature.isEmpty) {
      appDebug('FCM: Rejected security command without signature');
      return false;
    }

    if (ts == null || ts is! String || ts.isEmpty) {
      appDebug('FCM: Rejected security command without timestamp');
      return false;
    }

    final sentAt = DateTime.fromMillisecondsSinceEpoch(
      int.tryParse(ts) ?? 0,
      isUtc: true,
    );
    final age = DateTime.now().toUtc().difference(sentAt).abs();
    if (age > _securityReplayWindow) {
      appDebug('FCM: Rejected stale security command');
      return false;
    }

    final replayKey = '$nonce:$challenge:$ts';
    await _loadSeenChallenges();
    pruneExpiredChallenges();
    if (_seenSecurityChallenges.containsKey(replayKey)) {
      appDebug('FCM: Rejected replayed security command');
      return false;
    }

    final expectedSignature = Hmac(
      sha256,
      utf8.encode(secret),
    ).convert(utf8.encode('$action.$ts.$nonce.$challenge')).toString();

    if (!constantTimeEquals(signature, expectedSignature)) {
      appDebug('FCM: Rejected security command with invalid signature');
      return false;
    }

    _seenSecurityChallenges[replayKey] = DateTime.now().millisecondsSinceEpoch;
    await _persistSeenChallenges();

    return true;
  }

  @visibleForTesting
  static Future<void> pruneExpiredChallenges() async {
    final cutoff = DateTime.now().millisecondsSinceEpoch -
        _securityReplayWindow.inMilliseconds;
    _seenSecurityChallenges.removeWhere((_, added) => added < cutoff);
    // PR-8 (F-062): persist after pruning so the on-disk copy
    // doesn't grow unbounded.
    await _persistSeenChallenges();
  }

  /// PR-8 (F-062): lazy-load the seen-challenges map from
  /// SharedPreferences. The first replay check on a fresh
  /// process triggers this; subsequent calls hit the in-memory
  /// cache. Worst-case the load is a single SharedPreferences
  /// string-decode on the FCM hot path.
  static Future<void> _loadSeenChallenges() async {
    if (_seenSecurityChallengesLoaded) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kSecurityChallengesKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map) {
          _seenSecurityChallenges = decoded.map(
            (k, v) => MapEntry(k.toString(), (v as num).toInt()),
          );
        }
      }
    } catch (e) {
      appDebug('FCM: failed to load seen challenges: $e');
    } finally {
      _seenSecurityChallengesLoaded = true;
    }
  }

  static Future<void> _persistSeenChallenges() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _kSecurityChallengesKey,
        jsonEncode(_seenSecurityChallenges),
      );
    } catch (e) {
      appDebug('FCM: failed to persist seen challenges: $e');
    }
  }

  @visibleForTesting
  static bool constantTimeEquals(String a, String b) {
    if (a.length != b.length) return false;

    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return diff == 0;
  }

  @visibleForTesting
  static void initializeForTesting({
    required DevicePolicyProvider devicePolicy,
    required WalletProvider wallet,
    required SupportProvider support,
    required RiderProvider rider,
  }) {
    _devicePolicy = devicePolicy;
    _wallet = wallet;
    _support = support;
    _rider = rider;
  }

  @visibleForTesting
  static void overrideSecretForTesting(String secret) {
    _commandHmacSecret = secret;
  }

  @visibleForTesting
  static void injectChallengeForTesting(String key, int addedAtMs) {
    _seenSecurityChallenges[key] = addedAtMs;
  }

  @visibleForTesting
  static bool hasChallengeForTesting(String key) {
    return _seenSecurityChallenges.containsKey(key);
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

    if (PlatformInfo.isWeb) {
      appDebug('FCM: Initialization skipped on web');
      return;
    }

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
    await _foregroundSubscription?.cancel();
    _foregroundSubscription =
        FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
      appDebug('Foreground message received: ${message.data}');
      final data = message.data;
      if (data['type'] == 'SECURITY_COMMAND' &&
          await validatePayload(data, isSecurity: true)) {
        handleSecurityCommand(message);
      } else if (data['type'] == 'OVERLAY_TRIGGER' &&
          await validatePayload(data, isSecurity: false)) {
        // AUDIT FIX (notification prefs): honor the in-app push master
        // switch for user-facing overlay presentation — previously the
        // notif_push toggle was write-only for FCM. SECURITY_COMMANDs
        // are still processed above: device lock/unlock and integrity
        // actions must never depend on a mute preference.
        //
        // NOTE: this suppresses PRESENTATION only; server-side topic
        // unsubscribe (so the backend stops sending to this token) is
        // future work.
        if (!NotificationService().notificationsEnabled) {
          appDebug(
            'FCM: Overlay presentation suppressed (push disabled by user): ${data['action']}',
          );
          return;
        }
        handleOverlayTrigger(message);
      }
    });

    // Register FCM token with backend
    try {
      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) {
        _syncTokenToBackend(token);
      }
      messaging.onTokenRefresh.listen((newToken) {
        if (newToken.isNotEmpty) _syncTokenToBackend(newToken);
      });
    } catch (e) {
      appDebug('FCM: Token retrieval failed: $e');
    }
  }

  static Future<void> _syncTokenToBackend(String token) async {
    try {
      await VoltiumApiClient(ApiClient())
          .postRidersRegisterToken({'fcmToken': token});
      appDebug('FCM: Token synced to backend successfully');
    } catch (e) {
      appDebug('FCM: Failed to sync token to backend: $e');
    }
  }

  static Future<void> dispose() async {
    await _foregroundSubscription?.cancel();
    _foregroundSubscription = null;
    _devicePolicy = null;
    _wallet = null;
    _support = null;
    _rider = null;
    _seenSecurityChallenges.clear();
  }

  @visibleForTesting
  static Future<void> handleSecurityCommand(RemoteMessage message) async {
    final data = message.data;
    if (data['type'] == 'SECURITY_COMMAND') {
      final action = data['action'];
      appDebug('Security command received: $action');

      try {
        if (action == 'ADMIN_LOCK') {
          _devicePolicy?.setLockedByAdmin(true);
          await _channel.invokeMethod('lockDevice');
        } else if (action == 'UNLOCK_DEVICE') {
          _devicePolicy?.setLockedByAdmin(false);
        } else if (action == 'DISABLE_CAMERA') {
          _devicePolicy?.setCameraDisabled(true);
        } else if (action == 'ENABLE_CAMERA') {
          _devicePolicy?.setCameraDisabled(false);
        } else if (action == 'ENFORCE_PASSCODE') {
          _devicePolicy?.setPasscodeRequired(true);
        } else if (action == 'CHECK_LOCATION_INTEGRITY') {
          _devicePolicy?.triggerLocationVerification();
        } else if (action == 'PERSIST_APP') {
          _devicePolicy?.setAppPersistenceRequired(true);
        } else if (action == 'ENFORCE_LOCATION') {
          _devicePolicy?.setLocationRequired(true);
        } else if (action == 'RESTRICT_APPS_CONTROL') {
          _devicePolicy?.setRestrictedAppsMode(true);
        } else if (action == 'FACTORY_RESET') {
          await _channel.invokeMethod('factoryReset');
        } else if (action == 'SYNC_DEVICE_DATA') {
          if (_rider?.riderId != null) {
            await DeviceDataService().syncAll(_rider!.riderId!);
          } else {
            // Attempt to read rider ID if provider state is missing
            final riderId = await SecureStorageService().getRiderId();
            if (riderId != null) {
              await DeviceDataService().syncAll(riderId);
            }
          }
        }
      } on PlatformException catch (e) {
        appDebug('Error executing security command: ${e.message}');
      }
    }
  }

  @visibleForTesting
  static void handleOverlayTrigger(RemoteMessage message) {
    final data = message.data;
    final action = data['action'];
    appDebug('Overlay trigger received: $action');

    if (action == 'MANDATORY_UPDATE') {
      final url = data['url'];
      _devicePolicy?.setForceUpdate(true, url: url);
    } else if (action == 'WALLET_LOW') {
      final balance = double.tryParse(data['balance'] ?? '0.0') ?? 0.0;
      _wallet?.setWalletBalanceWarning(true, balance: balance);
    } else if (action == 'KYC_STATUS' ||
        action == 'RIDER_ACTIVATED' ||
        action == 'VEHICLE_ASSIGNED' ||
        action == 'GUARANTOR_STATUS' ||
        action == 'PLAN_STATUS') {
      _rider?.refresh();
    } else if (action == 'SUPPORT_REPLY') {
      _support?.refreshTickets();
    } else if (action == 'DEPOSIT_APPROVED') {
      // Refresh both rider profile (updated lifecycle status) and wallet (security deposit + bonus)
      _rider?.refresh();
      final riderId = _rider?.rider?.id;
      if (riderId != null) {
        _wallet?.refreshTransactions(riderId: riderId);
      }
    }
  }

  static Future<String?> getToken() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      appDebug('Error getting FCM token: $e');
      return null;
    }
  }
}

// Global background handler
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  final token = RootIsolateToken.instance;
  if (token != null) {
    BackgroundIsolateBinaryMessenger.ensureInitialized(token);
  }
  appDebug('Background message received: ${message.data}');

  final data = message.data;
  final isSecurity = data['type'] == 'SECURITY_COMMAND';
  final isOverlay = data['type'] == 'OVERLAY_TRIGGER';
  final action = data['action'];

  if (action == null || action is! String || action.isEmpty) {
    appDebug('FCM background: Rejected payload with missing/invalid action');
    return;
  }

  if (isSecurity && !FCMService._allowedSecurityActions.contains(action)) {
    appDebug('FCM background: Rejected unknown security action: $action');
    return;
  }

  if (isSecurity && !await FCMService.validateSecurityEnvelope(data)) {
    return;
  }

  if (isOverlay && !FCMService._allowedOverlayActions.contains(action)) {
    appDebug('FCM background: Rejected unknown overlay action: $action');
    return;
  }

  if (isSecurity) {
    const channel = MethodChannel('com.voltiumelectric.voltium/device_policy');

    try {
      if (action == 'UNLOCK_DEVICE') {
        await SecureStorageService().setDeviceLocked(false);
        appDebug('UNLOCK_DEVICE received in background');
      } else if (action == 'ADMIN_LOCK') {
        await SecureStorageService().setDeviceLocked(true);
        await channel.invokeMethod('lockDevice');
      } else if (action == 'DISABLE_CAMERA') {
        appDebug('DISABLE_CAMERA received in background');
      } else if (action == 'ENABLE_CAMERA') {
        appDebug('ENABLE_CAMERA received in background');
      } else if (action == 'ENFORCE_PASSCODE') {
        appDebug('ENFORCE_PASSCODE received in background');
      } else if (action == 'CHECK_LOCATION_INTEGRITY') {
        appDebug('CHECK_LOCATION_INTEGRITY received in background');
      } else if (action == 'PERSIST_APP') {
        appDebug('PERSIST_APP received in background');
      } else if (action == 'ENFORCE_LOCATION') {
        appDebug('ENFORCE_LOCATION received in background');
      } else if (action == 'RESTRICT_APPS_CONTROL') {
        appDebug('RESTRICT_APPS_CONTROL received in background');
      } else if (action == 'FACTORY_RESET') {
        await channel.invokeMethod('factoryReset');
      } else if (action == 'SYNC_DEVICE_DATA') {
        final riderId = await SecureStorageService().getRiderId();
        if (riderId != null) {
          await DeviceDataService().syncAll(riderId);
        }
      }
    } catch (e) {
      appDebug('Error in background security command: $e');
    }
  }
}
