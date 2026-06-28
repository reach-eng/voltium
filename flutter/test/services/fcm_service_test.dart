import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:crypto/crypto.dart';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:voltium_rider/services/fcm_service.dart';
import 'package:voltium_rider/providers/device_policy_provider.dart';
import 'package:voltium_rider/providers/wallet_provider.dart';
import 'package:voltium_rider/providers/support_provider.dart';
import 'package:voltium_rider/providers/rider_provider.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';
import 'package:voltium_rider/models/rider_model.dart';


class MockDevicePolicy extends Mock implements DevicePolicyProvider {}
class MockWallet extends Mock implements WalletProvider {}
class MockSupport extends Mock implements SupportProvider {}
class MockRider extends Mock implements RiderProvider {}
class MockSecureStorage extends Mock implements SecureStorageService {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late MockDevicePolicy mockDevicePolicy;
  late MockWallet mockWallet;
  late MockSupport mockSupport;
  late MockRider mockRider;

  setUp(() async {
    mockDevicePolicy = MockDevicePolicy();
    mockWallet = MockWallet();
    mockSupport = MockSupport();
    mockRider = MockRider();

    await FCMService.dispose();
  });

  group('constantTimeEquals', () {
    test('returns true for identical strings', () {
      expect(FCMService.constantTimeEquals('abc', 'abc'), isTrue);
    });

    test('returns false for different strings', () {
      expect(FCMService.constantTimeEquals('abc', 'abd'), isFalse);
    });

    test('returns false for different lengths', () {
      expect(FCMService.constantTimeEquals('abc', 'abcd'), isFalse);
    });

    test('returns true for empty strings', () {
      expect(FCMService.constantTimeEquals('', ''), isTrue);
    });
  });

  group('validatePayload', () {
    setUp(() {
      FCMService.overrideSecretForTesting('test-secret-123');
    });

    test('rejects null action', () async {
      expect(
        await FCMService.validatePayload(<String, dynamic>{}, isSecurity: false),
        isFalse,
      );
    });

    test('rejects non-string action', () async {
      expect(
        await FCMService.validatePayload(<String, dynamic>{'action': 123}, isSecurity: false),
        isFalse,
      );
    });

    test('rejects empty action', () async {
      expect(
        await FCMService.validatePayload(<String, dynamic>{'action': ''}, isSecurity: false),
        isFalse,
      );
    });

    test('accepts valid overlay action', () async {
      expect(
        await FCMService.validatePayload(<String, dynamic>{'action': 'MANDATORY_UPDATE'}, isSecurity: false),
        isTrue,
      );
    });

    test('rejects unknown overlay action', () async {
      expect(
        await FCMService.validatePayload(<String, dynamic>{'action': 'UNKNOWN_ACTION'}, isSecurity: false),
        isFalse,
      );
    });

    test('rejects security action without envelope', () async {
      expect(
        await FCMService.validatePayload(<String, dynamic>{'action': 'ADMIN_LOCK'}, isSecurity: true),
        isFalse,
      );
    });
  });

