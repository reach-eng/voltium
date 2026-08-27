import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/login_footer.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_trigger_widget.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/phone_entry_widget.dart';

// Voltium — LoginScreen widget split smoke tests
//
// Covers the three widgets extracted in PR-P2.2:
//   - PhoneEntryWidget  (phone + referral + OTP note)
//   - OtpTriggerWidget  (Enter button)
//   - LoginFooter       (terms + privacy)
//
// These tests intentionally avoid the LoginScreen itself because it pulls
// in a chain that includes the currently-missing `app_provider.dart` (a
// pre-existing repo-level issue, not from this PR). The widgets are
// pure UI and don't need Riverpod.

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/login_footer.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_trigger_widget.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/phone_entry_widget.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

void main() {
  group('PhoneEntryWidget', () {
    testWidgets('renders phone, referral, and OTP note', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: PhoneEntryWidget(
              entryController: AnimationController(
                vsync: const TestVSync(),
                duration: const Duration(milliseconds: 800),
              ),
              onPhoneChanged: (_) {},
              onPhoneSubmitted: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.byKey(const Key('phoneInput')), findsOneWidget);
      expect(find.byKey(const Key('referralInput')), findsOneWidget);
      expect(find.text('+91'), findsOneWidget);
      expect(find.text('A secure OTP will be sent'), findsOneWidget);
    });

    testWidgets('validates phone prefix and surfaces error', (tester) async {
      final controller = AnimationController(
        vsync: const TestVSync(),
        duration: const Duration(milliseconds: 800),
      );
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: PhoneEntryWidget(
              entryController: controller,
              onPhoneChanged: (_) {},
              onPhoneSubmitted: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      // Phone starting with 5 is invalid
      await tester.enterText(find.byKey(const Key('phoneInput')), '5123456789');
      await tester.pump();
      expect(
        find.text('Phone number must start with 6, 7, 8, or 9'),
        findsOneWidget,
      );

      // Switching to 9 clears the error
      await tester.enterText(find.byKey(const Key('phoneInput')), '9876543210');
      await tester.pump();
      expect(
        find.text('Phone number must start with 6, 7, 8, or 9'),
        findsNothing,
      );

      controller.dispose();
    });

    testWidgets('digits-only input formatter rejects letters', (tester) async {
      final controller = AnimationController(
        vsync: const TestVSync(),
        duration: const Duration(milliseconds: 800),
      );
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: PhoneEntryWidget(
              entryController: controller,
              onPhoneChanged: (_) {},
              onPhoneSubmitted: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.enterText(
        find.byKey(const Key('phoneInput')),
        '98abc7654',
      );
      await tester.pump();
      final editable = tester.widget<EditableText>(
        find.descendant(
          of: find.byKey(const Key('phoneInput')),
          matching: find.byType(EditableText),
        ),
      );
      expect(editable.controller.text, matches(RegExp(r'^[0-9]*$')));
      controller.dispose();
    });

    testWidgets('invokes onPhoneChanged for every change', (tester) async {
      final controller = AnimationController(
        vsync: const TestVSync(),
        duration: const Duration(milliseconds: 800),
      );
      final changes = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: PhoneEntryWidget(
              entryController: controller,
              onPhoneChanged: changes.add,
              onPhoneSubmitted: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.enterText(find.byKey(const Key('phoneInput')), '9');
      await tester.pump();
      await tester.enterText(find.byKey(const Key('phoneInput')), '98');
      await tester.pump();

      expect(changes, contains('9'));
      expect(changes, contains('98'));
      controller.dispose();
    });
  });

  group('OtpTriggerWidget', () {
    testWidgets('renders with "Enter" label and key', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: OtpTriggerWidget(
              canSubmit: false,
              isLoading: false,
              onPressed: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.byKey(const Key('sendOtpButton')), findsOneWidget);
      expect(find.text('Enter'), findsOneWidget);
    });

    testWidgets('shows spinner when isLoading=true', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: OtpTriggerWidget(
              canSubmit: true,
              isLoading: true,
              onPressed: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Enter'), findsNothing);
    });

    testWidgets('invokes onPressed when tapped and canSubmit=true',
        (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: OtpTriggerWidget(
              canSubmit: true,
              isLoading: false,
              onPressed: () => taps++,
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await tester.pump();
      expect(taps, 1);
    });

    testWidgets('button is not interactive when canSubmit=false',
        (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: OtpTriggerWidget(
              canSubmit: false,
              isLoading: false,
              onPressed: () => taps++,
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await tester.pump();
      expect(taps, 0);
    });
  });

  group('LoginFooter', () {
    testWidgets('renders Terms and Privacy links', (tester) async {
      final controller = AnimationController(
        vsync: const TestVSync(),
        duration: const Duration(milliseconds: 800),
      );
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: LoginFooter(
              entryController: controller,
              onLaunchUrl: (_) async {},
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Terms of Service'), findsOneWidget);
      expect(find.text('Privacy Policy'), findsOneWidget);
      controller.dispose();
    });

    testWidgets('invokes onLaunchUrl with the tapped URL', (tester) async {
      final controller = AnimationController(
        vsync: const TestVSync(),
        duration: const Duration(milliseconds: 800),
      );
      final urls = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: LoginFooter(
              entryController: controller,
              onLaunchUrl: (u) async => urls.add(u),
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.text('Terms of Service'));
      await tester.pump();
      expect(urls, contains('https://voltium.app/terms'));

      await tester.tap(find.text('Privacy Policy'));
      await tester.pump();
      expect(urls, contains('https://voltium.app/privacy'));
      controller.dispose();
    });
  });
}

/// Test-only TickerProvider. flutter_test doesn't expose a built-in helper
/// for non-pump tests, so we use this minimal stand-in.
class TestVSync implements TickerProvider {
  const TestVSync();
  @override
  Ticker createTicker(TickerCallback onTick) => Ticker(onTick);
}
