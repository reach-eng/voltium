import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/forms/forms.dart';

void main() {
  Widget buildTestable(Widget child) {
    return MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: AppTheme.lightTheme,
      home: Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: child,
        ),
      ),
    );
  }

  group('VoltiumDateField Widget Tests', () {
    late TextEditingController controller;

    setUp(() {
      controller = TextEditingController();
    });

    tearDown(() {
      controller.dispose();
    });

    testWidgets('1. Renders label in uppercase, hint, and calendar icon',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          VoltiumDateField(
            label: 'Date of Birth',
            hint: 'YYYY-MM-DD',
            controller: controller,
            onTap: () {},
          ),
        ),
      );

      expect(find.text('DATE OF BIRTH'), findsOneWidget);
      expect(find.text('YYYY-MM-DD'), findsOneWidget);
      expect(find.byIcon(Icons.calendar_today), findsOneWidget);
    });

    testWidgets('2. Entire field row is tappable via InkWell and invokes onTap',
        (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        buildTestable(
          VoltiumDateField(
            fieldKey: const Key('dobField'),
            label: 'Date of Birth',
            hint: 'YYYY-MM-DD',
            controller: controller,
            onTap: () => tapped = true,
          ),
        ),
      );

      // Tap on the text field region
      await tester.tap(find.byKey(const Key('dobField')));
      expect(tapped, isTrue);
    });

    testWidgets('3. Disabled state does NOT trigger onTap', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        buildTestable(
          VoltiumDateField(
            fieldKey: const Key('dobField'),
            label: 'Date of Birth',
            hint: 'YYYY-MM-DD',
            controller: controller,
            enabled: false,
            onTap: () => tapped = true,
          ),
        ),
      );

      await tester.tap(find.byKey(const Key('dobField')));
      expect(tapped, isFalse);
    });

    testWidgets('4. Displays selected date value formatted', (tester) async {
      controller.text = '1995-08-15';
      await tester.pumpWidget(
        buildTestable(
          VoltiumDateField(
            label: 'Date of Birth',
            hint: 'YYYY-MM-DD',
            controller: controller,
            onTap: () {},
          ),
        ),
      );

      expect(find.text('1995-08-15'), findsOneWidget);
    });

    testWidgets(
        '5. Validator fires when wrapped in Form with onUserInteraction',
        (tester) async {
      final formKey = GlobalKey<FormState>();

      await tester.pumpWidget(
        buildTestable(
          Form(
            key: formKey,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            child: VoltiumDateField(
              label: 'Date of Birth',
              hint: 'YYYY-MM-DD',
              controller: controller,
              onTap: () {},
              validator: (v) =>
                  (v == null || v.isEmpty) ? 'DOB is required' : null,
            ),
          ),
        ),
      );

      // Trigger validation
      formKey.currentState!.validate();
      await tester.pump();

      expect(find.text('DOB is required'), findsOneWidget);
    });
  });
}
