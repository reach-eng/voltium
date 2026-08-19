import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

/// PR-1 (2026-08-07 master fix plan): the 5 inline `const _k*Content` strings
/// used to live in `legal_screen.dart` as a 3KB literal. They are now
/// served from `assets/json/legal_fallback.json` so the legal team can
/// update copy without a Flutter release. The JSON is bundled into the
/// APK (see `pubspec.yaml` assets section) and loaded on demand — never
/// on the hot path; only when the API is unreachable AND no SWR cache
/// exists.
class LegalFallbackLoader {
  const LegalFallbackLoader();

  /// Loads the offline legal fallback JSON from the bundled asset.
  /// Throws [AssetBundleException] if the asset is missing (i.e. the
  /// `pubspec.yaml` assets list is out of sync — a build-time
  /// regression that should never ship).
  Future<Map<String, ({String title, String content})>> loadAll() async {
    final raw = await rootBundle.loadString('assets/json/legal_fallback.json');
    final json = jsonDecode(raw) as Map<String, dynamic>;
    final documents = json['documents'] as Map<String, dynamic>? ?? const {};
    final result = <String, ({String title, String content})>{};
    documents.forEach((key, value) {
      if (value is Map<String, dynamic>) {
        final title = (value['title'] as String?) ?? key;
        final content = (value['content'] as String?) ?? '';
        if (content.isNotEmpty) {
          result[key] = (title: title, content: content);
        }
      }
    });
    return result;
  }
}
