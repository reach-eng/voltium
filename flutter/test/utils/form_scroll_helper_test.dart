import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/form_scroll_helper.dart';

void main() {
  group('FormScrollHelper.createKey', () {
    test('creates a unique GlobalKey each call', () {
      final k1 = FormScrollHelper.createKey();
      final k2 = FormScrollHelper.createKey();
      expect(k1, isNotNull);
      expect(k2, isNotNull);
      expect(k1, isNot(equals(k2)));
    });
  });

  // scrollToFirstError / scrollToWidget require a scroll context so
  // they are not unit-tested here — covered by E2E suite.
  // showFieldError requires ScaffoldMessenger — same.
  //
  // We document the known behaviour: scrollToFirstError uses primaryFocus
  // context (not the errored field key), and _hasErrorsChanged compares
  // non-null error count (not identity).

  group('FormScrollHelper contract documentation tests', () {
    test('createKey produces GlobalKey instances', () {
      final key = FormScrollHelper.createKey();
      expect(key.runtimeType.toString(), contains('GlobalKey'));
    });
  });
}
