import { Battery, BatteryFull, BatteryLow, BatteryMedium } from 'lucide-react';
import type { FleetRider, RiderStatus } from './types';
import { LOW_BATTERY_THRESHOLD } from './types';

/** Maps a battery level (0-100) to a Battery* icon. */
export function getBatteryIcon(level: number | null) {
  if (level === null || level === undefined) return Battery;
  if (level < LOW_BATTERY_THRESHOLD) return BatteryLow;
  if (level < 50) return BatteryMedium;
  return BatteryFull;
}

/** Maps a battery level to a Tailwind text colour. */
export function getBatteryColor(level: number | null) {
  if (level === null || level === undefined) return 'text-muted-foreground';
  if (level < LOW_BATTERY_THRESHOLD) return 'text-rose-500';
  if (level < 50) return 'text-amber-500';
  return 'text-emerald-500';
}

/** Derives a 3-state status string from the rider's lifecycle. */
export function getRiderStatus(rider: FleetRider): RiderStatus {
  const status = rider.lifecycleStatus;
  if (status === 'ACTIVE' || status === 'RETURN_PENDING') {
    return 'active';
  }
  if (
    status === 'KYC_APPROVED' ||
    status === 'GUARANTOR_APPROVED' ||
    status === 'DEPOSIT_APPROVED' ||
    status === 'PLAN_SELECTED' ||
    status === 'PICKUP_SCHEDULED'
  ) {
    return 'idle';
  }
  return 'offline';
}

/** Tailwind background colour for the small status dot. */
export function getStatusColor(status: RiderStatus | string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500';
    case 'idle':
      return 'bg-amber-500';
    case 'offline':
    default:
      return 'bg-slate-400';
  }
}

/** Tailwind border + text colour for the status badge. */
export function getStatusBadgeClass(status: RiderStatus | string) {
  switch (status) {
    case 'active':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'idle':
      return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
    case 'offline':
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}
