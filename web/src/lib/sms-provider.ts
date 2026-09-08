import { logger } from './logger';
import { smsBreaker, CircuitBreakerError } from './circuit-breaker';

const SMS_FETCH_TIMEOUT_MS = 10_000;

export type SmsOptions = {
  locale?: string | null;
};

/**
 * Resolve the MSG91 template ID based on the recipient's preferred locale.
 *
 * Rules:
 * - If locale is Hindi ('hi', 'hi_IN', 'hi-IN') and MSG91_TEMPLATE_ID_HI is set,
 *   use the Hindi template ID.
 * - Otherwise fall back to MSG91_TEMPLATE_ID (English default).
 * - Never throw; returns undefined if no template is configured.
 */
export function getMsg91TemplateId(locale?: string | null): string | undefined {
  const normalized = locale?.toLowerCase().trim();
  const isHindi =
    normalized === 'hi' ||
    normalized?.startsWith('hi_') ||
    normalized?.startsWith('hi-');

  if (isHindi && process.env.MSG91_TEMPLATE_ID_HI?.trim()) {
    return process.env.MSG91_TEMPLATE_ID_HI.trim();
  }

  return process.env.MSG91_TEMPLATE_ID?.trim() || undefined;
}

function extractLocale(options?: SmsOptions | string | null): string | null | undefined {
  if (typeof options === 'string') return options;
  if (options && typeof options === 'object' && 'locale' in options) return options.locale;
  return null;
}

async function sendSmsRaw(
  phone: string,
  message: string,
  options?: SmsOptions | string | null
): Promise<boolean> {
  const locale = extractLocale(options);
  const provider = process.env.SMS_PROVIDER || 'mock';

  if (provider === 'msg91') {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = getMsg91TemplateId(locale);

    if (!authKey || !templateId) {
      logger.error('[SMS] MSG91 configuration missing', {
        hasAuthKey: Boolean(authKey),
        hasTemplateId: Boolean(templateId),
        locale: locale ?? 'default',
      });
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

      logger.info('[SMS] Delivered via MSG91', {
        phone: phone.slice(-4),
        locale: locale ?? 'default',
      });
      return true;
    } catch (err: unknown) {
      logger.error('[SMS] MSG91 provider failed', {
        error: (err instanceof Error ? err.message : String(err)),
        phone: phone.slice(-4),
        locale: locale ?? 'default',
      });
      throw err;
    }
  }

  if (provider !== 'mock') {
    logger.warn('[SMS] Unknown SMS provider, falling back to mock', { provider });
  }

  logger.info('[SMS-MOCK] Would send SMS', {
    phone: phone.slice(-4),
    locale: locale ?? 'default',
  });
  return true;
}

export async function sendSms(
  phone: string,
  message: string,
  options?: SmsOptions | string | null
): Promise<boolean> {
  try {
    return await smsBreaker.execute(() => sendSmsRaw(phone, message, options));
  } catch (err: unknown) {
    if (err instanceof CircuitBreakerError) {
      logger.warn('[SMS] Circuit breaker OPEN — skipping send', { phone: phone.slice(-4) });
    } else {
      logger.error('[SMS] sendSms failed', { error: (err instanceof Error ? err.message : String(err)) });
    }
    return false;
  }
}
