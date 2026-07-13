import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../helpers/test_helpers.dart';

class SupportPageObject {
  final WidgetTester tester;

  SupportPageObject(this.tester);

  // Locators
  Finder get supportTab => find.byKey(const Key('supportTab'));
  Finder get faqTile => find.byKey(const Key('faqTile'));
  Finder get raiseTicketTile => find.byKey(const Key('raiseTicketTile'));
  Finder get raiseTicketButton => find.byKey(const Key('raiseTicketButton'));
  Finder get ticketDescriptionField =>
      find.byKey(const Key('ticketDescriptionField'));
  Finder get submitTicketButton => find.byKey(const Key('submitTicketButton'));
}
