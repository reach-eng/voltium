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

/// Immutable theme state.
@immutable
class ThemeState {
  final bool isDarkMode;
  const ThemeState({this.isDarkMode = false});

  bool get isLightMode => !isDarkMode;
  ThemeMode get themeMode => isDarkMode ? ThemeMode.dark : ThemeMode.light;

  ThemeState copyWith({bool? isDarkMode}) =>
      ThemeState(isDarkMode: isDarkMode ?? this.isDarkMode);
}

/// Riverpod v3 Notifier. Initial value is loaded synchronously from
/// [CacheService] in `build()`.
class ThemeNotifier extends Notifier<ThemeState> {
  @override
  ThemeState build() {
    final isDark = CacheService().getDarkMode() ?? false;
    return ThemeState(isDarkMode: isDark);
  }

  /// Switch to dark / light mode and persist the choice.
  Future<void> setDarkMode(bool value) async {
    if (state.isDarkMode == value) return;
    state = state.copyWith(isDarkMode: value);
    await CacheService().setDarkMode(value);
  }

  /// Toggle the current theme mode.
  Future<void> toggleTheme() async => setDarkMode(!state.isDarkMode);
}

/// Backwards-compat alias used by call sites that still reference
/// `ThemeProvider` as a type. The class no longer extends
/// `ChangeNotifier`; the new entrypoint is `themeProvider` (below).
typedef ThemeProvider = ThemeNotifier;

/// Riverpod v3 provider for the app theme.
final themeProvider = NotifierProvider<ThemeNotifier, ThemeState>(
  ThemeNotifier.new,
);
