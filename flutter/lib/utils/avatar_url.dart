import 'package:flutter/foundation.dart';
import 'package:voltium_rider/core/network/api_client.dart';

/// Shared helper to resolve a storage path, relative path, or absolute URL
/// to a loadable image/file URL.
///
/// - Absolute `http`/`https` URLs pass through, translating `localhost` to
///   Android emulator host (`10.0.2.2`) when on Android.
/// - Unsafe schemes (`javascript:`, `file:`) and protocol-relative `//` are rejected.
/// - Bare storage keys resolve against `/api/files/download/<key>`.
/// - Leading slashes and path-traversal segments (`..`) are stripped.
String? resolveFileUrl(String? raw, {bool? isAndroid}) {
  if (raw == null || raw.trim().isEmpty) return null;
  final cleaned = raw.trim();
  if (cleaned.startsWith('//')) return null;

  final android =
      isAndroid ?? (!kIsWeb && defaultTargetPlatform == TargetPlatform.android);
  final devHost = android ? '10.0.2.2' : '127.0.0.1';

  final uri = Uri.tryParse(cleaned);
  if (uri != null && uri.hasScheme) {
    if (uri.scheme == 'http' || uri.scheme == 'https') {
      if (cleaned.contains('localhost')) {
        return cleaned.replaceAll('localhost', devHost);
      }
      return cleaned;
    }
    return null;
  }

  const apiUrl = String.fromEnvironment('API_URL');
  var base = apiUrl.isNotEmpty ? apiUrl : ApiClient().baseUrl;
  if (base.isEmpty) {
    base = 'http://$devHost:8081';
  } else if (base.contains('localhost')) {
    base = base.replaceAll('localhost', devHost);
  }

  final sanitized = cleaned
      .replaceAll('..', '')
      .replaceAll(RegExp(r'/+'), '/')
      .replaceFirst(RegExp(r'^/+'), '');
  if (sanitized.isEmpty) return null;

  if (sanitized.startsWith('api/files/')) {
    return '$base/$sanitized';
  }
  return '$base/api/files/download/$sanitized';
}

/// Resolve a server-provided photo reference to a loadable image URL.
String? resolveAvatarUrl(String? raw, {bool? isAndroid}) {
  return resolveFileUrl(raw, isAndroid: isAndroid);
}
