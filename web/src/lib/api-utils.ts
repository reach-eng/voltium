/**
 * Shared API helpers.
 *
 * PR-4b (2026-08-06 fix-plan; 13th audit P0-6): `?page=abc` used to flow
 * `Math.max(1, parseInt('abc'))` → `NaN` into Prisma `skip`/`take`, which
 * either crashed the query or silently returned no rows. Every paginated
 * route now parses page/limit through `parsePositiveInt`.
 */

/**
 * Parse a positive integer from a query-string value with a safe fallback.
 *
 * - `null`/empty/garbage → `fallback`
 * - `0` or negative → `fallback` (a page/limit of 0 is meaningless)
 * - `> max` (when provided) → clamped to `max`
 *
 * Always returns a finite integer ≥ 1, so it is safe to pass straight to
 * Prisma `skip`/`take` or pagination math.
 */
export function parsePositiveInt(
  value: string | null,
  fallback: number,
  max?: number
): number {
  const parsed = parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}
