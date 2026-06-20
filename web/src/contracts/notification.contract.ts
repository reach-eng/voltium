/**
 * Notification API Contract — request/response DTOs for push notification and announcement routes.
 */

import type { ApiResponseSuccess } from '@/lib/api-response';

// ── GET /api/rider/notifications ──────────────────────────────────────

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface ListNotificationsResponse {
  notifications: NotificationResponse[];
  unreadCount: number;
  total: number;
}

// ── PUT /api/rider/notifications/read ─────────────────────────────────

export interface MarkAsReadRequest {
  notificationIds: string[];
}

export interface MarkAsReadResponse {
  marked: number;
}

// ── GET /api/rider/notifications/preferences ─────────────────────────

export interface NotificationPreferencesResponse {
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

// ── Admin - POST /api/admin/announcements ─────────────────────────────

export interface CreateAnnouncementRequest {
  title: string;
  message: string;
  channel: 'push' | 'sms' | 'email' | 'in_app';
  targetAudience: 'all' | 'active_riders' | 'specific_riders' | 'hub';
  riderIds?: string[];
  hubId?: string;
  scheduledAt?: string;
}

export interface AnnouncementResponse {
  id: string;
  title: string;
  status: string;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export type ListNotificationsApiResponse = ApiResponseSuccess<ListNotificationsResponse>;
export type MarkAsReadApiResponse = ApiResponseSuccess<MarkAsReadResponse>;
export type NotificationPreferencesApiResponse =
  ApiResponseSuccess<NotificationPreferencesResponse>;
export type CreateAnnouncementApiResponse = ApiResponseSuccess<AnnouncementResponse>;
