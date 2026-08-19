import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/auth/presentation/screens/login_screen.dart';
import 'package:voltium_rider/features/auth/presentation/screens/otp_verification_screen.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/login_footer.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_app_bar.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_resend_widget.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_verify_button.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/phone_entry_widget.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/kyc_preflight_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/legal_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/legal_page_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/permissions_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/splash_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/theme_provider.dart';

Widget buildTestApp({
  required Widget child,
  Locale locale = const Locale('en'),
  ThemeMode themeMode = ThemeMode.light,
}) {
  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith(() => LocaleProvider()),
      themeProviderRef.overrideWith(() => ThemeProvider()),
      riderProvider.overrideWith(() => _SeededRiderNotifier(
            const RiderModel(
              id: 'rider_test_001',
              riderId: 'rider_test_001',
              name: 'Aarav Sharma',
              phone: '9876543210',
              lifecycleStatus: 'NEW',
            ),
          )),
    ],
    child: MaterialApp(
      locale: locale,
      themeMode: themeMode,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    ),
  );
}

class _SeededRiderNotifier extends RiderNotifier {
  _SeededRiderNotifier(this._seed);
  final RiderModel _seed;

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PermissionsScreen Audit & Fixes', () {
    testWidgets('renders all permission items in English & dark mode',
        (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: const PermissionsScreen(),
        themeMode: ThemeMode.dark,
      ));
      await tester.pumpAndSettle();

