import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/toast.dart';

void main() {
  Widget buildTestHost(
      ThemeMode themeMode, void Function(BuildContext) onTrigger) {
    return MaterialApp(
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      home: Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: ElevatedButton(
              onPressed: () => onTrigger(context),
              child: const Text('Show Toast'),
            ),
          ),
        ),
      ),
    );
  }

  group('Toast visual consistency tests', () {
    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      final modeName = mode == ThemeMode.light ? 'Light' : 'Dark';

      testWidgets(
          'Toast.success displays check icon and message in $modeName mode',
          (tester) async {
        await tester.pumpWidget(buildTestHost(mode, (ctx) {
          Toast.success(ctx, 'Success operation');
        }));

        await tester.tap(find.text('Show Toast'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(find.text('Success operation'), findsOneWidget);
        expect(find.byIcon(Icons.check_circle), findsOneWidget);
      });

      testWidgets(
          'Toast.error displays error icon and message in $modeName mode',
          (tester) async {
        await tester.pumpWidget(buildTestHost(mode, (ctx) {
          Toast.error(ctx, 'Failed operation');
        }));

        await tester.tap(find.text('Show Toast'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(find.text('Failed operation'), findsOneWidget);
        expect(find.byIcon(Icons.error_outline), findsOneWidget);
      });

      testWidgets('Toast.info displays info icon and message in $modeName mode',
          (tester) async {
        await tester.pumpWidget(buildTestHost(mode, (ctx) {
          Toast.info(ctx, 'Info note');
        }));

        await tester.tap(find.text('Show Toast'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(find.text('Info note'), findsOneWidget);
        expect(find.byIcon(Icons.info_outline), findsOneWidget);
      });

      testWidgets(
          'Toast.warning displays warning icon and message in $modeName mode',
          (tester) async {
        await tester.pumpWidget(buildTestHost(mode, (ctx) {
          Toast.warning(ctx, 'Warning notice');
        }));

        await tester.tap(find.text('Show Toast'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(find.text('Warning notice'), findsOneWidget);
        expect(find.byIcon(Icons.warning_amber), findsOneWidget);
      });
    }
  });
}
