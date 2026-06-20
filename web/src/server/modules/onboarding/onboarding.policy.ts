/**
 * Onboarding module — Policy
 *
 * Authorization rules for onboarding operations.
 */

export const onboardingPolicy = {
  canViewProgress(_riderId: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },

  canCompleteStep(_riderId: string, _step: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },
};
