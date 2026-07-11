import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/vehicle_photos_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';

class _TestAppProvider extends AppProvider {
  @override
  Future<void> refreshTransactions() async {}
  @override
  Future<void> refresh() async {}
  @override
  Future<void> refreshFromApi() async {}
}

Widget buildTestApp() {
  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith((ref) => LocaleProvider()),
      themeProviderRef.overrideWith((ref) => ThemeProvider()),
      appProvider.overrideWith((ref) => _TestAppProvider()),
    ],
    child: const MaterialApp(home: VehiclePhotosScreen()),
  );
}

void main() {
  group('Vehicle Photos Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(VehiclePhotosScreen), findsOneWidget);
    });

    testWidgets('displays vehicle photos title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Vehicle Photos'), findsOneWidget);
    });

    testWidgets('shows back button', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('backButton')), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
