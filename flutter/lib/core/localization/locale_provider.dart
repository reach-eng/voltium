// R4.3c-1 — Riverpod v3 `LocaleProvider` (Notifier + immutable state).
//
// Replaces the previous `ChangeNotifier`-based class while keeping
// the same call surface (`locale`, `l10n`, `setLocale`, `setEnglish`,
// `setHindi`, `isHindi`, `isEnglish`, `supportedLocales`) so existing
// call sites continue to work without renames.

import 'dart:async';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/utils/app_logger.dart';

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

  /// Whether the current locale is the system-derived one (i.e. the
  /// rider has not explicitly chosen a language). Lets the settings
  /// UI render the "Follow system" radio as selected.
  bool get isFollowingSystem {
    final persisted = CacheService().getLocale();
    if (persisted != null) return false;
    final system = LocaleNotifier._resolveSystemLocale();
    return system != null && locale == system;
  }

  LocaleState copyWith({Locale? locale}) =>
      LocaleState(locale: locale ?? this.locale);
}

/// Riverpod v3 Notifier. Initial value is loaded synchronously from
/// [CacheService] in `build()`.
class LocaleNotifier extends Notifier<LocaleState> {
  // LANGUAGE-AUDIT (2026-08-16) #11: the supported-locales list is
  // now a static const [SupportedLanguage] list. Adding a 3rd
  // language is a one-line addition to [supportedLanguages]
  // PLUS an `app_<code>.arb` file plus a `preferred-supported-locales`
  // entry in l10n.yaml. Everything else (the dialog, the settings
  // screen label, the system-resolution loop) iterates over this
  // list automatically.
  //
  // Currently supported: en (English), hi (Hindi). The product
  // spec is bilingual — a 3rd language is a product decision, not
  // a code decision. When product asks for one, the
  // `scripts/scaffold_locale.dart` script + this list + the
  // `l10n.yaml` `preferred-supported-locales` are the only
  // three places to touch.
  static const List<SupportedLanguage> supportedLanguages = [
    SupportedLanguage(
      code: 'en',
      englishName: 'English',
      nativeName: 'English',
    ),
    SupportedLanguage(
      code: 'hi',
      englishName: 'Hindi',
      nativeName: 'हिंदी',
    ),
  ];

  /// Backwards-compat: the Flutter MaterialApp wants a
  /// `List<Locale>`. Derived from [supportedLanguages].
  static List<Locale> get supportedLocales =>
      supportedLanguages.map((l) => Locale(l.code)).toList(growable: false);

  @override
  LocaleState build() {
    final initial = _loadSavedLocale();
    // LANGUAGE-AUDIT (2026-08-16) #13: emit a `locale_resolved`
    // event on every cold start so product can measure the
    // fraction of riders seeing en vs hi vs system-fallback
    // in production. Without this, only riders who explicitly
    // open the language dialog produce analytics — a
    // Hindi-system-locale rider who never touches the setting
    // is invisible to PostHog. Fires asynchronously so the
    // initial frame isn't blocked; the payload is just a
    // BCP-47 code (no PII).
    Future.microtask(() {
      PostHogService.capture('locale_resolved', properties: {
        'code': initial.languageCode,
        'is_explicit_choice': CacheService().getLocale() != null,
      });
    });
    return LocaleState(locale: initial);
  }

