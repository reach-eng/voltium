'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, User, Check } from 'lucide-react';
import { useAppStore } from '@/store/app';

type IntentType = 'delivery' | 'personal' | null;

interface IntentOption {
  id: IntentType;
  title: string;
  subtitle: string;
  icon: 'truck' | 'person';
  gradient: string;
  accentBg: string;
}

const options: IntentOption[] = [
  {
    id: 'delivery',
    title: 'Delivery Partner',
    subtitle: 'Use Ryd for commercial deliveries, logistics, and business operations.',
    icon: 'truck',
    gradient: 'linear-gradient(135deg, #0053c1 0%, #2f6dde 100%)',
    accentBg: 'rgba(0, 83, 193, 0.06)',
  },
  {
    id: 'personal',
    title: 'Personal Use',
    subtitle: 'Rent electric vehicles for daily commute, errands, and personal rides.',
    icon: 'person',
    gradient: 'linear-gradient(135deg, #565e74 0%, #7b849a 100%)',
    accentBg: 'rgba(86, 94, 116, 0.06)',
  },
];

export default function IntentScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const [selected, setSelected] = useState<IntentType>(null);

  const handleContinue = () => {
    if (!selected) return;
    setScreen('onboarding');
  };

  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#f7f9fb] mesh-gradient relative overflow-hidden">
      {/* Content */}
      <div className="flex-1 flex flex-col px-5 pt-16 pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="w-14 h-14 rounded-full bg-[#0053c1]/[0.08] flex items-center justify-center mx-auto mb-5"
          >
            <span className="text-2xl">⚡</span>
          </motion.div>

          <h1 className="text-[1.5rem] font-bold text-[#191c1e] tracking-tight leading-tight">
            How will you use <span className="text-[#0053c1]">Ryd</span>?
          </h1>
          <p className="text-[0.875rem] text-[#424653] mt-2.5 max-w-[300px] mx-auto leading-relaxed">
            Choose your primary purpose to personalize your experience.
          </p>
        </motion.div>

        {/* Option cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-4 w-full"
        >
          {options.map((option, index) => {
            const isSelected = selected === option.id;
            const Icon = option.icon === 'truck' ? Truck : User;

            return (
              <motion.button
                key={option.id}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.25 + index * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(option.id)}
                className="relative w-full rounded-xl p-5 text-left transition-all cursor-pointer overflow-hidden"
                style={{
                  background: isSelected ? option.accentBg : '#ffffff',
                  boxShadow: isSelected
                    ? '0px 0px 0px 2px #0053c1, 0px 24px 48px rgba(15,23,42,0.06)'
                    : '0px 24px 48px rgba(15,23,42,0.04)',
                }}
              >
                {/* Selected indicator */}
                <motion.div
                  className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center"
                  animate={{
                    background: isSelected
                      ? 'linear-gradient(135deg, #0053c1 0%, #2f6dde 100%)'
                      : '#e0e3e5',
                  }}
                  transition={{ duration: 0.25 }}
                >
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isSelected ? 1 : 0,
                      opacity: isSelected ? 1 : 0,
                    }}
                    transition={{ duration: 0.2, type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  </motion.div>
                </motion.div>

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all"
                  style={{
                    background: isSelected ? option.gradient : '#f2f4f6',
                  }}
                >
                  <Icon
                    className="w-6 h-6 transition-colors"
                    style={{ color: isSelected ? '#ffffff' : '#424653' }}
                    strokeWidth={1.8}
                  />
                </div>

                {/* Text */}
                <h3 className="text-[1.0625rem] font-bold text-[#191c1e] mb-1.5 pr-8">
                  {option.title}
                </h3>
                <p className="text-[0.8125rem] text-[#424653] leading-relaxed pr-8">
                  {option.subtitle}
                </p>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Spacer */}
        <div className="flex-1 min-h-6" />

        {/* Continue button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleContinue}
            disabled={!selected}
            className="w-full h-14 rounded-full text-[0.9375rem] font-semibold text-white shadow-[0px_8px_24px_rgba(0,83,193,0.25)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer safe-bottom"
            style={{
              background: 'linear-gradient(135deg, #0053c1 0%, #2f6dde 100%)',
            }}
          >
            Continue
          </motion.button>
        </motion.div>
      </div>
    </main>
  );
}
