/**
 * Auth module - Policy.
 *
 * Authorization rules for authentication operations.
 */

export const authPolicy = {
  canSendOtp(phone: string): { allowed: boolean; reason?: string } {
    // TODO: Implement rate limiting check
    return { allowed: true };
  },

  canVerifyOtp(phone: string): { allowed: boolean; reason?: string } {
    // TODO: Implement max attempts check
    return { allowed: true };
  },
};
