'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shield, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useAppStore } from '@/store/app';

interface ExpandableSection {
  id: string;
  title: string;
  content: string;
}

const sections: ExpandableSection[] = [
  {
    id: 'terms',
    title: 'Terms of Service',
    content:
      'These Terms of Service ("Terms") govern your access to and use of Ryd\'s services, including our electric vehicle rental platform, mobile application, and related services.\n\nBy creating an account or using our services, you agree to be bound by these Terms.\n\n1. Account Registration: You must provide accurate, current, and complete information during registration and keep your account information updated.\n\n2. Vehicle Rental: All vehicle rentals are subject to availability and our rental policies. You must hold a valid driver\'s license and meet minimum age requirements.\n\n3. Safety Requirements: You agree to follow all safety guidelines, traffic laws, and Ryd usage policies while operating our vehicles.\n\n4. Payment Terms: You authorize Ryd to charge your selected payment method for rental fees, security deposits, and any applicable charges.\n\n5. Liability: You are responsible for any damage to the vehicle during your rental period, subject to the terms of your selected plan.',
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    content:
      'Ryd respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information.\n\n1. Information We Collect: We collect your name, phone number, email, government-issued ID (Aadhaar, PAN), bank details, location data, and vehicle usage information.\n\n2. How We Use Your Data: We use your information to provide and improve our services, process transactions, communicate with you, and comply with legal obligations.\n\n3. Data Sharing: We may share your data with trusted partners, government authorities as required by law, and service providers who assist our operations.\n\n4. Data Security: We implement industry-standard security measures including encryption, secure servers, and access controls to protect your data.\n\n5. Your Rights: You can access, correct, or delete your personal data by contacting our support team or through your account settings.\n\n6. Data Retention: We retain your data for as long as necessary to provide our services and comply with legal requirements.',
  },
];

export default function LegalConsentScreen() {
  const goBack = useAppStore((s) => s.goBack);
  const setScreen = useAppStore((s) => s.setScreen);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const toggleSection = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  const handleContinue = () => {
    if (!accepted) return;

    // Intelligent Routing: If logged in, go to intent. If not, go to login.
    const hasSession = !!useAppStore.getState().rider?.phone;
    setScreen(hasSession ? 'intent' : 'login');
  };

  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#f7f9fb] mesh-gradient relative overflow-hidden">
      {/* Top bar area */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="pt-6 px-5"
      >
        <button
          type="button"
          onClick={goBack}
          className="w-10 h-10 rounded-full bg-white/70 backdrop-blur-xl flex items-center justify-center shadow-[0px_2px_8px_rgba(15,23,42,0.04)] hover:bg-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-[#191c1e]" />
        </button>
      </motion.div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-5 pt-6 pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center gap-3 mb-2"
        >
          <div className="w-12 h-12 rounded-xl bg-white/70 backdrop-blur-xl flex items-center justify-center shadow-[0px_2px_8px_rgba(15,23,42,0.04)]">
            <Shield className="w-6 h-6 text-[#0053c1]" strokeWidth={1.8} />
          </div>
          <h1 className="text-[1.5rem] font-bold text-[#191c1e] tracking-tight">Agree to Terms</h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-[0.875rem] text-[#424653] mb-6 leading-relaxed"
        >
          Please review and accept our legal documents to continue.
        </motion.p>

        {/* Expandable sections */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col gap-3 mb-6"
        >
          {sections.map((section) => (
            <div
              key={section.id}
              className="rounded-xl bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.04)] overflow-hidden"
            >
              {/* Header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-5 py-4 cursor-pointer"
              >
                <span className="text-[0.9375rem] font-semibold text-[#191c1e]">
                  {section.title}
                </span>
                <motion.div
                  animate={{ rotate: expanded === section.id ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <ChevronDown className="w-5 h-5 text-[#424653]" />
                </motion.div>
              </button>

              {/* Content */}
              <AnimatePresence>
                {expanded === section.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5">
                      <div className="h-px bg-[#e0e3e5] mb-4" />
                      <div className="max-h-[280px] overflow-y-auto no-scrollbar pr-1">
                        {section.content.split('\n\n').map((paragraph, i) => (
                          <p
                            key={i}
                            className="text-[0.8125rem] text-[#424653] leading-[1.7] mb-3 last:mb-0"
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>

        {/* Spacer */}
        <div className="flex-1 min-h-4" />

        {/* Checkbox */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-5"
        >
          <button
            type="button"
            onClick={() => setAccepted(!accepted)}
            className="flex items-start gap-3 cursor-pointer w-full text-left"
          >
            {/* Custom checkbox */}
            <div
              className="w-6 h-6 mt-0.5 rounded-lg flex items-center justify-center shrink-0 transition-all"
              style={{
                background: accepted
                  ? 'linear-gradient(135deg, #0053c1 0%, #2f6dde 100%)'
                  : '#e0e3e5',
                boxShadow: accepted ? '0px 2px 8px rgba(0, 83, 193, 0.25)' : 'none',
              }}
            >
              <AnimatePresence>
                {accepted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.2, type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="text-[0.8125rem] text-[#424653] leading-relaxed">
              I have read and agree to the{' '}
              <span className="text-[#0053c1] font-semibold">Terms of Service</span> and{' '}
              <span className="text-[#0053c1] font-semibold">Privacy Policy</span>
            </span>
          </button>
        </motion.div>

        {/* Continue button */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleContinue}
          disabled={!accepted}
          className="w-full h-14 rounded-full text-[0.9375rem] font-semibold text-white shadow-[0px_8px_24px_rgba(0,83,193,0.25)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer safe-bottom"
          style={{
            background: 'linear-gradient(135deg, #0053c1 0%, #2f6dde 100%)',
          }}
        >
          Continue
        </motion.button>
      </div>
    </main>
  );
}
