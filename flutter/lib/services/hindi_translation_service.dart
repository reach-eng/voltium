import 'dart:convert';

import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/utils/app_logger.dart';

/// Zero-cost, offline-first dynamic text translation service for
/// Voltium EV fleet terminology.
///
/// The service provides instant Hindi ↔ English translation for dynamic
/// runtime strings that are NOT covered by the static ARB file (e.g.
/// backend push-notification bodies, support chat messages, and any
/// server-generated string that riders may see in Hindi mode).
///
/// Architecture:
///   - Primary lookup: in-memory domain dictionary (_enToHi / _hiToEn).
///   - Secondary lookup: LRU persistent cache stored via CacheService.
///   - No external API keys, zero network requests, 100% offline.
///
/// Usage:
/// ```dart
/// final hi = HindiTranslationService().translateToHindi('Your vehicle is ready');
/// final en = HindiTranslationService().translateToEnglish('वाहन तैयार है');
/// ```
class HindiTranslationService {
  // ── Singleton ──────────────────────────────────────────────────────────
  static final HindiTranslationService _instance =
      HindiTranslationService._internal();
  factory HindiTranslationService() => _instance;
  HindiTranslationService._internal();

  // ── LRU cache constants ────────────────────────────────────────────────
  static const _cacheKeyPrefix = 'hindi_trans:';
  static const _maxCacheEntries = 200;

  /// In-memory LRU cache. Key = `"en:<text>"` or `"hi:<text>"`.
  /// Bounded to [_maxCacheEntries]; oldest insertion evicted on overflow.
  final _memCache = <String, String>{};

  // ── English -> Hindi domain dictionary ────────────────────────────────
  static const Map<String, String> _enToHi = {
    // Status strings
    'Your vehicle is ready': 'आपका वाहन तैयार है',
    'Vehicle assigned': 'वाहन असाइन किया गया',
    'Pickup confirmed': 'पिकअप की पुष्टि हो गई',
    'Return approved': 'वापसी स्वीकृत',
    'Return pending approval': 'वापसी अनुमोदन के लिए लंबित',
    'KYC approved': 'KYC स्वीकृत',
    'KYC rejected': 'KYC अस्वीकृत',
    'KYC under review': 'KYC समीक्षाधीन',
    'Account suspended': 'खाता निलंबित',
    'Account active': 'खाता सक्रिय',
    'Guarantor verified': 'गारंटर सत्यापित',
    'Deposit received': 'जमा प्राप्त हुई',
    'Payment successful': 'भुगतान सफल',
    'Payment pending': 'भुगतान लंबित',
    'Top-up successful': 'टॉप-अप सफल',
    'Subscription renewed': 'सदस्यता नवीनीकृत',
    'Plan expired': 'प्लान समाप्त',
    'Low battery': 'कम बैटरी',
    'Battery charged': 'बैटरी चार्ज हो गई',
    'GPS signal lost': 'GPS सिग्नल खो गया',
    'Offline': 'ऑफ़लाइन',
    'Online': 'ऑनलाइन',
    'Synced': 'सिंक हो गया',
    'Team leader assigned': 'टीम लीडर असाइन किया गया',
    'Rental started': 'किराया शुरू',
    'Rental ended': 'किराया समाप्त',
    // Common notification bodies
    'Your KYC has been approved. You can now proceed to the next step.':
        'आपका KYC स्वीकृत हो गया है। अब आप अगले चरण पर जा सकते हैं।',
    'Your security deposit has been received.':
        'आपकी सुरक्षा जमा प्राप्त हो गई है।',
    'Please top up your wallet to avoid suspension.':
        'निलंबन से बचने के लिए कृपया अपना वॉलेट टॉप अप करें।',
    'Your vehicle return has been approved.':
        'आपकी वाहन वापसी स्वीकृत हो गई है।',
    'A new team leader has been assigned to you.':
        'आपको एक नया टीम लीडर असाइन किया गया है।',
    'Your subscription plan has been renewed.':
        'आपकी सदस्यता योजना नवीनीकृत कर दी गई है।',
    'Your wallet balance is low. Please recharge.':
        'आपका वॉलेट बैलेंस कम है। कृपया रिचार्ज करें।',
    // EV fleet domain terms
    'hub': 'हब',
    'vehicle': 'वाहन',
    'scooter': 'स्कूटर',
    'battery': 'बैटरी',
    'odometer': 'ओडोमीटर',
    'rental': 'किराया',
    'deposit': 'जमा',
    'wallet': 'वॉलेट',
    'top-up': 'टॉप-अप',
    'guarantor': 'गारंटर',
    'subscription': 'सदस्यता',
    'plan': 'प्लान',
    'rider': 'राइडर',
    'team leader': 'टीम लीडर',
    'pickup': 'पिकअप',
    'return': 'वापसी',
    'inspection': 'निरीक्षण',
    'signature': 'हस्ताक्षर',
    'document': 'दस्तावेज़',
    'approved': 'स्वीकृत',
    'rejected': 'अस्वीकृत',
    'pending': 'लंबित',
    'active': 'सक्रिय',
    'suspended': 'निलंबित',
    'offline': 'ऑफ़लाइन',
    'online': 'ऑनलाइन',
    'charge': 'शुल्क',
    'penalty': 'जुर्माना',
    'refund': 'रिफ़ंड',
    'reward': 'इनाम',
    'referral': 'रेफ़रल',
    'emergency': 'आपातकालीन',
    'support': 'सहायता',
    'notification': 'सूचना',
    'streak': 'स्ट्रीक',
  };

