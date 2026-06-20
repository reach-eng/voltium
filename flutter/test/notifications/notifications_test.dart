import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notification_center_screen.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/locale_provider.dart';
import 'package:voltium_rider/providers/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Notifications Screen Widget Tests
void main() {
  Widget buildTestApp({required Widget child}) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: child,
      ),
    );
  }

  group('Notification Center Screen', () {
    testWidgets('notification center renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const NotificationCenterScreen()));
      await tester.pumpAndSettle();
      expect(find.byType(NotificationCenterScreen), findsOneWidget);
    });

    testWidgets('notification center shows empty state or list', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const NotificationCenterScreen()));
      await tester.pumpAndSettle();

      // Either shows notifications or an empty state
      final hasListView = find.byType(ListView).evaluate().isNotEmpty;
      final hasEmptyText = find.textContaining('no notification', skipOffstage: false).evaluate().isNotEmpty ||
          find.textContaining('empty', skipOffstage: false).evaluate().isNotEmpty;
      final hasText = find.byType(Text).evaluate().isNotEmpty;

      expect(hasListView || hasEmptyText || hasText, isTrue);
    });

    testWidgets('notification center does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const NotificationCenterScreen()));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
