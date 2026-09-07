/**
 * EDIT-PROFILE-AUDIT P1-2 (2026-09-08): canonical "Indian
 * mobile" rule shared by the Zod schema, the server-side manual
 * checks in `rider.use-cases.ts`, and the rider-facing error
 * messages. Mirrors the client-side
 * `PhoneValidator.isValidIndianMobile` in
 * `flutter/lib/utils/phone_validator.dart`.
 *
 * Rule: a 10-digit number starting with 6, 7, 8, or 9 (the
 * only valid Indian mobile prefixes). Strips `+91`, spaces,
 * and dashes before the check.
 *
 * The rule is India-only by design (per the current product
 * spec). If the product ever needs international numbers, the
 * helper is the single seam.
 */

const INDIAN_MOBILE_LENGTH = 10;
const INDIAN_MOBILE_PREFIX = /^[6-9]/;

export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function isValidIndianMobile(phone: string): boolean {
  const digits = digitsOnly(phone);
  return (
    digits.length === INDIAN_MOBILE_LENGTH &&
    INDIAN_MOBILE_PREFIX.test(digits)
  );
}
