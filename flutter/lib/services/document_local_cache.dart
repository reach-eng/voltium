import 'package:flutter/foundation.dart';
import 'package:universal_io/io.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'monitoring_service.dart';

/// Caches uploaded KYC/guarantor documents locally scoped by riderId
/// so they can be viewed offline without re-downloading from the server,
/// while preventing cross-account document leaks on shared devices.
class DocumentLocalCache {
  static const _prefsPrefix = 'doc_cache_';
  static const Duration defaultTtl = Duration(days: 30);

  static String _buildPrefsKey(String docKey, String? riderId) {
    if (riderId != null && riderId.isNotEmpty) {
      return '$_prefsPrefix${riderId}_$docKey';
    }
    return '$_prefsPrefix$docKey';
  }

  static String _buildTsKey(String docKey, String? riderId) {
    return '${_buildPrefsKey(docKey, riderId)}_ts';
  }

  /// Save a document file locally after upload. [docKey] is a stable
  /// identifier like "aadhaarFront", "panCard", "guarantorAadhaarBack".
  /// [sourcePath] is the local file path returned by ImagePicker.
  static Future<void> save(
    String docKey,
    String sourcePath, {
    String? riderId,
  }) async {
    try {
      final dir = await _cacheDir(riderId: riderId);
      final ext = sourcePath.split('.').last;
      final dest = File('${dir.path}/$docKey.$ext');
      await File(sourcePath).copy(dest.path);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_buildPrefsKey(docKey, riderId), dest.path);
      await prefs.setInt(
        _buildTsKey(docKey, riderId),
        DateTime.now().millisecondsSinceEpoch,
      );
    } catch (_) {
      // Non-critical: silently ignore cache failures.
    }
  }

  /// Get the local cached path for a document, or null if not cached or expired.
  static Future<String?> get(
    String docKey, {
    String? riderId,
    Duration ttl = defaultTtl,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _buildPrefsKey(docKey, riderId);
      final path = prefs.getString(key) ??
          (riderId != null
              ? prefs.getString(_buildPrefsKey(docKey, null))
              : null);

      if (path != null && File(path).existsSync()) {
        final ts = prefs.getInt(_buildTsKey(docKey, riderId)) ??
            (riderId != null ? prefs.getInt(_buildTsKey(docKey, null)) : null);
        if (ts != null) {
          final age = DateTime.now().millisecondsSinceEpoch - ts;
          if (age > ttl.inMilliseconds) {
            // Expired: delete file and metadata
            try {
              File(path).deleteSync();
            } catch (_) {}
            await prefs.remove(key);
            await prefs.remove(_buildTsKey(docKey, riderId));
            return null;
          }
        }
        return path;
      }
    } catch (e, stack) {
      MonitoringService.logError(e, stack,
          reason: 'DocumentLocalCache.get: prefs read failed');
    }
    return null;
  }

  /// Sweep documents older than [ttl] from disk and SharedPreferences.
  static Future<void> sweepExpired({Duration ttl = defaultTtl}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final now = DateTime.now().millisecondsSinceEpoch;
      final tsKeys = prefs
          .getKeys()
          .where((k) => k.startsWith(_prefsPrefix) && k.endsWith('_ts'))
          .toList();

      for (final tsKey in tsKeys) {
        final ts = prefs.getInt(tsKey);
        if (ts != null && (now - ts) > ttl.inMilliseconds) {
          final dataKey = tsKey.substring(0, tsKey.length - 3);
          final path = prefs.getString(dataKey);
          if (path != null) {
            final file = File(path);
            if (file.existsSync()) {
              try {
                file.deleteSync();
              } catch (_) {}
            }
          }
          await prefs.remove(dataKey);
          await prefs.remove(tsKey);
        }
      }
    } catch (e, stack) {
      MonitoringService.logError(e, stack,
          reason: 'DocumentLocalCache.sweepExpired failed');
    }
  }

  @visibleForTesting
  static Directory? cacheDirForTesting;

  /// Clear all cached documents for a specific rider.
  static Future<void> clearForRider(String riderId) async {
    if (riderId.isEmpty) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final prefix = '$_prefsPrefix${riderId}_';
      final keys = prefs.getKeys().where((k) => k.startsWith(prefix)).toList();
      for (final k in keys) {
        await prefs.remove(k);
      }
      final appDir =
          cacheDirForTesting ?? await getApplicationDocumentsDirectory();
      final dir = Directory('${appDir.path}/cached_documents/$riderId');
      if (dir.existsSync()) {
        await dir.delete(recursive: true);
      }
    } catch (e, stack) {
      MonitoringService.logError(e, stack,
          reason: 'DocumentLocalCache.clearForRider: wipe failed');
    }
  }

  /// Clear all cached documents across all riders.
  static Future<void> clearAll() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys =
          prefs.getKeys().where((k) => k.startsWith(_prefsPrefix)).toList();
      for (final k in keys) {
        await prefs.remove(k);
      }
      final appDir =
          cacheDirForTesting ?? await getApplicationDocumentsDirectory();
      final dir = Directory('${appDir.path}/cached_documents');
      if (dir.existsSync()) {
        await dir.delete(recursive: true);
      }
    } catch (e, stack) {
      MonitoringService.logError(e, stack,
          reason: 'DocumentLocalCache.clearAll: wipe failed');
    }
  }

  static Future<Directory> _cacheDir({String? riderId}) async {
    final appDir =
        cacheDirForTesting ?? await getApplicationDocumentsDirectory();
    final subDir = riderId != null && riderId.isNotEmpty ? riderId : 'shared';
    final dir = Directory('${appDir.path}/cached_documents/$subDir');
    if (!dir.existsSync()) await dir.create(recursive: true);
    return dir;
  }
}
