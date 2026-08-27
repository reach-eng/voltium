import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/guarantor/presentation/widgets/guarantor_details_card.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/gen/app_localizations_hi.dart';
import 'package:voltium_rider/theme/app_theme.dart';

void main() {
  Widget buildTestable(Widget child, {Locale locale = const Locale('en')}) {
    return MaterialApp(
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('hi')],
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: AppTheme.lightTheme,
      home: Scaffold(
        body: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ),
      ),
    );
  }

  group('GuarantorDetailsCard Form System v2 Tests', () {
    late TextEditingController nameController;
    late TextEditingController dobController;
    late TextEditingController phoneController;
    late TextEditingController fatherNameController;
    late TextEditingController motherNameController;
    late TextEditingController addressController;

    setUp(() {
      nameController = TextEditingController();
      dobController = TextEditingController();
      phoneController = TextEditingController();
      fatherNameController = TextEditingController();
      motherNameController = TextEditingController();
      addressController = TextEditingController();
    });

    tearDown(() {
      nameController.dispose();
      dobController.dispose();
      phoneController.dispose();
      fatherNameController.dispose();
      motherNameController.dispose();
      addressController.dispose();
    });

    testWidgets('1. Renders all 6 fields with localized English strings',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          GuarantorDetailsCard(
            nameController: nameController,
            dobController: dobController,
            phoneController: phoneController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            isPhoneVerified: false,
            isSendingOtp: false,
            isOtpSent: false,
            isVerifyingOtp: false,
            onSendOtp: () {},
            onVerifyOtp: () {},
            onSelectDob: () {},
            otpBoxes: const SizedBox(),
          ),
        ),
      );

      expect(find.text('Guarantor Details'), findsOneWidget);
      expect(
        find.text(
            "Your guarantor's details are required by RBI for verification"),
        findsOneWidget,
      );
      expect(find.byKey(const Key('guarantorFullNameField')), findsOneWidget);
      expect(find.byKey(const Key('guarantorDobField')), findsOneWidget);
      expect(find.byKey(const Key('guarantorPhoneField')), findsOneWidget);
      expect(find.byKey(const Key('guarantorFatherNameField')), findsOneWidget);
      expect(find.byKey(const Key('guarantorMotherNameField')), findsOneWidget);
      expect(find.byKey(const Key('guarantorAddressField')), findsOneWidget);
    });

    testWidgets(
        '2. Dead-validator fix: inline validation activates on user typing',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          GuarantorDetailsCard(
            nameController: nameController,
            dobController: dobController,
            phoneController: phoneController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            isPhoneVerified: false,
            isSendingOtp: false,
            isOtpSent: false,
            isVerifyingOtp: false,
            onSendOtp: () {},
            onVerifyOtp: () {},
            onSelectDob: () {},
            otpBoxes: const SizedBox(),
          ),
        ),
      );

      // Enter single character name (< 2 chars)
      await tester.enterText(
          find.byKey(const Key('guarantorFullNameField')), 'A');
      await tester.pump();

      expect(find.text('Enter a valid name (at least 2 characters)'),
          findsOneWidget);

      // Enter valid name
      await tester.enterText(
          find.byKey(const Key('guarantorFullNameField')), 'Anand Kumar');
      await tester.pump();

      expect(find.text('Enter a valid name (at least 2 characters)'),
          findsNothing);
    });

    testWidgets('3. Phone field validator catches invalid phone length',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          GuarantorDetailsCard(
            nameController: nameController,
            dobController: dobController,
            phoneController: phoneController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            isPhoneVerified: false,
            isSendingOtp: false,
            isOtpSent: false,
            isVerifyingOtp: false,
            onSendOtp: () {},
            onVerifyOtp: () {},
            onSelectDob: () {},
            otpBoxes: const SizedBox(),
          ),
        ),
      );

      // Enter a too-short phone number to trigger the length-only
      // FormValidators.phone default (PR-B: the field no longer
      // hardcodes the Indian-only indianPhone validator).
      await tester.enterText(
          find.byKey(const Key('guarantorPhoneField')), '12345');
      await tester.pump();

      expect(find.text('Phone must be 10 digits'), findsOneWidget);
    });

    testWidgets(
        '4. Send OTP button is displayed when unverified and OTP not sent',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          GuarantorDetailsCard(
            nameController: nameController,
            dobController: dobController,
            phoneController: phoneController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            isPhoneVerified: false,
            isSendingOtp: false,
            isOtpSent: false,
            isVerifyingOtp: false,
            onSendOtp: () {},
            onVerifyOtp: () {},
            onSelectDob: () {},
            otpBoxes: const SizedBox(),
          ),
        ),
      );

      expect(find.byKey(const Key('sendOtpButton')), findsOneWidget);
      expect(find.text('SEND OTP'), findsOneWidget);
    });

    testWidgets('5. OTP verification controls render when isOtpSent is true',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          GuarantorDetailsCard(
            nameController: nameController,
            dobController: dobController,
            phoneController: phoneController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            isPhoneVerified: false,
            isSendingOtp: false,
            isOtpSent: true,
            isVerifyingOtp: false,
            onSendOtp: () {},
            onVerifyOtp: () {},
            onSelectDob: () {},
            otpBoxes: const Text('OtpBoxesSlot'),
          ),
        ),
      );

      expect(find.text('OtpBoxesSlot'), findsOneWidget);
      expect(find.byKey(const Key('verifyOtpButton')), findsOneWidget);
      expect(find.text('VERIFY OTP'), findsOneWidget);
    });

    testWidgets('6. Green verified badge appears when isPhoneVerified is true',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          GuarantorDetailsCard(
            nameController: nameController,
            dobController: dobController,
            phoneController: phoneController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            isPhoneVerified: true,
            isSendingOtp: false,
            isOtpSent: false,
            isVerifyingOtp: false,
            onSendOtp: () {},
            onVerifyOtp: () {},
            onSelectDob: () {},
            otpBoxes: const SizedBox(),
          ),
        ),
      );

      expect(find.text('Phone Number Verified'), findsOneWidget);
      expect(find.byIcon(Icons.check_circle), findsOneWidget);
    });

    testWidgets('7. Renders fully in Hindi when locale is hi', (tester) async {
      final hi = AppLocalizationsHi();
      await tester.pumpWidget(
        buildTestable(
          GuarantorDetailsCard(
            nameController: nameController,
            dobController: dobController,
            phoneController: phoneController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            isPhoneVerified: false,
            isSendingOtp: false,
            isOtpSent: false,
            isVerifyingOtp: false,
            onSendOtp: () {},
            onVerifyOtp: () {},
            onSelectDob: () {},
            otpBoxes: const SizedBox(),
          ),
          locale: const Locale('hi'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(hi.txtguarantorDetails), findsOneWidget);
      expect(find.text(hi.txtkycGuarantorContextLine), findsOneWidget);
    });
  });
}
