'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Circle, Camera, User, ArrowRight, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/store/app';

function ProgressStepper() {
  const steps = [
    { label: 'Details', status: 'completed' as const },
    { label: 'Inspection', status: 'current' as const },
    { label: 'Confirm', status: 'pending' as const },
  ];

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {step.status === 'completed' ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#16a34a]">
                <Check size={12} className="text-white" strokeWidth={3} />
              </div>
            ) : step.status === 'current' ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0053c1]">
                <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
              </div>
            ) : (
              <Circle size={20} className="text-[#e0e3e5]" fill="#e0e3e5" />
            )}
            <span
              className={`text-xs font-medium ${
                step.status === 'completed'
                  ? 'text-[#16a34a]'
                  : step.status === 'current'
                    ? 'text-[#0053c1]'
                    : 'text-[#424653]'
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

interface InspectionPhoto {
  id: string;
  label: string;
  sublabel: string;
  captured: boolean;
}

export default function PickupInspectionScreen() {
  const [photos, setPhotos] = useState<InspectionPhoto[]>([
    { id: 'front', label: 'Front View', sublabel: 'Take photo of front', captured: false },
    { id: 'rear', label: 'Rear View', sublabel: 'Take photo of rear', captured: false },
    { id: 'left', label: 'Left Side', sublabel: 'Take photo of left side', captured: false },
    { id: 'right', label: 'Right Side', sublabel: 'Take photo of right side', captured: false },
  ]);
  const [selfieCaptured, setSelfieCaptured] = useState(false);
  const [capturingId, setCapturingId] = useState<string | null>(null);

  const setScreen = useAppStore((s) => s.setScreen);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapturePhoto = (id: string) => {
    setCapturingId(id);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // reset so same file can trigger change
      fileInputRef.current.click();

      // Fallback: clear capturingId if no file selected after 30s
      setTimeout(() => {
        setCapturingId((id) => (id ? null : null));
      }, 30000);
    } else {
      setTimeout(() => finishCapture(id), 800);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && capturingId) {
      setTimeout(() => finishCapture(capturingId), 800);
    } else {
      setCapturingId(null);
    }
  };

  const finishCapture = (id: string, file?: File) => {
    // In a real app, we'd upload here. For now, we use a consistent mock or data URL.
    const mockUrl = `https://images.unsplash.com/photo-${id === 'selfie' ? '1534528741775-53994a69daeb' : '1558981403-c5f9299327d6'}?auto=format&fit=crop&w=400&q=80`;

    if (id === 'selfie') {
      setSelfieCaptured(true);
      useAppStore.getState().setRider({
        riderPhoto: mockUrl,
        pickupPhotoWithVehicle: mockUrl,
      });
    } else {
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, captured: true } : p)));

      const fieldMap: Record<string, string> = {
        front: 'pickupPhotoFront',
        rear: 'pickupPhotoBack',
        left: 'pickupPhotoLeft',
        right: 'pickupPhotoRight',
      };

      const field = fieldMap[id];
      if (field) {
        useAppStore.getState().setRider({ [field]: mockUrl });
      }

      // Keep pickupPhoto for legacy compatibility (using front photo as main)
      if (id === 'front') {
        useAppStore.getState().setRider({ pickupPhotoFront: mockUrl });
      }
    }
    setCapturingId(null);
  };

  const allCaptured = photos.every((p) => p.captured) && selfieCaptured;

  return (
    <div className="min-h-screen bg-[#f7f9fb] px-4 pt-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-[1.75rem] font-black text-[#191c1e] leading-tight">
          Vehicle Inspection.
        </h1>
        <p className="text-[#424653] mt-1 text-sm">Capture photos of the vehicle from all angles</p>
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

      {/* Hidden File Input for actual photo/camera */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {/* Photo Inspection Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-6"
      >
        <h3 className="text-xs font-semibold text-[#191c1e] mb-3">4-Point Inspection</h3>
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo, index) => (
            <motion.button
              key={photo.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.25 + index * 0.08 }}
              onClick={() => handleCapturePhoto(photo.id)}
              disabled={capturingId !== null}
              className={`relative flex flex-col items-center justify-center gap-2 rounded-xl p-4 transition-all duration-200 min-h-[130px] ${
                photo.captured
                  ? 'border-2 border-[#16a34a] bg-green-50/60'
                  : 'border-2 border-dashed border-[#e0e3e5] bg-white hover:border-[#0053c1]/40 active:scale-[0.97]'
              }`}
            >
              {photo.captured ? (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16a34a]/10"
                  >
                    <CheckCircle2 size={22} className="text-[#16a34a]" />
                  </motion.div>
                  <span className="text-xs font-semibold text-[#16a34a]">{photo.label}</span>
                  <span className="text-[10px] text-[#16a34a]/70">Captured</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotos((prev) =>
                        prev.map((p) => (p.id === photo.id ? { ...p, captured: false } : p))
                      );
                    }}
                    className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm"
                  >
                    <RotateCcw size={10} className="text-[#424653]" />
                  </button>
                </>
              ) : (
                <>
                  {capturingId === photo.id ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    >
                      <Camera size={24} className="text-[#0053c1]" />
                    </motion.div>
                  ) : (
                    <Camera size={24} className="text-[#424653]/50" />
                  )}
                  <span className="text-xs font-semibold text-[#191c1e]">{photo.label}</span>
                  <span className="text-[10px] text-[#424653]">{photo.sublabel}</span>
                </>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Selfie Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-6"
      >
        <h3 className="text-xs font-semibold text-[#191c1e] mb-3">Identity Verification</h3>
        <motion.button
          onClick={() => handleCapturePhoto('selfie')}
          disabled={capturingId !== null}
          className={`relative flex w-full flex-col items-center justify-center gap-3 rounded-xl p-6 transition-all duration-200 min-h-[140px] ${
            selfieCaptured
              ? 'border-2 border-[#16a34a] bg-green-50/60'
              : 'border-2 border-dashed border-[#e0e3e5] bg-white hover:border-[#0053c1]/40 active:scale-[0.99]'
          }`}
        >
          {selfieCaptured ? (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#16a34a]/10"
              >
                <CheckCircle2 size={26} className="text-[#16a34a]" />
              </motion.div>
              <div className="text-center">
                <span className="text-sm font-semibold text-[#16a34a] block">Selfie Captured</span>
                <span className="text-xs text-[#16a34a]/70">Taken with vehicle</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelfieCaptured(false);
                }}
                className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm"
              >
                <RotateCcw size={12} className="text-[#424653]" />
              </button>
            </>
          ) : (
            <>
              {capturingId === 'selfie' ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                >
                  <User size={30} className="text-[#0053c1]" />
                </motion.div>
              ) : (
                <User size={30} className="text-[#424653]/50" />
              )}
              <div className="text-center">
                <span className="text-sm font-semibold text-[#191c1e] block">
                  Take a selfie with the vehicle
                </span>
                <span className="text-xs text-[#424653]">
                  Ensure both you and the vehicle are visible
                </span>
              </div>
            </>
          )}
        </motion.button>
      </motion.div>

      {/* Progress indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-5 flex items-center justify-center gap-2"
      >
        <div className="h-1.5 flex-1 max-w-[200px] rounded-full bg-[#e0e3e5] overflow-hidden">
          <motion.div
            animate={{
              width: `${((photos.filter((p) => p.captured).length + (selfieCaptured ? 1 : 0)) / 5) * 100}%`,
            }}
            transition={{ duration: 0.5 }}
            className="h-full rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde]"
          />
        </div>
        <span className="text-[10px] font-medium text-[#424653]">
          {photos.filter((p) => p.captured).length + (selfieCaptured ? 1 : 0)}/5
        </span>
      </motion.div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.9 }}
        className="mt-6"
      >
        <button
          onClick={() => setScreen('pickup_confirm')}
          disabled={!allCaptured}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0053c1]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#0053c1]/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Proceed to Confirm
          <ArrowRight size={16} />
        </button>
        {!allCaptured && (
          <p className="text-center text-[10px] text-[#424653] mt-2">
            Please capture all photos to continue
          </p>
        )}
      </motion.div>
    </div>
  );
}
