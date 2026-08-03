/**
 * SMS Provider — Unit Tests
 *
 * Tests src/lib/sms-provider.ts: sendSms is wrapped in the smsBreaker
 * circuit breaker. After N consecutive failures, the breaker opens and
 * subsequent calls fail-fast (return false without hitting the network).
 *
 * Covers:
 *   - Successful call keeps the breaker CLOSED.
 *   - After 3 consecutive failures, the 4th call returns false immediately
 *     (no fetch call) — the breaker is OPEN.
 *   - After the cooldown period, the breaker transitions to HALF_OPEN; a
 *     successful call closes it again.
 *
 * The smsBreaker is a module-level singleton (see web/src/lib/circuit-breaker.ts),
 * so each test uses vi.resetModules() to start with a fresh breaker. The
 * configured thresholds are: failureThreshold=3, recoveryTimeoutMs=60_000,
 * halfOpenMaxRequests=2.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PHONE = '+919999999999';
const MESSAGE = 'test-otp';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeErrorJsonResponse(message: string, status = 200): Response {
  return makeJsonResponse({ type: 'error', message }, status);
}

describe('sendSms circuit breaker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    vi.resetModules();
    process.env.SMS_PROVIDER = 'msg91';
    process.env.MSG91_AUTH_KEY = 'test-auth-key';
    process.env.MSG91_TEMPLATE_ID = 'test-template-id';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the breaker CLOSED after a successful call', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(makeJsonResponse({ type: 'success' })));
    vi.stubGlobal('fetch', fetchMock);

    const { sendSms } = await import('../../../src/lib/sms-provider');
    const { smsBreaker } = await import('../../../src/lib/circuit-breaker');

    const result = await sendSms(PHONE, MESSAGE);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(smsBreaker.getState()).toBe('CLOSED');
  });

  it('opens the breaker after 3 consecutive failures and fails fast on the 4th call', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(makeErrorJsonResponse('provider down')));
    vi.stubGlobal('fetch', fetchMock);

    const { sendSms } = await import('../../../src/lib/sms-provider');
    const { smsBreaker } = await import('../../../src/lib/circuit-breaker');

    // Three consecutive failures trip the breaker (failureThreshold: 3).
    expect(await sendSms(PHONE, MESSAGE)).toBe(false);
    expect(await sendSms(PHONE, MESSAGE)).toBe(false);
    expect(await sendSms(PHONE, MESSAGE)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(smsBreaker.getState()).toBe('OPEN');

    // 4th call: breaker is OPEN, no fetch should occur, returns false.
    fetchMock.mockClear();
    expect(await sendSms(PHONE, MESSAGE)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(smsBreaker.getState()).toBe('OPEN');
  });

  it('transitions OPEN → HALF_OPEN after the cooldown and CLOSED on probe success', async () => {
    // Build a mock that fails three times, then always succeeds.
    // Use mockImplementation (not mockResolvedValue) so each call returns a
    // fresh Response object — Response bodies are single-read streams.
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(makeErrorJsonResponse('down 1')))
      .mockImplementationOnce(() => Promise.resolve(makeErrorJsonResponse('down 2')))
      .mockImplementationOnce(() => Promise.resolve(makeErrorJsonResponse('down 3')))
      .mockImplementation(() => Promise.resolve(makeJsonResponse({ type: 'success' })));
    vi.stubGlobal('fetch', fetchMock);

    const { sendSms } = await import('../../../src/lib/sms-provider');
    const { smsBreaker } = await import('../../../src/lib/circuit-breaker');

    // Trip the breaker.
    expect(await sendSms(PHONE, MESSAGE)).toBe(false);
    expect(await sendSms(PHONE, MESSAGE)).toBe(false);
    expect(await sendSms(PHONE, MESSAGE)).toBe(false);
    expect(smsBreaker.getState()).toBe('OPEN');

    // Mid-cooldown: still OPEN.
    vi.advanceTimersByTime(30_000);
    expect(smsBreaker.getState()).toBe('OPEN');

    // After the full 60s cooldown, getState() lazily flips to HALF_OPEN.
    vi.advanceTimersByTime(30_001);
    expect(smsBreaker.getState()).toBe('HALF_OPEN');

    // Probe: next two calls go through. With successful responses, the
    // breaker closes once halfOpenMaxRequests (2) successes are recorded.
    expect(await sendSms(PHONE, MESSAGE)).toBe(true);
    expect(await sendSms(PHONE, MESSAGE)).toBe(true);
    expect(smsBreaker.getState()).toBe('CLOSED');
  });
});
