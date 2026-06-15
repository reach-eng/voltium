/**
 * Voltium Offline Store — Comprehensive Tests
 *
 * Tests the full offline-store module: cache layer, sync queue,
 * processQueue, and suspension reason engine.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock localStorage for Node.js ─────────────────────────────────────────────

let store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (_index: number) => null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

// ─── Imports (after mock is installed) ─────────────────────────────────────────

import {
  cacheRiderState,
  loadCachedRiderState,
  clearRiderCache,
  enqueueAction,
  loadQueue,
  getPendingActions,
  getPendingCount,
  updateActionStatus,
  removeSyncedActions,
  clearQueue,
  processQueue,
  getSuspensionReasons,
  type CachedRiderState,
  type QueuedAction,
} from '../src/lib/offline-store';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeRiderState(overrides?: Partial<CachedRiderState>): CachedRiderState {
  return {
    riderId: 'rider-001',
    walletBalance: 500,
    currentPlan: 'daily',
    assignedVehicle: 'veh-001',
    accountStatus: 'ACTIVE',
    kycStatus: 'VERIFIED',
    rentalStatus: 'ACTIVE',
    cachedAt: Date.now(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cache Layer
// ═══════════════════════════════════════════════════════════════════════════════

describe('cacheRiderState / loadCachedRiderState', () => {
  beforeEach(() => {
    store = {};
  });

  it('caches and loads rider state correctly', () => {
    const state = makeRiderState();
    const result = cacheRiderState(state);

    expect(result).toBe(true);
    const loaded = loadCachedRiderState();
    expect(loaded).not.toBeNull();
    expect(loaded!.riderId).toBe('rider-001');
    expect(loaded!.walletBalance).toBe(500);
    expect(loaded!.currentPlan).toBe('daily');
  });

  it('overwrites cachedAt with current timestamp', () => {
    const state = makeRiderState({ cachedAt: 0 });
    cacheRiderState(state);

    const loaded = loadCachedRiderState();
    expect(loaded!.cachedAt).toBeGreaterThan(0);
  });

  it('returns null when no cache exists', () => {
    const loaded = loadCachedRiderState();
    expect(loaded).toBeNull();
  });

  it('returns stale cache (older than 24h) instead of null', () => {
    const state = makeRiderState({
      cachedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
    });
    cacheRiderState(state);

    const loaded = loadCachedRiderState();
    // Module still returns stale data for instant UI
    expect(loaded).not.toBeNull();
    expect(loaded!.riderId).toBe('rider-001');
  });

  it('handles corrupted JSON gracefully', () => {
    store['voltium:rider_cache'] = '{not-valid-json}}}';
    const loaded = loadCachedRiderState();
    expect(loaded).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// clearRiderCache
// ═══════════════════════════════════════════════════════════════════════════════

describe('clearRiderCache', () => {
  beforeEach(() => {
    store = {};
  });

  it('removes the rider cache and last sync from localStorage', () => {
    cacheRiderState(makeRiderState());
    store['voltium:last_sync'] = String(Date.now());

    expect(store['voltium:rider_cache']).toBeDefined();
    expect(store['voltium:last_sync']).toBeDefined();

    clearRiderCache();

    expect(store['voltium:rider_cache']).toBeUndefined();
    expect(store['voltium:last_sync']).toBeUndefined();
  });

  it('does not throw if localStorage is empty', () => {
    expect(() => clearRiderCache()).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// enqueueAction / loadQueue
// ═══════════════════════════════════════════════════════════════════════════════

describe('enqueueAction / loadQueue', () => {
  beforeEach(() => {
    store = {};
  });

  it('enqueues an action with PENDING status and returns it', () => {
    const action = enqueueAction('CREATE_TICKET', { subject: 'Broken headlight' }, '/api/tickets');

    expect(action.actionType).toBe('CREATE_TICKET');
    expect(action.status).toBe('PENDING');
    expect(action.payload).toEqual({ subject: 'Broken headlight' });
    expect(action.endpoint).toBe('/api/tickets');
    expect(action.method).toBe('POST');
    expect(action.retryCount).toBe(0);
    expect(action.id).toBeDefined();
    expect(action.createdAt).toBeGreaterThan(0);
  });

  it('persists action to localStorage and loadQueue retrieves it', () => {
    enqueueAction('UPLOAD_INSPECTION', { photoId: 'p1' }, '/api/inspections');

    const queue = loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].actionType).toBe('UPLOAD_INSPECTION');
  });

  it('defaults method to POST', () => {
    const action = enqueueAction('UPDATE_PROFILE', { name: 'Amit' }, '/api/profile');
    expect(action.method).toBe('POST');
  });

  it('accepts PUT as method', () => {
    const action = enqueueAction('UPDATE_PROFILE', { name: 'Amit' }, '/api/profile', 'PUT');
    expect(action.method).toBe('PUT');
  });

  it('enqueues multiple actions and preserves order', () => {
    enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    enqueueAction('SUBMIT_KYC', {}, '/api/kyc');
    enqueueAction('SUBMIT_TOPUP', {}, '/api/topup');

    const queue = loadQueue();
    expect(queue).toHaveLength(3);
    expect(queue[0].actionType).toBe('CREATE_TICKET');
    expect(queue[1].actionType).toBe('SUBMIT_KYC');
    expect(queue[2].actionType).toBe('SUBMIT_TOPUP');
  });

  it('evicts oldest PENDING action when queue reaches MAX_QUEUE_SIZE (50)', () => {
    // Fill queue to capacity
    for (let i = 0; i < 50; i++) {
      enqueueAction('CREATE_TICKET', { idx: i }, '/api/tickets');
    }

    const beforeQueue = loadQueue();
    expect(beforeQueue).toHaveLength(50);

    // Add one more — should evict oldest PENDING
    const newAction = enqueueAction('SUBMIT_TOPUP', { idx: 99 }, '/api/topup');

    const afterQueue = loadQueue();
    expect(afterQueue).toHaveLength(50);

    // The newest action should be present
    const found = afterQueue.find((a) => a.id === newAction.id);
    expect(found).toBeDefined();

    // The very first action should have been evicted
    expect(afterQueue.find((a) => a.id === beforeQueue[0].id)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getPendingActions / getPendingCount
// ═══════════════════════════════════════════════════════════════════════════════

describe('getPendingActions / getPendingCount', () => {
  beforeEach(() => {
    store = {};
  });

  it('returns only PENDING and FAILED actions', () => {
    const a1 = enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    const a2 = enqueueAction('SUBMIT_KYC', {}, '/api/kyc');

    // Mark a1 as SYNCED
    updateActionStatus(a1.id, 'SYNCED');

    const pending = getPendingActions();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(a2.id);
  });

  it('includes FAILED actions in pending count', () => {
    const a1 = enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    updateActionStatus(a1.id, 'FAILED', 'Network error');

    expect(getPendingCount()).toBe(1);
    expect(getPendingActions()[0].status).toBe('FAILED');
  });

  it('returns 0 when queue is empty', () => {
    expect(getPendingCount()).toBe(0);
    expect(getPendingActions()).toHaveLength(0);
  });

  it('does not count SYNCING actions', () => {
    const a1 = enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    updateActionStatus(a1.id, 'SYNCING');

    expect(getPendingCount()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// updateActionStatus / removeSyncedActions / clearQueue
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateActionStatus', () => {
  beforeEach(() => {
    store = {};
  });

  it('updates action status in the queue', () => {
    const action = enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    updateActionStatus(action.id, 'SYNCED');

    const queue = loadQueue();
    const updated = queue.find((a) => a.id === action.id);
    expect(updated!.status).toBe('SYNCED');
  });

  it('increments retryCount when status is SYNCING', () => {
    const action = enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    updateActionStatus(action.id, 'SYNCING');
    updateActionStatus(action.id, 'SYNCING');

    const queue = loadQueue();
    const updated = queue.find((a) => a.id === action.id);
    expect(updated!.retryCount).toBe(2);
  });

  it('does not increment retryCount for non-SYNCING statuses', () => {
    const action = enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    updateActionStatus(action.id, 'FAILED', 'error');

    const queue = loadQueue();
    const updated = queue.find((a) => a.id === action.id);
    expect(updated!.retryCount).toBe(0);
  });

  it('stores error message when provided', () => {
    const action = enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    updateActionStatus(action.id, 'FAILED', 'Server error 500');

    const queue = loadQueue();
    const updated = queue.find((a) => a.id === action.id);
    expect(updated!.error).toBe('Server error 500');
  });

  it('does nothing for non-existent action id', () => {
    enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    // Should not throw
    updateActionStatus('non-existent-id', 'SYNCED');
    const queue = loadQueue();
    expect(queue).toHaveLength(1);
  });
});

describe('removeSyncedActions', () => {
  beforeEach(() => {
    store = {};
  });

  it('removes SYNCED actions and returns the count removed', () => {
    const a1 = enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    const a2 = enqueueAction('SUBMIT_KYC', {}, '/api/kyc');
    enqueueAction('UPLOAD_INSPECTION', {}, '/api/inspections');

    updateActionStatus(a1.id, 'SYNCED');
    updateActionStatus(a2.id, 'SYNCED');

    const removed = removeSyncedActions();
    expect(removed).toBe(2);

    const queue = loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].actionType).toBe('UPLOAD_INSPECTION');
  });

  it('returns 0 when nothing to remove', () => {
    enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    const removed = removeSyncedActions();
    expect(removed).toBe(0);
  });
});

describe('clearQueue', () => {
  beforeEach(() => {
    store = {};
  });

  it('removes the entire queue from localStorage', () => {
    enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    enqueueAction('SUBMIT_KYC', {}, '/api/kyc');

    expect(loadQueue()).toHaveLength(2);

    clearQueue();

    expect(loadQueue()).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// processQueue
// ═══════════════════════════════════════════════════════════════════════════════

describe('processQueue', () => {
  beforeEach(() => {
    store = {};
  });

  it('processes a PENDING action and marks it SYNCED on success', async () => {
    const mockFetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 });

    enqueueAction('CREATE_TICKET', { subject: 'test' }, '/api/tickets');

    const result = await processQueue(mockFetch);

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Synced items should be cleaned up
    expect(loadQueue()).toHaveLength(0);
  });

  it('returns failure result on HTTP error and retries below MAX_RETRIES', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response(JSON.stringify({ error: 'bad' }), { status: 500 });
    };

    enqueueAction('CREATE_TICKET', {}, '/api/tickets');

    const result = await processQueue(mockFetch);

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    // On first failure with retryCount < MAX_RETRIES, action goes back to PENDING
    const queue = loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('PENDING');
    expect(queue[0].retryCount).toBe(1); // incremented once for SYNCING
  });

  it('marks action as FAILED after MAX_RETRIES', async () => {
    // Note: updateActionStatus('SYNCING') increments retryCount in storage, but the
    // local `action` variable in the loop retains the value from getPendingActions().
    // So the retryCount check uses the value *before* the SYNCING increment.
    // Starting at 0, after each call the stored retryCount is incremented,
    // but the check sees the pre-increment value. We need 4 calls to reach retryCount>=3.
    enqueueAction('CREATE_TICKET', {}, '/api/tickets');

    const mockFetchFail = async () =>
      new Response(JSON.stringify({ error: 'bad' }), { status: 500 });

    // Process 3 times — action stays PENDING (retryCount 0, 1, 2 all < 3)
    await processQueue(mockFetchFail);
    await processQueue(mockFetchFail);
    await processQueue(mockFetchFail);

    // 4th call: local retryCount=3 >= MAX_RETRIES(3) → FAILED
    const result = await processQueue(mockFetchFail);

    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('HTTP 500');

    // Action should be FAILED now
    const queue = loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('FAILED');
  });

  it('handles network errors (fetch throws)', async () => {
    const mockFetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    enqueueAction('CREATE_TICKET', {}, '/api/tickets');

    const result = await processQueue(mockFetch);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(0); // Only errors with retryCount >= MAX_RETRIES

    // Should be put back to PENDING for retry
    const queue = loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('PENDING');
  });

  it('processes multiple pending actions in order', async () => {
    const mockFetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });

    enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    enqueueAction('SUBMIT_KYC', {}, '/api/kyc');
    enqueueAction('UPLOAD_INSPECTION', {}, '/api/inspections');

    const result = await processQueue(mockFetch);

    expect(result.processed).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
    expect(loadQueue()).toHaveLength(0);
  });

  it('does nothing when queue is empty', async () => {
    const mockFetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });

    const result = await processQueue(mockFetch);

    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('skips already SYNCED actions (only processes PENDING/FAILED)', async () => {
    const mockFetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });

    const a1 = enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    updateActionStatus(a1.id, 'SYNCED');
    enqueueAction('SUBMIT_KYC', {}, '/api/kyc');

    const result = await processQueue(mockFetch);

    // Only the PENDING action should be processed
    expect(result.processed).toBe(1);
  });

  it('updates last sync timestamp after processing', async () => {
    const mockFetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });

    enqueueAction('CREATE_TICKET', {}, '/api/tickets');
    await processQueue(mockFetch);

    const lastSync = store['voltium:last_sync'];
    expect(lastSync).toBeDefined();
    expect(Number(lastSync)).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getSuspensionReasons
// ═══════════════════════════════════════════════════════════════════════════════

describe('getSuspensionReasons', () => {
  const baseRider = {
    accountStatus: 'SUSPENDED',
    walletBalance: 0,
    kycStatus: 'VERIFIED',
    depositStatus: 'COMPLETED',
    planStatus: 'ACTIVE',
    rentalStatus: 'ACTIVE',
    securityDeposit: 500,
  };

  it('ACTIVE account returns empty array', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      accountStatus: 'ACTIVE',
      kycStatus: 'VERIFIED',
      walletBalance: 100,
    });
    expect(reasons).toHaveLength(0);
  });

  it('negative wallet balance → NEGATIVE_BALANCE reason (critical)', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      walletBalance: -150,
    });

    const neg = reasons.find((r) => r.code === 'NEGATIVE_BALANCE');
    expect(neg).toBeDefined();
    expect(neg!.severity).toBe('critical');
    expect(neg!.actionLabel).toBe('Top Up Now');
    expect(neg!.description).toContain('150.00');
  });

  it('low wallet balance (>= 0 and < 50) → LOW_BALANCE reason (warning)', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      walletBalance: 25,
    });

    const low = reasons.find((r) => r.code === 'LOW_BALANCE');
    expect(low).toBeDefined();
    expect(low!.severity).toBe('warning');
    expect(low!.description).toContain('25.00');
  });

  it('wallet balance of exactly 0 → LOW_BALANCE', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      walletBalance: 0,
    });

    expect(reasons.some((r) => r.code === 'LOW_BALANCE')).toBe(true);
    expect(reasons.some((r) => r.code === 'NEGATIVE_BALANCE')).toBe(false);
  });

  it('wallet balance >= 50 → no balance reasons', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      walletBalance: 100,
    });

    expect(reasons.some((r) => r.code === 'NEGATIVE_BALANCE')).toBe(false);
    expect(reasons.some((r) => r.code === 'LOW_BALANCE')).toBe(false);
  });

  it('pending KYC → KYC_PENDING reason (warning)', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      kycStatus: 'PENDING',
    });

    const kyc = reasons.find((r) => r.code === 'KYC_PENDING');
    expect(kyc).toBeDefined();
    expect(kyc!.severity).toBe('warning');
    expect(kyc!.actionLabel).toBe('Complete KYC');
    expect(kyc!.description).toContain('pending');
  });

  it('rejected KYC → KYC_PENDING reason (critical severity)', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      kycStatus: 'REJECTED',
    });

    const kyc = reasons.find((r) => r.code === 'KYC_PENDING');
    expect(kyc).toBeDefined();
    expect(kyc!.severity).toBe('critical');
    expect(kyc!.actionLabel).toBe('Resubmit KYC');
  });

  it('pending deposit → DEPOSIT_PENDING reason', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      depositStatus: 'PENDING',
    });

    const dep = reasons.find((r) => r.code === 'DEPOSIT_PENDING');
    expect(dep).toBeDefined();
    expect(dep!.severity).toBe('warning');
    expect(dep!.actionLabel).toBe('Pay Deposit');
  });

  it('expired plan → PLAN_EXPIRED reason (critical)', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      planStatus: 'EXPIRED',
    });

    const plan = reasons.find((r) => r.code === 'PLAN_EXPIRED');
    expect(plan).toBeDefined();
    expect(plan!.severity).toBe('critical');
    expect(plan!.actionLabel).toBe('Choose Plan');
    expect(plan!.actionScreen).toBe('choose_plan');
  });

  it('no plan (NONE) → NO_ACTIVE_PLAN reason', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      planStatus: 'NONE',
    });

    const plan = reasons.find((r) => r.code === 'NO_ACTIVE_PLAN');
    expect(plan).toBeDefined();
    expect(plan!.severity).toBe('warning');
  });

  it('no plan (SELECTED) → NO_ACTIVE_PLAN reason', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      planStatus: 'SELECTED',
    });

    const plan = reasons.find((r) => r.code === 'NO_ACTIVE_PLAN');
    expect(plan).toBeDefined();
  });

  it('RETURN_REQUIRED rental status → RETURN_REQUIRED reason (critical)', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      rentalStatus: 'RETURN_REQUIRED',
    });

    const ret = reasons.find((r) => r.code === 'RETURN_REQUIRED');
    expect(ret).toBeDefined();
    expect(ret!.severity).toBe('critical');
    expect(ret!.actionLabel).toBe('End Rental');
    expect(ret!.actionScreen).toBe('end_rental');
  });

  it('TERMINATED account → TERMINATED reason (critical)', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      accountStatus: 'TERMINATED',
    });

    const term = reasons.find((r) => r.code === 'TERMINATED');
    expect(term).toBeDefined();
    expect(term!.severity).toBe('critical');
    expect(term!.actionLabel).toBe('Contact Support');
    expect(term!.actionScreen).toBe('support');
  });

  it('multiple reasons returned together', () => {
    const reasons = getSuspensionReasons({
      accountStatus: 'SUSPENDED',
      walletBalance: -50,
      kycStatus: 'PENDING',
      depositStatus: 'PENDING',
      planStatus: 'EXPIRED',
      rentalStatus: 'RETURN_REQUIRED',
      securityDeposit: 500,
    });

    const codes = reasons.map((r) => r.code);
    expect(codes).toContain('NEGATIVE_BALANCE');
    expect(codes).toContain('KYC_PENDING');
    expect(codes).toContain('DEPOSIT_PENDING');
    expect(codes).toContain('PLAN_EXPIRED');
    expect(codes).toContain('RETURN_REQUIRED');
  });

  it('returns both critical and warning reasons for mixed issues', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      walletBalance: -10, // NEGATIVE_BALANCE (critical)
      kycStatus: 'PENDING', // KYC_PENDING (warning)
      planStatus: 'EXPIRED', // PLAN_EXPIRED (critical)
      depositStatus: 'PENDING', // DEPOSIT_PENDING (warning)
    });

    const criticals = reasons.filter((r) => r.severity === 'critical');
    const warnings = reasons.filter((r) => r.severity === 'warning');

    expect(criticals.length).toBeGreaterThanOrEqual(1);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(criticals.some((r) => r.code === 'NEGATIVE_BALANCE')).toBe(true);
    expect(criticals.some((r) => r.code === 'PLAN_EXPIRED')).toBe(true);
    expect(warnings.some((r) => r.code === 'KYC_PENDING')).toBe(true);
    expect(warnings.some((r) => r.code === 'DEPOSIT_PENDING')).toBe(true);
  });

  it('all reasons have actionAvailable set to true', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      walletBalance: -10,
      kycStatus: 'PENDING',
      planStatus: 'NONE',
    });

    for (const r of reasons) {
      expect(r.actionAvailable).toBe(true);
    }
  });

  it('verified KYC does not produce KYC_PENDING reason', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      kycStatus: 'VERIFIED',
      walletBalance: 100,
    });

    expect(reasons.some((r) => r.code === 'KYC_PENDING')).toBe(false);
  });

  it('active plan does not produce plan-related reasons', () => {
    const reasons = getSuspensionReasons({
      ...baseRider,
      planStatus: 'ACTIVE',
      kycStatus: 'VERIFIED',
      walletBalance: 100,
    });

    expect(reasons.some((r) => r.code === 'PLAN_EXPIRED')).toBe(false);
    expect(reasons.some((r) => r.code === 'NO_ACTIVE_PLAN')).toBe(false);
  });
});
