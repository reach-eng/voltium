'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { BRAND_SHORT, LOGO_PATH } from '@/lib/branding';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function LoginScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setRider = useAppStore((s) => s.setRider);
  const setIsLogin = useAppStore((s) => s.setIsLogin);
  const rider = useAppStore((s) => s.rider);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (phone.length < 10) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      setIsLogin(!!data.data?.exists);
      setRider({ phone: `+91${phone}` });
      setScreen('otp');
    } catch (err: any) {
      useAppStore.getState().showToast(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <main className="min-h-dvh flex flex-col bg-[#F5F7FA] relative overflow-hidden">
      <div className="flex-1 flex flex-col px-8 pt-16 pb-12">
        {/* App Logo and Name — 1:1 with Mobile */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center mb-12"
        >
          <div className="w-[72px] h-[72px] rounded-full bg-primary flex items-center justify-center shadow-[0px_8px_20px_rgba(27,96,218,0.2)] overflow-hidden">
            <Image
              src={LOGO_PATH}
              alt="Logo"
              width={40}
              height={40}
              className="text-white brightness-0 invert"
            />
          </div>
          <h1 className="text-[1.75rem] font-[900] text-[#101828] mt-6 tracking-tight">
            {BRAND_SHORT}
          </h1>
          <p className="text-[0.875rem] font-medium text-[#475467] mt-2">
            Manage your journey with precision.
          </p>
        </motion.div>

        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <h2 className="text-[1.375rem] font-extrabold text-[#101828] tracking-tight">Welcome</h2>
          <p className="text-[0.875rem] text-[#475467] mt-2 leading-relaxed">
            Enter the registered phone number to login or enter a new number to create another
            account.
          </p>
        </motion.div>

        {/* Phone Input — Custom Mobile Style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="relative group">
            <div className="flex items-center h-14 bg-[#E6EAEF] rounded-[28px] overflow-hidden transition-all group-focus-within:ring-2 group-focus-within:ring-primary/20">
              <span className="pl-6 pr-3 text-[1rem] font-bold text-[#101828]">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={handleKeyDown}
                placeholder="00000 00000"
                maxLength={10}
                className="flex-1 h-full bg-transparent text-[#101828] text-[1rem] font-semibold tracking-[1.5px] placeholder:text-[#98A2B3] placeholder:tracking-normal outline-none pr-4"
              />
            </div>
          </div>

          {/* Referral Code (Optional) */}
          <div className="relative group">
            <div className="flex items-center h-14 bg-[#E6EAEF] rounded-[28px] overflow-hidden transition-all focus-within:ring-2 focus-within:ring-primary/20">
              <div className="pl-6 pr-3 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary/60" />
              </div>
              <input
                type="text"
                value={(rider as any)?.referralCode || ''}
                onChange={(e) => setRider({ referralCode: e.target.value.toUpperCase() })}
                placeholder="Referral Code (Optional)"
                className="flex-1 h-full bg-transparent text-[#101828] text-[0.875rem] font-semibold placeholder:text-[#98A2B3] outline-none"
              />
            </div>
          </div>

          {/* SECURE OTP Note */}
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[0.6875rem] font-extrabold text-[#475467] tracking-[1.2px] uppercase">
              A SECURE OTP WILL BE SENT
            </span>
          </div>

          {/* Action Button */}
          <Button
            onClick={handleLogin}
            disabled={phone.length < 10 || loading}
            size="xl"
            className="w-full shadow-[0px_8px_24px_rgba(0,83,193,0.25)]"
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              'Enter'
            )}
          </Button>
        </motion.div>

        <div className="flex-1" />

        {/* Footer Terms — 1:1 with Mobile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <p className="text-[0.75rem] text-[#475467] leading-relaxed">
            By signing in, you agree to our
            <br />
            <button
              onClick={() => setScreen('legal')}
              className="text-primary font-bold hover:underline"
            >
              Terms of Service
            </button>{' '}
            and{' '}
            <button
              onClick={() => setScreen('legal')}
              className="text-primary font-bold hover:underline"
            >
              Privacy Policy
            </button>
          </p>
        </motion.div>
      </div>
    </main>
  );
}
