import { Bell, MessageSquare, Send, Smartphone } from 'lucide-react';

/**
 * R3.7x split — Bulk Messaging types & display helpers.
 *
 * Announcements, hubs, form state, and the small pure helpers that
 * the table + detail dialog need to render status badges and channel
 * icons consistently. Hooking lives in `useBulkMessaging.ts`.
 */

export interface Announcement {
  id: string;
  title: string;
  message: string;
  channel: string;
  targetAudience: string;
  targetIds: string[];
  scheduledAt: string | null;
  sentAt: string | null;
  status: string;
  totalRecipients: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubOption {
  id: string;
  name: string;
  city: string;
}

export type AnnouncementChannel = 'PUSH' | 'SMS' | 'IN_APP';
export type AnnouncementAudience =
  | 'ALL'
  | 'BY_HUB'
  | 'BY_STATUS'
  | 'BY_PLAN';

export interface AnnouncementFormState {
  title: string;
  message: string;
  channel: AnnouncementChannel;
  targetAudience: AnnouncementAudience;
  targetIds: string[];
  schedule: boolean;
  scheduledAt: string;
}

export const EMPTY_ANNOUNCEMENT_FORM: AnnouncementFormState = {
  title: '',
  message: '',
  channel: 'PUSH',
  targetAudience: 'ALL',
  targetIds: [],
  schedule: false,
  scheduledAt: '',
};

export const ANNOUNCEMENT_PAGE_SIZE = 20;

export const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All Status' },
  { value: 'SENT', label: 'Sent' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'FAILED', label: 'Failed' },
];

export const AUDIENCE_OPTIONS: { value: AnnouncementAudience; label: string }[] = [
  { value: 'ALL', label: 'All Riders' },
  { value: 'BY_HUB', label: 'By Hub' },
  { value: 'BY_STATUS', label: 'By Status' },
  { value: 'BY_PLAN', label: 'By Plan' },
];

export const CHANNEL_OPTIONS: { value: AnnouncementChannel; label: string }[] = [
  { value: 'PUSH', label: 'Push Notification' },
  { value: 'SMS', label: 'SMS' },
  { value: 'IN_APP', label: 'In-App' },
];

export const RIDER_STATUS_OPTIONS = [
  'ONBOARDING',
  'PRE_ACTIVE',
  'POST_ACTIVE',
  'SUSPENDED',
];

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'SENT':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'SCHEDULED':
      return 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
    case 'DRAFT':
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
    case 'FAILED':
      return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

export function getChannelIcon(channel: string) {
  switch (channel) {
    case 'PUSH':
      return Bell;
    case 'SMS':
      return Smartphone;
    case 'IN_APP':
      return MessageSquare;
    default:
      return Send;
  }
}

export function formatAnnouncementDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
