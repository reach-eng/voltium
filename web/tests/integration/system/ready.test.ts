import { describe, it, expect } from 'vitest';
import { api } from '../helpers';

describe('GET /api/ready', () => {
  it('should return 200 OK successfully', async () => {
    const { status, body } = await api('/api/ready');
    
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});
