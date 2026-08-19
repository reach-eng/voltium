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
  /**
   * Client-side TTL in milliseconds. When provided, responses are cached in memory
   * and returned immediately if not expired.
   */
  ttlMs?: number;
  /**
   * Stale-While-Revalidate mode. Returns cached data immediately while firing a background
   * revalidation when cached data exists.
   */
  swr?: boolean;
}

export interface ApiErrorResult {
  success: false;
  error: { message: string; code?: string };
}

export interface ApiResult<T = any> {
  data?: T;
  pagination?: { totalPages: number; total: number; page: number; limit: number };
  error?: string;
  success: boolean;
}

// ---------------------------------------------------------------------------
// In-flight request dedup & Client-Side Micro-Caching (GET only)
// ---------------------------------------------------------------------------
const inflightGets = new Map<string, Promise<ApiResult<any>>>();

interface CacheRecord<T = any> {
  result: ApiResult<T>;
  expiresAt: number;
  staleAt: number;
}

const clientCache = new Map<string, CacheRecord<any>>();

function inflightKey(url: string): string {
  return `GET ${url}`;
}

/**
 * Test-only: drop all in-flight dedup entries.
 */
export function _clearInflightGets(): void {
  inflightGets.clear();
}

/**
 * Test-only: drop all client-side cached entries.
 */
export function _clearClientCache(): void {
  clientCache.clear();
}

async function request<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<ApiResult<T>> {
  const { quiet, noDedup, ttlMs, swr, ...fetchOptions } = options;
  const method = (fetchOptions.method ?? 'GET').toUpperCase();

  // In-flight dedup & SWR caching: only for GET requests with no body
  if (method === 'GET' && !fetchOptions.body) {
    // 1. Check client-side memory cache
    if ((ttlMs && ttlMs > 0) || swr) {
      const cached = clientCache.get(url);
      if (cached) {
        const now = Date.now();
        const isFresh = now < cached.expiresAt;
        const isStale = now >= cached.staleAt;

        if (isFresh && !noDedup) {
          // If in SWR mode and past stale threshold, trigger background revalidation
          if (swr && isStale && !inflightGets.has(inflightKey(url))) {
            const revalPromise = runRequest<T>(url, fetchOptions, true).then((fresh) => {
              if (fresh.success) {
                const ttl = ttlMs && ttlMs > 0 ? ttlMs : 60000;
                clientCache.set(url, {
                  result: fresh,
                  expiresAt: Date.now() + ttl,
                  staleAt: Date.now() + ttl * 0.5,
                });
              }
              return fresh;
            }).finally(() => {
              inflightGets.delete(inflightKey(url));
            });
            inflightGets.set(inflightKey(url), revalPromise);
          }
          return cached.result as ApiResult<T>;
        }
      }
    }

    // 2. Check in-flight promise deduplication
    if (!noDedup) {
      const key = inflightKey(url);
      const pending = inflightGets.get(key);
      if (pending) {
        return pending as Promise<ApiResult<T>>;
      }
      const p = runRequest<T>(url, fetchOptions, quiet).then((result) => {
        if (result.success && ((ttlMs && ttlMs > 0) || swr)) {
          const ttl = ttlMs && ttlMs > 0 ? ttlMs : 60000;
          clientCache.set(url, {
            result,
            expiresAt: Date.now() + ttl,
            staleAt: Date.now() + ttl * 0.5,
          });
        }
        return result;
      }).finally(() => {
        inflightGets.delete(key);
      });
      inflightGets.set(key, p);
      return p;
    }
  }

  const res = await runRequest<T>(url, fetchOptions, quiet);
  if (res.success && method === 'GET' && ((ttlMs && ttlMs > 0) || swr)) {
    const ttl = ttlMs && ttlMs > 0 ? ttlMs : 60000;
    clientCache.set(url, {
      result: res,
      expiresAt: Date.now() + ttl,
      staleAt: Date.now() + ttl * 0.5,
    });
  }
  return res;
}

async function runRequest<T>(
  url: string,
  fetchOptions: FetchOptions,
  quiet?: boolean
): Promise<ApiResult<T>> {
  const requestId = crypto.randomUUID();

  try {
    const { headers: callerHeaders, ...restFetchOptions } = fetchOptions;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
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

  /**
   * Stale-While-Revalidate GET: returns cached data in 0ms if available,
   * while transparently revalidating in the background.
   */
  getSWR: <T = any>(url: string, options?: Omit<FetchOptions, 'swr'>) =>
    request<T>(url, { method: 'GET', swr: true, ...options }),

  /**
   * Speculative prefetch into client cache ahead of user navigation.
   */
  prefetch: (url: string, ttlMs: number = 60000) => {
    void request(url, { method: 'GET', ttlMs, quiet: true });
  },

  /**
   * Invalidate cached client-side GET entries by prefix pattern.
   */
  invalidate: (urlPrefix?: string) => {
    if (!urlPrefix) {
      clientCache.clear();
      return;
    }
    for (const key of clientCache.keys()) {
      if (key.startsWith(urlPrefix) || key.includes(urlPrefix)) {
        clientCache.delete(key);
      }
    }
  },

  post: <T = any>(url: string, body?: unknown, options?: FetchOptions) => {
    adminApi.invalidate(url.split('?')[0]);
    return request<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined, ...options });
  },

  put: <T = any>(url: string, body?: unknown, options?: FetchOptions) => {
    adminApi.invalidate(url.split('?')[0]);
    return request<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, ...options });
  },

  del: <T = any>(url: string, options?: FetchOptions) => {
    adminApi.invalidate(url.split('?')[0]);
    return request<T>(url, { method: 'DELETE', ...options });
  },
};
