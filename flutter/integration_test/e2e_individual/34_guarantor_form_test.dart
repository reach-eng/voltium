// integration_test/e2e_individual/34_guarantor_form_test.dart
//
// Standalone test: Complete Guarantor form.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/34_guarantor_form_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Guarantor Form E2E: Direct routing and submission', (tester) async {
    await resetAppState();
    await launchApp(tester);

    // 1. Auth Flow
    await handlePreamble(tester);
    await completeAuthFlow(tester, phone: TestCredentials.phone);
    
    // 2. Wait for Intent Screen
    await waitFor(tester, find.text('Deliver with Us'));
    await tester.tap(find.text('Deliver with Us'));
    await settle(tester);
    await tester.tap(find.text('Confirm Selection'));
    await settle(tester);

    // 3. User Form
    await waitFor(tester, find.byKey(const Key('fullNameField')));
    await tester.enterText(find.byKey(const Key('fullNameField')), TestCredentials.fullName);
    await tester.enterText(find.byKey(const Key('emailField')), TestCredentials.email);
    await tester.enterText(find.byKey(const Key('fatherNameField')), TestCredentials.fatherName);
    await tester.enterText(find.byKey(const Key('motherNameField')), TestCredentials.motherName);
    await settle(tester);
    
    // Pick DOB
    await tester.tap(find.text('DD-MM-YYYY'));
    await settle(tester);
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text('OK'));
    await settle(tester);

    // Submit User Form
    await tester.tap(find.byKey(const Key('nextOnboardingButton')));
    await settle(tester);

    // 4. Verify direct routing to Guarantor Form
    await waitFor(tester, find.text('Guarantor Details'));
    expect(find.byKey(const Key('guarantorNameField')), findsOneWidget);

    // 5. Fill Guarantor Form
    await tester.enterText(find.byKey(const Key('guarantorNameField')), TestCredentials.guarantorName);
    await tester.enterText(find.byKey(const Key('guarantorPhoneField')), TestCredentials.guarantorPhone);
    await tester.enterText(find.byKey(const Key('guarantorFatherNameField')), TestCredentials.fatherName);
    await tester.enterText(find.byKey(const Key('guarantorMotherNameField')), TestCredentials.motherName);
    await tester.enterText(find.byKey(const Key('guarantorAddressField')), '123 Test Ave');
    await settle(tester);
    
    // Test Mode bypasses document uploads automatically, so we just tap Finish
    await tester.tap(find.byKey(const Key('completeOnboardingButton')));
    await settle(tester);

    // 6. Verify routing to PreDashboard
    await waitFor(tester, find.text('Start Registration').or(find.text('Book Vehicle')));
    expect(find.byKey(const Key('preDashboardScreen')), findsWidgets);
  });
}
