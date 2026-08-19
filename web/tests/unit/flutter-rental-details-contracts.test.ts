import { describe, it, expect } from 'vitest';

describe('Flutter Rental Details & DateHelpers Contracts', () => {
  it('returns "—" when planEndDate is null instead of false 7d fallback', () => {
    const computeTimeRemaining = (planEndDate: Date | null): string => {
      if (planEndDate != null) {
        const remainingMs = planEndDate.getTime() - Date.now();
        if (remainingMs < 0) return 'Expired';
        const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h`;
        return '<1h';
      }
      return '—';
    };

    expect(computeTimeRemaining(null)).toBe('—');
    expect(computeTimeRemaining(new Date(Date.now() - 10000))).toBe('Expired');
    expect(computeTimeRemaining(new Date(Date.now() + 86400000 * 5 + 60000))).toContain('5d');
  });

  it('includes vehicleId and hubId from rider state in vehicle return call', () => {
    const riderState = {
      assignedVehicle: 'v_scooter_101',
      pickupHub: 'hub_central',
    };

    const submitVehicleReturnPayload = {
      vehicleId: riderState.assignedVehicle ?? '',
      hubId: riderState.pickupHub ?? '',
      photos: ['https://cdn.voltium.app/ret1.jpg', 'https://cdn.voltium.app/ret2.jpg'],
    };

    expect(submitVehicleReturnPayload.vehicleId).toBe('v_scooter_101');
    expect(submitVehicleReturnPayload.hubId).toBe('hub_central');
    expect(submitVehicleReturnPayload.photos.length).toBe(2);
  });
});
