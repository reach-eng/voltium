import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/screens/splash_screen.dart';

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

    // Initial state: Logo should be there
    expect(find.byType(Image), findsOneWidget);

    // Check for title (might be opacity 0 initially, but present in tree)
    expect(find.text('Welcome to Voltium!'), findsOneWidget);

    // Advance time to trigger animations and completion
    // The sequence takes about 2.5s according to comments in splash_screen.dart
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 1300));
    await tester.pumpAndSettle(); // Catch any remaining frames

    // Check if onComplete was called
    expect(completed, isTrue);
  });

  testWidgets('SplashScreen shows loading label', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: SplashScreen(onComplete: () {}),
      ),
    );

    // Initial wait for bar delay (1.2s total delay for opacity to fade in)
    await tester.pump(const Duration(milliseconds: 2000));

    expect(find.text('Loading experience...'), findsOneWidget);

    // Exhaust remaining timers to avoid "Timer still pending" error
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
  });
}
