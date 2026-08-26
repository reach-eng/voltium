import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'mock_data.dart';

/// Provides a mocked HTTP client for offline E2E testing.
class MockApiHandler {
  static http.Client createMockClient({bool simulateError = false}) {
    return MockClient((http.Request request) async {
      final path = request.url.path;
      final method = request.method;

      // Simulate network delay
      await Future.delayed(const Duration(milliseconds: 100));

      // Simulate 500 Server Error for error testing
      if (simulateError) {
        return http.Response('{"error": "Internal Server Error"}', 500);
      }

      // AUTHENTICATION
      if (path.contains('/auth/send-otp') && method == 'POST') {
        return _jsonResponse({'success': true, 'message': 'OTP Sent'});
      }
      if (path.contains('/auth/verify-otp') && method == 'POST') {
        return _jsonResponse({
          'success': true,
          'token': 'mock_jwt_token',
          'isNewUser': false,
        });
      }

      // RIDER PROFILE
      if (path.contains('/riders/profile') && method == 'GET') {
        return _jsonResponse(MockData.riderProfile);
      }
      if (path.contains('/riders/profile') && method == 'PUT') {
        return _jsonResponse({'success': true});
      }
      if (path.contains('/riders/earnings') && method == 'GET') {
        return _jsonResponse(MockData.riderEarnings);
      }
      if (path.contains('/riders/settings') && method == 'GET') {
        return _jsonResponse(MockData.riderSettings);
      }

      // WALLET
      if (path.contains('/wallet/balance') && method == 'GET') {
        return _jsonResponse(MockData.walletBalance);
      }
      if (path.contains('/wallet/transactions') && method == 'GET') {
        return _jsonResponse(MockData.walletTransactions);
      }

      // RENTALS
      if (path.contains('/rentals/active') && method == 'GET') {
        return _jsonResponse(MockData.activeRental);
      }
      if (path.contains('/hubs') && method == 'GET') {
        return _jsonResponse(MockData.hubsList);
      }

      // SUPPORT
      if (path.contains('/support/tickets') && method == 'GET') {
        return _jsonResponse([]);
      }

      // Default fallback
      return http.Response('{"error": "Not mocked: $method $path"}', 404);
    });
  }

  static http.Response _jsonResponse(dynamic body, {int statusCode = 200}) {
    return http.Response(
      jsonEncode(body),
      statusCode,
      headers: {'content-type': 'application/json'},
    );
  }
}
