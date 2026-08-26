import 'package:universal_io/io.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Caches uploaded KYC/guarantor documents locally so they can be viewed
/// offline without re-downloading from the server.
class DocumentLocalCache {
  static const _prefsPrefix = 'doc_cache_';

  /// Save a document file locally after upload. [docKey] is a stable
  /// identifier like "aadhaarFront", "panCard", "guarantorAadhaarBack".
  /// [sourcePath] is the local file path returned by ImagePicker.
  static Future<void> save(String docKey, String sourcePath) async {
    try {
      final dir = await _cacheDir();
      final ext = sourcePath.split('.').last;
      final dest = File('${dir.path}/$docKey.$ext');
      await File(sourcePath).copy(dest.path);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('$_prefsPrefix$docKey', dest.path);
    } catch (_) {
      // Non-critical: silently ignore cache failures.
    }
  }

  /// Get the local cached path for a document, or null if not cached.
  static Future<String?> get(String docKey) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final path = prefs.getString('$_prefsPrefix$docKey');
      if (path != null && File(path).existsSync()) return path;
    } catch (_) {}
    return null;
  }

  static Future<void> clearAll() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys =
          prefs.getKeys().where((k) => k.startsWith(_prefsPrefix)).toList();
      for (final k in keys) {
        await prefs.remove(k);
      }
      final dir = await _cacheDir();
      if (dir.existsSync()) {
        await dir.delete(recursive: true);
      }
    } catch (_) {}
  }

  static Future<Directory> _cacheDir() async {
    final appDir = await getApplicationDocumentsDirectory();
    final dir = Directory('${appDir.path}/cached_documents');
    if (!dir.existsSync()) await dir.create(recursive: true);
    return dir;
  }
}
