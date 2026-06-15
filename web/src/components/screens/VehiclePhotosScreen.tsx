'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Bike, Camera, Calendar, MapPin, CheckCircle2 } from 'lucide-react';
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

export default function VehiclePhotosScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const { rider } = useRiderProfile();

  // Use actual pickup photos from the rider profile if available (Point 4)
  const pickupPhotos = [
    { id: 'front', label: 'Front View', url: (rider as any)?.pickupPhotoFront },
    { id: 'rear', label: 'Rear View', url: (rider as any)?.pickupPhotoBack },
    { id: 'left', label: 'Left Side', url: (rider as any)?.pickupPhotoLeft },
    { id: 'right', label: 'Right Side', url: (rider as any)?.pickupPhotoRight },
    { id: 'with_vehicle', label: 'With Vehicle', url: (rider as any)?.pickupPhotoWithVehicle },
  ].filter((p) => p.url) || [
    {
      id: 1,
      label: 'Front View',
      url: 'https://images.unsplash.com/photo-1625043484550-df60256f6ea5?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 2,
      label: 'Rear View',
      url: 'https://images.unsplash.com/photo-1558981403-c5f9299327d6?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 3,
      label: 'Left Side',
      url: 'https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 4,
      label: 'Right Side',
      url: 'https://images.unsplash.com/photo-1558981806-ec527ecb4bc7?auto=format&fit=crop&w=400&q=80',
    },
  ];

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
        <h1 className="text-xl font-bold text-vf-on-surface">Vehicle Details</h1>
      </div>

      <div className="px-5 space-y-6">
        {/* Vehicle ID Card */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0053c1]">
              <Bike size={28} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-vf-outline uppercase tracking-wider">
                Registration Number
              </p>
              <h2 className="text-lg font-bold text-vf-on-surface">
                {rider?.assignedVehicle || 'KA-01-EE-1234'}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 size={12} className="text-green-500" />
                <span className="text-[11px] font-bold text-green-600">Assigned & Verified</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Info Grid */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3"
        >
          <div className="rounded-xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]">
            <Calendar size={16} className="text-vf-outline mb-2" />
            <p className="text-[10px] font-bold text-vf-outline uppercase">Pickup Date</p>
            <p className="text-xs font-bold text-vf-on-surface mt-0.5">12 Mar, 2024</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]">
            <MapPin size={16} className="text-vf-outline mb-2" />
            <p className="text-[10px] font-bold text-vf-outline uppercase">Pickup Hub</p>
            <p className="text-xs font-bold text-vf-on-surface mt-0.5">
              {rider?.pickupHub || 'South Delhi Hub'}
            </p>
          </div>
        </motion.div>

        {/* Pickup Photos Section */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <Camera size={16} className="text-vf-on-surface-variant" />
              <h3 className="text-sm font-bold text-vf-on-surface uppercase tracking-wider">
                Pickup Inspection Photos
              </h3>
            </div>
            <span className="text-[10px] font-bold text-[#0053c1]">
              {pickupPhotos.length} PHOTOS
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {pickupPhotos.map((photo, idx) => (
              <motion.div
                key={photo.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative aspect-[4/3] rounded-2xl overflow-hidden shadow-md border border-white"
              >
                <img
                  src={photo.url}
                  alt={photo.label}
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-2 left-3">
                  <p className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {photo.label}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="mt-6 text-center text-[11px] font-medium text-vf-on-surface-variant leading-relaxed px-4">
            These photos were taken during your vehicle pickup inspection on 12 Mar, 2024. They
            serve as a record of the vehicle&apos;s condition at the start of your rental.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
