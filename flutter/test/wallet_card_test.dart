import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/widgets/wallet_card.dart';

void main() {
  group('Phase 1: Widget Atomic Tests - Wallet Cards', () {
    testWidgets(
        'GradientWalletCard displays correct balance and vehicle number',
        (WidgetTester tester) async {
      const testBalance = 50050.0; // ₹500.50
      const testVehicle = 'KA-01-EE-1234';
      const testName = 'John Doe';

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: GradientWalletCard(
              balance: testBalance,
              vehicleNumber: testVehicle,
              name: testName,
            ),
          ),
        ),
      );

      // Verify Balance
      expect(find.text('₹500.50'), findsOneWidget);

      // Verify Vehicle Number
      expect(find.text(testVehicle), findsOneWidget);

      // Verify Name
      expect(find.text(testName), findsOneWidget);

      // Verify Label
      expect(find.text('Wallet Balance'), findsOneWidget);
    });

    testWidgets('MiniWalletCard displays correct balance and label',
        (WidgetTester tester) async {
      const testBalance = 25000.0; // ₹250.00
      const testLabel = 'Security Deposit';

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: MiniWalletCard(
              balance: testBalance,
              label: testLabel,
              icon: Icons.security,
            ),
          ),
        ),
      );

      // Verify Balance
      expect(find.text('₹250.00'), findsOneWidget);

      // Verify Label
      expect(find.text(testLabel), findsOneWidget);

      // Verify Icon
      expect(find.byIcon(Icons.security), findsOneWidget);
    });

    testWidgets('WalletActionButton triggers callback on tap',
        (WidgetTester tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WalletActionButton(
              icon: Icons.add,
              label: 'Add Money',
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      await tester.tap(find.text('Add Money'));
      await tester.pump();

      expect(tapped, isTrue);
    });
  });
}
