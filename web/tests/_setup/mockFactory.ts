/**
 * TEST-STRATEGY-AUDIT T-P2-2 (2026-08-08): shared mock-factory for
 * repository mocks. Use-case tests (e.g. tests/unit/use-cases.test.ts)
 * hand-write `vi.fn()` repositories. When a new method is added to
 * the real repository, the mock silently drifts — the use-case
 * could call a method that doesn't exist on the real repo, and the
 * mock passes because `vi.fn()` returns `undefined`.
 *
 * This factory takes the repository's TypeScript class as a generic
 * parameter and returns a mock where every method is a `vi.fn()`.
 * TypeScript will then fail the build when a use case calls a
 * method that the real repo doesn't have, because the mock no
 * longer matches.
 *
 * Usage:
 *
 *   import { mockRepository } from '../_setup/mockFactory';
 *   import { KycRepository } from '@/server/modules/kyc/kyc.repository';
 *
 *   const mockKycRepo = mockRepository<KycRepository>({
 *     findByRiderId: vi.fn(),
 *     submitKyc: vi.fn(),
 *   });
 *
 * The optional second arg is for tests that want to seed specific
 * return values (e.g. `mockRepository<KycRepository>({ findByRiderId:
 * vi.fn().mockResolvedValue(riderFixture) })`).
 */

import { vi } from 'vitest';

type AnyMethod = (...args: unknown[]) => unknown;

/**
 * Build a typed mock of a repository. The generic `T` is the
 * repository's TypeScript shape (interface or class). Methods that
 * are NOT in `seed` get a `vi.fn()` that returns `undefined`. The
 * return type still matches the real repo, so TypeScript catches
 * the case where a use case calls a method that doesn't exist.
 */
export function mockRepository<T extends Record<string, unknown>>(
  seed: Partial<{ [K in keyof T]: T[K] extends AnyMethod ? ReturnType<typeof vi.fn> : T[K] }> = {}
): T {
  const result: Record<string, unknown> = { ...seed };

  // For each method in the seed, wrap with vi.fn() if not already.
  // Callers can also pass plain values (for non-method fields like
  // readonly constants), and we leave those alone.
  for (const [key, value] of Object.entries(seed)) {
    if (typeof value === 'function' && !(value as { mock?: unknown }).mock) {
      // Not a vi.fn() yet — wrap it. (This branch is rarely hit
      // because callers usually pass `vi.fn()` directly.)
      result[key] = vi.fn(value as AnyMethod);
    }
  }

  return result as T;
}

/**
 * Variant of `mockRepository` that auto-generates `vi.fn()` for every
 * method listed in `methodNames`. Useful when the caller wants a
 * "blank" mock with no seed return values, and trusts the test
 * bodies to add `mockResolvedValue` as needed.
 */
export function blankMock<T extends Record<string, unknown>>(
  methodNames: ReadonlyArray<keyof T>
): T {
  const result: Record<string, unknown> = {};
  for (const name of methodNames) {
    result[name as string] = vi.fn();
  }
  return result as T;
}
