'use client';

import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/lib/api-response';

export interface FetchOptions extends RequestInit {
  /**
   * If true, does not throw on non-2xx responses — returns the error shape
   * (AdminApiFailure) instead. Use for non-critical requests (e.g., analytics,
   * feature flags) where a failure should not crash the UI.
   *
   * Default: false (throws).
   */
  quiet?: boolean;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export interface PaginationMeta {
  totalPages: number;
  total: number;
  page: number;
  limit: number;
}

export interface AdminApiSuccess<T> {
  success: true;
  data: T;
  pagination?: PaginationMeta;
}

export interface AdminApiFailure {
  success: false;
  error: string;
}

export type AdminApiResult<T> = AdminApiSuccess<T> | AdminApiFailure;

/**
 * Core request helper. Returns the result-shape union; callers are expected
 * to either inspect `result.success` (quiet mode) or wrap in try/catch
 * (default mode, which throws on non-2xx).
 *
 * Use the `adminApi` object below for typed `get`/`post`/`put`/`del` helpers.
 */
async function request<T = unknown>(
  url: string,
  options: FetchOptions = {},
): Promise<AdminApiResult<T>> {
  const { quiet, ...fetchOptions } = options;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers as Record<string, string>),
      },
      ...fetchOptions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    logger.error('API network error', { url, error: message });
    if (quiet) return { success: false, error: message };
    throw new AdminApiError(message, 0);
  }

  let json: ApiResponse<T> | null = null;
  try {
    json = await res.json();
  } catch {
    // Response was not JSON
  }

  if (!res.ok) {
    const errorMessage =
      json && json.success === false
        ? (json.error?.message || json.error?.code || `Request failed with status ${res.status}`)
        : `Request failed with status ${res.status}`;
    const errorCode = json && json.success === false ? json.error?.code : undefined;

    if (!quiet) {
      logger.error('API request failed', { url, status: res.status, error: errorMessage });
    }

    if (quiet) return { success: false, error: errorMessage };
    throw new AdminApiError(errorMessage, res.status, errorCode);
  }

  if (json?.success === true) {
    return {
      success: true,
      data: json.data as T,
      pagination: json.pagination as PaginationMeta,
    };
  }

  // Some APIs return data directly without wrapping
  if (json && 'success' in json === false) {
    return { success: true, data: json as unknown as T };
  }

  return { success: true, data: (json as unknown as { data: T }).data };
}

/**
 * Shared admin API client.
 *
 * **Throws by default** on non-2xx responses and network errors. The
 * returned promise will only resolve with a success-shape; in failure
 * cases it throws an `AdminApiError`. Pass `quiet: true` to get the
 * `AdminApiResult<T>` union instead (resolve on both success and failure).
 *
 * @example
 * ```ts
 * import { adminApi } from '@/lib/admin-api';
 *
 * // Default: throws on error
 * try {
 *   const data = await adminApi.get<Item>('/api/admin/items/1');
 *   // data is the success shape
 * } catch (err) {
 *   if (err instanceof AdminApiError) { ... }
 * }
 *
 * // Quiet mode: returns the result union
 * const result = await adminApi.get<Item>('/api/admin/items/1', { quiet: true });
 * if (result.success) { use(result.data); }
 * else { showError(result.error); }
 * ```
 */
export const adminApi = {
  get: <T = unknown>(url: string, options?: FetchOptions) =>
    request<T>(url, { method: 'GET', ...options }),

  post: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) =>
    request<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined, ...options }),

  put: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) =>
    request<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, ...options }),

  del: <T = unknown>(url: string, options?: FetchOptions) =>
    request<T>(url, { method: 'DELETE', ...options }),
};
