import crypto from 'crypto';
import { logger } from '@/lib/logger';

export const RazorpayService = {
  async getActiveGatewayConfig(): Promise<{ webhookSecret?: string } | null> {
    return null;
  },

  verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch {
      return false;
    }
  },

  async handleWebhookEvent(event: string, payload: unknown): Promise<{ handled: boolean; message?: string }> {
    logger.info('Razorpay webhook event received', { event });
    return { handled: true, message: 'Event handled' };
  },
};
