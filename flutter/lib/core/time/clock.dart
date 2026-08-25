/// Injectable Clock abstraction for deterministic time testing across
/// the Voltium rider app (OTP countdowns, lease expirations, polling intervals).
abstract class Clock {
  const Clock();

  /// The default system clock that delegates to [DateTime.now()].
  static Clock system = const SystemClock();

  /// Current timestamp.
  DateTime now();

  /// Current epoch milliseconds.
  int nowMillisecondsSinceEpoch() => now().millisecondsSinceEpoch;
}

/// Standard clock implementation using system time.
class SystemClock extends Clock {
  const SystemClock();

  @override
  DateTime now() => DateTime.now();
}

/// Controllable clock for unit and widget testing.
class FakeClock extends Clock {
  DateTime _current;

  FakeClock([DateTime? initialTime])
      : _current = initialTime ?? DateTime.utc(2026, 1, 1, 12, 0, 0);

  @override
  DateTime now() => _current;

  /// Advance clock by [duration].
  void advance(Duration duration) {
    _current = _current.add(duration);
  }

  /// Explicitly set the clock to [time].
  void setTime(DateTime time) {
    _current = time;
  }
}
