import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/navigation/app_state.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/auth/data/repository_impl.dart';
import 'package:voltium_rider/services/document_local_cache.dart';
import 'package:voltium_rider/services/offline_storage_service.dart';

class _FakeVoltiumApiClient extends VoltiumApiClient {
  final VerifyOtpResponse response;
  _FakeVoltiumApiClient(ApiClient client, this.response) : super(client);

  @override
  Future<VerifyOtpResponse> postAuthVerifyOtp(VerifyOtpRequest request) async {
    return response;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase F2: Session Isolation & Logout (PR-G)', () {
    late Directory testTempDir;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      OfflineStorageService().clearMemCacheForTesting();
      testTempDir = Directory.systemTemp.createTempSync('doc_cache_test_');
      DocumentLocalCache.cacheDirForTesting = testTempDir;
    });

    tearDown(() async {
      try {
        if (testTempDir.existsSync()) {
          testTempDir.deleteSync(recursive: true);
        }
      } catch (_) {}
    });

    test(
        'FL-3: OfflineStorageService.clearAll wipes in-memory cache and tables',
        () async {
      final service = OfflineStorageService();
      await service.cacheData('key1', {'foo': 'bar'});
      expect(await service.getCachedData('key1'), {'foo': 'bar'});

      await service.clearAll();
      expect(await service.getCachedData('key1'), isNull);
    });

    test('FL-13: DocumentLocalCache scopes by riderId and clears properly',
        () async {
      final tmpFile = File('/test_doc.jpg');
      await tmpFile.writeAsString('fake image data');

      await DocumentLocalCache.save('aadhaarFront', tmpFile.path,
          riderId: 'rider_A');
      await DocumentLocalCache.save('aadhaarFront', tmpFile.path,
          riderId: 'rider_B');

      final pathA =
          await DocumentLocalCache.get('aadhaarFront', riderId: 'rider_A');
      final pathB =
          await DocumentLocalCache.get('aadhaarFront', riderId: 'rider_B');

      expect(pathA, isNotNull);
      expect(pathB, isNotNull);
      expect(pathA, isNot(equals(pathB)));
      expect(pathA, contains('rider_A'));
      expect(pathB, contains('rider_B'));

      // Clear for rider A only
      await DocumentLocalCache.clearForRider('rider_A');
      expect(await DocumentLocalCache.get('aadhaarFront', riderId: 'rider_A'),
          isNull);
      expect(await DocumentLocalCache.get('aadhaarFront', riderId: 'rider_B'),
          isNotNull);

      // Clear all
      await DocumentLocalCache.clearAll();
      expect(await DocumentLocalCache.get('aadhaarFront', riderId: 'rider_B'),
          isNull);
    });

    test(
        'FL-13: DocumentLocalCache sweepExpired removes stale documents past TTL',
        () async {
      final tmpFile = File('/test_expired_doc.jpg');
      await tmpFile.writeAsString('expired doc');

      await DocumentLocalCache.save('oldDoc', tmpFile.path, riderId: 'rider_C');
      expect(await DocumentLocalCache.get('oldDoc', riderId: 'rider_C'),
          isNotNull);

      // Sweep with zero TTL so everything created is immediately stale
      await DocumentLocalCache.sweepExpired(ttl: Duration.zero);
      expect(
          await DocumentLocalCache.get('oldDoc', riderId: 'rider_C'), isNull);
    });

    test(
        'Delta F-006: AuthRepository defaults null isNewRider to true (fail toward onboarding)',
        () async {
      final client = ApiClient();
      final fakeApi = _FakeVoltiumApiClient(
        client,
        VerifyOtpResponse(
          riderId: 'rdr_123',
          token: 'token_abc',
          refreshToken: 'refresh_xyz',
          isNewRider: null, // missing/null from backend
        ),
      );

      final repo = AuthRepositoryImpl(client, fakeApi);
      final result = await repo.verifyOtp('9999999999', '123456');

      expect(result.isNewRider, isTrue);
      expect(
          result.nextState, equals(const Onboarding(OnboardingStep.kycSubmit)));
    });

    test('Delta F-006: AuthRepository respects explicit isNewRider=false',
        () async {
      final client = ApiClient();
      final fakeApi = _FakeVoltiumApiClient(
        client,
        VerifyOtpResponse(
          riderId: 'rdr_123',
          token: 'token_abc',
          refreshToken: 'refresh_xyz',
          isNewRider: false,
        ),
      );

      final repo = AuthRepositoryImpl(client, fakeApi);
      final result = await repo.verifyOtp('9999999999', '123456');

      expect(result.isNewRider, isFalse);
      expect(result.nextState, equals(const PreDashboard()));
    });
  });
}
