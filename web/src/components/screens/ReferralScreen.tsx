'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  Users,
  Gift,
  Clock,
  CheckCircle2,
  HelpCircle,
  Share2,
  TrendingUp,
  CreditCard,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';

const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

export default function ReferralScreen() {
  const goBack = useAppStore((s) => s.goBack);
  const { riderId } = useRiderSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/rider/referrals', {
          headers: { 'x-rider-id': riderId || '' },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch referrals:', err);
      } finally {
        setLoading(false);
      }
    }
    if (riderId) fetchData();
  }, [riderId]);

  const copyToClipboard = () => {
    if (data?.referralCode) {
      navigator.clipboard.writeText(data.referralCode);
      toast({ title: 'Referral code copied!', description: 'Share it with your friends.' });
    }
  };

  const shareReferral = () => {
    if (navigator.share && data?.referralCode) {
      navigator
        .share({
          title: 'Join Voltium',
          text: `Join me on Voltium! Use my referral code ${data.referralCode} to get started.`,
          url: window.location.origin,
        })
        .catch(console.error);
    } else {
      copyToClipboard();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6 space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const { stats, referrals, referralCode } = data || { stats: {}, referrals: [], referralCode: '' };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 pt-12 pb-6">
        <button
          onClick={goBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100"
        >
          <ArrowLeft size={18} className="text-slate-700" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Referral Program</h1>
      </div>

      <div className="px-6 space-y-6">
        {/* Referral Code Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] p-6 text-white shadow-xl"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
              Your Referral Code
            </p>
            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="text-3xl font-black tracking-widest">{referralCode}</span>
              <div className="flex gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-all"
                >
                  <Copy size={18} />
                </button>
                <button
                  onClick={shareReferral}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-all"
                >
                  <Share2 size={18} />
                </button>
              </div>
            </div>
            <p className="mt-6 text-xs font-medium text-white/80 leading-relaxed max-w-[200px]">
              Earn ₹500 for every friend who signs up and picks up their first vehicle.
            </p>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-3">
              <TrendingUp size={18} className="text-[#8B5CF6]" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Total Earned
            </p>
            <p className="mt-1 text-xl font-black text-slate-900">₹{stats.totalEarned || 0}</p>
          </motion.div>
          <motion.div
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <Gift size={18} className="text-orange-500" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Potential
            </p>
            <p className="mt-1 text-xl font-black text-slate-900">
              ₹{stats.potentialEarnings || 0}
            </p>
          </motion.div>
        </div>

        {/* Referred Friends List */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Referred Friends
            </h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {referrals.length} Total
            </span>
          </div>

          <div className="space-y-3">
            {referrals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 rounded-2xl bg-white border border-dashed border-slate-200">
                <Users className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-400">No friends referred yet</p>
                <button
                  onClick={shareReferral}
                  className="mt-4 text-xs font-black text-[#8B5CF6] uppercase tracking-widest"
                >
                  Share My Code
                </button>
              </div>
            ) : (
              referrals.map((friend: any, i: number) => (
                <motion.div
                  key={friend.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-100"
                >
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-2 border-slate-50">
                    {friend.photo ? (
                      <img
                        src={friend.photo}
                        alt={friend.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-400">
                        {(friend.name as string)[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{friend.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {friend.status === 'ACTIVE' || friend.status === 'POST_ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-600">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-600">
                          <Clock size={10} /> Onboarding
                        </span>
                      )}
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-semibold text-slate-400">
                        {friend.paymentStatus === 'Paid & Active' ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-black ${friend.earned > 0 ? 'text-emerald-600' : 'text-slate-400'}`}
                    >
                      {friend.earned > 0 ? `+₹${friend.earned}` : `₹${friend.potential}`}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                      {friend.earned > 0 ? 'Received' : 'Estimated'}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* FAQ/Help */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl bg-amber-50 p-5 flex items-start gap-4 border border-amber-100/50"
        >
          <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              How it works?
            </h4>
            <p className="mt-1 text-[11px] text-amber-800 leading-relaxed font-medium">
              Earnings are credited to your wallet once your referred friend successfully collects
              their vehicle and starts their plan.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