  group('validateSecurityEnvelope', () {
    setUp(() {
      FCMService.overrideSecretForTesting('test-secret-123');
    });

    test('rejects missing challenge', () async {
      expect(
        await FCMService.validateSecurityEnvelope(<String, dynamic>{'action': 'ADMIN_LOCK'}),
        isFalse,
      );
    });

    test('rejects missing nonce', () async {
      expect(
        await FCMService.validateSecurityEnvelope(<String, dynamic>{
          'action': 'ADMIN_LOCK', 'challenge': 'ch1',
        }),
        isFalse,
      );
    });

    test('rejects missing signature', () async {
      expect(
        await FCMService.validateSecurityEnvelope(<String, dynamic>{
          'action': 'ADMIN_LOCK', 'challenge': 'ch1', 'nonce': 'n1',
        }),
        isFalse,
      );
    });

    test('rejects missing timestamp', () async {
      expect(
        await FCMService.validateSecurityEnvelope(<String, dynamic>{
          'action': 'ADMIN_LOCK', 'challenge': 'ch1', 'nonce': 'n1', 'signature': 'sig1',
        }),
        isFalse,
      );
    });

    test('accepts valid envelope', () async {
      final ts = DateTime.now().toUtc().millisecondsSinceEpoch.toString();
      final payload = 'ADMIN_LOCK.$ts.n1.ch1';
      final signature = Hmac(sha256, utf8.encode('test-secret-123'))
          .convert(utf8.encode(payload)).toString();
      final data = <String, dynamic>{
        'action': 'ADMIN_LOCK', 'challenge': 'ch1', 'nonce': 'n1',
        'ts': ts, 'signature': signature,
      };
      expect(await FCMService.validateSecurityEnvelope(data), isTrue);
    });

    test('rejects replayed challenge', () async {
      final ts = DateTime.now().toUtc().millisecondsSinceEpoch.toString();
      final payload = 'ADMIN_LOCK.$ts.n1.ch1';
      final signature = Hmac(sha256, utf8.encode('test-secret-123'))
          .convert(utf8.encode(payload)).toString();
      final data = <String, dynamic>{
        'action': 'ADMIN_LOCK', 'challenge': 'ch1', 'nonce': 'n1',
        'ts': ts, 'signature': signature,
      };
      await FCMService.validateSecurityEnvelope(data);
      expect(await FCMService.validateSecurityEnvelope(data), isFalse);
    });

    test('rejects stale envelope', () async {
      final ts = DateTime.now()
          .toUtc().subtract(const Duration(minutes: 10))
          .millisecondsSinceEpoch.toString();
      final payload = 'ADMIN_LOCK.$ts.n1.ch1';
      final signature = Hmac(sha256, utf8.encode('test-secret-123'))
          .convert(utf8.encode(payload)).toString();
      expect(
        await FCMService.validateSecurityEnvelope(<String, dynamic>{
          'action': 'ADMIN_LOCK', 'challenge': 'ch1', 'nonce': 'n1',
          'ts': ts, 'signature': signature,
        }),
        isFalse,
      );
    });

    test('rejects invalid signature', () async {
      final ts = DateTime.now().toUtc().millisecondsSinceEpoch.toString();
      expect(
        await FCMService.validateSecurityEnvelope(<String, dynamic>{
          'action': 'ADMIN_LOCK', 'challenge': 'ch1', 'nonce': 'n1',
          'ts': ts, 'signature': 'invalid-signature',
        }),
        isFalse,
      );
    });
  });

  group('handleSecurityCommand', () {
    setUp(() {
      FCMService.initializeForTesting(
        devicePolicy: mockDevicePolicy,
        wallet: mockWallet,
        support: mockSupport,
        rider: mockRider,
      );
      TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel('com.voltiumelectric.voltium/device_policy'),
        (MethodCall call) async => null,
      );
    });

    tearDown(() {
      TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel('com.voltiumelectric.voltium/device_policy'),
        null,
      );
    });

