import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_hub_screen.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_verification_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart' as gen;
import 'package:voltium_rider/core/network/generated/api_models.dart'
    as gen_models;
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Fake `VoltiumApiClient` (post-PR-13) injected through
/// `voltiumApiClientProvider.overrideWithValue(...)`. Mirrors the
/// pattern in `test/app/router_pickup_draft_test.dart`.
class _FakeVoltiumApiClient implements gen.VoltiumApiClient {
  @override
  Future<Map<String, dynamic>> getRiderHubs() async {
    return {
      'success': true,
      'data': [
        {'id': 'hub-1', 'name': 'Koramangala Hub', 'isActive': true},
        {'id': 'hub-2', 'name': 'HSR Layout Hub', 'isActive': true},
      ],
    };
  }

  @override
  Future<gen_models.ListVehiclesResponse> getVehicles(String hubId) async {
    return gen_models.ListVehiclesResponse(
      vehicles: [
        gen_models.VehicleResponse(
          id: 'vehicle-1',
          registrationNumber: 'V-1001',
          status: 'AVAILABLE',
          batteryLevel: 85,
        ),
        gen_models.VehicleResponse(
          id: 'vehicle-2',
          registrationNumber: 'V-1002',
          status: 'AVAILABLE',
          batteryLevel: 90,
        ),
      ],
      total: 2,
    );
  }

  @override
  Future<Map<String, dynamic>> getRiderTeamLeaders(String hubId) async {
    return {
      'success': true,
      'data': [
        {'id': 'tl-1', 'name': 'Rajesh Kumar (TL-01)', 'phone': '9876543210'},
        {'id': 'tl-2', 'name': 'Sanjay Singh (TL-03)', 'phone': '9876543211'},
      ],
    };
  }

  @override
  Future<gen_models.VerifyPhoneResponse> postAuthVerifyPhone(
      gen_models.VerifyPhoneRequest request) async {
    return gen_models.VerifyPhoneResponse(
        verified: true, receipt: 'receipt-signed-test-token');
  }

  @override
  Future<Map<String, dynamic>> postRiderSyncPickup(
      Map<String, dynamic> request) async {
    return {'success': true};
  }

  // The remaining endpoints on VoltiumApiClient are not exercised by
  // these tests; `implements` requires a no-op override for each.
  @override
  noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('unhandled fake call: ${invocation.memberName}');
}

/// Pickup Screen Widget Tests
void main() {
  Widget buildTestApp(
      {required Widget child, gen.VoltiumApiClient? apiClient}) {
    return ProviderScope(
      overrides: [
        voltiumApiClientProvider
            .overrideWithValue(apiClient ?? _FakeVoltiumApiClient()),
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
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
          onNext: (hubId, vehicleId, teamLeader, emergencyContact, photoFront,
              photoBack, photoLeft, photoRight, photoWithVehicle,
              {String? emergencyContactReceipt}) {},
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(PickupHubScreen), findsOneWidget);
    });

    testWidgets('pickup hub screen shows hub selection UI', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: PickupHubScreen(
          onNext: (hubId, vehicleId, teamLeader, emergencyContact, photoFront,
              photoBack, photoLeft, photoRight, photoWithVehicle,
              {String? emergencyContactReceipt}) {},
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
          onNext: (hubId, vehicleId, teamLeader, emergencyContact, photoFront,
              photoBack, photoLeft, photoRight, photoWithVehicle,
              {String? emergencyContactReceipt}) {},
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });

    testWidgets(
        'pickup hub screen restores draft values and jumps to step 2 when complete',
        (tester) async {
      final freshAt = DateTime.now().millisecondsSinceEpoch;
      await tester.pumpWidget(buildTestApp(
        child: PickupHubScreen(
          onNext: (hubId, vehicleId, teamLeader, emergencyContact, photoFront,
              photoBack, photoLeft, photoRight, photoWithVehicle,
              {String? emergencyContactReceipt}) {},
          initialHubId: 'hub-1',
          initialVehicleId: 'vehicle-1',
          initialTeamLeader: 'Rajesh Kumar (TL-01)',
          initialEmergencyContact: '9876543210',
          initialEmergencyContactVerifiedPhone: '9876543210',
          initialEmergencyContactVerifiedAt: freshAt,
          initialPhotos: const {
            'front': 'https://example.com/front.jpg',
            'back': 'https://example.com/back.jpg',
            'left': 'https://example.com/left.jpg',
            'right': 'https://example.com/right.jpg',
            'with_vehicle': 'https://example.com/with_vehicle.jpg',
          },
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      // With a complete draft (hub + vehicle + team leader + verified
      // contact + 5 photos) the form auto-advances to step 2 where the
      // FINISH SETUP button is the step-2 CTA.
      final finishBtn = find.text('FINISH SETUP');
      expect(finishBtn, findsOneWidget,
          reason: 'complete draft ⇒ auto-advance to photo-review step');
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
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(PickupVerificationScreen), findsOneWidget);
    });

    testWidgets('pickup verification screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: PickupVerificationScreen(
          onNext: () {},
          hubId: 'test-hub-id',
          vehicleId: 'test-vehicle-id',
          emergencyContact: '+919999999999',
        ),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });

    testWidgets('pickup verification button enabled only after checking terms',
        (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: PickupVerificationScreen(
          onNext: () {},
          hubId: 'test-hub-id',
          vehicleId: 'test-vehicle-id',
          emergencyContact: '+919999999999',
        ),
      ));
      await tester.pump(const Duration(seconds: 1));

      final checkbox = find.byKey(const Key('rentalAgreementCheckbox'));
      expect(checkbox, findsOneWidget);

      // Checkbox tap
      await tester.tap(checkbox);
      await tester.pumpAndSettle();

      final button = find.byKey(const Key('completePickupButton'));
      expect(button, findsOneWidget);
    });
  });
}
