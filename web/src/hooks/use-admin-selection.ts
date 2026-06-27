'use client';

import { useState, useCallback, useMemo } from 'react';

export interface AdminSelectionState {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
  count: number;
  isAllSelected: (totalIds: string[]) => boolean;
  toggleAll: (ids: string[]) => void;
}

export function useAdminSelection(): AdminSelectionState {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useCallback(
    (totalIds: string[]) =>
      totalIds.length > 0 && selectedIds.size === totalIds.length,
    [selectedIds]
  );

  const toggleAll = useCallback(
    (ids: string[]) => {
      if (isAllSelected(ids)) {
        clear();
      } else {
        selectAll(ids);
      }
    },
    [isAllSelected, selectAll, clear]
  );

  const count = useMemo(() => selectedIds.size, [selectedIds]);

  return {
    selectedIds,
    isSelected,
    toggle,
    selectAll,
    clear,
    count,
    isAllSelected,
    toggleAll,
  };
}