  /// Reversed dictionary for Hindi -> English lookups.
  static final Map<String, String> _hiToEn =
      Map.fromEntries(_enToHi.entries.map((e) => MapEntry(e.value, e.key)));

  // ── Public API ─────────────────────────────────────────────────────────

  /// Translate [text] from English to Hindi.
  /// Returns [text] unchanged when no match is found (English readable fallback).
  String translateToHindi(String text) {
    if (text.isEmpty) return text;
    return _lookup('en', text, _enToHi);
  }

  /// Translate [text] from Hindi to English.
  /// Returns [text] unchanged when no match is found.
  String translateToEnglish(String text) {
    if (text.isEmpty) return text;
    return _lookup('hi', text, _hiToEn);
  }

  /// Pre-warm the in-memory cache from persistent storage.
  /// Call optionally during app init to avoid the first-access disk read.
  Future<void> preWarm() async {
    try {
      final raw = CacheService().getString('${_cacheKeyPrefix}all');
      if (raw == null || raw.isEmpty) return;
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        for (final entry in decoded.entries) {
          if (_memCache.length >= _maxCacheEntries) break;
          _memCache[entry.key.toString()] = entry.value.toString();
        }
      }
    } catch (e) {
      appDebug('[HindiTranslationService] preWarm failed: $e');
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  String _lookup(
      String direction, String text, Map<String, String> dictionary) {
    final cacheKey = '$direction:$text';

    // 1. In-memory LRU cache hit
    final cached = _memCache[cacheKey];
    if (cached != null) {
      _memCache.remove(cacheKey);
      _memCache[cacheKey] = cached; // move to most-recently-used
      return cached;
    }

    // 2. Exact dictionary match
    final exact = dictionary[text];
    if (exact != null) {
      _insertCache(cacheKey, exact);
      return exact;
    }

    // 3. Case-insensitive match
    for (final entry in dictionary.entries) {
      if (entry.key.toLowerCase() == text.toLowerCase()) {
        _insertCache(cacheKey, entry.value);
        return entry.value;
      }
    }

    // 4. Token-level substitution for longer phrases
    final substituted = _tokenSubstitute(text, dictionary);
    if (substituted != text) {
      _insertCache(cacheKey, substituted);
      return substituted;
    }

    // 5. No match — return original (English readable as fallback)
    return text;
  }

  /// Replaces known domain terms inside a longer phrase. Only substitutes
  /// tokens with key length >= 4 to avoid garbling short abbreviations.
  String _tokenSubstitute(String text, Map<String, String> dictionary) {
    var result = text;
    // Longer phrases first to avoid partial-overlap conflicts
    final entries = dictionary.entries.toList()
      ..sort((a, b) => b.key.length.compareTo(a.key.length));
    for (final entry in entries) {
      if (entry.key.length < 4) continue;
      if (result.toLowerCase().contains(entry.key.toLowerCase())) {
        result = result.replaceAll(
          RegExp(RegExp.escape(entry.key), caseSensitive: false),
          entry.value,
        );
      }
    }
    return result;
  }

  /// Insert [value] at [key] with LRU eviction and best-effort persistence.
  void _insertCache(String key, String value) {
    if (_memCache.length >= _maxCacheEntries) {
      _memCache.remove(_memCache.keys.first);
    }
    _memCache[key] = value;
    _persistCache();
  }

  void _persistCache() {
    try {
      CacheService().setString('${_cacheKeyPrefix}all', jsonEncode(_memCache));
    } catch (e) {
      appDebug('[HindiTranslationService] persist failed: $e');
    }
  }
}
