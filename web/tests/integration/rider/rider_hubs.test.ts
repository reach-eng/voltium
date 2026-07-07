import { describe, it, expect } from 'vitest';
import { api } from '../helpers';

describe('GET /api/rider/hubs', () => {
  it('should successfully list hubs', async () => {
    const { status, body } = await api('/api/rider/hubs', {
      method: 'GET',
    });
    
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
