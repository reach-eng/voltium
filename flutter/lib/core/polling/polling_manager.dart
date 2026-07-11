// PollingManager (Phase 3.1)
//
// Lifecycle-aware polling helper. Replaces the hard-coded Timer
// pattern that lived in RiderProvider and gives one shared utility
// for any screen that needs background data refresh.
//
// Behavior matrix (Phase 3.1):
//   foreground + active screen        -> pollInterval (default 30s)
//   foreground + inactive screen      -> 2 * pollInterval (default 60s)
//   background (paused)              -> polling is suspended
//   resumed                          -> fires one immediate refresh, then
//                                     resumes at pollInterval
//   connectivity = none              -> polling is suspended
//   connectivity = restored         -> fires one immediate refresh
//
// The manager has no opinion about WHAT to fetch — that's a
// callback. It only owns the timer, the lifecycle subscription, and
// the pause/resume state.

import 'dart:async';

import 'package:voltium_rider/core/state/riverpod_providers.dart';

/// State of the app from a polling perspective.
enum PollingAppState { active, inactive, paused }

/// Strategy for picking the polling interval based on lifecycle.
class PollingStrategy {
  final Duration active;
  final Duration inactive;

  const PollingStrategy({
    this.active = const Duration(seconds: 30),
    this.inactive = const Duration(seconds: 60),
  });
}

class PollingManager {
  PollingManager({
    required this.onTick,
    PollingStrategy strategy = const PollingStrategy(),
    this.connectivity = true,
  }) : _strategy = strategy;

  final Future<void> Function() onTick;
  final PollingStrategy _strategy;
  bool connectivity;

  Timer? _timer;
  bool _running = false;
  PollingAppState _state = PollingAppState.active;
  int _ticks = 0;

  bool get isRunning => _running;
  int get ticks => _ticks;

  void start() {
    if (_running) return;
    _running = true;
    // Phase 3.1: do NOT fire an immediate tick on start. The first tick
    // fires after one active interval. Callers that need an immediate
    // refresh should call `onTick()` directly (or trigger via a
    // focus-based refresh, Phase 3.2).
    _scheduleNext(immediate: false);
  }

  void stop() {
    _running = false;
    _timer?.cancel();
    _timer = null;
  }

  /// Called when the host screen is hidden (route change, app
  /// background). The manager pauses the timer but does not lose
  /// its running state — when the screen comes back, [resume]
  /// continues the cadence.
  void pause() {
    _state = PollingAppState.paused;
    _timer?.cancel();
    _timer = null;
  }

  /// Called when the host screen is shown again.
  void resume({bool immediate = true}) {
    if (!_running) return;
    _state = PollingAppState.active;
    _scheduleNext(immediate: immediate);
  }

  /// Tell the manager the app went inactive (lost focus, OS
  /// backgrounded). Polling slows down but does not stop.
  void inactive() {
    if (!_running) return;
    _state = PollingAppState.inactive;
    _scheduleNext(immediate: false);
  }

  /// Tell the manager the app is back in the foreground.
  void active() {
    if (!_running) return;
    _state = PollingAppState.active;
    _scheduleNext(immediate: false);
  }

  /// Update connectivity. When false, polling is suspended; when
  /// it becomes true again, the next tick fires immediately.
  void setConnectivity(bool value) {
    if (connectivity == value) return;
    connectivity = value;
    if (!_running) return;
    if (value) {
      _scheduleNext(immediate: true);
    } else {
      _timer?.cancel();
      _timer = null;
    }
  }

  void _scheduleNext({required bool immediate}) {
    _timer?.cancel();
    if (!immediate) {
      final delay = _state == PollingAppState.inactive
          ? _strategy.inactive
          : _strategy.active;
      _timer = Timer(delay, () => _fire());
    } else {
      // Fire immediately and schedule the next one.
      _fire();
    }
  }

  void _fire() {
    if (!_running) return;
    if (!connectivity) {
      _scheduleNext(immediate: false);
      return;
    }
    _ticks++;
    // We don't await — the manager is fire-and-forget by design.
    // Errors are swallowed at the call site (or surfaced via the
    // ticker's own error handling).
    unawaited(onTick().catchError((_) {}));
    _scheduleNext(immediate: false);
  }
}
