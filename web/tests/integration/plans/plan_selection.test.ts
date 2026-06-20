import { describe, it, expect } from 'vitest';
import { api, generateRandomPhone, riderLogin } from '../helpers';

describe('Plan Selection Integration Workflow', () => {
  it('should verify active plans list and guards under offline database bypass', async () => {
    // 1. Fetch active plans via GET /api/rider/plans
    const getPlansRes = await api('/api/rider/plans', {
      method: 'GET',
    });
    expect(getPlansRes.status).toBe(200);
    expect(getPlansRes.body.success).toBe(true);
    expect(Array.isArray(getPlansRes.body.data)).toBe(true);
    // Under offline bypass, count/findMany returns 0/[]
    expect(getPlansRes.body.data.length).toBe(0);

    // 2. Register a new rider
    const phone = generateRandomPhone();
    const { token, id: riderDbId } = await riderLogin(phone);

    // 3. Try to subscribe to a non-existent or dummy plan
    const subscribeRes = await api('/api/rider/plans', {
      method: 'POST',
      token,
      json: {
        riderId: riderDbId,
        planId: 'some-non-existent-plan-id',
      },
    });
    // Under offline bypass, findUnique on plan returns null, throwing 'Plan not found' -> 404
    expect(subscribeRes.status).toBe(404);
    expect(subscribeRes.body.success).toBe(false);
    expect(subscribeRes.body.error.message).toContain('Plan not found');
  });
});
