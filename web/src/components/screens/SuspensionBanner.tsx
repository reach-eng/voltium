'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  WifiOff,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore, type Screen } from '@/store/app';
import { getSuspensionReasons, getPendingCount, isOnline } from '@/lib/offline-store';
import type { SuspensionReason } from '@/lib/offline-store';

const severityConfig = {
  critical: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    subtext: 'text-red-600',
    icon: AlertCircle,
    iconColor: 'text-red-500',
    button: 'bg-red-600 hover:bg-red-700 text-white',
    badge: 'bg-red-100 text-red-700',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    subtext: 'text-amber-600',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
    badge: 'bg-amber-100 text-amber-700',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    subtext: 'text-blue-600',
    icon: Info,
    iconColor: 'text-blue-500',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    badge: 'bg-blue-100 text-blue-700',
  },
};

export default function SuspensionBanner() {
  const rider = useAppStore((s) => s.rider);
  const setScreen = useAppStore((s) => s.setScreen);
  const showToast = useAppStore((s) => s.showToast);
  const riderForCheck = {
    accountStatus: rider?.accountStatus || 'INACTIVE',
    walletBalance: rider?.walletBalance ?? 0,
    kycStatus: rider?.kycStatus || 'PENDING',
    depositStatus: rider?.depositStatus || 'PENDING',
    planStatus: rider?.planStatus || 'INACTIVE',
    rentalStatus: rider?.rentalStatus || 'NONE',
    securityDeposit: rider?.securityDeposit ?? 0,
  };
  const reasons = getSuspensionReasons(riderForCheck);
  const pendingCount = getPendingCount();
  const online = isOnline();
  const [expanded, setExpanded] = useState(false);

  if (reasons.length === 0 && online && pendingCount === 0) return null;

  // Sort by severity: critical first
  const sortedReasons = [...reasons].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const hasCritical = sortedReasons.some((r) => r.severity === 'critical');
  const topReason = sortedReasons[0];
  const remainingCount = sortedReasons.length - 1;

  // Auto-expand if there's only 1 reason or a critical issue
  const showCollapsed = sortedReasons.length > 1 && !hasCritical && !expanded;

  return (
    <div className="space-y-2">
      {/* Offline Banner */}
      <AnimatePresence>
        {!online && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3"
          >
            <WifiOff size={18} className="text-gray-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">You&apos;re Offline</p>
              <p className="text-xs text-gray-500">
                {pendingCount > 0
                  ? `${pendingCount} action${pendingCount > 1 ? 's' : ''} will sync when you reconnect`
                  : 'Data shown may be outdated'}
              </p>
            </div>
            {pendingCount > 0 && (
              <span className="shrink-0 rounded-full bg-gray-200 px-2.5 py-1 text-[10px] font-bold text-gray-700">
                {pendingCount}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Sync Banner (when online but has queued items) */}
      <AnimatePresence>
        {online && pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3"
          >
            <CheckCircle2 size={18} className="text-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800">Syncing...</p>
              <p className="text-xs text-green-600">
                {pendingCount} pending action{pendingCount > 1 ? 's' : ''} being uploaded
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Action Required Banner */}
      {sortedReasons.length > 0 && (
        <AnimatePresence mode="wait">
          {showCollapsed ? (
            /* Collapsed: single summary card */
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <button
                onClick={() => setExpanded(true)}
                className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all hover:shadow-sm ${severityConfig[topReason.severity].bg}`}
              >
                {(() => {
                  const Icon = severityConfig[topReason.severity].icon;
                  return (
                    <Icon
                      size={18}
                      className={`shrink-0 ${severityConfig[topReason.severity].iconColor}`}
                    />
                  );
                })()}
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm font-bold ${severityConfig[topReason.severity].text}`}>
                    Action Required
                  </p>
                  <p className={`text-xs ${severityConfig[topReason.severity].subtext}`}>
                    {topReason.title}
                    {remainingCount > 0 && ` + ${remainingCount} more`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${severityConfig[topReason.severity].badge}`}
                  >
                    {sortedReasons.length}
                  </span>
                  <ChevronDown size={16} className={severityConfig[topReason.severity].text} />
                </div>
              </button>
            </motion.div>
          ) : (
            /* Expanded: all reason cards */
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-2"
            >
              {/* Collapse button (only when manually expanded) */}
              {sortedReasons.length > 1 && expanded && (
                <button
                  onClick={() => setExpanded(false)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors ml-1"
                >
                  <ChevronUp size={14} />
                  Collapse {sortedReasons.length} alerts
                </button>
              )}
              {sortedReasons.map((reason) => (
                <ReasonCard
                  key={reason.code}
                  reason={reason}
                  onAction={() => {
                    if (reason.actionAvailable) {
                      setScreen(reason.actionScreen as Screen);
                    } else {
                      showToast(reason.description);
                    }
                  }}
                  onDismiss={() => showToast('Please resolve this issue to continue')}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function ReasonCard({
  reason,
  onAction,
  onDismiss,
}: {
  reason: SuspensionReason;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const config = severityConfig[reason.severity];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`relative overflow-hidden rounded-xl border ${config.bg}`}
    >
      {/* Animated pulse background for critical */}
      {reason.severity === 'critical' && (
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background: 'radial-gradient(circle at 20% 50%, currentColor, transparent 70%)',
            color: 'rgb(239 68 68)',
          }}
        />
      )}

      <div className="relative flex items-start gap-3 p-4">
        <div className={`mt-0.5 shrink-0 ${config.iconColor}`}>
          <Icon size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-bold ${config.text}`}>{reason.title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${config.badge}`}
            >
              {reason.severity}
            </span>
          </div>
          <p className={`mt-1 text-xs leading-relaxed ${config.subtext}`}>{reason.description}</p>

          {reason.actionAvailable && (
            <button
              onClick={onAction}
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all active:scale-[0.97] ${config.button}`}
            >
              {reason.actionLabel}
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="shrink-0 rounded-full p-1 opacity-50 hover:opacity-100 transition-opacity"
        >
          <X size={14} className={config.text} />
        </button>
      </div>
    </motion.div>
  );
}
