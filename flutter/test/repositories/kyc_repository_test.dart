import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/kyc/data/kyc_repository.dart';

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

class MockFilesRepository extends Mock implements FilesRepository {}

class FakeFile extends Fake implements File {}

class FakeUpdateProfileRequest extends Fake implements UpdateProfileRequest {}

void main() {
  late MockVoltiumApiClient mockApiClient;
  late MockFilesRepository mockFilesRepository;
  late KycRepository repository;

  setUpAll(() {
    registerFallbackValue(FakeFile());
    registerFallbackValue(FakeUpdateProfileRequest());
  });

  setUp(() {
    mockApiClient = MockVoltiumApiClient();
    mockFilesRepository = MockFilesRepository();
    repository = KycRepository(mockApiClient, mockFilesRepository);
  });

  group('KycRepository', () {
    test('uploadDocument calls FilesRepository', () async {
      when(() => mockFilesRepository.uploadFile(any(), any()))
          .thenAnswer((_) async => 'https://example.com/doc.jpg');

      final file = FakeFile();
      final result = await repository.uploadDocument(file, 'AADHAAR');

      expect(result, 'https://example.com/doc.jpg');
      verify(() => mockFilesRepository.uploadFile(file, 'AADHAAR')).called(1);
    });

    test('updateProfile calls putRiderProfile with correct data', () async {
      when(() => mockApiClient.putRiderProfile(any()))
          .thenAnswer((_) async => <String, dynamic>{});

      await repository.updateProfile(
        riderId: 'r123',
        name: 'John Doe',
        email: 'test@example.com',
        address: '123 Street',
        dob: '1990-01-01',
        fatherName: 'Papa Doe',
        motherName: 'Mama Doe',
        bankName: 'Bank',
        accountNumber: '12345678',
        ifscCode: 'IFSC001',
        aadhaarFrontUrl: 'url1',
        aadhaarBackUrl: 'url2',
        panUrl: 'url3',
        selfieUrl: 'url4',
        signatureUrl: 'url5',
      );

      final captured =
          verify(() => mockApiClient.putRiderProfile(captureAny())).captured;
      final req = captured.first as UpdateProfileRequest;
      expect(req.fullName, 'John Doe');
      expect(req.email, 'test@example.com');
      expect(req.currentAddress, '123 Street');
      expect(req.dob, '1990-01-01');
      expect(req.fatherName, 'Papa Doe');
      expect(req.motherName, 'Mama Doe');
      expect(req.bankName, 'Bank');
      expect(req.bankAccount, '12345678');
      expect(req.bankIfsc, 'IFSC001');
      expect(req.aadhaarFront, 'url1');
      expect(req.aadhaarBack, 'url2');
      expect(req.panCard, 'url3');
    });

    group('Form Cache', () {
      const testRiderId = 'test-rider-123';

      setUp(() async {
        await KycRepository.clearFormCache(riderId: testRiderId);
      });

      test('saveFormCache and loadFormCache work correctly', () async {
        final data = {'name': 'John Doe', 'email': 'test@example.com'};

        await KycRepository.saveFormCache(riderId: testRiderId, data: data);
        final cached = await KycRepository.loadFormCache(riderId: testRiderId);

        expect(cached, isNotNull);
        expect(cached!['name'], 'John Doe');
        expect(cached['email'], 'test@example.com');
      });

      test('clearFormCache removes cached data', () async {
        await KycRepository.saveFormCache(
            riderId: testRiderId, data: {'name': 'John Doe'});
        await KycRepository.clearFormCache(riderId: testRiderId);

        final cached = await KycRepository.loadFormCache(riderId: testRiderId);
        expect(cached, isNull);
      });
    });
  });
}
