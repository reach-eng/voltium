import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late VoltiumApiService service;

  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  setUp(() {
    mockApiClient = MockApiClient();
    service = VoltiumApiService.withClient(mockApiClient);
  });

  group('VoltiumApiService — wire-up smoke tests', () {
    test('service is constructible with a custom client', () {
      expect(service, isNotNull);
    });

    test('factory returns same singleton instance', () {
      VoltiumApiService.instance = null;
      final a = VoltiumApiService();
      final b = VoltiumApiService();
      expect(identical(a, b), isTrue);
    });

    test('instance can be replaced for tests', () {
      final custom = VoltiumApiService.withClient(mockApiClient);
      VoltiumApiService.instance = custom;
      // After setting, the factory should return the new instance
      final got = VoltiumApiService();
      expect(got, same(custom));
      VoltiumApiService.instance = null;
    });
  });
}
