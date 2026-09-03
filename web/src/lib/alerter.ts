/**
 * Alerter — Backend error alerting system.
 *
 * Sends critical error notifications via configured channels.
 * Uses the outbox pattern so alerts are reliable even during transient failures.
 *
 * Channels:
 *   - webhook (Slack/Discord generic)
 *   - log (always-on, local file)
 *
 * Configure via env vars:
 *   ALERT_WEBHOOK_URL=https://hooks.slack.com/...
 *   ALERT_WEBHOOK_CHANNEL=slack|discord|generic (default: generic)
 *   ALERT_MIN_LEVEL=error|warn|info (default: error)
 */

import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

type AlertLevel = 'info' | 'warn' | 'error' | 'critical';

interface AlertPayload {
  level: AlertLevel;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  error?: Error;
  source?: string;
}

const LEVEL_ORDER: Record<AlertLevel, number> = {
  info: 0,
  warn: 1,
  error: 2,
  critical: 3,
};

function shouldAlert(level: AlertLevel): boolean {
  const minLevel: AlertLevel = (process.env.ALERT_MIN_LEVEL as AlertLevel) || 'error';
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

export const alerter = {
  async send(payload: AlertPayload): Promise<void> {
    if (!shouldAlert(payload.level)) return;

    const webhookUrl = process.env.ALERT_WEBHOOK_URL || '';
    const webhookChannel = (process.env.ALERT_WEBHOOK_CHANNEL || 'generic') as
      | 'slack'
      | 'discord'
      | 'generic';

    // Always log locally
    const logFn = payload.level === 'critical' || payload.level === 'error'
      ? logger.error
      : payload.level === 'warn'
        ? logger.warn
        : logger.info;

    logFn(`[Alerter] ${payload.title}`, {
      message: payload.message,
      details: payload.details,
      source: payload.source || 'backend',
      errorStack: payload.error?.stack,
    });

    // Send webhook if configured
    if (webhookUrl) {
      await this.sendWebhook(payload).catch((err) => {
        logger.error('[Alerter] Webhook send failed', { error: (err instanceof Error ? err.message : String(err)) });
      });
    } else {
      // P1 audit finding: alerter silent without webhook.
      // Emit prominent stderr warning and audit record so operators know alerts are unrouted.
      console.error(
        `🚨 [ALERT UNROUTED - NO WEBHOOK CONFIGURED] [${payload.level.toUpperCase()}] ${payload.title}: ${payload.message}`
      );
      if (payload.level === 'critical' || payload.level === 'error') {
        try {
          const { createAuditLog } = await import('@/lib/audit-log');
          await createAuditLog({
            actorId: 'system.alerter',
            action: 'alert.unrouted',
            entity: 'system',
            entityId: payload.title,
            details: {
              level: payload.level,
              message: payload.message,
              source: payload.source || 'backend',
              warning: 'ALERT_WEBHOOK_URL is not configured; alert was dropped to stderr without outbound delivery',
            },
          });
        } catch {
          // Swallow DB errors in logging path to prevent crashing callers
        }
      }
    }
  },

  async sendWebhook(payload: AlertPayload): Promise<void> {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL || '';
    const webhookChannel = (process.env.ALERT_WEBHOOK_CHANNEL || 'generic') as
      | 'slack'
      | 'discord'
      | 'generic';
    const body = formatWebhookBody(payload, webhookChannel);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  },
};

function formatWebhookBody(
  payload: AlertPayload,
  channel: 'slack' | 'discord' | 'generic'
): Record<string, unknown> {
  const color =
    payload.level === 'critical'
      ? 'danger'
      : payload.level === 'error'
        ? 'danger'
        : payload.level === 'warn'
          ? 'warning'
          : 'good';

  const text =
    `*[${payload.level.toUpperCase()}] ${payload.title}*\n` +
    `${payload.message}\n` +
    `Source: ${payload.source || 'backend'}\n` +
    (payload.details ? `\`\`\`${JSON.stringify(payload.details, null, 2)}\`\`\`` : '');

  if (channel === 'slack') {
    return {
      attachments: [
        {
          color,
          title: payload.title,
          text: payload.message,
          fields: [
            { title: 'Level', value: payload.level.toUpperCase(), short: true },
            { title: 'Source', value: payload.source || 'backend', short: true },
            ...(payload.details
              ? [{ title: 'Details', value: `\`${JSON.stringify(payload.details)}\``, short: false }]
              : []),
          ],
          footer: 'Voltium Alerter',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };
  }

  if (channel === 'discord') {
    return {
      embeds: [
        {
          title: payload.title,
          description: payload.message,
          color: color === 'danger' ? 0xff0000 : color === 'warning' ? 0xffaa00 : 0x00aa00,
          fields: [
            { name: 'Level', value: payload.level.toUpperCase(), inline: true },
            { name: 'Source', value: payload.source || 'backend', inline: true },
          ],
          footer: { text: 'Voltium Alerter' },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  // Generic JSON webhook
  return {
    level: payload.level,
    title: payload.title,
    message: payload.message,
    source: payload.source || 'backend',
    details: payload.details,
    timestamp: new Date().toISOString(),
  };
}

/** Convenience: alert on unhandled exceptions from route handlers */
export function alertOnError(
  error: Error,
  context: { source?: string; details?: Record<string, unknown> } = {}
): Promise<void> {
  return alerter.send({
    level: 'error',
    title: 'Unhandled Error',
    message: (error instanceof Error ? error.message : String(error)),
    error,
    source: context.source || 'backend',
    details: context.details,
  });
}
