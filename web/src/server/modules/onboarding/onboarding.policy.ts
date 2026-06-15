/**
 * Onboarding module — Policy
 *
 * Authorization rules for onboarding operations.
 */

export const onboardingPolicy = {
  canViewProgress(riderId: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },

  canCompleteStep(riderId: string, step: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },
};
