import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

void main() {
  group('CMP-022: Material 3 Typography & Dynamic Type Scaling', () {
    test('AppTheme wires Material 3 TextTheme in both light and dark themes',
        () {
      final light = AppTheme.lightTheme;
      final dark = AppTheme.darkTheme;

      expect(light.useMaterial3, isTrue);
      expect(dark.useMaterial3, isTrue);

      // Verify Material 3 text theme tiers are present and match AppTypography specs
      expect(light.textTheme.displayLarge?.fontSize, 40);
      expect(light.textTheme.displayMedium?.fontSize, 32);
      expect(light.textTheme.headlineLarge?.fontSize, 28);
      expect(light.textTheme.headlineMedium?.fontSize, 24);
      expect(light.textTheme.headlineSmall?.fontSize, 20);
      expect(light.textTheme.titleLarge?.fontSize, 18);
      expect(light.textTheme.titleMedium?.fontSize, 16);
      expect(light.textTheme.titleSmall?.fontSize, 14);
      expect(light.textTheme.bodyLarge?.fontSize, 16);
      expect(light.textTheme.bodyMedium?.fontSize, 14);
      expect(light.textTheme.bodySmall?.fontSize, 12);
      expect(light.textTheme.labelLarge?.fontSize, 14);
      expect(light.textTheme.labelMedium?.fontSize, 12);
      expect(light.textTheme.labelSmall?.fontSize, 11);

      // Dark theme check
      expect(dark.textTheme.bodyMedium?.fontSize, 14);
      expect(dark.textTheme.titleMedium?.fontSize, 16);
    });

    testWidgets('AppTypography.scaled adapts font sizes to ambient TextScaler',
        (tester) async {
      late TextStyle standardScaled;
      late TextStyle largeScaled;
      late TextStyle extremeScaled;
      late TextStyle reducedScaled;

      // 1. Standard scale (1.0x)
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(1.0)),
            child: Builder(
              builder: (context) {
                standardScaled =
                    AppTypography.scaled(context, AppTypography.bodyMedium);
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      );
      expect(standardScaled.fontSize, 14.0);

      // 2. Large scale (1.5x accessibility setting)
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(1.5)),
            child: Builder(
              builder: (context) {
                largeScaled =
                    AppTypography.scaled(context, AppTypography.bodyMedium);
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      );
      expect(largeScaled.fontSize, 21.0); // 14 * 1.5

      // 3. Extreme scale (3.0x -> clamped to maxScale 2.0x)
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(3.0)),
            child: Builder(
              builder: (context) {
                extremeScaled =
                    AppTypography.scaled(context, AppTypography.bodyMedium);
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      );
      expect(extremeScaled.fontSize, 28.0); // 14 * 2.0 (clamped)

      // 4. Reduced scale (0.5x -> clamped to minScale 0.8x)
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(0.5)),
            child: Builder(
              builder: (context) {
                reducedScaled =
                    AppTypography.scaled(context, AppTypography.bodyMedium);
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      );
      expect(
          reducedScaled.fontSize!, closeTo(11.2, 0.001)); // 14 * 0.8 (clamped)
    });

    testWidgets('ScalableTextStyle extension works identically',
        (tester) async {
      late TextStyle scaledFromExtension;

      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(1.25)),
            child: Builder(
              builder: (context) {
                scaledFromExtension = AppTypography.titleLarge.scaled(context);
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      );

      // 18.0 * 1.25 = 22.5
      expect(scaledFromExtension.fontSize, 22.5);
    });
  });
}
