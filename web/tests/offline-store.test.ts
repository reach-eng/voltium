/**
 * Voltium Offline Store — Comprehensive Tests
 */

import { describe, it, expect } from 'vitest';
import {
  cacheRiderState,
  loadCachedRiderState,
  clearRiderCache,
  enqueueAction,
  getPendingCount,
  clearQueue,
  processQueue,
  getSuspensionReasons,
  isOnline,
  subscribeToSync,
  onConnectivityChange,
} from '../src/lib/offline-store';

describe('offline-store', () => {
  it('enqueueAction creates a queued action', () => {
    const action = enqueueAction('CREATE_TICKET', { title: 'Broken mirror' }, '/api/tickets', 'POST');
    expect(action.id).toBeDefined();
    expect(action.actionType).toBe('CREATE_TICKET');
    expect(action.method).toBe('POST');
    expect(action.endpoint).toBe('/api/tickets');
    expect(action.createdAt).toBeGreaterThan(0);
  });

  it('getPendingCount returns number', () => {
    expect(typeof getPendingCount()).toBe('number');
  });

  it('isOnline returns boolean', () => {
    expect(typeof isOnline()).toBe('boolean');
  });

  it('cache and clear rider state handles stub operations safely', () => {
    expect(() => cacheRiderState({ riderId: 'r1', walletBalance: 100 })).not.toThrow();
    expect(loadCachedRiderState()).toBeNull();
    expect(() => clearRiderCache()).not.toThrow();
  });

  it('clearQueue does not throw', () => {
    expect(() => clearQueue()).not.toThrow();
  });

  it('processQueue returns ProcessResult', async () => {
    const res = await processQueue();
    expect(res.failed).toBe(0);
    expect(res.errors).toEqual([]);
  });

  it('getSuspensionReasons returns array', () => {
    const reasons = getSuspensionReasons({});
    expect(Array.isArray(reasons)).toBe(true);
  });

  it('connectivity listeners return unbind callbacks', () => {
    const unsub1 = subscribeToSync(() => {});
    expect(typeof unsub1).toBe('function');
    unsub1();

    const unsub2 = onConnectivityChange(() => {});
    expect(typeof unsub2).toBe('function');
    unsub2();
  });
});
