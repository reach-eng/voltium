/**
 * Notifications module - Types
 *
 * Push notification, in-app notification, and device token types.
 */

export type NotificationType = 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE';

export interface Notification {
  id: string;
  riderId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Date;
}

export interface SendNotificationInput {
  title: string;
  message: string;
  type?: NotificationType;
  riderIds?: string[];
  sendToAll?: boolean;
}

export interface FcmDeviceToken {
  riderId: string;
  token: string;
  platform: 'android' | 'ios';
  lastUsed: Date;
}
