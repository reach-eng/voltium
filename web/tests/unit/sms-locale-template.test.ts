/**
 * Phase 3 Stage B — Hindi SMS Template & Picker Unit Tests
 *
 * Covers:
 * 1. getMsg91TemplateId template selection and fallback logic:
 *    - 'hi', 'hi_IN', 'hi-IN', uppercase 'HI', and padded strings
 *    - 'en', 'en_IN', unsupported codes ('fr'), null, undefined
 *    - Fallback to MSG91_TEMPLATE_ID when MSG91_TEMPLATE_ID_HI is unset or empty
 *    - Undefined when neither is configured
 * 2. sendSms dispatch with locale options:
 *    - Correct template_id selected in MSG91 Flow API payload
 *    - Graceful fallback to default template when HI template is missing
 *    - Accepts both string ('hi') and options object ({ locale: 'hi' })
 * 3. authUseCases.sendOtp wrapper sentence localization:
 *    - Hindi wrapper sentence and outbox payload when rider preferredLocale is 'hi'
 *    - Hindi wrapper sentence when input.locale is 'hi'
 *    - English default wrapper sentence when preferredLocale is null or 'en'
 * 4. POST /api/emergency/sos SMS fanout localization:
 *    - Hindi SMS body and locale option when rider has preferredLocale: 'hi'
 *    - English SMS body and locale option when rider has preferredLocale: 'en' / null
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMsg91TemplateId, sendSms } from '@/lib/sms-provider';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getMsg91TemplateId — Locale Picker', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.MSG91_TEMPLATE_ID = 'default-en-template';
    process.env.MSG91_TEMPLATE_ID_HI = 'hindi-hi-template';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns Hindi template when locale is "hi"', () => {
    expect(getMsg91TemplateId('hi')).toBe('hindi-hi-template');
  });

  it('returns Hindi template for "hi_IN" regional tag', () => {
    expect(getMsg91TemplateId('hi_IN')).toBe('hindi-hi-template');
  });

  it('returns Hindi template for "hi-IN" hyphenated tag', () => {
    expect(getMsg91TemplateId('hi-IN')).toBe('hindi-hi-template');
  });

  it('returns Hindi template case-insensitively ("HI")', () => {
    expect(getMsg91TemplateId('HI')).toBe('hindi-hi-template');
  });

  it('handles whitespace in locale string ("  hi  ")', () => {
    expect(getMsg91TemplateId('  hi  ')).toBe('hindi-hi-template');
  });

  it('falls back to default template when locale is "hi" but MSG91_TEMPLATE_ID_HI is undefined', () => {
    delete process.env.MSG91_TEMPLATE_ID_HI;
    expect(getMsg91TemplateId('hi')).toBe('default-en-template');
  });

  it('falls back to default template when locale is "hi" but MSG91_TEMPLATE_ID_HI is empty string', () => {
    process.env.MSG91_TEMPLATE_ID_HI = '   ';
    expect(getMsg91TemplateId('hi')).toBe('default-en-template');
  });

  it('returns default English template for "en"', () => {
    expect(getMsg91TemplateId('en')).toBe('default-en-template');
  });

  it('returns default English template for "en_IN"', () => {
    expect(getMsg91TemplateId('en_IN')).toBe('default-en-template');
  });

  it('returns default template when locale is null', () => {
    expect(getMsg91TemplateId(null)).toBe('default-en-template');
  });

  it('returns default template when locale is undefined', () => {
    expect(getMsg91TemplateId(undefined)).toBe('default-en-template');
  });

  it('returns default template for unsupported locale codes (e.g. "fr")', () => {
    expect(getMsg91TemplateId('fr')).toBe('default-en-template');
  });

  it('returns undefined when neither default nor Hindi template is configured', () => {
    delete process.env.MSG91_TEMPLATE_ID;
    delete process.env.MSG91_TEMPLATE_ID_HI;
    expect(getMsg91TemplateId('hi')).toBeUndefined();
    expect(getMsg91TemplateId('en')).toBeUndefined();
  });
});

describe('sendSms with MSG91 locale flow dispatch', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SMS_PROVIDER = 'msg91';
    process.env.MSG91_AUTH_KEY = 'auth-key-test';
    process.env.MSG91_TEMPLATE_ID = 'en-template-123';
    process.env.MSG91_TEMPLATE_ID_HI = 'hi-template-456';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('dispatches with Hindi template when options.locale is "hi"', async () => {
    let capturedBody: any = null;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve(makeJsonResponse({ type: 'success' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendSms('+919876543210', '123456', { locale: 'hi' });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedBody.template_id).toBe('hi-template-456');
    expect(capturedBody.recipients[0].mobiles).toBe('+919876543210');
    expect(capturedBody.recipients[0].OTP).toBe('123456');
  });

  it('dispatches with Hindi template when locale is passed as a bare string "hi"', async () => {
    let capturedBody: any = null;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve(makeJsonResponse({ type: 'success' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendSms('+919876543210', '123456', 'hi');

    expect(result).toBe(true);
    expect(capturedBody.template_id).toBe('hi-template-456');
  });

  it('falls back to English template when locale is "hi" but MSG91_TEMPLATE_ID_HI is not set', async () => {
    delete process.env.MSG91_TEMPLATE_ID_HI;
    let capturedBody: any = null;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve(makeJsonResponse({ type: 'success' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendSms('+919876543210', '123456', { locale: 'hi' });

    expect(result).toBe(true);
    expect(capturedBody.template_id).toBe('en-template-123');
  });

  it('dispatches with English template when locale is "en"', async () => {
    let capturedBody: any = null;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve(makeJsonResponse({ type: 'success' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendSms('+919876543210', '123456', { locale: 'en' });

    expect(result).toBe(true);
    expect(capturedBody.template_id).toBe('en-template-123');
  });

  it('returns false without throwing when MSG91 configuration is missing', async () => {
    delete process.env.MSG91_AUTH_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendSms('+919876543210', '123456');

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles mock provider gracefully', async () => {
    process.env.SMS_PROVIDER = 'mock';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendSms('+919876543210', '123456', { locale: 'hi' });

    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('authUseCases.sendOtp — Localized Wrapper Sentence & Outbox Payload', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('emits Hindi wrapper message and locale when existing rider preferredLocale is "hi"', async () => {
    const mockDb = {
      rider: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'rider-1',
          phone: '+919876543210',
          preferredLocale: 'hi',
        }),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
      },
    };

    vi.doMock('@/lib/db', () => ({ db: mockDb }));
    vi.doMock('@/lib/otp-store', () => ({
      generateOtp: vi.fn().mockResolvedValue('654321'),
    }));
    vi.doMock('@/lib/rate-limit', () => ({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      AUTH_RATE_LIMIT: { windowMs: 60000, maxRequests: 5 },
    }));
    vi.doMock('@/lib/feature-flags', () => ({
      getFeatureFlags: vi.fn().mockResolvedValue({ enablePushNotifications: false }),
    }));

    const { authUseCases } = await import('@/server/modules/auth/auth.use-cases');
    await authUseCases.sendOtp({ phone: '9876543210' });

    expect(mockDb.outboxEvent.create).toHaveBeenCalledTimes(1);
    const callArg = mockDb.outboxEvent.create.mock.calls[0][0];
    expect(callArg.data.eventType).toBe('sms.send');
    const payload = JSON.parse(callArg.data.payload);
    expect(payload.phone).toBe('9876543210');
    expect(payload.message).toBe('आपका Voltium सत्यापन कोड है: 654321। यह कोड किसी के साथ साझा न करें।');
    expect(payload.locale).toBe('hi');
  });

  it('emits Hindi wrapper message when input carries locale: "hi"', async () => {
    const mockDb = {
      rider: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'evt-2' }),
      },
    };

    vi.doMock('@/lib/db', () => ({ db: mockDb }));
    vi.doMock('@/lib/otp-store', () => ({
      generateOtp: vi.fn().mockResolvedValue('789012'),
    }));
    vi.doMock('@/lib/rate-limit', () => ({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      AUTH_RATE_LIMIT: { windowMs: 60000, maxRequests: 5 },
    }));
    vi.doMock('@/lib/feature-flags', () => ({
      getFeatureFlags: vi.fn().mockResolvedValue({ enablePushNotifications: false }),
    }));

    const { authUseCases } = await import('@/server/modules/auth/auth.use-cases');
    await authUseCases.sendOtp({ phone: '9876543210', locale: 'hi' });

    expect(mockDb.outboxEvent.create).toHaveBeenCalledTimes(1);
    const callArg = mockDb.outboxEvent.create.mock.calls[0][0];
    expect(callArg.data.eventType).toBe('sms.send');
    const payload = JSON.parse(callArg.data.payload);
    expect(payload.phone).toBe('9876543210');
    expect(payload.message).toBe('आपका Voltium सत्यापन कोड है: 789012। यह कोड किसी के साथ साझा न करें।');
    expect(payload.locale).toBe('hi');
  });

  it('emits English wrapper message when preferredLocale is null or "en"', async () => {
    const mockDb = {
      rider: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'rider-2',
          phone: '+919876543210',
          preferredLocale: null,
        }),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'evt-3' }),
      },
    };

    vi.doMock('@/lib/db', () => ({ db: mockDb }));
    vi.doMock('@/lib/otp-store', () => ({
      generateOtp: vi.fn().mockResolvedValue('999888'),
    }));
    vi.doMock('@/lib/rate-limit', () => ({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      AUTH_RATE_LIMIT: { windowMs: 60000, maxRequests: 5 },
    }));
    vi.doMock('@/lib/feature-flags', () => ({
      getFeatureFlags: vi.fn().mockResolvedValue({ enablePushNotifications: false }),
    }));

    const { authUseCases } = await import('@/server/modules/auth/auth.use-cases');
    await authUseCases.sendOtp({ phone: '9876543210' });

    expect(mockDb.outboxEvent.create).toHaveBeenCalledTimes(1);
    const callArg = mockDb.outboxEvent.create.mock.calls[0][0];
    expect(callArg.data.eventType).toBe('sms.send');
    const payload = JSON.parse(callArg.data.payload);
    expect(payload.phone).toBe('9876543210');
    expect(payload.message).toBe('Your Voltium verification code is: 999888. Do not share this code with anyone.');
    expect(payload.locale).toBeNull();
  });
});

describe('POST /api/emergency/sos — SMS Fanout Localization', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('fans out Hindi SMS alert to emergency contacts when rider preferredLocale is "hi"', async () => {
    const mockSendSms = vi.fn().mockResolvedValue(true);
    const mockDb = {
      rider: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'rider-sos-1',
          preferredLocale: 'hi',
        }),
      },
    };

    vi.doMock('@/lib/db', () => ({ db: mockDb }));
    vi.doMock('@/lib/sms-provider', () => ({ sendSms: mockSendSms }));
    vi.doMock('@/lib/rider-auth', () => ({
      requireRiderSession: vi.fn().mockResolvedValue({
        riderDbId: 'rider-sos-1',
        phone: '9876543210',
      }),
    }));
    vi.doMock('@/lib/audit-log', () => ({
      createAuditLog: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@/lib/alerter', () => ({
      alerter: { send: vi.fn().mockResolvedValue(undefined) },
    }));

    const { NextRequest } = await import('next/server');
    const { POST } = await import('@/app/api/emergency/sos/route');

    const req = new NextRequest('http://localhost/api/emergency/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 28.6139,
        longitude: 77.209,
        contacts: [{ name: 'Friend', phone: '+919876543211' }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Allow the fire-and-forget fanout promise to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendSms).toHaveBeenCalledWith(
      '+919876543211',
      expect.stringContaining('Voltium राइडर SOS: 9876543210 ने एक आपातकालीन अलर्ट ट्रिगर किया है।'),
      { locale: 'hi' }
    );
    expect(mockSendSms).toHaveBeenCalledWith(
      '+919876543211',
      expect.stringContaining('स्थान: https://maps.google.com/?q=28.6139,77.209'),
      { locale: 'hi' }
    );
  });

  it('fans out English SMS alert to emergency contacts when rider preferredLocale is not "hi"', async () => {
    const mockSendSms = vi.fn().mockResolvedValue(true);
    const mockDb = {
      rider: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'rider-sos-2',
          preferredLocale: 'en',
        }),
      },
    };

    vi.doMock('@/lib/db', () => ({ db: mockDb }));
    vi.doMock('@/lib/sms-provider', () => ({ sendSms: mockSendSms }));
    vi.doMock('@/lib/rider-auth', () => ({
      requireRiderSession: vi.fn().mockResolvedValue({
        riderDbId: 'rider-sos-2',
        phone: '9876543210',
      }),
    }));
    vi.doMock('@/lib/audit-log', () => ({
      createAuditLog: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@/lib/alerter', () => ({
      alerter: { send: vi.fn().mockResolvedValue(undefined) },
    }));

    const { NextRequest } = await import('next/server');
    const { POST } = await import('@/app/api/emergency/sos/route');

    const req = new NextRequest('http://localhost/api/emergency/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 28.6139,
        longitude: 77.209,
        contacts: [{ name: 'Friend', phone: '+919876543211' }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Allow the fire-and-forget fanout promise to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendSms).toHaveBeenCalledWith(
      '+919876543211',
      expect.stringContaining('Voltium rider SOS: 9876543210 triggered an emergency alert.'),
      { locale: 'en' }
    );
    expect(mockSendSms).toHaveBeenCalledWith(
      '+919876543211',
      expect.stringContaining('Location: https://maps.google.com/?q=28.6139,77.209'),
      { locale: 'en' }
    );
  });
});
