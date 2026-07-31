import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/core/state/app_provider.dart';
import 'package:voltium/models/rider_model.dart';

void main() {
  test('AppProvider returns correct state from RiderModel', () {
    final rider = RiderModel(
      id: 'rider-1',
      riderId: 'R100',
      lifecycleStatus: 'PHONE_VERIFIED',
    );
    final provider = AppProvider(rider: rider);

    expect(provider.isReady, isTrue);
    expect(provider.lifecycleStatus, equals('PHONE_VERIFIED'));
  });

  test('AppProvider handles null rider gracefully', () {
    final provider = AppProvider(rider: null);

    expect(provider.isReady, isFalse);
    expect(provider.isOnboarded, isFalse);
    expect(provider.rider, isNull);
  });
}
