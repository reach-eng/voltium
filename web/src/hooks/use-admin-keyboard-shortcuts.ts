'use client';

import { useEffect, useCallback } from 'react';

interface ShortcutMap {
  /** Ctrl+A — Select all visible items */
  selectAll?: () => void;
  /** Ctrl+Z — Undo last bulk action */
  undo?: () => void;
  /** Ctrl+K — Approve / mark as resolved */
  approve?: () => void;
  /** Ctrl+R — Reject / suspend */
  reject?: () => void;
  /** Custom shortcuts */
  [key: string]: (() => void) | undefined;
}

/**
 * Global keyboard shortcuts for admin screens.
 * Only fires when focus is NOT in an input/textarea element.
 */
export function useAdminKeyboardShortcuts(shortcuts: ShortcutMap): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't interfere with typing
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key === 'a') {
        e.preventDefault();
        shortcuts.selectAll?.();
      }
      if (isCtrl && e.key === 'z') {
        e.preventDefault();
        shortcuts.undo?.();
      }
      if (isCtrl && e.key === 'k') {
        e.preventDefault();
        shortcuts.approve?.();
      }
      if (isCtrl && e.key === 'r') {
        e.preventDefault();
        shortcuts.reject?.();
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
