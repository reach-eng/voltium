'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, ArrowRight, Check, Circle, Loader2, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/store/app';

interface Hub {
  id: string;
  name: string;
  location: string | null;
  city: string | null;
  isActive: boolean;
}

function ProgressStepper() {
  const steps = [
    { label: 'Hub Selection', status: 'current' as const },
    { label: 'Verification', status: 'pending' as const },
  ];

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {step.status === 'current' ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0053c1]">
                <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
              </div>
            ) : (
              <Circle size={20} className="text-[#e0e3e5]" fill="#e0e3e5" />
            )}
            <span
              className={`text-xs font-medium ${
                step.status === 'current' ? 'text-[#0053c1]' : 'text-[#424653]'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && <div className="h-px w-6 bg-[#e0e3e5]" />}
        </div>
      ))}
    </div>
  );
}

export default function PickupHubScreen() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const setScreen = useAppStore((s) => s.setScreen);
  const setRider = useAppStore((s) => s.setRider);
  const rider = useAppStore((s) => s.rider);
  const showToast = useAppStore((s) => s.showToast);

  useEffect(() => {
    async function fetchHubs() {
      try {
        const res = await fetch('/api/admin/hubs?limit=100');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setHubs(json.data.filter((h: any) => h.isActive !== false));
        } else {
          showToast('Failed to load hubs');
        }
      } catch (err) {
        showToast('Error fetching hubs');
      } finally {
        setLoading(false);
      }
    }
    fetchHubs();
  }, [showToast]);

  const handleSendOtp = async () => {
    if (emergencyContact.length !== 10) {
      showToast('Enter a valid 10-digit number');
      return;
    }
    if (emergencyContact === rider.phone) {
      showToast('Emergency phone cannot be the same as Rider phone');
      return;
    }
    if (emergencyContact === rider.guarantorPhone) {
      showToast('Emergency phone cannot be the same as Guarantor phone');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: emergencyContact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      setIsOtpSent(true);
      showToast('OTP sent to emergency contact');
      if (data.data?.otp) setOtp(data.data.otp);
    } catch (err: any) {
      showToast(err.message || 'OTP delivery failed');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      showToast('Enter 6-digit OTP');
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: emergencyContact, otp }),
      });
      if (!res.ok) throw new Error('Invalid OTP');

      setIsOtpVerified(true);
      showToast('Phone verified successfully');
    } catch (err: any) {
      showToast(err.message || 'OTP verification failed');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleContinue = () => {
    if (emergencyContact.length !== 10) {
      showToast('Enter emergency contact number');
      return;
    }
    if (!isOtpVerified) {
      showToast('Please verify emergency contact phone with OTP');
      return;
    }

    const hub = hubs.find((h) => h.id === selectedHub);
    if (hub) {
      setRider({
        pickupHubId: hub.id,
        pickupHub: hub.name,
        emergencyContact: emergencyContact || undefined,
      });
      setScreen('pickup_vehicle');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 text-[#0053c1] animate-spin" strokeWidth={2.5} />
        <p className="text-sm font-semibold text-[#424653] mt-3 animate-pulse">
          Loading active hubs...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] px-4 pt-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-[1.75rem] font-black text-[#191c1e] leading-tight">
          Select Pickup Hub.
        </h1>
        <p className="text-[#424653] mt-1 text-sm">Choose the hub nearest to your location</p>
      </motion.div>

      {/* Progress Stepper */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mt-5"
      >
        <ProgressStepper />
      </motion.div>

      {/* Hub Grid */}
      {hubs.length === 0 ? (
        <div className="mt-6 text-center p-8 bg-white border border-[#e0e3e5] rounded-xl shadow-[0px_24px_48px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-[#424653]">No active hubs available at this time.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {hubs.map((hub, index) => {
            const isSelected = selectedHub === hub.id;
            return (
              <motion.div
                key={hub.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + index * 0.08 }}
                onClick={() => setSelectedHub(hub.id)}
                className={`cursor-pointer rounded-xl bg-white p-4 transition-all duration-200 ${
                  isSelected
                    ? 'border-2 border-[#0053c1] bg-blue-50/60 shadow-[0px_24px_48px_rgba(15,23,42,0.08)]'
                    : 'border border-[#e0e3e5] shadow-[0px_24px_48px_rgba(15,23,42,0.04)] hover:border-[#0053c1]/30'
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg mb-3 ${
                    isSelected ? 'bg-[#0053c1]/10 text-[#0053c1]' : 'bg-[#f2f4f6] text-[#424653]'
                  }`}
                >
                  <MapPin size={18} />
                </div>
                <h3 className="font-bold text-xs text-[#191c1e] leading-tight">{hub.name}</h3>
                <p className="text-[10px] text-[#424653] mt-1 leading-snug">
                  {hub.location || hub.city || 'Active hub location'}
                </p>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mt-2 flex items-center gap-1"
                  >
                    <Check size={10} className="text-[#0053c1]" />
                    <span className="text-[10px] font-medium text-[#0053c1]">Selected</span>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Emergency Contact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="mt-6"
      >
        <label className="flex items-center gap-1.5 text-xs font-semibold text-[#191c1e] mb-2">
          <Phone size={13} className="text-[#424653]" />
          Emergency Contact Number
        </label>
        <div className="space-y-3">
          <div className="relative">
            <input
              type="tel"
              value={emergencyContact}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setEmergencyContact(val);
                setIsOtpVerified(false);
                setIsOtpSent(false);
              }}
              placeholder="10-digit number"
              className="w-full rounded-xl border border-[#e0e3e5] bg-white px-4 py-3.5 text-sm text-[#191c1e] placeholder:text-[#424653]/50 focus:border-[#0053c1] focus:outline-none focus:ring-2 focus:ring-[#0053c1]/10 transition-all"
            />
            {!isOtpVerified && (
              <button
                onClick={handleSendOtp}
                disabled={isSendingOtp || emergencyContact.length !== 10}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-[#0053c1] hover:underline disabled:opacity-40"
              >
                {isSendingOtp ? 'Sending...' : isOtpSent ? 'Resend' : 'Send OTP'}
              </button>
            )}
            {isOtpVerified && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-500">
                <CheckCircle2 size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Verified</span>
              </div>
            )}
          </div>

          {isOtpSent && !isOtpVerified && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="relative overflow-hidden"
            >
              <input
                type="tel"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="w-full rounded-xl border border-[#e0e3e5] bg-white px-4 py-3.5 text-sm text-[#191c1e] placeholder:text-[#424653]/50 focus:border-[#0053c1] focus:outline-none focus:ring-2 focus:ring-[#0053c1]/10 transition-all"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={isVerifyingOtp || otp.length !== 6}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-[#0053c1] hover:underline disabled:opacity-40"
              >
                {isVerifyingOtp ? 'Verifying...' : 'Verify'}
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-8"
      >
        <button
          onClick={handleContinue}
          disabled={!selectedHub}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0053c1]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#0053c1]/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Vehicle Assignment
          <ArrowRight size={16} />
        </button>
      </motion.div>
    </div>
  );
}
