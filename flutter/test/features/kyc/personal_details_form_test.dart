import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/kyc/presentation/widgets/personal_details_card.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';

void main() {
  Widget buildTestable(Widget child) {
    return MaterialApp(
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

  group('PersonalDetailsCard Form System v2 Tests', () {
    late TextEditingController nameController;
    late TextEditingController dobController;
    late TextEditingController emailController;
    late TextEditingController fatherNameController;
    late TextEditingController motherNameController;
    late TextEditingController addressController;

    setUp(() {
      nameController = TextEditingController();
      dobController = TextEditingController();
      emailController = TextEditingController();
      fatherNameController = TextEditingController();
      motherNameController = TextEditingController();
      addressController = TextEditingController();
    });

    tearDown(() {
      nameController.dispose();
      dobController.dispose();
      emailController.dispose();
      fatherNameController.dispose();
      motherNameController.dispose();
      addressController.dispose();
    });

    testWidgets('1. Renders all 7 fields in card', (tester) async {
      await tester.pumpWidget(
        buildTestable(
          PersonalDetailsCard(
            nameController: nameController,
            dobController: dobController,
            emailController: emailController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            phone: '9876543210',
            onSelectDob: () {},
          ),
        ),
      );

      expect(find.text('Personal Details'), findsOneWidget);
      expect(find.byKey(const Key('fullNameField')), findsOneWidget);
      expect(find.byKey(const Key('fatherNameField')), findsOneWidget);
      expect(find.byKey(const Key('motherNameField')), findsOneWidget);
      expect(find.byKey(const Key('dobField')), findsOneWidget);
      expect(find.byKey(const Key('emailField')), findsOneWidget);
      expect(find.byKey(const Key('addressField')), findsOneWidget);
      expect(find.text('+91 98765 43210'), findsOneWidget);
    });

    testWidgets('2. Displays RBI disclosure context line at top of card',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          PersonalDetailsCard(
            nameController: nameController,
            dobController: dobController,
            emailController: emailController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            phone: '9876543210',
            onSelectDob: () {},
          ),
        ),
      );

      expect(
        find.text('These details are required by RBI for two-wheeler rentals'),
        findsOneWidget,
      );
    });

    testWidgets(
        '3. Inline error shows when entering and deleting text in full name',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          PersonalDetailsCard(
            nameController: nameController,
            dobController: dobController,
            emailController: emailController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            phone: '9876543210',
            onSelectDob: () {},
          ),
        ),
      );

      await tester.enterText(find.byKey(const Key('fullNameField')), 'A');
      await tester.enterText(find.byKey(const Key('fullNameField')), '');
      await tester.pump();

      expect(find.text('Full Name is required'), findsOneWidget);
    });

    testWidgets('4. Email validator fires on invalid email input',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          PersonalDetailsCard(
            nameController: nameController,
            dobController: dobController,
            emailController: emailController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            phone: '9876543210',
            onSelectDob: () {},
          ),
        ),
      );

      await tester.enterText(
          find.byKey(const Key('emailField')), 'invalid-email');
      await tester.pump();

      expect(find.text('Please enter a valid email'), findsOneWidget);

      await tester.enterText(
          find.byKey(const Key('emailField')), 'valid@example.com');
      await tester.pump();

      expect(find.text('Please enter a valid email'), findsNothing);
    });

    testWidgets('5. Address field renders address helper text', (tester) async {
      await tester.pumpWidget(
        buildTestable(
          PersonalDetailsCard(
            nameController: nameController,
            dobController: dobController,
            emailController: emailController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            phone: '9876543210',
            onSelectDob: () {},
          ),
        ),
      );

      expect(
          find.text('House no, street, city, state, pin code'), findsOneWidget);
    });

    testWidgets('6. Date of birth row tap invokes onSelectDob', (tester) async {
      var dobTapped = false;
      await tester.pumpWidget(
        buildTestable(
          PersonalDetailsCard(
            nameController: nameController,
            dobController: dobController,
            emailController: emailController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            phone: '9876543210',
            onSelectDob: () => dobTapped = true,
          ),
        ),
      );

      await tester.tap(find.byKey(const Key('dobField')), warnIfMissed: false);
      expect(dobTapped, isTrue);
    });

    testWidgets('7. Phone is read-only formatted and cannot be edited',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          PersonalDetailsCard(
            nameController: nameController,
            dobController: dobController,
            emailController: emailController,
            fatherNameController: fatherNameController,
            motherNameController: motherNameController,
            addressController: addressController,
            phone: '+919988776655',
            onSelectDob: () {},
          ),
        ),
      );

      expect(find.text('+91 99887 76655'), findsOneWidget);
      expect(find.byKey(const Key('sendOtpButton')), findsNothing);
    });
  });
}
