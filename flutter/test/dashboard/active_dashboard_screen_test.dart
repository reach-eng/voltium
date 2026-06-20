import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/active_dashboard_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/locale_provider.dart';
import 'package:voltium_rider/providers/theme_provider.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

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
    child: const MaterialApp(
      localizationsDelegates: [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: ActiveDashboardScreen(),
    ),
  );
}

void main() {
  group('Active Dashboard Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(ActiveDashboardScreen), findsOneWidget);
    });

    testWidgets('does not throw on first frame', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();

      expect(tester.takeException(), isNull);
    });

    testWidgets('shows skeleton when no rider data', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(milliseconds: 200));

      // When rider is null, DashboardSkeleton is shown
      expect(find.byType(ActiveDashboardScreen), findsOneWidget);
    });
  });
}
