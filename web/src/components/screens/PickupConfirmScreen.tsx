'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Circle,
  Bike,
  MapPin,
  UserCircle,
  Camera,
  Eraser,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { useAppStore } from '@/store/app';

function ProgressStepper() {
  const steps = [
    { label: 'Details', status: 'completed' as const },
    { label: 'Inspection', status: 'completed' as const },
    { label: 'Confirm', status: 'current' as const },
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
          {i < steps.length - 1 && <div className="h-px w-6 bg-[#16a34a]" />}
        </div>
      ))}
    </div>
  );
}

function SignaturePad({ onSigned }: { onSigned: (signed: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent && !hasSigned) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
  }, [hasSigned]);

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#191c1e';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSigned(true);
    onSigned(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearPad = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
    onSigned(false);
  };

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-[#e0e3e5] bg-white overflow-hidden h-[140px]">
        <canvas
          ref={canvasRef}
          width={340}
          height={140}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={(e) => {
            e.preventDefault();
            startDrawing(e);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            draw(e);
          }}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
        />
        {!hasSigned && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-[#424653]/40 font-medium">Sign here</span>
          </div>
        )}
      </div>
      {hasSigned && (
        <motion.button
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={clearPad}
          className="mt-2 flex items-center gap-1 text-xs text-[#424653] hover:text-[#191c1e] transition-colors"
        >
          <Eraser size={12} />
          Clear Pad
        </motion.button>
      )}
    </div>
  );
}

import { usePickupCompletion } from '@/hooks/useRiderData';

