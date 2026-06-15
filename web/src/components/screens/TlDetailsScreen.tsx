'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  User,
  Phone,
  MessageCircle,
  ShieldCheck,
  AlertCircle,
  Send,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderProfile } from '@/hooks/useRiderData';

const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

export default function TlDetailsScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const showToast = useAppStore((s) => s.showToast);
  const { rider } = useRiderProfile();
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRequestChange = async () => {
    if (!reason.trim()) {
      showToast('Please provide a reason for the change');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/support/tickets?riderId=${rider?.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: rider?.id,
          category: 'GENERAL',
          subject: 'Team Leader Change Request',
          message: `Reason: ${reason.trim()}`,
          priority: 'MEDIUM',
        }),
      });

      if (!res.ok) throw new Error('Failed to submit request');

      showToast('TL change request submitted for approval');
      setSubmitting(false);
      setShowChangeRequest(false);
      setReason('');
    } catch (err) {
      showToast('Failed to submit request. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-vf-surface mesh-gradient pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => setScreen('active_dashboard')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <ArrowLeft size={18} className="text-vf-on-surface" />
        </button>
        <h1 className="text-xl font-bold text-vf-on-surface">Team Leader Profile</h1>
      </div>

      <div className="px-5 space-y-6">
        {/* TL Hero Card */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-3xl bg-white p-6 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] text-center"
        >
          <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center mb-4">
            {rider?.assignedTlPhoto ? (
              <img src={rider.assignedTlPhoto} alt="TL" className="w-full h-full object-cover" />
            ) : (
              <User size={40} className="text-amber-600" />
            )}
          </div>
          <h2 className="text-xl font-bold text-vf-on-surface">
            {rider?.assignedTlName ||
              (rider?.teamLeader && rider.teamLeader !== 'Not Assigned'
                ? rider.teamLeader
                : 'Amit Sharma')}
          </h2>
          <p className="text-sm font-medium text-vf-on-surface-variant mb-4">
            Senior Fleet Manager
          </p>

          <div className="flex justify-center gap-3">
            <button
              onClick={() =>
                window.open(
                  `tel:${rider?.assignedTlPhone || (rider?.emergencyContact && rider.emergencyContact !== 'Not Assigned' ? rider.emergencyContact : '+91 98765 12345')}`,
                  '_self'
                )
              }
              className="flex items-center gap-2 rounded-full bg-blue-50 px-5 py-2.5 text-xs font-bold text-[#0053c1] transition-transform active:scale-[0.95]"
            >
              <Phone size={14} />
              Call TL
            </button>
            <button
              onClick={() => showToast('Chat feature coming soon!')}
              className="flex items-center gap-2 rounded-full bg-green-50 px-5 py-2.5 text-xs font-bold text-green-600 transition-transform active:scale-[0.95]"
            >
              <MessageCircle size={14} />
              Message
            </button>
          </div>
        </motion.div>

        {/* TL Info List */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          <div className="rounded-2xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-vf-surface-container-low flex items-center justify-center text-vf-on-surface-variant">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-vf-outline">Employee ID</p>
                <p className="text-sm font-semibold text-vf-on-surface">TL-VF-0892</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-vf-surface-container-low flex items-center justify-center text-vf-on-surface-variant">
                <Phone size={18} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-vf-outline">Phone Number</p>
                <p className="text-sm font-semibold text-vf-on-surface">
                  {rider?.assignedTlPhone ||
                    (rider?.emergencyContact && rider.emergencyContact !== 'Not Assigned'
                      ? rider.emergencyContact
                      : '+91 98765 12345')}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Change TL Request Section */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl bg-rose-50 border border-rose-100 p-5"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
              <AlertCircle size={16} className="text-rose-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-800">Not satisfied with your TL?</h3>
              <p className="text-[11px] font-medium text-rose-600/70 mt-0.5 leading-relaxed">
                You can request a Change of Team Leader. Your request will be reviewed by the Hub
                Manager.
              </p>
            </div>
          </div>

          {!showChangeRequest ? (
            <button
              onClick={() => setShowChangeRequest(true)}
              className="w-full flex items-center justify-between rounded-xl bg-white px-4 py-3 text-xs font-bold text-rose-600 shadow-sm transition-transform active:scale-[0.98]"
            >
              Request TL Change
              <ChevronRight size={16} />
            </button>
          ) : (
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-rose-700/60 uppercase mb-1.5 px-1">
                  Reason for Request
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Tell us why you want to change your TL..."
                  rows={3}
                  className="w-full rounded-xl bg-white border border-rose-200 px-4 py-3 text-sm text-vf-on-surface placeholder:text-rose-300 outline-none focus:ring-2 focus:ring-rose-500/20 transition resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowChangeRequest(false)}
                  className="flex-1 rounded-full bg-white px-4 py-3 text-xs font-bold text-vf-on-surface-variant transition-transform active:scale-[0.95]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestChange}
                  disabled={submitting || !reason.trim()}
                  className="flex-[2] flex items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-rose-200 transition-all disabled:opacity-50 active:scale-[0.95]"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={14} />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
