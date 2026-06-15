'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Info, CheckCircle2, Wallet2 } from 'lucide-react';
import { useAppStore } from '@/store/app';

export default function TopUpPurposeScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const goBack = useAppStore((s) => s.goBack);
  const setTopUpState = useAppStore((s) => s.setTopUpState);
  const topUpState = useAppStore((s) => s.topUpState);

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-5 pt-12 pb-10">
        <button
          onClick={goBack}
          className="absolute left-4 top-12 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm font-medium text-white/70">Step 1 of 3</p>
          <h1 className="mt-1 text-xl font-bold text-white">Select Purpose</h1>
        </motion.div>
      </div>

      <div className="relative -mt-4 space-y-4 px-4 pt-1">
        {/* Wallet Top-up Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => {
            setTopUpState(0, 'TOP_UP');
          }}
          className={`relative cursor-pointer overflow-hidden rounded-xl p-6 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] transition-all ${
            topUpState.purpose === 'TOP_UP'
              ? 'ring-4 ring-[#0053c1]/30 bg-gradient-to-br from-[#0048a8] to-[#255bc2] text-white'
              : 'bg-white border border-[#e0e3e5] text-[#191c1e]'
          }`}
        >
          {/* Decorative elements */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-8 bottom-2 h-24 w-24 rounded-full bg-white/5" />

          <div className="relative">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl backdrop-blur-sm ${topUpState.purpose === 'TOP_UP' ? 'bg-white/15' : 'bg-[#0053c1]/10'}`}
            >
              <Wallet2
                className={`h-7 w-7 ${topUpState.purpose === 'TOP_UP' ? 'text-white' : 'text-[#0053c1]'}`}
              />
            </div>
            <h3
              className={`mt-4 text-lg font-bold ${topUpState.purpose === 'TOP_UP' ? 'text-white' : 'text-[#191c1e]'}`}
            >
              Wallet Top-up
            </h3>
            <p
              className={`mt-1 text-sm ${topUpState.purpose === 'TOP_UP' ? 'text-white/70' : 'text-[#424653]'}`}
            >
              Add funds to your wallet for rentals
            </p>
          </div>
          {topUpState.purpose === 'TOP_UP' && (
            <div className="absolute top-4 right-4 bg-white rounded-full p-1">
              <CheckCircle2 size={16} className="text-[#0053c1]" />
            </div>
          )}
        </motion.div>

        {/* Security Deposit Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => {
            setTopUpState(0, 'SECURITY_DEPOSIT');
          }}
          className={`relative cursor-pointer overflow-hidden rounded-xl p-6 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] transition-all ${
            topUpState.purpose === 'SECURITY_DEPOSIT'
              ? 'ring-4 ring-[#0053c1]/30 bg-gradient-to-br from-[#0048a8] to-[#255bc2] text-white'
              : 'bg-white border border-[#e0e3e5] text-[#191c1e]'
          }`}
        >
          {/* Decorative elements */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-8 bottom-2 h-24 w-24 rounded-full bg-white/5" />

          <div className="relative">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl backdrop-blur-sm ${topUpState.purpose === 'SECURITY_DEPOSIT' ? 'bg-white/15' : 'bg-[#0053c1]/10'}`}
            >
              <Lock
                className={`h-7 w-7 ${topUpState.purpose === 'SECURITY_DEPOSIT' ? 'text-white' : 'text-[#0053c1]'}`}
              />
            </div>
            <h3
              className={`mt-4 text-lg font-bold ${topUpState.purpose === 'SECURITY_DEPOSIT' ? 'text-white' : 'text-[#191c1e]'}`}
            >
              Security Deposit
            </h3>
            <p
              className={`mt-1 text-sm ${topUpState.purpose === 'SECURITY_DEPOSIT' ? 'text-white/70' : 'text-[#424653]'}`}
            >
              Refundable as per lease terms
            </p>

            <div
              className={`mt-5 flex items-center gap-2 rounded-lg px-3 py-2 ${topUpState.purpose === 'SECURITY_DEPOSIT' ? 'bg-white/10 text-white' : 'bg-[#0053c1]/5 text-[#0053c1]'}`}
            >
              <span
                className={`text-xs ${topUpState.purpose === 'SECURITY_DEPOSIT' ? 'text-white/60' : 'text-[#0053c1]/60'}`}
              >
                Standard Amount
              </span>
              <span className="ml-auto text-sm font-semibold">₹2,000</span>
            </div>
          </div>
          {topUpState.purpose === 'SECURITY_DEPOSIT' && (
            <div className="absolute top-4 right-4 bg-white rounded-full p-1">
              <CheckCircle2 size={16} className="text-[#0053c1]" />
            </div>
          )}
        </motion.div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-start gap-3 rounded-xl bg-[#eff6ff] p-4"
        >
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0053c1]/10">
            <Info className="h-4 w-4 text-[#0053c1]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#191c1e]">Important Information</p>
            <p className="mt-1 text-xs leading-relaxed text-[#424653]">
              Security deposits are refundable as per the lease terms. The amount will be returned
              within 7-10 business days after lease termination, subject to any deductions for
              damages or unpaid dues.
            </p>
          </div>
        </motion.div>

        {/* Spacer */}
        <div className="h-4" />

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="pb-8"
        >
          <button
            onClick={() => {
              if (topUpState.purpose !== 'SECURITY_DEPOSIT') {
                setTopUpState(0, 'TOP_UP');
              }
              setScreen('top_up_amount');
            }}
            className="w-full rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#0053c1]/20 transition-all hover:shadow-lg hover:shadow-[#0053c1]/30 active:scale-[0.98]"
          >
            Continue to Payment
          </button>
        </motion.div>
      </div>
    </div>
  );
}
