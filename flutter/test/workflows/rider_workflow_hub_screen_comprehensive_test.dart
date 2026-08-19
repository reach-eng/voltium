import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_sos_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/intent_of_use_screen.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/history_screen.dart';
import 'package:voltium_rider/features/workflows/presentation/screens/rider_workflow_hub_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
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

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await CacheService().init();
  });

  Widget buildTestApp({
    ThemeMode themeMode = ThemeMode.light,
    Locale locale = const Locale('en'),
    String riderId = 'rider_test_123',
  }) {
    final mockRider = RiderModel(
      id: riderId,
      riderId: riderId,
      phone: '+919876543210',
      name: 'Voltium Rider',
    );

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
        home: const RiderWorkflowHubScreen(),
      ),
    );
  }

  group('RiderWorkflowHubScreen - Sections & Tiles Verification', () {
    testWidgets('renders all 5 section headers and all 20 tiles',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      // Title
      expect(find.text('Workflow & Services'), findsOneWidget);

      // Section Headings
      expect(find.text('Onboarding & verification'), findsOneWidget);
      expect(find.text('Plan, wallet & deposit'), findsOneWidget);
      expect(find.text('Pickup, rental & return'), findsOneWidget);
      expect(find.text('Support & communication'), findsOneWidget);
      expect(find.text('Profile, legal & safety'), findsOneWidget);

      // Tiles: Section 1
      expect(find.text('Intent of Use'), findsOneWidget);
      expect(find.text('Rider profile'), findsOneWidget);
      expect(find.text('Signature / consent'), findsOneWidget);
      expect(find.text('My Documents'), findsOneWidget);
      expect(find.text('Guarantor details'), findsOneWidget);

      // Tiles: Section 2
      expect(find.text('Choose plan'), findsOneWidget);
      expect(find.text('Top-up / deposit flow'), findsOneWidget);
      expect(find.text('Transaction history'), findsOneWidget);
      expect(find.text('Rewards'), findsOneWidget);
      expect(find.text('Referral Program'), findsOneWidget);

      // Tiles: Section 3
      expect(find.text('Rental details'), findsOneWidget);
      expect(find.text('End rental / return'), findsOneWidget);

      // Tiles: Section 4
      expect(find.text('Support center'), findsOneWidget);
      expect(find.text('Support checklist'), findsOneWidget);
      expect(find.text('FAQ'), findsOneWidget);
      expect(find.text('Troubleshooter'), findsOneWidget);
      expect(find.text('Feedback'), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);

      // Tiles: Section 5
      expect(find.text('Edit Profile'), findsOneWidget);
      expect(find.text('Legal'), findsOneWidget);
      expect(find.text('Emergency SOS'), findsOneWidget);
      expect(find.text('Emergency contacts'), findsOneWidget);
    });

    testWidgets('renders cleanly in dark mode without errors', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(themeMode: ThemeMode.dark));
      await tester.pumpAndSettle();

      expect(find.byType(RiderWorkflowHubScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders properly with Hindi locale', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(locale: const Locale('hi')));
      await tester.pumpAndSettle();

      // Title in Hindi
      expect(find.text('वर्कफ़्लो और सेवाएं'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('RiderWorkflowHubScreen - Navigation Interaction', () {
    testWidgets('tapping Intent of Use navigates to IntentOfUseScreen',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Intent of Use'));
      await tester.pumpAndSettle();

      expect(find.byType(IntentOfUseScreen), findsOneWidget);
    });

    testWidgets('tapping Transaction history navigates with riderId',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(riderId: 'rider_abc_999'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Transaction history'));
      await tester.pumpAndSettle();

      expect(find.byType(HistoryScreen), findsOneWidget);
      final historyScreen =
          tester.widget<HistoryScreen>(find.byType(HistoryScreen));
      expect(historyScreen.riderId, equals('rider_abc_999'));
    });

    testWidgets('tapping Notifications navigates to NotificationsScreen',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Notifications'));
      await tester.pumpAndSettle();

      expect(find.byType(NotificationsScreen), findsOneWidget);
    });

    testWidgets('tapping Emergency SOS navigates to EmergencySOSScreen',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Emergency SOS'));
      await tester.pumpAndSettle();

      expect(find.byType(EmergencySOSScreen), findsOneWidget);
    });
  });
}
