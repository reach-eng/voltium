import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/tl_details_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';

Widget buildTestApp() {
  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith(() => LocaleProvider()),
      themeProviderRef.overrideWith(() => ThemeProvider()),
    ],
    child: const MaterialApp(home: TlDetailsScreen()),
  );
}

void main() {
  group('TL Details Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(TlDetailsScreen), findsOneWidget);
    });

    testWidgets('displays team leader title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Team Leader'), findsOneWidget);
    });

    testWidgets('shows back button', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(find.byKey(const Key('backButton')), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });

    // PR-ONBOARDING-2026-08-11 (audit 1.8): the "Change Team Leader" button
    // used to show a fake "Request submitted" snackbar without calling any
    // API. The label is now "Request Team Leader change" and the action
    // routes to the support center so the rider can file a real ticket.
    testWidgets(
        'shows the "Request Team Leader change" action (audit 1.8 regression)',
        (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      // Old buggy label must be gone.
      expect(find.text('Change Team Leader'), findsNothing);
      // New label must be present.
      expect(find.text('Request Team Leader change'), findsOneWidget);
    });
  });
}
