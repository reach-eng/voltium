/**
 * Device Compliance module — Policy
 */

export const deviceCompliancePolicy = {
  canSyncState(_riderId: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },

  canReportViolation(_riderId: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },

  canLockDevice(_adminId: string): { allowed: boolean; reason?: string } {
    return { allowed: true };
  },
};
