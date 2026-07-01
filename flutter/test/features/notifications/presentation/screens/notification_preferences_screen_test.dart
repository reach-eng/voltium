import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notification_preferences_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for NotificationPreferencesScreen', (WidgetTester tester) async {
    configureGoldenSurface(tester);
    
    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(NotificationPreferencesScreen()));
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(NotificationPreferencesScreen),
      matchesGoldenFile('goldens/notificationpreferencesscreen_golden.png'),
    );
  });
}
