import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notification_center_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for NotificationCenterScreen', (WidgetTester tester) async {
    configureGoldenSurface(tester);
    
    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(NotificationCenterScreen()));
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(NotificationCenterScreen),
      matchesGoldenFile('goldens/notificationcenterscreen_golden.png'),
    );
  });
}
