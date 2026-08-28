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

  group('VoltiumTextField Widget Tests', () {
    late TextEditingController controller;

    setUp(() {
      controller = TextEditingController();
    });

    tearDown(() {
      controller.dispose();
    });

    testWidgets('1. Renders label in uppercase and hint text', (tester) async {
      await tester.pumpWidget(
        buildTestable(
          VoltiumTextField(
            label: 'Full Name',
            hint: 'Enter full name',
            controller: controller,
          ),
        ),
      );

      expect(find.text('FULL NAME'), findsOneWidget);
      expect(find.text('Enter full name'), findsOneWidget);
    });

    testWidgets('2. Normal and enabled state allows text editing',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          VoltiumTextField(
            fieldKey: const Key('testField'),
            label: 'Full Name',
            hint: 'Enter full name',
            controller: controller,
          ),
        ),
      );

      await tester.enterText(find.byKey(const Key('testField')), 'Jane Doe');
      expect(controller.text, 'Jane Doe');
    });

    testWidgets('3. readOnly prevents typing', (tester) async {
      controller.text = 'Initial';
      await tester.pumpWidget(
        buildTestable(
          VoltiumTextField(
            fieldKey: const Key('testField'),
            label: 'Full Name',
            hint: 'Enter full name',
            controller: controller,
            readOnly: true,
          ),
        ),
      );

      final textField = tester.widget<TextField>(
        find.descendant(
          of: find.byKey(const Key('testField')),
          matching: find.byType(TextField),
        ),
      );
      expect(textField.readOnly, isTrue);
    });

    testWidgets('4. maxLength counter displays and updates', (tester) async {
      await tester.pumpWidget(
        buildTestable(
          VoltiumTextField(
            fieldKey: const Key('testField'),
            label: 'Name',
            hint: 'Enter name',
            controller: controller,
            maxLength: 80,
          ),
        ),
      );

      expect(find.text('0/80'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('testField')), 'Voltium');
      await tester.pump();

      expect(find.text('7/80'), findsOneWidget);
    });

    testWidgets('5. Helper text renders below field', (tester) async {
      await tester.pumpWidget(
        buildTestable(
          VoltiumTextField(
            label: 'Address',
            hint: 'Enter address',
            controller: controller,
            helperText: 'House no, street, city, state, pin code',
          ),
        ),
      );

      expect(
          find.text('House no, street, city, state, pin code'), findsOneWidget);
    });

    testWidgets('6. KeyboardType is forwarded to TextFormField',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          VoltiumTextField(
            fieldKey: const Key('testField'),
            label: 'Email',
            hint: 'Enter email',
            controller: controller,
            keyboardType: TextInputType.emailAddress,
          ),
        ),
      );

      final textField = tester.widget<TextField>(
        find.descendant(
          of: find.byKey(const Key('testField')),
          matching: find.byType(TextField),
        ),
      );
      expect(textField.keyboardType, TextInputType.emailAddress);
    });

    testWidgets('7. TextCapitalization is forwarded to TextFormField',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          VoltiumTextField(
            fieldKey: const Key('testField'),
            label: 'Name',
            hint: 'Enter name',
            controller: controller,
            textCapitalization: TextCapitalization.words,
          ),
        ),
      );

      final textField = tester.widget<TextField>(
        find.descendant(
          of: find.byKey(const Key('testField')),
          matching: find.byType(TextField),
        ),
      );
      expect(textField.textCapitalization, TextCapitalization.words);
    });

    testWidgets('8. maxLines is forwarded to TextFormField', (tester) async {
      await tester.pumpWidget(
        buildTestable(
          VoltiumTextField(
            fieldKey: const Key('testField'),
            label: 'Address',
            hint: 'Enter address',
            controller: controller,
            maxLines: 3,
          ),
        ),
      );

      final textField = tester.widget<TextField>(
        find.descendant(
          of: find.byKey(const Key('testField')),
          matching: find.byType(TextField),
        ),
      );
      expect(textField.maxLines, 3);
    });

    testWidgets(
        '9. Validator shows error message inside Form with onUserInteraction',
        (tester) async {
      final formKey = GlobalKey<FormState>();

      await tester.pumpWidget(
        buildTestable(
          Form(
            key: formKey,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            child: VoltiumTextField(
              fieldKey: const Key('testField'),
              label: 'Full Name',
              hint: 'Enter full name',
              controller: controller,
              validator: (v) => (v == null || v.trim().length < 2)
                  ? 'Name is required'
                  : null,
            ),
          ),
        ),
      );

      // Initially no error
      expect(find.text('Name is required'), findsNothing);

      // Enter invalid single char
      await tester.enterText(find.byKey(const Key('testField')), 'A');
      await tester.pump();

      expect(find.text('Name is required'), findsOneWidget);

      // Correct it
      await tester.enterText(find.byKey(const Key('testField')), 'Alice');
      await tester.pump();

      expect(find.text('Name is required'), findsNothing);
    });

    testWidgets('10. Custom fieldKey is passed through to TextFormField',
        (tester) async {
      const customKey = Key('customFieldKey');
      await tester.pumpWidget(
        buildTestable(
          VoltiumTextField(
            fieldKey: customKey,
            label: 'Test',
            hint: 'Hint',
            controller: controller,
          ),
        ),
      );

      expect(find.byKey(customKey), findsOneWidget);
    });

    testWidgets('11. onChanged callback is invoked when text changes',
        (tester) async {
      String? changedVal;
      await tester.pumpWidget(
        buildTestable(
          VoltiumTextField(
            fieldKey: const Key('testField'),
            label: 'Test',
            hint: 'Hint',
            controller: controller,
            onChanged: (val) => changedVal = val,
          ),
        ),
      );

      await tester.enterText(find.byKey(const Key('testField')), 'Testing');
      expect(changedVal, 'Testing');
    });

    testWidgets('12. Counter turns red at character limit', (tester) async {
      await tester.pumpWidget(
        buildTestable(
          VoltiumTextField(
            fieldKey: const Key('testField'),
            label: 'Short',
            hint: 'Hint',
            controller: controller,
            maxLength: 5,
          ),
        ),
      );

      await tester.enterText(find.byKey(const Key('testField')), '12345');
      await tester.pump();

      expect(find.text('5/5'), findsOneWidget);
    });
  });
}
