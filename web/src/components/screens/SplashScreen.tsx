'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useAppStore } from '@/store/app';
import { BRAND_SHORT, BRAND_NAME, LOGO_PATH } from '@/lib/branding';
import { APP_CONFIG } from '@/lib/config';

export default function SplashScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const _hasHydrated = useAppStore((s) => s._hasHydrated);
  const [progress, setProgress] = useState(0);
  const [brandingComplete, setBrandingComplete] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 25);

    const timer = setTimeout(() => {
      setBrandingComplete(true);
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (_hasHydrated && brandingComplete) {
      const store = useAppStore.getState();
      // Only auto-redirect if we are still on the splash screen.
      // If we rehydrated into a deeper screen (e.g. from a reload), don't override it.
      if (store.screen === 'splash') {
        if (store.otpVerified && store.rider.registrationDone) {
          setScreen('active_dashboard');
        } else {
          setScreen('permissions');
        }
      }
    }
  }, [_hasHydrated, brandingComplete, setScreen]);

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#f7f9fb] relative overflow-hidden px-6">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#0053c1]/[0.06] blur-3xl animate-pulse-slow" />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* Logo */}
        <motion.div
          initial={{ rotate: -20, scale: 0.5 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="w-24 h-24 rounded-[1.75rem] flex items-center justify-center shadow-[0px_24px_48px_rgba(15,23,42,0.08)] bg-white overflow-hidden"
        >
          <Image
            src={LOGO_PATH}
            alt="Voltium"
            width={80}
            height={80}
            className="object-contain brightness-0 invert-[.35] sepia-[1] saturate-[5] hue-rotate-[195deg]"
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-[1.75rem] font-bold text-[#191c1e] tracking-tight text-center"
        >
          Welcome to {BRAND_SHORT}!
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-[0.9375rem] text-[#424653] text-center leading-relaxed max-w-[280px]"
        >
          {BRAND_NAME} — Ride smart, ride green.
        </motion.p>
      </motion.div>

      {/* Loading bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[200px] z-10"
      >
        <div className="h-[3px] w-full rounded-full bg-[#e0e3e5] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #0053c1, #2f6dde)',
            }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'linear' }}
          />
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-[0.75rem] text-[#737785] text-center mt-3 tracking-wide"
        >
          Loading experience...
        </motion.p>
      </motion.div>
    </main>
  );
}
