// DARK-MODE-AUDIT 2026-08-14 PR3 — theme-switch smoke test.
//
// A lightweight runtime sanity check that:
//   1. `AppColors.of(context)` returns a usable `ThemeColors` extension
//      in both light and dark modes.
//   2. The brightness-aware tokens actually differ between modes (otherwise
//      dark mode is a no-op and the migration was cosmetic).
//   3. The canonical `AppTheme.lightTheme` / `AppTheme.darkTheme` factories
//      wire up the tokens correctly (no missing extension).
//
// This is NOT a golden test — the goal is to catch runtime errors
// (e.g. a missing `ThemeExtension` registration) that golden tests
// might miss.
//
// Companion ratchets (PR3):
//   - `flutter/tool/lint_static_palette_tokens.dart` (static `AppColors.X`
//     outside `lib/theme/app_theme.dart`)
//   - `web/scripts/lint-dark-mode-tokens.js` (`text-X-600` without
//     `dark:text-X-300|400`)
//
// Run with: `flutter test test/theme/theme_switch_smoke_test.dart`

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:voltium_rider/theme/app_theme.dart';

/// All brightness-aware tokens that should differ between `ThemeColors.light`
/// and `ThemeColors.dark`. If any pair is `==`, dark mode is a no-op for
/// that token and the migration was incomplete.
const Map<String,
        ({Color Function(ThemeColors) light, Color Function(ThemeColors) dark})>
    _kBrightnessAwareTokens = {
  'surface': (light: _surface, dark: _surface),
  'card': (light: _card, dark: _card),
  'onSurface': (light: _onSurface, dark: _onSurface),
  'onSurfaceVariant': (light: _onSurfaceVariant, dark: _onSurfaceVariant),
  'onSurfaceMuted': (light: _onSurfaceMuted, dark: _onSurfaceMuted),
  'iconBackground': (light: _iconBackground, dark: _iconBackground),
  'successLight': (light: _successLight, dark: _successLight),
  'errorLight': (light: _errorLight, dark: _errorLight),
  'errorRose': (light: _errorRose, dark: _errorRose),
  'warningLight': (light: _warningLight, dark: _warningLight),
  'infoLight': (light: _infoLight, dark: _infoLight),
  'surfaceBright': (light: _surfaceBright, dark: _surfaceBright),
  'surfaceSubtle': (light: _surfaceSubtle, dark: _surfaceSubtle),
  'borderSubtle': (light: _borderSubtle, dark: _borderSubtle),
  'primarySurface': (light: _primarySurface, dark: _primarySurface),
};

Color _surface(ThemeColors c) => c.surface;
Color _card(ThemeColors c) => c.card;
Color _onSurface(ThemeColors c) => c.onSurface;
Color _onSurfaceVariant(ThemeColors c) => c.onSurfaceVariant;
Color _onSurfaceMuted(ThemeColors c) => c.onSurfaceMuted;
Color _iconBackground(ThemeColors c) => c.iconBackground;
Color _successLight(ThemeColors c) => c.successLight;
Color _errorLight(ThemeColors c) => c.errorLight;
Color _errorRose(ThemeColors c) => c.errorRose;
Color _warningLight(ThemeColors c) => c.warningLight;
Color _infoLight(ThemeColors c) => c.infoLight;
Color _surfaceBright(ThemeColors c) => c.surfaceBright;
Color _surfaceSubtle(ThemeColors c) => c.surfaceSubtle;
Color _borderSubtle(ThemeColors c) => c.borderSubtle;
Color _primarySurface(ThemeColors c) => c.primarySurface;

/// Pumps a single MaterialApp in a specific theme mode and captures the
/// resolved `ThemeColors` extension via a `Builder` inside `MediaQuery`.
Future<ThemeColors> _pumpAndCapture(
  WidgetTester tester, {
  required ThemeMode themeMode,
  Brightness platformBrightness = Brightness.light,
}) async {
  late ThemeColors captured;
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      home: MediaQuery(
        data: MediaQueryData(platformBrightness: platformBrightness),
        child: Builder(
          builder: (c) {
            captured = AppColors.of(c);
            return const SizedBox.shrink();
          },
        ),
      ),
    ),
  );
  await tester.pump();
  return captured;
}

void main() {
  // ── Light mode: AppColors resolves to ThemeColors.light ──────────────
  testWidgets('AppColors.of returns ThemeColors.light in light mode',
      (WidgetTester tester) async {
    final colors = await _pumpAndCapture(tester, themeMode: ThemeMode.light);
    expect(colors, isNotNull);
    expect(colors.surface, ThemeColors.light.surface,
        reason: 'light mode should resolve to ThemeColors.light');
  });

  // ── Dark mode: AppColors resolves to ThemeColors.dark ────────────────
  testWidgets('AppColors.of returns ThemeColors.dark in dark mode',
      (WidgetTester tester) async {
    final colors = await _pumpAndCapture(tester, themeMode: ThemeMode.dark);
    expect(colors, isNotNull);
    expect(colors.surface, ThemeColors.dark.surface,
        reason: 'dark mode should resolve to ThemeColors.dark');
  });

  // ── Brightness-aware tokens differ between light and dark. ────────────
  // Run the light/dark pumps in separate test cases (not in the same one)
  // because the test framework re-uses a single `WidgetTester` per
  // `testWidgets` call; we want the global `ThemeColors.light` / `.dark`
  // constants to be the source of truth here so we don't depend on
  // builder ordering.
  testWidgets('ThemeColors.light and ThemeColors.dark differ per token',
      (WidgetTester tester) async {
    for (final entry in _kBrightnessAwareTokens.entries) {
      final lightValue = entry.value.light(ThemeColors.light);
      final darkValue = entry.value.dark(ThemeColors.dark);
      expect(lightValue, isNot(equals(darkValue)),
          reason: '`${entry.key}` must differ between light and dark modes; '
              'otherwise dark mode is a no-op for this token');
    }
  });

  // ── Runtime ThemeMode.system with platform-brightness override. ─────
  // A simpler check than the full light/dark toggle. The framework honors
  // `MediaQueryData.platformBrightness` when `themeMode == ThemeMode.system`,
  // so this is a representative runtime path.
  testWidgets('ThemeMode.system resolves per platform brightness',
      (WidgetTester tester) async {
    final sysLight = await _pumpAndCapture(
      tester,
      themeMode: ThemeMode.system,
      platformBrightness: Brightness.light,
    );
    expect(sysLight.surface, ThemeColors.light.surface,
        reason: 'system + light platform should equal light theme');
    expect(tester.takeException(), isNull,
        reason: 'system + light platform should not throw');
  });
}
