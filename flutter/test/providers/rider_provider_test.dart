import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/providers/rider_provider.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import 'package:voltium_rider/features/rentals/domain/repository.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/app/app_state.dart';

class MockRiderRepository extends Mock implements RiderRepository {}
class MockRentalRepository extends Mock implements RentalRepository {}
class MockFilesRepository extends Mock implements FilesRepository {}

Map<String, dynamic> sampleRiderJson() => {
  'id': 'rider-42',
  'riderId': 'R42',
  'phone': '9999999999',
  'name': 'Test Rider',
  'kycStatus': 'APPROVED',
  'accountStatus': 'ACTIVE',
  'lifecycleStatus': 'ACTIVE',
  'rentalStatus': 'ACTIVE',
  'pickupDone': true,
  'registrationDone': true,
  'depositDone': true,
  'kycDone': true,
  'planDone': true,
  'walletBalance': 100.0,
  'securityDeposit': 500.0,
};

void main() {
  late MockRiderRepository mockRiderRepo;
  late MockRentalRepository mockRentalRepo;
  late MockFilesRepository mockFilesRepo;
  late RiderProvider provider;

  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    registerFallbackValue(File('dummy'));
  });

  setUp(() {
    mockRiderRepo = MockRiderRepository();
    mockRentalRepo = MockRentalRepository();
    mockFilesRepo = MockFilesRepository();
  });

  RiderProvider createProvider({String? riderId, String? phone, RiderModel? initial}) {
    final p = RiderProvider(
      riderId: riderId,
      phone: phone,
      riderRepository: mockRiderRepo,
      rentalRepository: mockRentalRepo,
      filesRepository: mockFilesRepo,
    );
    if (initial != null) {
      p.setRider(initial);
    }
    return p;
  }

  group('initial state', () {
    test('dataState is initial', () {
      provider = createProvider();
      expect(provider.dataState, DataState.initial);
      expect(provider.rider, isNull);
      expect(provider.riderId, isNull);
      expect(provider.phone, isNull);
      expect(provider.isRefreshing, isFalse);
      expect(provider.hasFetchedOnce, isFalse);
      expect(provider.errorMessage, isNull);
    });

    test('constructor accepts riderId and phone', () {
      provider = createProvider(riderId: 'rid-1', phone: '9999999999');
      expect(provider.riderId, 'rid-1');
      expect(provider.phone, '9999999999');
    });
  });

  group('init', () {
    test('does not refresh when riderId and phone are null', () async {
      provider = createProvider();
      await provider.init();
      expect(provider.dataState, DataState.initial);
      expect(provider.rider, isNull);
    });

    test('calls refreshFromApi when riderId is set', () async {
      when(() => mockRiderRepo.getRiderProfile())
          .thenAnswer((_) async => {'data': sampleRiderJson()});

      provider = createProvider(riderId: 'rider-42');
      await provider.init();

      await Future.delayed(Duration.zero);
      verify(() => mockRiderRepo.getRiderProfile()).called(1);
    });
  });

  group('refreshFromApi', () {
    test('early return when riderId and phone are null', () async {
      provider = createProvider();
      await provider.refreshFromApi();
      verifyNever(() => mockRiderRepo.getRiderProfile());
    });

    test('parses rider model on success', () async {
      when(() => mockRiderRepo.getRiderProfile())
          .thenAnswer((_) async => {'data': sampleRiderJson()});

      provider = createProvider(riderId: 'rider-42');
      await provider.refreshFromApi();

      expect(provider.dataState, DataState.fresh);
      expect(provider.rider, isNotNull);
      expect(provider.rider!.name, 'Test Rider');
      expect(provider.rider!.riderId, 'R42');
      expect(provider.isRefreshing, isFalse);
    });

    test('handles response in data/rider/root keys', () async {
      when(() => mockRiderRepo.getRiderProfile())
          .thenAnswer((_) async => {'rider': sampleRiderJson()});

      provider = createProvider(riderId: 'rider-42');
      await provider.refreshFromApi();

      expect(provider.rider, isNotNull);
    });

    test('handles empty payload gracefully', () async {
      when(() => mockRiderRepo.getRiderProfile())
          .thenAnswer((_) async => <String, dynamic>{});

      provider = createProvider(riderId: 'rider-42', initial: RiderModel(
        id: 'old', riderId: 'OLD', phone: '0', name: 'Old',
      ));
      await provider.refreshFromApi();

      expect(provider.dataState, DataState.fromCache);
      expect(provider.errorMessage, 'Failed to fetch profile');
    });

    test('sets error state on exception', () async {
      when(() => mockRiderRepo.getRiderProfile())
          .thenThrow(Exception('Network error'));

      provider = createProvider(riderId: 'rider-42');
      await provider.refreshFromApi();

      expect(provider.dataState, DataState.error);
      expect(provider.errorMessage, contains('Network error'));
      expect(provider.isRefreshing, isFalse);
    });

    test('keeps cached data on error when rider exists', () async {
      when(() => mockRiderRepo.getRiderProfile())
          .thenThrow(Exception('Timeout'));

      provider = createProvider(riderId: 'rider-42', initial: RiderModel(
        id: 'cached', riderId: 'C1', phone: '0', name: 'Cached',
      ));
      await provider.refreshFromApi();

      expect(provider.dataState, DataState.fromCache);
      expect(provider.errorMessage, contains('Timeout'));
    });
  });

  group('updateCredentials', () {
    test('updates riderId', () {
      provider = createProvider();
      provider.updateCredentials(riderId: 'new-id');
      expect(provider.riderId, 'new-id');
    });

    test('updates phone', () {
      provider = createProvider();
      provider.updateCredentials(phone: '1111111111');
      expect(provider.phone, '1111111111');
    });

    test('does not modify unset fields', () {
      provider = createProvider(riderId: 'orig', phone: '2222222222');
      provider.updateCredentials(riderId: 'updated');
      expect(provider.riderId, 'updated');
      expect(provider.phone, '2222222222');
    });
  });

  group('logout', () {
    test('resets all state', () {
      provider = createProvider(riderId: 'rid-1', phone: '9999', initial: RiderModel(
        id: 'r1', riderId: 'R1', phone: '9999', name: 'N',
      ));
      provider.logout();

      expect(provider.rider, isNull);
      expect(provider.riderId, isNull);
      expect(provider.phone, isNull);
      expect(provider.dataState, DataState.initial);
      expect(provider.isRefreshing, isFalse);
      expect(provider.hasFetchedOnce, isFalse);
      expect(provider.errorMessage, isNull);
    });
  });

  group('setRiderId / setRider / updateRider', () {
    test('setRiderId updates id and notifies', () {
      provider = createProvider();
      provider.setRiderId('new-id', phoneNumber: '5555');
      expect(provider.riderId, 'new-id');
      expect(provider.phone, '5555');
    });

    test('setRiderId skips phone when null', () {
      provider = createProvider(phone: 'original');
      provider.setRiderId('new-id');
      expect(provider.riderId, 'new-id');
      expect(provider.phone, 'original');
    });

    test('setRider updates rider and syncs id/phone', () {
      provider = createProvider();
      final rider = RiderModel(
        id: 'r-99', riderId: 'R99', phone: '7777', name: 'Set Rider',
      );
      provider.setRider(rider);
      expect(provider.rider, rider);
      expect(provider.riderId, 'r-99');
      expect(provider.phone, '7777');
    });

    test('updateRider replaces rider', () {
      provider = createProvider();
      final old = RiderModel(
        id: 'r-1', riderId: 'R1', phone: '1111', name: 'Old',
      );
      provider.setRider(old);

      final updated = RiderModel(
        id: 'r-1', riderId: 'R1', phone: '1111', name: 'Updated',
      );
      provider.updateRider(updated);
      expect(provider.rider, updated);
    });
  });

  group('computed properties', () {
    test('isPlanActive true when rentalStatus is ACTIVE', () {
      provider = createProvider(initial: RiderModel(
        id: 'r1', riderId: 'R1', phone: '0', name: 'N',
        rentalStatus: 'ACTIVE',
      ));
      expect(provider.isPlanActive, isTrue);
    });

    test('isPlanActive false when rentalStatus is not ACTIVE', () {
      provider = createProvider(initial: RiderModel(
        id: 'r1', riderId: 'R1', phone: '0', name: 'N',
        rentalStatus: 'NONE',
      ));
      expect(provider.isPlanActive, isFalse);
    });

    test('isKycDone true when kycStatus is approved', () {
      provider = createProvider(initial: RiderModel(
        id: 'r1', riderId: 'R1', phone: '0', name: 'N',
        kycStatus: KycStatus.approved,
      ));
      expect(provider.isKycDone, isTrue);
    });

    test('isKycDone false when kycStatus is not approved', () {
      provider = createProvider(initial: RiderModel(
        id: 'r1', riderId: 'R1', phone: '0', name: 'N',
        kycStatus: KycStatus.pending,
      ));
      expect(provider.isKycDone, isFalse);
    });

    test('isActuallyActive true when accountStatus is active', () {
      provider = createProvider(initial: RiderModel(
        id: 'r1', riderId: 'R1', phone: '0', name: 'N',
        accountStatus: AccountStatus.active,
      ));
      expect(provider.isActuallyActive, isTrue);
    });

    test('isActuallyActive true when lifecycle rank >= 11', () {
      provider = createProvider(initial: RiderModel(
        id: 'r1', riderId: 'R1', phone: '0', name: 'N',
        lifecycleStatus: 'ACTIVE',
        accountStatus: AccountStatus.preActive,
      ));
      expect(provider.isActuallyActive, isTrue);
    });

    test('isActuallyActive false for low lifecycle', () {
      provider = createProvider(initial: RiderModel(
        id: 'r1', riderId: 'R1', phone: '0', name: 'N',
        lifecycleStatus: 'NEW',
        accountStatus: AccountStatus.inactive,
      ));
      expect(provider.isActuallyActive, isFalse);
    });
  });

  group('routeAfterLogin', () {
    test('returns intent for null intent', () {
      provider = createProvider();
      final rider = RiderModel(
        id: 'r1', riderId: 'R1', phone: '0', name: 'N',
        intent: null,
        registrationDone: false,
      );
      expect(provider.routeAfterLogin(rider), AuthState.intent);
    });

    test('returns userForm for KYC not done', () {
      provider = createProvider();
      final rider = RiderModel(
        id: 'r1', riderId: 'R1', phone: '0', name: 'N',
        intent: 'RENT',
        registrationDone: true,
        kycStatus: KycStatus.pending,
      );
      expect(provider.routeAfterLogin(rider), AuthState.userForm);
    });

    test('returns dashboard for fully onboarded', () {
      provider = createProvider();
      final rider = RiderModel(
        id: 'r1', riderId: 'R1', phone: '0', name: 'N',
        intent: 'RENT',
        registrationDone: true,
        kycStatus: KycStatus.approved,
        accountStatus: AccountStatus.active,
        lifecycleStatus: 'ACTIVE',
      );
      expect(provider.routeAfterLogin(rider), AuthState.dashboard);
    });
  });

  group('submitVehicleReturn', () {
    test('returns false when rider id is null', () async {
      provider = createProvider();
      final result = await provider.submitVehicleReturn(photos: []);
      expect(result, isFalse);
    });

    test('uploads photos and submits return', () async {
      when(() => mockFilesRepo.uploadFile(any(), any()))
          .thenAnswer((_) async => 'https://example.com/photo.png');
      when(() => mockRentalRepo.submitVehicleReturn(
        vehicleId: any(named: 'vehicleId'),
        hubId: any(named: 'hubId'),
        photos: any(named: 'photos'),
      )).thenAnswer((_) async => <String, dynamic>{});
      when(() => mockRiderRepo.getRiderProfile())
          .thenAnswer((_) async => {'data': sampleRiderJson()});

      provider = createProvider(riderId: 'rider-42', initial: RiderModel(
        id: 'rider-42', riderId: 'R42', phone: '0', name: 'N',
      ));

      final file = File(
        '${Directory.systemTemp.path}/test_photo.png',
      );
      await file.writeAsBytes([0, 1, 2]);

      final result = await provider.submitVehicleReturn(photos: [file]);
      expect(result, isTrue);
      verify(() => mockFilesRepo.uploadFile(file, 'vehicle_return')).called(1);
      verify(() => mockRentalRepo.submitVehicleReturn(
        vehicleId: any(named: 'vehicleId'),
        hubId: any(named: 'hubId'),
        photos: any(named: 'photos'),
      )).called(1);
    });

    test('returns false on exception', () async {
      when(() => mockFilesRepo.uploadFile(any(), any()))
          .thenThrow(Exception('Upload failed'));

      provider = createProvider(riderId: 'rider-42', initial: RiderModel(
        id: 'rider-42', riderId: 'R42', phone: '0', name: 'N',
      ));

      final file = File(
        '${Directory.systemTemp.path}/test_photo.png',
      );
      await file.writeAsBytes([0, 1, 2]);

      final result = await provider.submitVehicleReturn(photos: [file]);
      expect(result, isFalse);
    });
  });

  group('polling', () {
    test('startOnboardingPoll does not throw', () {
      provider = createProvider();
      expect(() => provider.startOnboardingPoll(), returnsNormally);
    });

    test('startPostPickupPoll does not throw', () {
      provider = createProvider();
      expect(() => provider.startPostPickupPoll(), returnsNormally);
    });

    test('stopPolling does not throw', () {
      provider = createProvider();
      provider.startOnboardingPoll();
      provider.startPostPickupPoll();
      expect(() => provider.stopPolling(), returnsNormally);
    });

    test('setPollingActive does not throw', () {
      provider = createProvider();
      expect(() => provider.setPollingActive(), returnsNormally);
    });

    test('setPollingInactive does not throw', () {
      provider = createProvider();
      expect(() => provider.setPollingInactive(), returnsNormally);
    });
  });
}
