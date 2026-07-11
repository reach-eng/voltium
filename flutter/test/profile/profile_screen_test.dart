import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/profile/presentation/screens/profile_screen.dart';
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
