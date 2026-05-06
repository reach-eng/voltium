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
export function maskAadhaar(aadhaar: string | null): string | null {
  if (!aadhaar) return null;
  const clean = aadhaar.replace(/-/g, '');
  if (clean.length !== 12) return aadhaar;
  
  return `XXXX-XXXX-${clean.slice(-4)}`;
}

/**
 * Mask PAN number (e.g. ABCDE1234F -> XXXXX1234F)
 */
export function maskPan(pan: string | null): string | null {
  if (!pan) return null;
  if (pan.length !== 10) return pan;
  
  return `XXXXX${pan.slice(-5)}`;
}
