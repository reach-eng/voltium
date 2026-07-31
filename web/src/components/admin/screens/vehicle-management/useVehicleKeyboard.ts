'use client';

import { useEffect } from 'react';
import type { LastBulkAction } from './useVehicleManagement';
import type { Vehicle } from './types';

/**
 * R3.7e split — Vehicle management keyboard shortcuts.
 *
 * Ctrl/Cmd+A → select all filtered vehicles
 * Ctrl/Cmd+Z → undo last bulk action
 *
 * Suppressed while focus is inside an input/textarea so admin text entry
 * is never hijacked.
 */
export function useVehicleKeyboard(args: {
  filtered: Vehicle[];
  lastAction: LastBulkAction | null;
  bulkLoading: boolean;
  setSelectedIds: (s: Set<string>) => void;
  handleUndo: () => void;
}) {
  const { filtered, lastAction, bulkLoading, setSelectedIds, handleUndo } = args;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(filtered.map((v) => v.id)));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (lastAction && !bulkLoading) handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, lastAction, bulkLoading, setSelectedIds, handleUndo]);
}
