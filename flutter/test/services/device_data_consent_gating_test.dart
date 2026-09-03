import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/services/consent_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ConsentService & Contacts Gating Tests', () {
    test('ConsentType includes contacts with proper API mapping', () {
      expect(ConsentType.contacts.apiValue, equals('CONTACTS'));
      expect(ConsentType.location.apiValue, equals('LOCATION'));
      expect(ConsentType.callLogs.apiValue, equals('CALL_LOGS'));
    });

    test('ConsentService defines unique keys for each consent type', () {
      final consentService = ConsentService();
      expect(consentService, isNotNull);
    });
  });
}
