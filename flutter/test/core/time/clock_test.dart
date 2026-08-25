import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/time/clock.dart';

void main() {
  group('Clock abstraction', () {
    test('SystemClock returns non-null DateTime and epoch millis', () {
      const clock = SystemClock();
      final now = clock.now();
      expect(now, isNotNull);
      expect(clock.nowMillisecondsSinceEpoch(), greaterThan(0));
    });

    test('FakeClock initializes with provided initial time', () {
      final initial = DateTime.utc(2026, 6, 15, 10, 30, 0);
      final fake = FakeClock(initial);
      expect(fake.now(), equals(initial));
      expect(fake.nowMillisecondsSinceEpoch(),
          equals(initial.millisecondsSinceEpoch));
    });

    test('FakeClock advances time accurately', () {
      final initial = DateTime.utc(2026, 1, 1, 0, 0, 0);
      final fake = FakeClock(initial);

      fake.advance(const Duration(minutes: 5, seconds: 30));
      expect(fake.now(), equals(DateTime.utc(2026, 1, 1, 0, 5, 30)));

      fake.advance(const Duration(days: 1));
      expect(fake.now(), equals(DateTime.utc(2026, 1, 2, 0, 5, 30)));
    });

    test('FakeClock setTime updates timestamp directly', () {
      final fake = FakeClock();
      final target = DateTime.utc(2027, 12, 31, 23, 59, 59);
      fake.setTime(target);
      expect(fake.now(), equals(target));
    });
  });
}
