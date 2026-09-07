import { z } from 'zod';

// RIDER-LOCK-2026-09-07 (P3-5): shared 4-digit PIN schema. The set
// route and the verify route previously diverged (verify was
// `z.string().min(1)`, set was `z.string().regex(/^\d{4}$/)`).
// Tighten verify to match. The bcrypt comparison is still the
// real auth gate; this just rejects malformed input earlier
// (5-digit, alphabetic, etc.) instead of after a wasted hash.
//
// The schema is reused by:
//   - POST /api/rider/device/set-lock
//   - POST /api/rider/device/verify-lock
export const LOCK_PIN_SCHEMA = z
  .string()
  .regex(/^\d{4}$/, 'Must be a 4-digit PIN');