    test('ADMIN_LOCK calls provider', () async {
      await FCMService.handleSecurityCommand(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{'type': 'SECURITY_COMMAND', 'action': 'ADMIN_LOCK'},
      ));
      verify(() => mockDevicePolicy.setLockedByAdmin(true)).called(1);
    });

    test('UNLOCK_DEVICE calls provider', () async {
      await FCMService.handleSecurityCommand(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{'type': 'SECURITY_COMMAND', 'action': 'UNLOCK_DEVICE'},
      ));
      verify(() => mockDevicePolicy.setLockedByAdmin(false)).called(1);
    });

    test('DISABLE_CAMERA calls provider', () async {
      await FCMService.handleSecurityCommand(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{'type': 'SECURITY_COMMAND', 'action': 'DISABLE_CAMERA'},
      ));
      verify(() => mockDevicePolicy.setCameraDisabled(true)).called(1);
    });

    test('ENABLE_CAMERA calls provider', () async {
      await FCMService.handleSecurityCommand(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{'type': 'SECURITY_COMMAND', 'action': 'ENABLE_CAMERA'},
      ));
      verify(() => mockDevicePolicy.setCameraDisabled(false)).called(1);
    });

    test('ENFORCE_PASSCODE calls provider', () async {
      await FCMService.handleSecurityCommand(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{'type': 'SECURITY_COMMAND', 'action': 'ENFORCE_PASSCODE'},
      ));
      verify(() => mockDevicePolicy.setPasscodeRequired(true)).called(1);
    });

    test('CHECK_LOCATION_INTEGRITY calls provider', () async {
      await FCMService.handleSecurityCommand(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{'type': 'SECURITY_COMMAND', 'action': 'CHECK_LOCATION_INTEGRITY'},
      ));
      verify(() => mockDevicePolicy.triggerLocationVerification()).called(1);
    });

    test('PERSIST_APP calls provider', () async {
      await FCMService.handleSecurityCommand(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{'type': 'SECURITY_COMMAND', 'action': 'PERSIST_APP'},
      ));
      verify(() => mockDevicePolicy.setAppPersistenceRequired(true)).called(1);
    });

    test('ENFORCE_LOCATION calls provider', () async {
      await FCMService.handleSecurityCommand(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{'type': 'SECURITY_COMMAND', 'action': 'ENFORCE_LOCATION'},
      ));
      verify(() => mockDevicePolicy.setLocationRequired(true)).called(1);
    });

    test('RESTRICT_APPS_CONTROL calls provider', () async {
      await FCMService.handleSecurityCommand(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{'type': 'SECURITY_COMMAND', 'action': 'RESTRICT_APPS_CONTROL'},
      ));
      verify(() => mockDevicePolicy.setRestrictedAppsMode(true)).called(1);
    });
  });

  group('handleOverlayTrigger', () {
    setUp(() {
      FCMService.initializeForTesting(
        devicePolicy: mockDevicePolicy,
        wallet: mockWallet,
        support: mockSupport,
        rider: mockRider,
      );
      when(() => mockRider.refresh()).thenAnswer((_) async {});
      when(() => mockSupport.refreshTickets()).thenAnswer((_) async {});
      when(() => mockWallet.refreshTransactions(riderId: any(named: 'riderId'))).thenAnswer((_) async {});
    });

    test('MANDATORY_UPDATE with URL', () {
      FCMService.handleOverlayTrigger(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{
          'type': 'OVERLAY_TRIGGER', 'action': 'MANDATORY_UPDATE',
          'url': 'https://example.com/update',
        },
      ));
      verify(() => mockDevicePolicy.setForceUpdate(true, url: 'https://example.com/update')).called(1);
    });

    test('MANDATORY_UPDATE without URL', () {
      FCMService.handleOverlayTrigger(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{
          'type': 'OVERLAY_TRIGGER', 'action': 'MANDATORY_UPDATE',
        },
      ));
      verify(() => mockDevicePolicy.setForceUpdate(true, url: null)).called(1);
    });

    test('WALLET_LOW with balance', () {
      FCMService.handleOverlayTrigger(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{
          'type': 'OVERLAY_TRIGGER', 'action': 'WALLET_LOW', 'balance': '15.50',
        },
      ));
      verify(() => mockWallet.setWalletBalanceWarning(true, balance: 15.50)).called(1);
    });

    test('WALLET_LOW with invalid balance defaults to 0', () {
      FCMService.handleOverlayTrigger(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{
          'type': 'OVERLAY_TRIGGER', 'action': 'WALLET_LOW', 'balance': 'invalid',
        },
      ));
      verify(() => mockWallet.setWalletBalanceWarning(true, balance: 0.0)).called(1);
    });

    test('KYC_STATUS refreshes rider', () {
      FCMService.handleOverlayTrigger(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{
          'type': 'OVERLAY_TRIGGER', 'action': 'KYC_STATUS',
        },
      ));
      verify(() => mockRider.refresh()).called(1);
    });

    test('SUPPORT_REPLY refreshes tickets', () {
      FCMService.handleOverlayTrigger(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{
          'type': 'OVERLAY_TRIGGER', 'action': 'SUPPORT_REPLY',
        },
      ));
      verify(() => mockSupport.refreshTickets()).called(1);
    });

    test('DEPOSIT_APPROVED refreshes rider and wallet with riderId', () {
      when(() => mockRider.rider).thenReturn(RiderModel(
        id: 'rider-42',
        riderId: 'R42',
        phone: '9999999999',
        name: 'Test Rider',
      ));

      FCMService.handleOverlayTrigger(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{
          'type': 'OVERLAY_TRIGGER', 'action': 'DEPOSIT_APPROVED',
        },
      ));
      verify(() => mockRider.refresh()).called(1);
      verify(() => mockWallet.refreshTransactions(riderId: 'rider-42')).called(1);
    });

    test('DEPOSIT_APPROVED with null rider skips wallet refresh', () {
      when(() => mockRider.rider).thenReturn(null);

      FCMService.handleOverlayTrigger(RemoteMessage(
        senderId: 'test',
        data: <String, dynamic>{
          'type': 'OVERLAY_TRIGGER', 'action': 'DEPOSIT_APPROVED',
        },
      ));
      verify(() => mockRider.refresh()).called(1);
      verifyNever(() => mockWallet.refreshTransactions(riderId: any(named: 'riderId')));
    });
  });

  group('pruneExpiredChallenges', () {
    test('removes expired entries, keeps recent ones', () {
      FCMService.injectChallengeForTesting(
        'old:ch:ts',
        DateTime.now().millisecondsSinceEpoch -
            const Duration(minutes: 10).inMilliseconds,
      );
      FCMService.injectChallengeForTesting(
        'recent:ch:ts',
        DateTime.now().millisecondsSinceEpoch,
      );

      FCMService.pruneExpiredChallenges();

      expect(FCMService.hasChallengeForTesting('old:ch:ts'), isFalse);
      expect(FCMService.hasChallengeForTesting('recent:ch:ts'), isTrue);
    });
  });
}
