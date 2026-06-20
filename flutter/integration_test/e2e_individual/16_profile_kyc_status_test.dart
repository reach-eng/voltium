// integration_test/e2e_individual/16_profile_kyc_status_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Profile – KYC status tile visible', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'profileTab');

    // KYC tile should be visible
    expect(find.textContaining('KYC'), findsAtLeastNWidgets(1));
  });
}
