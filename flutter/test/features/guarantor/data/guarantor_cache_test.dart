import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/features/guarantor/data/guarantor_cache.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';

void main() {
  group('GuarantorCache', () {
    const testRiderId = 'test_rider_123';
    // AUDIT FIX (encrypted-storage migration): drafts persist under the
    // secure-storage namespace; the legacy plaintext key only exists for
    // one-time migration reads.
    const secureKey = 'guarantor_form:$testRiderId';
    final legacyKey = 'guarantor_onboarding_form_cache_$testRiderId';

    setUp(() async {
      TestWidgetsFlutterBinding.ensureInitialized();
      FlutterSecureStorage.setMockInitialValues({});
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    test('saveFormCache saves data correctly under riderId key', () async {
      final data = {
        'name': 'John Doe',
        'isPhoneVerified': true,
        'nullField': null,
      };

      await GuarantorCache.saveFormCache(testRiderId, data);

      final storedJson = await SecureStorageService().readValue(secureKey);
      expect(storedJson, isNotNull);

      final decoded = jsonDecode(storedJson!) as Map<String, dynamic>;
      expect(decoded['name'], 'John Doe');
      expect(decoded['isPhoneVerified'], true);
      expect(decoded.containsKey('nullField'), isFalse,
          reason: 'null fields should be filtered out');
    });

    test('saveFormCache does not leave a plaintext draft behind', () async {
      await GuarantorCache.saveFormCache(testRiderId, {'name': 'John Doe'});

      expect(CacheService().getString(legacyKey), isNull,
          reason: 'PII draft must not persist in plaintext prefs');
    });

    test('loadFormCache retrieves previously saved data', () async {
      final data = {
        'name': 'Jane Doe',
        'address': '456 Street',
      };

      await SecureStorageService().writeValue(secureKey, jsonEncode(data));

      final loadedData = await GuarantorCache.loadFormCache(testRiderId);
      expect(loadedData, isNotNull);
      expect(loadedData!['name'], 'Jane Doe');
      expect(loadedData['address'], '456 Street');
    });

    test('loadFormCache migrates a legacy plaintext draft to secure storage',
        () async {
      final data = {'name': 'Legacy Rider', 'phone': '9876543210'};
      CacheService().setString(legacyKey, jsonEncode(data));

      final loadedData = await GuarantorCache.loadFormCache(testRiderId);
      expect(loadedData, isNotNull);
      expect(loadedData!['name'], 'Legacy Rider');

      // Migration must remove the plaintext copy.
      expect(CacheService().getString(legacyKey), isNull);
      final migrated = await SecureStorageService().readValue(secureKey);
      expect(migrated, isNotNull);
    });

    test('loadFormCache returns null if no data exists', () async {
      final loadedData = await GuarantorCache.loadFormCache(testRiderId);
      expect(loadedData, isNull);
    });

    test('loadFormCache returns null if json is malformed', () async {
      await SecureStorageService().writeValue(secureKey, '{ invalid json }');
      final loadedData = await GuarantorCache.loadFormCache(testRiderId);
      expect(loadedData, isNull);
    });

    test('clearFormCache removes the specific key', () async {
      final data = {'name': 'John Doe'};
      await SecureStorageService().writeValue(secureKey, jsonEncode(data));
      CacheService().setString(legacyKey, jsonEncode(data));

      await GuarantorCache.clearFormCache(testRiderId);

      // Same contract as kyc_repository: the entry is blanked so
      // loadFormCache reads back as absent.
      expect(await GuarantorCache.loadFormCache(testRiderId), isNull,
          reason: 'cleared draft must read back as absent');
      expect(CacheService().getString(legacyKey), isNull);
    });

    // PR-GUARANTOR-OTP: the epoch-ms verification timestamp must survive
    // the JSON round-trip as an int (GuarantorCache is the persistence
    // path for the short-lived phone-verification receipt).
    test('verifiedAt survives the save/load round-trip as an int', () async {
      final verifiedAt = DateTime.now().millisecondsSinceEpoch;
      await GuarantorCache.saveFormCache(testRiderId, {
        'phone': '9876543210',
        'isPhoneVerified': true,
        'verifiedPhone': '9876543210',
        'verifiedAt': verifiedAt,
      });

      final loaded = await GuarantorCache.loadFormCache(testRiderId);
      expect(loaded, isNotNull);
      expect(loaded!['verifiedAt'], verifiedAt,
          reason: 'epoch-ms receipt timestamp must persist as an int');
      expect(loaded['verifiedPhone'], '9876543210');
      expect(loaded['isPhoneVerified'], true);
    });

    // PR-GUARANTOR-OTP: GuarantorCache null-filters entries — an unverified
    // form must not leave a stale verifiedAt behind that could look like a
    // fresh receipt on a later resume.
    test('null verifiedAt is filtered out of the stored blob', () async {
      await GuarantorCache.saveFormCache(testRiderId, {
        'phone': '9876543210',
        'verifiedAt': null,
      });

      final loaded = await GuarantorCache.loadFormCache(testRiderId);
      expect(loaded, isNotNull);
      expect(loaded!.containsKey('verifiedAt'), isFalse);
    });
  });
}
