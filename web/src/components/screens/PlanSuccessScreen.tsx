'use client';

import { motion } from 'framer-motion';
import { Check, Calendar, CreditCard, PartyPopper } from 'lucide-react';
import { useAppStore } from '@/store/app';

// Confetti particle component
function ConfettiParticle({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <motion.div
      className="absolute h-2 w-2 rounded-full"
      style={{ backgroundColor: color, left: `${50 + x}%` }}
      initial={{ top: '40%', opacity: 1, scale: 1 }}
      animate={{
        top: ['40%', '-10%'],
        opacity: [1, 1, 0],
        scale: [1, 1.2, 0.5],
        rotate: [0, 180 + Math.random() * 360],
      }}
      transition={{
        duration: 1.8,
        delay,
        ease: 'easeOut',
      }}
    />
  );
}

const confettiColors = ['#0053c1', '#2f6dde', '#16a34a', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function PlanSuccessScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const rider = useAppStore((s) => s.rider);

  const confettiParticles = Array.from({ length: 18 }, (_, i) => ({
    delay: 0.3 + i * 0.06,
    x: (Math.random() - 0.5) * 80,
    color: confettiColors[i % confettiColors.length],
  }));

  const getPlanDuration = (plan: string | null | undefined) => {
    if (!plan) return '—';
    if (plan.includes('Daily')) return '24 hours';
    if (plan.includes('Weekly')) return '7 days';
    if (plan.includes('Monthly')) return '30 days';
    return '—';
  };

  const getPlanPrice = (plan: string | null | undefined) => {
    if (!plan) return '—';
    if (plan.includes('Daily')) return '₹199';
    if (plan.includes('Weekly')) return '₹999';
    if (plan.includes('Monthly')) return '₹3,499';
    return '—';
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Confetti particles */}
      {confettiParticles.map((p, i) => (
        <ConfettiParticle key={i} delay={p.delay} x={p.x} color={p.color} />
      ))}

      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="relative z-10"
      >
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 2, delay: 1 }}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#16a34a] to-[#22c55e] shadow-xl shadow-green-500/30"
        >
          <Check size={48} className="text-white" strokeWidth={3} />
        </motion.div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="text-center mt-6 z-10"
      >
        <h1 className="text-[1.75rem] font-black text-[#191c1e]">Plan Activated!</h1>
        <p className="text-[#424653] text-sm mt-1">
          Your rental plan is now active. Let&apos;s get you a vehicle!
        </p>
      </motion.div>

      {/* Plan Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="mt-8 w-full max-w-sm rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] border border-[#e0e3e5] z-10"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-[#16a34a]">
            <PartyPopper size={20} />
          </div>
          <div>
            <h3 className="font-bold text-[#191c1e]">{rider.currentPlan || 'Weekly Pro'}</h3>
            <p className="text-xs text-[#424653]">Active Plan</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-[#f2f4f6] p-3">
            <div className="flex items-center gap-2 text-sm text-[#424653]">
              <Calendar size={14} />
              Duration
            </div>
            <span className="text-sm font-semibold text-[#191c1e]">
              {getPlanDuration(rider.currentPlan || '')}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#f2f4f6] p-3">
            <div className="flex items-center gap-2 text-sm text-[#424653]">
              <CreditCard size={14} />
              Price
            </div>
            <span className="text-sm font-semibold text-[#191c1e]">
              {getPlanPrice(rider.currentPlan || '')}
            </span>
          </div>
        </div>
      </motion.div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="mt-8 w-full max-w-sm z-10"
      >
        <button
          onClick={() => setScreen('pickup_hub')}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0053c1]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#0053c1]/30 active:scale-[0.98]"
        >
          Select Pickup Hub
        </button>
      </motion.div>
    </div>
  );
}
