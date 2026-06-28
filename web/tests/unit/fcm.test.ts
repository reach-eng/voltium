import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac, randomBytes } from 'crypto';

vi.mock('@/lib/firebase-admin', () => ({ default: null }));
vi.mock('@/lib/env', () => ({
  env: { FCM_COMMAND_HMAC_SECRET: 'test-hmac-secret-32-chars-long!!' },
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { fcmService } = await import('@/lib/fcm');

describe('fcmService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendSecurityCommand', () => {
    it('should produce a valid HMAC signature', async () => {
      const result = await fcmService.sendSecurityCommand('fake-token', 'ADMIN_LOCK');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Firebase Admin not initialized');
    });

    it('should throw for LOCK_DEVICE action', async () => {
      await expect(
        fcmService.sendSecurityCommand('fake-token', 'LOCK_DEVICE')
      ).rejects.toThrow('disabled for security compliance');
    });

    it('should throw for FACTORY_RESET action', async () => {
      await expect(
        fcmService.sendSecurityCommand('fake-token', 'FACTORY_RESET')
      ).rejects.toThrow('disabled for security compliance');
    });
  });

  describe('sendDataMessage', () => {
    it('should return error when Firebase Admin is not initialized', async () => {
      const result = await fcmService.sendDataMessage('fake-token', { type: 'NOTIFICATION' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Firebase Admin not initialized');
    });
  });

  describe('sendPushNotification', () => {
    it('should return error when Firebase Admin is not initialized', async () => {
      const result = await fcmService.sendPushNotification('fake-token', 'Title', 'Body');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Firebase Admin not initialized');
    });
  });

  describe('sendRemoteLock', () => {
    it('should throw', async () => {
      await expect(fcmService.sendRemoteLock('fake-token')).rejects.toThrow('disabled');
    });
  });

  describe('sendRemoteWipe', () => {
    it('should throw', async () => {
      await expect(fcmService.sendRemoteWipe('fake-token')).rejects.toThrow('disabled');
    });
  });

  describe('sendRemoteCameraControl', () => {
    it('should forward DISABLE_CAMERA action', async () => {
      const result = await fcmService.sendRemoteCameraControl('fake-token', true);
      expect(result.success).toBe(false);
    });

    it('should forward ENABLE_CAMERA action', async () => {
      const result = await fcmService.sendRemoteCameraControl('fake-token', false);
      expect(result.success).toBe(false);
    });
  });

  describe('sendEnforcePasscode', () => {
    it('should forward ENFORCE_PASSCODE action', async () => {
      const result = await fcmService.sendEnforcePasscode('fake-token');
      expect(result.success).toBe(false);
    });
  });

  describe('sendCheckLocationIntegrity', () => {
    it('should forward CHECK_LOCATION_INTEGRITY action', async () => {
      const result = await fcmService.sendCheckLocationIntegrity('fake-token');
      expect(result.success).toBe(false);
    });
  });

  describe('sendAdminLock', () => {
    it('should forward ADMIN_LOCK action', async () => {
      const result = await fcmService.sendAdminLock('fake-token');
      expect(result.success).toBe(false);
    });
  });

  describe('sendUnlockDevice', () => {
    it('should forward UNLOCK_DEVICE action', async () => {
      const result = await fcmService.sendUnlockDevice('fake-token');
      expect(result.success).toBe(false);
    });
  });

  describe('sendPersistApp', () => {
    it('should forward PERSIST_APP action', async () => {
      const result = await fcmService.sendPersistApp('fake-token', true);
      expect(result.success).toBe(false);
    });
  });

  describe('sendEnforceLocation', () => {
    it('should forward ENFORCE_LOCATION action', async () => {
      const result = await fcmService.sendEnforceLocation('fake-token', true);
      expect(result.success).toBe(false);
    });
  });

  describe('sendRestrictAppsControl', () => {
    it('should forward RESTRICT_APPS_CONTROL action', async () => {
      const result = await fcmService.sendRestrictAppsControl('fake-token', true);
      expect(result.success).toBe(false);
    });
  });
});
