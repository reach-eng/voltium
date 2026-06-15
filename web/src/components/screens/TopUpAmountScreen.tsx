'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Banknote, Star, IndianRupee } from 'lucide-react';
import { useAppStore } from '@/store/app';

const quickAmounts = [
  { value: 500, label: '₹500' },
  { value: 1000, label: '₹1,000' },
  { value: 2000, label: '₹2,000', recommended: true },
  { value: 5000, label: '₹5,000' },
];

export default function TopUpAmountScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const goBack = useAppStore((s) => s.goBack);
  const topUpState = useAppStore((s) => s.topUpState);
  const setTopUpState = useAppStore((s) => s.setTopUpState);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(2000);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const handleQuickSelect = (value: number) => {
    setSelectedAmount(value);
    setCustomAmount('');
    setIsCustom(false);
  };

  const handleCustomInput = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    setCustomAmount(num);
    setIsCustom(true);
    setSelectedAmount(null);
  };

  const finalAmount = isCustom ? parseInt(customAmount) || 0 : selectedAmount || 0;
  const canProceed = finalAmount > 0;

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
          <p className="text-sm font-medium text-white/70">Step 2 of 3</p>
          <h1 className="mt-1 text-xl font-bold text-white">Enter Amount</h1>
        </motion.div>
      </div>

      <div className="relative -mt-4 space-y-4 px-4 pt-1">
        {/* Quick Amount Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
        >
          <div className="mb-4 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-[#424653]" />
            <h3 className="text-sm font-semibold text-[#191c1e]">Quick Select</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quickAmounts.map((item) => {
              const isSelected = selectedAmount === item.value && !isCustom;
              return (
                <motion.button
                  key={item.value}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleQuickSelect(item.value)}
                  className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-4 transition-all ${
                    isSelected
                      ? 'border-[#0053c1] bg-[#eff6ff]'
                      : 'border-[#e0e3e5] bg-[#f7f9fb] hover:border-[#0053c1]/30'
                  }`}
                >
                  {item.recommended && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-2.5 py-0.5 text-[10px] font-bold text-white">
                      Recommended
                    </span>
                  )}
                  <span
                    className={`text-lg font-bold ${
                      isSelected ? 'text-[#0053c1]' : 'text-[#191c1e]'
                    }`}
                  >
                    {item.label}
                  </span>
                  {isSelected && (
                    <motion.div
                      layoutId="amount-check"
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0053c1]"
                    >
                      <Star className="h-3 w-3 text-white" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Custom Amount */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
        >
          <h3 className="mb-3 text-sm font-semibold text-[#191c1e]">Or Enter Custom Amount</h3>
          <div className="relative">
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[#424653]">
              <IndianRupee className="h-4 w-4" />
            </div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter amount"
              value={customAmount}
              onChange={(e) => handleCustomInput(e.target.value)}
              className="w-full rounded-xl border-2 border-[#e0e3e5] bg-[#f7f9fb] py-3.5 pl-10 pr-4 text-lg font-semibold text-[#191c1e] placeholder:text-[#424653]/40 outline-none transition-colors focus:border-[#0053c1] focus:bg-[#eff6ff]"
            />
          </div>
        </motion.div>

        {/* Amount Summary */}
        {finalAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-between rounded-xl bg-[#f0fdf4] px-5 py-4"
          >
            <span className="text-sm text-[#424653]">Amount to Pay</span>
            <span className="text-xl font-bold text-[#16a34a]">
              ₹{finalAmount.toLocaleString('en-IN')}
            </span>
          </motion.div>
        )}

        {/* Spacer */}
        <div className="h-4" />

        {/* Proceed Button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="pb-8"
        >
          <button
            disabled={!canProceed}
            onClick={() => {
              setTopUpState(finalAmount, topUpState.purpose);
              setScreen('top_up_upi');
            }}
            className={`w-full rounded-full px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.98] ${
              canProceed
                ? 'bg-gradient-to-r from-[#0053c1] to-[#2f6dde] text-white shadow-md shadow-[#0053c1]/20 hover:shadow-lg hover:shadow-[#0053c1]/30'
                : 'bg-[#e0e3e5] text-[#424653] cursor-not-allowed'
            }`}
          >
            Proceed to UPI Payment
          </button>
        </motion.div>
      </div>
    </div>
  );
}
