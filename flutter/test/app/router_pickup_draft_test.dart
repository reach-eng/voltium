/// PR-PICKUP-OTP draft-recovery test suite.
///
/// The production code (post-PR-13) calls the generated `VoltiumApiClient`
/// via the `voltiumApiClientProvider` Riverpod provider, and constructs a
/// fresh `ApiClient()` + `VoltiumApiClient(client)` ad hoc for the send-OTP
/// path. The shim-based `VoltiumApiService.instance` no longer intercepts
/// anything, so this file fakes the typed client directly:
///
///   - `_FakeVoltiumApiClient` (this file) is injected through
///     `voltiumApiClientProvider.overrideWithValue(...)`. It serves the
///     hub/vehicle/team-leader/verify-phone/sync-pickup endpoints with
///     configurable vehicle status and optional network-down behavior.
///   - `_FakeApiClient` (this file) is installed via
///     `ApiClient.instanceForTest` so the screen's ad-hoc
///     `ApiClient()` → `VoltiumApiClient(client).postAuthSendOtp(...)`
///     path is also intercepted without a real network.
library;

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:voltium_rider/app/router.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/services/cache_service.dart';

import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart' as gen;
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import 'package:voltium_rider/features/rentals/data/repository_impl.dart';
import 'package:voltium_rider/features/support/data/repository_impl.dart';
import 'package:voltium_rider/features/wallet/data/repository_impl.dart';

import 'package:voltium_rider/features/pickup/presentation/screens/pickup_hub_screen.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_verification_screen.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/legacy/pre_dashboard_screen.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

// ── Fakes ─────────────────────────────────────────────────────────────────

/// Fake `VoltiumApiClient` injected through `voltiumApiClientProvider` so
/// the hub / vehicle / team-leader / verify-phone / sync-pickup endpoints
/// return canned data without real network. Replaces the legacy
/// `VoltiumApiService.instance` shim (post-PR-13 the production code reads
/// the generated client directly, so the shim never intercepts anything).
class _FakeVoltiumApiClient implements VoltiumApiClient {
  final String vehicleStatus;
  final bool throwOnFetch;

  /// Call counters — used to assert the one-shot draft guard: a resume-
  /// refresh may refetch hubs but must never re-fetch the restored vehicle.
  int fetchHubsCalls = 0;
  int fetchVehiclesCalls = 0;

  // PR-PICKUP-OTP integration-loop recorders.
  int verifyPhoneCalls = 0;
  int syncPickupCalls = 0;
  Map<String, dynamic>? lastSyncPickupPayload;

  _FakeVoltiumApiClient(
      {this.vehicleStatus = 'AVAILABLE', this.throwOnFetch = false});

  @override
  Future<Map<String, dynamic>> getRiderHubs() async {
    fetchHubsCalls++;
    if (throwOnFetch) throw Exception('network down');
    return {
      'success': true,
      'data': [
        {'id': 'hub-1', 'name': 'Koramangala Hub', 'isActive': true},
      ],
    };
  }

