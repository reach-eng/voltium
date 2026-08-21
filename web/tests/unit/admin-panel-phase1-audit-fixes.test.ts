import { describe, it, expect } from 'vitest';
import { calculateKycScore } from '@/lib/score-calculator';
import { createAuditLog } from '@/lib/audit-log';
import { hasPermission } from '@/lib/permissions';
import { validateIncidentTransition } from '@/server/modules/incidents/incident-state-machine';
import { validateVehicleTransition, VehicleStateError } from '@/server/modules/vehicles/vehicle-state-machine';

describe('Admin Panel Phase 1 Deep Audit Fixes Verification', () => {
  describe('KYC Score Calculation (P0-07)', () => {
    it('scores SUBMITTED KYC status higher than PENDING', () => {
      const pendingRider = {
        kycProfile: {
          status: 'PENDING',
        },
      };

      const submittedRider = {
        kycProfile: {
          status: 'SUBMITTED',
          aadhaarFront: 'https://s3/front.jpg',
          aadhaarBack: 'https://s3/back.jpg',
          panCard: 'https://s3/pan.jpg',
          profilePhoto: 'https://s3/selfie.jpg',
        },
      };

      const pendingScore = calculateKycScore(pendingRider);
      const submittedScore = calculateKycScore(submittedRider);

      expect(submittedScore).toBe(90); // 70 base + 10 aadhaar + 5 pan + 5 photo
      expect(pendingScore).toBe(50);
      expect(submittedScore).toBeGreaterThan(pendingScore);
    });
  });

  describe('Critical Action Audit Log Recognition (P0-10)', () => {
    it('allows non-critical action errors to be gracefully swallowed without throwing', async () => {
      await expect(
        createAuditLog({
          actorId: 'test_actor',
          action: 'read.view_dashboard',
          entity: 'dashboard',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Additive Granular Custom Permissions (P0-03)', () => {
    it('preserves base role permissions when custom permissions are added', () => {
      const customSession = {
        adminId: 'admin_custom_1',
        adminRole: 'OPERATIONS_ADMIN',
        adminPermissions: ['data_management_backup' as any],
      };

      // Custom permission should be granted
      expect(hasPermission(customSession as any, 'data_management_backup')).toBe(true);

      // Base role permissions (e.g. vehicles_view, riders_view) must NOT be stripped
      expect(hasPermission(customSession as any, 'vehicles_view')).toBe(true);
      expect(hasPermission(customSession as any, 'riders_view')).toBe(true);
    });
  });

  describe('Incident State Machine Alignment (P0-13)', () => {
    it('permits valid transitions between Prisma enum IncidentStatus values', () => {
      expect(validateIncidentTransition('OPEN', 'INVESTIGATING')).toBe(true);
      expect(validateIncidentTransition('INVESTIGATING', 'RESOLVED')).toBe(true);
      expect(validateIncidentTransition('RESOLVED', 'CLOSED')).toBe(true);
    });

    it('rejects invalid jumps such as CLOSED to RESOLVED', () => {
      expect(() => validateIncidentTransition('CLOSED', 'RESOLVED')).toThrow(
        'Invalid incident status transition from CLOSED to RESOLVED'
      );
    });
  });

  describe('Vehicle State Machine Transitions (P0-08)', () => {
    it('permits valid transition from AVAILABLE to ASSIGNED or MAINTENANCE', () => {
      expect(() => validateVehicleTransition('AVAILABLE', 'ASSIGNED')).not.toThrow();
      expect(() => validateVehicleTransition('AVAILABLE', 'MAINTENANCE')).not.toThrow();
    });

    it('throws VehicleStateError on invalid direct jump from ACTIVE_RENTAL to AVAILABLE', () => {
      expect(() => validateVehicleTransition('ACTIVE_RENTAL', 'AVAILABLE')).toThrow(
        VehicleStateError
      );
    });
  });
});