  /// Switch the locale and persist the choice.
  ///
  /// LANGUAGE-AUDIT (2026-08-16) #6: in addition to writing to
  /// SharedPreferences, this method now mirrors the choice to the
  /// server via `PUT /api/rider/profile { preferredLocale: <code> }`.
  /// The server copy is the source of truth for cross-device sync;
  /// the SharedPreferences copy is the source of truth for offline
  /// startup (the system locale resolver falls back to that on cold
  /// start before the network profile is fetched).
  Future<void> setLocale(Locale locale) async {
    if (state.locale == locale) return;
    final previousCode = state.locale.languageCode;
    state = state.copyWith(locale: locale);
    await CacheService().setLocale(locale.languageCode);
    // Mirror to server (best-effort). Failures are silent — the
    // local copy is still correct, and the next profile fetch will
    // re-sync. A rider with no network on a new device still gets
    // their last-known language on first launch.
    unawaited(_syncPreferredLocale(locale.languageCode));
    // PR-43 (DARK_MODE P1-3): emit a locale-changed analytics event so
    // product can measure language adoption (PII-free payload — just
    // the BCP-47 language code). Mirrors the `theme_changed` event
    // fired from `ThemeNotifier.setDarkMode`.
    await PostHogService.capture('locale_changed', properties: {
      'from': previousCode,
      'to': locale.languageCode,
    });
  }

  /// PR-44 (DARK_MODE P1-1): opt back into "follow system locale".
  ///
  /// The very first launch already follows the system (see
  /// [_loadSavedLocale]), but once a rider picks a specific language
  /// the choice is persisted and sticky. `setFollowSystem` clears the
  /// persisted choice and re-derives the locale from the system.
  /// Re-runs of the system locale (e.g. user changes phone language
  /// while the app is open) are not automatically picked up — that
  /// requires a full app rebuild because Flutter caches the
  /// `PlatformDispatcher.locale` at startup.
  ///
  /// LANGUAGE-AUDIT (2026-08-16) #6: also clears the server-side
  /// `preferredLocale` by sending an empty string. The validator
  /// treats empty as null and the rider.use-cases writes through
  /// the SAFE_RIDER_FIELDS allowlist.
  Future<void> setFollowSystem() async {
    // Clear the persisted explicit choice; the next launch re-derives
    // from the system locale and `isFollowingSystem` stays true.
    await CacheService().clearLocale();
    unawaited(_syncPreferredLocale(null));
    final system = _resolveSystemLocale();
    final target = system ?? const Locale('en');
    if (state.locale != target) {
      final previousCode = state.locale.languageCode;
      state = state.copyWith(locale: target);
      // PR-43 (DARK_MODE P1-3): analytics mirror of `setLocale`.
      await PostHogService.capture('locale_changed', properties: {
        'from': previousCode,
        'to': target.languageCode,
      });
    }
  }

  /// LANGUAGE-AUDIT (2026-08-16) #6: apply the server's preferred
  /// locale to local state, but ONLY if the rider has not made an
  /// explicit local choice. Local choices are the source of truth
  /// for offline startup; the server is the source of truth for
  /// cross-device sync — we respect both by checking the local
  /// SharedPreferences first.
  ///
  /// Called by [RiderNotifier._doRefreshFromApi] after a successful
  /// profile fetch. Safe to call repeatedly (no-op if the local
  /// choice already matches the server's).
  Future<void> maybeApplyFromServer(String? serverPreferredLocale) async {
    if (serverPreferredLocale == null || serverPreferredLocale.isEmpty) {
      return; // server has no preference; nothing to apply
    }
    final localSaved = CacheService().getLocale();
    if (localSaved != null) {
      // Rider has an explicit local choice. Don't override it.
      return;
    }
    final target = Locale(serverPreferredLocale);
    if (state.locale == target) return;
    // Adopt the server's choice without re-syncing it back (we
    // just received it, the server is already in sync).
    state = state.copyWith(locale: target);
    await CacheService().setLocale(target.languageCode);
  }

  /// LANGUAGE-AUDIT (2026-08-16) #6: best-effort PUT to the server.
  /// The shared-prefs copy is the source of truth for offline startup
  /// and is the value [setLocale] returns synchronously. The server
  /// copy is only for cross-device sync, so a failure here does NOT
  /// fail the local change. [code] is the BCP-47 language code (e.g.
  /// `en`, `hi`) or `null` to clear the server-side preference
  /// (i.e. switch back to "follow system").
  Future<void> _syncPreferredLocale(String? code) async {
    try {
      // PR-13: the wrapper's `.put('/api/rider/profile', body: ...)`
      // was a 1-line pass-through to ApiClient.put. Use ApiClient
      // directly. The new-instance allocation is cheap (it shares
      // the shared pinned HTTP client).
      // ignore: prefer_const_constructors
      final api = ApiClient();
      await api.put(
        '/api/rider/profile',
        body: {'preferredLocale': code ?? ''},
      );
    } catch (e) {
      // Silent. The local copy is correct; the server will re-sync
      // on the next profile fetch.
      appDebug('[localeProvider] preferredLocale sync failed: $e');
    }
  }

