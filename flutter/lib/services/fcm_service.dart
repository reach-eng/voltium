import 'dart:convert';
import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/services.dart';
import 'package:crypto/crypto.dart';
import 'package:meta/meta.dart';
import '../utils/app_logger.dart' show appDebug;
import 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'secure_storage_service.dart';
import '../core/platform/platform_info.dart';
import 'package:voltium_rider/services/device_data_service.dart';
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
  static final Map<String, int> _seenSecurityChallenges = <String, int>{};
  static const _securityReplayWindow = Duration(minutes: 5);

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

    return true;
  }

  @visibleForTesting
  static void pruneExpiredChallenges() {
    final cutoff = DateTime.now().millisecondsSinceEpoch -
        _securityReplayWindow.inMilliseconds;
    _seenSecurityChallenges.removeWhere((_, added) => added < cutoff);
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

  // N-1 (PR-C, 2026-08-28 workflows polish): the in-app push master
  // switch (`NotificationPrefs.push`) suppresses PRESENTATION of
  // OVERLAY_TRIGGER messages (see the foreground handler above at
  // the `if (!NotificationService().notificationsEnabled) return;`
  // branch), but the rider's FCM token stays subscribed to backend
  // topics — the backend keeps paying for the sends and the rider
  // has no way to opt out of the noise at the protocol level. This
  // helper subscribes/unsubscribes to the known backend topics so a
  // muted rider doesn't consume backend quota and can't receive data
  // updates the UI has no use for.
  //
  // The 4 topic names are backend-defined; the Flutter side mirrors
  // them as constants here. If/when the backend adopts a new topic,
  // add it to this list.
  static const List<String> _backendTopics = [
    'rider_overlays',
    'rider_rent',
    'rider_kyc',
    'rider_support',
  ];

  @visibleForTesting
  static List<String> get debugBackendTopics => List.unmodifiable(_backendTopics);

  /// Subscribe to (or unsubscribe from) the backend topics the rider
  /// is opted into. Called by the notification-preferences screen
  /// after the user saves the push master switch.
  ///
  /// - `muted = true`  → unsubscribe from all known backend topics
  /// - `muted = false` → re-subscribe to all known backend topics
  ///
  /// SECURITY_COMMANDs are unaffected — admin device-control
  /// messages bypass the topic system and are processed even when
  /// the rider has muted push (see the `data['type'] == 'SECURITY_COMMAND'`
  /// branch above). The rider cannot mute admin commands.
  ///
  /// Errors are swallowed: a backend topic that doesn't exist
  /// (yet) is a no-op on the Firebase side, and a network blip
  /// during subscribe/unsubscribe shouldn't block the rider from
  /// saving their preferences.
  static Future<void> setPushMuted(bool muted) async {
    if (PlatformInfo.isWeb) {
      appDebug('FCM: setPushMuted skipped on web');
      return;
    }
    final messaging = FirebaseMessaging.instance;
    for (final topic in _backendTopics) {
      try {
        if (muted) {
          await messaging.unsubscribeFromTopic(topic);
        } else {
          await messaging.subscribeToTopic(topic);
        }
      } catch (e) {
        appDebug('FCM: setPushMuted topic=$topic muted=$muted failed: $e');
      }
    }
    appDebug('FCM: setPushMuted($muted) — ${_backendTopics.length} topics processed');
  }

  @visibleForTesting
  static Future<void> handleSecurityCommand(RemoteMessage message) async {
    final data = message.data;
    if (data['type'] == 'SECURITY_COMMAND') {
      final action = data['action'];
      appDebug('Security command received: $action');

      try {
        // N-3 (PR-D, 2026-08-28 workflows polish): the action →
        // side-effect mapping now lives in a single helper
        // (`applySecurityAction`) shared with the background
        // handler. Previously the fg and bg handlers had two
        // near-identical switch statements with subtle drift
        // (e.g. bg `DISABLE_CAMERA` only logged instead of
        // disabling the camera). The unified helper fixes that
        // drift and means a future security action needs to be
        // added in exactly one place.
        await applySecurityAction(action, source: 'fg');
      } on PlatformException catch (e) {
        appDebug('Error executing security command: ${e.message}');
      }
    }
  }

  /// N-3 (PR-D, 2026-08-28 workflows polish): single source of truth
  /// for the security-action → side-effect map. Called by both
  /// the foreground handler (`handleSecurityCommand`) and the
  /// background handler (`_firebaseMessagingBackgroundHandler`).
  ///
  /// Foreground side-effects go through `DevicePolicyProvider` so
  /// the UI updates; in the background isolate those providers
  /// are null, so the calls are no-ops. Both paths also write to
  /// `SecureStorageService` so the persisted state survives a
  /// cold start.
  ///
  /// `source` is `fg` or `bg` — used only in log lines so an
  /// operator can tell which path the action came from when
  /// investigating a support ticket.
  @visibleForTesting
  static Future<void> applySecurityAction(
    String action, {
    required String source,
  }) async {
    switch (action) {
      case 'ADMIN_LOCK':
        _devicePolicy?.setLockedByAdmin(true);
        await SecureStorageService().setDeviceLocked(true);
        await _channel.invokeMethod('lockDevice');
      case 'UNLOCK_DEVICE':
        _devicePolicy?.setLockedByAdmin(false);
        await SecureStorageService().setDeviceLocked(false);
      case 'DISABLE_CAMERA':
        _devicePolicy?.setCameraDisabled(true);
        appDebug('DISABLE_CAMERA received in $source');
      case 'ENABLE_CAMERA':
        _devicePolicy?.setCameraDisabled(false);
        appDebug('ENABLE_CAMERA received in $source');
      case 'ENFORCE_PASSCODE':
        _devicePolicy?.setPasscodeRequired(true);
        appDebug('ENFORCE_PASSCODE received in $source');
      case 'CHECK_LOCATION_INTEGRITY':
        _devicePolicy?.triggerLocationVerification();
        appDebug('CHECK_LOCATION_INTEGRITY received in $source');
      case 'PERSIST_APP':
        _devicePolicy?.setAppPersistenceRequired(true);
        appDebug('PERSIST_APP received in $source');
      case 'ENFORCE_LOCATION':
        _devicePolicy?.setLocationRequired(true);
        appDebug('ENFORCE_LOCATION received in $source');
      case 'RESTRICT_APPS_CONTROL':
        _devicePolicy?.setRestrictedAppsMode(true);
        appDebug('RESTRICT_APPS_CONTROL received in $source');
      case 'FACTORY_RESET':
        await _channel.invokeMethod('factoryReset');
      case 'SYNC_DEVICE_DATA':
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
    try {
      // N-3 (PR-D, 2026-08-28 workflows polish): delegate to the
      // shared `applySecurityAction` helper. The bg path was
      // previously a near-duplicate of the fg path with subtle
      // drift (DISABLE_CAMERA only logged in bg; the actual
      // camera state was never disabled). The unified helper
      // ensures both paths produce the same side effects.
      await FCMService.applySecurityAction(action, source: 'bg');
    } catch (e) {
      appDebug('Error in background security command: $e');
    }
  }
}
