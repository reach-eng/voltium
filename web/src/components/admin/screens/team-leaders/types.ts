import { formatDateDDMMYYYY } from '@/lib/date-utils';

/**
 * R3.7aa split — Team Leader Management types.
 */

export interface TeamLeader {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  hubId?: string | null;
  hub?: { id: string; name: string } | null;
  isActive: boolean;
  createdAt: string;
  riderCount?: number;
}

export interface TeamLeaderFormState {
  name: string;
  phone: string;
  email: string;
  hubId?: string | null;
  isActive: boolean;
}

export const EMPTY_LEADER_FORM: TeamLeaderFormState = {
  name: '',
  phone: '',
  email: '',
  hubId: null,
  isActive: true,
};

export const TEAM_LEADER_PAGE_SIZE = 21;

export const ACTIVE_FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export interface TeamLeaderRider {
  id: string;
  fullName: string | null;
  name: string | null;
  riderId: string;
  phone: string;
  lifecycleStatus: string;
  balance: number;
  isOverdue?: boolean;
  isUpcoming?: boolean;
  hasOverdueScooter?: boolean;
}

export interface TeamLeaderStats {
  totalRiders: number;
  churned: number;
  overdueRent: number;
  upcomingRent: number;
  timelyRent: number;
}

export interface TeamLeaderStatsPayload {
  leader: TeamLeader;
  data: {
    stats: TeamLeaderStats;
    riders: TeamLeaderRider[];
  };
}

export function formatLeaderDate(dateStr: string): string {
  return formatDateDDMMYYYY(dateStr);
}

export function riderCountLabel(count: number): string {
  return `${count} rider${count !== 1 ? 's' : ''}`;
}

export function statusBadgeClass(isActive: boolean): string {
  return isActive
    ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
    : 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
}
