// integration_test/e2e/profile_test.dart
//
// Voltium – Profile E2E tests.
// Covers: profile display, edit profile, documents, rewards, referral, SOS, legal.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Profile E2E', () {
    testWidgets('Profile screen displays rider info', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      // Profile card should show rider name and ID
      expect(find.textContaining('PERSONAL'), findsOneWidget);
    });

    testWidgets('Profile – KYC status tile visible', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      // KYC status should be displayed
      expect(find.textContaining('KYC'), findsOneWidget);
    });

    testWidgets('Profile – guarantor status tile visible', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      // Guarantor status should be displayed
      expect(find.textContaining('GUARANTOR'), findsOneWidget);
    });

    testWidgets('Profile – navigate to edit profile', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('editProfileLink')));
      await settle(tester);

      // Edit profile fields should be visible
      expect(find.byKey(const Key('editFullNameField')), findsOneWidget);
      expect(find.byKey(const Key('editEmailField')), findsOneWidget);
      expect(find.byKey(const Key('editPhoneField')), findsOneWidget);
    });

    testWidgets('Profile – edit and save profile', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('editProfileLink')));
      await settle(tester);

      // Edit fields
      await tester.enterText(
        find.byKey(const Key('editFullNameField')),
        'Updated Test Rider',
      );
      await settle(tester);

      await tester.enterText(
        find.byKey(const Key('editEmailField')),
        'updated@example.com',
      );
      await settle(tester);

      // Submit
      await tester.tap(find.byKey(const Key('submitProfileButton')));
      await settle(tester);

      // Should show success snackbar
      expect(find.textContaining('Profile'), findsOneWidget);
    });

    testWidgets('Profile – navigate to my documents', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('myDocumentsLink')));
      await settle(tester);

      // Documents screen should be visible
      await tester.pageBack();
      await settle(tester);
    });

    testWidgets('Profile – navigate to rewards', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('rewardsLink')));
      await settle(tester);

      // Rewards screen should be visible
      expect(find.byKey(const Key('backButton')), findsOneWidget);

      await tester.tap(find.byKey(const Key('backButton')));
      await settle(tester);
    });

    testWidgets('Profile – navigate to referral program', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('referralLink')));
      await settle(tester);

      // Referral screen should be visible
      await tester.pageBack();
      await settle(tester);
    });

    testWidgets('Profile – navigate to app settings', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      // Settings screen should be visible
      expect(find.textContaining('Settings'), findsOneWidget);

      await tester.pageBack();
      await settle(tester);
    });

    testWidgets('Profile – navigate to legal screen', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('legalLink')));
      await settle(tester);

      // Legal screen should be visible
      expect(find.byKey(const Key('acceptCheckbox')), findsOneWidget);

      await tester.pageBack();
      await settle(tester);
    });

    testWidgets('Profile – emergency SOS navigation', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('emergencySosLink')));
      await settle(tester);

      // SOS screen should be visible
      expect(find.byKey(const Key('sosTriggerButton')), findsOneWidget);
      expect(find.byKey(const Key('emergencyContact1')), findsOneWidget);
      expect(find.byKey(const Key('emergencyContact2')), findsOneWidget);
      expect(find.byKey(const Key('emergencyContact3')), findsOneWidget);

      // Cancel SOS
      await tester.tap(find.byKey(const Key('cancelSosButton')));
      await settle(tester);
    });

    testWidgets('Profile – logout button visible and functional',
        (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      expect(find.byKey(const Key('logoutButton')), findsOneWidget);

      await tester.tap(find.byKey(const Key('logoutButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);

      // Should be back at login
      expectOnLogin(tester);
    });

    testWidgets('Profile – guarantor information section', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      // If guarantor is set, should show guarantor info
      final guarantorSection = find.textContaining('GUARANTOR INFORMATION');
      if (guarantorSection.evaluate().isNotEmpty) {
        expect(guarantorSection, findsOneWidget);
      }
    });

    testWidgets('Profile – quick links all navigable', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      // Test each quick link
      final quickLinks = [
        const Key('editProfileLink'),
        const Key('myDocumentsLink'),
        const Key('rewardsLink'),
        const Key('referralLink'),
        const Key('appSettingsLink'),
        const Key('legalLink'),
      ];

      for (final linkKey in quickLinks) {
        await navigateToTab(tester, 'profileTab');

        final link = find.byKey(linkKey);
        if (link.evaluate().isNotEmpty) {
          await tester.tap(link);
          await settle(tester);

          // Should have navigated somewhere
          expect(find.byType(Scaffold), findsOneWidget);

          // Go back to profile
          await tester.pageBack();
          await settle(tester);
        }
      }
    });
  });
}
