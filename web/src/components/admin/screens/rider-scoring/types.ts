import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

/**
 * R3 split (RiderScoringScreen) — types & risk helpers.
 *
 * RiderScore + the risk-level colour / icon maps were inlined
 * inside RiderScoringScreen.tsx. Extracted so the data hook, the
 * scores table, the leaderboard, and the breakdown dialog can all
 * share the same view of a score row.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiderScore {
  id: string;
  riderId: string;
  fullName: string | null;
  phone: string;
  pickupHub: string | null;
  compositeScore: number;
  riskLevel: RiskLevel;
  paymentScore: number;
  complianceScore: number;
  engagementScore: number;
  vehicleScore: number;
  locationScore: number;
  lastCalculated: string;
}

export const RISK_LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const PAGE_SIZE = 20;
export const LEADERBOARD_LIMIT = 20;

/** Map of risk level → Tailwind badge class. */
export function getRiskBadgeClass(risk: RiskLevel | string): string {
  switch (risk) {
    case 'LOW':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'MEDIUM':
      return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
    case 'HIGH':
      return 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400';
    case 'CRITICAL':
      return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

/** Lucide icon for a risk level (used in the badge). */
export function getRiskIcon(risk: RiskLevel | string): LucideIcon {
  switch (risk) {
    case 'LOW':
      return ShieldCheck;
    case 'MEDIUM':
      return Shield;
    case 'HIGH':
      return AlertTriangle;
    case 'CRITICAL':
      return ShieldAlert;
    default:
      return Shield;
  }
}

/** Tailwind text colour for a numeric score (0-100). */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-rose-600 dark:text-rose-400';
}

/** Tailwind background colour for the score progress bar. */
export function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-rose-500';
}
