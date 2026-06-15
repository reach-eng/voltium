/**
 * Device Compliance module — Policy
 */

export const deviceCompliancePolicy = {
  canSyncState(riderId: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },

  canReportViolation(riderId: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },

  canLockDevice(adminId: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },
};
