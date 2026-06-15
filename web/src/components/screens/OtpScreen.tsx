'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Smartphone, RefreshCw, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { BRAND_SHORT } from '@/lib/branding';
import { Button } from '@/components/ui/button';

const OTP_LENGTH = 6;
const TIMER_SECONDS = 60;

export default function OtpScreen() {
  const goBack = useAppStore((s) => s.goBack);
  const setScreen = useAppStore((s) => s.setScreen);
  const rider = useAppStore((s) => s.rider);
  const setRider = useAppStore((s) => s.setRider);
  const isLogin = useAppStore((s) => s.isLogin);
  const setOtpVerified = useAppStore((s) => s.setOtpVerified);
  const showToast = useAppStore((s) => s.showToast);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const [verifying, setVerifying] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const maskedPhone = rider.phone || '+91 98765 43210';

  const canResend = timer <= 0;

  // Timer countdown
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < OTP_LENGTH) {
      inputRefs.current[index]?.focus();
    }
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    const digit = value.slice(-1);
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        focusInput(index - 1);
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) return;

    setVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: rider.phone?.replace('+91', ''),
          otp: code,
          referralCode: (rider as any).referralCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      useRiderSession.getState().setRiderSession(data.data.id, data.data.name || 'Rider');
      setRider(data.data);
      setOtpVerified(true);

      // Intelligent Routing: Existing users go to dashboard, active go to active_dashboard, new go to intent
      const isActuallyActive =
        data.data.lifecycleStatus === 'ACTIVE' || data.data.pickupDone === true;
      const isOnboarded = data.data.kycStatus === 'APPROVED' || data.data.kycDone === true;

      if (data.data.lifecycleStatus === 'CLOSED') {
        showToast('Your account is blocked. Please contact support.');
      } else if (isActuallyActive) {
        setScreen('active_dashboard');
      } else if (isOnboarded) {
        setScreen('pre_dashboard');
      } else {
        setScreen('intent');
      }
    } catch (err: any) {
      showToast(err.message || 'Invalid code. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: rider.phone?.replace('+91', '') }),
      });
      if (!res.ok) throw new Error('Failed to resend code');
      showToast('OTP code resent successfully!');

      setOtp(Array(OTP_LENGTH).fill(''));
      setTimer(TIMER_SECONDS);
      focusInput(0);
    } catch (err: any) {
      showToast(err.message || 'Error resending OTP');
    }
  };

  const isComplete = otp.every((d) => d !== '');

  return (
    <main className="min-h-dvh flex flex-col bg-[#F5F7FA] relative overflow-hidden">
      {/* Mobile Custom AppBar — 1:1 with Mobile */}
      <div className="flex items-center justify-between px-4 h-14 mt-2 relative">
        <button
          onClick={goBack}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm z-10"
        >
          <ArrowLeft size={20} className="text-[#101828]" />
        </button>
        <span className="absolute left-0 right-0 text-center text-[1rem] font-[900] text-[#101828] tracking-[1.5px] uppercase">
          {BRAND_SHORT}
        </span>
        <div className="w-10 h-10" /> {/* Spacer */}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 flex flex-col items-center px-6 pt-12 pb-8 overflow-y-auto">
        {/* Animated Icon — 1:1 with Mobile */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-[0px_10px_20px_rgba(0,0,0,0.04)] mb-12"
        >
          <div className="animate-bounce">
            <Smartphone size={40} className="text-[#0053C1]" />
          </div>
        </motion.div>

        {/* Title Section */}
        <div className="text-center mb-12">
          <h1 className="text-[2rem] font-[900] text-[#101828] tracking-tight">
            {isLogin ? 'Welcome Back!' : 'Verify OTP'}
          </h1>
          <p className="text-[0.9375rem] text-[#475467] mt-3 leading-relaxed">
            {isLogin ? 'Enter the code to login to your account' : 'Enter the 6-digit code sent to'}{' '}
            <span className="font-bold text-[#0053C1]">{maskedPhone}</span>
          </p>
        </div>

        {/* OTP Inputs Boxes — 1:1 with Mobile */}
        <div className="flex items-center justify-between w-full max-w-[320px] mb-16">
          {otp.map((digit, index) => (
            <input
              key={`otp-${index}`}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 rounded-2xl bg-white border-[1.5px] border-[#E2E8F0] text-center text-[1.5rem] font-extrabold text-[#101828] outline-none transition-all focus:border-[#0053C1] focus:border-2"
            />
          ))}
        </div>

        {/* Resend Section — 1:1 with Mobile */}
        <div className="flex flex-col items-center mb-8">
          <span className="text-[0.6875rem] font-black text-[#475467] tracking-[1.2px] uppercase">
            Didn&apos;t receive the code?
          </span>
          <button
            onClick={handleResend}
            disabled={!canResend}
            className={`mt-2 text-[0.9375rem] font-extrabold transition-colors ${
              canResend ? 'text-[#0053C1] hover:underline' : 'text-[#98A2B3]'
            }`}
          >
            {canResend ? 'Resend Code' : `Resend in ${timer}s`}
          </button>
        </div>

        <div className="flex-1" />

        {/* Bottom CTA — 1:1 with Mobile */}
        <Button
          onClick={handleVerify}
          disabled={!isComplete || verifying}
          size="xl"
          className="w-full shadow-[0px_8px_24px_rgba(0,83,193,0.25)] gap-2"
        >
          {verifying ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            />
          ) : (
            <>
              Verify & Proceed
              <ArrowRight size={20} />
            </>
          )}
        </Button>
      </div>
    </main>
  );
}
