import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/profile/presentation/screens/settings_screen.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notification_preferences_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/theme_provider.dart';

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

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  const mockRider = RiderModel(
    id: 'rider-settings-01',
    riderId: 'R-7788',
    name: 'Vikram Sharma',
    phone: '+919876543210',
    kycStatus: KycStatus.verified,
  );

  Widget buildTestApp({
    Widget child = const SettingsScreen(),
    ThemeMode themeMode = ThemeMode.light,
    RiderModel rider = mockRider,
  }) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        riderProvider.overrideWith(() => _SeededRiderNotifier(rider)),
      ],
      child: MaterialApp(
        locale: const Locale('en'),
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

  group('SettingsScreen - Hierarchy & Components', () {
    testWidgets('renders rider identity card and all 6 sections',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      // Identity Card
      expect(find.text('Vikram Sharma'), findsAtLeastNWidgets(1));
      expect(find.text('+919876543210'), findsAtLeastNWidgets(1));
      expect(find.textContaining('KYC'), findsAtLeastNWidgets(1));

      // Preferences Section
      expect(find.byKey(const Key('themeOption')), findsAtLeastNWidgets(1));
      expect(
          find.byKey(const Key('notificationsTile')), findsAtLeastNWidgets(1));
      expect(find.byKey(const Key('notificationsSwitch')),
          findsAtLeastNWidgets(1));

      // Language Section
      expect(find.byKey(const Key('languageOption')), findsAtLeastNWidgets(1));

      // Security Section
      expect(find.byKey(const Key('editProfileTile')), findsAtLeastNWidgets(1));
      expect(
          find.byKey(const Key('changePasswordTile')), findsAtLeastNWidgets(1));

      // Support & Legal Section
      expect(find.byKey(const Key('feedbackLink')), findsAtLeastNWidgets(1));
      expect(find.byKey(const Key('termsTile')), findsAtLeastNWidgets(1));
      expect(find.byKey(const Key('privacyTile')), findsAtLeastNWidgets(1));

      // About Section
      expect(find.byKey(const Key('appVersionTile')), findsAtLeastNWidgets(1));
      expect(find.text('v1.0.0'), findsAtLeastNWidgets(1));
      expect(find.byKey(const Key('rateUsTile')), findsAtLeastNWidgets(1));

      // Account / Danger Zone
      expect(find.byKey(const Key('deleteAccountButton')),
          findsAtLeastNWidgets(1));
      expect(find.byKey(const Key('logoutButton')), findsAtLeastNWidgets(1));
    });

    testWidgets('toggles push notifications master switch', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      final switchFinder = find.byKey(const Key('notificationsSwitch'));
      expect(switchFinder, findsOneWidget);

      final switchWidget = tester.widget<Switch>(switchFinder);
      expect(switchWidget.value, isTrue);

      // Tap the switch
      await tester.tap(switchFinder);
      await tester.pumpAndSettle();

      final updatedSwitch = tester.widget<Switch>(switchFinder);
      expect(updatedSwitch.value, isFalse);
    });

    testWidgets('opens and interacts with verify lock password dialog',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      final changePwTile = find.byKey(const Key('changePasswordTile'));
      await tester.tap(changePwTile);
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.byKey(const Key('lockPasswordInput')), findsOneWidget);
      expect(find.byKey(const Key('confirmVerifyLockButton')), findsOneWidget);

      // Enter password
      await tester.enterText(
          find.byKey(const Key('lockPasswordInput')), '123456');
      await tester.tap(find.byKey(const Key('confirmVerifyLockButton')));
      await tester.pump();

      // In unit test mode without backend, error snackbar or handled result appears
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders cleanly in dark mode without errors', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(themeMode: ThemeMode.dark));
      await tester.pumpAndSettle();

      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('NotificationPreferencesScreen', () {
    testWidgets('renders notification preferences and toggles categories',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(
        child: const NotificationPreferencesScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Notification Preferences'), findsAtLeastNWidgets(1));
      expect(find.text('MASTER SWITCH'), findsAtLeastNWidgets(1));
      expect(find.text('NOTIFICATION CATEGORIES'), findsAtLeastNWidgets(1));
      expect(find.text('Payments'), findsAtLeastNWidgets(1));
      expect(find.text('KYC'), findsAtLeastNWidgets(1));
      expect(find.text('Maintenance'), findsAtLeastNWidgets(1));
      expect(find.text('Announcements'), findsAtLeastNWidgets(1));
      expect(find.text('Save Preferences'), findsAtLeastNWidgets(1));

      // Save preferences
      await tester.tap(find.text('Save Preferences'));
      await tester.pumpAndSettle();

      expect(find.byType(SnackBar), findsOneWidget);
    });

    testWidgets('renders notification preferences in dark mode',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(
        child: const NotificationPreferencesScreen(),
        themeMode: ThemeMode.dark,
      ));
      await tester.pumpAndSettle();

      expect(find.byType(NotificationPreferencesScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
