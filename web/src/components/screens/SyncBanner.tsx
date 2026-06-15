'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { subscribeToSync, getPendingCount, isOnline } from '@/lib/offline-store';

export default function SyncBanner() {
  const [syncState, setSyncState] = useState({
    pending: getPendingCount(),
    isSyncing: false,
    lastError: null as string | null,
    isOnline: isOnline(),
  });

  useEffect(() => {
    const unsubscribe = subscribeToSync((state: any) => {
      setSyncState({
        pending: state.pendingCount,
        isSyncing: state.isSyncing,
        lastError: state.lastError,
        isOnline: state.isOnline,
      });
    });

    return unsubscribe;
  }, []);

  if (syncState.isOnline && syncState.pending === 0 && !syncState.isSyncing) {
    return null;
  }

  return (
    <AnimatePresence>
      {(syncState.pending > 0 || !syncState.isOnline || syncState.isSyncing) && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div
            className={`px-4 py-3 flex items-center justify-between border-b ${
              syncState.lastError
                ? 'bg-rose-50 border-rose-100 text-rose-700'
                : !syncState.isOnline
                  ? 'bg-amber-50 border-amber-100 text-amber-700'
                  : 'bg-blue-50 border-blue-100 text-blue-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {syncState.lastError ? (
                <AlertCircle size={16} className="text-rose-500 shrink-0" />
              ) : !syncState.isOnline ? (
                <WifiOff size={16} className="text-amber-500 shrink-0" />
              ) : syncState.isSyncing ? (
                <RefreshCcw size={16} className="text-blue-500 animate-spin shrink-0" />
              ) : (
                <CheckCircle size={16} className="text-blue-500 shrink-0" />
              )}

              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-wider leading-none">
                  {syncState.lastError
                    ? 'Sync Error'
                    : !syncState.isOnline
                      ? 'Offline Mode'
                      : syncState.isSyncing
                        ? 'Syncing Data'
                        : 'Changes Saved'}
                </span>
                <span className="text-[10px] font-medium opacity-80 mt-0.5">
                  {syncState.lastError
                    ? 'Manual action required to resume'
                    : !syncState.isOnline
                      ? `${syncState.pending} change${syncState.pending > 1 ? 's' : ''} saved locally`
                      : syncState.isSyncing
                        ? `Processing ${syncState.pending} pending action${syncState.pending > 1 ? 's' : ''}...`
                        : 'All changes synced successfully'}
                </span>
              </div>
            </div>

            {syncState.lastError && (
              <button
                onClick={() => window.location.reload()}
                className="bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform"
              >
                Retry
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
