import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:voltium_rider/app/router.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/services/cache_service.dart';

import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/features/profile/data/repository_impl.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import 'package:voltium_rider/features/rentals/data/repository_impl.dart';
import 'package:voltium_rider/features/rentals/domain/repository.dart';
import 'package:voltium_rider/features/support/data/repository_impl.dart';
import 'package:voltium_rider/features/wallet/data/repository_impl.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';

import 'package:voltium_rider/features/pickup/presentation/screens/pickup_hub_screen.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_verification_screen.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/legacy/pre_dashboard_screen.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

// â”€â”€ Fakes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class _MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

class _MockApiClient extends Mock implements ApiClient {}

class _FakeVerifyPhoneRequest extends Fake implements VerifyPhoneRequest {}

class _FakeSendOtpRequest extends Fake implements SendOtpRequest {}

class _FakeUpdateProfileRequest extends Fake implements UpdateProfileRequest {}

class _FakeVehicleReturnRequest extends Fake implements VehicleReturnRequest {}

/// Mock build helper. Returns a `VoltiumApiClient` mock that serves the
/// pickup screens the data they need to render the recovery UI.
_StubVoltiumApiClient _buildMockClient({
  String vehicleStatus = 'AVAILABLE',
  bool throwOnFetch = false,
}) {
  final mock = _StubVoltiumApiClient();
  when(() => mock.getRiderHubs()).thenAnswer((invocation) async {
    mock.fetchHubsCalls++;
    if (throwOnFetch) throw Exception('network down');
    return {
      'success': true,
      'data': [
        {'id': 'hub-1', 'name': 'Koramangala Hub', 'isActive': true},
      ],
    };
  });
  when(() => mock.getVehicles(any())).thenAnswer((invocation) async {
    mock.fetchVehiclesCalls++;
    return ListVehiclesResponse(vehicles: [
      VehicleResponse(
        id: 'vehicle-1',
        // PR-13: the generated `VehicleResponse` uses `registrationNumber`
        // (the canonical API field). The screen has a fallback chain
        // `vehicleNumber â†’ registrationNumber â†’ licensePlate` so the
        // mock matches the real server payload here.
        registrationNumber: 'V-1001',
        status: vehicleStatus,
      ),
    ]);
  });
  when(() => mock.getRiderTeamLeaders(any())).thenAnswer((invocation) async {
    return {
      'success': true,
      'data': <dynamic>[],
    };
  });
  when(() => mock.postAuthVerifyPhone(any())).thenAnswer((invocation) async {
    mock.verifyPhoneCalls++;
    return VerifyPhoneResponse(verified: true, receipt: 'rc-integration-1');
  });
  when(() => mock.postRiderSyncPickup(any())).thenAnswer((invocation) async {
    mock.syncPickupCalls++;
    mock.lastSyncPickupPayload =
        Map<String, dynamic>.from(invocation.positionalArguments.first as Map);
    return {'success': true};
  });
  when(() => mock.putRiderProfile(any())).thenAnswer((_) async => {});
  return mock;
}

/// Custom mock that tracks call counts (mocktail doesn't support
/// call-count introspection via verify-counter APIs for typed return
/// values, so we keep a custom subclass for that).
class _StubVoltiumApiClient extends _MockVoltiumApiClient {
  int fetchHubsCalls = 0;
  int fetchVehiclesCalls = 0;
  int verifyPhoneCalls = 0;
  int syncPickupCalls = 0;
  Map<String, dynamic>? lastSyncPickupPayload;
}

/// Lightweight transport mock for the send-OTP call. The pickup hub
/// uses `ApiClient().getWithSWR('/api/rider/legal')`-style ad-hoc
/// requests in some flows; this stubs the `post` and `getWithSWR` paths
/// so the screens don't hit a real network.
class _StubApiClient extends _MockApiClient {
  int sendOtpCalls = 0;

