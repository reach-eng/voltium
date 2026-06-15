'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Camera, Check, Battery } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useQueryClient } from '@tanstack/react-query';
import { useRiderProfile, useDashboard } from '@/hooks/useRiderData';

const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

const photoSlots = [
  { label: 'Front', key: 'front' },
  { label: 'Rear', key: 'rear' },
  { label: 'Left', key: 'left' },
  { label: 'Right', key: 'right' },
];

export default function EndRentalScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();
  const { rider } = useRiderProfile();

  const [photos, setPhotos] = useState<Record<string, boolean>>({});
  const [odometer, setOdometer] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const togglePhoto = (key: string) => {
    setPhotos((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allPhotosTaken = photoSlots.every((slot) => photos[slot.key]);

  const handleConfirmReturn = async () => {
    console.log(
      'handleConfirmReturn triggered. allPhotosTaken:',
      allPhotosTaken,
      'confirmed:',
      confirmed
    );
    if (!allPhotosTaken || !confirmed) return;

    try {
      console.log('Submitting return to API...');
      // Invalidate the profile and dashboard queries to ensure data is fresh
      queryClient.invalidateQueries({ queryKey: ['rider', 'profile', rider?.id] });
      queryClient.invalidateQueries({ queryKey: ['rider', 'dashboard', rider?.id] });

      // Simulate API call to submit return
      const response = await fetch(`/api/rider/profile?riderId=${rider?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-rider-id': rider?.id || '',
        },
        body: JSON.stringify({
          returnPending: true,
          odometer: parseInt(odometer),
          returnPhotos: Object.keys(photos),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Submission result:', result);

      setSubmitting(false);
      setSubmitted(true);

      showToast('Vehicle returned successfully! Waiting for approval.');
      setTimeout(() => setScreen('active_dashboard'), 2000);
    } catch (error) {
      console.error('Error submitting return:', error);
      showToast('Error submitting return. Please try again.');
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-vf-surface p-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
          <Check size={40} strokeWidth={3} />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-vf-on-surface">Request Submitted!</h2>
        <p className="text-vf-on-surface-variant">
          Your vehicle return request has been sent for approval.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vf-surface mesh-gradient pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => setScreen('rental_details')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <ArrowLeft size={18} className="text-vf-on-surface" />
        </button>
        <h1 className="text-xl font-bold text-vf-on-surface">End Rental</h1>
      </div>

      <div className="px-5 space-y-5">
        {/* Warning Card */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl border-2 border-red-200 bg-red-50 p-4 flex items-start gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle size={20} className="text-[#ba1a1a]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#ba1a1a]">Are you sure?</h3>
            <p className="mt-1 text-xs text-red-700/80 leading-relaxed">
              Returning your vehicle will end your current rental period. Make sure to complete all
              inspection steps.
            </p>
          </div>
        </motion.div>

        {/* Return Inspection Photos */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
          <h3 className="mb-3 text-sm font-bold text-vf-on-surface uppercase tracking-wider">
            Return Inspection
          </h3>
          <p className="mb-3 text-xs text-vf-on-surface-variant">
            Take return photos of your vehicle
          </p>
          <div className="grid grid-cols-2 gap-3">
            {photoSlots.map((slot) => {
              const taken = photos[slot.key];
              return (
                <button
                  key={slot.key}
                  id={`photo-slot-${slot.key}`}
                  onClick={() => togglePhoto(slot.key)}
                  className={`
                      relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 transition-all
                      ${
                        taken
                          ? 'border-green-300 bg-green-50'
                          : 'border-dashed border-vf-outline-variant bg-white hover:border-[#0053c1]'
                      }
                    `}
                >
                  {taken ? (
                    <>
                      <Check size={24} className="text-green-600" />
                      <span className="text-xs font-semibold text-green-700">{slot.label}</span>
                    </>
                  ) : (
                    <>
                      <Camera size={24} className="text-vf-on-surface-variant" />
                      <span className="text-xs font-semibold text-vf-on-surface-variant">
                        {slot.label}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Odometer Reading */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
        >
          <label className="text-xs font-semibold text-vf-on-surface-variant uppercase tracking-wider">
            Odometer Reading
          </label>
          <input
            type="number"
            id="odometer-input"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder="Enter current odometer reading"
            className="mt-2 w-full rounded-lg border border-vf-outline-variant bg-vf-surface-container-low px-4 py-3 text-sm font-semibold text-vf-on-surface placeholder:text-vf-outline outline-none focus:border-[#0053c1] focus:ring-2 focus:ring-[#0053c1]/20 transition"
          />
        </motion.div>

        {/* Battery Level */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
            <Battery size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-vf-on-surface-variant">Battery Level</p>
            <p className="text-sm font-bold text-vf-on-surface">Current battery: 72%</p>
          </div>
          <div className="ml-auto">
            <div className="h-2 w-20 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-green-500" style={{ width: '72%' }} />
            </div>
          </div>
        </motion.div>

        {/* Confirmation Checkbox */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
        >
          <button
            id="confirm-rental-checkbox"
            onClick={() => setConfirmed(!confirmed)}
            className={`
              flex h-5 w-5 shrink-0 mt-0.5 items-center justify-center rounded-md border-2 transition-colors
              ${confirmed ? 'bg-[#0053c1] border-[#0053c1]' : 'border-vf-outline-variant'}
            `}
          >
            {confirmed && <Check size={14} className="text-white" />}
          </button>
          <p className="text-xs text-vf-on-surface leading-relaxed">
            I confirm the vehicle is returned in good condition with all accessories intact.
          </p>
        </motion.div>

        {/* Confirm Return Button */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
          <button
            id="submit-return-button"
            onClick={handleConfirmReturn}
            disabled={!allPhotosTaken || !confirmed}
            className={`
              flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-bold transition-all
              ${
                allPhotosTaken && confirmed
                  ? 'bg-[#ba1a1a] text-white shadow-lg active:scale-[0.98]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Confirm Return
          </button>
          {!allPhotosTaken && (
            <p className="mt-2 text-center text-[11px] text-red-500">
              Please take all inspection photos to continue
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
