import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_contacts_screen.dart';
import 'package:voltium_rider/services/emergency_contacts_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

Widget buildTestApp() {
  return ProviderScope(
    overrides: [
      emergencyContactsService.overrideWith(() => EmergencyContactsService())
    ],
    child: const MaterialApp(localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate
    ], supportedLocales: const [
      Locale('en'),
      Locale('hi')
    ], home: EmergencyContactsScreen()),
  );
}

void main() {
  group('Emergency Contacts Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(EmergencyContactsScreen), findsOneWidget);
    });

    testWidgets('shows empty state initially', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('No emergency contacts'), findsOneWidget);
    });

    testWidgets('shows add contact button', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Add Contact'), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });
  });
}
