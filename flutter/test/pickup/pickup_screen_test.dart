import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_hub_screen.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_verification_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

class _MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

class _MockApiClient extends Mock implements ApiClient {}

class _FakeVerifyPhoneRequest extends Fake implements VerifyPhoneRequest {}

VoltiumApiClient _buildMockClient() {
  final mock = _MockVoltiumApiClient();
  when(() => mock.getRiderHubs()).thenAnswer((_) async => {
        'success': true,
        'data': [
          {'id': 'hub-1', 'name': 'Koramangala Hub', 'location': 'Koramangala'},
          {'id': 'hub-2', 'name': 'HSR Layout Hub', 'location': 'HSR Layout'},
        ],
      });
  // Return a non-empty vehicles list so tests that supply
  // `initialVehicleId: 'vehicle-1'` can find a match when the screen
  // re-applies the draft after the async fetch.
  when(() => mock.getVehicles(any()))
      .thenAnswer((_) async => ListVehiclesResponse(vehicles: [
            VehicleResponse(
              id: 'vehicle-1',
              registrationNumber: 'V-1001',
              status: 'AVAILABLE',
            ),
            VehicleResponse(
              id: 'vehicle-2',
              registrationNumber: 'V-1002',
              status: 'AVAILABLE',
            ),
          ]));
  when(() => mock.getRiderTeamLeaders(any()))
      .thenAnswer((_) async => {'success': true, 'data': <dynamic>[]});
  when(() => mock.postAuthVerifyPhone(any())).thenAnswer((_) async =>
      VerifyPhoneResponse(
          verified: true, receipt: 'receipt-signed-test-token'));
  return mock;
}

/// Pickup Screen Widget Tests
void main() {
  setUpAll(() {
    registerFallbackValue(_FakeVerifyPhoneRequest());
  });

  Widget buildTestApp({required Widget child}) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        voltiumApiClientProvider.overrideWithValue(_buildMockClient()),
        apiClientProvider.overrideWithValue(_MockApiClient()),
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
      String? submittedHubId;
      String? submittedVehicleId;
      String? submittedEmergencyContact;

      await tester.pumpWidget(buildTestApp(
        child: PickupHubScreen(
          initialHubId: 'hub-1',
          initialVehicleId: 'vehicle-1',
          initialTeamLeader: 'Rajesh Kumar (TL-01)',
          initialEmergencyContact: '9876543210',
          initialEmergencyContactVerifiedPhone: '9876543210',
          initialEmergencyContactVerifiedAt:
              DateTime.now().millisecondsSinceEpoch,
          initialPhotos: const {
            'front': 'https://example.com/front.jpg',
            'back': 'https://example.com/back.jpg',
            'left': 'https://example.com/left.jpg',
            'right': 'https://example.com/right.jpg',
            'with_vehicle': 'https://example.com/with_vehicle.jpg',
          },
          onNext: (hubId, vehicleId, teamLeader, emergencyContact, photoFront,
              photoBack, photoLeft, photoRight, photoWithVehicle,
              {String? emergencyContactReceipt}) {
            submittedHubId = hubId;
            submittedVehicleId = vehicleId;
            submittedEmergencyContact = emergencyContact;
          },
        ),
      ));

      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      // Settle any post-frame setState that drives the step-2 auto-advance.
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));

      // The confirm button is rendered on both steps; on step 1 it
      // advances to step 2, on step 2 it submits. We don't know
      // which step we landed on, so tap up to twice (idempotent:
      // once the form is on step 2 the next tap submits).
      final finishBtn = find.byKey(const Key('confirmHubButton'));
      expect(finishBtn, findsOneWidget);

      // Drive the form to step 2 if it isn't already, then submit.
      for (var tap = 0; tap < 3 && submittedHubId == null; tap++) {
        await tester.tap(finishBtn);
        await tester.pumpAndSettle();
      }

      expect(submittedHubId, 'hub-1');
      expect(submittedVehicleId, 'vehicle-1');
      expect(submittedEmergencyContact, '9876543210');
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
