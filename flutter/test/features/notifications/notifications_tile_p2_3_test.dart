import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/notifications/data/notification_prefs_service.dart';
import 'package:voltium_rider/features/profile/presentation/screens/settings_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/theme_provider.dart';

/// P2-3 (2026-09-07) — Dual notification truth regression tests.
///
/// The old `_NotificationsTile` read/wrote the `notif_push` SharedPreferences
/// key directly while [notificationPrefsProvider] owned the same key. The
/// provider caches its state from `build()`, so a direct tile write left the
/// provider stale — and the granular prefs screen seeds its draft from the
/// provider, meaning a Save there silently reverted the tile flip.
///
/// These tests pin the fixed contract: the tile routes through the provider,
/// and a provider-mediated flip is visible to (and preserved by) any later
/// draft seeding + Save.

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

const _mockRider = RiderModel(
  id: 'rider-p23-01',
  riderId: 'R-P23',
  name: 'P2-3 Rider',
  phone: '+919876543210',
  kycStatus: KycStatus.verified,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('P2-3: notifications tile routes through notificationPrefsProvider',
      () {
    testWidgets(
        'tile flip updates the provider (not just SharedPreferences behind its back)',
        (tester) async {
      final container = ProviderContainer(overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        riderProvider.overrideWith(() => _SeededRiderNotifier(_mockRider)),
      ]);
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            locale: const Locale('en'),
            supportedLocales: LocaleProvider.supportedLocales,
            themeMode: ThemeMode.light,
            theme: ThemeData.light(),
            darkTheme: ThemeData.dark(),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            home: const SettingsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Provider resolved with the default (push = true).
      expect(container.read(notificationPrefsProvider).value?.push, isTrue);

      final switchFinder = find.byKey(const Key('notificationsSwitch'));
      expect(switchFinder, findsOneWidget);

      await tester.tap(switchFinder);
      await tester.pumpAndSettle();

      // The provider — the single source of truth — now says false.
      expect(container.read(notificationPrefsProvider).value?.push, isFalse);

      // And the persistence behind it matches.
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool(NotificationPrefsNotifier.keyPush), isFalse);

      // The switch re-rendered from the provider, not from local state.
      expect(tester.widget<Switch>(switchFinder).value, isFalse);
    });
  });

  group('P2-3: provider-mediated flip survives a later prefs-screen Save', () {
    test('draft seeded after a tile flip sees the flip and does not revert it',
        () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      // 1. Provider resolves (push = true, empty prefs).
      final initial = await container.read(notificationPrefsProvider.future);
      expect(initial.push, isTrue);

      // 2. The rider flips the tile — routed through the provider (as the
      //    fixed tile does).
      final notifier = container.read(notificationPrefsProvider.notifier);
      await notifier.save(initial.copyWith(push: false));

      // 3. The rider opens the granular prefs screen; it seeds its draft
      //    from the provider. The crux of P2-3: the draft must reflect the
      //    tile flip (the old architecture served a stale snapshot here).
      final draft = await container.read(notificationPrefsProvider.future);
      expect(draft.push, isFalse,
          reason: 'draft seeded from the provider must include the tile flip');

      // 4. The rider taps Save on the prefs screen (draft unchanged except
      //    for unrelated category toggles — none here).
      await notifier.save(draft);

      // 5. The flip survives.
      final after = await container.read(notificationPrefsProvider.future);
      expect(after.push, isFalse);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool(NotificationPrefsNotifier.keyPush), isFalse);
    });
  });
}
