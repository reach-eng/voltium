/**
 * Ryd Shared Pagination Helper
 * Standardizes pagination across all list endpoints.
 */

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse pagination params from URL search params.
 * Always clamps to safe bounds.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  opts?: { defaultLimit?: number; maxLimit?: number }
): PaginationParams {
  const defaultLimit = opts?.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = opts?.maxLimit ?? MAX_LIMIT;

  const rawPage = parseInt(searchParams.get('page') || String(DEFAULT_PAGE), 10);
  const rawLimit = parseInt(searchParams.get('limit') || String(defaultLimit), 10);

  const page = Math.max(1, isNaN(rawPage) ? DEFAULT_PAGE : rawPage);
  const limit = Math.min(maxLimit, Math.max(1, isNaN(rawLimit) ? defaultLimit : rawLimit));

  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Build the pagination metadata object for the response.
 */
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
