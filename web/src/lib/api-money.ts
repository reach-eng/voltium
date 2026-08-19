/**
 * API money serializer.
 *
 * All Voltium users are based in India. The DB and internal code work
 * in **paise** (1/100 of a rupee — integer). The API boundary exposes
 * money in **rupees** (decimal). The conversion happens here, at the
 * edge, exactly once per response field.
 *
 * The DB schema, ledger math, and use-case code all keep paise. Only
 * this module knows the wire format.
 *
 * ## Field name conventions
 *
 * **Outgoing** (DB paise → API rupees): keys ending in `InPaise`
 * become `InRupees` (e.g. `balanceInPaise` → `balanceInRupees`). The
 * value is `paise / 100` (decimal). No rounding — paise is already
 * integer, so the only info loss is the trailing `0` (e.g. 50 paise
 * becomes 0.5 rupees, not "0.50" — JSON serialization handles that).
 *
 * **Incoming** (API rupees → DB paise): the route handler calls
 * `rupeesToPaise()` explicitly (the existing
 * `POST /api/transaction/topup` route already does this). We do NOT
 * have a generic incoming-mapper because input validation happens
 * per-field via Zod and the conversion is one line — adding a generic
 * helper would obscure the boundary.
 *
 * ## What this does NOT do
 *
 * - It does NOT touch non-paise fields. If a field is already a rupee
 *   amount (e.g. some analytics endpoints return percentages or
 *   counts), it passes through unchanged.
 * - It does NOT round-trip (serialize → deserialize). That would be
 *   lossy for fractional paise. The reverse is `rupeesToPaise()`
 *   (Math.round), used at input time only.
 * - It does NOT mutate the input object. Returns a new object.
 * - It does NOT touch bare `amount` (without an `InPaise` suffix) —
 *   that key is already rupees in the codebase. If you find a
 *   `*InPaise` field you want exposed, rename to `*InRupees` upstream
 *   and call this helper.
 *
 * ## Usage
 *
 * In a route handler:
 *
 * ```ts
 * import { toRupeesResponse } from '@/lib/api-money';
 *
 * return success(toRupeesResponse({
 *   riderId: '...',
 *   balanceInPaise: 100000,
 *   pendingTopupsPaise: 5000,
 * }));
 * // → { riderId: '...', balanceInRupees: 1000, pendingTopupsRupees: 50, ... }
 * ```
 */

/** Any object that may have `*InPaise` or `*Paise` fields. Use
 * unknown for the record type so callers can pass arrays, null, or
 * unknown shapes without TypeScript complaining. */
type WithPaiseFields = unknown;

/**
 * Lower-level: decide whether a field name is a paise field that
 * should be converted to rupees. Two patterns:
 *   - `*InPaise` (e.g. `balanceInPaise`, `amountInPaise`) — the
 *     standard explicit-paise naming. Renamed to `*InRupees`.
 *   - `*Paise` without the `In` prefix (e.g. `pendingTopupsPaise`,
 *     `securityDepositPaise`) — legacy short-form paise fields
 *     used in the wallet module for years. Renamed to `*Rupees`.
 *
 * Returns the new key if the field is a paise field, or `null` if
 * it's not (so the caller can pass the field through unchanged).
 *
 * ## Why an allowlist
 *
 * The bare `*Paise` suffix is ambiguous — any camelCase identifier
 * ending in `Paise` matches, including unrelated fields like
 * `inPaise` (a hypothetical boolean flag). To prevent false
 * positives, the short-form matcher requires the field to be in a
 * known set of legacy paise field names. New code should use the
 * explicit `*InPaise` suffix.
 */
const LEGACY_SHORT_FORM_PAISE_FIELDS = new Set<string>([
  'pendingTopupsPaise',
  'securityDepositPaise',
  // Add new short-form fields here as they appear in legacy code.
]);

function paiseFieldRename(key: string): string | null {
  if (key.endsWith('InPaise')) {
    return key.slice(0, -'InPaise'.length) + 'InRupees';
  }
  if (LEGACY_SHORT_FORM_PAISE_FIELDS.has(key)) {
    return key.slice(0, -'Paise'.length) + 'Rupees';
  }
  return null;
}

/**
 * Convert an object's `*InPaise` keys (and a small allowlist of
 * legacy `*Paise` keys) to their `*InRupees` / `*Rupees` equivalent
 * and divide the value by 100. Non-paise fields pass through
 * unchanged. Recurses one level into nested objects (so a `wallet:
 * { balanceInPaise }` becomes `wallet: { balanceInRupees }`).
 * Arrays of objects are mapped element-wise. Returns `input`
 * unchanged if it's null or not an object.
 */
export function toRupeesResponse(input: WithPaiseFields): unknown {
  return mapPaiseToRupees(input);
}

function mapPaiseToRupees(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => mapPaiseToRupees(v));
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'number') {
        const newKey = paiseFieldRename(k);
        if (newKey !== null) {
          result[newKey] = v / 100;
          continue;
        }
      }
      // Recurse into nested values: arrays (each element is
      // mapped) and objects (each key is processed). Dates and
      // primitives pass through unchanged.
      if (v === null || v === undefined) {
        result[k] = v;
      } else if (Array.isArray(v) || (typeof v === 'object' && !(v instanceof Date))) {
        result[k] = mapPaiseToRupees(v);
      } else {
        result[k] = v;
      }
    }
    return result;
  }
  return value;
}

/**
 * Lower-level: convert a single `*InPaise` or allowlisted `*Paise`
 * field name to the rupee equivalent. Returns the input key unchanged
 * if it doesn't match either pattern. Useful for constructing response
 * objects by hand when you only have a few fields.
 */
export function rupeesKey(paiseKey: string): string {
  return paiseFieldRename(paiseKey) ?? paiseKey;
}

/**
 * Lower-level: convert a single number from paise to rupees. Use this
 * in route handlers when you have a flat shape (no object traversal)
 * and want a quick field-by-field conversion.
 */
export function paiseFieldToRupees(paise: number): number {
  return paise / 100;
}
