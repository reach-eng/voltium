import { createHmac, randomBytes } from 'crypto';
import firebaseAdmin from '@/lib/firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

/**
 * Server-side nonce dedup store.
 * Tracks sent security command nonces within a 10-minute window.
 * This mirrors the client-side nonce tracking in fcm_service.dart.
 */
const _sentNonces = new Map<string, number>();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes (matches client staleness window)

// Periodic cleanup of expired nonces every 5 minutes
if (typeof globalThis !== 'undefined' && !('_fcmNonceCleanup' in globalThis)) {
  (globalThis as any)._fcmNonceCleanup = true;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of _sentNonces) {
      if (now - ts > NONCE_TTL_MS) _sentNonces.delete(key);
    }
  }, 5 * 60 * 1000);
  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }
}

function trackNonce(nonce: string, action: string): boolean {
  const key = `${nonce}:${action}`;
  if (_sentNonces.has(key)) {
    logger.warn('[FCM] Duplicate nonce detected (possible replay attempt)', { nonce, action });
    return false;
  }
  _sentNonces.set(key, Date.now());
  return true;
}

/**
 * FCM Service Utility
 *
 * Provides methods to send remote commands to rider devices.
 */

export const fcmService = {
  /**
   * Send a data-only message to a specific device
   * Data messages are preferred for background processing on the device.
   */
  async sendDataMessage(token: string, data: Record<string, string>, priority: 'high' | 'normal' = 'normal') {
    if (!firebaseAdmin) {
      logger.error('[FCM] Firebase Admin not initialized');
      return { success: false, error: 'Firebase Admin not initialized' };
    }

    try {
      const message = {
        token,
        data,
        android: {
          priority,
          collapseKey: data.type || 'voltium_update',
        },
      };

      const response = await getMessaging(firebaseAdmin).send(message);
      logger.info('[FCM] Message sent successfully', { response, data });
      return { success: true, messageId: response };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isStaleToken =
        errMsg.includes('registration-token-not-registered') ||
        errMsg.includes('invalid-registration-token') ||
        errMsg.includes('Requested entity was not found');
      if (isStaleToken) {
        logger.warn('[FCM] Stale or invalid device token detected:', { token: token.slice(-6) });
      } else {
        logger.error('[FCM] Error sending message:', { error: errMsg, token: token.slice(-6) });
      }
      return { success: false, isStaleToken, error: errMsg || 'Failed to send FCM message' };
    }
  },

  /**
   * Send a data message to multiple device tokens in a single HTTP batch request (up to 500 tokens).
   */
  async sendMulticast(tokens: string[], data: Record<string, string>, priority: 'high' | 'normal' = 'normal') {
    if (!firebaseAdmin) {
      logger.error('[FCM] Firebase Admin not initialized');
      return { success: false, failureCount: tokens.length };
    }
    if (tokens.length === 0) return { success: true, successCount: 0, failureCount: 0 };

    try {
      const message = {
        tokens,
        data,
        android: {
          priority,
          collapseKey: data.type || 'voltium_update',
        },
      };

      const response = await getMessaging(firebaseAdmin).sendEachForMulticast(message);
      logger.info('[FCM] Multicast message sent', {
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error: unknown) {
      logger.error('[FCM] Error sending multicast message:', error);
      return { success: false, error: (error instanceof Error ? error.message : String(error)) };
    }
  },

  /**
   * Remote Lock Command
   */
  async sendRemoteLock(token: string) {
    throw new Error('LOCK_DEVICE command is disabled for security compliance.');
  },

  /**
   * Helper for security commands
   */
  async sendSecurityCommand(token: string, action: string, extra: any = {}) {
    if (action === 'LOCK_DEVICE' || action === 'FACTORY_RESET') {
      throw new Error(`${action} command is disabled for security compliance.`);
    }
    const ts = Date.now().toString();
    const nonce = randomBytes(16).toString('hex');
    const challenge = randomBytes(8).toString('hex');
    const hmacSecret = env.FCM_COMMAND_HMAC_SECRET;

    // Track nonce server-side to detect replay
    if (!trackNonce(nonce, action)) {
      return { success: false, error: 'Duplicate nonce detected' };
    }

    const signature = createHmac('sha256', hmacSecret)
      .update(`${action}.${ts}.${nonce}.${challenge}`)
      .digest('hex');
    return this.sendDataMessage(token, {
      type: 'SECURITY_COMMAND',
      action,
      ts,
      nonce,
      challenge,
      signature,
      ...extra,
    });
  },

  /**
   * Remote Factory Reset Command
   */
  async sendRemoteWipe(token: string) {
    return this.sendSecurityCommand(token, 'FACTORY_RESET');
  },

  async sendSyncDeviceData(token: string) {
    return this.sendSecurityCommand(token, 'SYNC_DEVICE_DATA');
  },

  /**
   * Remote Camera Control Command
   */
  async sendRemoteCameraControl(token: string, disabled: boolean) {
    return this.sendSecurityCommand(token, disabled ? 'DISABLE_CAMERA' : 'ENABLE_CAMERA');
  },

  /**
   * Remote Passcode Enforcement Command
   */
  async sendEnforcePasscode(token: string, minLength: string = '4') {
    return this.sendSecurityCommand(token, 'ENFORCE_PASSCODE', { minLength });
  },

  /**
   * Location Integrity Check Command
   */
  async sendCheckLocationIntegrity(token: string) {
    return this.sendSecurityCommand(token, 'CHECK_LOCATION_INTEGRITY');
  },

  async sendAdminLock(token: string) {
    // Pin is NOT sent via FCM — the client verifies lock via /api/rider/device/verify-lock
    // which checks the hashed lockPassword stored server-side.
    return this.sendSecurityCommand(token, 'ADMIN_LOCK');
  },

  async sendUnlockDevice(token: string) {
    return this.sendSecurityCommand(token, 'UNLOCK_DEVICE');
  },
  async sendPersistApp(token: string, enabled: boolean) {
    return this.sendSecurityCommand(token, 'PERSIST_APP', { enabled: enabled.toString() });
  },
  async sendEnforceLocation(token: string, enabled: boolean) {
    return this.sendSecurityCommand(token, 'ENFORCE_LOCATION', { enabled: enabled.toString() });
  },
  async sendRestrictAppsControl(token: string, enabled: boolean) {
    return this.sendSecurityCommand(token, 'RESTRICT_APPS_CONTROL', {
      enabled: enabled.toString(),
    });
  },

  /**
   * Send a standard push notification with UI
   */
  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data: Record<string, string> = {}
  ) {
    if (!firebaseAdmin) return { success: false, error: 'Firebase Admin not initialized' };

    try {
      const message = {
        token,
        notification: { title, body },
        data: {
          ...data,
          type: 'NOTIFICATION',
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'voltium_notifications',
            priority: 'high' as const,
          },
        },
      };

      const response = await getMessaging(firebaseAdmin).send(message);
      return { success: true, messageId: response };
    } catch (error: unknown) {
      logger.error('[FCM] Error sending push:', error);
      return { success: false, error: (error instanceof Error ? error.message : String(error)) };
    }
  },

  /**
   * Send a trigger for an in-app overlay
   */
  async sendOverlayTrigger(
    token: string,
    action: string,
    extraData: Record<string, string> = {}
  ) {
    return this.sendDataMessage(token, {
      type: 'OVERLAY_TRIGGER',
      action,
      ...extraData,
    });
  },
};
