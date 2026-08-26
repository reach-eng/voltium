import { formatDateDDMMYYYY } from '@/lib/date-utils';

export function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'OPEN':
      return 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
    case 'INVESTIGATING':
      return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
    case 'RESOLVED':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'CLOSED':
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

export function getSeverityBadgeClass(severity: string) {
  switch (severity) {
    case 'LOW':
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
    case 'MEDIUM':
      return 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
    case 'HIGH':
      return 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400';
    case 'CRITICAL':
      return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

export function formatDate(dateStr: string) {
  return formatDateDDMMYYYY(dateStr);
}
