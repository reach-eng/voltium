'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Bike,
  CalendarDays,
  MapPin,
  CreditCard,
  StopCircle,
  RefreshCw,
  AlertTriangle,
  Headphones,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { useRiderProfile } from '@/hooks/useRiderData';
import RiderSelector from './RiderSelector';
import { Skeleton } from '@/components/ui/skeleton';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: 'easeOut' },
  }),
};

function formatPlanDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function calcDaysRemaining(endDate: string): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function RentalDetailsScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const { riderId } = useRiderSession();
  const { rider: profile, loading } = useRiderProfile();

  if (!riderId) {
    return (
      <div className="min-h-screen bg-vf-surface flex flex-col items-center justify-center p-6">
        <Zap className="w-16 h-16 text-primary/30 mb-4" />
        <h2 className="text-lg font-bold text-vf-on-surface mb-2">Select a Rider</h2>
        <p className="text-sm text-vf-on-surface-variant text-center max-w-xs mb-6">
          Choose a rider profile to view the app from their perspective.
        </p>
        <RiderSelector />
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-vf-surface pb-10">
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-7 w-36" />
        </div>
        <div className="px-5 space-y-5">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-14 rounded-full" />
          <Skeleton className="h-14 rounded-full" />
          <Skeleton className="h-14 rounded-full" />
          <Skeleton className="h-14 rounded-full" />
        </div>
      </div>
    );
  }

  const r = profile;
  const planEndStr = (r.planEndDate as string) || null;
  const planStartStr = (r.planStartDate as string) || null;
  const daysRemaining = planEndStr ? calcDaysRemaining(planEndStr) : null;
  const isActive = r.lifecycleStatus === 'ACTIVE';

  const infoItems = [
    {
      icon: Bike,
      label: 'Vehicle',
      value:
        !r.assignedVehicle || r.assignedVehicle === 'Not Assigned'
          ? 'VF-9022-X'
          : (r.assignedVehicle as string),
    },
    { icon: CreditCard, label: 'Plan', value: (r.currentPlan as string) || 'No Plan' },
    {
      icon: CalendarDays,
      label: 'Start Date',
      value: planStartStr ? formatPlanDate(planStartStr) : 'N/A',
    },
    {
      icon: CalendarDays,
      label: 'End Date',
      value: planEndStr ? formatPlanDate(planEndStr) : 'N/A',
    },
    {
      icon: MapPin,
      label: 'Hub',
      value:
        !r.pickupHub || r.pickupHub === 'Not Assigned' ? 'Central Hub' : (r.pickupHub as string),
    },
    {
      icon: Zap,
      label: 'Days Remaining',
      value: daysRemaining !== null ? `${daysRemaining} days` : 'N/A',
    },
  ];

  return (
    <div className="min-h-screen bg-vf-surface mesh-gradient pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => setScreen('active_dashboard')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <ArrowLeft size={18} className="text-vf-on-surface" />
        </button>
        <h1 className="text-xl font-bold text-vf-on-surface">Rental Details</h1>
      </div>

      <div className="px-5 space-y-5">
        {/* Rental Info Card */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
        >
          <div className="space-y-4">
            {infoItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vf-surface-container-low">
                    <Icon size={16} className="text-vf-on-surface-variant" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-vf-on-surface-variant">
                      {item.label}
                    </p>
                    <p className="text-sm font-bold text-vf-on-surface truncate">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Status Badge */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex justify-center"
        >
          {isActive ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="text-xs font-semibold text-green-700">Rental Active</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 border border-gray-200 px-4 py-1.5">
              <span className="text-xs font-semibold text-gray-700">No Active Rental</span>
            </div>
          )}
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          <button
            onClick={() => setScreen('end_rental')}
            disabled={!isActive}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ba1a1a] px-5 py-3.5 text-sm font-bold text-white shadow-md transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <StopCircle size={18} />
            End Rental
          </button>

          <button
            onClick={() => setScreen('choose_plan')}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-vf-surface-container-highest px-5 py-3.5 text-sm font-bold text-vf-on-surface transition-transform active:scale-[0.98]"
          >
            <RefreshCw size={18} />
            Change Plan
          </button>

          <button className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-vf-outline-variant px-5 py-3.5 text-sm font-bold text-vf-on-surface transition-transform active:scale-[0.98]">
            <AlertTriangle size={18} />
            Report Issue
          </button>

          <button className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-bold text-[#0053c1] transition-colors hover:bg-blue-50">
            <Headphones size={18} />
            Contact Support
          </button>
        </motion.div>
      </div>
    </div>
  );
}
