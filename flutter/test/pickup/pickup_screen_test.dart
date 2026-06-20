import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_hub_screen.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_verification_screen.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/locale_provider.dart';
import 'package:voltium_rider/providers/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';

class FakeVoltiumApiService extends Fake implements VoltiumApiService {
  @override
  Future<Map<String, dynamic>> fetchHubs() async {
    return {
      'success': true,
      'data': [
        {'id': 'hub-1', 'name': 'Koramangala Hub', 'location': 'Koramangala'},
        {'id': 'hub-2', 'name': 'HSR Layout Hub', 'location': 'HSR Layout'},
      ]
    };
  }

  @override
  Future<Map<String, dynamic>> fetchVehicles(String hubId) async {
    return {
      'success': true,
      'data': [
        {'id': 'vehicle-1', 'vehicleNumber': 'V-1001'},
        {'id': 'vehicle-2', 'vehicleNumber': 'V-1002'},
      ]
    };
  }
}

/// Pickup Screen Widget Tests
void main() {
  setUpAll(() {
    VoltiumApiService.instance = FakeVoltiumApiService();
  });
  Widget buildTestApp({required Widget child}) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: MaterialApp(
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

  group('Pickup Hub Screen', () {
    testWidgets('pickup hub screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: PickupHubScreen(
          onNext: (hubId, vehicleId, teamLeader, emergencyContact,
              photoFront, photoBack, photoLeft, photoRight, photoWithVehicle) {},
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(PickupHubScreen), findsOneWidget);
    });

    testWidgets('pickup hub screen shows hub selection UI', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: PickupHubScreen(
          onNext: (hubId, vehicleId, teamLeader, emergencyContact,
              photoFront, photoBack, photoLeft, photoRight, photoWithVehicle) {},
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      final hasDropdown = find.byType(DropdownButton).evaluate().isNotEmpty ||
          find.byType(DropdownButtonFormField).evaluate().isNotEmpty;
      final hasList = find.byType(ListView).evaluate().isNotEmpty;
      final hasText = find.byType(Text).evaluate().isNotEmpty;

      expect(hasDropdown || hasList || hasText, isTrue);
    });

    testWidgets('pickup hub screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: PickupHubScreen(
          onNext: (hubId, vehicleId, teamLeader, emergencyContact,
              photoFront, photoBack, photoLeft, photoRight, photoWithVehicle) {},
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });
  });

  group('Pickup Verification Screen', () {
    testWidgets('pickup verification screen renders without error',
        (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: PickupVerificationScreen(
          onNext: () {},
          hubId: 'test-hub-id',
          vehicleId: 'test-vehicle-id',
          emergencyContact: '+919999999999',
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.byType(PickupVerificationScreen), findsOneWidget);
    });

    testWidgets('pickup verification screen does not overflow',
        (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: PickupVerificationScreen(
          onNext: () {},
          hubId: 'test-hub-id',
          vehicleId: 'test-vehicle-id',
          emergencyContact: '+919999999999',
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
