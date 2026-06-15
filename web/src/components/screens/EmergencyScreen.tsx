'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Phone, MapPin, X } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { SUPPORT_PHONE } from '@/lib/branding';

export default function EmergencyScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const showToast = useAppStore((s) => s.showToast);
  const [holding, setHolding] = useState(false);
  const [activated, setActivated] = useState(false);

  const handleHoldStart = () => {
    setHolding(true);
  };

  const handleHoldEnd = async () => {
    setHolding(false);
    if (holding) {
      setActivated(true);
      showToast('Emergency SOS activated! Help is on the way.');

      // Trigger actual SOS ticket in backend
      try {
        const rId = (window as any).useRiderSession?.getState().riderId;
        await fetch(`/api/support/tickets${rId ? `?riderId=${rId}` : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            riderId: rId,
            subject: 'Emergency Panic Button Triggered',
            message: 'Rider activated the physical SOS button on the emergency screen.',
            category: 'SOS',
            priority: 'CRITICAL',
          }),
        });
      } catch (e) {
        console.error('Failed to trigger SOS ticket:', e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-red-600 relative overflow-hidden">
      {/* Animated background circles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-red-500/30 animate-pulse-slow" />
        <div
          className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-red-700/20 animate-pulse-slow"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute top-1/3 right-0 h-40 w-40 rounded-full bg-red-400/10 animate-pulse-slow"
          style={{ animationDelay: '4s' }}
        />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <button
            onClick={() => setScreen('profile')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-white" />
            <h1 className="text-xl font-bold text-white">Emergency SOS</h1>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-5 space-y-8">
          {/* SOS Button */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <button
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onTouchStart={handleHoldStart}
              onTouchEnd={handleHoldEnd}
              className={`
                relative flex flex-col items-center justify-center rounded-full shadow-2xl transition-all
                ${
                  activated
                    ? 'w-40 h-40 bg-green-500'
                    : holding
                      ? 'w-40 h-40 bg-red-700 scale-105'
                      : 'w-40 h-40 bg-red-500'
                }
              `}
            >
              {!activated && (
                <>
                  {/* Pulsing rings */}
                  <span className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping" />
                  <span
                    className="absolute inset-0 rounded-full border-2 border-white/10 animate-ping"
                    style={{ animationDelay: '0.5s' }}
                  />
                </>
              )}
              <span className="text-4xl font-black text-white">{activated ? '✓' : 'SOS'}</span>
              <span className="mt-1 text-[11px] font-bold text-white/80 uppercase tracking-wider">
                {activated ? 'Activated' : 'Hold to Activate'}
              </span>
            </button>
          </motion.div>

          {/* Emergency Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full rounded-2xl bg-white/15 backdrop-blur-md p-5"
          >
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-white mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">
                  Your location will be shared with the emergency team
                </p>
                <p className="mt-1 text-xs text-white/60 font-mono">28.6139° N, 77.2090° E</p>
                <p className="mt-0.5 text-xs text-white/60">New Delhi, India</p>
              </div>
            </div>
          </motion.div>

          {/* Emergency Contacts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="w-full space-y-2"
          >
            <p className="text-xs font-bold text-white/60 uppercase tracking-wider text-center">
              Emergency Contacts
            </p>
            <div className="rounded-2xl bg-white/10 backdrop-blur-md divide-y divide-white/10">
              <a
                href={`tel:${SUPPORT_PHONE.replace(/[^0-9]/g, '')}`}
                className="flex items-center gap-3 p-4"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <Phone size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Ryd Emergency</p>
                  <p className="text-xs text-white/60">{SUPPORT_PHONE}</p>
                </div>
              </a>
              <a href="tel:100" className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <Phone size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Local Police</p>
                  <p className="text-xs text-white/60">100</p>
                </div>
              </a>
              <a href="tel:108" className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <Phone size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Ambulance</p>
                  <p className="text-xs text-white/60">108</p>
                </div>
              </a>
            </div>
          </motion.div>
        </div>

        {/* Cancel Button */}
        <div className="px-5 pb-10">
          <button
            onClick={() => setScreen('profile')}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/30"
          >
            <X size={18} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
