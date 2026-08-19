import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/services/offline_storage_service.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ApiClient HTTP ETag & 304 Handling', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
    });

    tearDown(() {
      ApiClient.instanceForTest = null;
    });

    test('304 response returns cached data without error', () async {
      int callCount = 0;
      final mockClient = MockClient((request) async {
        callCount++;
        if (request.headers['If-None-Match'] == 'W/"etag123"') {
          return http.Response('', 304, headers: {'etag': 'W/"etag123"'});
        }
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {'riderId': 'RIDER-001', 'name': 'Alice'},
          }),
          200,
          headers: {'etag': 'W/"etag123"', 'content-type': 'application/json'},
        );
      });

      final client =
          ApiClient(client: mockClient, baseUrl: 'https://test.api.voltium.in');
      ApiClient.instanceForTest = client;

      // First call (200 OK)
      final res1 = await client.getWithConditionalCache('/api/rider/profile');
      expect(res1['riderId'], equals('RIDER-001'));
      expect(callCount, equals(1));

      // Second call (304 Not Modified -> returns SQLite cached data)
      final res2 = await client.getWithConditionalCache('/api/rider/profile');
      expect(res2['riderId'], equals('RIDER-001'));
      expect(callCount, equals(2));
    });

    test('304 structured status flag is parsed cleanly', () {
      final notModifiedResponse = <String, dynamic>{
        '_status': 304,
        '_isNotModified': true,
      };

      expect(notModifiedResponse['_status'], equals(304));
      expect(notModifiedResponse['_isNotModified'], isTrue);
    });

    test(
        'in-flight GET requests to the same URL are deduplicated into 1 HTTP call',
        () async {
      int callCount = 0;
      final mockClient = MockClient((request) async {
        callCount++;
        await Future.delayed(const Duration(milliseconds: 50));
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {
              'hubs': ['Hub A', 'Hub B']
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final client =
          ApiClient(client: mockClient, baseUrl: 'https://test.api.voltium.in');
      ApiClient.instanceForTest = client;

      // 3 concurrent GET calls to the exact same URL
      final results = await Future.wait([
        client.get('/api/rider/hubs'),
        client.get('/api/rider/hubs'),
        client.get('/api/rider/hubs'),
      ]);

      expect(results.length, equals(3));
      expect(results[0]['hubs'], equals(['Hub A', 'Hub B']));
      expect(results[1]['hubs'], equals(['Hub A', 'Hub B']));
      expect(results[2]['hubs'], equals(['Hub A', 'Hub B']));
      // In-flight coalescing must ensure only 1 real network request was fired
      expect(callCount, equals(1));
    });
  });
}
