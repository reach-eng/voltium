// R4.3c-1 — Riverpod v3 `ThemeProvider` (Notifier + immutable state).
//
// Replaces the previous `ChangeNotifier`-based class while keeping
// the same call surface (`isDarkMode`, `setDarkMode`, `toggleTheme`,
// `themeMode`) so existing call sites that go through
// `ref.read(themeProviderRef)` / `ref.watch(themeProviderRef)` keep
// working without renames.
//
// Migration plan (R4.3 sub-steps):
//   R4.3a — AppStateNotifier (done)
//   R4.3b — appStateViewProvider (done)
//   R4.3c — this file + LocaleProvider
//   R4.3d — feature provider batch migration
//   R4.4 — auth flow returns the new AppState
//   R4.5 — polling scoping
//   R4.6 — go_router + E2E tests

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

/// Immutable theme state — tri-state: [ThemeMode.light], [ThemeMode.dark]
/// or [ThemeMode.system] ("Follow System").
@immutable
class ThemeState {
  final ThemeMode themeMode;
  const ThemeState({this.themeMode = ThemeMode.system});

  /// Effective dark state — resolves [ThemeMode.system] against the
  /// platform brightness so call sites that only care about the rendered
  /// appearance (e.g. dashboard card colours) keep working unchanged.
  bool get isDarkMode {
    if (themeMode == ThemeMode.dark) return true;
    if (themeMode == ThemeMode.light) return false;
    return WidgetsBinding.instance.platformDispatcher.platformBrightness ==
        Brightness.dark;
  }

  bool get isLightMode => !isDarkMode;
  bool get isFollowingSystem => themeMode == ThemeMode.system;

  ThemeState copyWith({ThemeMode? themeMode}) =>
      ThemeState(themeMode: themeMode ?? this.themeMode);
}

/// Riverpod v3 Notifier. Initial value is loaded synchronously from
/// [CacheService] in `build()`.
class ThemeNotifier extends Notifier<ThemeState> {
  @override
  ThemeState build() {
    switch (CacheService().getThemePreference()) {
      case CacheService.themePreferenceDark:
        return const ThemeState(themeMode: ThemeMode.dark);
      case CacheService.themePreferenceLight:
        return const ThemeState(themeMode: ThemeMode.light);
      default:
        // Nothing persisted (or legacy value migrated to a known code
        // already handled above) → follow the OS brightness. This is
        // also the first-launch default: no stored choice means the app
        // mirrors the phone's theme until the rider picks one explicitly.
        return const ThemeState(themeMode: ThemeMode.system);
    }
  }

  /// Set the tri-state theme and persist the choice.
  Future<void> setThemeMode(ThemeMode mode) async {
    if (state.themeMode == mode) return;
    state = ThemeState(themeMode: mode);
    await CacheService().setThemePreference(_themeModeCode(mode));
    // PR-VER-2026-08-07 (DARK_MODE P1-3): emit a theme-changed analytics
    // event so product can measure theme adoption (PII-free payload).
    await PostHogService.capture('theme_changed', properties: {
      'theme_mode': mode.name,
      'is_dark_mode': state.isDarkMode.toString(),
    });
  }

  /// Switch to dark / light mode and persist the choice.
  Future<void> setDarkMode(bool value) async =>
      setThemeMode(value ? ThemeMode.dark : ThemeMode.light);

  /// Toggle between dark and light (pinning the result; a system-following
  /// app toggles to the opposite of the current effective brightness).
  Future<void> toggleTheme() async => setDarkMode(!state.isDarkMode);

  static String _themeModeCode(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.dark:
        return CacheService.themePreferenceDark;
      case ThemeMode.light:
        return CacheService.themePreferenceLight;
      case ThemeMode.system:
        return CacheService.themePreferenceSystem;
    }
  }
}

/// Backwards-compat alias used by call sites that still reference
/// `ThemeProvider` as a type. The class no longer extends
/// `ChangeNotifier`; the new entrypoint is `themeProvider` (below).
typedef ThemeProvider = ThemeNotifier;

/// Riverpod v3 provider for the app theme.
final themeProvider = NotifierProvider<ThemeNotifier, ThemeState>(
  ThemeNotifier.new,
);