  @override
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    String? idempotencyKey,
    Future<void>? cancelSignal,
  }) async {
    if (path.contains('send-otp')) {
      sendOtpCalls++;
      return {'otp': '123456', 'exists': false};
    }
    return {'success': true};
  }

  @override
  Future<Map<String, dynamic>> getWithSWR(
    String path, {
    Map<String, String>? queryParams,
    Future<void>? cancelSignal,
  }) async {
    return {'success': true};
  }
}

class _MockRiderRepository implements RiderRepository {
  @override
  Future<Map<String, dynamic>> getRiderProfile() async => {
        'data': {
          'id': 'r1',
          'riderId': 'r1',
          'phone': '1234567890',
          'name': 'Test Rider',
          'accountStatus': 'ACTIVE',
          'kycStatus': 'APPROVED',
          'lifecycleStatus': 'PLAN_SELECTED',
          'pickupDone': false,
        }
      };

  @override
  Future<void> registerFCMToken(String token) async {}

  @override
  Future<Map<String, dynamic>> getDeviceDetails() async => {};

  @override
  Future<Map<String, dynamic>> getEarnings() async => {};

  @override
  Future<Map<String, dynamic>> getSettings() async => {};

  @override
  Future<void> syncDeviceData(Map<String, dynamic> data) async {}

  @override
  Future<void> updateRiderProfile(Map<String, dynamic> data) async {}
}

