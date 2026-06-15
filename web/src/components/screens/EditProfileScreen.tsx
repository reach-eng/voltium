'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Camera,
  Mail,
  Phone,
  User,
  ShieldCheck,
  Send,
  Loader2,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderProfile } from '@/hooks/useRiderData';
import { useQueryClient } from '@tanstack/react-query';

const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

export default function EditProfileScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const showToast = useAppStore((s) => s.showToast);
  const { rider } = useRiderProfile();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: rider?.fullName || rider?.name || '',
    email: rider?.email || '',
    phone: rider?.phone || '',
    guarantorName: (rider as any)?.guarantorName || '',
    guarantorPhone: (rider as any)?.guarantorPhone || '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Guarantor OTP state
  const originalGPhone = (rider as any)?.guarantorPhone || '';
  const [isGOtpSent, setIsGOtpSent] = useState(false);
  const [isGOtpVerified, setIsGOtpVerified] = useState(!!originalGPhone);
  const [gOtp, setGOtp] = useState('');
  const [isSendingGOtp, setIsSendingGOtp] = useState(false);
  const [isVerifyingGOtp, setIsVerifyingGOtp] = useState(false);

  const gPhoneChanged = formData.guarantorPhone !== originalGPhone;
  const needsGVerification = gPhoneChanged && !isGOtpVerified;

  const handleSendGOtp = async () => {
    const phone = formData.guarantorPhone.replace(/\D/g, '');
    if (phone.length !== 10) {
      showToast('Enter a valid 10-digit number');
      return;
    }
    if (phone === formData.phone) {
      showToast('Guarantor phone cannot be the same as rider phone');
      return;
    }
    setIsSendingGOtp(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      setIsGOtpSent(true);
      showToast('OTP sent to guarantor phone');
      if (data.data?.otp) setGOtp(data.data.otp);
    } catch (err: any) {
      showToast(err.message || 'OTP delivery failed');
    } finally {
      setIsSendingGOtp(false);
    }
  };

  const handleVerifyGOtp = async () => {
    if (gOtp.length !== 6) {
      showToast('Enter 6-digit OTP');
      return;
    }
    const phone = formData.guarantorPhone.replace(/\D/g, '');
    setIsVerifyingGOtp(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: gOtp }),
      });
      if (!res.ok) throw new Error('Invalid OTP');
      setIsGOtpVerified(true);
      showToast('Guarantor phone verified');
    } catch (err: any) {
      showToast(err.message || 'OTP verification failed');
    } finally {
      setIsVerifyingGOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rider?.id) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/rider/profile?riderId=${rider.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-rider-id': rider.id,
        },
        body: JSON.stringify({
          fullName: formData.name,
          email: formData.email,
          phone: formData.phone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      setSubmitting(false);
      setSubmitted(true);

      // Invalidate the profile query to ensure data is fresh when we go back
      queryClient.invalidateQueries({ queryKey: ['rider', 'profile', rider.id] });

      showToast('Profile update submitted successfully');
      setTimeout(() => setScreen('profile'), 2000);
    } catch (err: any) {
      showToast(err.message || 'Update failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-vf-surface mesh-gradient pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => setScreen('profile')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <ArrowLeft size={18} className="text-vf-on-surface" />
        </button>
        <h1 className="text-xl font-bold text-vf-on-surface">Edit Profile</h1>
      </div>

      <div className="px-5">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Photo Upload */}
              <motion.div
                custom={0}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="flex flex-col items-center"
              >
                <div className="relative group cursor-pointer">
                  <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-md">
                    <User size={40} className="text-slate-300" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera size={20} className="text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-[#0053c1] border-2 border-white flex items-center justify-center shadow-md">
                    <Camera size={14} className="text-white" />
                  </div>
                </div>
                <p className="mt-2 text-[10px] font-bold text-[#0053c1] uppercase tracking-wider">
                  Tap to change photo
                </p>
              </motion.div>

              {/* Form Fields */}
              <motion.div
                custom={1}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="space-y-4"
              >
                <div className="rounded-2xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] space-y-4">
                  <h3 className="text-xs font-bold text-vf-on-surface-variant uppercase tracking-wider">
                    Personal Information
                  </h3>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-vf-outline uppercase ml-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-4 top-3.5 text-vf-outline" />
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-vf-surface-container-low border border-vf-outline-variant text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0053c1]/20 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-vf-outline uppercase ml-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-3.5 text-vf-outline" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-vf-surface-container-low border border-vf-outline-variant text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0053c1]/20 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-vf-outline uppercase ml-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-4 top-3.5 text-vf-outline" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                          })
                        }
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-vf-surface-container-low border border-vf-outline-variant text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0053c1]/20 transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] space-y-4">
                  <h3 className="text-xs font-bold text-vf-on-surface-variant uppercase tracking-wider">
                    Guarantor Information
                  </h3>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-vf-outline uppercase ml-1">
                      Guarantor Name
                    </label>
                    <div className="relative">
                      <ShieldCheck size={16} className="absolute left-4 top-3.5 text-vf-outline" />
                      <input
                        type="text"
                        value={formData.guarantorName}
                        onChange={(e) =>
                          setFormData({ ...formData, guarantorName: e.target.value })
                        }
                        placeholder="Enter guarantor's name"
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-vf-surface-container-low border border-vf-outline-variant text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0053c1]/20 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-vf-outline uppercase ml-1">
                      Guarantor Phone
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone size={16} className="absolute left-4 top-3.5 text-vf-outline" />
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={formData.guarantorPhone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setFormData({ ...formData, guarantorPhone: val });
                            setIsGOtpVerified(val === originalGPhone && !!originalGPhone);
                            setIsGOtpSent(false);
                            setGOtp('');
                          }}
                          placeholder="Enter guarantor's phone"
                          className="w-full pl-11 pr-4 py-3 rounded-xl bg-vf-surface-container-low border border-vf-outline-variant text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0053c1]/20 transition"
                        />
                        {isGOtpVerified && (
                          <CheckCircle2
                            size={16}
                            className="absolute right-4 top-3.5 text-emerald-500"
                          />
                        )}
                      </div>
                      {needsGVerification && (
                        <button
                          type="button"
                          onClick={handleSendGOtp}
                          disabled={isSendingGOtp || formData.guarantorPhone.length !== 10}
                          className="px-4 py-3 rounded-xl bg-[#0053c1] text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-40 hover:bg-[#003d91] transition-colors whitespace-nowrap flex items-center gap-1.5"
                        >
                          {isSendingGOtp ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isGOtpSent ? (
                            'Resend'
                          ) : (
                            'Send OTP'
                          )}
                        </button>
                      )}
                    </div>
                    {isGOtpSent && !isGOtpVerified && (
                      <div className="flex gap-2 mt-2 animate-in slide-in-from-top-2 duration-300">
                        <div className="relative flex-1">
                          <Lock size={16} className="absolute left-4 top-3.5 text-vf-outline" />
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={6}
                            value={gOtp}
                            onChange={(e) => setGOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Enter 6-digit OTP"
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-vf-surface-container-low border border-vf-outline-variant text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 transition tracking-[0.3em]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleVerifyGOtp}
                          disabled={isVerifyingGOtp || gOtp.length !== 6}
                          className="px-4 py-3 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-40 hover:bg-emerald-600 transition-colors whitespace-nowrap flex items-center gap-1.5"
                        >
                          {isVerifyingGOtp ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            'Verify'
                          )}
                        </button>
                      </div>
                    )}
                    {isGOtpVerified && gPhoneChanged && (
                      <div className="flex items-center gap-1.5 mt-1.5 ml-1">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-600">
                          Phone verified
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Submit Button */}
              <motion.div
                custom={2}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="pt-4"
              >
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-[#0053c1] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={16} />
                      Submit Change Request
                    </>
                  )}
                </button>
                <p className="mt-4 text-center text-[11px] font-medium text-vf-on-surface-variant leading-relaxed px-4">
                  Note: Any changes to your profile require approval from the Ryd Admin team. You
                  will be notified once the changes are processed.
                </p>
              </motion.div>
            </motion.form>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                <CheckCircle2 size={40} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-vf-on-surface">Request Submitted!</h2>
              <p className="mt-3 text-sm text-vf-on-surface-variant max-w-[240px]">
                Your profile update request has been sent to our admin team for verification.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
