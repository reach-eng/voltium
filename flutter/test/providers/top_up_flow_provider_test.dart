import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/features/wallet/presentation/providers/top_up_flow_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // PR-9 (2026-08-21): the in-flight top-up amount used to live as a
  // private int on _AppRouterState and was lost on backout. It now
  // lives in a Riverpod Notifier; these tests pin the contract.
  late ProviderContainer container;
  late TopUpFlowProvider notifier;

  setUp(() {
    container = ProviderContainer();
    notifier = container.read(topUpFlowProvider.notifier);
  });

  tearDown(() {
    container.dispose();
  });

  TopUpFlowState readState() => container.read(topUpFlowProvider);

  test('default amount is 2000 (matches the legacy router default)', () {
    expect(readState().amount, 2000);
  });

  test('setAmount updates the value', () {
    notifier.setAmount(1500);
    expect(readState().amount, 1500);

    notifier.setAmount(7500);
    expect(readState().amount, 7500);
  });

  test('setAmount with the same value is a no-op', () {
    notifier.setAmount(2000); // same as default
    expect(readState().amount, 2000);
  });

  test('reset returns the amount to the default 2000', () {
    notifier.setAmount(9999);
    notifier.reset();
    expect(readState().amount, 2000);
  });

  test('amount survives a fresh container read', () {
    notifier.setAmount(2750);
    // Re-read through the same container — value persists.
    expect(container.read(topUpFlowProvider).amount, 2750);
  });
}
