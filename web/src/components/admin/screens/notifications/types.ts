/**
 * R3.7f split — Notification types & styling.
 *
 * The Notification + RiderOption shapes were inlined in
 * NotificationManagement.tsx alongside the typeColors map. Extracted
 * so the data hook, table, and dialog can all share the same view of
 * what a notification looks like.
 */

export interface Notification {
  id: string;
  riderId: string;
  riderName: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface RiderOption {
  id: string;
  riderId: string;
  fullName: string;
}

export interface NotificationForm {
  riderId: string;
  title: string;
  message: string;
  type: string;
}

export const EMPTY_NOTIFICATION_FORM: NotificationForm = {
  riderId: '',
  title: '',
  message: '',
  type: 'system',
};

/** Map of notification.type → Tailwind badge class. Falls back to
 * the slate colour when the type isn't recognised. */
export const TYPE_COLORS: Record<string, string> = {
  system: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
  payment: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  vehicle: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  alert: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  INFO: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
  ALERT: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  SOS: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  PROMOTION: 'border-purple-500/20 text-purple-600 bg-purple-500/5 dark:text-purple-400',
};

export const TYPE_COLOR_FALLBACK =
  'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';

export const NOTIFICATION_PAGE_SIZE = 20;
