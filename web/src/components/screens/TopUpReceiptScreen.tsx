'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Info, Home } from 'lucide-react';
import { useAppStore } from '@/store/app';

export default function TopUpReceiptScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const topUpState = useAppStore((s) => s.topUpState);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f9fb] px-6">
      {/* Success Animation */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 15,
          delay: 0.2,
        }}
        className="relative"
      >
        {/* Outer glow ring */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="absolute inset-0 -m-3 rounded-full bg-[#16a34a]/10"
        />
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 0 }}
          transition={{ delay: 0.6, duration: 1.2 }}
          className="absolute inset-0 -m-6 rounded-full bg-[#16a34a]/5"
        />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#16a34a] to-[#22c55e] shadow-xl shadow-[#16a34a]/30">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
          >
            <CheckCircle2 className="h-14 w-14 text-white" strokeWidth={2.5} />
          </motion.div>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="mt-8 text-center"
      >
        <h1 className="text-2xl font-bold text-[#191c1e]">Payment Submitted</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#424653]">
          Your payment of{' '}
          <span className="font-bold text-[#191c1e]">
            ₹{topUpState.amount.toLocaleString('en-IN')}
          </span>{' '}
          for {topUpState.purpose.replace('_', ' ').toLowerCase()} is being verified by our team.
        </p>
      </motion.div>

      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="mt-6 w-full max-w-xs rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fef3c7]">
            <Clock className="h-5 w-5 text-[#d97706]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#191c1e]">Verification in Progress</p>
            <p className="mt-0.5 text-xs text-[#424653]">Estimated time: Within 24 hours</p>
          </div>
        </div>
      </motion.div>

      {/* Info Note */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        className="mt-4 flex items-start gap-2 rounded-xl bg-[#eff6ff] px-4 py-3"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0053c1]" />
        <p className="text-xs leading-relaxed text-[#424653]">
          Balance will update after admin approval. You&apos;ll receive a notification once
          it&apos;s done.
        </p>
      </motion.div>

      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, duration: 0.5 }}
        className="mt-10 w-full max-w-xs"
      >
        <button
          onClick={() => setScreen('pre_dashboard')}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#0053c1]/20 transition-all hover:shadow-lg hover:shadow-[#0053c1]/30 active:scale-[0.98]"
        >
          <Home className="h-4 w-4" />
          Back to Dashboard
        </button>
      </motion.div>

      {/* Confetti particles (decorative) */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{
            x: 0,
            y: 0,
            scale: 0,
            opacity: 1,
          }}
          animate={{
            x: (Math.random() - 0.5) * 200,
            y: (Math.random() - 0.5) * 300 - 50,
            scale: [0, 1.5, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            delay: 0.8 + i * 0.1,
            duration: 1.2,
            ease: 'easeOut',
          }}
          className="pointer-events-none absolute h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: ['#0053c1', '#2f6dde', '#16a34a', '#f59e0b', '#0053c1', '#22c55e'][i],
          }}
        />
      ))}
    </div>
  );
}
