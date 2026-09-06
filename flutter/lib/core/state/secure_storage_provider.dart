import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/secure_storage_service.dart';

/// T-1 (design audit, 2026-09-07): Riverpod wrappers around the
/// `SecureStorageService` and `EncryptedCacheService` factory singletons.
/// Tests can `overrideWithValue` per-`ProviderScope` to inject a fake or
/// a fresh in-memory instance; production code reads the same instance the
/// factory would return.
final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

final encryptedCacheProvider = Provider<EncryptedCacheService>((ref) {
  return EncryptedCacheService();
});
