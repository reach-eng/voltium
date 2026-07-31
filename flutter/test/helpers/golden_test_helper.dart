import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';

/// Wraps a widget in a MaterialApp and ProviderScope for golden testing.
/// Enforces a strict text scale factor (1.0), consistent font family, and physical size configuration for deterministic rendering across CI.
Widget wrapForGolden(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        fontFamily:
            'Roboto', // Consistent font family for deterministic rendering
      ),
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
