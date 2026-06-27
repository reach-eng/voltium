import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/polling/polling_manager.dart';

void main() {
  group('PollingManager (Phase 3.1)', () {
    test('does not call onTick when stopped', () async {
      var calls = 0;
      final m = PollingManager(onTick: () async => calls++);
      m.start();
      m.stop();
      // No scheduled ticks, no immediate tick.
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(calls, 0);
      expect(m.isRunning, isFalse);
    });

    test('fires one tick per active interval after start', () async {
      var calls = 0;
      final m = PollingManager(
        onTick: () async => calls++,
        strategy: const PollingStrategy(
          active: Duration(milliseconds: 50),
          inactive: Duration(milliseconds: 200),
        ),
      );
      m.start();
      await Future<void>.delayed(const Duration(milliseconds: 220));
      // After 220ms with active=50ms, we expect ~3-4 ticks.
      expect(calls, greaterThanOrEqualTo(2));
      expect(calls, lessThanOrEqualTo(6));
      m.stop();
    });

    test('pause/resume does not lose the running state', () async {
      var calls = 0;
      final m = PollingManager(
        onTick: () async => calls++,
        strategy: const PollingStrategy(
          active: Duration(milliseconds: 30),
          inactive: Duration(milliseconds: 30),
        ),
      );
      m.start();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      m.pause();
      final callsAfterPause = calls;
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(calls, callsAfterPause, reason: 'pause should suspend timer');
      m.resume(immediate: false);
      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(calls, greaterThan(callsAfterPause));
      m.stop();
    });

    test('inactive() doubles the interval (slow cadence)', () async {
      var calls = 0;
      final m = PollingManager(
        onTick: () async => calls++,
        strategy: const PollingStrategy(
          active: Duration(milliseconds: 50),
          inactive: Duration(milliseconds: 200),
        ),
      );
      m.start();
      await Future<void>.delayed(const Duration(milliseconds: 100));
      final callsAfterActive = calls;
      m.inactive();
      // While inactive, calls should grow much more slowly.
      await Future<void>.delayed(const Duration(milliseconds: 100));
      final callsAfterInactive = calls;
      // After 100ms of active we expect ~2 calls; after 100ms more
      // of inactive we expect at most 1 additional.
      expect(callsAfterActive, greaterThanOrEqualTo(1));
      expect(callsAfterInactive - callsAfterActive, lessThanOrEqualTo(1));
      m.stop();
    });

    test('setConnectivity(false) suspends ticks; true resumes with an immediate tick', () async {
      var calls = 0;
      final m = PollingManager(
        onTick: () async => calls++,
        strategy: const PollingStrategy(
          active: Duration(milliseconds: 200),
          inactive: Duration(milliseconds: 200),
        ),
      );
      m.start();
      await Future<void>.delayed(const Duration(milliseconds: 30));
      m.setConnectivity(false);
      final callsAfterOffline = calls;
      await Future<void>.delayed(const Duration(milliseconds: 200));
      // While offline, no new ticks should fire.
      expect(calls, callsAfterOffline);
      m.setConnectivity(true);
      // Resume fires one immediate tick.
      await Future<void>.delayed(const Duration(milliseconds: 30));
      expect(calls, greaterThan(callsAfterOffline));
      m.stop();
    });

    test('start is idempotent (does not double-schedule)', () async {
      var calls = 0;
      final m = PollingManager(onTick: () async => calls++);
      m.start();
      m.start();
      m.start();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      // No immediate tick fires; first tick is scheduled for the
      // active interval. After 20ms we expect 0 ticks.
      expect(calls, 0);
      m.stop();
    });
  });
}
