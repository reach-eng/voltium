import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/splash_screen.dart';

void main() {
  testWidgets('SplashScreen displays title and triggers callback',
      (WidgetTester tester) async {
    bool completed = false;

    await tester.pumpWidget(
      MaterialApp(
        home: SplashScreen(
          onComplete: () {
            completed = true;
          },
        ),
      ),
    );

    // Initial state: bolt icon (not an Image widget)
    expect(find.byIcon(Icons.bolt), findsOneWidget);

    // Check for title
    expect(find.text('Voltium'), findsOneWidget);

    // Advance time to trigger animations and completion
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 2000));
    await tester.pumpAndSettle();

    // Check if onComplete was called
    expect(completed, isTrue);
  });

  testWidgets('SplashScreen shows connecting label', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: SplashScreen(onComplete: () {}),
      ),
    );

    // Initial wait for bar delay
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('CONNECTING TO GRID'), findsOneWidget);

    // Exhaust remaining timers to avoid "Timer still pending" error
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
  });
}
