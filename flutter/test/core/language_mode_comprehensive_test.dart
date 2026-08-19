import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/profile/presentation/screens/profile_screen.dart';
import 'package:voltium_rider/features/profile/presentation/screens/settings_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/widgets/language_toggle.dart';

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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await CacheService().init();
  });

  const mockRider = RiderModel(
    id: 'rider-lang-01',
    riderId: 'R-LANG',
    name: 'Rahul Dev',
    phone: '+919876543210',
    kycStatus: KycStatus.verified,
  );

  Widget buildTestApp({
    required Widget child,
    ThemeMode themeMode = ThemeMode.light,
    Locale? locale,
  }) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        riderProvider.overrideWith(() => _SeededRiderNotifier(mockRider)),
      ],
      child: MaterialApp(
        locale: locale,
        supportedLocales: LocaleProvider.supportedLocales,
        themeMode: themeMode,
        theme: ThemeData.light(),
        darkTheme: ThemeData.dark(),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: child,
      ),
    );
  }

  group('LocaleNotifier Unit & State Tests', () {
    test('default state starts as English and follows system when no cache', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final state = container.read(localeProvider);
      expect(state.locale.languageCode, equals('en'));
      expect(state.isHindi, isFalse);
      expect(state.isEnglish, isTrue);
      expect(state.isFollowingSystem, isTrue);
    });

    test('switching to Hindi persists to cache and updates state', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await container.read(localeProvider.notifier).setHindi();
      final state = container.read(localeProvider);

      expect(state.locale.languageCode, equals('hi'));
      expect(state.isHindi, isTrue);
      expect(state.isEnglish, isFalse);
      expect(state.isFollowingSystem, isFalse);
      expect(CacheService().getLocale(), equals('hi'));
    });

    test('switching back to English updates state and cache', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await container.read(localeProvider.notifier).setHindi();
      expect(container.read(localeProvider).isHindi, isTrue);

      await container.read(localeProvider.notifier).setEnglish();
      final state = container.read(localeProvider);

      expect(state.locale.languageCode, equals('en'));
      expect(state.isHindi, isFalse);
      expect(state.isEnglish, isTrue);
      expect(CacheService().getLocale(), equals('en'));
    });

    test('setFollowSystem clears cache and marks isFollowingSystem true',
        () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await container.read(localeProvider.notifier).setHindi();
      expect(CacheService().getLocale(), equals('hi'));

      await container.read(localeProvider.notifier).setFollowSystem();
      final state = container.read(localeProvider);

      expect(state.isFollowingSystem, isTrue);
      expect(CacheService().getLocale(), isNull);
    });

    test('maybeApplyFromServer adopts remote preference when no local override',
        () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(CacheService().getLocale(), isNull);
      await container.read(localeProvider.notifier).maybeApplyFromServer('hi');

      final state = container.read(localeProvider);
      expect(state.locale.languageCode, equals('hi'));
      expect(state.isHindi, isTrue);
    });

    test('maybeApplyFromServer ignores remote preference when local override exists',
        () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      // Explicit local choice: English persisted in cache
      await CacheService().setLocale('en');
      expect(CacheService().getLocale(), equals('en'));

      // Server returns Hindi, but local choice must prevail
      await container.read(localeProvider.notifier).maybeApplyFromServer('hi');

      final state = container.read(localeProvider);
      expect(state.locale.languageCode, equals('en'));
      expect(state.isHindi, isFalse);
    });

    test('displayNameFor resolves correct language names', () {
      final l10n = lookupAppLocalizations(const Locale('en'));
      expect(LocaleNotifier.displayNameFor(const Locale('en'), l10n),
          equals('English'));
      expect(LocaleNotifier.displayNameFor(const Locale('hi'), l10n),
          equals('हिंदी'));
    });
  });

  group('showAppLanguageDialog Widget Tests', () {
    testWidgets('renders all options in dialog and selects Hindi',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(
        child: Builder(
          builder: (context) => Scaffold(
            body: Consumer(
              builder: (ctx, ref, _) => ElevatedButton(
                key: const Key('openDialogBtn'),
                onPressed: () => showAppLanguageDialog(ctx, ref),
                child: const Text('Open Language Dialog'),
              ),
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      // Open dialog
      await tester.tap(find.byKey(const Key('openDialogBtn')));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.byKey(const Key('systemRadio')), findsOneWidget);
      expect(find.byKey(const Key('enRadio')), findsOneWidget);
      expect(find.byKey(const Key('hiRadio')), findsOneWidget);

      // Tap Hindi radio
      await tester.tap(find.byKey(const Key('hiRadio')));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsNothing);
      expect(CacheService().getLocale(), equals('hi'));
    });

    testWidgets('dialog renders properly in dark mode', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(
        themeMode: ThemeMode.dark,
        child: Builder(
          builder: (context) => Scaffold(
            body: Consumer(
              builder: (ctx, ref, _) => ElevatedButton(
                key: const Key('openDialogBtn'),
                onPressed: () => showAppLanguageDialog(ctx, ref),
                child: const Text('Open Language Dialog'),
              ),
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('openDialogBtn')));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('ProfileScreen & SettingsScreen Language Integration', () {
    testWidgets('ProfileScreen shows language tile and opens dialog',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(child: const ProfileScreen()));
      await tester.pumpAndSettle();

      final languageLink = find.byKey(const Key('languageLink'));
      expect(languageLink, findsAtLeastNWidgets(1));

      await tester.scrollUntilVisible(languageLink, 200);
      await tester.tap(languageLink);
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.byKey(const Key('systemRadio')), findsOneWidget);
    });

    testWidgets('SettingsScreen shows language option and opens dialog',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(child: const SettingsScreen()));
      await tester.pumpAndSettle();

      final languageOption = find.byKey(const Key('languageOption'));
      expect(languageOption, findsAtLeastNWidgets(1));

      await tester.scrollUntilVisible(languageOption, 200);
      await tester.tap(languageOption);
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.byKey(const Key('systemRadio')), findsOneWidget);
    });
  });
}