  @override
  Future<gen.ListVehiclesResponse> getVehicles(String hubId) async {
    fetchVehiclesCalls++;
    return gen.ListVehiclesResponse(
      vehicles: [
        gen.VehicleResponse(
          id: 'vehicle-1',
          registrationNumber: 'V-1001',
          status: vehicleStatus,
        ),
      ],
      total: 1,
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
  Future<gen.VerifyPhoneResponse> postAuthVerifyPhone(
      gen.VerifyPhoneRequest request) async {
    verifyPhoneCalls++;
    return gen.VerifyPhoneResponse(verified: true, receipt: 'rc-integration-1');
  }

  @override
  Future<Map<String, dynamic>> postRiderSyncPickup(
      Map<String, dynamic> request) async {
    syncPickupCalls++;
    lastSyncPickupPayload = Map<String, dynamic>.from(request);
    return {'success': true};
  }

  // The remaining endpoints on VoltiumApiClient are not exercised by these
  // tests, but `implements` requires a no-op override for each.
  @override
  noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('unhandled fake call: ${invocation.memberName}');
}

/// Fake transport injected via [ApiClient.instanceForTest]. The pickup hub
/// constructs `ApiClient()` + `VoltiumApiClient` fresh for the send-OTP
/// call, so the fake overrides `post` to serve the OTP response without
/// real network (F-025 house pattern, mirrors `VoltiumApiService.instance`).
class _FakeApiClient extends ApiClient {
  _FakeApiClient() : super.testOverride(baseUrl: 'http://test.invalid');

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
      // Unwrapped shape (ApiClient returns the inner `data` map) that
      // SendOtpResponse.fromJson expects.
      return {'otp': '123456', 'exists': false};
    }
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

// ── Draft seed helpers ────────────────────────────────────────────────────

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
// The `_FakeVoltiumApiClient?` parameter lets each test install a
// customised fake (e.g. vehicleStatus=TAKEN, throwOnFetch=true).
// ignore: library_private_types_in_public_api
Widget createRouter({_FakeVoltiumApiClient? apiClient}) {
  final fakeApi = apiClient ?? _FakeVoltiumApiClient();
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);

  return ProviderScope(
    overrides: [
      // Replace the typed API client so every screen-level call
      // (hubs/vehicles/team-leaders/verify-phone/sync-pickup) goes
      // through the fake. The repos below still use a real
      // VoltiumApiClient, but they are not exercised by the draft-recovery
      // tests — the screens bypass them via `ref.read(voltiumApiClientProvider)`.
      voltiumApiClientProvider.overrideWithValue(fakeApi),
      riderRepositoryProvider.overrideWithValue(_MockRiderRepository()),
      rentalRepositoryProvider.overrideWithValue(RentalRepositoryImpl(vClient)),
      walletRepositoryProvider.overrideWithValue(WalletRepositoryImpl(vClient)),
      supportRepositoryProvider
          .overrideWithValue(SupportRepositoryImpl(vClient)),
      filesRepositoryProvider
          .overrideWithValue(FilesRepository(client, vClient)),
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

// ignore: library_private_types_in_public_api
Widget buildScreen({
  String? initialHubId,
  String? initialVehicleId,
  String? initialTeamLeader,
  String? initialEmergencyContact,
  String? initialEmergencyContactVerifiedPhone,
  int? initialEmergencyContactVerifiedAt,
  Map<String, String?> initialPhotos = const {},
  // ignore: library_private_types_in_public_api
  _FakeVoltiumApiClient? apiClient,
}) {
  final fakeApi = apiClient ?? _FakeVoltiumApiClient();
  return ProviderScope(
    overrides: [
      voltiumApiClientProvider.overrideWithValue(fakeApi),
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
  group('Pickup draft recovery on cold start', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
      AppConstants.isTestModeOverride = true;
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
      final api = _FakeVoltiumApiClient();
      await seedPickupState();

      await tester.pumpWidget(createRouter(apiClient: api));
      await tester.pump(const Duration(seconds: 5));

      expect(find.byType(PickupVerificationScreen), findsOneWidget,
          reason: 'valid draft should resume the verification screen');
    });

    testWidgets(
        'clears the draft and routes to preDashboard when the vehicle is '
        'no longer available', (tester) async {
      final api = _FakeVoltiumApiClient(vehicleStatus: 'TAKEN');
      await seedPickupState();

      await tester.pumpWidget(createRouter(apiClient: api));
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
      // so the draft is preserved and the rider resumes their flow — the
      // hub screen refetches on load and surfaces any staleness itself.
      final api = _FakeVoltiumApiClient(throwOnFetch: true);
      await seedPickupState();

      await tester.pumpWidget(createRouter(apiClient: api));
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
      // draft is incomplete (e.g. only a hub id) — must not resume a
      // verification screen with empty vehicle data.
      await CacheService().cacheRider({'id': 'r1', 'pickupDone': false});
      await CacheService().setString(
          'voltium_saved_auth_state', AuthState.pickupVerification.name);
      await CacheService().setString('voltium_pickup_draft_v1',
          jsonEncode({'hubId': 'hub-1'})); // no vehicleId → incomplete

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
      final api = _FakeVoltiumApiClient(vehicleStatus: 'TAKEN');
      await tester.pumpWidget(buildScreen(
        initialHubId: 'hub-1',
        initialVehicleId: 'vehicle-1',
        apiClient: api,
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
      // here — supply a fresh verified contact so the form can
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

      // With all 5 photos restored the form resumes on step 2 — the
      // FINISH SETUP button is the step-2 CTA.
      expect(find.text('FINISH SETUP'), findsOneWidget,
          reason: 'all photos restored ⇒ resume on the photo-review step');
    });

    testWidgets('does not re-apply the draft on a resume-refresh',
        (tester) async {
      final api = _FakeVoltiumApiClient();
      await tester.pumpWidget(buildScreen(
        initialHubId: 'hub-1',
        initialVehicleId: 'vehicle-1',
        apiClient: api,
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('V-1001'), findsOneWidget,
          reason: 'draft applied on first load');
      final vehiclesFetchedAtFirstLoad = api.fetchVehiclesCalls;

      // Background → resume fires the lifecycle observer, which refetches
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

    testWidgets('markEmergencyContactVerified persists a short-lived receipt',
        (tester) async {
      // Seed a full draft so the router lands on pickupVerification (the
      // pre-dashboard path would leave entry-animation timers pending at
      // teardown — the house pattern seeds a complete draft instead).
      final api = _FakeVoltiumApiClient();
      await CacheService().cacheRider({'id': 'r1', 'pickupDone': false});
      await CacheService().setString(
          'voltium_saved_auth_state', AuthState.pickupVerification.name);
      await CacheService()
          .setString('voltium_pickup_draft_v1', jsonEncode(_pickupDraftMap()));
      await tester.pumpWidget(createRouter(apiClient: api));
      await tester.pump(const Duration(seconds: 5));

      // Reach the private router state via dynamic dispatch (house pattern
      // for testing the router's public pickup-draft surface).
      final state = tester.state(find.byType(AppRouter)) as dynamic;
      expect(state.hasFreshEmergencyContactVerification, isFalse,
          reason: 'no receipt yet ⇒ nothing fresh');

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

      expect(
          find.text('Emergency contact verified successfully'), findsOneWidget,
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
        // Receipt was issued for a different number — the rider edited the
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
    late _FakeApiClient transport;
    late _FakeVoltiumApiClient service;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
      AppConstants.isTestModeOverride = true;
      // Reset the singleton BEFORE constructing the fake — the ApiClient
      // factory asserts when a shared instance already exists.
      ApiClient.instanceForTest = null;
      transport = _FakeApiClient();
      ApiClient.instanceForTest = transport;
      service = _FakeVoltiumApiClient();
    });

    tearDown(() {
      ApiClient.instanceForTest = null;
    });

    Future<void> seedHubDraft() async {
      // Rider cache so the splash restore has a live rider context; saved
      // state pickupHub + a draft WITHOUT photos or receipt — the form
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
        'verify OTP → kill → resume without re-verify → submit syncPickup '
        'with the signed receipt', (tester) async {
      // ── Phase 1: drive the emergency-contact OTP UI on the hub form ──
      await seedHubDraft();
      await tester.pumpWidget(createRouter(apiClient: service));
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
      expect(
          find.text('Emergency contact verified successfully'), findsOneWidget,
          reason: 'verified chip must appear after a server-confirmed OTP');

      var blob =
          jsonDecode(CacheService().getString('voltium_pickup_draft_v1')!)
              as Map<String, dynamic>;
      expect(blob['emergencyContactReceipt'], 'rc-integration-1',
          reason:
              'the signed receipt must be persisted atomically with the marker');
      expect(blob['emergencyVerifiedPhone'], '9876543210');

      // ── Phase 2: kill app → resume → no re-verification ──
      // Tear the tree down first so the next pump is a genuine cold start
      // (a same-structure pumpWidget reuses the AppRouter State, which would
      // not exercise the SharedPreferences restore path).
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(createRouter(apiClient: service));
      await tester.pump(const Duration(seconds: 5));
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(PickupHubScreen), findsOneWidget);
      expect(
          find.text('Emergency contact verified successfully'), findsOneWidget,
          reason:
              'fresh receipt must restore the verified chip without re-verifying');
      expect(transport.sendOtpCalls, 1,
          reason: 'resume must not re-send the OTP');
      expect(service.verifyPhoneCalls, 1,
          reason: 'resume must not re-verify the contact');

      // ── Phase 3: complete the draft (photo-step outcome via the router's
      // public updatePickupData — the exact call the hub onNext performs) and
      // drive the REAL FINISH SETUP to reach the verification screen ──
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
      await tester.pumpWidget(createRouter(apiClient: service));
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

      // ── Phase 4: kill again → resume lands directly on the verification
      // screen with the receipt, never bounced back to the form ──
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(createRouter(apiClient: service));
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

      // ── Phase 5: submit syncPickup with the fake API ──
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
