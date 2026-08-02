// R4.3c-1 — Riverpod v3 `LocaleProvider` (Notifier + immutable state).
//
// Replaces the previous `ChangeNotifier`-based class while keeping
// the same call surface (`locale`, `l10n`, `setLocale`, `setEnglish`,
// `setHindi`, `isHindi`, `isEnglish`, `supportedLocales`) so existing
// call sites continue to work without renames.

import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/cache_service.dart';

/// Immutable locale state.
@immutable
class LocaleState {
  final Locale locale;
  const LocaleState({required this.locale});

  /// Localised string helper — convenient access without BuildContext.
  AppLocalizations get l10n => lookupAppLocalizations(locale);

  /// Whether the current locale is Hindi.
  bool get isHindi => locale.languageCode == 'hi';

  /// Whether the current locale is English.
  bool get isEnglish => locale.languageCode == 'en';

  LocaleState copyWith({Locale? locale}) =>
      LocaleState(locale: locale ?? this.locale);
}

/// Riverpod v3 Notifier. Initial value is loaded synchronously from
/// [CacheService] in `build()`.
class LocaleNotifier extends Notifier<LocaleState> {
  static const List<Locale> supportedLocales = [
    Locale('en'),
    Locale('hi'),
  ];

  @override
  LocaleState build() {
    return LocaleState(locale: _loadSavedLocale());
  }

  /// Switch the locale and persist the choice.
  Future<void> setLocale(Locale locale) async {
    if (state.locale == locale) return;
    state = state.copyWith(locale: locale);
    await CacheService().setLocale(locale.languageCode);
  }

  /// Convenience: switch to English.
  Future<void> setEnglish() => setLocale(const Locale('en'));

  /// Convenience: switch to Hindi.
  Future<void> setHindi() => setLocale(const Locale('hi'));

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
}

/// Backwards-compat alias used by call sites that still reference
/// `LocaleProvider` as a type. The class no longer extends
/// `ChangeNotifier`; the new entrypoint is `localeProvider` (below).
typedef LocaleProvider = LocaleNotifier;

/// Riverpod v3 provider for the app locale.
final localeProvider = NotifierProvider<LocaleNotifier, LocaleState>(
  LocaleNotifier.new,
);
