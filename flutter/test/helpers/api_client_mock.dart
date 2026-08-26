import 'package:mocktail/mocktail.dart';
import 'package:voltium/core/network/api_client.dart';

class MockApiClient extends Mock implements ApiClient {}

void registerFallbackValues() {
  // Register fallback values for common API payloads if necessary
  registerFallbackValue(Uri.parse('http://localhost'));
  registerFallbackValue(<String, dynamic>{});
}
