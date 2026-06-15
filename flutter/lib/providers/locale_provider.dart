import 'package:flutter/material.dart';

import '../gen/app_localizations.dart';
import '../services/cache_service.dart';

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
  static Locale _loadSavedLocale() {
    final saved = CacheService().getLocale();
    if (saved == 'hi') return const Locale('hi');
    return const Locale('en');
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
