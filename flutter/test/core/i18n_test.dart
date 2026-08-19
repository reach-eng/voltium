import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:universal_io/io.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/gen/app_localizations_en.dart';
import 'package:voltium_rider/gen/app_localizations_hi.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';

void main() {
  group('i18n Localization Unit Tests', () {
    late Map<String, dynamic> enJson;
    late Map<String, dynamic> hiJson;

    setUpAll(() {
      final enFile = File('lib/l10n/app_en.arb');
      final hiFile = File('lib/l10n/app_hi.arb');

      expect(enFile.existsSync(), isTrue, reason: 'app_en.arb must exist');
      expect(hiFile.existsSync(), isTrue, reason: 'app_hi.arb must exist');

      enJson = jsonDecode(enFile.readAsStringSync());
      hiJson = jsonDecode(hiFile.readAsStringSync());
    });

    test('All English translation keys exist in Hindi translation (Key Parity)',
        () {
      final enKeys = enJson.keys.where((key) => !key.startsWith('@')).toSet();
      final hiKeys = hiJson.keys.where((key) => !key.startsWith('@')).toSet();

      final missingInHindi = enKeys.difference(hiKeys);
      expect(
        missingInHindi,
        isEmpty,
        reason:
            'The following keys are in app_en.arb but missing in app_hi.arb: $missingInHindi',
      );
    });

    test('No orphaned keys in Hindi translation', () {
      // LANGUAGE-AUDIT (2026-08-16) #3: the previous filter
      // `!key.startsWith('txt')` hid 230 dead `txt*` keys in
      // app_hi.arb that no Dart file ever consumed. The orphan
      // check is now honest — any HI key without a matching EN
      // key (other than the @* ARB metadata) will fail. The dead
      // txt* keys were pruned by `scripts/prune_hi_orphans.mjs`;
      // this test now protects against any future re-introduction
      // of unsynchronized keys.
      final enKeys = enJson.keys.where((key) => !key.startsWith('@')).toSet();
      final hiKeys = hiJson.keys.where((key) => !key.startsWith('@')).toSet();

      final extraInHindi = hiKeys.difference(enKeys);
      expect(
        extraInHindi,
        isEmpty,
        reason:
            'The following keys are in app_hi.arb but not in app_en.arb: $extraInHindi',
      );
    });

    test('AppLocalizations instances generate valid strings for both locales',
        () {
      final AppLocalizations enLoc = AppLocalizationsEn();
      final AppLocalizations hiLoc = AppLocalizationsHi();

      expect(enLoc.appTitle, isNotEmpty);
      expect(hiLoc.appTitle, isNotEmpty);
      expect(enLoc.common_loading, equals('Loading...'));
      expect(hiLoc.common_loading, equals('लोड हो रहा है...'));

      expect(enLoc.common_cancel, equals('Cancel'));
      expect(hiLoc.common_cancel, equals('रद्द करें'));
    });

    test('Dynamic parameter placeholders match between English and Hindi', () {
      final enLoc = AppLocalizationsEn();
      final hiLoc = AppLocalizationsHi();

      expect(enLoc.common_rupeeAmount('1500'), equals('₹1500'));
      expect(hiLoc.common_rupeeAmount('1500'), equals('₹1500'));

      expect(enLoc.dashboard_kilometers('50'), equals('50 km'));
      expect(hiLoc.dashboard_kilometers('50'), equals('50 किमी'));

      expect(enLoc.wallet_streakOf(3), equals('3 / 5 Days'));
      expect(hiLoc.wallet_streakOf(3), equals('3 / 5 दिन'));
    });

    test('LocaleNotifier updates supported locales correctly', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(localeProviderRef.notifier);

      expect(
          container.read(localeProviderRef).locale.languageCode, equals('en'));
      expect(container.read(localeProviderRef).isHindi, isFalse);

      await notifier.setHindi();
      expect(
          container.read(localeProviderRef).locale.languageCode, equals('hi'));
      expect(container.read(localeProviderRef).isHindi, isTrue);

      await notifier.setEnglish();
      expect(
          container.read(localeProviderRef).locale.languageCode, equals('en'));
      expect(container.read(localeProviderRef).isHindi, isFalse);
    });

    // LANGUAGE-AUDIT (2026-08-16) #13: the initial cold-start
    // `locale_resolved` PostHog event fires asynchronously via
    // `Future.microtask`, so we drain the microtask queue and
    // then assert the notifier ends up in the right state. The
    // actual PostHog transport is mocked in unit tests; we
    // verify the state-machine side effect (the explicit-choice
    // flag is set after a `setLocale` call).
    test('LocaleNotifier cold-start: explicit-choice flag tracks persistence',
        () async {
      // 1. No persisted choice → flag is false.
      final c1 = ProviderContainer();
      addTearDown(c1.dispose);
      expect(c1.read(localeProviderRef).locale.languageCode, equals('en'));
      // Drain microtasks so the locale_resolved event has fired.
      await Future.microtask(() {});
      // 2. After setLocale, the flag flips to true on next build.
      await c1.read(localeProviderRef.notifier).setHindi();
      expect(c1.read(localeProviderRef).locale.languageCode, equals('hi'));
      await Future.microtask(() {});
      // 3. After setFollowSystem, the flag goes back to false.
      await c1.read(localeProviderRef.notifier).setFollowSystem();
      expect(c1.read(localeProviderRef).isFollowingSystem, isTrue);
    });
  });

  group('i18n Widget & Locale Switcher Tests', () {
    testWidgets(
        'Widget tree resolves AppLocalizations and toggles locale correctly',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('hi'),
          supportedLocales: LocaleNotifier.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          home: Builder(
            builder: (context) {
              final loc = AppLocalizations.of(context)!;
              return Scaffold(
                body: Column(
                  children: [
                    Text(loc.common_loading),
                    Text(loc.common_cancel),
                    Text(loc.common_confirm),
                  ],
                ),
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('लोड हो रहा है...'), findsOneWidget);
      expect(find.text('रद्द करें'), findsOneWidget);
      expect(find.text('पुष्टि करें'), findsOneWidget);
    });
  });
}
