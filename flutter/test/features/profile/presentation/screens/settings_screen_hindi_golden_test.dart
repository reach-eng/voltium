import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/profile/presentation/screens/settings_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import '../../../../helpers/golden_test_helper.dart';

class _SeededRiderNotifier extends RiderNotifier {
  final RiderModel _seed;
  _SeededRiderNotifier(this._seed);

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );
}

class _HindiLocaleNotifier extends LocaleNotifier {
  @override
  LocaleState build() => const LocaleState(locale: Locale('hi'));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const mockRider = RiderModel(
    id: 'rider-settings-hi',
    riderId: 'R-9988',
    name: 'रोहन वर्मा',
    phone: '+919876543210',
    kycStatus: KycStatus.verified,
  );

  setUp(() async {
    SharedPreferences.setMockInitialValues({
      'volt_locale': 'hi',
    });
    await CacheService().init();
  });

  testWidgets(
      'SettingsScreen renders in Hindi with no Devanagari text overflow',
      (WidgetTester tester) async {
    configureGoldenSurface(tester, size: const Size(412, 915));

    final testWidget = wrapForGolden(
      const SettingsScreen(),
      locale: const Locale('hi'),
      overrides: [
        localeProviderRef.overrideWith(() => _HindiLocaleNotifier()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        riderProvider.overrideWith(() => _SeededRiderNotifier(mockRider)),
      ],
    );

    await tester.pumpWidget(testWidget);
    await tester.pump(const Duration(milliseconds: 500));

    // Verify SettingsScreen renders without errors
    expect(find.byType(SettingsScreen), findsOneWidget);

    // Assert key Hindi headings and labels are rendered correctly
    final l10n = lookupAppLocalizations(const Locale('hi'));
    expect(find.text(l10n.settings_title), findsOneWidget); // 'सेटिंग्स'
    expect(
        find.text(l10n.settings_preferences), findsOneWidget); // 'प्राथमिकताएं'
    expect(find.byKey(const Key('languageOption')), findsOneWidget);
    expect(find.byKey(const Key('themeOption')), findsOneWidget);

    await expectLater(
      find.byType(SettingsScreen),
      matchesGoldenFile('goldens/settings_screen_hindi_golden.png'),
    );
  });

  testWidgets(
      'Language selection dialog renders in Hindi with no Devanagari text overflow',
      (WidgetTester tester) async {
    configureGoldenSurface(tester, size: const Size(412, 915));

    final testWidget = wrapForGolden(
      const SettingsScreen(),
      locale: const Locale('hi'),
      overrides: [
        localeProviderRef.overrideWith(() => _HindiLocaleNotifier()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        riderProvider.overrideWith(() => _SeededRiderNotifier(mockRider)),
      ],
    );

    await tester.pumpWidget(testWidget);
    await tester.pump(const Duration(milliseconds: 500));

    // Tap language option to open language dialog
    final languageOption = find.byKey(const Key('languageOption'));
    await tester.scrollUntilVisible(languageOption, 200);
    await tester.tap(languageOption);
    await tester.pumpAndSettle();

    // Verify AlertDialog is displayed
    expect(find.byType(AlertDialog), findsOneWidget);

    // Verify dialog options in Hindi scoped to the AlertDialog
    final l10n = lookupAppLocalizations(const Locale('hi'));
    expect(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.text(l10n.menu_selectLanguage),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.text(l10n.settings_followSystem),
      ),
      findsOneWidget,
    );
    expect(find.byKey(const Key('systemRadio')), findsOneWidget);
    expect(find.byKey(const Key('enRadio')), findsOneWidget);
    expect(find.byKey(const Key('hiRadio')), findsOneWidget);

    await expectLater(
      find.byType(AlertDialog),
      matchesGoldenFile('goldens/language_dialog_hindi_golden.png'),
    );
  });
}
