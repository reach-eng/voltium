'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export interface BulkActionState {
  /** Stores previous states for rollback */
  lastAction: {
    ids: string[];
    previousStates: Record<string, any>;
    action: string;
  } | null;
  showUndoToast: boolean;
  bulkLoading: boolean;
}

export interface BulkActionsAPI {
  bulkLoading: boolean;
  lastAction: BulkActionState['lastAction'];
  showUndoToast: boolean;
  executeBulkAction: (
    url: string,
    ids: string[],
    action: string,
    extraBody?: Record<string, unknown>,
    options?: {
      onSuccess?: () => void;
      onError?: () => void;
      trackPrevious?: (ids: string[], data?: any[]) => Record<string, any>;
    }
  ) => Promise<void>;
  undo: (
    fetchFn: () => Promise<void>
  ) => Promise<void>;
  dismissUndoToast: () => void;
}

/**
 * Shared hook for bulk actions with undo support.
 *
 * Usage:
 * ```ts
 * const { bulkLoading, executeBulkAction, undo, lastAction, showUndoToast, dismissUndoToast } =
 *   useAdminBulkActions();
 *
 * // Track previous states for rollback
 * const previousStates: Record<string, any> = {};
 * items.filter(i => selectedIds.has(i.id)).forEach(i => {
 *   previousStates[i.id] = { status: i.status };
 * });
 *
 * await executeBulkAction('/api/admin/tickets/bulk', ids, 'approve', { value: 'APPROVED' }, {
 *   trackPrevious: () => previousStates,
 *   onSuccess: () => fetchItems(),
 * });
 * ```
 */
export function useAdminBulkActions(
  options?: { undoTimeoutMs?: number; onUndo?: (lastAction: BulkActionState['lastAction']) => Promise<void> }
): BulkActionsAPI {
  const undoTimeoutMs = options?.undoTimeoutMs ?? 5000;
  const [state, setState] = useState<BulkActionState>({
    lastAction: null,
    showUndoToast: false,
    bulkLoading: false,
  });
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndoTimeout = useCallback(() => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string) => {
      setState((prev) => ({ ...prev, showUndoToast: true }));
      clearUndoTimeout();
      undoTimeoutRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, showUndoToast: false }));
      }, undoTimeoutMs);
    },
    [clearUndoTimeout, undoTimeoutMs]
  );

  const dismissUndoToast = useCallback(() => {
    setState((prev) => ({ ...prev, showUndoToast: false }));
    clearUndoTimeout();
  }, [clearUndoTimeout]);

  const executeBulkAction = useCallback(
    async (
      url: string,
      ids: string[],
      action: string,
      extraBody?: Record<string, unknown>,
      opts?: {
        onSuccess?: () => void;
        onError?: () => void;
        trackPrevious?: (ids: string[], data?: any[]) => Record<string, any>;
        data?: any[];
      }
    ) => {
      if (ids.length === 0) return;
      setState((prev) => ({ ...prev, bulkLoading: true }));
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, action, ...extraBody }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(json?.error?.message || 'Bulk action failed');
          opts?.onError?.();
          return;
        }
        toast.success(`${ids.length} item(s) ${action.replace('_', ' ').toLowerCase()}d`);
        const previousStates = opts?.trackPrevious?.(ids, opts.data) ?? {};
        setState((prev) => ({
          ...prev,
          lastAction: { ids, previousStates, action },
        }));
        showToast('');
        opts?.onSuccess?.();
      } catch (err) {
        logger.error('Bulk action failed', { error: err });
        toast.error('Bulk action failed. Please try again.');
        opts?.onError?.();
      } finally {
        setState((prev) => ({ ...prev, bulkLoading: false }));
      }
    },
    [showToast]
  );

  const undo = useCallback(
    async (fetchFn: () => Promise<void>) => {
      const action = state.lastAction;
      if (!action) return;
      setState((prev) => ({ ...prev, bulkLoading: true }));
      try {
        // Run custom undo logic if provided (e.g., reverting state via API)
        if (options?.onUndo) {
          await options.onUndo(action);
        }
        toast.success('Undo successful');
        setState((prev) => ({
          ...prev,
          lastAction: null,
          showUndoToast: false,
        }));
        clearUndoTimeout();
        fetchFn();
      } catch (err) {
        logger.error('Undo failed', { error: err });
        toast.error('Undo failed. Please try again.');
      } finally {
        setState((prev) => ({ ...prev, bulkLoading: false }));
      }
    },
    [state.lastAction, clearUndoTimeout, options?.onUndo]
  );

  return {
    bulkLoading: state.bulkLoading,
    lastAction: state.lastAction,
    showUndoToast: state.showUndoToast,
    executeBulkAction,
    undo,
    dismissUndoToast,
  };
}
