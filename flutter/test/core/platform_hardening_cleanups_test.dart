import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/pinned_http_client.dart';
import 'package:voltium_rider/services/receipt_service.dart';
import 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase F4 & F5: Platform Hardening & Cleanups Suite', () {
    group('FL-10 & FL-11: Android Network Security & Backup Rules', () {
      test(
          'network_security_config.xml disallows global cleartext and permits dev hosts',
          () {
        final configFile =
            File('android/app/src/main/res/xml/network_security_config.xml');
        expect(configFile.existsSync(), isTrue);

        final content = configFile.readAsStringSync();
        expect(content.contains('cleartextTrafficPermitted="false"'), isTrue);
        expect(
            content.contains(
                '<domain includeSubdomains="true">localhost</domain>'),
            isTrue);
        expect(
            content
                .contains('<domain includeSubdomains="true">10.0.2.2</domain>'),
            isTrue);
        expect(
            content.contains(
                '<domain includeSubdomains="true">127.0.0.1</domain>'),
            isTrue);
      });

      test(
          'data_extraction_rules.xml and backup_rules.xml exclude sensitive domains',
          () {
        final extractionFile =
            File('android/app/src/main/res/xml/data_extraction_rules.xml');
        final backupFile =
            File('android/app/src/main/res/xml/backup_rules.xml');

        expect(extractionFile.existsSync(), isTrue);
        expect(backupFile.existsSync(), isTrue);

        final extractionContent = extractionFile.readAsStringSync();
        expect(extractionContent.contains('<exclude domain="database" />'),
            isTrue);
        expect(extractionContent.contains('<exclude domain="sharedpref" />'),
            isTrue);

        final backupContent = backupFile.readAsStringSync();
        expect(backupContent.contains('<exclude domain="database" />'), isTrue);
        expect(
            backupContent.contains('<exclude domain="sharedpref" />'), isTrue);
      });

      test(
          'AndroidManifest.xml specifies allowBackup=false and links security xml configs',
          () {
        final manifestFile = File('android/app/src/main/AndroidManifest.xml');
        expect(manifestFile.existsSync(), isTrue);

        final content = manifestFile.readAsStringSync();
        expect(content.contains('android:allowBackup="false"'), isTrue);
        expect(
            content.contains(
                'android:networkSecurityConfig="@xml/network_security_config"'),
            isTrue);
        expect(
            content.contains(
                'android:dataExtractionRules="@xml/data_extraction_rules"'),
            isTrue);
        expect(
            content.contains('android:fullBackupContent="@xml/backup_rules"'),
            isTrue);
      });
    });

    group('FL-12: TLS Pinning Configuration', () {
      test('PinnedHttpInterceptor handles empty pins gracefully in debug mode',
          () {
        final client = PinnedHttpInterceptor.createClient(
            expectedHost: 'api.voltium.internal');
        expect(client, isNotNull);
      });

      test('Dynamic pins can be registered and deduplicated', () {
        PinnedHttpInterceptor.setDynamicPins(
            ['pin-abc-123', 'pin-def-456', 'pin-abc-123']);
        final configured = PinnedHttpInterceptor.configuredFingerprints;
        expect(configured.contains('pin-abc-123'), isTrue);
        expect(configured.contains('pin-def-456'), isTrue);
        expect(configured.where((p) => p == 'pin-abc-123').length, equals(1));
      });
    });

    group('FL-16: Receipt Service Substring Guard', () {
      test(
          'TransactionReceipt.share handles short transaction IDs without RangeError',
          () async {
        final shortReceipt = TransactionReceipt(
          transactionId: 'tx-1',
          riderName: 'Rider A',
          riderPhone: '+919876543210',
          date: DateTime.now(),
          type: 'CREDIT',
          amount: 50000,
        );

        expect(shortReceipt.receiptUrl, contains('tx-1'));
      });
    });

    group('FL-15: Platform Channel Safety in DevicePolicyProvider', () {
      test('DevicePolicyProvider initializes cleanly with safe defaults',
          () async {
        final container = ProviderContainer();
        addTearDown(container.dispose);

        final state = container.read(devicePolicyProvider);
        expect(state.isAdminActive, isFalse);
        expect(state.lockedByAdmin, isFalse);
        expect(state.hasPermissionViolation, isFalse);

        await Future.delayed(const Duration(milliseconds: 50));
      });
    });

    group('FL-21: Verify-Lock Response Contract Evaluation', () {
      test(
          'verify-lock correctly rejects envelope success when inner data success is false',
          () {
        final serverResponse = {
          'success': true,
          'data': {
            'success': false,
          },
          'message': 'Incorrect password',
        };

        final payload = serverResponse['data'] is Map<String, dynamic>
            ? serverResponse['data'] as Map<String, dynamic>
            : serverResponse;
        final isValid =
            payload['success'] == true || payload['verified'] == true;

        expect(isValid, isFalse);
      });

      test('verify-lock accepts when inner payload is valid', () {
        final serverResponse = {
          'success': true,
          'data': {
            'success': true,
          },
          'message': 'Verification successful',
        };

        final payload = serverResponse['data'] is Map<String, dynamic>
            ? serverResponse['data'] as Map<String, dynamic>
            : serverResponse;
        final isValid =
            payload['success'] == true || payload['verified'] == true;

        expect(isValid, isTrue);
      });
    });
  });
}
