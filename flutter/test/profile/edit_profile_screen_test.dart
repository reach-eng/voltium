import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/profile/presentation/screens/edit_profile_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _TestAppProvider extends AppProvider {
  @override
  Future<void> refreshTransactions() async {}
  @override
  Future<void> refresh() async {}
  @override
  Future<void> refreshFromApi() async {}
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

Widget buildTestApp({RiderModel? initialRider}) {
  final seed = initialRider ??
      const RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        email: 'john@example.com',
      );

  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith(() => LocaleProvider()),
      themeProviderRef.overrideWith(() => ThemeProvider()),
      appProvider.overrideWith((ref) => _TestAppProvider()),
      riderProvider.overrideWith(() => _SeededRiderNotifier(seed)),
    ],
    child: const MaterialApp(
      locale: Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: EditProfileScreen(),
    ),
  );
}

void main() {
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
  });

  group('Edit Profile Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(EditProfileScreen), findsOneWidget);
    });

    testWidgets('displays edit profile title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Edit Profile'), findsOneWidget);
    });

    testWidgets('save button is disabled when not dirty', (tester) async {
      final rider = RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        email: 'john@example.com',
      );
      await tester.pumpWidget(buildTestApp(initialRider: rider));
      await tester.pumpAndSettle();

      final submitBtn = tester.widget<ElevatedButton>(
        find.byKey(const Key('submitProfileButton')),
      );
      expect(submitBtn.onPressed, isNull);
    });

    testWidgets('typing a new name enables save button (dirty state)',
        (tester) async {
      final rider = RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        email: 'john@example.com',
      );
      await tester.pumpWidget(buildTestApp(initialRider: rider));
      await tester.pumpAndSettle();

      // Enter a new name
      await tester.enterText(
          find.byKey(const Key('editFullNameField')), 'Jane Doe');
      await tester.pumpAndSettle();

      final submitBtn = tester.widget<ElevatedButton>(
        find.byKey(const Key('submitProfileButton')),
      );
      expect(submitBtn.onPressed, isNotNull);
    });

    testWidgets('shows discard dialog when dirty and tapping back button',
        (tester) async {
      final rider = RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        email: 'john@example.com',
      );
      await tester.pumpWidget(buildTestApp(initialRider: rider));
      await tester.pumpAndSettle();

      // Make dirty
      await tester.enterText(
          find.byKey(const Key('editFullNameField')), 'Jane Doe');
      await tester.pumpAndSettle();

      // Tap back button
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      // Discard dialog should appear
      expect(find.text('Discard changes?'), findsOneWidget);
      expect(find.text('Keep Editing'), findsOneWidget);
      expect(find.text('Discard'), findsOneWidget);

      // Tap Keep Editing
      await tester.tap(find.text('Keep Editing'));
      await tester.pumpAndSettle();
      expect(find.text('Discard changes?'), findsNothing);
    });

    testWidgets('shows validation error for invalid name and email',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final rider = RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        email: 'john@example.com',
      );
      await tester.pumpWidget(buildTestApp(initialRider: rider));
      await tester.pumpAndSettle();

      // Enter invalid inputs
      await tester.enterText(find.byKey(const Key('editFullNameField')), 'A');
      await tester.enterText(
          find.byKey(const Key('editEmailField')), 'invalid-email');
      await tester.pumpAndSettle();

      // Tap submit
      final submitFinder = find.byKey(const Key('submitProfileButton'));
      await tester.tap(submitFinder);
      await tester.pumpAndSettle();

      expect(find.text('Enter a valid name (at least 2 characters)'),
          findsOneWidget);
      expect(find.text('Enter a valid email address'), findsOneWidget);
    });
  });
}
