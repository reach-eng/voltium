export interface Clock {
  now(): Date;
}

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/**
 * OffsetClock — a Clock that returns `now + offsetMs` on every call.
 * PR-76: enables deterministic time-travel in tests (e.g. simulating
 * a 7-day tenant across 7 day-ticks).
 */
class OffsetClock implements Clock {
  private offsetMs = 0;
  constructor(offsetMs = 0) {
    this.offsetMs = offsetMs;
  }
  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }
  advance(ms: number): void {
    this.offsetMs += ms;
  }
}

// Global default clock
let currentClock: Clock = new SystemClock();

export const clock = {
  now(): Date {
    return currentClock.now();
  },

  // For testing purposes
  set(newClock: Clock) {
    currentClock = newClock;
  },

  // PR-76: convenience helper for tests — set the clock to an
  // OffsetClock that can be advanced via `clock.advance(ms)`.
  start(): OffsetClock {
    const c = new OffsetClock();
    currentClock = c;
    return c;
  },

  reset() {
    currentClock = new SystemClock();
  }
};
