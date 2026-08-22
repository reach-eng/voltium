import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/active_dashboard_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

class _TestRiderNotifier extends RiderNotifier {
  final RiderModel? _initialRider;
  _TestRiderNotifier([this._initialRider]);

  @override
  RiderState build() {
    return RiderState(
      rider: _initialRider,
      riderId: _initialRider?.riderId.isNotEmpty == true
          ? _initialRider!.riderId
          : _initialRider?.id,
      phone: _initialRider?.phone,
      dataState: _initialRider != null ? DataState.fresh : DataState.initial,
    );
  }
}

// AUDIT FIX: `EngagementNotifier` was renamed to `EngagementProvider`
// (Riverpod v3 Notifier); the stub must extend the current class or the
// test file fails to compile (same fix as the notifications comprehensive
// test).
class _StubEngagementNotifier extends EngagementProvider {
  @override
  EngagementState build() => const EngagementState();

  @override
  Future<void> initEngagementData() async {}
}

Widget buildTestApp(
    {RiderModel? rider, ThemeMode themeMode = ThemeMode.light}) {
  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith(() => LocaleProvider()),
      themeProviderRef.overrideWith(() => ThemeProvider()),
      riderProvider.overrideWith(() => _TestRiderNotifier(rider)),
      engagementProvider.overrideWith(_StubEngagementNotifier.new),
    ],
    child: MaterialApp(
      themeMode: themeMode,
      theme: ThemeData.light(),
      darkTheme: ThemeData.dark(),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: const ActiveDashboardScreen(),
    ),
  );
}

void main() {
  group('Active Dashboard Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(ActiveDashboardScreen), findsOneWidget);
    });

    testWidgets('does not throw on first frame', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();

      expect(tester.takeException(), isNull);
    });

    testWidgets('shows skeleton when no rider data', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(milliseconds: 200));

      // When rider is null, DashboardSkeleton is shown
      expect(find.byType(ActiveDashboardScreen), findsOneWidget);
    });

    testWidgets('renders all cards with populated rider data', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final testRider = RiderModel(
        id: 'rider-123',
        riderId: 'R-123',
        name: 'Aarav Sharma',
        phone: '+919876543210',
        assignedVehicle: 'VOLT-9021',
        currentPlan: 'WEEKLY_UNLIMITED',
        walletBalance: 1500.0,
        referralCode: 'AARAV2026',
        teamLeader: 'Vikram Singh',
        teamLeaderPhone: '+919811122233',
        emergencyContact: '+919999999999',
        lifecycleStatus: 'ACTIVE',
        pickupDone: true,
      );

      await tester.pumpWidget(buildTestApp(rider: testRider));
      await tester.pumpAndSettle();

      // Check header greeting display name
      expect(find.text('Aarav'), findsOneWidget);

      // Check Vehicle Assignment
      expect(find.text('VOLT-9021'), findsOneWidget);

      // Check Team Leader Name
      expect(find.text('Vikram Singh'), findsOneWidget);
      expect(find.text('Assigned TL'), findsOneWidget);

      // Check Referral Code
      expect(find.text('AARAV2026'), findsOneWidget);
    });

    testWidgets(
        'Team Leader View Details opens bottom sheet with teamLeaderPhone',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final testRider = RiderModel(
        id: 'rider-123',
        riderId: 'R-123',
        name: 'Aarav Sharma',
        phone: '+919876543210',
        assignedVehicle: 'VOLT-9021',
        currentPlan: 'WEEKLY_UNLIMITED',
        walletBalance: 1500.0,
        teamLeader: 'Vikram Singh',
        teamLeaderPhone: '+919811122233',
        emergencyContact: '+919999999999',
        lifecycleStatus: 'ACTIVE',
        pickupDone: true,
      );

      await tester.pumpWidget(buildTestApp(rider: testRider));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final viewDetailsButton = find.text('View Details');
      expect(viewDetailsButton, findsOneWidget);
      await tester.tap(viewDetailsButton);
      await tester.pumpAndSettle();

      // Ensure the sheet renders teamLeaderPhone and NOT emergencyContact
      expect(find.text('+919811122233'), findsOneWidget);
      expect(find.text('+919999999999'), findsNothing);
      expect(find.byKey(const Key('callTeamLeaderButton')), findsOneWidget);
      expect(find.byKey(const Key('changeTeamLeaderButton')), findsOneWidget);
    });

    testWidgets('renders cleanly in dark mode without throwing',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final testRider = RiderModel(
        id: 'rider-123',
        riderId: 'R-123',
        name: 'Aarav Sharma',
        phone: '+919876543210',
        assignedVehicle: 'VOLT-9021',
        currentPlan: 'WEEKLY_UNLIMITED',
        walletBalance: 1500.0,
        teamLeader: 'Vikram Singh',
        teamLeaderPhone: '+919811122233',
        lifecycleStatus: 'ACTIVE',
        pickupDone: true,
      );

      await tester.pumpWidget(
          buildTestApp(rider: testRider, themeMode: ThemeMode.dark));
      await tester.pumpAndSettle();

      expect(find.byType(ActiveDashboardScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
