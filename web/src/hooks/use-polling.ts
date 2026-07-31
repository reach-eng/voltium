'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * A shared polling hook that:
 * - Calls `fn` immediately on mount
 * - Repeats every `intervalMs`
 * - Pauses when the tab is hidden, resumes + refetches when visible
 * - Cleans up on unmount
 */
export function usePolling(
  fn: (isBackground: boolean) => void | Promise<void>,
  intervalMs: number,
  deps: React.DependencyList = []
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a stable reference to fn so the interval doesn't need to reset when fn changes
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const stableFetch = useCallback((isBackground = false) => {
    fnRef.current(isBackground);
  }, []);

  useEffect(() => {
    stableFetch();

    intervalRef.current = setInterval(() => stableFetch(true), intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, stableFetch, ...deps]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        stableFetch(true);
        intervalRef.current = setInterval(() => stableFetch(true), intervalMs);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [intervalMs, stableFetch]);
}
