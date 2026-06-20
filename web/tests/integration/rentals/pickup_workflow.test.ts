import { describe, it, expect } from 'vitest';
import { api, generateRandomPhone, riderLogin } from '../helpers';

describe('Pickup Workflow Integration', () => {
  it('should verify booking, vehicle query, and pickup sync endpoints under offline bypass', async () => {
    // 1. Register a new rider
    const phone = generateRandomPhone();
    const { token, id: riderDbId } = await riderLogin(phone);

    // 2. Try to book a vehicle
    const bookRes = await api('/api/rental/book', {
      method: 'POST',
      token,
      json: {
        vehicleId: 'some-vehicle-id',
        shiftId: 'some-shift-id',
        leaseDate: '2026-06-20',
        startTime: '08:00',
      },
    });
    // Under offline bypass, vehicle findUnique returns null, throwing 'Vehicle not found' -> 404
    expect(bookRes.status).toBe(404);
    expect(bookRes.body.success).toBe(false);
    expect(bookRes.body.error.message).toContain('Vehicle not found');

    // 3. Verify pickup vehicle lookup via GET /api/rider/sync/pickup/vehicle
    const verifyRes = await api('/api/rider/sync/pickup/vehicle?query=VEH-123&hubId=hub-1', {
      method: 'GET',
      token,
    });
    // Under offline bypass, vehicle findFirst returns null, throwing 'Vehicle not found at this hub' -> 404
    expect(verifyRes.status).toBe(404);
    expect(verifyRes.body.success).toBe(false);
    expect(verifyRes.body.error.message).toContain('Vehicle not found at this hub');

    // 4. Try to sync vehicle pickup
    const syncRes = await api('/api/rider/sync/pickup', {
      method: 'POST',
      token,
      json: {
        vehicleId: 'VEH-123',
        hubId: 'hub-1',
        teamLeader: 'Leader Name',
        emergencyContact: '9876543210',
        pickupPhotoFront: 'uploads/front.jpg',
        pickupPhotoBack: 'uploads/back.jpg',
      },
    });
    // Under offline bypass, vehicle findFirst returns null, throwing 'Vehicle not found' -> 404
    expect(syncRes.status).toBe(404);
    expect(syncRes.body.success).toBe(false);
    expect(syncRes.body.error.message).toContain('Vehicle not found');
  });
});
