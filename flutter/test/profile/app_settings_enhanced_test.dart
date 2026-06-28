import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/profile/presentation/screens/app_settings_screen.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/locale_provider.dart';
import 'package:voltium_rider/providers/theme_provider.dart';

/// Enhanced AppSettingsScreen widget tests covering:
/// - Section headers (APP SETTINGS, SECURITY, ABOUT, DANGER ZONE)
/// - Toggle interactions (notifications, dark mode, 2FA)
/// - Language dialog
/// - Delete account dialog
/// - Navigation tiles

Widget buildTestApp() {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => LocaleProvider()),
      ChangeNotifierProvider(create: (_) => ThemeProvider()),
    ],
    child: const MaterialApp(home: AppSettingsScreen()),
  );
}

void main() {
  group('AppSettingsScreen — Layout', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(AppSettingsScreen), findsOneWidget);
    });

    testWidgets('displays Settings title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Settings'), findsOneWidget);
    });

    testWidgets('displays APP SETTINGS section', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('APP SETTINGS'), findsOneWidget);
    });

    testWidgets('displays SECURITY section', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('SECURITY'), findsOneWidget);
    });

    testWidgets('displays ABOUT section', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('ABOUT'), findsOneWidget);
    });

    testWidgets('displays DANGER ZONE section', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('DANGER ZONE'), findsOneWidget);
    });

    testWidgets('has back button', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.arrow_back), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('AppSettingsScreen — Toggle Tiles', () {
    testWidgets('shows Notifications toggle', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.byKey(const Key('notificationsSwitch')), findsOneWidget);
    });

    testWidgets('shows Dark Mode toggle', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Dark Mode'), findsOneWidget);
      expect(find.byKey(const Key('darkModeSwitch')), findsOneWidget);
    });

    testWidgets('shows Two-Factor Auth toggle', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Two-Factor Auth'), findsOneWidget);
      expect(find.byKey(const Key('twoFactorSwitch')), findsOneWidget);
    });

    testWidgets('notifications toggle is ON by default', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      final switch_ = tester.widget<Switch>(
        find.byKey(const Key('notificationsSwitch')),
      );
      expect(switch_.value, isTrue);
    });

    testWidgets('two-factor toggle is ON by default', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      final switch_ = tester.widget<Switch>(
        find.byKey(const Key('twoFactorSwitch')),
      );
      expect(switch_.value, isTrue);
    });

    testWidgets('dark mode toggle is OFF by default', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      final switch_ = tester.widget<Switch>(
        find.byKey(const Key('darkModeSwitch')),
      );
      expect(switch_.value, isFalse);
    });

    testWidgets('can toggle notifications off', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('notificationsSwitch')));
      await tester.pumpAndSettle();

      final switch_ = tester.widget<Switch>(
        find.byKey(const Key('notificationsSwitch')),
      );
      expect(switch_.value, isFalse);
    });

    testWidgets('can toggle dark mode on', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('darkModeSwitch')));
      await tester.pumpAndSettle();

      final switch_ = tester.widget<Switch>(
        find.byKey(const Key('darkModeSwitch')),
      );
      expect(switch_.value, isTrue);
    });
  });

  group('AppSettingsScreen — Action Tiles', () {
    testWidgets('shows Change Phone Number', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Change Phone Number'), findsOneWidget);
    });

    testWidgets('shows Change Password', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Change Password'), findsOneWidget);
    });

    testWidgets('shows Language option', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Language'), findsOneWidget);
    });

    testWidgets('shows Terms of Service', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Terms of Service'), findsOneWidget);
    });

    testWidgets('shows Privacy Policy', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Privacy Policy'), findsOneWidget);
    });

    testWidgets('shows Rate Us', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Rate Us'), findsOneWidget);
    });

    testWidgets('shows App Version', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('App Version'), findsOneWidget);
      expect(find.text('v2.1.0'), findsOneWidget);
    });

    testWidgets('change phone shows "coming soon" snackbar', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('changePhoneTile')));
      await tester.pumpAndSettle();

      expect(
        find.text('Phone number change coming soon'),
        findsOneWidget,
      );
    });

    testWidgets('change password shows "coming soon" snackbar',
        (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('changePasswordTile')));
      await tester.pumpAndSettle();

      expect(
        find.text('Password change coming soon'),
        findsOneWidget,
      );
    });
  });

  group('AppSettingsScreen — Language Dialog', () {
    testWidgets('opens language dialog on tap', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('languageOption')));
      await tester.pumpAndSettle();

      expect(find.text('Select Language'), findsOneWidget);
    });

    testWidgets('shows English and Hindi options', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('languageOption')));
      await tester.pumpAndSettle();

      // English appears in both the ListTile trailing and the dialog radio
      expect(find.text('English'), findsAtLeastNWidgets(1));
      expect(find.textContaining('Hindi'), findsAtLeastNWidgets(1));
    });

    testWidgets('dialog has English radio button', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('languageOption')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('englishRadio')), findsOneWidget);
    });

    testWidgets('dialog has Hindi radio button', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('languageOption')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('hindiRadio')), findsOneWidget);
    });

    testWidgets('can select English language', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('languageOption')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('englishRadio')));
      await tester.pumpAndSettle();

      // Dialog should close
      expect(find.text('Select Language'), findsNothing);
    });

    testWidgets('can select Hindi language', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('languageOption')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('hindiRadio')));
      await tester.pumpAndSettle();

      // Dialog should close
      expect(find.text('Select Language'), findsNothing);
    });
  });

  group('AppSettingsScreen — Delete Account Dialog', () {
    testWidgets('delete button shows danger zone', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      expect(find.text('Delete Account'), findsAtLeastNWidgets(1));
      expect(find.text('This action is irreversible'), findsOneWidget);
    });

    testWidgets('tapping delete opens confirmation dialog', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      // Scroll to the delete button at the bottom of the settings page
      await tester.scrollUntilVisible(
        find.byKey(const Key('deleteAccountButton')),
        100.0,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.byKey(const Key('deleteAccountButton')));
      await tester.pumpAndSettle();

      // Confirmation dialog should appear
      expect(find.text('Delete'), findsWidgets);
      expect(find.text('Cancel'), findsAtLeastNWidgets(1));
    });

    testWidgets('cancel closes dialog', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      // Scroll to the delete button
      await tester.scrollUntilVisible(
        find.byKey(const Key('deleteAccountButton')),
        100.0,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.byKey(const Key('deleteAccountButton')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('cancelDeleteButton')));
      await tester.pumpAndSettle();

      // Dialog should close, back to settings
      expect(find.byType(AppSettingsScreen), findsOneWidget);
    });

    testWidgets('confirm shows not-yet-available snackbar', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      // Scroll to the delete button
      await tester.scrollUntilVisible(
        find.byKey(const Key('deleteAccountButton')),
        100.0,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.byKey(const Key('deleteAccountButton')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('confirmDeleteButton')));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('not yet available'),
        findsOneWidget,
      );
    });
  });
}
