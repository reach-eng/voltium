/**
 * Auth module - Policy.
 *
 * Route/use-case rate limiting is enforced through src/lib/rate-limit.ts.
 * These sync policy helpers remain for simple pre-checks and documentation of the auth rules.
 */

export const authPolicy = {
  canSendOtp(phone: string): { allowed: boolean; reason?: string } {
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return { allowed: false, reason: 'A valid phone number is required' };
    }
    return { allowed: true };
  },

  canVerifyOtp(phone: string): { allowed: boolean; reason?: string } {
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return { allowed: false, reason: 'A valid phone number is required' };
    }
    return { allowed: true };
  },
};
