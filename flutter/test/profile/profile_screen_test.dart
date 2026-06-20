import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/profile/presentation/screens/profile_screen.dart';
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
    child: const MaterialApp(home: ProfileScreen()),
  );
}

void main() {
  group('Profile Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(ProfileScreen), findsOneWidget);
    });

    testWidgets('displays profile title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Profile'), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows quick links section', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('QUICK LINKS'), findsOneWidget);
    });
  });
}
