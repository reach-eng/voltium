import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/pre_dashboard_screen.dart';
import 'package:voltium_rider/app/app_state.dart';

void main() {
  group('Pre Dashboard Screen', () {
    test('can be instantiated', () {
      expect(
        PreDashboardScreen(onStepNavigation: (state) {}),
        isA<PreDashboardScreen>(),
      );
    });

    test('constructor requires onStepNavigation', () {
      final screen = PreDashboardScreen(onStepNavigation: (state) {});
      expect(screen.onStepNavigation, isA<Function>());
    });
  });
}
