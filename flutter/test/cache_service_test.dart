import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('CacheService', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    test('should cache and retrieve rider data', () async {
      final riderData = {'id': '123', 'name': 'Test Rider'};
      await CacheService().cacheRider(riderData);

      final retrieved = CacheService().getCachedRider();
      expect(retrieved?['id'], '123');
      expect(retrieved?['name'], 'Test Rider');
    });

    test('should detect expired cache', () async {
      final riderData = {'id': '123'};
      // Cache with 1 second TTL
      await CacheService().cacheRider(riderData, ttlSeconds: -1);

      expect(CacheService().isRiderCacheExpired(), isTrue);
      expect(CacheService().isRiderCacheValid(), isFalse);
    });

    test('should detect version mismatch', () async {
      final riderData = {'id': '123'};
      await CacheService().cacheRider(riderData);

      // Manually set a different version in prefs
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('voltium_rider_cache_version', 'v0');

      expect(CacheService().isCacheVersionMismatched(), isTrue);
      expect(CacheService().isRiderCacheValid(), isFalse);
    });

    test('should clear rider cache', () async {
      await CacheService().cacheRider({'id': '123'});
      await CacheService().clearRiderCache();

      expect(CacheService().getCachedRider(), isNull);
    });
  });
}