export default function PickupConfirmScreen() {
  const [signed, setSigned] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [vehiclePhotoTaken, setVehiclePhotoTaken] = useState(false);
  const [selectedTL, setSelectedTL] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState<any>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(false);

  const setScreen = useAppStore((s) => s.setScreen);
  const { completePickup, isCompleting } = usePickupCompletion();
  const rider = useAppStore((s) => s.rider);

  const MOCK_TEAM_LEADERS = [
    { id: 'TL001', name: 'Marcus Chen' },
    { id: 'TL002', name: 'Sarah Rahman' },
    { id: 'TL003', name: 'Vivek Sharma' },
  ];

  const selectedTLName = MOCK_TEAM_LEADERS.find((tl) => tl.id === selectedTL)?.name || '';

  React.useEffect(() => {
    if (rider.emergencyContact) {
      setEmergencyContact(rider.emergencyContact);
    }
  }, [rider.emergencyContact]);

  React.useEffect(() => {
    async function loadVehicleDetails() {
      if (!rider.assignedVehicle) return;
      setLoadingVehicle(true);
      try {
        const hubId = rider.pickupHubId || '';
        const url = `/api/rider/sync/pickup/vehicle?query=${encodeURIComponent(rider.assignedVehicle)}&hubId=${encodeURIComponent(hubId)}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.success && json.data) {
          setVehicleDetails(json.data);
        }
      } catch (err) {
        console.error('Error fetching vehicle details for confirmation:', err);
      } finally {
        setLoadingVehicle(false);
      }
    }
    loadVehicleDetails();
  }, [rider.assignedVehicle, rider.pickupHubId]);

  const handleComplete = async () => {
    if (!('geolocation' in navigator)) {
      alert('Location verification is required to complete pickup.');
      return;
    }

    // Simulate location validation (Rider must be at Hub)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await completePickup({
            vehicleId: rider.pickupVehicleId || rider.assignedVehicle || undefined,
            hubId: rider.pickupHubId || undefined,
            teamLeader: selectedTLName || undefined,
            emergencyContact: emergencyContact || undefined,
            pickupPhotoFront: rider.pickupPhotoFront || null,
            pickupPhotoBack: rider.pickupPhotoBack || null,
            pickupPhotoLeft: rider.pickupPhotoLeft || null,
            pickupPhotoRight: rider.pickupPhotoRight || null,
            pickupPhotoWithVehicle: rider.pickupPhotoWithVehicle || null,
          });
          setScreen('pickup_success');
        } catch (err) {
          console.error('Pickup completion failed:', err);
        }
      },
      (err) => {
        alert('Please enable location access to verify you are at the pickup hub.');
      },
      { maximumAge: 60000, timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleTakeVehiclePhoto = () => {
    setVehiclePhotoTaken(true);
  };

  const canComplete = signed && confirmed && selectedTL !== '' && emergencyContact.length >= 10;

  return (
    <div className="min-h-screen bg-[#f7f9fb] px-4 pt-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-[1.75rem] font-black text-[#191c1e] leading-tight">
          Review &amp; Sign.
        </h1>
        <p className="text-[#424653] mt-1 text-sm">Verify all details and sign to confirm pickup</p>
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

      {/* Vehicle Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-6 rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] border border-[#e0e3e5]"
      >
        <h3 className="text-xs font-semibold text-[#424653] mb-3 uppercase tracking-wider">
          Vehicle Summary
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0053c1]/10 text-[#0053c1]">
            <Bike size={22} />
          </div>
          <div>
            <h4 className="font-bold text-[#191c1e]">
              {rider.assignedVehicle || 'No Vehicle Assigned'}
            </h4>
            <p className="text-xs text-[#424653]">
              {loadingVehicle
                ? 'Loading vehicle details...'
                : vehicleDetails
                  ? `${vehicleDetails.model} • Battery: ${vehicleDetails.batteryLevel}%`
                  : 'Ryd Electric Scooter'}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 rounded-lg bg-[#f2f4f6] p-3">
            <MapPin size={14} className="text-[#424653]" />
            <div>
              <p className="text-[10px] text-[#424653]">Hub</p>
              <p className="text-xs font-semibold text-[#191c1e]">
                {rider.pickupHub || 'No Hub Selected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-[#f2f4f6] p-3">
            <UserCircle size={14} className="text-[#424653]" />
            <div className="flex-1">
              <p className="text-[10px] text-[#424653]">Handing Over Team Leader</p>
              <select
                value={selectedTL}
                onChange={(e) => setSelectedTL(e.target.value)}
                className="mt-0.5 block w-full bg-transparent text-xs font-semibold text-[#191c1e] outline-none border-b border-[#e0e3e5] pb-1 cursor-pointer focus:border-[#0053c1]"
              >
                <option value="" disabled>
                  Select Team Leader
                </option>
                {MOCK_TEAM_LEADERS.map((tl) => (
                  <option key={tl.id} value={tl.id}>
                    {tl.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Digital Signature Pad */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="mt-5"
      >
        <h3 className="text-xs font-semibold text-[#191c1e] mb-2">Digital Signature</h3>
        <SignaturePad onSigned={setSigned} />
      </motion.div>

      {/* Vehicle Photo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
        className="mt-5"
      >
        <h3 className="text-xs font-semibold text-[#191c1e] mb-2">Vehicle Photo</h3>
        {vehiclePhotoTaken ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-3 rounded-xl border-2 border-[#16a34a] bg-green-50/60 p-4"
          >
            <Check size={20} className="text-[#16a34a]" />
            <div>
              <p className="text-sm font-semibold text-[#16a34a]">Photo Taken</p>
              <p className="text-xs text-[#16a34a]/70">Sitting on the vehicle</p>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={handleTakeVehiclePhoto}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#e0e3e5] bg-white p-6 transition-all hover:border-[#0053c1]/40 active:scale-[0.99]"
          >
            <Camera size={24} className="text-[#424653]/50" />
            <div className="text-center">
              <span className="text-sm font-semibold text-[#191c1e] block">
                Take a photo sitting on the vehicle
              </span>
              <span className="text-xs text-[#424653]">Tap to capture</span>
            </div>
          </button>
        )}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="mt-5"
      >
        <h3 className="text-xs font-semibold text-[#191c1e] mb-2">Emergency Contact</h3>
        <div className="rounded-xl bg-white p-4 border border-[#e0e3e5] shadow-[0px_24px_48px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] text-[#424653] mb-1.5 font-medium">Mobile Number</p>
          <input
            type="tel"
            placeholder="Enter 10-digit number"
            value={emergencyContact}
            onChange={(e) => setEmergencyContact(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="w-full text-sm font-bold text-[#191c1e] outline-none border-b border-[#e0e3e5] pb-1 focus:border-[#0053c1] transition-colors"
          />
        </div>
      </motion.div>
      {/* Checkbox Confirmation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.55 }}
        className="mt-5"
      >
        <label
          onClick={() => setConfirmed(!confirmed)}
          className="flex items-start gap-3 cursor-pointer rounded-xl bg-white p-4 border border-[#e0e3e5] shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
        >
          <div
            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
              confirmed ? 'border-[#0053c1] bg-[#0053c1]' : 'border-[#e0e3e5] bg-white'
            }`}
          >
            {confirmed && <Check size={12} className="text-white" strokeWidth={3} />}
          </div>
          <span className="text-xs text-[#424653] leading-relaxed">
            I confirm the vehicle is in good condition and I have inspected all parts. I agree to
            the terms and conditions of the rental agreement and accept responsibility for the
            vehicle during the rental period.
          </span>
        </label>
      </motion.div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.65 }}
        className="mt-8"
      >
        <button
          onClick={handleComplete}
          disabled={!canComplete || isCompleting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0053c1]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#0053c1]/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCompleting ? <Zap size={16} className="animate-spin" /> : <Zap size={16} />}
          {isCompleting ? 'Processing...' : 'Complete Pickup & Start Riding'}
          <ArrowRight size={16} />
        </button>
        {!canComplete && (
          <p className="text-center text-[10px] text-[#424653] mt-2">
            Please sign and confirm to continue
          </p>
        )}
      </motion.div>
    </div>
  );
}
