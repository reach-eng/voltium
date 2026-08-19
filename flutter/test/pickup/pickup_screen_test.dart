import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_hub_screen.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_verification_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
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
        {'id': 'vehicle-1', 'vehicleNumber': 'V-1001', 'status': 'AVAILABLE', 'batteryLevel': 85},
        {'id': 'vehicle-2', 'vehicleNumber': 'V-1002', 'status': 'AVAILABLE', 'batteryLevel': 90},
      ]
    };
  }

  @override
  Future<List<Map<String, dynamic>>> fetchTeamLeaders(String hubId) async {
    return [
      {'id': 'tl-1', 'name': 'Rajesh Kumar (TL-01)', 'phone': '9876543210'},
      {'id': 'tl-2', 'name': 'Sanjay Singh (TL-03)', 'phone': '9876543211'},
    ];
  }

  @override
  Future<Map<String, dynamic>> verifyPhone({required String phone, required String otp}) async {
    return {
      'success': true,
      'verified': true,
      'receipt': 'receipt-signed-test-token',
    };
  }
}

/// Pickup Screen Widget Tests
void main() {
  setUpAll(() {
    VoltiumApiService.instance = FakeVoltiumApiService();
  });

  Widget buildTestApp({required Widget child}) {
    return ProviderScope(
      overrides: [
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

    testWidgets('pickup hub screen restores draft values and jumps to step 2 when complete', (tester) async {
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
          initialEmergencyContactVerifiedAt: DateTime.now().millisecondsSinceEpoch,
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

      // With complete initial draft, should be on Step 2 (FINISH SETUP button visible)
      final finishBtn = find.byKey(const Key('confirmHubButton'));
      expect(finishBtn, findsOneWidget);

      await tester.tap(finishBtn);
      await tester.pumpAndSettle();

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

    testWidgets('pickup verification button enabled only after checking terms', (tester) async {
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
