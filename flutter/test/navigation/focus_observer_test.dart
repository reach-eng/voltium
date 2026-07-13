import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/navigation/focus_observer.dart';

void main() {
  group('FocusObserver (Phase 3.2)', () {
    testWidgets('invokes callback on didPush', (tester) async {
      final observed = <String>[];
      await tester.pumpWidget(MaterialApp(
        navigatorObservers: [
          FocusObserver((r) {
            final name = r.settings.name ?? '<unnamed>';
            observed.add('push:$name');
          }),
        ],
        home: const Scaffold(body: Text('home')),
      ));

      await tester.pumpWidget(MaterialApp(
        navigatorObservers: [
          FocusObserver((r) {
            final name = r.settings.name ?? '<unnamed>';
            observed.add('push:$name');
          }),
        ],
        home: const Scaffold(body: Text('home')),
        routes: {
          '/a': (_) => const Scaffold(body: Text('a')),
        },
      ));

      // The initial route is named '/'.
      // (MaterialApp uses '/' for the initial route by default.)
      await tester.tap(find.text('home'));
      // Navigate to a named route.
      final navState = tester.state<NavigatorState>(find.byType(Navigator));
      navState.pushNamed('/a');
      await tester.pump(const Duration(seconds: 1));

      // didPush should have fired with the new route.
      expect(
        observed.any((s) => s.contains('push:/a')),
        isTrue,
        reason: 'expected an observed push for /a, got: $observed',
      );
    });
  });
}
