'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/lib/error-utils';

export interface OptimisticBulkOptions<T> {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  rollback?: (previousItems: T[]) => void;
}

export function useOptimisticBulk<T extends { id: string }>() {
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  const executeBulk = useCallback(
    async (
      endpoint: string,
      selectedIds: string[],
      action: string,
      currentItems: T[],
      optimisticUpdate: (items: T[]) => T[],
      options?: OptimisticBulkOptions<T>
    ) => {
      if (selectedIds.length === 0) return;

      const previous = [...currentItems];
      setIsBulkOperating(true);

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds, action }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = extractErrorMessage(json, `Failed to ${action} selected items`);
          toast.error(msg);
          options?.rollback?.(previous);
          options?.onError?.(json);
          return;
        }

        toast.success(`Successfully applied ${action} to ${selectedIds.length} item(s)`);
        options?.onSuccess?.();
      } catch (err) {
        const msg = extractErrorMessage(err, `Failed to ${action} selected items`);
        toast.error(msg);
        options?.rollback?.(previous);
        options?.onError?.(err);
      } finally {
        setIsBulkOperating(false);
      }
    },
    []
  );

  return {
    isBulkOperating,
    executeBulk,
  };
}
