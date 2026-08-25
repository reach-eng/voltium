import { describe, it, expect, beforeAll } from 'vitest';
import { api, riderLogin, generateRandomPhone } from '../helpers';

describe('POST /api/transaction/request', () => {
  let riderToken: string;

  beforeAll(async () => {
    const phone = generateRandomPhone();
    const loginRes = await riderLogin(phone);
    riderToken = loginRes.token;
  });

  it('should return 401 if not authenticated', async () => {
    const { status, body } = await api('/api/transaction/request', {
      method: 'POST',
      json: {
        amount: 500,
        purpose: 'TOP_UP',
      },
    });
    
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('should return 400 (or 422) for missing validation fields', async () => {
    const { status, body } = await api('/api/transaction/request', {
      method: 'POST',
      token: riderToken,
      json: {},
    });
    
    // Zod validation returns 400 badRequest here
    expect([400, 405, 422]).toContain(status);
    expect(body.success).toBe(false);
  });

  it('should successfully create a transaction request', async () => {
    const { status, body } = await api('/api/transaction/request', {
      method: 'POST',
      token: riderToken,
      json: {
        amount: 500,
        purpose: 'TOP_UP',
        method: 'UPI',
        upiRef: 'UPI123456789',
      },
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    // The API exposes money as `amountInRupees` (DB stores paise; the
    // boundary converts). Older tests asserted the bare `amount` key
    // — the contract moved on.
    expect(body.data).toHaveProperty('amountInRupees');
  });
});
