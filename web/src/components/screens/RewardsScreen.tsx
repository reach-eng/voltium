'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Flame, Gift, Star, Crown, Zap, Ticket, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { useRewards, useRiderProfile } from '@/hooks/useRiderData';
import BottomNav from './BottomNav';
import RiderSelector from './RiderSelector';
import { Skeleton } from '@/components/ui/skeleton';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

const streakDays = [1, 2, 3, 4, 5];

const rewards = [
  {
    icon: Flame,
    label: '5-Day Streak',
    desc: 'Free recharge coupon',
    unlock: 5,
    color: 'bg-orange-50 text-orange-600',
  },
  {
    icon: Gift,
    label: '10-Day Streak',
    desc: '₹200 wallet credit',
    unlock: 10,
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: Star,
    label: 'Silver Tier',
    desc: 'Priority support access',
    unlock: 30,
    color: 'bg-blue-50 text-[#0053c1]',
  },
  {
    icon: Crown,
    label: 'Gold Tier',
    desc: '10% discount on monthly plans',
    unlock: 60,
    color: 'bg-amber-50 text-amber-600',
  },
];

function formatRewardDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return d;
  }
}

export default function RewardsScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const { riderId } = useRiderSession();
  const { rewardsData, loading: rewardsLoading } = useRewards();
  const { rider: profile, loading: profileLoading } = useRiderProfile();

  const loading = rewardsLoading || profileLoading;
  const streak = profile ? (profile.paymentStreak as number) || 0 : 0;
  const totalPoints = rewardsData?.totalPoints || 0;
  const thisMonthPoints = rewardsData?.thisMonthPoints || 0;
  const riderRewards = rewardsData?.rewards || [];

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

  if (loading) {
    return (
      <div className="min-h-screen bg-vf-surface pb-10">
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="ml-auto h-8 w-20 rounded-full" />
        </div>
        <div className="px-5 space-y-5">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-8 w-40" />
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
          <Skeleton className="h-8 w-40" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const currentStreak = Math.min(streak, 5);
  // Ensure Bronze member progress bar starts at zero (Point 9)
  const progressPercent =
    totalPoints > 0 ? Math.min(100, Math.round((thisMonthPoints / (totalPoints + 1)) * 100)) : 0;

  return (
    <div className="min-h-screen bg-vf-surface mesh-gradient pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => setScreen('profile')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <ArrowLeft size={18} className="text-vf-on-surface" />
        </button>
        <h1 className="text-xl font-bold text-vf-on-surface">VoltRewards</h1>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1">
          <Zap size={14} className="text-amber-500" />
          <span className="text-xs font-bold text-amber-700">{totalPoints} pts</span>
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* Current Tier Card */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-5 text-white shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <Crown size={24} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
                Current Tier
              </p>
              <h2 className="text-xl font-bold">Bronze Member</h2>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-white/70">
                Progress to Silver
              </span>
              <span className="text-xs font-bold">{progressPercent}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-white/20 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-white"
              />
            </div>
          </div>
        </motion.div>

        {/* Streak Section */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-vf-on-surface">Payment Streak</h3>
            <div className="flex items-center gap-1">
              <Flame size={16} className="text-orange-500" />
              <span className="text-sm font-bold text-orange-600">{currentStreak}/5 days</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            {streakDays.map((day) => {
              const completed = day <= currentStreak;
              return (
                <div key={day} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${completed ? 'bg-gradient-to-br from-orange-400 to-orange-500 shadow-md' : 'bg-vf-surface-container-low'}`}
                  >
                    {completed ? (
                      <CheckCircle size={18} className="text-white" />
                    ) : (
                      <span className="text-xs font-bold text-vf-outline">{day}</span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-vf-on-surface-variant">
                    Day {day}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Rewards Available */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <h3 className="mb-3 text-sm font-bold text-vf-on-surface uppercase tracking-wider">
            Rewards Available
          </h3>
          <div className="space-y-2">
            {rewards.map((reward) => {
              const Icon = reward.icon;
              const unlocked = reward.unlock <= currentStreak;
              return (
                <div
                  key={reward.label}
                  className={`flex items-center gap-3 rounded-xl p-4 transition-all ${unlocked ? 'bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.04)]' : 'bg-white/60 opacity-60'}`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${reward.color}`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-vf-on-surface">{reward.label}</p>
                    <p className="text-[11px] text-vf-on-surface-variant">{reward.desc}</p>
                  </div>
                  {unlocked && (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-bold text-green-700">
                      CLAIM
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Reward History */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
          <h3 className="mb-3 text-sm font-bold text-vf-on-surface uppercase tracking-wider">
            Reward History
          </h3>
          <div className="rounded-xl bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.04)] divide-y divide-vf-surface-container-low">
            {riderRewards.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <Gift className="w-10 h-10 text-vf-outline mb-2" />
                <p className="text-sm text-vf-on-surface-variant">No rewards earned yet</p>
              </div>
            ) : (
              riderRewards.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                    <Ticket size={18} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-vf-on-surface">{item.title}</p>
                    <p className="text-[11px] text-vf-on-surface-variant">+{item.points} points</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-vf-outline">
                      {formatRewardDate(item.createdAt)}
                    </p>
                    <span className="inline-block mt-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-700">
                      EARNED
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
