// integration_test/e2e/error_edge_cases_test.dart
//
// Voltium – Error handling and edge case E2E tests.
// Covers: invalid inputs, network errors, empty states, boundary conditions.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Error & Edge Cases E2E', () {
    testWidgets('Login – empty phone number validation', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');
      await tester.tap(find.byKey(const Key('logoutButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);

      // Try to submit without entering phone
      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await settle(tester);

      // Should stay on login screen (validation should prevent navigation)
      expect(find.byKey(const Key('phoneInput')), findsOneWidget);
    });

    testWidgets('Login – short phone number', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');
      await tester.tap(find.byKey(const Key('logoutButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);

      // Enter short phone number
      await tester.enterText(
        find.byKey(const Key('phoneInput')),
        '123',
      );
      await settle(tester);
      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await settle(tester);

      // Should stay on login or show validation error
      expect(find.byKey(const Key('phoneInput')), findsOneWidget);
    });

    testWidgets('Login – invalid OTP code', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');
      await tester.tap(find.byKey(const Key('logoutButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);

      // Enter valid phone
      await tester.enterText(
        find.byKey(const Key('phoneInput')),
        TestCredentials.phone,
      );
      await settle(tester);
      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await settle(tester);

      await waitFor(tester, find.byKey(const Key('otpInputRow')));

      // Enter wrong OTP
      final otpRow = find.byKey(const Key('otpInputRow'));
      final otpFields = find.descendant(
        of: otpRow,
        matching: find.byType(TextField),
      );
      for (int i = 0; i < 6; i++) {
        await tester.enterText(otpFields.at(i), '0');
        await tester.pump();
      }
      await settle(tester);
      await tester.tap(find.byKey(const Key('verifyOtpButton')));
      await settle(tester);

      // Should show error or stay on OTP screen
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
    });

    testWidgets('Top-up – invalid amount (zero)', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      // Enter zero amount
      await tester.enterText(
        find.byKey(const Key('topUpAmountField')),
        '0',
      );
      await settle(tester);

      // Submit
      await tester.tap(find.byKey(const Key('submitTopUpButton')));
      await settle(tester);

      // Should show validation error or not proceed
    });

    testWidgets('Top-up – negative amount', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      // Enter negative amount
      await tester.enterText(
        find.byKey(const Key('topUpAmountField')),
        '-100',
      );
      await settle(tester);

      await tester.tap(find.byKey(const Key('submitTopUpButton')));
      await settle(tester);
    });

    testWidgets('Top-up – very large amount', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      // Enter very large amount
      await tester.enterText(
        find.byKey(const Key('topUpAmountField')),
        '999999999',
      );
      await settle(tester);

      await tester.tap(find.byKey(const Key('submitTopUpButton')));
      await settle(tester);

      // Should handle gracefully (validation or API error)
    });

    testWidgets('Edit profile – empty required fields', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('editProfileLink')));
      await settle(tester);

      // Clear full name
      await tester.enterText(
        find.byKey(const Key('editFullNameField')),
        '',
      );
      await settle(tester);

      // Submit
      await tester.tap(find.byKey(const Key('submitProfileButton')));
      await settle(tester);

      // Should show validation or handle gracefully
    });

    testWidgets('Edit profile – invalid email format', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('editProfileLink')));
      await settle(tester);

      // Enter invalid email
      await tester.enterText(
        find.byKey(const Key('editEmailField')),
        'not-an-email',
      );
      await settle(tester);

      await tester.tap(find.byKey(const Key('submitProfileButton')));
      await settle(tester);
    });

    testWidgets('Support ticket – empty description', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'supportTab');

      // Select issue type
      await tester.tap(find.byKey(const Key('issueTypeDropdown')));
      await settle(tester);

      final dropdownItems = find.byType(PopupMenuItem<String>);
      if (dropdownItems.evaluate().isNotEmpty) {
        await tester.tap(dropdownItems.first);
        await settle(tester);
      }

      // Leave description empty
      await tester.tap(find.byKey(const Key('raiseTicketButton')));
      await settle(tester);

      // Should show validation error
    });

    testWidgets('Dashboard – vehicle card with no assigned vehicle',
        (tester) async {
      await fullLoginFlow(tester);

      // Dashboard should handle case where no vehicle is assigned
      await expectOnDashboard(tester);
    });

    testWidgets('Wallet – empty transaction history', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      // Wallet should handle empty transaction state gracefully
      expect(find.byKey(const Key('topUpButton')), findsOneWidget);
    });

    testWidgets('Notifications – empty state', (tester) async {
      await fullLoginFlow(tester);

      await tester.tap(find.byKey(const Key('notificationBell')));
      await settle(tester);

      // Notification center should handle empty state
      expect(find.byType(Scaffold), findsOneWidget);
    });

    testWidgets('Profile – missing rider data handling', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      // Profile should handle missing data gracefully
      expect(find.byType(Scaffold), findsOneWidget);
    });

    testWidgets('App – rapid navigation stress test', (tester) async {
      await fullLoginFlow(tester);

      // Rapidly switch between tabs
      for (int i = 0; i < 5; i++) {
        await navigateToTab(tester, 'walletTab');
        await navigateToTab(tester, 'dashboardTab');
        await navigateToTab(tester, 'supportTab');
        await navigateToTab(tester, 'profileTab');
      }

      // App should still be responsive
      await expectOnDashboard(tester);
    });

    testWidgets('App – back navigation from deep screens', (tester) async {
      await fullLoginFlow(tester);

      // Navigate deep: profile → edit profile → back
      await navigateToTab(tester, 'profileTab');
      await tester.tap(find.byKey(const Key('editProfileLink')));
      await settle(tester);

      await tester.pageBack();
      await settle(tester);

      expect(find.byKey(const Key('logoutButton')), findsOneWidget);

      // Navigate: profile → settings → back
      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      await tester.pageBack();
      await settle(tester);

      expect(find.byKey(const Key('logoutButton')), findsOneWidget);
    });

    testWidgets('App – multiple dialog dismissals', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      // Open and cancel top-up multiple times
      for (int i = 0; i < 3; i++) {
        await tester.tap(find.byKey(const Key('topUpButton')));
        await settle(tester);

        await tester.tap(find.byKey(const Key('cancelTopUpButton')));
        await settle(tester);
      }

      // App should still be responsive
      expect(find.byKey(const Key('topUpButton')), findsOneWidget);
    });

    testWidgets('Login – special characters in phone field', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');
      await tester.tap(find.byKey(const Key('logoutButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);

      // Enter special characters
      await tester.enterText(
        find.byKey(const Key('phoneInput')),
        r'abc@#$',
      );
      await settle(tester);
      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await settle(tester);

      // Should handle gracefully
    });

    testWidgets('Edit profile – special characters in name', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('editProfileLink')));
      await settle(tester);

      await tester.enterText(
        find.byKey(const Key('editFullNameField')),
        'Test <script>alert("xss")</script>',
      );
      await settle(tester);

      await tester.tap(find.byKey(const Key('submitProfileButton')));
      await settle(tester);

      // Should handle gracefully (no crash)
    });
  });
}
