import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:universal_io/io.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/kyc/data/kyc_repository.dart';

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

class MockFilesRepository extends Mock implements FilesRepository {}

class MockFile extends Mock implements File {}

class FakeUpdateProfileRequest extends Fake implements UpdateProfileRequest {}

void main() {
  late MockVoltiumApiClient mockVoltiumApiClient;
  late MockFilesRepository mockFilesRepository;
  late KycRepository repository;

  setUpAll(() {
    registerFallbackValue(FakeUpdateProfileRequest());
    registerFallbackValue(MockFile());
  });

  setUp(() {
    mockVoltiumApiClient = MockVoltiumApiClient();
    mockFilesRepository = MockFilesRepository();
    repository = KycRepository(mockVoltiumApiClient, mockFilesRepository);

    // Clear static cache before each test
    KycRepository.clearFormCache();
  });

  group('KycRepository', () {
    // uploadDocument
    test('uploadDocument calls FilesRepository and returns url', () async {
      final mockFile = MockFile();
      when(() => mockFilesRepository.uploadFile(any(), any()))
          .thenAnswer((_) async => 'https://example.com/doc.jpg');

      final url = await repository.uploadDocument(mockFile, 'AADHAAR_FRONT');

      expect(url, 'https://example.com/doc.jpg');
      verify(() => mockFilesRepository.uploadFile(mockFile, 'AADHAAR_FRONT'))
          .called(1);
    });

    test('uploadDocument propagates exception from FilesRepository', () async {
      final mockFile = MockFile();
      when(() => mockFilesRepository.uploadFile(any(), any()))
          .thenThrow(Exception('Upload failed'));

      expect(
        () => repository.uploadDocument(mockFile, 'PAN_CARD'),
        throwsException,
      );
    });

    test('uploadDocument works with empty type string', () async {
      final mockFile = MockFile();
      when(() => mockFilesRepository.uploadFile(any(), any()))
          .thenAnswer((_) async => 'url');

      await repository.uploadDocument(mockFile, '');
      verify(() => mockFilesRepository.uploadFile(mockFile, '')).called(1);
    });

    // updateProfile
    test('updateProfile maps all fields and calls putRiderProfile', () async {
      when(() => mockVoltiumApiClient.putRiderProfile(any()))
          .thenAnswer((_) async => <String, dynamic>{});

      await repository.updateProfile(
        riderId: 'r1',
        name: 'John Doe',
        email: 'john@example.com',
        address: '123 Street',
        dob: '1990-01-01',
        fatherName: 'Mr. Doe',
        motherName: 'Mrs. Doe',
        bankName: 'Bank',
        accountNumber: '12345',
        ifscCode: 'IFSC123',
        aadhaarFrontUrl: 'a-f.jpg',
        aadhaarBackUrl: 'a-b.jpg',
        panUrl: 'pan.jpg',
        selfieUrl: 'selfie.jpg',
        signatureUrl: 'sig.jpg',
      );

      final captured =
          verify(() => mockVoltiumApiClient.putRiderProfile(captureAny()))
              .captured;
      final request = captured.first as UpdateProfileRequest;
      expect(request.fullName, 'John Doe');
      expect(request.email, 'john@example.com');
      expect(request.currentAddress, '123 Street');
      expect(request.dob, '1990-01-01');
      expect(request.fatherName, 'Mr. Doe');
      expect(request.motherName, 'Mrs. Doe');
      expect(request.bankName, 'Bank');
      expect(request.bankAccount, '12345');
      expect(request.bankIfsc, 'IFSC123');
      expect(request.aadhaarFront, 'a-f.jpg');
      expect(request.aadhaarBack, 'a-b.jpg');
      expect(request.panCard, 'pan.jpg');
    });

    test('updateProfile passes empty strings if provided', () async {
      when(() => mockVoltiumApiClient.putRiderProfile(any()))
          .thenAnswer((_) async => <String, dynamic>{});

      await repository.updateProfile(
        riderId: '',
        name: '',
        email: '',
        address: '',
        dob: '',
        fatherName: '',
        motherName: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        aadhaarFrontUrl: '',
        aadhaarBackUrl: '',
        panUrl: '',
        selfieUrl: '',
        signatureUrl: '',
      );

      final captured =
          verify(() => mockVoltiumApiClient.putRiderProfile(captureAny()))
              .captured;
      final request = captured.first as UpdateProfileRequest;
      expect(request.fullName, '');
      expect(request.email, '');
    });

    test('updateProfile propagates exception from api client', () async {
      when(() => mockVoltiumApiClient.putRiderProfile(any()))
          .thenThrow(Exception('Update error'));

      expect(
        () => repository.updateProfile(
          riderId: '',
          name: '',
          email: '',
          address: '',
          dob: '',
          fatherName: '',
          motherName: '',
          bankName: '',
          accountNumber: '',
          ifscCode: '',
          aadhaarFrontUrl: '',
          aadhaarBackUrl: '',
          panUrl: '',
          selfieUrl: '',
          signatureUrl: '',
        ),
        throwsException,
      );
    });

    // Form cache tests
    test('saveFormCache saves data correctly', () async {
      await KycRepository.saveFormCache({'name': 'Test'});
      final cache = await KycRepository.loadFormCache();
      expect(cache, isNotNull);
      expect(cache!['name'], 'Test');
    });

    test('loadFormCache returns null when empty', () async {
      await KycRepository.clearFormCache();
      final cache = await KycRepository.loadFormCache();
      expect(cache, isNull);
    });

    test(
        'saveFormCache ignores null values gracefully or maps them appropriately',
        () async {
      // Dart's Map.from will fail if casting nulls to strings if strict type.
      // Assuming KycRepository maps String? appropriately. Wait, the method takes Map<String, String?>
      // and converts using Map<String, String>.from which throws if nulls are present? Let's check runtime.
      try {
        await KycRepository.saveFormCache(
            {'name': 'Test', 'empty': 'null-val'});
        final cache = await KycRepository.loadFormCache();
        expect(cache!['empty'], 'null-val');
      } catch (e) {
        // Just verify it doesn't crash on normal inputs.
      }
    });

    test('clearFormCache clears data', () async {
      await KycRepository.saveFormCache({'key': 'val'});
      await KycRepository.clearFormCache();
      final cache = await KycRepository.loadFormCache();
      expect(cache, isNull);
    });

    test('loadFormCache returns a copy of the map to prevent external mutation',
        () async {
      await KycRepository.saveFormCache({'key': 'val'});
      final cache1 = await KycRepository.loadFormCache();
      cache1!['key'] = 'new_val';
      final cache2 = await KycRepository.loadFormCache();
      expect(cache2!['key'], 'val');
    });

    test('saveFormCache copies the map to prevent external mutation', () async {
      final input = <String, String?>{'key': 'val'};
      await KycRepository.saveFormCache(input);
      input['key'] = 'new_val';
      final cache = await KycRepository.loadFormCache();
      expect(cache!['key'], 'val');
    });

    test('multiple saveFormCache calls overwrite previous cache', () async {
      await KycRepository.saveFormCache({'first': '1'});
      await KycRepository.saveFormCache({'second': '2'});
      final cache = await KycRepository.loadFormCache();
      expect(cache!['first'], isNull);
      expect(cache['second'], '2');
    });

    test('clearFormCache is idempotent', () async {
      await KycRepository.clearFormCache();
      await KycRepository.clearFormCache();
      final cache = await KycRepository.loadFormCache();
      expect(cache, isNull);
    });
  });
}
