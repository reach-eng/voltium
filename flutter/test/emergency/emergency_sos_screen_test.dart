import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_sos_screen.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

Widget buildTestApp() {
  return ProviderScope(
    overrides: [],
    child: const MaterialApp(localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate
    ], supportedLocales: const [
      Locale('en'),
      Locale('hi')
    ], home: EmergencySOSScreen()),
  );
}

void main() {
  group('Emergency SOS Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(find.byType(EmergencySOSScreen), findsOneWidget);
    });

    testWidgets('displays emergency SOS heading', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(find.text('Emergency SOS'), findsAtLeastNWidgets(1));
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  });
}
