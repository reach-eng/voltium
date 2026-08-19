import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/profile/presentation/screens/profile_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';

/// Seeds the Riverpod `riderProvider` directly (R4.3c-6 migration): the
/// ProfileScreen watches `riderProvider.select((p) => p.rider)` for the
/// header, so the legacy AppProvider seed alone no longer satisfies it.
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

Widget buildTestApp() {
  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith(() => LocaleProvider()),
      themeProviderRef.overrideWith(() => ThemeProvider()),
      riderProvider.overrideWith(() => _SeededRiderNotifier(
            const RiderModel(
              riderId: '1',
              id: 'db1',
              phone: '1234567890',
              lifecycleStatus: 'ACTIVE',
              name: 'Test Rider',
            ),
          )),
    ],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: ProfileScreen(),
    ),
  );
}

void main() {
  group('Profile Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(find.byType(ProfileScreen), findsOneWidget);
    });

    testWidgets('displays profile menu title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      // The screen header is l10n.menu_title ("Menu") and the first
      // quick-link row carries the "Profile" label.
      expect(find.text('Menu'), findsOneWidget);
      expect(find.text('Profile'), findsAtLeastNWidgets(1));
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows quick links section', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(find.byIcon(Icons.person_outline), findsWidgets);
    });
  });
}
