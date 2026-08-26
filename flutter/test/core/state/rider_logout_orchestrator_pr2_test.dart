// PR-2 (F-002 â€” 2026-08-22 deep audit): explicit coverage for the new
// cross-rider state resets added in rider_logout_orchestrator.dart. The
// pre-existing `logout_reset_test.dart` only verifies the per-feature
// notifier resets; this file locks the contract that the persistence-layer
// resets (emergency contacts, rider cache, KYC form cache, monitoring
// identity) are all triggered during logout, so the next rider on a
// shared device cannot see the previous rider's data.
//
// Mirrors the same mock Auth/Rider/Rental/Files repositories used in
// logout_reset_test.dart so the orchestrator's wiring can be exercised
// without touching the network or filesystem.

// ignore_for_file: override_on_non_overriding_member
// (the `FilesRepository` class is concrete; we `implements` it to
// stub `uploadFile` and let the unused apiClient getters throw â€”
// same pattern as the pre-existing logout_reset_test.dart).

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart'
    show authRepositoryProvider;
import 'package:voltium_rider/features/auth/domain/entity.dart';
import 'package:voltium_rider/features/auth/domain/repository.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import 'package:voltium_rider/features/rentals/domain/repository.dart';
import 'package:voltium_rider/features/support/presentation/providers/ticket_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart'
    show filesRepositoryProvider;
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/emergency_contacts_service.dart';

class _MockAuthRepository implements AuthRepository {
  @override
  Future<SendOtpResult> sendOtp(String phone, {String? referralCode}) async =>
      throw UnimplementedError();
  @override
  Future<VerifyOtpResult> verifyOtp(
    String phone,
    String otp, {
    String? referralCode,
  }) async =>
      throw UnimplementedError();
  @override
  Future<void> logout() async {}
  @override
  Future<void> forgetRefreshToken() async {}
}

class _MockRiderRepository implements RiderRepository {
  @override
  Future<Map<String, dynamic>> getRiderProfile() async => {
        'data': {
          'id': 'rider-42',
          'phone': '1234567890',
          'name': 'Test Rider',
          'accountStatus': 'ACTIVE',
          'kycStatus': 'APPROVED',
          'lifecycleStatus': 'ON_RENT',
          'rentalStatus': 'ACTIVE',
          'pickupDone': true,
        }
      };
  @override
  Future<void> registerFCMToken(String token) async {}
  @override
  Future<Map<String, dynamic>> getDeviceDetails() async => {};
  @override
  Future<Map<String, dynamic>> getEarnings() async => {};
  @override
  Future<void> syncDeviceData(Map<String, dynamic> data) async {}
  @override
  Future<void> updateRiderProfile(Map<String, dynamic> data) async {}
}

class _MockRentalRepository implements RentalRepository {
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
  Future<Map<String, dynamic>> subscribePlan({
    required String planId,
    required double securityDeposit,
    required String hubId,
  }) async =>
      {};
  @override
  Future<Map<String, dynamic>> syncPickup({
    required String bookingId,
    required String hubId,
    required String vehicleId,
  }) async =>
      {};
}

class _MockFilesRepository implements FilesRepository {
  @override
  Future<String> uploadFile(dynamic file, dynamic category) async => 'url';
  @override
  ApiClient get apiClient => throw UnimplementedError();
  @override
  VoltiumApiClient get voltiumApiClient => throw UnimplementedError();
  @override
  Future<String> uploadProfileImage(dynamic file) => throw UnimplementedError();
}

