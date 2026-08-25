import { describe, it, expect } from 'vitest';
import { api } from '../helpers';

describe('GET /api/ready', () => {
  it('should return 200 OK successfully', async () => {
    const { status, body } = await api('/api/ready');

    expect(status).toBe(200);
    // /api/ready returns a lightweight `{ status: 'ready' }` body
    // (no `success` wrapper) — the liveness probe doesn't need the
    // standard API envelope. Just assert the status field.
    expect(body.status).toBe('ready');
  });
});
