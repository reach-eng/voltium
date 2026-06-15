'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Upload,
  Smartphone,
  CreditCard,
  Image as ImageIcon,
  X,
  CheckCircle2,
} from 'lucide-react';
import { uploadFile } from '@/lib/upload';
import { useAppStore } from '@/store/app';
import { useTransactions } from '@/hooks/useRiderData';

export default function TopUpUpiScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const goBack = useAppStore((s) => s.goBack);
  const topUpState = useAppStore((s) => s.topUpState);

  const { requestTopUp, isRequesting } = useTransactions();
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaymentSubmit = async () => {
    try {
      await requestTopUp({
        amount: topUpState.amount,
        purpose: topUpState.purpose,
        method: 'UPI',
        proofUrl: screenshot || undefined,
      });
      setScreen('top_up_receipt');
    } catch (err) {
      console.error('Top-up submission failed:', err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);

      try {
        const url = await uploadFile(file, 'TOPUP_PROOF');
        setScreenshot(url);
        useAppStore.getState().showToast('Photo uploaded successfully');
      } catch (err: any) {
        useAppStore.getState().showToast(err.message || 'Upload failed');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const canSubmit = !!screenshot && topUpState.amount > 0;
  const isAmountMissing = topUpState.amount <= 0;

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
          <p className="text-sm font-medium text-white/70">Step 3 of 3</p>
          <h1 className="mt-1 text-xl font-bold text-white">Top Up</h1>
        </motion.div>
      </div>

      <div className="relative -mt-4 space-y-4 px-4 pt-1">
        {/* Amount Summary Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-between rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] border border-[#0053c1]/10"
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#424653]/60">
              Top-up Amount
            </span>
            <span className="text-2xl font-black text-[#0053c1]">
              ₹{topUpState.amount.toLocaleString('en-IN')}
            </span>
          </div>
          <button
            onClick={() => setScreen('top_up_amount')}
            className="text-xs font-bold text-[#0053c1] underline decoration-[#0053c1]/30 underline-offset-4"
          >
            Edit
          </button>
        </motion.div>
        {isAmountMissing ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-white p-8 text-center shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Smartphone className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-[#191c1e]">Amount Missing</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#424653]">
              The top-up amount was lost due to a session reset. Please go back and enter the amount
              again.
            </p>
            <button
              onClick={() => setScreen('top_up_amount')}
              className="mt-6 w-full rounded-full bg-[#191c1e] py-3 text-sm font-bold text-white shadow-lg active:scale-95"
            >
              Go Back to Step 2
            </button>
          </motion.div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex gap-2 rounded-xl bg-white p-3 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0053c1]/10">
                <Smartphone className="h-5 w-5 text-[#0053c1]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#191c1e]">Proof of Top Up</p>
                <p className="text-xs text-[#424653] leading-relaxed">
                  Please attach a photo of the rider giving the cash to a Voltium team member for
                  verification or the receipt of the online payment made in the name of Voltium
                  Mobility.
                </p>
              </div>
            </motion.div>

            <motion.div
              key="screenshot"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
            >
              <div className="mb-4 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#424653]" />
                <h3 className="text-sm font-semibold text-[#191c1e]">Upload Photo Proof</h3>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!screenshot ? (
                <button
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#e0e3e5] bg-[#f7f9fb] py-10 transition-colors ${isUploading ? 'opacity-50 cursor-wait' : 'hover:border-[#0053c1]/40 hover:bg-[#eff6ff]'}`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0053c1]/10">
                    {isUploading ? (
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0053c1] border-t-transparent" />
                    ) : (
                      <Upload className="h-6 w-6 text-[#0053c1]" />
                    )}
                  </div>
                  <div className="text-center px-4">
                    <p className="text-sm font-medium text-[#191c1e]">
                      {isUploading ? 'Uploading photo...' : 'Tap to upload photo'}
                    </p>
                    <p className="mt-1 text-[10px] text-[#424653] leading-tight">
                      Ensure the photo shows both the rider and team member or the payment receipt
                    </p>
                  </div>
                </button>
              ) : (
                <div className="relative">
                  <img
                    src={screenshot}
                    alt="Payment screenshot"
                    className="w-full rounded-xl border border-[#e0e3e5] object-cover"
                  />
                  <button
                    onClick={() => setScreenshot(null)}
                    disabled={isUploading}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#ba1a1a] text-white shadow-md transition-colors hover:bg-[#991b1b] disabled:bg-gray-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 flex items-center gap-1 text-xs text-[#16a34a]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Photo uploaded successfully
                  </motion.div>
                </div>
              )}
            </motion.div>

            {/* Info Box */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-xl bg-[#fffbeb] p-4"
            >
              <p className="text-xs leading-relaxed text-[#92400e]">
                <span className="font-semibold">Note:</span> Payments are verified manually by our
                team. Balance will be updated within 24 hours of verification.
              </p>
            </motion.div>

            {/* Spacer */}
            <div className="h-4" />

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="pb-8"
            >
              <button
                disabled={!canSubmit || isRequesting || isUploading}
                onClick={handlePaymentSubmit}
                className={`w-full rounded-full px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                  canSubmit && !isRequesting && !isUploading
                    ? 'bg-gradient-to-r from-[#0053c1] to-[#2f6dde] text-white shadow-md shadow-[#0053c1]/20 hover:shadow-lg hover:shadow-[#0053c1]/30'
                    : 'bg-[#e0e3e5] text-[#424653] cursor-not-allowed'
                }`}
              >
                {isRequesting ? 'Submitting...' : 'Submit Proof'}
              </button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
