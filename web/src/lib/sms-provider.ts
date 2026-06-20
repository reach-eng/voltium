import { logger } from './logger';

const SMS_FETCH_TIMEOUT_MS = 10_000;

export async function sendSms(phone: string, message: string): Promise<boolean> {
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
    } catch (err: any) {
      logger.error('[SMS] MSG91 provider failed', { error: err.message, phone: phone.slice(-4) });
      return false;
    }
  }

  if (provider !== 'mock') {
    logger.warn('[SMS] Unknown SMS provider, falling back to mock', { provider });
  }

  logger.info('[SMS-MOCK] Would send SMS', { phone: phone.slice(-4) });
  return true;
}
