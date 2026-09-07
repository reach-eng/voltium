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
  final bool isAmoled;

  const ThemeState({
    this.themeMode = ThemeMode.system,
    this.isAmoled = false,
  });

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

  ThemeState copyWith({ThemeMode? themeMode, bool? isAmoled}) => ThemeState(
        themeMode: themeMode ?? this.themeMode,
        isAmoled: isAmoled ?? this.isAmoled,
      );
}

/// Riverpod v3 Notifier. Initial value is loaded synchronously from
/// [CacheService] in `build()`.
class ThemeNotifier extends Notifier<ThemeState> {
  @override
  ThemeState build() {
    // P2-1 (2026-09-07): read both the tri-state theme and the AMOLED
    // sub-preference from CacheService so a restart preserves the
    // exact visual state the rider left.
    final isAmoled = CacheService().getAmoledPreference();
    switch (CacheService().getThemePreference()) {
      case CacheService.themePreferenceDark:
        return ThemeState(themeMode: ThemeMode.dark, isAmoled: isAmoled);
      case CacheService.themePreferenceLight:
        return ThemeState(themeMode: ThemeMode.light, isAmoled: isAmoled);
      default:
        // Nothing persisted (or legacy value migrated to a known code
        // already handled above) → follow the OS brightness. This is
        // also the first-launch default: no stored choice means the app
        // mirrors the phone's theme until the rider picks one explicitly.
        return ThemeState(themeMode: ThemeMode.system, isAmoled: isAmoled);
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

  /// Toggle between dark and light.
  ///
  /// P2-2 (2026-09-07), accepted-by-audit: this is a **pinning** toggle.
  /// From [ThemeMode.system] it flips to the opposite of the current
  /// effective platform brightness and persists that concrete mode — the
  /// "Follow System" choice is dropped, and there is no way back to
  /// system-follow through this method. The only path back is the theme
  /// dialog's "Follow system" option ([setThemeMode]
  /// (ThemeMode.system)), so any quick-toggle UI built on this method
  /// must either accept that UX or pair the toggle with an explicit
  /// system-follow affordance.
  ///
  /// Currently has no call sites; kept for the documented call surface.
  Future<void> toggleTheme() async => setDarkMode(!state.isDarkMode);

  /// Enable or disable True AMOLED Black dark theme.
  ///
  /// P2-1 (2026-09-07): the choice is now persisted via [CacheService]
  /// under `volt_amoled`. A previous version held the flag in memory
  /// only, so an app restart silently dropped the toggle. The write
  /// is fire-and-forget; the in-memory state updates synchronously so
  /// the UI doesn't wait for the prefs flush.
  Future<void> setAmoled(bool value) async {
    if (state.isAmoled == value) return;
    state = state.copyWith(isAmoled: value);
    await CacheService().setAmoledPreference(value);
  }

  /// Toggle True AMOLED Black dark theme.
  Future<void> toggleAmoled() => setAmoled(!state.isAmoled);

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
