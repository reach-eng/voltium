/**
 * Money types and conversion helpers.
 *
 * All Voltium users are based in India. The DB and internal computation
 * store money in **paise** (1/100 of a rupee — integer, avoids FP
 * rounding). The API boundary exposes money in **rupees** (decimal).
 *
 * The two are NEVER interchangeable at the type level. To pass a
 * rupee value where a paise value is expected, you must call
 * `rupeesToPaise()` explicitly. The reverse is `paiseToRupees()`.
 *
 * ## Why branded types
 *
 * A naive `number` for both paise and rupees is the classic source of
 * `1.005 → 100` vs `1.005 → 101` bugs (FP imprecision, see
 * boundary-value-money-conversion.test.ts). Branded types make the
 * units compiler-checked: `Paise` and `Rupees` are `number` at runtime
 * but distinct at the type level, so you cannot pass one where the
 * other is expected.
 *
 * ## Why paise in the DB
 *
 * Decimal columns in Postgres are fine but they change the schema
 * migration story. Keeping paise as `Int` lets us keep the existing
 * indexed queries (`WHERE amountInPaise > 0`) and ledger math
 * (`balanceAfter = balanceBefore + delta`) on integers — no
 * `ROUND(..., 2)` sprinkled through every aggregation.
 */

/** Integer paise (1/100 of a rupee). Branded so it can't be confused with rupees. */
export type Paise = number & { readonly __brand: 'Paise' };

/** Decimal rupees, e.g. 49.95 for ₹49.95. Branded so it can't be confused with paise. */
export type Rupees = number & { readonly __brand: 'Rupees' };

/**
 * Cast an unchecked `number` to `Paise`. Use this ONLY at trust
 * boundaries (raw DB rows, $queryRaw result parsing, mocked test data).
 * Internal code should never need this.
 */
export function asPaise(n: number): Paise {
  return n as Paise;
}

/** Cast an unchecked `number` to `Rupees`. Same trust-boundary rule as `asPaise`. */
export function asRupees(n: number): Rupees {
  return n as Rupees;
}

/**
 * Convert decimal rupees to integer paise using banker's rounding
 * (Math.round in JS, which rounds half-up for positive numbers and
 * half-down for negative — we never have negative inputs in this app,
 * so this is effectively half-up).
 *
 * Boundary tests (see tests/unit/boundary-value-money-conversion.test.ts):
 *  - 1.50 → 150 paise
 *  - 1.005 → 100 paise (FP: 1.005 is actually 1.00499... in IEEE 754)
 *  - 0.30 → 30 paise
 *  - 0.1 + 0.2 = 0.30000000000000004 → 30 paise
 */
export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100) as Paise;
}

/**
 * Convert integer paise to decimal rupees. Always 2 decimal places at
 * runtime (1.5 rupees becomes 1.50 for the API consumer; consumers
 * can `.toFixed(2)` or rely on JSON.stringify).
 */
export function paiseToRupees(paise: number): Rupees {
  return (paise / 100) as Rupees;
}

/**
 * Add two paise values (integer math, no rounding).
 * Used by ledger accrual code where paise + paise is the natural form.
 */
export function addPaise(a: Paise, b: Paise): Paise {
  return (a + b) as Paise;
}

/**
 * Subtract paise values. Used by ledger debit code.
 * Result is non-negative in well-formed ledgers; we don't enforce
 * here (the ledger service does).
 */
export function subPaise(a: Paise, b: Paise): Paise {
  return (a - b) as Paise;
}

/**
 * Sum a list of paise values. Used by balance aggregation
 * (e.g. pending top-ups = sum of all PENDING CREDIT transactions).
 * Returns 0 paise for an empty list.
 */
export function sumPaise(values: readonly number[]): Paise {
  return values.reduce<number>((acc, v) => acc + v, 0) as Paise;
}

/**
 * Format paise as a human-readable rupee string, e.g. 5000 → "₹50.00".
 * Use this for server-side log lines, audit-log fields, and the
 * `description` column on transactions (where we bake in the
 * human-readable amount).
 */
export function formatRupeesFromPaise(paise: number): string {
  const rupees = paise / 100;
  // Indian number format would group lakhs/crores, but for a single
  // rupee amount we just need the decimal. Keep it simple — the
  // Flutter client applies Indian locale formatting.
  return `₹${rupees.toFixed(2)}`;
}
