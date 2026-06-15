'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  MapPin,
  Camera,
  Mic,
  Bell,
  Check,
  ChevronRight,
  AlertCircle,
  History,
  Phone,
  Users,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/store/app';

const REQUIRED_IDS = ['location', 'battery', 'contacts'];

interface PermissionItem {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'PROMPT' | 'GRANTED' | 'DENIED' | 'LOADING';
}

export default function PermissionScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const showToast = useAppStore((s) => s.showToast);

  const [permissions, setPermissions] = useState<PermissionItem[]>([
    {
      id: 'location',
      name: 'Location Access',
      description: 'Needed for vehicle tracking and emergency SOS features.',
      icon: <MapPin className="w-5 h-5" />,
      status: 'PROMPT',
    },
    {
      id: 'battery',
      name: 'Battery Optimization',
      description: 'Allow app to run in background for consistent telemetry.',
      icon: <Zap className="w-5 h-5" />,
      status: 'PROMPT',
    },
    {
      id: 'contacts',
      name: 'Contacts Access',
      description: 'Required for referral features and emergency contacts.',
      icon: <Users className="w-5 h-5" />,
      status: 'PROMPT',
    },
    {
      id: 'call_log',
      name: 'Call Register',
      description: 'Access call logs for automated support validation.',
      icon: <History className="w-5 h-5" />,
      status: 'PROMPT',
    },
    {
      id: 'phone',
      name: 'Phone Access',
      description: 'Make direct calls to support and emergency services.',
      icon: <Phone className="w-5 h-5" />,
      status: 'PROMPT',
    },
    {
      id: 'mic',
      name: 'Microphone Access',
      description: 'Used for voice notes in support tickets and SOS.',
      icon: <Mic className="w-5 h-5" />,
      status: 'PROMPT',
    },
    {
      id: 'camera',
      name: 'Camera Access',
      description: 'Required for KYC document uploads and vehicle inspection.',
      icon: <Camera className="w-5 h-5" />,
      status: 'PROMPT',
    },
    {
      id: 'notifications',
      name: 'Push Notifications',
      description: 'Stay updated on rental expiry, low balance, and offers.',
      icon: <Bell className="w-5 h-5" />,
      status: 'PROMPT',
    },
  ]);

  const requestPermission = async (id: string) => {
    const updated = [...permissions];
    const index = updated.findIndex((p) => p.id === id);
    if (index === -1) return;

    updated[index].status = 'LOADING';
    setPermissions(updated);

    try {
      if (id === 'location') {
        const result = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        if (result) {
          updated[index].status = 'GRANTED';
        }
      } else if (id === 'camera') {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((track) => track.stop());
        updated[index].status = 'GRANTED';
      } else if (id === 'mic') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        updated[index].status = 'GRANTED';
      } else if (id === 'notifications') {
        const status = await Notification.requestPermission();
        updated[index].status = status === 'granted' ? 'GRANTED' : 'DENIED';
      } else {
        // Mock success for other mobile-only permissions on web
        await new Promise((r) => setTimeout(r, 800));
        updated[index].status = 'GRANTED';
      }
    } catch (err: any) {
      updated[index].status = 'DENIED';
      showToast(`Permission denied for ${id}`);
    } finally {
      setPermissions([...updated]);
    }
  };

  const handleContinue = () => {
    setScreen('legal');
  };

  const allGranted = permissions.every((p) => p.status === 'GRANTED');
  const requiredGranted = REQUIRED_IDS.every(
    (id) => permissions.find((p) => p.id === id)?.status === 'GRANTED'
  );

  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#f7f9fb] mesh-gradient relative overflow-hidden px-5 pt-12 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center mx-auto mb-6 rotate-3">
          <Shield className="w-8 h-8 text-[#0053c1] -rotate-3" />
        </div>
        <h1 className="text-2xl font-black text-[#191c1e] tracking-tight">App Permissions</h1>
        <p className="text-sm text-[#424653] mt-2 max-w-[280px] mx-auto leading-relaxed">
          Voltium requires certain permissions to provide a secure and seamless experience.
        </p>
      </motion.div>

      {/* Permission List */}
      <div className="space-y-4 flex-1">
        {permissions.map((perm, idx) => {
          const isRequired = REQUIRED_IDS.includes(perm.id);
          return (
            <motion.div
              key={perm.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + idx * 0.1 }}
              className={`
                relative p-5 rounded-2xl bg-white border shadow-[0px_24px_48px_rgba(15,23,42,0.04)]
                ${perm.status === 'GRANTED' ? 'border-emerald-500/20 bg-emerald-50/10' : 'border-transparent'}
              `}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`
                  w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                  ${perm.status === 'GRANTED' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}
                `}
                >
                  {perm.status === 'GRANTED' ? <Check className="w-5 h-5" /> : perm.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-[#191c1e]">{perm.name}</h3>
                    {isRequired && (
                      <span className="text-[9px] font-black text-primary-vibrant uppercase tracking-tight bg-primary-vibrant/5 px-2 py-0.5 rounded-full border border-primary-vibrant/10">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#424653] leading-relaxed opacity-70 pr-12">
                    {perm.description}
                  </p>
                </div>

                <button
                  onClick={() => perm.status !== 'GRANTED' && requestPermission(perm.id)}
                  disabled={perm.status === 'GRANTED' || perm.status === 'LOADING'}
                  className={`
                    absolute top-1/2 -translate-y-1/2 right-4 h-9 px-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all
                    ${
                      perm.status === 'GRANTED'
                        ? 'bg-emerald-500 text-white cursor-default'
                        : perm.status === 'LOADING'
                          ? 'bg-slate-100 text-slate-400'
                          : 'bg-[#0053c1] text-white active:scale-95 shadow-lg shadow-blue-200'
                    }
                  `}
                >
                  {perm.status === 'GRANTED'
                    ? 'Allowed'
                    : perm.status === 'LOADING'
                      ? 'Wait...'
                      : 'Allow'}
                </button>
              </div>
            </motion.div>
          );
        })}

        {!allGranted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-2 pt-2"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
              Some permissions are optional but recommended
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 pt-4"
      >
        <button
          onClick={handleContinue}
          disabled={!requiredGranted}
          className={`w-full h-14 rounded-full text-white font-black text-sm uppercase tracking-[0.15em] shadow-xl flex items-center justify-center gap-2 group transition-all active:scale-95 ${
            requiredGranted
              ? 'bg-gradient-to-r from-[#0053c1] to-[#2f6dde] shadow-blue-200'
              : 'bg-slate-400 cursor-not-allowed opacity-60 shadow-none'
          }`}
        >
          {requiredGranted
            ? allGranted
              ? 'Get Started'
              : 'Continue'
            : 'Grant Required Permissions'}
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
        <p className="text-[10px] text-slate-400 text-center mt-4 uppercase tracking-[0.1em] font-bold">
          Required permissions ensure system reliability
        </p>
      </motion.div>
    </main>
  );
}
