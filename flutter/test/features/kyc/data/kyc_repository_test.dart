import 'package:flutter/services.dart';
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

    // In-memory mock for flutter_secure_storage so saveFormCache /
    // loadFormCache can round-trip values without real Keystore access.
    const secureStorageChannel =
        MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    final store = <String, String>{};
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(secureStorageChannel,
            (MethodCall call) async {
      switch (call.method) {
        case 'read':
          return store[call.arguments['key'] as String?];
        case 'readAll':
          return Map<String, String>.from(store);
        case 'write':
          store[call.arguments['key'] as String] =
              call.arguments['value'] as String;
          return null;
        case 'delete':
          store.remove(call.arguments['key'] as String);
          return null;
        case 'deleteAll':
          store.clear();
          return null;
        case 'containsKey':
          return store.containsKey(call.arguments['key'] as String);
        default:
          return null;
      }
    });

    // Clear all cached riders before each test so tests don't leak
    // state to each other.
    KycRepository.clearFormCache(riderId: 'r1');
    KycRepository.clearFormCache(riderId: 'r2');
    KycRepository.clearFormCache(riderId: 'r3');
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

    // Form cache tests — scoped per rider
    test('saveFormCache and loadFormCache roundtrip for one rider', () async {
      await KycRepository.saveFormCache(
        riderId: 'r1',
        data: {'name': 'Alice', 'email': 'alice@example.com'},
      );
      final cache = await KycRepository.loadFormCache(riderId: 'r1');
      expect(cache, isNotNull);
      expect(cache!['name'], 'Alice');
      expect(cache['email'], 'alice@example.com');
    });

    test('loadFormCache returns null for an unknown rider', () async {
      await KycRepository.saveFormCache(
        riderId: 'r1',
        data: {'name': 'Alice'},
      );
      final cache = await KycRepository.loadFormCache(riderId: 'unknown-rider');
      expect(cache, isNull);
    });

    test(
      'SECURITY: form cache is scoped per rider — r2 cannot see r1 data',
      () async {
        // r1 fills the form with sensitive PII
        await KycRepository.saveFormCache(
          riderId: 'r1',
          data: {
            'name': 'Alice',
            'aadhaarFrontPath': '/uploads/r1-aadhaar.jpg',
            'bankAccount': '1234567890',
          },
        );

        // r2 logs in on the same device and the form loads
        final r2Cache = await KycRepository.loadFormCache(riderId: 'r2');
        expect(r2Cache, isNull,
            reason: 'Rider r2 must not see rider r1 cached form data — this '
                'would leak Aadhaar numbers and bank accounts between users.');

        // r1's data is still intact for r1
        final r1Cache = await KycRepository.loadFormCache(riderId: 'r1');
        expect(r1Cache!['name'], 'Alice');
        expect(r1Cache['aadhaarFrontPath'], '/uploads/r1-aadhaar.jpg');
        // SECURITY FIX (F2, 2026-08-22): financial PII (bankAccount,
        // bankIfsc) is intentionally stripped from persistent storage
        // so a leaked backup or rooted device cannot recover it. The
        // r1 in-memory map still carries it; only the secure-storage
        // copy is sanitised.
        expect(r1Cache.containsKey('bankAccount'), isFalse,
            reason: 'financial PII must never reach persistent storage');
      },
    );

    test('saveFormCache ignores null values', () async {
      await KycRepository.saveFormCache(
        riderId: 'r1',
        data: {'name': 'Alice', 'empty': null, 'email': ''},
      );
      final cache = await KycRepository.loadFormCache(riderId: 'r1');
      expect(cache!['name'], 'Alice');
      // null values are dropped
      expect(cache.containsKey('empty'), false);
      // empty strings are kept
      expect(cache['email'], '');
    });

    test('clearFormCache clears data for one rider only', () async {
      await KycRepository.saveFormCache(
        riderId: 'r1',
        data: {'name': 'Alice'},
      );
      await KycRepository.saveFormCache(
        riderId: 'r2',
        data: {'name': 'Bob'},
      );
      await KycRepository.clearFormCache(riderId: 'r1');

      expect(await KycRepository.loadFormCache(riderId: 'r1'), isNull);
      expect(
          (await KycRepository.loadFormCache(riderId: 'r2'))!['name'], 'Bob');
    });

    test('loadFormCache returns a copy of the map', () async {
      await KycRepository.saveFormCache(
        riderId: 'r1',
        data: {'key': 'val'},
      );
      final cache1 = await KycRepository.loadFormCache(riderId: 'r1');
      cache1!['key'] = 'new_val';
      final cache2 = await KycRepository.loadFormCache(riderId: 'r1');
      expect(cache2!['key'], 'val',
          reason: 'External mutation must not affect the cache');
    });

    test('saveFormCache copies the input map', () async {
      final input = <String, String?>{'key': 'val'};
      await KycRepository.saveFormCache(riderId: 'r1', data: input);
      input['key'] = 'new_val';
      final cache = await KycRepository.loadFormCache(riderId: 'r1');
      expect(cache!['key'], 'val');
    });

    test('clearFormCache is idempotent', () async {
      await KycRepository.clearFormCache(riderId: 'r1');
      await KycRepository.clearFormCache(riderId: 'r1');
      final cache = await KycRepository.loadFormCache(riderId: 'r1');
      expect(cache, isNull);
    });
  });
}