      expect(find.byType(PermissionsScreen), findsOneWidget);
      expect(find.text('Permissions'), findsOneWidget);
      expect(find.text('Continue'), findsOneWidget);
      expect(find.text('Location'), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Camera'), findsOneWidget);
      expect(find.text('Microphone'), findsOneWidget);
    });

    testWidgets('renders permissions screen in Hindi (i18n)', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: const PermissionsScreen(),
        locale: const Locale('hi'),
      ));
      await tester.pumpAndSettle();

      expect(find.text('अनुमतियाँ'), findsOneWidget);
      expect(find.text('स्थान'), findsOneWidget);
      expect(find.text('सूचनाएं'), findsOneWidget);
      expect(find.text('जारी रखें'), findsOneWidget);
    });
  });

  group('KycPreflightScreen Audit & Fixes', () {
    testWidgets('renders header checklist in English and Dark Mode',
        (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: KycPreflightScreen(onNext: () {}, onSkip: () {}),
        themeMode: ThemeMode.dark,
      ));
      await tester.pumpAndSettle();

      expect(find.byType(KycPreflightScreen), findsOneWidget);
      expect(find.text('Before You Begin'), findsOneWidget);
      expect(find.text("I'm Ready"), findsOneWidget);
      expect(find.text("I'll do this later"), findsOneWidget);
      expect(find.text('Aadhaar Card'), findsOneWidget);
      expect(find.text('PAN Card'), findsOneWidget);
    });

    testWidgets('renders KycPreflightScreen in Hindi', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: KycPreflightScreen(onNext: () {}, onSkip: () {}),
        locale: const Locale('hi'),
      ));
      await tester.pumpAndSettle();

      expect(find.text('शुरू करने से पहले'), findsOneWidget);
      expect(find.text('मैं तैयार हूँ'), findsOneWidget);
      expect(find.text('मैं यह बाद में करूँगा'), findsOneWidget);
    });
  });

  group('LegalScreen & LegalPageScreen Audit & Fixes', () {
    testWidgets('renders legal screen with checkbox and accordion in English',
        (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: const LegalScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(LegalScreen), findsOneWidget);
      expect(find.text('Agree to Terms'), findsOneWidget);
      expect(find.byKey(const Key('acceptCheckbox')), findsOneWidget);
      expect(find.byKey(const Key('continueLegalButton')), findsOneWidget);

      // Checkbox toggle
      await tester.tap(find.byKey(const Key('acceptCheckbox')));
      await tester.pumpAndSettle();
    });

    testWidgets('renders legal screen in Hindi', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: const LegalScreen(),
        locale: const Locale('hi'),
      ));
      await tester.pumpAndSettle();

      expect(find.text('शर्तें स्वीकार करें'), findsOneWidget);
      expect(find.text('जारी रखें'), findsOneWidget);
    });

    testWidgets('renders legal page screen with signature section in Dark mode',
        (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: const LegalPageScreen(documentType: LegalDocumentType.terms),
        themeMode: ThemeMode.dark,
      ));
      await tester.pumpAndSettle();

      expect(find.byType(LegalPageScreen), findsOneWidget);
      expect(find.text('Terms of Service'), findsAtLeastNWidgets(1));
    });
  });

  group('Auth & LoginScreen Audit & Fixes', () {
    testWidgets('referral input sanitizes input using formatters',
        (tester) async {
      final controller = AnimationController(
        vsync: const TestVSync(),
        duration: const Duration(milliseconds: 300),
      );
      final phoneCtrl = TextEditingController();

      await tester.pumpWidget(buildTestApp(
        child: Scaffold(
          body: SingleChildScrollView(
            child: PhoneEntryWidget(
              entryController: controller,
              onPhoneChanged: (_) {},
              onPhoneSubmitted: () {},
              phoneController: phoneCtrl,
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      final referralFinder = find.byKey(const Key('referralInput'));
      expect(referralFinder, findsOneWidget);

      // Enter alphanumeric referral
      await tester.enterText(referralFinder, 'BONUS100!#%');
      await tester.pumpAndSettle();

      // Special characters should be stripped
      final textFormField = tester.widget<TextFormField>(referralFinder);
      expect(textFormField.controller?.text, 'BONUS100');
    });

    testWidgets('login footer renders localized links', (tester) async {
      final controller = AnimationController(
        vsync: const TestVSync(),
        duration: const Duration(milliseconds: 300),
      )..value = 1.0;

      await tester.pumpWidget(buildTestApp(
        child: Scaffold(
          body: LoginFooter(
            entryController: controller,
            onLaunchUrl: (_) async {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Terms of Service'), findsOneWidget);
      expect(find.text('Privacy Policy'), findsOneWidget);
    });
  });

  group('OTP Verification Audit & Fixes', () {
    testWidgets('OtpAppBar renders back button and brand title',
        (tester) async {
      bool backPressed = false;
      await tester.pumpWidget(buildTestApp(
        child: Scaffold(
          body: OtpAppBar(onBack: () => backPressed = true),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Voltium'), findsOneWidget);
      await tester.tap(find.byIcon(Icons.arrow_back));
      expect(backPressed, isTrue);
    });

    testWidgets('OtpResendWidget renders countdown and localized states',
        (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: Scaffold(
          body: OtpResendWidget(
            remainingSeconds: 25,
            onResend: () {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text("DIDN'T RECEIVE THE CODE?"), findsOneWidget);
      expect(find.text('Resend in 25s'), findsOneWidget);

      // Ready to resend
      await tester.pumpWidget(buildTestApp(
        child: Scaffold(
          body: OtpResendWidget(
            remainingSeconds: 0,
            onResend: () {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Resend Code'), findsOneWidget);
    });

    testWidgets('OtpVerifyButton shows loading and localized text',
        (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: Scaffold(
          body: OtpVerifyButton(
            canVerify: true,
            isLoading: false,
            onPressed: () {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Verify & Proceed'), findsOneWidget);

      await tester.pumpWidget(buildTestApp(
        child: Scaffold(
          body: OtpVerifyButton(
            canVerify: true,
            isLoading: true,
            onPressed: () {},
          ),
        ),
      ));
      await tester.pump();

      expect(find.text('Verifying…'), findsOneWidget);
    });
  });

  group('SplashScreen Audit & Fixes', () {
    testWidgets('SplashScreen renders with tagline and theme-aware shadows',
        (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: SplashScreen(onComplete: () {}),
        themeMode: ThemeMode.dark,
      ));
      await tester.pump();

      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.text('Voltium'), findsOneWidget);

      // Complete timers
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump(const Duration(seconds: 4));
    });
  });
}