class _MockRentalRepository implements RentalRepository {
  @override
  Future<Map<String, dynamic>> subscribePlan({
    required String planId,
    required String hubId,
    required double securityDeposit,
    String? promoCode,
    String? upiRef,
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> submitVehicleReturn({
    required List<String> photos,
    String? idempotencyKey,
    int? odometer,
    String? odometerPhotoUrl,
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> fetchHubs() async => {};

  @override
  Future<Map<String, dynamic>> fetchVehicles(String hubId) async => {};

  @override
  Future<Map<String, dynamic>> syncPickup({
    required String rentalId,
    required String vehicleId,
    required String bookingId,
    required String hubId,
    required List<String> photos,
  }) async =>
      {};
}

class _MockFilesRepository implements FilesRepository {
  @override
  Future<String> uploadFile(File file, dynamic category) async => 'url';

  @override
  ApiClient get apiClient => throw UnimplementedError();

  @override
  VoltiumApiClient get voltiumApiClient => throw UnimplementedError();

  @override
  Future<String> uploadProfileImage(File file) => throw UnimplementedError();
}

// â”€â”€ Draft seed helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Map<String, Object> _pickupDraftMap() => {
      'hubId': 'hub-1',
      'vehicleId': 'vehicle-1',
      'teamLeader': 'Rajesh Kumar (TL-01)',
      'emergencyContact': '9876543210',
      'photoFront': 'https://cdn.example.com/front.png',
      'photoBack': 'https://cdn.example.com/back.png',
      'photoLeft': 'https://cdn.example.com/left.png',
      'photoRight': 'https://cdn.example.com/right.png',
      'photoWithVehicle': 'https://cdn.example.com/with_vehicle.png',
    };

// Top-level so both groups can reuse them (house pattern: helpers above
// `main()`). `createRouter` builds a full router with provider overrides;
// `buildScreen` builds a bare PickupHubScreen for draft-prefill tests.
//
// PR-13: the screens no longer route through `VoltiumApiService.instance`
// (that shim is now a 1-line delegation to the generated client). Tests
// override the canonical providers â€” `voltiumApiClientProvider` and
// `apiClientProvider` â€” so the screens hit the stub clients we set up
// here instead of the real network. The default mock returns a
// healthy pickup state; tests that need a different state (TAKEN
// vehicle, offline) pass an override below.
_StubVoltiumApiClient _routerStub = _buildMockClient();
_StubApiClient _routerTransport = _StubApiClient();

Widget createRouter() {
  final client = _routerTransport;
  final vClient = _routerStub;

  return ProviderScope(
    overrides: [
      riderRepositoryProvider.overrideWithValue(_MockRiderRepository()),
      rentalRepositoryProvider
          .overrideWithValue(RentalRepositoryImpl(client, vClient)),
      walletRepositoryProvider
          .overrideWithValue(WalletRepositoryImpl(client, vClient)),
      supportRepositoryProvider
          .overrideWithValue(SupportRepositoryImpl(vClient)),
      filesRepositoryProvider
          .overrideWithValue(FilesRepository(client, vClient)),
      voltiumApiClientProvider.overrideWithValue(vClient),
      apiClientProvider.overrideWithValue(client),
    ],
    child: const MaterialApp(
      localizationsDelegates: [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: AppRouter(),
    ),
  );
}

Widget buildScreen({
  String? initialHubId,
  String? initialVehicleId,
  String? initialTeamLeader,
  String? initialEmergencyContact,
  String? initialEmergencyContactVerifiedPhone,
  int? initialEmergencyContactVerifiedAt,
  Map<String, String?> initialPhotos = const {},
  _StubVoltiumApiClient? client,
}) {
  final mock = client ?? _buildMockClient();
  return ProviderScope(
    overrides: [
      voltiumApiClientProvider.overrideWithValue(mock),
      apiClientProvider.overrideWithValue(_StubApiClient()),
    ],
    child: MaterialApp(
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: PickupHubScreen(
        onNext: (hubId, vehicleId, teamLeader, emergencyContact, photoFront,
            photoBack, photoLeft, photoRight, photoWithVehicle,
            {String? emergencyContactReceipt}) {},
        initialHubId: initialHubId,
        initialVehicleId: initialVehicleId,
        initialTeamLeader: initialTeamLeader,
        initialEmergencyContact: initialEmergencyContact,
        initialEmergencyContactVerifiedPhone:
            initialEmergencyContactVerifiedPhone,
        initialEmergencyContactVerifiedAt: initialEmergencyContactVerifiedAt,
        initialPhotos: initialPhotos,
      ),
    ),
  );
}

void main() {
  // mocktail requires explicit fallbacks for typed arguments that
  // appear in `any()`, `captureAny()` and similar matchers.
  setUpAll(() {
    registerFallbackValue(_FakeVerifyPhoneRequest());
    registerFallbackValue(_FakeSendOtpRequest());
    registerFallbackValue(_FakeUpdateProfileRequest());
    registerFallbackValue(_FakeVehicleReturnRequest());
  });

  group('Pickup draft recovery on cold start', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
      AppConstants.isTestModeOverride = true;
    });

    tearDown(() {
      // PR-1 (F-001): reset the test-mode override so it doesn't leak
      // into the next suite.
      AppConstants.isTestModeOverride = false;
    });

    Future<void> seedPickupState() async {
      // Rider cache so the splash restore path has a live rider context.
      await CacheService().cacheRider({'id': 'r1', 'pickupDone': false});
      // Saved auth state + persisted draft (what a killed mid-flow rider
      // would have on disk).
      await CacheService().setString(
          'voltium_saved_auth_state', AuthState.pickupVerification.name);
      await CacheService()
          .setString('voltium_pickup_draft_v1', jsonEncode(_pickupDraftMap()));
    }

    testWidgets(
        'resumes at pickupVerification when the draft is still valid '
        '(vehicle AVAILABLE)', (tester) async {
      // PR-13: the router's revalidate hook reads through
      // `voltiumApiClientProvider` and `apiClientProvider`. The default
      // mock setup in `createRouter` returns a healthy pickup state.
      _routerStub = _buildMockClient();
      _routerTransport = _StubApiClient();
      await seedPickupState();

      await tester.pumpWidget(createRouter());
      await tester.pump(const Duration(seconds: 5));

      expect(find.byType(PickupVerificationScreen), findsOneWidget,
          reason: 'valid draft should resume the verification screen');
    });

    testWidgets(
        'clears the draft and routes to preDashboard when the vehicle is '
        'no longer available', (tester) async {
      // Override the router stub to mark vehicle as TAKEN.
      _routerStub = _buildMockClient(vehicleStatus: 'TAKEN');
      _routerTransport = _StubApiClient();
      await seedPickupState();

      await tester.pumpWidget(createRouter());
      await tester.pump(const Duration(seconds: 5));

      expect(find.byType(PreDashboardScreen), findsOneWidget,
          reason: 'stale draft must not resume the verification screen');
      expect(CacheService().getString('voltium_pickup_draft_v1'), isNull,
          reason: 'stale draft must be cleared from SharedPreferences');

      // Drain the PreDashboardScreen entry animations so no zero-duration
      // FadeUpWidget timers are still pending at teardown.
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
    });

    testWidgets('keeps the draft and resumes when the API is unreachable',
        (tester) async {
      // Offline / network failure: revalidation cannot confirm staleness,
      // so the draft is preserved and the rider resumes their flow â€” the
      // hub screen refetches on load and surfaces any staleness itself.
      _routerStub = _buildMockClient(throwOnFetch: true);
      _routerTransport = _StubApiClient();
      await seedPickupState();

      await tester.pumpWidget(createRouter());
      await tester.pump(const Duration(seconds: 5));

      expect(find.byType(PickupVerificationScreen), findsOneWidget,
          reason: 'offline must not destroy the rider\'s in-progress draft');
      expect(CacheService().getString('voltium_pickup_draft_v1'), isNotNull,
          reason: 'draft must survive a network failure');
    });

    testWidgets(
        'routes to preDashboard and clears a partial draft when the saved '
        'state is pickupVerification but no complete draft exists',
        (tester) async {
      // Rider was killed on the verification screen, but the persisted
      // draft is incomplete (e.g. only a hub id) â€” must not resume a
      // verification screen with empty vehicle data.
      await CacheService().cacheRider({'id': 'r1', 'pickupDone': false});
      await CacheService().setString(
          'voltium_saved_auth_state', AuthState.pickupVerification.name);
      await CacheService().setString('voltium_pickup_draft_v1',
          jsonEncode({'hubId': 'hub-1'})); // no vehicleId â†’ incomplete
      _routerStub = _buildMockClient();
      _routerTransport = _StubApiClient();

      await tester.pumpWidget(createRouter());
      await tester.pump(const Duration(seconds: 5));

      expect(find.byType(PreDashboardScreen), findsOneWidget,
          reason: 'partial draft must not resume the verification screen');
      expect(CacheService().getString('voltium_pickup_draft_v1'), isNull,
          reason: 'partial draft must be cleared');

      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
    });
  });

  group('PickupHubScreen draft prefill', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    testWidgets('restores hub + vehicle + contact selections', (tester) async {
      // PR-13: buildScreen wires the stub into `voltiumApiClientProvider`.
      await tester.pumpWidget(buildScreen(
        initialHubId: 'hub-1',
        initialVehicleId: 'vehicle-1',
        initialTeamLeader: 'Rajesh Kumar (TL-01)',
        initialEmergencyContact: '9876543210',
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      // Vehicle label text comes from the fetched vehicle list (V-1001).
      expect(find.text('V-1001'), findsOneWidget,
          reason: 'restored vehicle id should be re-applied when AVAILABLE');
      // Emergency contact is restored into the field.
      expect(find.text('9876543210'), findsOneWidget);
    });

    testWidgets('does not restore a vehicle that is no longer available',
        (tester) async {
      // PR-13: pass an explicit mock with vehicle=TAKEN so the screen
      // sees the unavailable vehicle.
      final mock = _buildMockClient(vehicleStatus: 'TAKEN');
      await tester.pumpWidget(buildScreen(
        initialHubId: 'hub-1',
        initialVehicleId: 'vehicle-1',
        client: mock,
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('V-1001'), findsNothing,
          reason: 'taken vehicle must not be re-selected');
      expect(find.text('No vehicles available'), findsOneWidget);
    });

    testWidgets('restored photos jump straight to the photo-review step',
        (tester) async {
      // DEBUG-FIX-2026-08-12: the step-2 FINISH SETUP button is also
      // gated on `_isOtpVerified` (the submit guard requires a fresh
      // emergency-contact receipt). The test only restores photos
      // here â€” supply a fresh verified contact so the form can
      // actually advance to step 2.
      //
      // DEBUG-FIX-2026-08-13: `_applyInitialDraft` now requires the
      // full `_isFormValid` (hub + teamLeader + vehicle + OTP + all
      // photos) to auto-advance to step 2. Supply `initialTeamLeader`
      // here as well.
      final freshAt = DateTime.now().millisecondsSinceEpoch;
      await tester.pumpWidget(buildScreen(
        initialHubId: 'hub-1',
        initialVehicleId: 'vehicle-1',
        initialTeamLeader: 'Rajesh Kumar (TL-01)',
        initialEmergencyContact: '9876543210',
        initialEmergencyContactVerifiedPhone: '9876543210',
        initialEmergencyContactVerifiedAt: freshAt,
        initialPhotos: {
          'front': 'https://cdn.example.com/front.png',
          'back': 'https://cdn.example.com/back.png',
          'left': 'https://cdn.example.com/left.png',
          'right': 'https://cdn.example.com/right.png',
          'with_vehicle': 'https://cdn.example.com/with_vehicle.png',
        },
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      // With all 5 photos restored the form resumes on step 2 â€” the
      // FINISH SETUP button is the step-2 CTA.
      expect(find.text('FINISH SETUP'), findsOneWidget,
          reason: 'all photos restored â‡’ resume on the photo-review step');
    });

    testWidgets('does not re-apply the draft on a resume-refresh',
        (tester) async {
      // PR-13: keep a reference to the stub so the test can read the
      // call counter (mocktail's `verify(...).called(2)` is awkward).
      final api = _buildMockClient();
      await tester.pumpWidget(buildScreen(
        initialHubId: 'hub-1',
        initialVehicleId: 'vehicle-1',
        client: api,
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('V-1001'), findsOneWidget,
          reason: 'draft applied on first load');
      final vehiclesFetchedAtFirstLoad = api.fetchVehiclesCalls;

      // Background â†’ resume fires the lifecycle observer, which refetches
      // hubs. The one-shot draft guard must prevent the draft from being
      // re-applied (and its vehicle refetched) on this second load.
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(api.fetchVehiclesCalls, vehiclesFetchedAtFirstLoad,
          reason: 'resume-refresh must not re-apply the restored vehicle');
      expect(find.text('V-1001'), findsOneWidget,
          reason: 'vehicle selection preserved across resume');
    });
  });

  group('Emergency-contact OTP receipt (PR-PICKUP-OTP)', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
      AppConstants.isTestModeOverride = true;
    });

    tearDown(() {
      // PR-1 (F-001): reset the test-mode override so it doesn't leak
      // into the next suite.
      AppConstants.isTestModeOverride = false;
    });

    testWidgets('markEmergencyContactVerified persists a short-lived receipt',
        (tester) async {
      // Seed a full draft so the router lands on pickupVerification (the
      // pre-dashboard path would leave entry-animation timers pending at
      // teardown â€” the house pattern seeds a complete draft instead).
      await CacheService().cacheRider({'id': 'r1', 'pickupDone': false});
      await CacheService().setString(
          'voltium_saved_auth_state', AuthState.pickupVerification.name);
      await CacheService()
          .setString('voltium_pickup_draft_v1', jsonEncode(_pickupDraftMap()));
      await tester.pumpWidget(createRouter());
      await tester.pump(const Duration(seconds: 5));

      // Reach the private router state via dynamic dispatch (house pattern
      // for testing the router's public pickup-draft surface).
      final state = tester.state(find.byType(AppRouter)) as dynamic;
      expect(state.hasFreshEmergencyContactVerification, isFalse,
          reason: 'no receipt yet â‡’ nothing fresh');

      state.markEmergencyContactVerified('9876543210');

      // The receipt rides inside the draft blob so it survives the same
      // kill/restore lifecycle as the rest of the pickup state.
      final blob =
          jsonDecode(CacheService().getString('voltium_pickup_draft_v1')!)
              as Map<String, dynamic>;
      expect(blob['emergencyVerifiedPhone'], '9876543210');
      final at = int.tryParse(blob['emergencyVerifiedAt'] as String);
      expect(at, isNotNull, reason: 'epoch-ms receipt timestamp persisted');
      expect(state.hasFreshEmergencyContactVerification, isTrue,
          reason: 'just-verified receipt is inside the validity window');
    });

    testWidgets(
        'restored fresh receipt auto-verifies the contact so the rider '
        'does not re-verify', (tester) async {
      final freshAt = DateTime.now().millisecondsSinceEpoch;
      await tester.pumpWidget(buildScreen(
        initialHubId: 'hub-1',
        initialVehicleId: 'vehicle-1',
        initialEmergencyContact: '9876543210',
        initialEmergencyContactVerifiedPhone: '9876543210',
        initialEmergencyContactVerifiedAt: freshAt,
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Emergency contact verified successfully'),
          findsAtLeastNWidgets(1),
          reason:
              'fresh receipt for the restored contact skips re-verification');
    });

    testWidgets('expired receipt forces re-verification', (tester) async {
      final expiredAt = DateTime.now().millisecondsSinceEpoch -
          AppConstants.emergencyContactVerificationWindow.inMilliseconds -
          5 * 60 * 1000; // 5 min past the window
      await tester.pumpWidget(buildScreen(
        initialHubId: 'hub-1',
        initialVehicleId: 'vehicle-1',
        initialEmergencyContact: '9876543210',
        initialEmergencyContactVerifiedPhone: '9876543210',
        initialEmergencyContactVerifiedAt: expiredAt,
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Emergency contact verified successfully'), findsNothing,
          reason: 'an expired receipt must not skip re-verification');
    });

    testWidgets('receipt for a different phone forces re-verification',
        (tester) async {
      final freshAt = DateTime.now().millisecondsSinceEpoch;
      await tester.pumpWidget(buildScreen(
        initialHubId: 'hub-1',
        initialVehicleId: 'vehicle-1',
        initialEmergencyContact: '9876543210',
        // Receipt was issued for a different number â€” the rider edited the
        // contact after verifying, so the old proof is inert.
        initialEmergencyContactVerifiedPhone: '9999000000',
        initialEmergencyContactVerifiedAt: freshAt,
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Emergency contact verified successfully'), findsNothing,
          reason: 'a receipt for another number must not verify this contact');
    });

    testWidgets(
        'signed receipt survives persist and is forwarded to the '
        'verification screen', (tester) async {
      // Forward path: updatePickupData(emergencyContactReceipt:) persists
      // the signed receipt inside the draft blob.
      await CacheService().cacheRider({'id': 'r1', 'pickupDone': false});
      await CacheService().setString(
          'voltium_saved_auth_state', AuthState.pickupVerification.name);
      await CacheService().setString(
          'voltium_pickup_draft_v1',
          jsonEncode(
              {..._pickupDraftMap(), 'emergencyContactReceipt': 'rc-abc123'}));

      await tester.pumpWidget(createRouter());
      await tester.pump(const Duration(seconds: 5));

      // Restored from the blob and handed to the submit screen, so the
      // final syncPickup carries the server-issued HMAC receipt.
      final verificationScreen = tester.widget<PickupVerificationScreen>(
        find.byType(PickupVerificationScreen),
      );
      expect(verificationScreen.emergencyContactReceipt, 'rc-abc123',
          reason: 'the persisted signed receipt must reach the submit screen');

      // The router re-persists on submit-navigation; the receipt must not
      // be dropped by the updatePickupData round-trip.
      final state = tester.state(find.byType(AppRouter)) as dynamic;
      state.updatePickupData(
        hubId: 'hub-1',
        vehicleId: 'vehicle-1',
        teamLeader: 'Rajesh Kumar (TL-01)',
        emergencyContact: '9876543210',
        emergencyContactReceipt: 'rc-abc123',
        photoFront: null,
        photoBack: null,
        photoLeft: null,
        photoRight: null,
        photoWithVehicle: null,
      );
      final blob =
          jsonDecode(CacheService().getString('voltium_pickup_draft_v1')!)
              as Map<String, dynamic>;
      expect(blob['emergencyContactReceipt'], 'rc-abc123',
          reason: 'the signed receipt rides the draft blob across a kill');
    });
  });

  group('Full pickup resume loop (PR-PICKUP-OTP integration)', () {
    late _StubApiClient transport;
    late _StubVoltiumApiClient service;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
      AppConstants.isTestModeOverride = true;
      // PR-13: the screens read through `voltiumApiClientProvider`
      // and `apiClientProvider`. The router helper wires the stubs
      // in, but the test reads call counters directly so we capture
      // local handles. The send-OTP flow constructs `ApiClient()` +
      // `VoltiumApiClient(ApiClient())` fresh (no `ref` available in
      // that closure), so we also install the stub as the shared
      // `ApiClient.instanceForTest` so the `ApiClient()` factory
      // returns it.
      transport = _StubApiClient();
      service = _buildMockClient();
      _routerStub = service;
      _routerTransport = transport;
      ApiClient.instanceForTest = transport;
    });

    tearDown(() {
      ApiClient.instanceForTest = null;
      // PR-1 (F-001): reset the test-mode override so it doesn't leak
      // into the next suite.
      AppConstants.isTestModeOverride = false;
    });

    Future<void> seedHubDraft() async {
      // Rider cache so the splash restore has a live rider context; saved
      // state pickupHub + a draft WITHOUT photos or receipt â€” the form
      // resumes on step 1 where the OTP UI is reachable.
      await CacheService().cacheRider({'id': 'r1', 'pickupDone': false});
      await CacheService()
          .setString('voltium_saved_auth_state', AuthState.pickupHub.name);
      await CacheService().setString(
          'voltium_pickup_draft_v1',
          jsonEncode({
            'hubId': 'hub-1',
            'vehicleId': 'vehicle-1',
            'teamLeader': 'Rajesh Kumar (TL-01)',
            'emergencyContact': '9876543210',
          }));
    }

    testWidgets(
        'verify OTP â†’ kill â†’ resume without re-verify â†’ submit syncPickup '
        'with the signed receipt', (tester) async {
      // â”€â”€ Phase 1: drive the emergency-contact OTP UI on the hub form â”€â”€
      await seedHubDraft();
      await tester.pumpWidget(createRouter());
      await tester.pump(const Duration(seconds: 5));
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(PickupHubScreen), findsOneWidget);
      expect(find.text('V-1001'), findsOneWidget,
          reason: 'draft vehicle must be restored');
      expect(find.text('9876543210'), findsOneWidget,
          reason: 'draft emergency contact must be restored');

      await tester.ensureVisible(find.text('SEND OTP'));
      await tester.tap(find.text('SEND OTP'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(transport.sendOtpCalls, 1,
          reason: 'send-OTP must hit the fake transport');

      await tester.enterText(find.byKey(const Key('otpInputField')), '123456');
      await tester.pump();
      // ONBOARDING-AUDIT 2026-08-14 P0-3: OtpGrid now auto-submits
      // when all 6 digits are entered (onCompleted callback). The
      // verify flow is therefore kicked off by the 6th digit and the
      // explicit "Verify" button is no longer on screen by the time
      // we'd try to tap it. Wait for the auto-submit's pump to
      // settle, then assert the fake transport saw exactly one
      // verifyPhone call (no double-submit).
      await tester.pump(const Duration(seconds: 1));

      expect(service.verifyPhoneCalls, 1,
          reason:
              'verify-OTP must hit the fake service exactly once (P0-3 auto-submit + P1-3 handler guard)');
      expect(find.text('Emergency contact verified successfully'),
          findsAtLeastNWidgets(1),
          reason: 'verified chip must appear after a server-confirmed OTP');

      var blob =
          jsonDecode(CacheService().getString('voltium_pickup_draft_v1')!)
              as Map<String, dynamic>;
      expect(blob['emergencyContactReceipt'], 'rc-integration-1',
          reason:
              'the signed receipt must be persisted atomically with the marker');
      expect(blob['emergencyVerifiedPhone'], '9876543210');

      // â”€â”€ Phase 2: kill app â†’ resume â†’ no re-verification â”€â”€
      // Tear the tree down first so the next pump is a genuine cold start
      // (a same-structure pumpWidget reuses the AppRouter State, which would
      // not exercise the SharedPreferences restore path).
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(createRouter());
      await tester.pump(const Duration(seconds: 5));
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(PickupHubScreen), findsOneWidget);
      expect(find.text('Emergency contact verified successfully'),
          findsAtLeastNWidgets(1),
          reason:
              'fresh receipt must restore the verified chip without re-verifying');
      expect(transport.sendOtpCalls, 1,
          reason: 'resume must not re-send the OTP');
      expect(service.verifyPhoneCalls, 1,
          reason: 'resume must not re-verify the contact');

      // â”€â”€ Phase 3: complete the draft (photo-step outcome via the router's
      // public updatePickupData â€” the exact call the hub onNext performs) and
      // drive the REAL FINISH SETUP to reach the verification screen â”€â”€
      final state = tester.state(find.byType(AppRouter)) as dynamic;
      state.updatePickupData(
        hubId: 'hub-1',
        vehicleId: 'vehicle-1',
        teamLeader: 'Rajesh Kumar (TL-01)',
        emergencyContact: '9876543210',
        photoFront: 'https://cdn.example.com/front.png',
        photoBack: 'https://cdn.example.com/back.png',
        photoLeft: 'https://cdn.example.com/left.png',
        photoRight: 'https://cdn.example.com/right.png',
        photoWithVehicle: 'https://cdn.example.com/with_vehicle.png',
      );

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(createRouter());
      await tester.pump(const Duration(seconds: 5));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('FINISH SETUP'), findsOneWidget,
          reason: 'restored photos jump to the photo-review step');

      await tester.tap(find.text('FINISH SETUP'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(PickupVerificationScreen), findsOneWidget);

      var verificationScreen = tester.widget<PickupVerificationScreen>(
        find.byType(PickupVerificationScreen),
      );
      expect(verificationScreen.emergencyContactReceipt, 'rc-integration-1',
          reason:
              'a resumed rider re-submitting must not drop the signed receipt');

      // â”€â”€ Phase 4: kill again â†’ resume lands directly on the verification
      // screen with the receipt, never bounced back to the form â”€â”€
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(createRouter());
      await tester.pump(const Duration(seconds: 5));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(PickupVerificationScreen), findsOneWidget);
      expect(find.byType(PickupHubScreen), findsNothing,
          reason: 'resume must not bounce back to the hub form');
      verificationScreen = tester.widget<PickupVerificationScreen>(
        find.byType(PickupVerificationScreen),
      );
      expect(verificationScreen.emergencyContactReceipt, 'rc-integration-1',
          reason:
              'the receipt rides the draft across a kill to the submit screen');
      expect(find.text('Vehicle photos captured'), findsOneWidget);

      // â”€â”€ Phase 5: submit syncPickup with the fake API â”€â”€
      await tester.tap(find.byKey(const Key('rentalAgreementCheckbox')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('completePickupButton')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(service.syncPickupCalls, 1,
          reason: 'the submit button must call syncPickup');
      expect(service.lastSyncPickupPayload!['emergencyContactReceipt'],
          'rc-integration-1',
          reason: 'the signed receipt must reach the server payload');
      expect(service.lastSyncPickupPayload!['vehicleId'], 'vehicle-1');
      expect(service.lastSyncPickupPayload!['hubId'], 'hub-1');
      expect(service.lastSyncPickupPayload!['emergencyContact'], '9876543210');
      expect(service.lastSyncPickupPayload!['pickupPhotoFront'],
          'https://cdn.example.com/front.png');

      // Drain entry animations on the post-submit screen.
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
    });
  });
}
