import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for NotificationsScreen',
      (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // ignore: prefer_const_constructors
    await tester.pumpWidget(
      ProviderScope(
        overrides: [appProvider.overrideWith((ref) => AppProvider())],
        child: wrapForGolden(NotificationsScreen()),
      ),
    );
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(NotificationsScreen),
      matchesGoldenFile('goldens/notificationsscreen_golden.png'),
    );
  });
}
