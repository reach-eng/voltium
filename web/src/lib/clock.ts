export interface Clock {
  now(): Date;
}

class SystemClock implements Clock {
  now(): Date {
    return new Date();
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

  reset() {
    currentClock = new SystemClock();
  }
};
