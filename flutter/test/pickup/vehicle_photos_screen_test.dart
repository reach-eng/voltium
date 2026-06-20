import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/vehicle_photos_screen.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/locale_provider.dart';
import 'package:voltium_rider/providers/theme_provider.dart';
import 'package:voltium_rider/providers/app_provider.dart';

class _TestAppProvider extends AppProvider {
  @override
  Future<void> refreshTransactions() async {}
  @override
  Future<void> refresh() async {}
  @override
  Future<void> refreshFromApi() async {}
}

Widget buildTestApp() {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => LocaleProvider()),
      ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ChangeNotifierProvider<AppProvider>(create: (_) => _TestAppProvider()),
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
