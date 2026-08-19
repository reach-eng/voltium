import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  recordTokenBump,
  acceptStaleVersion,
  _resetSessionRotationForTests,
} from '@/lib/session-rotation';

describe('session-rotation sliding window (P0-9)', () => {
  beforeEach(() => {
    _resetSessionRotationForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts the immediately-stale version produced by our own bump', () => {
    recordTokenBump('admin-1', 1, 2);
    expect(acceptStaleVersion('admin-1', 1, 2)).toBe(true);
  });

  it('rejects when there is no bump record (logout/role change moved the version)', () => {
    expect(acceptStaleVersion('admin-1', 1, 2)).toBe(false);
  });

  it('rejects tokens more than one version behind', () => {
    recordTokenBump('admin-1', 1, 2);
    expect(acceptStaleVersion('admin-1', 1, 3)).toBe(false);
    expect(acceptStaleVersion('admin-1', 0, 2)).toBe(false);
  });

  it('rejects after the 60-second window elapses', () => {
    recordTokenBump('admin-1', 1, 2);
    vi.advanceTimersByTime(60 * 1000 + 1);
    expect(acceptStaleVersion('admin-1', 1, 2)).toBe(false);
  });

  it('still accepts within the window before it elapses', () => {
    recordTokenBump('admin-1', 1, 2);
    vi.advanceTimersByTime(59 * 1000);
    expect(acceptStaleVersion('admin-1', 1, 2)).toBe(true);
  });

  it('bounds replays per window so a stolen token cannot mint tokens unboundedly', () => {
    recordTokenBump('admin-1', 1, 2);
    // Racing retry pair / short storm: the first 5 presentations pass…
    for (let i = 0; i < 5; i++) {
      expect(acceptStaleVersion('admin-1', 1, 2)).toBe(true);
    }
    // …but the replay budget is exhausted.
    expect(acceptStaleVersion('admin-1', 1, 2)).toBe(false);
  });

  it('a newer bump replaces the record and re-opens the window for the new version', () => {
    recordTokenBump('admin-1', 1, 2);
    recordTokenBump('admin-1', 2, 3);
    expect(acceptStaleVersion('admin-1', 1, 2)).toBe(false);
    expect(acceptStaleVersion('admin-1', 2, 3)).toBe(true);
  });
});
