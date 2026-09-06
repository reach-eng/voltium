import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';

/// T-1 (design audit, 2026-09-07): Riverpod wrapper around the [ApiClient]
/// factory singleton. Tests can `overrideWithValue` per-`ProviderScope` to
/// inject a fake transport; production code reads the same instance the
/// `ApiClient()` factory would return, so behaviour is unchanged.
///
/// The wrapper is intentionally a stateless `Provider` (not a
/// `StateNotifierProvider`): the underlying singleton carries no observable
/// state worth watching from a widget — it just owns an `http.Client` and a
/// `SecureStorageService` reference.
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient();
});
