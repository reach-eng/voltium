'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Circle,
  QrCode,
  Bike,
  Battery,
  Palette,
  ArrowRight,
  ScanLine,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/store/app';

function ProgressStepper() {
  const steps = [
    { label: 'Hub Selection', status: 'completed' as const },
    { label: 'Vehicle Entry', status: 'current' as const },
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

export default function PickupVehicleScreen() {
  const [vehicleId, setVehicleId] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<any>(null);

  const setScreen = useAppStore((s) => s.setScreen);
  const setRider = useAppStore((s) => s.setRider);
  const rider = useAppStore((s) => s.rider);
  const showToast = useAppStore((s) => s.showToast);

  const handleVerify = async (queryVal?: string) => {
    const targetQuery = queryVal || vehicleId;
    if (!targetQuery.trim()) {
      showToast('Please enter a vehicle ID or number');
      return;
    }
    setLoading(true);
    setError(null);
    setShowDetails(false);
    try {
      const hubId = rider.pickupHubId || '';
      const url = `/api/rider/sync/pickup/vehicle?query=${encodeURIComponent(targetQuery.trim())}&hubId=${encodeURIComponent(hubId)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify vehicle');
      }

      if (data.success && data.data) {
        if (data.data.status !== 'AVAILABLE') {
          throw new Error(
            `Vehicle ${targetQuery} is currently ${data.data.status.toLowerCase().replace('_', ' ')}`
          );
        }
        setVehicle(data.data);
        setShowDetails(true);
        showToast('Vehicle verified successfully!');
      } else {
        throw new Error('Vehicle verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Vehicle not found or unavailable');
      showToast(err.message || 'Vehicle not found or unavailable');
    } finally {
      setLoading(false);
    }
  };

  const handleScanQR = () => {
    setScanning(true);
    setError(null);
    setShowDetails(false);
    // Simulate QR scan
    setTimeout(() => {
      const scannedId = 'VEM00188';
      setVehicleId(scannedId);
      setScanning(false);
      handleVerify(scannedId);
    }, 1200);
  };

  const handleProceed = () => {
    if (!vehicle) return;
    setRider({
      pickupVehicleId: vehicle.id,
      assignedVehicle: vehicle.vehicleNumber || vehicle.vehicleId,
    });
    setScreen('pickup_inspection');
  };

  const handleInputChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setVehicleId(clean);
    setError(null);
    setShowDetails(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] px-4 pt-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-[1.75rem] font-black text-[#191c1e] leading-tight">
          Vehicle Assignment.
        </h1>
        <p className="text-[#424653] mt-1 text-sm">Enter or scan the vehicle ID to begin</p>
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

      {/* Vehicle ID Input & Verify */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-6 space-y-3"
      >
        <label className="text-xs font-semibold text-[#191c1e] block">Vehicle ID / Number</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={vehicleId}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="e.g. VEM00188 or VF-VH-008"
            className="flex-1 rounded-xl border border-[#e0e3e5] bg-white px-4 py-3 text-sm font-mono font-bold text-[#191c1e] placeholder:text-[#424653]/40 placeholder:font-normal focus:border-[#0053c1] focus:outline-none focus:ring-2 focus:ring-[#0053c1]/10 transition-all tracking-wider"
          />
          <button
            onClick={() => handleVerify()}
            disabled={loading || !vehicleId}
            className="rounded-xl bg-[#0053c1] px-5 py-3 text-xs font-bold text-white shadow-md shadow-[#0053c1]/10 hover:bg-[#0053c1]/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center min-w-[80px]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
            {error}
          </p>
        )}
      </motion.div>

      {/* Scan QR Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mt-4"
      >
        <button
          onClick={handleScanQR}
          disabled={scanning}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#e0e3e5] bg-white px-4 py-3 text-sm font-medium text-[#424653] transition-all duration-200 hover:border-[#0053c1]/40 hover:text-[#0053c1] active:scale-[0.99] disabled:opacity-60"
        >
          {scanning ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <ScanLine size={18} />
              </motion.div>
              Scanning...
            </>
          ) : (
            <>
              <QrCode size={18} />
              Scan QR Code
            </>
          )}
        </button>
      </motion.div>

      {/* Vehicle Details Card */}
      <AnimatePresence>
        {showDetails && vehicle && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
            className="mt-6 rounded-xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] border border-[#e0e3e5]"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0053c1]/10 text-[#0053c1]">
                <Bike size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[#191c1e]">
                  {vehicle.vehicleNumber || vehicle.vehicleId}
                </h3>
                <p className="text-xs text-[#424653]">{vehicle.model || 'Ryd Electric Scooter'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-[#f2f4f6] p-3">
                <Battery size={16} className="text-[#16a34a]" />
                <div>
                  <p className="text-[10px] text-[#424653]">Battery</p>
                  <p className="text-sm font-bold text-[#191c1e]">{vehicle.batteryLevel}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[#f2f4f6] p-3">
                <Palette size={16} className="text-[#0053c1]" />
                <div>
                  <p className="text-[10px] text-[#424653]">Color</p>
                  <p className="text-sm font-bold text-[#191c1e]">
                    {vehicle.color || 'Matte Black'}
                  </p>
                </div>
              </div>
            </div>

            {/* Battery bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-[#424653] mb-1">
                <span>Charge Level</span>
                <span className="font-semibold">{vehicle.batteryLevel}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#e0e3e5] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${vehicle.batteryLevel}%` }}
                  transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-[#16a34a] to-[#22c55e]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="mt-8"
      >
        <button
          onClick={handleProceed}
          disabled={!showDetails}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0053c1]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#0053c1]/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Proceed to Inspection
          <ArrowRight size={16} />
        </button>
      </motion.div>
    </div>
  );
}
