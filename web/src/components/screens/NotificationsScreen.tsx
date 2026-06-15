'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Bell,
  Tag,
  AlertTriangle,
  CheckCheck,
  Info,
  AlertCircle,
  Gift,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { useNotifications } from '@/hooks/useRiderData';
import RiderSelector from './RiderSelector';
import { Skeleton } from '@/components/ui/skeleton';

const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

type NotifType = 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'SOS' | 'SYSTEM' | 'VEHICLE';

const iconMap: Record<string, typeof Info> = {
  INFO: ShieldCheck,
  ALERT: AlertTriangle,
  PROMOTION: Gift,
  PAYMENT: CreditCard,
  SOS: AlertCircle,
  SYSTEM: Info,
  VEHICLE: Tag,
};

const typeColorMap: Record<string, string> = {
  INFO: 'bg-blue-50 text-[#0053c1]',
  ALERT: 'bg-amber-50 text-amber-600',
  PROMOTION: 'bg-purple-50 text-purple-600',
  PAYMENT: 'bg-green-50 text-green-600',
  SOS: 'bg-red-50 text-red-600',
  SYSTEM: 'bg-gray-50 text-gray-600',
  VEHICLE: 'bg-indigo-50 text-indigo-600',
};

const badgeColorMap: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-700',
  ALERT: 'bg-amber-100 text-amber-700',
  PROMOTION: 'bg-purple-100 text-purple-700',
  PAYMENT: 'bg-green-100 text-green-700',
  SOS: 'bg-red-100 text-red-700',
  SYSTEM: 'bg-gray-100 text-gray-700',
  VEHICLE: 'bg-indigo-100 text-indigo-700',
};

const dotColorMap: Record<string, string> = {
  INFO: 'bg-[#0053c1]',
  ALERT: 'bg-amber-500',
  PROMOTION: 'bg-purple-500',
  PAYMENT: 'bg-green-500',
  SOS: 'bg-red-500',
  SYSTEM: 'bg-gray-500',
  VEHICLE: 'bg-indigo-500',
};

function formatTimeAgo(dateStr: string): string {
  try {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

export default function NotificationsScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const { riderId } = useRiderSession();
  const { notifications, loading, markAllRead } = useNotifications();

  if (!riderId) {
    return (
      <div className="min-h-screen bg-vf-surface flex flex-col items-center justify-center p-6">
        <Bell className="w-16 h-16 text-primary/30 mb-4" />
        <h2 className="text-lg font-bold text-vf-on-surface mb-2">Select a Rider</h2>
        <p className="text-sm text-vf-on-surface-variant text-center max-w-xs mb-6">
          Choose a rider profile to view the app from their perspective.
        </p>
        <RiderSelector />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-vf-surface pb-10">
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <div className="px-5 space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vf-surface mesh-gradient pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScreen('active_dashboard')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ArrowLeft size={18} className="text-vf-on-surface" />
          </button>
          <h1 className="text-xl font-bold text-vf-on-surface">Notifications</h1>
        </div>
        <button
          onClick={() => markAllRead()}
          className="flex items-center gap-1.5 rounded-full bg-vf-surface-container-low px-3 py-1.5 text-[11px] font-semibold text-[#0053c1] transition-colors hover:bg-blue-50"
        >
          <CheckCheck size={14} />
          Mark all as read
        </button>
      </div>

      <div className="px-5 space-y-2">
        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <Zap className="w-12 h-12 text-vf-outline mb-3" />
            <p className="text-sm font-semibold text-vf-on-surface-variant">No notifications</p>
            <p className="mt-1 text-xs text-vf-outline">You&apos;re all caught up!</p>
          </div>
        )}
        {notifications.map((notif, idx) => {
          const notifType = (notif.type || 'INFO') as NotifType;
          const Icon = iconMap[notifType] || Info;
          return (
            <motion.div
              key={notif.id}
              custom={idx}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className={`flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] transition-all ${!notif.isRead ? 'border-l-4 border-l-[#0053c1]' : ''}`}
            >
              <div
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeColorMap[notifType] || typeColorMap.INFO}`}
              >
                <Icon size={18} />
                {!notif.isRead && (
                  <span
                    className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${dotColorMap[notifType] || dotColorMap.INFO} border-2 border-white`}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-sm ${!notif.isRead ? 'font-bold' : 'font-semibold'} text-vf-on-surface`}
                  >
                    {notif.title}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${badgeColorMap[notifType] || badgeColorMap.INFO}`}
                  >
                    {notifType}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-vf-on-surface-variant leading-relaxed">
                  {notif.message}
                </p>
                <p className="mt-1 text-[10px] text-vf-outline">{formatTimeAgo(notif.createdAt)}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
