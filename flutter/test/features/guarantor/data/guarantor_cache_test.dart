import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/features/guarantor/data/guarantor_cache.dart';
import 'package:voltium_rider/services/cache_service.dart';

void main() {
  group('GuarantorCache', () {
    const testRiderId = 'test_rider_123';
    final expectedKey = 'guarantor_onboarding_form_cache_$testRiderId';

    setUp(() async {
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

      final storedJson = CacheService().getString(expectedKey);
      expect(storedJson, isNotNull);

      final decoded = jsonDecode(storedJson!) as Map<String, dynamic>;
      expect(decoded['name'], 'John Doe');
      expect(decoded['isPhoneVerified'], true);
      expect(decoded.containsKey('nullField'), isFalse,
          reason: 'null fields should be filtered out');
    });

    test('loadFormCache retrieves previously saved data', () async {
      final data = {
        'name': 'Jane Doe',
        'address': '456 Street',
      };

      CacheService().setString(expectedKey, jsonEncode(data));

      final loadedData = GuarantorCache.loadFormCache(testRiderId);
      expect(loadedData, isNotNull);
      expect(loadedData!['name'], 'Jane Doe');
      expect(loadedData['address'], '456 Street');
    });

    test('loadFormCache returns null if no data exists', () {
      final loadedData = GuarantorCache.loadFormCache(testRiderId);
      expect(loadedData, isNull);
    });

    test('loadFormCache returns null if json is malformed', () {
      CacheService().setString(expectedKey, '{ invalid json }');
      final loadedData = GuarantorCache.loadFormCache(testRiderId);
      expect(loadedData, isNull);
    });

    test('clearFormCache removes the specific key', () async {
      final data = {'name': 'John Doe'};
      CacheService().setString(expectedKey, jsonEncode(data));

      expect(CacheService().getString(expectedKey), isNotNull);

      await GuarantorCache.clearFormCache(testRiderId);

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

      final loaded = GuarantorCache.loadFormCache(testRiderId);
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

      final loaded = GuarantorCache.loadFormCache(testRiderId);
      expect(loaded, isNotNull);
      expect(loaded!.containsKey('verifiedAt'), isFalse);
    });
  });
}
