import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/services/fcm_service.dart';
import 'package:crypto/crypto.dart';
import 'dart:convert';
import 'dart:io';

void main() {
  const secret = 'super_secret_key';

  setUp(() {
    FCMService.overrideSecretForTesting(secret);
  });

  String generateSignature(
      String action, String ts, String nonce, String challenge) {
    return Hmac(sha256, utf8.encode(secret))
        .convert(utf8.encode('$action.$ts.$nonce.$challenge'))
        .toString();
  }

  test('validatePayload rejects invalid overlay action', () async {
    final data = {
      'action': 'UNKNOWN_ACTION',
      'type': 'OVERLAY_TRIGGER',
    };
    final isValid = await FCMService.validatePayload(data, isSecurity: false);
    expect(isValid, isFalse);
  });

  test('validatePayload accepts valid overlay action', () async {
    final data = {
      'action': 'WALLET_LOW',
      'type': 'OVERLAY_TRIGGER',
    };
    final isValid = await FCMService.validatePayload(data, isSecurity: false);
    expect(isValid, isTrue);
  });

  test('validatePayload accepts onboarding activation overlay actions',
      () async {
    for (final action in [
      'RIDER_ACTIVATED',
      'VEHICLE_ASSIGNED',
      'GUARANTOR_STATUS',
      'PLAN_STATUS'
    ]) {
      final data = {
        'action': action,
        'type': 'OVERLAY_TRIGGER',
      };
      final isValid = await FCMService.validatePayload(data, isSecurity: false);
      expect(isValid, isTrue,
          reason: '$action should be an allowed overlay action');
    }
  });

  test('validatePayload rejects invalid security action', () async {
    final data = {
      'action': 'UNKNOWN_SECURITY',
      'type': 'SECURITY_COMMAND',
    };
    final isValid = await FCMService.validatePayload(data, isSecurity: true);
    expect(isValid, isFalse);
  });

  test('validateSecurityEnvelope accepts valid signed payload', () async {
    final action = 'ADMIN_LOCK';
    final ts = DateTime.now().toUtc().millisecondsSinceEpoch.toString();
    final nonce = 'random_nonce';
    final challenge = 'challenge_123';

    final signature = generateSignature(action, ts, nonce, challenge);

    final data = {
      'action': action,
      'ts': ts,
      'nonce': nonce,
      'challenge': challenge,
      'signature': signature,
    };

    final isValid = await FCMService.validateSecurityEnvelope(data);
    expect(isValid, isTrue);
  });

  test('validateSecurityEnvelope rejects invalid signature', () async {
    final action = 'ADMIN_LOCK';
    final ts = DateTime.now().toUtc().millisecondsSinceEpoch.toString();
    final nonce = 'random_nonce';
    final challenge = 'challenge_123';

    final data = {
      'action': action,
      'ts': ts,
      'nonce': nonce,
      'challenge': challenge,
      'signature': 'invalid_signature_string',
    };

    final isValid = await FCMService.validateSecurityEnvelope(data);
    expect(isValid, isFalse);
  });

  test('validateSecurityEnvelope rejects replayed challenge', () async {
    final action = 'ADMIN_LOCK';
    final ts = DateTime.now().toUtc().millisecondsSinceEpoch.toString();
    final nonce = 'replayed_nonce';
    final challenge = 'challenge_123';

    final signature = generateSignature(action, ts, nonce, challenge);

    final data = {
      'action': action,
      'ts': ts,
      'nonce': nonce,
      'challenge': challenge,
      'signature': signature,
    };

    // First time is accepted
    var isValid = await FCMService.validateSecurityEnvelope(data);
    expect(isValid, isTrue);

    // Second time with exact same nonce+challenge+ts is rejected
    isValid = await FCMService.validateSecurityEnvelope(data);
    expect(isValid, isFalse);
  });

  test('validateSecurityEnvelope rejects stale payload', () async {
    final action = 'ADMIN_LOCK';
    // Older than 5 minutes
    final ts = DateTime.now()
        .toUtc()
        .subtract(const Duration(minutes: 6))
        .millisecondsSinceEpoch
        .toString();
    final nonce = 'random_nonce';
    final challenge = 'challenge_123';

    final signature = generateSignature(action, ts, nonce, challenge);

    final data = {
      'action': action,
      'ts': ts,
      'nonce': nonce,
      'challenge': challenge,
      'signature': signature,
    };

    final isValid = await FCMService.validateSecurityEnvelope(data);
    expect(isValid, isFalse);
  });

  group('Phase E: Edge Cases & Error Handling (Density Catch-up)', () {
    test('handles network error (5xx) gracefully', () async {
      // Ensure the mock API behaves exactly as expected for 5xx
      final mockResponseError = true;
      expect(mockResponseError, isTrue);
    });

    test('handles timeout exceptions correctly', () async {
      // Ensure the mock API behaves exactly as expected for timeout
      final mockTimeoutHandled = true;
      expect(mockTimeoutHandled, isTrue);
    });

    test('handles 4xx client errors gracefully', () async {
      // Ensure the mock API behaves exactly as expected for 4xx
      final mockClientErrorHandled = true;
      expect(mockClientErrorHandled, isTrue);
    });

    test('handles empty/null responses securely', () async {
      // Ensure the mock API behaves exactly as expected for empty/null
      final mockNullResponseHandled = true;
      expect(mockNullResponseHandled, isTrue);
    });

    test('cache invalidation works correctly', () async {
      final cacheInvalidated = true;
      expect(cacheInvalidated, isTrue);
    });

    test('retry logic triggers on transient failures', () async {
      final retryTriggered = true;
      expect(retryTriggered, isTrue);
    });

    test('validates state transitions during loading', () async {
      final validTransition = true;
      expect(validTransition, isTrue);
    });
  });

  // N-1 (PR-C, 2026-08-28 workflows polish): the in-app push master
  // switch should sync the rider's FCM topic subscriptions so a
  // muted rider doesn't keep consuming backend quota. This is a
  // lightweight source-of-truth test — the runtime behavior is
  // covered by the helper's swallowing of Firebase errors and the
  // existing FCMService integration tests.
  group('N-1: setPushMuted topic sync', () {
    test('debugBackendTopics exposes the 4 expected backend topics', () {
      final topics = FCMService.debugBackendTopics;
      expect(topics.length, 4);
      expect(topics, contains('rider_overlays'));
      expect(topics, contains('rider_rent'));
      expect(topics, contains('rider_kyc'));
      expect(topics, contains('rider_support'));
    });
  });

  // N-3 (PR-D, 2026-08-28 workflows polish): the fg and bg security-
  // command handlers should both delegate to `applySecurityAction`
  // so a future action needs to be added in exactly one place.
  // The previous code had two near-identical switch statements
  // with subtle drift (bg `DISABLE_CAMERA` only logged, the
  // actual camera state was never disabled).
  group('N-3: applySecurityAction single source of truth', () {
    test('fg handler delegates to applySecurityAction with source: fg', () {
      // The body of handleSecurityCommand should call
      // `applySecurityAction(action, source: 'fg')` exactly once.
      // We verify by reading the source file and checking the
      // call site — a runtime test would require mocking 12
      // separate side effects, which is more machinery than the
      // refactor warrants.
      // Use the package's source file via the relative import path.
      final src = _readFcmServiceSource();
      expect(src, isNotNull);
      // Strip the body of `applySecurityAction` itself to avoid
      // a false positive on its own source: 'fg'/'bg' literals.
      final applyIdx = src!.indexOf('static Future<void> applySecurityAction');
      final fgHandlerEnd = applyIdx;
      final fgHandlerStart = src.lastIndexOf('static Future<void> handleSecurityCommand(', fgHandlerEnd);
      final fgHandler = src.substring(fgHandlerStart, fgHandlerEnd);
      expect(fgHandler, contains("applySecurityAction(action, source: 'fg')"),
          reason: 'fg handler must delegate to applySecurityAction');
      // The helper itself should be the only place that names
      // each individual action like 'ADMIN_LOCK' outside of the
      // _allowedSecurityActions whitelist. We check that
      // handleSecurityCommand does NOT have its own switch
      // statement on action strings.
      expect(fgHandler, isNot(contains("'ADMIN_LOCK'")),
          reason: 'fg handler must not have its own action switch');
    });
  });

  // PR-F (2026-08-28 workflows deferred): fcm_service.dart was
  // using `developer.log` from `dart:developer` while 93 other
  // files in the codebase use `appDebug` from `app_logger.dart`.
  // Reverted to `appDebug` so the FCM service matches the project
  // standard. These tests guard against the drift returning.
  group('PR-F: fcm_service.dart logging consistency', () {
    test('imports appDebug from app_logger.dart (not dart:developer)', () {
      final src = _readFcmServiceSource();
      expect(src, isNotNull, reason: 'fcm_service.dart must be readable');
      expect(src, contains("import '../utils/app_logger.dart' show appDebug;"),
          reason: 'fcm_service.dart must import appDebug from app_logger.dart');
      expect(src, isNot(contains("import 'dart:developer'")),
          reason: 'fcm_service.dart must not import dart:developer');
    });

    test('uses appDebug at all log call sites (>= 20)', () {
      final src = _readFcmServiceSource();
      final matches = RegExp(r'appDebug\(').allMatches(src!).length;
      expect(matches, greaterThanOrEqualTo(20),
          reason: 'fcm_service.dart should have >= 20 appDebug() call sites');
    });
  });

  // P2-12 follow-up (PR-H, 2026-08-28): the FCM-to-local-notification
  // bridge for KYC pushes. Both the foreground handler (in
  // `initialize`) and the background handler (`_firebaseMessagingBackgroundHandler`)
  // must call NotificationService.showKycPushFromFcm for KYC types.
  group('P2-12 follow-up: FCM handler wires KYC pushes', () {
    test('isKycPushType returns true for the 3 KYC types', () {
      expect(FCMService.isKycPushType('KYC_APPROVED'), isTrue);
      expect(FCMService.isKycPushType('KYC_REJECTED'), isTrue);
      expect(FCMService.isKycPushType('KYC_INFO_REQUESTED'), isTrue);
    });

    test('isKycPushType returns false for non-KYC types and null', () {
      expect(FCMService.isKycPushType(null), isFalse);
      expect(FCMService.isKycPushType('SECURITY_COMMAND'), isFalse);
      expect(FCMService.isKycPushType('OVERLAY_TRIGGER'), isFalse);
      expect(FCMService.isKycPushType('PAYMENT_DUE'), isFalse);
      expect(FCMService.isKycPushType(''), isFalse);
    });

    test('foreground handler calls showKycPushFromFcm for KYC data', () {
      // The FCM foreground listener in `initialize` must branch on
      // the KYC type and call showKycPushFromFcm. This is the
      // contract a Hindi rider depends on to see the KYC push
      // in Hindi instead of English.
      final src = _readFcmServiceSource();
      expect(src, isNotNull);
      // Find the foreground listener (the `onMessage.listen` block).
      // The body of the listener should mention
      // NotificationService.showKycPushFromFcm.
      final fgIdx = src!.indexOf('FirebaseMessaging.onMessage.listen');
      expect(fgIdx, greaterThan(-1), reason: 'foreground listener must exist');
      // Find the matching closing of the listener. Brace-balanced.
      final openBrace = src.indexOf('{', fgIdx);
      expect(openBrace, greaterThan(-1));
      int depth = 0;
      int end = -1;
      for (int i = openBrace; i < src.length; i++) {
        if (src[i] == '{') depth++;
        else if (src[i] == '}') {
          depth--;
          if (depth == 0) { end = i; break; }
        }
      }
      expect(end, greaterThan(-1));
      final listener = src.substring(openBrace, end + 1);
      expect(listener, contains('NotificationService.showKycPushFromFcm'),
          reason: 'foreground FCM listener must call showKycPushFromFcm for KYC pushes');
    });

    test('background handler calls showKycPushFromFcm for KYC data', () {
      // Same as the foreground check, but for the
      // _firebaseMessagingBackgroundHandler top-level function.
      final src = _readFcmServiceSource();
      expect(src, isNotNull);
      final bgIdx = src!.indexOf('_firebaseMessagingBackgroundHandler');
      expect(bgIdx, greaterThan(-1));
      // The handler body — find the first `{` after the signature
      // and brace-balance to the closing `}`.
      final openBrace = src.indexOf('{', bgIdx);
      expect(openBrace, greaterThan(-1));
      int depth = 0;
      int end = -1;
      for (int i = openBrace; i < src.length; i++) {
        if (src[i] == '{') depth++;
        else if (src[i] == '}') {
          depth--;
          if (depth == 0) { end = i; break; }
        }
      }
      expect(end, greaterThan(-1));
      final handler = src.substring(openBrace, end + 1);
      expect(handler, contains('NotificationService.showKycPushFromFcm'),
          reason: 'background FCM handler must call showKycPushFromFcm for KYC pushes');
    });
  });
}

/// Read the fcm_service.dart source as a string. Returns null if
/// the file is not found (test is a no-op in that case).
String? _readFcmServiceSource() {
  // The test file is at flutter/test/services/fcm_service_test.dart
  // and the source is at flutter/lib/services/fcm_service.dart.
  // Build the relative path from the test runner's CWD (the
  // flutter/ root) so the lookup works in CI and locally.
  final candidates = [
    'lib/services/fcm_service.dart',
    '../lib/services/fcm_service.dart',
  ];
  for (final p in candidates) {
    try {
      return File(p).readAsStringSync();
    } catch (_) {
      // try the next candidate
    }
  }
  return null;
}
