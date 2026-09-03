import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart'
    show authRepositoryProvider;
import 'package:voltium_rider/features/auth/domain/repository.dart';
import 'package:voltium_rider/features/auth/domain/entity.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import 'package:voltium_rider/features/support/presentation/providers/ticket_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart'
    show filesRepositoryProvider;
import 'package:voltium_rider/features/profile/domain/repository.dart';
import 'package:voltium_rider/features/rentals/domain/repository.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/services/cache_service.dart';

/// PR-A (§4.1): on logout the ticket list and the guarantor form state must
/// not survive to the next rider on a shared device (audit #4 P0-1).
/// Stubs the server logout call so `RiderNotifier.logout()` never hits the
/// real network inside the test (which would race the teardown and leave the
/// cross-account resets un-run).
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
          'id': '1',
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
}

class _MockRentalRepository implements RentalRepository {
  @override
  Future<Map<String, dynamic>> submitVehicleReturn({
    required List<String> photos,
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> fetchHubs() async => {};

  @override
  Future<Map<String, dynamic>> fetchVehicles(String hubId) async => {};

  @override
  Future<Map<String, dynamic>> subscribePlan({
    required String planId,
    required String paymentMethod,
    required String riderId,
    required String hubId,
    required double securityDeposit,
    String? promoCode,
    String? upiRef,
  }) async =>
      {};

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

/// Keeps `SupportTicketsNotifier.build`'s auto-fetch off the network so the
/// reset/logout contract under test isn't racing a real HTTP call.
class _NoopTicketsNotifier extends SupportTicketsNotifier {
  @override
  Future<void> fetchTickets() async {}
}

void main() {
  late _MockRiderRepository riderRepo;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await CacheService().init();
    riderRepo = _MockRiderRepository();
  });

  ProviderContainer createContainer() {
    return ProviderContainer(
      overrides: [
        riderRepositoryProvider.overrideWithValue(riderRepo),
        rentalRepositoryProvider.overrideWithValue(_MockRentalRepository()),
        filesRepositoryProvider.overrideWithValue(_MockFilesRepository()),
        authRepositoryProvider.overrideWithValue(_MockAuthRepository()),
        supportTicketsProvider.overrideWith(() => _NoopTicketsNotifier()),
      ],
    );
  }

  group('GuarantorOnboardingNotifier.reset', () {
    test('clears every field back to the pristine state', () {
      final container = createContainer();
      addTearDown(container.dispose);

      final notifier =
          container.read(guarantorOnboardingNotifierProvider.notifier);
      notifier.setStep(2);
      notifier.setPhoneVerified(true, '9999999999');
      notifier.updateDocument('pan', '/tmp/pan.png');
      notifier.updateDocument('aadhaar_front', '/tmp/af.png');

      var state = container.read(guarantorOnboardingNotifierProvider);
      expect(state.currentStep, 2);
      expect(state.isPhoneVerified, isTrue);
      expect(state.panUploaded, isTrue);

      notifier.reset();

      state = container.read(guarantorOnboardingNotifierProvider);
      expect(state.currentStep, 1);
      expect(state.isPhoneVerified, isFalse);
      expect(state.verifiedGuarantorPhone, isEmpty);
      expect(state.panUploaded, isFalse);
      expect(state.aadhaarFrontUploaded, isFalse);
    });
  });

  group('SupportTicketsNotifier.reset', () {
    test('clears tickets and filter on logout', () {
      final container = createContainer();
      addTearDown(container.dispose);

      final notifier = container.read(supportTicketsProvider.notifier);
      notifier.setFilter(TicketFilter.open);
      expect(container.read(supportTicketsProvider).filter, TicketFilter.open);

      notifier.reset();

      final state = container.read(supportTicketsProvider);
      expect(state.tickets, isEmpty);
      expect(state.filter, TicketFilter.all);
      expect(state.isLoading, isFalse);
    });
  });

  group('RiderNotifier.logout', () {
    test('resets guarantor + ticket notifiers so rider B sees no rider A data',
        () async {
      final container = createContainer();
      addTearDown(container.dispose);

      final riderNotifier = container.read(riderProvider.notifier);
      riderNotifier.updateCredentials(riderId: '1', phone: '1234567890');
      await riderNotifier.init();
      expect(container.read(riderProvider).rider, isNotNull);

      // Rider A fills the guarantor form and sets a ticket filter.
      final guarantor =
          container.read(guarantorOnboardingNotifierProvider.notifier);
      guarantor.setStep(3);
      guarantor.setPhoneVerified(true, '9876543210');
      guarantor.updateDocument('pan', '/tmp/riderA_pan.png');
      container.read(supportTicketsProvider.notifier).setFilter(
            TicketFilter.assigned,
          );

      // Seed rider cache to test that logout purges persisted credentials (F-08).
      await CacheService().cacheRider({'id': '1', 'name': 'Test Rider'});
      expect(CacheService().getCachedRider(), isNotNull);

      // Rider A logs out. Awaited so the resets are guaranteed complete
      // before we assert rider B's pristine view (the method awaits the
      // server logout call before resetting local notifiers).
      await riderNotifier.logout();

      // Rider B's view is pristine.
      final gState = container.read(guarantorOnboardingNotifierProvider);
      expect(gState.currentStep, 1);
      expect(gState.isPhoneVerified, isFalse);
      expect(gState.panPath, isNull);

      final tState = container.read(supportTicketsProvider);
      expect(tState.tickets, isEmpty);
      expect(tState.filter, TicketFilter.all);

      // And the rider itself is fully cleared.
      final riderState = container.read(riderProvider);
      expect(riderState.rider, isNull);
      expect(riderState.riderId, isNull);
      expect(riderState.phone, isNull);

      // And the rider cache is fully cleared (F-08).
      expect(CacheService().getCachedRider(), isNull);
    });
  });
}
