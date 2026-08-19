import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/file_category.dart';
import 'package:voltium_rider/features/kyc/data/kyc_repository.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/widgets/doc_tile.dart';
import 'package:voltium_rider/features/kyc/presentation/widgets/identity_verification_card.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/utils/form_validators.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
    await CacheService().init();
  });

  group('KYC Audit Fixes - FileCategory (F3)', () {
    test('FileCategory has all backend supported categories', () {
      expect(FileCategory.kycDocument.value, 'kyc_document');
      expect(FileCategory.profilePhoto.value, 'profile_photo');
      expect(FileCategory.vehiclePhoto.value, 'vehicle_photo');
      expect(FileCategory.paymentProof.value, 'payment_proof');
      expect(FileCategory.supportAttachment.value, 'support_attachment');
      expect(FileCategory.pickupVerification.value, 'pickup_verification');
      expect(FileCategory.returnPhoto.value, 'RETURN_PHOTO');
      expect(FileCategory.topupProof.value, 'TOPUP_PROOF');
      expect(FileCategory.vehicleReturn.value, 'vehicle_return');
      expect(FileCategory.securityDeposit.value, 'security_deposit');
    });

    test('FileCategory.fromString correctly parses strings and handles aliases',
        () {
      expect(FileCategory.fromString('kyc_document'), FileCategory.kycDocument);
      expect(
          FileCategory.fromString('profile_photo'), FileCategory.profilePhoto);
      expect(FileCategory.fromString('support_ticket'),
          FileCategory.supportAttachment);
      expect(FileCategory.fromString('unknown_category'),
          FileCategory.kycDocument);
    });
  });

  group('KYC Audit Fixes - PII Form Cache (F2, F12)', () {
    test('saveFormCache strips financial PII from persistent storage',
        () async {
      final testData = {
        'name': 'Test Rider',
        'email': 'rider@example.com',
        'address': '123 Test Street',
        'bankName': 'HDFC',
        'bankAccount': '123456789012',
        'bankIfsc': 'HDFC0001234',
        'aadhaarFrontPath': '/tmp/front.jpg',
      };

      await KycRepository.saveFormCache(
        riderId: 'test-rider-123',
        data: testData,
      );

      final loaded =
          await KycRepository.loadFormCache(riderId: 'test-rider-123');
      expect(loaded, isNotNull);
      expect(loaded!['name'], 'Test Rider');
      expect(loaded['email'], 'rider@example.com');
      expect(loaded['bankName'], 'HDFC');
      // Financial PII should be stripped
      expect(loaded.containsKey('bankAccount'), isFalse);
      expect(loaded.containsKey('bankIfsc'), isFalse);
    });
  });

  group('KYC Audit Fixes - UserOnboardingNotifier step bounds (F10)', () {
    test('nextStep and prevStep clamp between 1 and 3', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(userOnboardingNotifierProvider.notifier);
      expect(container.read(userOnboardingNotifierProvider).currentStep, 1);

      notifier.prevStep();
      expect(container.read(userOnboardingNotifierProvider).currentStep, 1);

      notifier.nextStep();
      expect(container.read(userOnboardingNotifierProvider).currentStep, 2);

      notifier.nextStep();
      expect(container.read(userOnboardingNotifierProvider).currentStep, 3);

      notifier.nextStep();
      expect(container.read(userOnboardingNotifierProvider).currentStep, 3);

      notifier.prevStep();
      expect(container.read(userOnboardingNotifierProvider).currentStep, 2);
    });
  });

  group('KYC Audit Fixes - Bank summary on IdentityVerificationCard (F8)', () {
    Widget buildTestWidget(Widget child) {
      return MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: Scaffold(body: child),
      );
    }

    testWidgets('displays bank summary on bank tile when provided',
        (tester) async {
      await tester.pumpWidget(
        buildTestWidget(
          IdentityVerificationCard(
            aadhaarFrontUploaded: true,
            aadhaarBackUploaded: true,
            panUploaded: true,
            bankDetailsDone: true,
            bankSummary: '✓ HDFC •••• 1234',
            onPickAadhaarFront: () {},
            onPickAadhaarBack: () {},
            onPickPan: () {},
            onShowBankDialog: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('✓ HDFC •••• 1234'), findsOneWidget);
    });
  });

  group('KYC Audit Fixes - FormValidators Bank Account (F9 / F16)', () {
    test('bankAccount requires 8-18 digits and rejects short inputs', () {
      expect(FormValidators.bankAccount(''), isNotNull);
      expect(FormValidators.bankAccount('12345'), isNotNull); // 5 digits < 8
      expect(FormValidators.bankAccount('123456'), isNotNull); // 6 digits < 8
      expect(FormValidators.bankAccount('12345678'), isNull); // 8 digits OK
      expect(
          FormValidators.bankAccount('123456789012'), isNull); // 12 digits OK
    });

    test('ifsc requires valid 11-char IFSC code format', () {
      expect(FormValidators.ifsc(''), isNotNull);
      expect(FormValidators.ifsc('HDFC'), isNotNull);
      expect(FormValidators.ifsc('HDFC0001234'), isNull);
    });
  });
}