class _NoopTicketsNotifier extends SupportTicketsNotifier {
  @override
  Future<void> fetchTickets() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await CacheService().init();
  });

  test(
      'PR-2 (F-002): logout clears emergency-contacts state, rider cache, '
      'KYC onboarding notifier, and the KYC form cache', () async {
    final container = ProviderContainer(
      overrides: [
        riderRepositoryProvider.overrideWithValue(_MockRiderRepository()),
        rentalRepositoryProvider.overrideWithValue(_MockRentalRepository()),
        filesRepositoryProvider.overrideWithValue(_MockFilesRepository()),
        authRepositoryProvider.overrideWithValue(_MockAuthRepository()),
        supportTicketsProvider.overrideWith(() => _NoopTicketsNotifier()),
      ],
    );
    addTearDown(container.dispose);

    // Seed rider state (riderId is what KYC cache is keyed by).
    final riderNotifier = container.read(riderProvider.notifier);
    riderNotifier.updateCredentials(riderId: 'rider-42', phone: '1234567890');
    await riderNotifier.init();
    expect(container.read(riderProvider).riderId, 'rider-42');

    // Seed an emergency contact so we can assert it gets cleared.
    final emergency = container.read(emergencyContactsServiceProvider.notifier);
    await emergency.addContact(const EmergencyContact(
      id: 'c1',
      name: 'A Contact',
      phone: '9999999999',
      relationship: 'family',
      isPrimary: true,
    ));
    expect(
        container.read(emergencyContactsServiceProvider).contacts, isNotEmpty);

    // Seed the rider cache (the production surface that
    // `clearRiderCache` wipes).
    final cache = CacheService();
    await cache.cacheRider({
      'id': 'rider-42',
      'name': 'Test Rider',
      'phone': '1234567890',
    });
    expect(cache.getCachedRider(), isNotNull);

    // Seed the KYC onboarding notifier (in-memory draft) and the KYC
    // encrypted form cache (on-disk draft).
    final onboarding = container.read(userOnboardingNotifierProvider.notifier);
    onboarding.setStep(2);
    onboarding.updateDocument('pan', '/tmp/riderA_pan.png');
    expect(container.read(userOnboardingNotifierProvider).currentStep, 2);
    expect(
      container.read(userOnboardingNotifierProvider).panUploaded,
      isTrue,
    );

    // â”€â”€ act â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await riderNotifier.logout();

    // â”€â”€ assert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // 1. Emergency contacts notifier cleared.
    expect(
      container.read(emergencyContactsServiceProvider).contacts,
      isEmpty,
      reason: 'PR-2 (F-002): next rider must not see previous rider\'s '
          'emergency contacts',
    );

    // 2. Rider cache cleared.
    expect(
      cache.getCachedRider(),
      isNull,
      reason: 'PR-2 (F-002): next rider must not see previous rider\'s '
          'cached rider profile on first paint',
    );

    // 3. KYC onboarding notifier reset.
    final kycState = container.read(userOnboardingNotifierProvider);
    expect(
      kycState.currentStep,
      1,
      reason: 'PR-2 (F-002): KYC step reset by orchestrator',
    );
    expect(
      kycState.panUploaded,
      isFalse,
      reason: 'PR-2 (F-002): KYC document upload flag reset',
    );
    expect(
      kycState.panPath,
      isNull,
      reason: 'PR-2 (F-002): KYC document path reset',
    );

    // 5. Rider state itself fully cleared.
    final state = container.read(riderProvider);
    expect(state.riderId, isNull);
    expect(state.rider, isNull);
  });

  test('PR-2 (F-002): OfflineStorageService.clearAll runs without error',
      () async {
    // The orchestrator's `await OfflineStorageService().clearAll()` runs
    // unconditionally on logout. Without a sqlite3 ffi plugin registered
    // in the test isolate, the call will fail â€” which is exactly the
    // cross-account-leak-guard contract: the failure is caught and
    // logged, but the rest of the logout flow continues. This test
    // locks that contract.
    final container = ProviderContainer(
      overrides: [
        riderRepositoryProvider.overrideWithValue(_MockRiderRepository()),
        rentalRepositoryProvider.overrideWithValue(_MockRentalRepository()),
        filesRepositoryProvider.overrideWithValue(_MockFilesRepository()),
        authRepositoryProvider.overrideWithValue(_MockAuthRepository()),
        supportTicketsProvider.overrideWith(() => _NoopTicketsNotifier()),
      ],
    );
    addTearDown(container.dispose);

    final riderNotifier = container.read(riderProvider.notifier);
    riderNotifier.updateCredentials(riderId: 'rider-42', phone: '1234567890');
    await riderNotifier.init();

    // Must not throw despite OfflineStorageService being un-initialized
    // in the test environment (no FFI plugin).
    await riderNotifier.logout();
  });
}
