import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/config/app_config.dart' as config;
import 'package:voltium_rider/utils/app_config.dart' as utils;

void main() {
  group('F-26: Consolidated AppConfig Tests', () {
    test(
        'both config and utils imports resolve to the same canonical AppConfig',
        () {
      // Both imports must share identical constants and static properties
      expect(
          config.AppConfig.supportEmail, equals(utils.AppConfig.supportEmail));
      expect(
          config.AppConfig.supportPhone, equals(utils.AppConfig.supportPhone));
      expect(
        config.AppConfig.supportPhoneCompact,
        equals(utils.AppConfig.supportPhoneCompact),
      );
      expect(
          config.AppConfig.legalVersion, equals(utils.AppConfig.legalVersion));
      expect(config.AppConfig.apiBaseUrl, equals(utils.AppConfig.apiBaseUrl));
      expect(config.AppConfig.appName, equals(utils.AppConfig.appName));
      expect(config.AppConfig.flavor, equals(utils.AppConfig.flavor));
    });

    test('exposes correct support contact and legal metadata', () {
      expect(config.AppConfig.supportEmail, equals('support@voltium.app'));
      expect(config.AppConfig.supportPhone, equals('+91 1800-889-VOLT'));
      expect(config.AppConfig.supportPhoneCompact, equals('+9118008898658'));
      expect(config.AppConfig.legalVersion, equals('public-beta-v1'));
    });

    test(
        'apiBaseUrl produces valid HTTP/HTTPS URL and matches configuredApiUrl if set',
        () {
      final baseUrl = config.AppConfig.apiBaseUrl;
      expect(baseUrl, isNotEmpty);
      expect(
        baseUrl.startsWith('http://') || baseUrl.startsWith('https://'),
        isTrue,
      );

      if (config.AppConfig.configuredApiUrl.isNotEmpty) {
        expect(baseUrl, equals(config.AppConfig.configuredApiUrl));
      } else {
        expect(
          baseUrl,
          isIn(['http://10.0.2.2:8081', 'http://127.0.0.1:8081']),
        );
      }
    });

    test('isTestOrDev is true in test environment', () {
      expect(config.AppConfig.isTestOrDev, isTrue);
    });
  });
}
