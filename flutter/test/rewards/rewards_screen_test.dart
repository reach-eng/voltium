import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/features/rewards/presentation/screens/rewards_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

Widget buildTestApp() {
  return ProviderScope(
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const RewardsScreen(),
    ),
  );
}

void main() {
  group('Rewards Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(RewardsScreen), findsOneWidget);
    });

    testWidgets('displays rewards heading', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Rewards'), findsAtLeastNWidgets(1));
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });
  });
}
