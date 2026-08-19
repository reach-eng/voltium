/**
 * Mask sensitive phone numbers (e.g. +91 9999900001 -> +91 ******0001)
 */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const p = phone.trim();
  if (p.length < 4) return p;

  // Show only last 4 digits
  const last4 = p.slice(-4);
  const prefix = p.length > 4 ? '*'.repeat(p.length - 4) : '';
  return prefix + last4;
}

/**
 * Mask sensitive email addresses (e.g. arjun.sharma@gmail.com -> a****a@gmail.com)
 */
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!domain) return email;
  if (user.length < 3) return `*@${domain}`;

  return `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}@${domain}`;
}

/**
 * Mask Aadhaar number (e.g. 1234-5678-9012 -> XXXX-XXXX-9012)
 *
 * SECURITY (R10 polish #3, §4.2): fail-closed for invalid input. If the input
 * is not exactly 12 alphanumeric characters, return a fully-redacted string
 * (12 asterisks) rather than echoing the unmasked value. The previous
 * implementation returned `cleanAadhaar` for wrong-length input, which leaked
 * partial PII.
 */
export function maskAadhaar(aadhaar: string | null | undefined): string {
  if (!aadhaar) return '';
  const cleanAadhaar = aadhaar.replace(/[^a-zA-Z0-9]/g, '');
  if (cleanAadhaar.length !== 12) return '************'; // 12 asterisks
  return `********${cleanAadhaar.slice(-4)}`;
}

/**
 * Mask PAN number (e.g. ABCDE1234F -> ******1234F)
 *
 * SECURITY (R10 polish #3, §4.2): fail-closed for invalid input. Same
 * rationale as `maskAadhaar`.
 */
export function maskPan(pan: string | null | undefined): string {
  if (!pan) return '';
  const cleanPan = pan.replace(/[^a-zA-Z0-9]/g, '');
  if (cleanPan.length !== 10) return '**********'; // 10 asterisks
  return `******${cleanPan.slice(-4)}`;
}

/**
 * Mask bank account number (e.g. 12345678901234 -> XXXXXX1234)
 *
 * SECURITY (PR-5: RIDER_DASHBOARD P0-3): account numbers are PII under DPDP.
 * The dashboard endpoint was returning unmasked `accountNumber` and `ifscCode`
 * alongside the masked Aadhaar/PAN. The IFSC code is non-sensitive (it
 * identifies a bank branch, not a person), but the account number must be
 * masked. We show only the last 4 digits.
 */
export function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber) return '';
  const clean = accountNumber.replace(/[^0-9]/g, '');
  if (clean.length < 4) return '****';
  return `${'*'.repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}
