'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Plus,
  Zap,
  Leaf,
  UserPlus,
  Landmark,
  ShieldCheck,
  CreditCard,
  Truck,
  LogOut,
  Bell,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { useRiderProfile } from '@/hooks/useRiderData';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import ApprovalMatrix from './ApprovalMatrix';
import BottomNav from './BottomNav';
import RiderSelector from './RiderSelector';
import { Skeleton } from '@/components/ui/skeleton';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' },
  }),
};

export default function PreDashboardScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const { riderId, clearRiderSession } = useRiderSession();
  const { rider: profile, loading } = useRiderProfile();
  const { logout: offlineLogout } = useOfflineSync();

  const handleLogout = () => {
    clearRiderSession();
    offlineLogout();
    useAppStore.setState({
      rider: {
        phone: '',
        kycStatus: 'PENDING',
        guarantorStatus: 'PENDING',
        walletBalance: 0,
        securityDeposit: 0,
        depositStatus: 'PENDING',
        paymentStreak: 0,
        lifecycleStatus: 'NEW',
        planStatus: 'NONE',
        rentalStatus: 'NONE',
        registrationDone: true,
        depositDone: false,
        kycDone: false,
        planDone: false,
        pickupDone: false,
        accountStatus: 'PRE_ACTIVE',
      },
    });
    setScreen('permissions');
  };

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

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] pb-28">
        <div className="bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-5 pt-12 pb-8">
          <Skeleton className="h-4 w-28 bg-white/20" />
          <Skeleton className="mt-2 h-7 w-40 bg-white/20" />
        </div>
        <div className="relative -mt-4 space-y-4 px-4 pt-1">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  const r = profile;
  const name = (r.fullName as string) || (r.name as string) || (r.riderId as string) || 'Member';
  const kycVerified = r.kycStatus === 'APPROVED' || r.kycDone === true;

  const baseSteps = [
    {
      label: 'Registration',
      done: r.registrationDone === true || !!r.fullName,
      icon: <UserPlus className="h-4 w-4" />,
    },
    {
      label: 'Security Deposit',
      done: r.depositDone === true || (r.walletBalance as number) > 0,
      icon: <Landmark className="h-4 w-4" />,
    },
    { label: 'KYC Verification', done: kycVerified, icon: <ShieldCheck className="h-4 w-4" /> },
    {
      label: 'Plan Selection',
      done: r.planDone === true || !!r.currentPlan,
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      label: 'Vehicle Pickup',
      done: r.pickupDone === true || !!r.assignedVehicle,
      icon: <Truck className="h-4 w-4" />,
    },
  ];

  let highestDoneIndex = -1;
  baseSteps.forEach((step, index) => {
    if (step.done) highestDoneIndex = index;
  });

  const approvalSteps = baseSteps.map((step, index) => ({
    ...step,
    done: index <= highestDoneIndex || step.done,
  }));

  const streak = (r.paymentStreak as number) || 0;
  const balance = (r.walletBalance as number) ?? (r.balance as number) ?? 0;

  return (
    <div className="min-h-screen bg-[#f7f9fb] pb-28">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-5 pt-12 pb-8 flex justify-between items-start">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm font-medium text-white/80"
          >
            Welcome back,
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-1 text-xl font-bold text-white"
          >
            {name}
          </motion.h1>
        </div>
        <div className="flex gap-2 mt-1">
          <button
            id="pre-dashboard-logout-btn"
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-red-200"
            title="Logout"
          >
            <LogOut size={18} className="text-red-400" />
          </button>
          <button
            id="pre-dashboard-notifications-btn"
            onClick={() => setScreen('notifications')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            title="Notifications"
          >
            <Bell size={18} />
          </button>
        </div>
      </div>

      <div className="relative -mt-4 space-y-4 px-4 pt-1">
        {/* Warning Banner removed - styling moved to Rider Box below */}

        {/* Profile Card — Point 6: Turn green if active */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className={`rounded-xl p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] border transition-colors ${
            highestDoneIndex === 4 ? 'bg-[#dcfce7] border-[#bbf7d0]' : 'bg-white border-transparent'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0053c1] to-[#2f6dde] text-white">
              {r.profilePhoto ? (
                <img
                  src={r.profilePhoto as string}
                  alt="Profile"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold">
                  {name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className={`text-base font-semibold truncate ${highestDoneIndex === 4 ? 'text-[#166534]' : 'text-[#191c1e]'}`}
              >
                {name}
              </h3>
              <p
                className={`text-xs mt-0.5 ${highestDoneIndex === 4 ? 'text-[#15803d]/80' : 'text-[#424653]'}`}
              >
                {(r.riderId as string) || 'VF-RD-001'}
              </p>
              <span
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  kycVerified ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fef3c7] text-[#d97706]'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    kycVerified ? 'bg-[#16a34a]' : 'bg-[#d97706]'
                  }`}
                />
                {kycVerified ? 'Verified' : `KYC: ${(r.kycStatus as string) || 'Pending'}`}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Approval Matrix */}
        <ApprovalMatrix steps={approvalSteps} />

        {/* Wallet Card */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0053c1] to-[#2f6dde] p-5 text-white shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5" />

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-white/70">Available Balance</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                ₹{Number(balance).toFixed(2)}
              </p>
            </div>
            <button
              onClick={() => setScreen('top_up_purpose')}
              className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-[0.7rem] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Top Up</span>
            </button>
          </div>

          <div className="relative mt-5">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-white/70">Rental Recovery</p>
              <p className="text-xs font-semibold text-white/90">{streak} / 5 Days</p>
            </div>
            <div className="flex gap-1.5">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.6 + i * 0.08, duration: 0.3 }}
                  className={`h-2 flex-1 rounded-full ${i < streak ? 'bg-white' : 'bg-white/25'}`}
                />
              ))}
            </div>
            <p className="mt-2 text-[10px] italic text-white/50">
              Maintaining a 5-day streak unlocks premium tiers
            </p>
          </div>
        </motion.div>

        {/* Action Card */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={4}
          className="rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f0f9ff]">
              <Zap className="h-6 w-6 text-[#0053c1]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-[#191c1e]">
                {highestDoneIndex === 4
                  ? 'Ready to hit the road?'
                  : highestDoneIndex >= 3
                    ? 'Time for Pickup!'
                    : 'Ready to Ride?'}
              </h3>
              <p className="mt-1 text-sm text-[#424653]">
                {highestDoneIndex === 4
                  ? 'Access your active dashboard to manage your rental.'
                  : highestDoneIndex >= 3
                    ? 'Your plan is active. Head to the hub to pick up your vehicle.'
                    : kycVerified
                      ? 'Your account is verified! Book a vehicle now.'
                      : 'Complete your KYC to unlock vehicle booking.'}
              </p>
              <button
                disabled={!kycVerified && highestDoneIndex < 3}
                onClick={() => {
                  if (highestDoneIndex === 4) setScreen('active_dashboard');
                  else if (highestDoneIndex >= 3) setScreen('pickup_hub');
                  else if (kycVerified) setScreen('choose_plan');
                }}
                className={`mt-3 w-full rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  kycVerified || highestDoneIndex >= 3
                    ? 'bg-gradient-to-r from-[#0053c1] to-[#2f6dde] text-white shadow-md shadow-[#0053c1]/20 hover:shadow-lg hover:shadow-[#0053c1]/30'
                    : 'bg-[#e0e3e5] text-[#424653] cursor-not-allowed'
                }`}
              >
                {highestDoneIndex === 4
                  ? 'Go to Dashboard'
                  : highestDoneIndex >= 3
                    ? 'Start Pickup'
                    : 'Book Vehicle'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Info Card */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={5}
          className="rounded-xl bg-[#f0fdf4] p-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#16a34a]/10">
              <Leaf className="h-5 w-5 text-[#16a34a]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#191c1e]">Did you know?</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#424653]">
                Electric scooters produce zero direct emissions. Each ride saves approximately 0.5
                kg of CO₂ compared to petrol-powered vehicles. You&apos;re making a difference for
                the planet!
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <BottomNav activeTab="home" />
    </div>
  );
}
