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
      expect(decoded.containsKey('nullField'), isFalse, reason: 'null fields should be filtered out');
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
  });
}
