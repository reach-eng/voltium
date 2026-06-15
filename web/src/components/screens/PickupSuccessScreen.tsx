'use client';

import { motion } from 'framer-motion';
import { Check, Bike, Zap, Battery, MapPin, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/store/app';

export default function PickupSuccessScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const rider = useAppStore((s) => s.rider);

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background decoration */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.05 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 30%, #0053c1 0%, transparent 70%)',
        }}
      />

      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
        className="relative z-10"
      >
        {/* Outer ring pulse */}
        <motion.div
          initial={{ scale: 1, opacity: 0.3 }}
          animate={{ scale: [1, 1.4, 1.8], opacity: [0.3, 0.15, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1, delay: 0.5 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="h-24 w-24 rounded-full border-2 border-[#16a34a]" />
        </motion.div>

        {/* Main circle */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.3 }}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#16a34a] to-[#22c55e] shadow-xl shadow-green-500/30"
        >
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.6 }}
          >
            <Check size={48} className="text-white" strokeWidth={3} />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="text-center mt-6 z-10"
      >
        <h1 className="text-[1.75rem] font-black text-[#191c1e]">Pickup Complete!</h1>
        <p className="text-[#424653] text-sm mt-1">Your vehicle is ready. Ride safe!</p>
      </motion.div>

      {/* Vehicle Assignment Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="mt-8 w-full max-w-sm rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] border border-[#e0e3e5] z-10"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0053c1]/10 text-[#0053c1]">
            <Bike size={22} />
          </div>
          <div>
            <h3 className="font-bold text-[#191c1e]">{rider.assignedVehicle || 'VF-9022-X'}</h3>
            <p className="text-xs text-[#424653]">Ather 450X Gen3 • Performance Blue</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-[#f2f4f6] p-3">
            <Battery size={14} className="text-[#16a34a]" />
            <div>
              <p className="text-[10px] text-[#424653]">Battery</p>
              <p className="text-xs font-bold text-[#191c1e]">92%</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[#f2f4f6] p-3">
            <MapPin size={14} className="text-[#0053c1]" />
            <div>
              <p className="text-[10px] text-[#424653]">Hub</p>
              <p className="text-xs font-bold text-[#191c1e] truncate">
                {rider.pickupHub || 'Sector 7 Central Hub'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Riding message */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.3 }}
        className="mt-5 flex items-center gap-2 z-10"
      >
        <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <Zap size={16} className="text-[#f59e0b]" fill="#f59e0b" />
        </motion.div>
        <span className="text-sm font-medium text-[#424653]">You can now start riding!</span>
      </motion.div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.5 }}
        className="mt-6 w-full max-w-sm z-10"
      >
        <button
          onClick={() => setScreen('active_dashboard')}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0053c1]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#0053c1]/30 active:scale-[0.98]"
        >
          Go to Dashboard
          <ArrowRight size={16} />
        </button>
      </motion.div>
    </div>
  );
}
