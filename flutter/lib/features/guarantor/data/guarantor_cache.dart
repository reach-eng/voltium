import 'dart:convert';
import 'package:voltium_rider/services/cache_service.dart';

class GuarantorCache {
  static const _baseKey = 'guarantor_onboarding_form_cache';

  static String _getKey(String riderId) => '${_baseKey}_$riderId';

  static Future<void> saveFormCache(
      String riderId, Map<String, dynamic> data) async {
    // Filter out nulls
    final cleanData = <String, dynamic>{};
    data.forEach((key, value) {
      if (value != null) {
        cleanData[key] = value;
      }
    });
    await CacheService().setString(_getKey(riderId), jsonEncode(cleanData));
  }

  static Map<String, dynamic>? loadFormCache(String riderId) {
    final cachedStr = CacheService().getString(_getKey(riderId));
    if (cachedStr != null && cachedStr.isNotEmpty) {
      try {
        return jsonDecode(cachedStr) as Map<String, dynamic>;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  static Future<void> clearFormCache(String riderId) async {
    await CacheService().remove(_getKey(riderId));
  }
}
