import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/cache_service.dart';

/// Manages the app locale state.
///
/// Persists the chosen language code to [CacheService] so it survives
/// app restarts.  [LocaleProvider] is consumed by [MaterialApp] to rebuild
/// the widget tree with the new locale.
class LocaleProvider extends ChangeNotifier {
  LocaleProvider() {
    _locale = _loadSavedLocale();
  }

  static const List<Locale> supportedLocales = [
    Locale('en'),
    Locale('hi'),
  ];

  late Locale _locale;

  Locale get locale => _locale;

  /// Localised string helper — convenient access without BuildContext.
  AppLocalizations get l10n => lookupAppLocalizations(_locale);

  /// Load the persisted locale from shared_preferences (synchronous).
  ///
  /// Resolution order (R10 polish #7, §1.14):
  ///   1. User's persisted choice (set via `setLocale`).
  ///   2. System locale, if it matches one of `supportedLocales`.
  ///   3. Default to English.
  static Locale _loadSavedLocale() {
    final saved = CacheService().getLocale();
    if (saved == 'hi') return const Locale('hi');
    if (saved == 'en') return const Locale('en');

    // No persisted choice — fall back to system locale if it matches.
    final systemLocale = _resolveSystemLocale();
    if (systemLocale != null) return systemLocale;

    return const Locale('en');
  }

  /// Try to resolve the system locale to one of `supportedLocales`.
  /// Returns null if the system locale doesn't match any supported language.
  static Locale? _resolveSystemLocale() {
    try {
      final systemLanguageCode =
          PlatformDispatcher.instance.locale.languageCode.toLowerCase();
      for (final supported in supportedLocales) {
        if (supported.languageCode.toLowerCase() == systemLanguageCode) {
          return supported;
        }
      }
    } catch (_) {
      // PlatformDispatcher is unavailable (e.g. in some test environments).
      return null;
    }
    return null;
  }

  /// Switch the locale and persist the choice.
  Future<void> setLocale(Locale locale) async {
    if (_locale == locale) return;
    _locale = locale;
    await CacheService().setLocale(locale.languageCode);
    notifyListeners();
  }

  /// Convenience: switch to English.
  Future<void> setEnglish() => setLocale(const Locale('en'));

  /// Convenience: switch to Hindi.
  Future<void> setHindi() => setLocale(const Locale('hi'));

  /// Whether the current locale is Hindi.
  bool get isHindi => _locale.languageCode == 'hi';

  /// Whether the current locale is English.
  bool get isEnglish => _locale.languageCode == 'en';
}
