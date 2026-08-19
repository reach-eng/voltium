import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/app/router.dart';
import 'package:voltium_rider/services/cache_service.dart';

/// PR-A (§5.1 / audit #5 P0-2): after the rider accepts the legal documents,
/// `legal_accepted_v1` is persisted and the splash screen must skip both the
/// KYC pre-flight checklist and the legal wall on the next cold start.
void main() {
  group('firstLaunchGateState', () {
    test('routes a rider who accepted legal straight to permissions', () {
      expect(firstLaunchGateState(true), AuthState.permissions);
    });

    test('routes a first-time rider through the KYC pre-flight first', () {
      expect(firstLaunchGateState(false), AuthState.kycPreflight);
    });
  });

  group('legal_accepted_v1 persistence', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    test('round-trips through the cache the router reads synchronously',
        () async {
      // Unset → router treats as not accepted.
      expect(CacheService().getBool('legal_accepted_v1'), isNull);

      await CacheService().setBool('legal_accepted_v1', true);
      expect(CacheService().getBool('legal_accepted_v1'), isTrue);

      await CacheService().remove('legal_accepted_v1');
      expect(CacheService().getBool('legal_accepted_v1'), isNull);
    });
  });
}
