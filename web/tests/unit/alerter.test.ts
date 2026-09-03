import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { alerter } from '@/lib/alerter';
import { logger } from '@/lib/logger';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockCreateAuditLog = vi.fn().mockResolvedValue({ id: 'audit-1' });
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mockCreateAuditLog,
}));

describe('Alerter Service', () => {
  const originalEnv = process.env;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  it('logs locally and emits loud warning when ALERT_WEBHOOK_URL is unset', async () => {
    delete process.env.ALERT_WEBHOOK_URL;

    await alerter.send({
      level: 'error',
      title: 'Database connection failed',
      message: 'Connection timed out after 5000ms',
      source: 'test-runner',
    });

    expect(logger.error).toHaveBeenCalledWith(
      '[Alerter] Database connection failed',
      expect.objectContaining({
        message: 'Connection timed out after 5000ms',
        source: 'test-runner',
      })
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ALERT UNROUTED - NO WEBHOOK CONFIGURED]')
    );

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'system.alerter',
        action: 'alert.unrouted',
      })
    );
  });

  it('filters out alerts below minLevel', async () => {
    await alerter.send({
      level: 'info',
      title: 'Informational ping',
      message: 'All good',
    });

    expect(logger.info).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('sends webhook when ALERT_WEBHOOK_URL is configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as any);

    // Mock sendWebhook call
    const sendWebhookSpy = vi.spyOn(alerter, 'sendWebhook').mockResolvedValueOnce();

    // Use a configured webhook url
    vi.stubEnv('ALERT_WEBHOOK_URL', 'https://hooks.slack.com/services/xxx');
    
    await alerter.sendWebhook({
      level: 'critical',
      title: 'Server Crash',
      message: 'Kernel panic',
      details: { code: 500 },
    });

    fetchSpy.mockRestore();
  });
});
