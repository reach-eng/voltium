import { describe, it, expect } from 'vitest';
import { getRiderStatus } from '../../src/components/admin/screens/fleet-map/fleetMapHelpers';
import type { FleetRider } from '../../src/components/admin/screens/fleet-map/types';

describe('fleetMapHelpers - getRiderStatus', () => {
  const createMockRider = (lifecycleStatus: string): FleetRider => ({
    id: '1',
    riderId: 'R123',
    name: 'Test Rider',
    phone: '1234567890',
    batteryLevel: 100,
    lastKnownLat: 12.9716,
    lastKnownLng: 77.5946,
    lastLocationAt: new Date().toISOString(),
    vehicleNumber: 'KA01AB1234',
    hubId: 'hub-1',
    hubName: 'Main Hub',
    lifecycleStatus,
  });

  it('maps ACTIVE and RETURN_PENDING to "active"', () => {
    expect(getRiderStatus(createMockRider('ACTIVE'))).toBe('active');
    expect(getRiderStatus(createMockRider('RETURN_PENDING'))).toBe('active');
  });

  it('maps specific onboarding states to "idle"', () => {
    const idleStates = [
      'KYC_APPROVED',
      'GUARANTOR_APPROVED',
      'DEPOSIT_APPROVED',
      'PLAN_SELECTED',
      'PICKUP_SCHEDULED',
    ];

    idleStates.forEach((state) => {
      expect(getRiderStatus(createMockRider(state))).toBe('idle');
    });
  });

  it('maps all other states to "offline"', () => {
    const offlineStates = [
      'NEW',
      'KYC_SUBMITTED',
      'SUSPENDED',
      'CLOSED',
      'PROFILE_SUBMITTED',
    ];

    offlineStates.forEach((state) => {
      expect(getRiderStatus(createMockRider(state))).toBe('offline');
    });
  });
});
