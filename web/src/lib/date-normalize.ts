/**
 * Admin Panel Phase 3 P2-15 + T-94 (2026-08-23): the
 * "end-of-day UTC" date normalizer.
 *
 * The admin form lets operators type a `validUntil` as a bare
 * YYYY-MM-DD ("2026-09-30"). The operator's mental model is
 * "valid through the END of that day", but `new Date("2026-09-30")`
 * parses to `2026-09-30T00:00:00.000Z` (midnight at the START
 * of the day). For offers/coupons/anything admin-set, this
 * means the row expires 24 hours early.
 *
 * Inputs:
 *   - YYYY-MM-DD:    → Date at 23:59:59.999Z of the same day
 *   - Full ISO 8601: → pass through (operator already specified a time)
 *   - Anything else: → `new Date(input)` (let Prisma / Date
 *                     constructor decide, surface as a parse
 *                     error on the route if invalid)
 */
export function normalizeExpiryToEndOfDayUtc(input: string): Date {
  if (typeof input !== 'string') {
    return new Date(NaN);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    // YYYY-MM-DD only — pin to 23:59:59.999Z of the same day.
    return new Date(`${input}T23:59:59.999Z`);
  }
  return new Date(input);
}
