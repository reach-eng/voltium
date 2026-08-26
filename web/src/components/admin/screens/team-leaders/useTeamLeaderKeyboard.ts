'use client';

import { useEffect } from 'react';

/**
 * R3.7aa split — keyboard shortcuts for Team Leader Management.
 *
 *   Ctrl/Cmd + A — select all currently-paginated rows
 *   Ctrl/Cmd + Z — trigger the last bulk undo
 *
 * Both are ignored when the user is typing in an input/textarea.
 */
export function useTeamLeaderKeyboard(args: {
  visibleIds: string[];
  onSelectAll: () => void;
  canUndo: boolean;
  onUndo: () => void;
}) {
  const { visibleIds, onSelectAll, canUndo, onUndo } = args;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (visibleIds.length > 0) onSelectAll();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (canUndo) onUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleIds, onSelectAll, canUndo, onUndo]);
}
