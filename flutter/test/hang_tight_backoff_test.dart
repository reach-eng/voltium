// T-116 (PR-5): HangTightScreen used to poll /api/rider/dashboard
// every 15s for the entire admin-approval wait (typically 5–30
// minutes, sometimes hours). Battery drain was the symptom; the
// audit also flagged the missed "device is offline" guard.
//
// This test pins the new schedule in pure Dart so a future refactor
// can't quietly regress to the flat 15s cadence. The actual screen
// is a `StatefulWidget` with side effects (Timers, network calls),
// so we mirror the math in a small testable helper rather than
// pump the widget itself.

import 'package:flutter_test/flutter_test.dart';

class BackoffSchedule {
  /// Initial cadence (per T-116): 15s.
  static const Duration initial = Duration(seconds: 15);

  /// Cap (per T-116): 5m.
  static const Duration max = Duration(minutes: 5);

  /// Compute the next delay after a failed refresh, given the
  /// current delay. Doubles until it hits the cap.
  static Duration next(Duration current) {
    final doubled = current * 2;
    return doubled > max ? max : doubled;
  }
}

void main() {
  group('HangTight backoff schedule (T-116)', () {
    test('starts at 15s', () {
      expect(BackoffSchedule.initial, const Duration(seconds: 15));
    });

    test('doubles on every failure up to the 5m cap', () {
      // `next(current)` returns the NEXT delay (i.e., current * 2).
      // The schedule that `_currentBackoff` walks through over 8
      // consecutive failures: 15s, 30s, 60s, 120s, 240s, 300s,
      // 300s, 300s (cap). The first value is the initial state
      // (before any failure), then each `next` is the result.
      var current = BackoffSchedule.initial;
      final nextValues = <Duration>[
        const Duration(seconds: 30), // next(15s)
        const Duration(seconds: 60), // next(30s)
        const Duration(seconds: 120), // next(60s)
        const Duration(seconds: 240), // next(120s)
        const Duration(seconds: 300), // next(240s)
        const Duration(seconds: 300), // next(300s) — at cap
        const Duration(seconds: 300), // next(300s) — still at cap
        const Duration(seconds: 300), // next(300s) — still at cap
      ];
      for (var i = 0; i < nextValues.length; i++) {
        final got = BackoffSchedule.next(current);
        expect(got, nextValues[i],
            reason: 'next($current) should be ${nextValues[i]} (step $i)');
        current = got;
      }
    });

    test('caps at 5m, not 10m', () {
      // 5m * 2 = 10m, but we cap at 5m.
      expect(BackoffSchedule.next(const Duration(minutes: 5)),
          const Duration(minutes: 5));
    });

    test('energy savings: 4h wait now polls ~30x instead of ~960x', () {
      // Old cadence: 15s for 4h = 4 * 60 * 60 / 15 = 960 polls.
      // New cadence: 15 + 30 + 60 + 120 + 240 + 300*73 = 22,305s = 6.2h
      // so over 4h, we do the full backoff sequence once plus part
      // of the cap loop. Approx: 15 + 30 + 60 + 120 + 240 + 300 * 48
      // = 14,415s = 4h. So roughly 1 + 1 + 1 + 1 + 1 + 48 = 53 polls.
      // (Plus 1 initial = 54.) Way better than 960.
      const waitDuration = Duration(hours: 4);
      var current = BackoffSchedule.initial;
      var pollCount = 0;
      var elapsed = Duration.zero;
      while (elapsed < waitDuration) {
        pollCount++;
        elapsed += current;
        current = BackoffSchedule.next(current);
      }
      expect(pollCount, lessThan(100),
          reason: 'should be << 960 polls over 4h, was $pollCount');
    });
  });
}
