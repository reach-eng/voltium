import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/profile/presentation/screens/settings_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/theme_provider.dart';

/// CI-runnable widget coverage for the tri-state theme picker
/// (`themeOption` → `themeSystemRadio` / `themeLightRadio` / `themeDarkRadio`)
/// and the language dialog's "Follow System" option (`systemRadio`), which
/// previously were only exercised by emulator-backed e2e tests.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Widget buildTestApp() {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
      ],
      child: MaterialApp(
        locale: const Locale('en'),
        supportedLocales: LocaleProvider.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const SettingsScreen(),
      ),
    );
  }

  testWidgets('theme dialog shows all three options and applies Dark',
      (tester) async {
    await tester.pumpWidget(buildTestApp());
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.byKey(const Key('themeOption')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('themeSystemRadio')), findsOneWidget);
    expect(find.byKey(const Key('themeLightRadio')), findsOneWidget);
    expect(find.byKey(const Key('themeDarkRadio')), findsOneWidget);

    await tester.tap(find.byKey(const Key('themeDarkRadio')));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);

    // Re-open: the Dark radio is now selected (state applied + persisted).
    await tester.tap(find.byKey(const Key('themeOption')));
    await tester.pumpAndSettle();
    final darkRadio = tester
        .widget<Radio<ThemeMode>>(find.byKey(const Key('themeDarkRadio')));
    expect(darkRadio.groupValue, ThemeMode.dark);
  });

  testWidgets('theme dialog returns to Follow System', (tester) async {
    await tester.pumpWidget(buildTestApp());
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.byKey(const Key('themeOption')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('themeDarkRadio')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('themeOption')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('themeSystemRadio')));
    await tester.pumpAndSettle();

    // Re-open the dialog to read the now-selected radio.
    await tester.tap(find.byKey(const Key('themeOption')));
    await tester.pumpAndSettle();
    final systemRadio = tester
        .widget<Radio<ThemeMode>>(find.byKey(const Key('themeSystemRadio')));
    expect(systemRadio.groupValue, ThemeMode.system);
  });

  testWidgets('language dialog Follow System radio selects and persists',
      (tester) async {
    await tester.pumpWidget(buildTestApp());
    await tester.pump(const Duration(milliseconds: 400));

    final languageOption = find.byKey(const Key('languageOption'));
    await tester.scrollUntilVisible(languageOption, 200);
    await tester.tap(languageOption);
    await tester.pumpAndSettle();

    // Follow System / English / Hindi all present.
    // LANGUAGE-AUDIT (2026-08-16) #11: the language dialog now
    // iterates over `LocaleNotifier.supportedLanguages` and emits
    // keys as `${lang.code}Radio` (`enRadio`, `hiRadio`, …). The
    // legacy `englishRadio` / `hindiRadio` keys are gone.
    expect(find.byKey(const Key('systemRadio')), findsOneWidget);
    expect(find.byKey(const Key('enRadio')), findsOneWidget);
    expect(find.byKey(const Key('hiRadio')), findsOneWidget);

    // Pick Hindi explicitly, then Follow System.
    await tester.tap(find.byKey(const Key('hiRadio')));
    await tester.pumpAndSettle();
    await tester.tap(languageOption);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('systemRadio')));
    await tester.pumpAndSettle();

    // Re-open the dialog to read the now-selected radio.
    await tester.tap(languageOption);
    await tester.pumpAndSettle();
    final systemRadio =
        tester.widget<Radio<String>>(find.byKey(const Key('systemRadio')));
    expect(systemRadio.groupValue, 'system');

    // System locale in the test env is English → re-derived, no persisted code.
    final state =
        ProviderScope.containerOf(tester.element(find.byType(SettingsScreen)));
    expect(state.read(localeProvider).isFollowingSystem, isTrue);
    expect(state.read(localeProvider).locale.languageCode, 'en');
  });
}
