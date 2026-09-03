import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/intent_of_use_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

void main() {
  Widget createTestWidget({required Widget child}) {
    return ProviderScope(
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: child,
      ),
    );
  }

  testWidgets(
      'IntentOfUseScreen renders selection cards and confirm button is initially disabled',
      (WidgetTester tester) async {
    await tester.pumpWidget(createTestWidget(child: const IntentOfUseScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Intent of Use'), findsOneWidget);
    expect(find.byKey(const Key('deliverWithUsCard')), findsOneWidget);
    expect(find.byKey(const Key('personalUsageCard')), findsOneWidget);

    final confirmButton = tester
        .widget<ElevatedButton>(find.byKey(const Key('confirmIntentButton')));
    expect(confirmButton.onPressed, isNull);
  });

  testWidgets('Selecting an intent enables confirm button',
      (WidgetTester tester) async {
    await tester.pumpWidget(createTestWidget(child: const IntentOfUseScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('deliverWithUsCard')));
    await tester.pumpAndSettle();

    final confirmButton = tester
        .widget<ElevatedButton>(find.byKey(const Key('confirmIntentButton')));
    expect(confirmButton.onPressed, isNotNull);
  });

  testWidgets('Bails early and alerts if rider session / rider.id is null',
      (WidgetTester tester) async {
    bool nextCalled = false;
    await tester.pumpWidget(createTestWidget(
      child: IntentOfUseScreen(onNext: () => nextCalled = true),
    ));
    await tester.pumpAndSettle();

    // Select personal usage
    await tester.tap(find.byKey(const Key('personalUsageCard')));
    await tester.pumpAndSettle();

    // Tap confirm when rider session has no riderId
    await tester.tap(find.byKey(const Key('confirmIntentButton')));
    await tester.pumpAndSettle();

    // onNext must not be called
    expect(nextCalled, isFalse);
  });
}
