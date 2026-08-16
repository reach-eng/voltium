import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// Riverpod 3.x moved the `Override` type to the `misc` library.
import 'package:flutter_riverpod/misc.dart' show Override;
export 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_theme.dart';

/// Wraps a widget in a MaterialApp and ProviderScope for golden testing.
/// Enforces a strict text scale factor (1.0), consistent font family, and
/// physical size configuration for deterministic rendering across CI.
///
/// Pass `themeMode: ThemeMode.dark` to render with `AppTheme.darkTheme` —
/// this exercises the brightness-aware `ThemeColors` extension and is
/// the canonical way to verify a widget's dark-mode appearance.
///
/// When `themeMode` is non-null, BOTH `theme` and `darkTheme` are set to
/// the canonical `AppTheme.lightTheme`/`AppTheme.darkTheme` so the active
/// theme is determined by `themeMode`. When `themeMode` is null (the
/// default), `theme` is a minimal Roboto-only `ThemeData` for the
/// existing light-mode golden tests that pre-date `AppTheme.lightTheme`.
Widget wrapForGolden(
  Widget child, {
  List<Override> overrides = const [],
  ThemeMode? themeMode,
}) {
  final useAppThemes = themeMode != null;
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      themeMode: themeMode,
      theme: useAppThemes
          ? AppTheme.lightTheme.copyWith(
              // Drop the GoogleFonts text theme for golden determinism.
              // The real app uses GoogleFonts but goldens need pixel-stable
              // glyphs across CI runs.
              textTheme: ThemeData.light().textTheme,
            )
          : ThemeData(
              fontFamily:
                  'Roboto', // Consistent font family for deterministic rendering
            ),
      darkTheme: useAppThemes
          ? AppTheme.darkTheme.copyWith(
              textTheme: ThemeData.dark().textTheme,
            )
          : null,
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: const TextScaler.linear(1.0),
          ),
          child: child!,
        );
      },
      home: Scaffold(
        body: child,
      ),
    ),
  );
}

/// Helper to configure physical size for determinism across environments
void configureGoldenSurface(WidgetTester tester,
    {Size size = const Size(800, 600)}) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
