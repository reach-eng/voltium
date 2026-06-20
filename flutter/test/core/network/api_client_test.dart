import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:http/http.dart' as http;
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';

class MockHttpClient extends Mock implements http.Client {}
class MockSecureStorageService extends Mock implements SecureStorageService {}

void main() {
  setUpAll(() {
    registerFallbackValue(Uri());
  });

  group('ApiClient Tests with Mocktail', () {
    late MockHttpClient mockClient;
    late MockSecureStorageService mockStorage;
    late ApiClient apiClient;

    setUp(() {
      mockClient = MockHttpClient();
      mockStorage = MockSecureStorageService();
      apiClient = ApiClient(
        client: mockClient,
        storage: mockStorage,
        baseUrl: 'http://api.test.local',
      );
    });

    test('successful GET request with authorization token', () async {
      // Arrange
      when(() => mockStorage.getSessionToken())
          .thenAnswer((_) async => 'mock-jwt-token');
      
      final expectedResponse = {'status': 'success', 'data': 'test_data'};
      when(() => mockClient.get(
            any(),
            headers: any(named: 'headers'),
          )).thenAnswer(
        (_) async => http.Response(jsonEncode(expectedResponse), 200),
      );

      // Act
      final result = await apiClient.get('/test-endpoint');

      // Assert
      expect(result, equals(expectedResponse));
      verify(() => mockStorage.getSessionToken()).called(1);
      verify(() => mockClient.get(
            any(that: predicate<Uri>((uri) => uri.path == '/test-endpoint')),
            headers: any(named: 'headers', that: containsPair('Authorization', 'Bearer mock-jwt-token')),
          )).called(1);
    });

    test('successful POST request', () async {
      // Arrange
      when(() => mockStorage.getSessionToken())
          .thenAnswer((_) async => 'mock-jwt-token');
      
      final expectedResponse = {'status': 'success'};
      final requestBody = {'key': 'value'};
      
      when(() => mockClient.post(
            any(),
            headers: any(named: 'headers'),
            body: any(named: 'body'),
          )).thenAnswer(
        (_) async => http.Response(jsonEncode(expectedResponse), 200),
      );

      // Act
      final result = await apiClient.post('/test-endpoint', body: requestBody);

      // Assert
      expect(result, equals(expectedResponse));
      verify(() => mockClient.post(
            any(that: predicate<Uri>((uri) => uri.path == '/test-endpoint')),
            headers: any(named: 'headers'),
            body: jsonEncode(requestBody),
          )).called(1);
    });
  });
}
