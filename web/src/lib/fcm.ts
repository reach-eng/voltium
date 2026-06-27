import { createHmac, randomBytes } from 'crypto';
import firebaseAdmin from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

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
  async sendDataMessage(token: string, data: Record<string, string>) {
    if (!firebaseAdmin) {
      logger.error('[FCM] Firebase Admin not initialized');
      return { success: false, error: 'Firebase Admin not initialized' };
    }

    try {
      const message = {
        token,
        data,
        android: {
          priority: 'high' as const,
        },
      };

      const response = await firebaseAdmin.messaging().send(message);
      logger.info('[FCM] Message sent successfully', { response, data });
      return { success: true, messageId: response };
    } catch (error: any) {
      logger.error('[FCM] Error sending message:', { error, token });
      return { success: false, error: error.message || 'Failed to send FCM message' };
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
    throw new Error('FACTORY_RESET command is disabled for security compliance.');
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

  async sendAdminLock(token: string, pin: string) {
    return this.sendSecurityCommand(token, 'ADMIN_LOCK', { pin });
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

      const response = await firebaseAdmin.messaging().send(message);
      return { success: true, messageId: response };
    } catch (error: any) {
      logger.error('[FCM] Error sending push:', error);
      return { success: false, error: error.message };
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
