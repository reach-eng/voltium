import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/features/guarantor/data/guarantor_cache.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';

void main() {
  group('GuarantorCache', () {
    const testRiderId = 'test_rider_123';
    final expectedKey = 'guarantor_onboarding_form_cache_$testRiderId';

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
      await CacheService().init();
    });

    test(
        'saveFormCache saves data in encrypted storage and clears plaintext cache',
        () async {
      final data = {
        'name': 'John Doe',
        'isPhoneVerified': true,
        'nullField': null,
      };

      await GuarantorCache.saveFormCache(testRiderId, data);

      // F-39: Plaintext SharedPreferences must NOT have the sensitive guarantor PII
      final plaintext = CacheService().getString(expectedKey);
      expect(plaintext, isNull,
          reason:
              'Plaintext SharedPreferences must not contain guarantor draft PII');

      // Encrypted storage must have the data
      final encrypted = await EncryptedCacheService().read(expectedKey);
      expect(encrypted, isNotNull);
      expect(encrypted!['name'], 'John Doe');
      expect(encrypted['isPhoneVerified'], true);
      expect(encrypted.containsKey('nullField'), isFalse,
          reason: 'null fields should be filtered out');
    });

    test('loadFormCache retrieves previously saved data from encrypted storage',
        () async {
      final data = {
        'name': 'Jane Doe',
        'address': '456 Street',
      };

      await EncryptedCacheService().write(expectedKey, data);

      final loadedData = await GuarantorCache.loadFormCache(testRiderId);
      expect(loadedData, isNotNull);
      expect(loadedData!['name'], 'Jane Doe');
      expect(loadedData['address'], '456 Street');
    });

    test(
        'loadFormCache migrates legacy plaintext SharedPreferences to encrypted storage',
        () async {
      final data = {
        'name': 'Migrated User',
        'address': '789 Legacy Blvd',
      };

      CacheService().setString(expectedKey, jsonEncode(data));

      final loadedData = await GuarantorCache.loadFormCache(testRiderId);
      expect(loadedData, isNotNull);
      expect(loadedData!['name'], 'Migrated User');

      // Plaintext must be purged upon migration
      expect(CacheService().getString(expectedKey), isNull);

      // Encrypted storage must now have the data
      final encrypted = await EncryptedCacheService().read(expectedKey);
      expect(encrypted, isNotNull);
      expect(encrypted!['name'], 'Migrated User');
    });

    test('loadFormCache returns null if no data exists', () async {
      final loadedData = await GuarantorCache.loadFormCache(testRiderId);
      expect(loadedData, isNull);
    });

    test('loadFormCache returns null if json is malformed', () async {
      CacheService().setString(expectedKey, '{ invalid json }');
      final loadedData = await GuarantorCache.loadFormCache(testRiderId);
      expect(loadedData, isNull);
    });

    test(
        'clearFormCache removes from both encrypted storage and plaintext cache',
        () async {
      final data = {'name': 'John Doe'};
      await EncryptedCacheService().write(expectedKey, data);
      CacheService().setString(expectedKey, jsonEncode(data));

      expect(await EncryptedCacheService().read(expectedKey), isNotNull);
      expect(CacheService().getString(expectedKey), isNotNull);

      await GuarantorCache.clearFormCache(testRiderId);

      expect(await EncryptedCacheService().read(expectedKey), isNull);
      expect(CacheService().getString(expectedKey), isNull);
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
