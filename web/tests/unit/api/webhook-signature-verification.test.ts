import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockRazorpayService = {
  getActiveGatewayConfig: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  handleWebhookEvent: vi.fn(),
};

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/server/modules/payments/razorpay.service', () => ({
  RazorpayService: mockRazorpayService,
}));

const { POST } = ((await import('@/app/api/webhooks/razorpay/route' as any)) as any);

describe('POST /api/webhooks/razorpay — Webhook Signature Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_12345';
    mockRazorpayService.getActiveGatewayConfig.mockResolvedValue(null);
  });

  it('rejects with 400 when x-razorpay-signature header is missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/razorpay', {
      method: 'POST',
      body: JSON.stringify({ event: 'payment.captured' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing signature header');
  });

  it('rejects with 401 when signature verification fails', async () => {
    mockRazorpayService.verifyWebhookSignature.mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/webhooks/razorpay', {
      method: 'POST',
      body: JSON.stringify({ event: 'payment.captured' }),
      headers: {
        'x-razorpay-signature': 'invalid_signature_hex',
        'content-type': 'application/json',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid signature');
  });

  it('processes event and returns 200 when signature is valid', async () => {
    mockRazorpayService.verifyWebhookSignature.mockReturnValue(true);
    mockRazorpayService.handleWebhookEvent.mockResolvedValue({
      handled: true,
      message: 'Payment processed',
    });

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_123', order_id: 'order_123', amount: 50000 } },
      },
    };

    const req = new NextRequest('http://localhost/api/webhooks/razorpay', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'x-razorpay-signature': 'valid_signature_hex',
        'content-type': 'application/json',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.event).toBe('payment.captured');
    expect(body.handled).toBe(true);
  });
});
