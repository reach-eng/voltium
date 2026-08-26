import { logger } from './logger';
import { smsBreaker, CircuitBreakerError } from './circuit-breaker';

const SMS_FETCH_TIMEOUT_MS = 10_000;

async function sendSmsRaw(phone: string, message: string): Promise<boolean> {
  const provider = process.env.SMS_PROVIDER || 'mock';

  if (provider === 'msg91') {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (!authKey || !templateId) {
      logger.error('[SMS] MSG91 configuration missing');
      return false;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SMS_FETCH_TIMEOUT_MS);

      const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          Authkey: authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          short_url: '0',
          recipients: [{ mobiles: phone, OTP: message }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = await response.json();
      if (data.type === 'error') throw new Error(data.message);

      logger.info('[SMS] Delivered via MSG91', { phone: phone.slice(-4) });
      return true;
    } catch (err: unknown) {
      logger.error('[SMS] MSG91 provider failed', { error: (err instanceof Error ? err.message : String(err)), phone: phone.slice(-4) });
      throw err;
    }
  }

  if (provider !== 'mock') {
    logger.warn('[SMS] Unknown SMS provider, falling back to mock', { provider });
  }

  logger.info('[SMS-MOCK] Would send SMS', { phone: phone.slice(-4) });
  return true;
}

export async function sendSms(phone: string, message: string): Promise<boolean> {
  try {
    return await smsBreaker.execute(() => sendSmsRaw(phone, message));
  } catch (err: unknown) {
    if (err instanceof CircuitBreakerError) {
      logger.warn('[SMS] Circuit breaker OPEN — skipping send', { phone: phone.slice(-4) });
    } else {
      logger.error('[SMS] sendSms failed', { error: (err instanceof Error ? err.message : String(err)) });
    }
    return false;
  }
}