  /// Convenience: switch to English.
  Future<void> setEnglish() => setLocale(const Locale('en'));

  /// Convenience: switch to Hindi.
  Future<void> setHindi() => setLocale(const Locale('hi'));

  /// Look up the human-readable name of a language in its own
  /// script, or in English if the script is unavailable. Used by
  /// the settings screen to show the current-language label and
  /// by the dialog to render each ListTile.
  ///
  /// Prefers the ARB-translated name (e.g. `l10n.settings_hindi`
  /// for Hindi) when one exists; otherwise falls back to the
  /// [SupportedLanguage.nativeName] literal.
  static String displayNameFor(Locale locale, AppLocalizations l10n) {
    // LANGUAGE-AUDIT (2026-08-16) #11: prefer the ARB key when
    // present so translators can override the literal. The keys
    // are named `settings_<code>` (e.g. `settings_hindi`).
    switch (locale.languageCode) {
      case 'en':
        return l10n.settings_english;
      case 'hi':
        return l10n.settings_hindi;
      default:
        final hit = supportedLanguages
            .where((l) => l.code == locale.languageCode)
            .firstOrNull;
        return hit?.nativeName ?? locale.languageCode;
    }
  }

  /// Load the persisted locale from shared_preferences (synchronous).
  ///
  /// Resolution order (R10 polish #7, §1.14):
  ///   1. User's persisted choice (set via `setLocale`).
  ///   2. System locale, if it matches one of `supportedLocales`.
  ///   3. Default to English.
  static Locale _loadSavedLocale() {
    final saved = CacheService().getLocale();
    if (saved != null) {
      final hit = supportedLanguages.where((l) => l.code == saved).firstOrNull;
      if (hit != null) return Locale(saved);
    }

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
    } catch (e) {
      // PlatformDispatcher is unavailable (e.g. in some test
      // environments). ONBOARDING-AUDIT 2026-08-14 P3-6: log in
      // debug mode so silent locale-resolution failures are visible.
      appDebug('[localeProvider] system locale probe failed: $e');
      return null;
    }
    return null;
  }
}

/// LANGUAGE-AUDIT (2026-08-16) #11: a single source of truth for
/// supported languages. When product asks for a 3rd language the
/// flow is: run `dart run scripts/scaffold_locale.dart <code>` to
/// generate `app_<code>.arb`, add an entry to
/// [supportedLanguages] below, and add the code to
/// `preferred-supported-locales` in l10n.yaml. The dialog, the
/// settings tile, and the system-resolution loop all iterate
/// this list — no other code change is needed.
@immutable
class SupportedLanguage {
  /// BCP-47 language code, e.g. `en`, `hi`, `ta`.
  final String code;

  /// English name of the language, e.g. `Hindi`.
  final String englishName;

  /// Native-script name, e.g. `हिंदी`, `தமிழ்`.
  final String nativeName;

  const SupportedLanguage({
    required this.code,
    required this.englishName,
    required this.nativeName,
  });

  Locale get locale => Locale(code);

  @override
  String toString() => 'SupportedLanguage($code, $englishName)';
}

/// Backwards-compat alias used by call sites that still reference
/// `LocaleProvider` as a type. The class no longer extends
/// `ChangeNotifier`; the new entrypoint is `localeProvider` (below).
typedef LocaleProvider = LocaleNotifier;

/// Riverpod v3 provider for the app locale.
final localeProvider = NotifierProvider<LocaleNotifier, LocaleState>(
  LocaleNotifier.new,
);
