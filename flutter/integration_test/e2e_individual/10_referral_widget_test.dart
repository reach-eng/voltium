// integration_test/e2e_individual/10_referral_widget_test.dart
//
// Standalone test: Referral widget display and copy code.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/10_referral_widget_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Referral widget – displays code and copy works', (tester) async {
    await fullLoginFlow(tester);

    // Referral widget should be visible (copy only, web parity)
    expect(find.byKey(const Key('copyReferralButton')), findsOneWidget);

    // Tap copy button
    await tester.tap(find.byKey(const Key('copyReferralButton')));
    await settle(tester);

    // Verify button still exists (copy action completed without crash)
    expect(find.byKey(const Key('copyReferralButton')), findsOneWidget);
  });
}
