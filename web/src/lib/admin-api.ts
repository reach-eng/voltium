'use client';

import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/lib/api-response';

export interface FetchOptions extends RequestInit {
  /** If true, does not throw on non-2xx responses — returns error shape instead */
  quiet?: boolean;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /**
   * Bypass the in-flight request dedup. Useful for "force refresh" UI affordances
   * where the user explicitly wants a fresh fetch even if another caller is
   * already in flight for the same URL.
   */
  noDedup?: boolean;
}

export interface ApiErrorResult {
  success: false;
  error: { message: string; code?: string };
}

/**
 * Shared admin API client.
 *
 * Features:
 * - Consistent error handling
 * - JSON parsing safety
 * - Quiet mode for non-critical requests
 * - In-flight dedup for GET requests (P2.2 — see docs/CACHE_RECOMMENDATIONS_2026-08-01.md)
 *
 * @example
 * ```ts
 * import { api } from '@/lib/admin-api';
 *
 * const { data, pagination } = await api.get<Item[]>('/api/admin/items');
 * const result = await api.put('/api/admin/items', { id: '...', status: 'APPROVED' });
 * ```
 */

// ---------------------------------------------------------------------------
// In-flight request dedup (GET only)
//
// When two components on the same page call `adminApi.get('/api/admin/riders')`
// before the first response lands, they both await the same Promise instead of
// firing two HTTP requests. This is the client-side counterpart of the
// server-side `getOrSetResponse` / `cachedPrismaQuery` layers — the server
// already does its own dedup, but skipping the round trip entirely is cheaper
// for parallel UI panels.
//
// Key: `GET <url>`. Body-bearing methods are never deduped; mutating twice is
// a bug we want to surface, not hide.
// ---------------------------------------------------------------------------
const inflightGets = new Map<string, Promise<unknown>>();

function inflightKey(url: string): string {
  return `GET ${url}`;
}

/**
 * Test-only: drop all in-flight dedup entries. Call this between tests so a
 * test's in-flight promise doesn't leak into the next test.
 */
export function _clearInflightGets(): void {
  inflightGets.clear();
}

async function request<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<{ data?: T; pagination?: { totalPages: number; total: number; page: number; limit: number }; error?: string; success: boolean }> {
  const { quiet, noDedup, ...fetchOptions } = options;
  const method = (fetchOptions.method ?? 'GET').toUpperCase();

  // In-flight dedup: only for GET. Only dedupe if no caller requested a
  // bypass and the body is empty (GETs have no body anyway, but a custom
  // caller could be weird).
  if (method === 'GET' && !noDedup && !fetchOptions.body) {
    const key = inflightKey(url);
    const pending = inflightGets.get(key);
    if (pending) {
      return pending as ReturnType<typeof request<T>>;
    }
    const p = runRequest<T>(url, fetchOptions, quiet).finally(() => {
      inflightGets.delete(key);
    });
    inflightGets.set(key, p);
    return p;
  }

  return runRequest<T>(url, fetchOptions, quiet);
}

async function runRequest<T>(
  url: string,
  fetchOptions: FetchOptions,
  quiet?: boolean
): Promise<{ data?: T; pagination?: { totalPages: number; total: number; page: number; limit: number }; error?: string; success: boolean }> {
  // Generate a per-request ID so server logs (which read x-request-id via
  // withApiHandler) can be correlated to client-side errors. crypto.randomUUID
  // is available in all modern browsers and Node 19+; the 'use client' module
  // only runs in the browser, so this is safe.
  const requestId = crypto.randomUUID();

  try {
    // Pull `headers` out of fetchOptions so the trailing `...fetchOptions`
    // spread below doesn't replace the headers object we just built.
    const { headers: callerHeaders, ...restFetchOptions } = fetchOptions;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        // Caller-supplied headers first, then x-request-id overrides last.
        // This prevents a caller from spoofing the trace id in server logs.
        ...(callerHeaders as Record<string, string> | undefined),
        'x-request-id': requestId,
      },
      ...restFetchOptions,
    });

    let json: ApiResponse<T> | null = null;
    try {
      json = await res.json();
    } catch {
      // Response was not JSON
    }

    if (!res.ok) {
      const errorMessage = json?.success === false
        ? json.error?.message || json.error?.code || `Request failed with status ${res.status}`
        : `Request failed with status ${res.status}`;

      if (!quiet) {
        logger.error('API request failed', {
          url,
          status: res.status,
          error: errorMessage,
          requestId,
        });
      }

      return { success: false, error: errorMessage };
    }

    if (json?.success === true) {
      return {
        success: true,
        data: json.data as T,
        pagination: json.pagination as any,
      };
    }

    // Some APIs return data directly without wrapping
    if (json && 'success' in json === false) {
      return { success: true, data: json as unknown as T };
    }

    return { success: true, data: (json as any)?.data as T };
  } catch (err) {
    const errorMessage = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : 'Network error';
    if (!quiet) {
      logger.error('API network error', { url, error: errorMessage, requestId });
    }
    return { success: false, error: errorMessage };
  }
}

export const adminApi = {
  get: <T = any>(url: string, options?: FetchOptions) =>
    request<T>(url, { method: 'GET', ...options }),

  post: <T = any>(url: string, body?: unknown, options?: FetchOptions) =>
    request<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined, ...options }),

  put: <T = any>(url: string, body?: unknown, options?: FetchOptions) =>
    request<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, ...options }),

  del: <T = any>(url: string, options?: FetchOptions) =>
    request<T>(url, { method: 'DELETE', ...options }),
};
