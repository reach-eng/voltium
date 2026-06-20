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
 */
export function maskAadhaar(aadhaar: string | null | undefined): string {
  if (!aadhaar) return '';
  const cleanAadhaar = aadhaar.replace(/[^a-zA-Z0-9]/g, '');
  if (cleanAadhaar.length !== 12) return cleanAadhaar;
  return `********${cleanAadhaar.slice(-4)}`;
}

export function maskPan(pan: string | null | undefined): string {
  if (!pan) return '';
  const cleanPan = pan.replace(/[^a-zA-Z0-9]/g, '');
  if (cleanPan.length !== 10) return cleanPan;
  return `******${cleanPan.slice(-4)}`;
}
