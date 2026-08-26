import { useState, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';

export interface PaginationState {
  page: number;
  totalPages: number;
  total: number;
  setPage: Dispatch<SetStateAction<number>>;
  setTotalPages: Dispatch<SetStateAction<number>>;
  setTotal: Dispatch<SetStateAction<number>>;
  nextPage: () => void;
  prevPage: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  resetPage: () => void;
  from: number;
  to: number;
}

export interface PaginationConfig {
  pageSize?: number;
  initialPage?: number;
}

export function usePagination(
  config: PaginationConfig = {}
): PaginationState & { pageSize: number } {
  const { pageSize = 20, initialPage = 1 } = config;
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const nextPage = useCallback(() => {
    setPage((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  const from = useMemo(() => (page - 1) * pageSize + 1, [page, pageSize]);
  const to = useMemo(
    () => Math.min(page * pageSize, total),
    [page, pageSize, total]
  );

  return {
    page,
    totalPages,
    total,
    setPage,
    setTotalPages,
    setTotal,
    nextPage,
    prevPage,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    resetPage,
    from,
    to,
    pageSize,
  };
}
