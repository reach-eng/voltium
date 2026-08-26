'use client';

// ─── Common Admin Types ───────────────────────────────────────────────────────

export interface AdminPagination {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

export interface AdminApiListResponse<T> {
  success: boolean;
  data: T[];
  pagination?: AdminPagination;
}

export interface AdminApiItemResponse<T> {
  success: boolean;
  data: T;
}

export interface AdminApiError {
  success: false;
  error: { message: string; code?: string };
}

// ─── Common Screen State ──────────────────────────────────────────────────────

export interface SearchState {
  search: string;
  setSearch: (value: string) => void;
  clearSearch: () => void;
  debouncedSearch: string;
}

export interface FilterState {
  activeFilter: string;
  setActiveFilter: (value: string) => void;
  clearFilter: () => void;
}

export interface LoadingState {
  loading: boolean;
  saving: boolean;
  error: string | null;
}

// ─── Dialog State ─────────────────────────────────────────────────────────────

export interface DialogState<T = any> {
  open: boolean;
  editItem: T | null;
  isEditing: boolean;
}

// ─── Fetch Params Builder ─────────────────────────────────────────────────────

/** Build URLSearchParams from common admin list parameters */
export function buildListParams(params: {
  page: number;
  limit?: number;
  search?: string;
  activeFilter?: string;
  extra?: Record<string, string>;
}): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set('page', String(params.page));
  sp.set('limit', String(params.limit ?? 20));
  if (params.search) sp.set('search', params.search);
  if (params.activeFilter && params.activeFilter !== 'ALL') {
    sp.set('active', params.activeFilter === 'ACTIVE' ? 'true' : 'false');
    sp.set('status', params.activeFilter);
  }
  if (params.extra) {
    for (const [k, v] of Object.entries(params.extra)) {
      if (v) sp.set(k, v);
    }
  }
  return sp;
}
