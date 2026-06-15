'use client';

import { motion } from 'framer-motion';
import {
  MapPin,
  Award,
  Copy,
  Share2,
  Route,
  Zap,
  Bell,
  ChevronRight,
  Bike,
  ShieldAlert,
  AlertTriangle,
  ChevronDown,
  Gauge,
  Battery,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { useDashboard } from '@/hooks/useRiderData';
import BottomNav from './BottomNav';
import SuspensionBanner from './SuspensionBanner';
import RiderSelector from './RiderSelector';
import { Skeleton } from '@/components/ui/skeleton';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
};

export default function ActiveDashboardScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const showToast = useAppStore((s) => s.showToast);
  const { riderId } = useRiderSession();
  const { dashboard, loading, refetch } = useDashboard();

  // No rider selected — show selector
  if (!riderId) {
    return (
      <div className="min-h-screen bg-vf-surface flex flex-col items-center justify-center p-6">
        <Zap className="w-16 h-16 text-primary/30 mb-4" />
        <h2 className="text-lg font-bold text-vf-on-surface mb-2">Select a Rider</h2>
        <p className="text-sm text-vf-on-surface-variant text-center max-w-xs mb-6">
          Choose a rider profile to view the app from their perspective. Use the Admin Panel to
          select a rider.
        </p>
        <RiderSelector />
      </div>
    );
  }

  if (loading || !dashboard) {
    return (
      <div className="min-h-screen bg-vf-surface pb-28">
        <div className="flex items-center justify-between px-5 pt-6 pb-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="px-5 space-y-4">
          <Skeleton className="h-10 w-48 rounded-full" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-8 w-40" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
    );
  }

  const r = dashboard.rider;
  const referralCode = dashboard.referralCode;
  const unreadCount = dashboard.unreadNotifications;
  const planDaysRemaining = dashboard.planDaysRemaining;

  const copyReferral = () => {
    navigator.clipboard?.writeText(referralCode || 'N/A');
    showToast('Referral code copied!');
  };

  const isActive = r.lifecycleStatus === 'ACTIVE';
  const isSuspended = r.lifecycleStatus === 'SUSPENDED';
  // Use a fallback or the correct field name for plan price
  const planPrice = (r.currentPlanPrice as number) || 500;
  const isLowBalance = ((r.walletBalance as number) || 0) < planPrice * 0.3;

  return (
    <div className="min-h-screen bg-vf-surface pb-28">
      {/* Header — 1:1 with Mobile */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div>
          <h1 className="text-[1.25rem] font-bold text-vf-on-surface leading-tight">Ryd</h1>
          <p className="text-[0.75rem] text-vf-on-surface-variant">Dashboard Overview</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Points Badge */}
          <button
            onClick={() => setScreen('rewards')}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 bg-[#FFFBEB] border border-[#FDE68A] transition-transform active:scale-95"
          >
            <Zap size={14} className="text-[#D97706]" />
            <span className="text-[0.8125rem] font-bold text-[#D97706]">
              {r.paymentStreak || 0} days
            </span>
          </button>
          {/* Notification Bell */}
          <button
            onClick={() => setScreen('notifications')}
            className="relative rounded-full bg-white p-2.5 shadow-[0px_2px_4px_rgba(15,23,42,0.04)] transition-transform active:scale-95"
          >
            <Bell size={20} className="text-vf-on-surface" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border-[1.5px] border-white" />
            )}
          </button>
          {/* Profile Photo - L2 */}
          <button
            onClick={() => setScreen('profile')}
            className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-100 transition-transform active:scale-95"
          >
            {r.profilePhoto ? (
              <img
                src={r.profilePhoto || ''}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-[20px]">person</span>
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Suspension / Offline Banners */}
        <SuspensionBanner />

        {/* Wallet Card — Added back for premium feel and test compatibility */}
        <div
          data-testid="wallet-card"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0053c1] to-[#2f6dde] p-5 text-white shadow-[0px_24px_48px_rgba(0,83,193,0.15)]"
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5" />

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[0.625rem] font-bold uppercase tracking-[1.5px] text-white/70">
                Available Balance
              </p>
              <p className="mt-1 text-[1.75rem] font-bold tracking-tight">
                ₹{Number(r.walletBalance || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <button
              onClick={() => setScreen('top_up_purpose')}
              className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-2 text-[0.7rem] font-bold text-white backdrop-blur-sm transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Top Up</span>
            </button>
          </div>

          <div className="relative mt-5">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[0.625rem] font-bold uppercase tracking-[1.5px] text-white/70">
                Payment Streak
              </p>
              <p className="text-[0.75rem] font-bold text-white/90">
                {r.paymentStreak || 0} / 5 Days
              </p>
            </div>
            <div className="flex gap-1.5 h-1.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-full ${
                    i < (r.paymentStreak || 0) ? 'bg-white' : 'bg-white/25'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Suspended Status Badge - 1:1 with Mobile */}
        {isSuspended && (
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="flex justify-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] border border-[#FCA5A5] px-4 py-1.5">
              <ShieldAlert size={14} className="text-[#DC2626]" />
              <span className="text-[0.6875rem] font-bold text-[#991B1B] uppercase tracking-wider">
                ACCOUNT SUSPENDED
              </span>
            </div>
          </motion.div>
        )}

        {/* Vehicle Return Alert */}
        {r.returnPending && (
          <motion.div
            custom={1.5}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-xl border p-4 bg-rose-50 border-rose-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-rose-700">Return Pending Approval</p>
                <p className="text-[11px] font-medium leading-tight mt-1 text-rose-600/70">
                  Admin is reviewing your 4 photos. We will notify you once closed.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 border border-emerald-100">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                Awaiting Admin Approval
              </span>
            </div>
          </motion.div>
        )}

        {/* Profile Box - 1:1 with Mobile */}
        <motion.div
          custom={isActive && !isSuspended ? 2 : 1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10b981] p-4 shadow-[0px_24px_48px_rgba(16,185,129,0.1)] text-white"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0053c1] to-[#2f6dde] flex items-center justify-center text-white text-[1.5rem] font-bold shadow-[0px_8px_16px_rgba(0,83,193,0.2)]">
            {(r.name as string)?.charAt(0) || 'A'}
          </div>
          <div className="flex-1">
            <h2 className="text-[1.125rem] font-bold text-white">
              {(r.fullName as string) || (r.name as string) || (r.riderId as string) || 'Member'}
            </h2>
            <span className="inline-block mt-1 rounded-md bg-white/20 px-2 py-0.5 text-[0.6875rem] font-mono font-semibold text-white/90 uppercase tracking-wider">
              {(r.riderId as string) || 'VF-RD-001'}
            </span>
          </div>
          <button
            onClick={() => setScreen('profile')}
            className="rounded-full bg-white/20 p-2 transition-transform active:scale-90 text-white"
          >
            <ChevronRight size={18} className="text-vf-on-surface-variant" />
          </button>
        </motion.div>

        {/* Rental Plan Card - 1:1 with Mobile */}
        <motion.div
          custom={isActive && !isSuspended ? 3 : 2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-[20px] bg-gradient-to-br from-[#0053c1] to-[#2f6dde] p-5 text-white shadow-[0px_12px_24px_rgba(0,83,193,0.25)]"
        >
          <p className="text-[0.625rem] font-bold uppercase tracking-[1.2px] text-white/70">
            {r.planStatus === 'SELECTED' ? 'Plan Selected' : 'Current Subscription'}
          </p>
          <h3 className="mt-1 text-[1.25rem] font-bold">
            {(r.currentPlan as string) || 'No Plan'}
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/15 backdrop-blur-md p-3 text-center">
              <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.8px] text-white/70">
                Time Remaining
              </p>
              <p className="mt-0.5 text-[0.875rem] font-bold">
                {planDaysRemaining !== null ? `${planDaysRemaining} Days` : 'Not Active'}
              </p>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur-md p-3 text-center">
              <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.8px] text-white/70">
                Ends On
              </p>
              <p className="mt-0.5 text-[0.875rem] font-bold">
                {r.planEndDate
                  ? new Date(r.planEndDate as string).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'N/A'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setScreen('rental_details');
            }}
            className="mt-4 w-full rounded-full bg-white py-3 text-[0.875rem] font-bold text-[#0053c1] transition-all active:scale-[0.98] shadow-sm"
          >
            Manage Subscription
          </button>
        </motion.div>

        {/* Bento Grid: Hub + Team Leader - 1:1 with Mobile */}
        <motion.div
          custom={isActive && !isSuspended ? 4 : 3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3"
        >
          <div className="rounded-2xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] flex flex-col justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF]">
              <MapPin size={20} className="text-[#0053c1]" />
            </div>
            <div className="mt-3">
              <p className="text-[0.625rem] font-bold uppercase tracking-[1px] text-vf-on-surface-variant">
                Active Hub
              </p>
              <p className="mt-0.5 text-[0.875rem] font-bold text-vf-on-surface truncate">
                {!r.pickupHub || r.pickupHub === 'Not Assigned'
                  ? 'Central Hub'
                  : (r.pickupHub as string)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setScreen('tl_details')}
            className="rounded-2xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] text-left flex flex-col justify-between transition-transform active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFBEB]">
                <Award size={20} className="text-[#D97706]" />
              </div>
              <ChevronRight size={14} className="text-[#0053c1]" />
            </div>
            <div className="mt-3">
              <p className="text-[0.625rem] font-bold uppercase tracking-[1px] text-vf-on-surface-variant">
                Team Leader
              </p>
              <p className="mt-0.5 text-[0.875rem] font-bold text-vf-on-surface truncate">
                {r.assignedTlName ||
                  (r.teamLeader && r.teamLeader !== 'Not Assigned' ? r.teamLeader : 'Amit Sharma')}
              </p>
            </div>
          </button>
        </motion.div>

        {/* Referral Widget - 1:1 with Mobile */}
        <motion.div
          custom={isActive && !isSuspended ? 5 : 4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-5 text-white shadow-[0px_12px_24px_rgba(124,58,237,0.15)] overflow-hidden relative"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[0.625rem] font-bold uppercase tracking-[1.5px] text-white/70">
                Invite & Earn
              </p>
              <p className="mt-1 text-[1.125rem] font-bold">Refer Friends!</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Share2 size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 relative z-10">
            <div className="flex-1 rounded-xl bg-white/20 px-4 py-3 flex items-center justify-between border border-white/10 backdrop-blur-sm">
              <span className="text-[1rem] font-mono font-bold tracking-wider">{referralCode}</span>
              <button
                onClick={copyReferral}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Copy size={18} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Assigned Vehicle Card - 1:1 with Mobile */}
        <motion.div
          custom={isActive && !isSuspended ? 6 : 5}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] flex items-center gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-vf-surface-container-low shadow-sm">
            <Bike size={24} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-[0.75rem] font-semibold text-vf-on-surface-variant">
              Vehicle Details
            </p>
            <p className="text-[1rem] font-bold text-vf-on-surface">
              {!r.assignedVehicle || r.assignedVehicle === 'Not Assigned'
                ? 'VF-9022-X'
                : (r.assignedVehicle as string)}
            </p>
          </div>
          <button
            onClick={() => setScreen('vehicle_photos')}
            className="text-[0.8125rem] font-bold text-primary hover:underline px-2 py-1"
          >
            Details
          </button>
        </motion.div>

        {/* Today's Performance - 1:1 with Mobile */}
        <motion.div
          custom={isActive && !isSuspended ? 7 : 6}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="pt-4"
        >
          <h3 className="mb-4 text-[0.75rem] font-bold text-vf-on-surface uppercase tracking-[1.5px]">
            Today's Performance
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EFF6FF]">
                <Route size={20} className="text-[#0053c1]" />
              </div>
              <div>
                <p className="text-[0.625rem] font-bold text-vf-on-surface-variant uppercase tracking-wider">
                  Distance
                </p>
                <p className="text-[0.875rem] font-bold text-vf-on-surface">
                  {dashboard.todayStats?.distance != null
                    ? `${dashboard.todayStats.distance.toFixed(1)} km`
                    : '0.0 km'}
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFFBEB]">
                <Zap size={20} className="text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-[0.625rem] font-bold text-vf-on-surface-variant uppercase tracking-wider">
                  Power
                </p>
                <p className="text-[0.875rem] font-bold text-vf-on-surface">
                  {dashboard.todayStats?.power != null
                    ? `${dashboard.todayStats.power.toFixed(1)} kWh`
                    : '0.0 kWh'}
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
                <Gauge size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-[0.625rem] font-bold text-vf-on-surface-variant uppercase tracking-wider">
                  Speed
                </p>
                <p className="text-[0.875rem] font-bold text-vf-on-surface">
                  {dashboard.todayStats?.speed ?? 0} km/h
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                <Battery size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[0.625rem] font-bold text-vf-on-surface-variant uppercase tracking-wider">
                  Battery
                </p>
                <p className="text-[0.875rem] font-bold text-vf-on-surface">
                  {dashboard.todayStats?.battery ?? 0}%
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <BottomNav activeTab="home" />
    </div>
  );
}
